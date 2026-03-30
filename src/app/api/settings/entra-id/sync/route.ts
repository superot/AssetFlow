import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, upsertSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

interface GraphUser {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  department: string | null;
  accountEnabled: boolean | null;
  jobTitle: string | null;
}

interface GraphResponse {
  value: GraphUser[];
  "@odata.nextLink"?: string;
}

async function getEntraToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token request failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("No access_token in response");
  return json.access_token as string;
}

async function fetchAllGraphUsers(token: string, activeOnly: boolean): Promise<GraphUser[]> {
  const users: GraphUser[] = [];
  const select = "id,displayName,mail,userPrincipalName,department,accountEnabled,jobTitle";
  const odataFilter = activeOnly ? "&$filter=accountEnabled eq true" : "";
  let url =
    `https://graph.microsoft.com/v1.0/users` +
    `?$select=${select}${odataFilter}&$top=999`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Graph API error (${res.status}): ${body}`);
    }
    const json: GraphResponse = await res.json();
    users.push(...json.value);
    url = json["@odata.nextLink"] ?? "";
  }

  return users;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Load credentials + filter settings
  const settings = await getSettings([
    "entra_tenant_id",
    "entra_client_id",
    "entra_client_secret",
    "entra_filter_active_only",
    "entra_filter_require_email",
    "entra_filter_require_department",
    "entra_filter_skip_guests",
    "entra_filter_departments",
    "entra_sync_deactivate_removed",
  ]);

  const { entra_tenant_id, entra_client_id, entra_client_secret } = settings;

  if (!entra_tenant_id || !entra_client_id || !entra_client_secret) {
    return NextResponse.json(
      { error: "Entra ID credentials are not configured. Please save them first." },
      { status: 400 }
    );
  }

  // Parse filter flags (defaults: active_only=true, require_email=true, skip_guests=true, rest=false)
  const activeOnly = settings.entra_filter_active_only !== "false";
  const requireEmail = settings.entra_filter_require_email !== "false";
  const requireDepartment = settings.entra_filter_require_department === "true";
  const skipGuests = settings.entra_filter_skip_guests !== "false";
  const deactivateRemoved = settings.entra_sync_deactivate_removed === "true";
  const allowedDepts = settings.entra_filter_departments
    ? settings.entra_filter_departments
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    : [];

  // Fetch token
  let token: string;
  try {
    token = await getEntraToken(entra_tenant_id, entra_client_id, entra_client_secret);
  } catch (e) {
    return NextResponse.json(
      { error: `Authentication failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  // Fetch users (active-only pre-filter applied server-side when enabled)
  let graphUsers: GraphUser[];
  try {
    graphUsers = await fetchAllGraphUsers(token, activeOnly);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to fetch users: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  // Upsert loop
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let deactivated = 0;
  const errors: { email: string; error: string }[] = [];
  const syncedEmails: string[] = [];

  // Department cache to avoid redundant DB calls
  const departmentCache = new Map<string, string>();

  async function findOrCreateDepartment(name: string): Promise<string> {
    if (departmentCache.has(name)) return departmentCache.get(name)!;
    const dept = await prisma.department.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    departmentCache.set(name, dept.id);
    return dept.id;
  }

  // Process in batches of 50
  const BATCH = 50;
  for (let i = 0; i < graphUsers.length; i += BATCH) {
    const batch = graphUsers.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (gu) => {
        // Skip guest accounts
        if (skipGuests && gu.userPrincipalName?.includes("#EXT#")) { skipped++; return; }

        // Derive email
        const email = gu.mail ?? gu.userPrincipalName;
        if (requireEmail && !email) { skipped++; return; }
        if (!email) { skipped++; return; }

        // Skip disabled accounts (client-side check; server-side $filter already applied when activeOnly=true)
        if (activeOnly && gu.accountEnabled === false) { skipped++; return; }

        // Skip accounts without department
        if (requireDepartment && !gu.department) { skipped++; return; }

        // Department allow-list filter
        if (
          allowedDepts.length > 0 &&
          (!gu.department || !allowedDepts.includes(gu.department.toLowerCase()))
        ) {
          skipped++;
          return;
        }

        try {
          const departmentId = gu.department
            ? await findOrCreateDepartment(gu.department)
            : null;

          const isActive = gu.accountEnabled ?? true;

          const existing = await prisma.user.findUnique({ where: { email } });

          await prisma.user.upsert({
            where: { email },
            create: {
              name: gu.displayName ?? email,
              email,
              role: "USER",
              isActive,
              ...(departmentId && { departmentId }),
            },
            update: {
              name: gu.displayName ?? email,
              isActive,
              ...(departmentId !== null ? { departmentId } : {}),
            },
          });

          syncedEmails.push(email);
          if (existing) { updated++; } else { created++; }
        } catch (e) {
          errors.push({ email: email!, error: (e as Error).message });
        }
      })
    );
  }

  // Deactivate users not present in this sync (optional)
  if (deactivateRemoved && syncedEmails.length > 0) {
    const result = await prisma.user.updateMany({
      where: { email: { notIn: syncedEmails }, isActive: true },
      data: { isActive: false },
    });
    deactivated = result.count;
  }

  // Record last sync time and write audit log
  await upsertSetting("entra_last_sync_at", new Date().toISOString());
  await createAuditLog({
    entityType: "SystemSetting",
    entityId: "entra_sync",
    action: "UPDATED",
    changedBy: (session.user as { id: string }).id,
    newValue: { created, updated, skipped, deactivated, errorCount: errors.length },
  });

  return NextResponse.json({ data: { created, updated, skipped, deactivated, errors } });
}

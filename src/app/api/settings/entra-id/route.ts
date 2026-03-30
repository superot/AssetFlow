import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, upsertSettings } from "@/lib/settings";
import { updateEntraIdSchema } from "@/lib/validations";

const MASKED = "••••••••";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminGuard(session: any) {
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  const settings = await getSettings([
    "entra_tenant_id",
    "entra_client_id",
    "entra_client_secret",
  ]);

  return NextResponse.json({
    data: {
      entra_tenant_id: settings.entra_tenant_id ?? "",
      entra_client_id: settings.entra_client_id ?? "",
      // Never return the real secret — return masked placeholder if set
      entra_client_secret: settings.entra_client_secret ? MASKED : "",
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  try {
    const body = await req.json();
    const input = updateEntraIdSchema.parse(body);

    const toSave: Record<string, string> = {
      entra_tenant_id: input.entra_tenant_id,
      entra_client_id: input.entra_client_id,
    };
    // Only save secret if user actually changed it (not the masked placeholder, not empty)
    if (input.entra_client_secret && input.entra_client_secret !== MASKED) {
      toSave.entra_client_secret = input.entra_client_secret;
    }

    await upsertSettings(toSave);
    return NextResponse.json({ data: { saved: true } });
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }
}

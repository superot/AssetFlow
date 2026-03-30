import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getRequestMeta } from "@/lib/audit";

// ── Graph token (reuses Entra credentials) ──────────────────────────────────

async function getGraphToken(
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

// ── Email builder ─────────────────────────────────────────────────────────────

interface LicenseRow {
  id: string;
  name: string;
  vendor: string | null;
  expirationDate: Date | null;
  totalSeats: number;
  availableSeats: number;
}

function buildEmailHtml(
  expired: LicenseRow[],
  expiringSoon: LicenseRow[],
  daysBefore: number,
  appName: string
): string {
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const tableStyle =
    "width:100%;border-collapse:collapse;margin-top:8px;font-size:14px;";
  const thStyle =
    "text-align:left;padding:8px 12px;background:#f3f4f6;border:1px solid #e5e7eb;font-weight:600;";
  const tdStyle = "padding:8px 12px;border:1px solid #e5e7eb;";

  function renderTable(rows: LicenseRow[], accent: string): string {
    return `
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">License</th>
            <th style="${thStyle}">Vendor</th>
            <th style="${thStyle}">Expiry Date</th>
            <th style="${thStyle}">Seats</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (l) => `
            <tr>
              <td style="${tdStyle}"><strong>${l.name}</strong></td>
              <td style="${tdStyle}">${l.vendor ?? "—"}</td>
              <td style="${tdStyle}"><span style="color:${accent};font-weight:600;">${fmt(l.expirationDate)}</span></td>
              <td style="${tdStyle}">${l.availableSeats} / ${l.totalSeats}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  const sections: string[] = [];

  if (expired.length > 0) {
    sections.push(`
      <h3 style="color:#dc2626;margin:24px 0 4px;">Expired Licenses (${expired.length})</h3>
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">These licenses have already expired and may need immediate renewal.</p>
      ${renderTable(expired, "#dc2626")}`);
  }

  if (expiringSoon.length > 0) {
    sections.push(`
      <h3 style="color:#d97706;margin:24px 0 4px;">Expiring Within ${daysBefore} Days (${expiringSoon.length})</h3>
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">These licenses will expire soon. Please renew them before the expiry date.</p>
      ${renderTable(expiringSoon, "#d97706")}`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1e293b;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">${appName}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">License Expiry Notification</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;color:#374151;">
        This is an automated alert. The following software licenses in your inventory require attention.
      </p>
      ${sections.join("")}
      <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        Sent automatically by <strong>${appName}</strong>.
        You can manage notification settings in the Settings → Notifications panel.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send via Graph ────────────────────────────────────────────────────────────

async function sendMail(
  token: string,
  senderEmail: string,
  recipientEmail: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: recipientEmail } }],
        },
        saveToSentItems: false,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sendMail failed (${res.status}): ${body}`);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Load all relevant settings in parallel
    const [notifSettings, entraSettings, generalSettings] = await Promise.all([
      getSettings([
        "notifications_enabled",
        "notification_recipient_email",
        "notification_sender_email",
        "notification_days_before",
      ]),
      getSettings(["entra_tenant_id", "entra_client_id", "entra_client_secret"]),
      getSettings(["app_name"]),
    ]);

    if (notifSettings.notifications_enabled !== "true") {
      return NextResponse.json(
        { error: "Email notifications are disabled. Enable them in Settings → Notifications." },
        { status: 400 }
      );
    }

    const recipientEmail = notifSettings.notification_recipient_email;
    const senderEmail = notifSettings.notification_sender_email;
    const daysBefore = parseInt(notifSettings.notification_days_before ?? "30");
    const appName = generalSettings.app_name ?? "AssetFlow";

    if (!recipientEmail || !senderEmail) {
      return NextResponse.json(
        { error: "Recipient and sender email addresses must be configured in Notifications settings." },
        { status: 400 }
      );
    }

    const { entra_tenant_id, entra_client_id, entra_client_secret } = entraSettings;
    if (!entra_tenant_id || !entra_client_id || !entra_client_secret) {
      return NextResponse.json(
        { error: "Entra ID credentials are not configured. Please save them in Settings → Entra ID Sync." },
        { status: 400 }
      );
    }

    // Query licenses
    const now = new Date();
    const threshold = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    const [expired, expiringSoon] = await Promise.all([
      prisma.license.findMany({
        where: { deletedAt: null, expirationDate: { lt: now } },
        select: { id: true, name: true, vendor: true, expirationDate: true, totalSeats: true, availableSeats: true },
        orderBy: { expirationDate: "asc" },
      }),
      prisma.license.findMany({
        where: { deletedAt: null, expirationDate: { gte: now, lte: threshold } },
        select: { id: true, name: true, vendor: true, expirationDate: true, totalSeats: true, availableSeats: true },
        orderBy: { expirationDate: "asc" },
      }),
    ]);

    if (expired.length === 0 && expiringSoon.length === 0) {
      return NextResponse.json({
        data: { sent: false, expired: 0, expiringSoon: 0, message: "No expiring or expired licenses found." },
      });
    }

    // Get Graph token
    let token: string;
    try {
      token = await getGraphToken(entra_tenant_id, entra_client_id, entra_client_secret);
    } catch (e) {
      return NextResponse.json(
        { error: `Authentication failed: ${(e as Error).message}` },
        { status: 502 }
      );
    }

    // Build and send email
    const subject =
      expired.length > 0
        ? `[${appName}] ⚠️ ${expired.length} License(s) Expired, ${expiringSoon.length} Expiring Soon`
        : `[${appName}] ⚠️ ${expiringSoon.length} License(s) Expiring Within ${daysBefore} Days`;

    const html = buildEmailHtml(expired, expiringSoon, daysBefore, appName);

    try {
      await sendMail(token, senderEmail, recipientEmail, subject, html);
    } catch (e) {
      return NextResponse.json(
        { error: `Failed to send email: ${(e as Error).message}` },
        { status: 502 }
      );
    }

    // Audit log
    const { ipAddress, userAgent } = getRequestMeta(req);
    await createAuditLog({
      entityType: "SystemSetting",
      entityId: "license_expiry_notification",
      action: "UPDATED",
      changedBy: (session.user as { id: string }).id,
      newValue: {
        sent: true,
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        recipient: recipientEmail,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      data: {
        sent: true,
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        recipient: recipientEmail,
      },
    });
  } catch (e) {
    console.error("POST /api/notifications/license-expiry error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

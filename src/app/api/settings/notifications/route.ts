import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, upsertSettings } from "@/lib/settings";
import { updateNotificationSettingsSchema } from "@/lib/validations";

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
    "notifications_enabled",
    "notification_recipient_email",
    "notification_sender_email",
    "notification_days_before",
  ]);

  return NextResponse.json({
    data: {
      notifications_enabled: settings.notifications_enabled === "true",
      notification_recipient_email: settings.notification_recipient_email ?? "",
      notification_sender_email: settings.notification_sender_email ?? "",
      notification_days_before: parseInt(settings.notification_days_before ?? "30"),
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  try {
    const body = await req.json();
    const input = updateNotificationSettingsSchema.parse(body);

    await upsertSettings({
      notifications_enabled: input.notifications_enabled ? "true" : "false",
      notification_recipient_email: input.notification_recipient_email,
      notification_sender_email: input.notification_sender_email,
      notification_days_before: String(input.notification_days_before),
    });

    return NextResponse.json({ data: { saved: true } });
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }
}

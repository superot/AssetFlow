import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, upsertSettings } from "@/lib/settings";
import { updateGeneralSettingsSchema } from "@/lib/validations";

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

  const settings = await getSettings(["app_name", "warranty_alert_days"]);
  return NextResponse.json({
    data: {
      app_name: settings.app_name ?? "AssetFlow",
      warranty_alert_days: settings.warranty_alert_days ?? "30",
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  try {
    const body = await req.json();
    const input = updateGeneralSettingsSchema.parse(body);
    await upsertSettings({
      app_name: input.app_name,
      warranty_alert_days: String(input.warranty_alert_days),
    });
    return NextResponse.json({ data: input });
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }
}

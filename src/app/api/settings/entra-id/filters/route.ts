import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, upsertSettings } from "@/lib/settings";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminGuard(session: any) {
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

const FILTER_KEYS = [
  "entra_filter_active_only",
  "entra_filter_require_email",
  "entra_filter_require_department",
  "entra_filter_skip_guests",
  "entra_filter_departments",
  "entra_sync_deactivate_removed",
  "entra_last_sync_at",
] as const;

const filtersSchema = z.object({
  entra_filter_active_only: z.boolean(),
  entra_filter_require_email: z.boolean(),
  entra_filter_require_department: z.boolean(),
  entra_filter_skip_guests: z.boolean(),
  entra_filter_departments: z.string(),
  entra_sync_deactivate_removed: z.boolean(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  const raw = await getSettings([...FILTER_KEYS]);

  return NextResponse.json({
    data: {
      entra_filter_active_only: raw.entra_filter_active_only !== "false",
      entra_filter_require_email: raw.entra_filter_require_email !== "false",
      entra_filter_require_department: raw.entra_filter_require_department === "true",
      entra_filter_skip_guests: raw.entra_filter_skip_guests !== "false",
      entra_filter_departments: raw.entra_filter_departments ?? "",
      entra_sync_deactivate_removed: raw.entra_sync_deactivate_removed === "true",
      entra_last_sync_at: raw.entra_last_sync_at ?? null,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  try {
    const body = await req.json();
    const input = filtersSchema.parse(body);

    await upsertSettings({
      entra_filter_active_only: String(input.entra_filter_active_only),
      entra_filter_require_email: String(input.entra_filter_require_email),
      entra_filter_require_department: String(input.entra_filter_require_department),
      entra_filter_skip_guests: String(input.entra_filter_skip_guests),
      entra_filter_departments: input.entra_filter_departments,
      entra_sync_deactivate_removed: String(input.entra_sync_deactivate_removed),
    });

    return NextResponse.json({ data: { saved: true } });
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }
}

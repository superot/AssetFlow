import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("activate"),
    ids: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal("deactivate"),
    ids: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal("setDepartment"),
    ids: z.array(z.string()).min(1),
    departmentId: z.string().cuid(),
  }),
]);

// PATCH /api/users/bulk
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { action, ids } = parsed.data;
    const changedBy = (session.user as { id: string }).id;
    const { ipAddress, userAgent } = getRequestMeta(req);

    let data: Record<string, unknown>;
    if (action === "activate") {
      data = { isActive: true };
    } else if (action === "deactivate") {
      data = { isActive: false };
    } else {
      data = { departmentId: parsed.data.departmentId };
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: ids } },
      data,
    });

    await createAuditLog({
      entityType: "User",
      entityId: `bulk:${ids.length}`,
      action: "UPDATED",
      changedBy,
      newValue: { action, ids, ...data },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: { updated: result.count } });
  } catch (e) {
    console.error("PATCH /api/users/bulk error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

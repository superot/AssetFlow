import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

// PATCH /api/assignments/bulk-return
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ ids: z.array(z.string()).min(1) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { ids } = parsed.data;
    const returnedById = (session.user as { id: string }).id;
    const { ipAddress, userAgent } = getRequestMeta(req);
    const now = new Date();

    const active = await prisma.assignment.findMany({
      where: { id: { in: ids }, returnedAt: null },
      include: { asset: true, license: true },
    });

    const skipped = ids.length - active.length;

    if (active.length === 0) {
      return NextResponse.json({ data: { returned: 0, skipped } });
    }

    await prisma.$transaction(async (tx) => {
      // Mark all as returned
      await tx.assignment.updateMany({
        where: { id: { in: active.map((a) => a.id) } },
        data: { returnedAt: now },
      });

      // Release all assets
      const assetIds = active.filter((a) => a.assetId).map((a) => a.assetId!);
      if (assetIds.length > 0) {
        await tx.asset.updateMany({
          where: { id: { in: assetIds } },
          data: { status: "AVAILABLE" },
        });
      }

      // Increment license seats (one update per license)
      const licenseAssignments = active.filter((a) => a.licenseId);
      for (const la of licenseAssignments) {
        await tx.license.update({
          where: { id: la.licenseId! },
          data: { availableSeats: { increment: 1 } },
        });
      }
    });

    await createAuditLog({
      entityType: "Assignment",
      entityId: `bulk:${active.length}`,
      action: "RETURNED",
      changedBy: returnedById,
      newValue: { returnedIds: active.map((a) => a.id), returnedAt: now.toISOString() },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: { returned: active.length, skipped } });
  } catch (e) {
    console.error("PATCH /api/assignments/bulk-return error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

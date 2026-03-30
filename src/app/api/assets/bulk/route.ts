import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const bulkIdsSchema = z.object({ ids: z.array(z.string().cuid()).min(1) });

// PATCH /api/assets/bulk — bulk status change
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = bulkIdsSchema.extend({
      status: z.enum(["AVAILABLE", "UNDER_REPAIR", "ARCHIVED"]),
    }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { ids, status } = parsed.data;

    // Skip assets that are DEPLOYED — can't change status without a return
    const skipped = await prisma.asset.findMany({
      where: { id: { in: ids }, status: "DEPLOYED" },
      select: { assetTag: true },
    });
    const skippedTags = skipped.map((a) => a.assetTag);

    const toUpdate = await prisma.asset.findMany({
      where: { id: { in: ids }, status: { not: "DEPLOYED" }, deletedAt: null },
      select: { id: true },
    });
    const toUpdateIds = toUpdate.map((a) => a.id);

    const { count } = await prisma.asset.updateMany({
      where: { id: { in: toUpdateIds } },
      data: { status },
    });

    const { ipAddress, userAgent } = getRequestMeta(req);
    if (count > 0) {
      await createAuditLog({
        entityType: "Asset",
        entityId: `bulk:${count}`,
        action: "STATUS_CHANGED",
        changedBy: (session.user as { id: string }).id,
        newValue: { status, updatedIds: toUpdateIds },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({
      data: { updated: count, skipped: skippedTags.length, skippedTags },
    });
  } catch (e) {
    console.error("PATCH /api/assets/bulk error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/assets/bulk — bulk soft-delete
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = bulkIdsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { ids } = parsed.data;

    // Skip DEPLOYED assets
    const skipped = await prisma.asset.findMany({
      where: { id: { in: ids }, status: "DEPLOYED" },
      select: { assetTag: true },
    });
    const skippedTags = skipped.map((a) => a.assetTag);

    const toDelete = await prisma.asset.findMany({
      where: { id: { in: ids }, status: { not: "DEPLOYED" }, deletedAt: null },
      select: { id: true },
    });
    const toDeleteIds = toDelete.map((a) => a.id);

    const { count } = await prisma.asset.updateMany({
      where: { id: { in: toDeleteIds } },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });

    const { ipAddress, userAgent } = getRequestMeta(req);
    if (count > 0) {
      await createAuditLog({
        entityType: "Asset",
        entityId: `bulk:${count}`,
        action: "DELETED",
        changedBy: (session.user as { id: string }).id,
        newValue: { deletedIds: toDeleteIds },
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({
      data: { deleted: count, skipped: skippedTags.length, skippedTags },
    });
  } catch (e) {
    console.error("DELETE /api/assets/bulk error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

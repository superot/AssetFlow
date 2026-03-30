import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateAssetSchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

// GET /api/assets/:id
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const asset = await prisma.asset.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      category: true,
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: { user: true, createdBy: true },
      },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ data: asset });
}

// PUT /api/assets/:id
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.asset.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = await req.json();
    const input = updateAssetSchema.parse(body);

    const updated = await prisma.asset.update({
      where: { id: params.id },
      data: {
        ...input,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : undefined,
      },
      include: { category: true },
    });

    const { ipAddress, userAgent } = getRequestMeta(req);
    await createAuditLog({
      entityType: "Asset",
      entityId: params.id,
      action: input.status && input.status !== existing.status ? "STATUS_CHANGED" : "UPDATED",
      changedBy: (session.user as { id: string }).id,
      oldValue: { status: existing.status, name: existing.name } as Record<string, unknown>,
      newValue: input as Record<string, unknown>,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/assets/:id  — soft delete
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.asset.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Block deletion if currently deployed
  if (existing.status === "DEPLOYED") {
    return NextResponse.json(
      { error: "Cannot delete a deployed asset. Return it first." },
      { status: 409 }
    );
  }

  await prisma.asset.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });

  const { ipAddress, userAgent } = getRequestMeta(req);
  await createAuditLog({
    entityType: "Asset",
    entityId: params.id,
    action: "DELETED",
    changedBy: (session.user as { id: string }).id,
    oldValue: { status: existing.status } as Record<string, unknown>,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ message: "Asset archived successfully" });
}

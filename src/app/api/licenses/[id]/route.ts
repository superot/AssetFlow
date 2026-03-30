import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateLicenseSchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

// GET /api/licenses/:id
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const license = await prisma.license.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      category: true,
      assignments: {
        where: { returnedAt: null },
        include: { user: true },
      },
    },
  });

  if (!license) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  return NextResponse.json({ data: license });
}

// PUT /api/licenses/:id
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.license.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    const body = await req.json();
    const input = updateLicenseSchema.parse(body);

    // If totalSeats changed, adjust availableSeats proportionally
    let availableSeats = existing.availableSeats;
    if (input.totalSeats !== undefined && input.totalSeats !== existing.totalSeats) {
      const usedSeats = existing.totalSeats - existing.availableSeats;
      availableSeats = Math.max(0, input.totalSeats - usedSeats);
    }

    const updated = await prisma.license.update({
      where: { id: params.id },
      data: {
        ...input,
        availableSeats,
        expirationDate: input.expirationDate ? new Date(input.expirationDate) : undefined,
      },
      include: { category: true },
    });

    const { ipAddress, userAgent } = getRequestMeta(req);
    await createAuditLog({
      entityType: "License",
      entityId: params.id,
      action: "UPDATED",
      changedBy: (session.user as { id: string }).id,
      oldValue: { totalSeats: existing.totalSeats, name: existing.name } as Record<string, unknown>,
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

// DELETE /api/licenses/:id  — soft delete
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.license.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  const activeAssignments = existing.totalSeats - existing.availableSeats;
  if (activeAssignments > 0) {
    return NextResponse.json(
      { error: `Cannot delete license with ${activeAssignments} active assignment(s). Return them first.` },
      { status: 409 }
    );
  }

  await prisma.license.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  const { ipAddress, userAgent } = getRequestMeta(req);
  await createAuditLog({
    entityType: "License",
    entityId: params.id,
    action: "DELETED",
    changedBy: (session.user as { id: string }).id,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ message: "License deleted successfully" });
}

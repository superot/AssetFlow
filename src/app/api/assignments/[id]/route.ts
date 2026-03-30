import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { returnAssignmentSchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

// GET /api/assignments/:id
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      createdBy: true,
      asset: { include: { category: true } },
      license: { include: { category: true } },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  return NextResponse.json({ data: assignment });
}

// PATCH /api/assignments/:id  — return asset or license seat
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: { asset: true, license: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    if (assignment.returnedAt) {
      return NextResponse.json({ error: "Assignment already returned" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const { notes } = returnAssignmentSchema.parse(body);
    const returnedById = (session.user as { id: string }).id;
    const { ipAddress, userAgent } = getRequestMeta(req);
    const now = new Date();

    // ── Return asset ───────────────────────────────────────────
    if (assignment.assetId && assignment.asset) {
      await prisma.$transaction(async (tx) => {
        // 1. Mark asset as AVAILABLE
        await tx.asset.update({
          where: { id: assignment.assetId! },
          data: { status: "AVAILABLE" },
        });

        // 2. Record return date
        await tx.assignment.update({
          where: { id: params.id },
          data: { returnedAt: now, ...(notes && { notes }) },
        });

        // 3. Audit log
        await createAuditLog(
          {
            entityType: "Asset",
            entityId: assignment.assetId!,
            action: "RETURNED",
            changedBy: returnedById,
            oldValue: { status: "DEPLOYED" },
            newValue: { status: "AVAILABLE", returnedAt: now.toISOString() },
            ipAddress,
            userAgent,
          },
          tx
        );
      });
    }

    // ── Return license seat ────────────────────────────────────
    if (assignment.licenseId && assignment.license) {
      const prevSeats = assignment.license.availableSeats;
      await prisma.$transaction(async (tx) => {
        // 1. Increment available seats
        await tx.license.update({
          where: { id: assignment.licenseId! },
          data: { availableSeats: { increment: 1 } },
        });

        // 2. Record return date
        await tx.assignment.update({
          where: { id: params.id },
          data: { returnedAt: now, ...(notes && { notes }) },
        });

        // 3. Audit log
        await createAuditLog(
          {
            entityType: "License",
            entityId: assignment.licenseId!,
            action: "RETURNED",
            changedBy: returnedById,
            oldValue: { availableSeats: prevSeats },
            newValue: { availableSeats: prevSeats + 1 },
            ipAddress,
            userAgent,
          },
          tx
        );
      });
    }

    const updated = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        asset: { include: { category: true } },
        license: { include: { category: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

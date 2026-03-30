import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAssignmentSchema, paginationSchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/assignments
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const query = paginationSchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortDir: searchParams.get("sortDir") ?? undefined,
    });

    const userId = searchParams.get("userId") ?? undefined;
    const active = searchParams.get("active");
    const search = searchParams.get("search") ?? undefined;
    const type = searchParams.get("type") ?? undefined; // "asset" | "license"

    const VALID_SORT = ["assignedAt", "returnedAt"];
    const sortField = VALID_SORT.includes(query.sortBy ?? "") ? query.sortBy! : "assignedAt";
    const sortDir = query.sortDir ?? "desc";

    const where = {
      ...(userId && { userId }),
      ...(active === "true" && { returnedAt: null }),
      ...(type === "asset" && { assetId: { not: null } }),
      ...(type === "license" && { licenseId: { not: null } }),
      ...(search && {
        OR: [
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
          { asset: { name: { contains: search } } },
          { asset: { assetTag: { contains: search } } },
          { license: { name: { contains: search } } },
        ],
      }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.assignment.findMany({
        where,
        include: {
          user: true,
          createdBy: true,
          asset: { include: { category: true } },
          license: { include: { category: true } },
        },
        orderBy: { [sortField]: sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.assignment.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    });
  } catch {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
}

// POST /api/assignments  — assign asset or license to user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = createAssignmentSchema.parse(body);
    const assignedById = (session.user as { id: string }).id;
    const { ipAddress, userAgent } = getRequestMeta(req);

    // ── Asset assignment ───────────────────────────────────────
    if (input.assetId) {
      const asset = await prisma.asset.findFirst({
        where: { id: input.assetId, deletedAt: null },
      });

      if (!asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
      if (asset.status !== "AVAILABLE") {
        return NextResponse.json(
          { error: `Asset is not available (current status: ${asset.status})` },
          { status: 409 }
        );
      }

      const assignment = await prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: input.assetId },
          data: { status: "DEPLOYED" },
        });

        const newAssignment = await tx.assignment.create({
          data: {
            assetId: input.assetId,
            userId: input.userId,
            assignedBy: assignedById,
            notes: input.notes,
          },
          include: { user: true, asset: { include: { category: true } } },
        });

        await createAuditLog(
          {
            entityType: "Asset",
            entityId: input.assetId!,
            action: "ASSIGNED",
            changedBy: assignedById,
            oldValue: { status: "AVAILABLE" },
            newValue: { status: "DEPLOYED", assignedTo: input.userId },
            ipAddress,
            userAgent,
          },
          tx
        );

        return newAssignment;
      });

      return NextResponse.json({ data: assignment }, { status: 201 });
    }

    // ── License assignment ─────────────────────────────────────
    if (input.licenseId) {
      const license = await prisma.license.findFirst({
        where: { id: input.licenseId, deletedAt: null },
      });

      if (!license) {
        return NextResponse.json({ error: "License not found" }, { status: 404 });
      }
      if (license.availableSeats <= 0) {
        return NextResponse.json(
          { error: "No available seats for this license" },
          { status: 409 }
        );
      }

      const assignment = await prisma.$transaction(async (tx) => {
        await tx.license.update({
          where: { id: input.licenseId },
          data: { availableSeats: { decrement: 1 } },
        });

        const newAssignment = await tx.assignment.create({
          data: {
            licenseId: input.licenseId,
            userId: input.userId,
            assignedBy: assignedById,
            notes: input.notes,
          },
          include: { user: true, license: { include: { category: true } } },
        });

        await createAuditLog(
          {
            entityType: "License",
            entityId: input.licenseId!,
            action: "ASSIGNED",
            changedBy: assignedById,
            oldValue: { availableSeats: license.availableSeats },
            newValue: { availableSeats: license.availableSeats - 1, assignedTo: input.userId },
            ipAddress,
            userAgent,
          },
          tx
        );

        return newAssignment;
      });

      return NextResponse.json({ data: assignment }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

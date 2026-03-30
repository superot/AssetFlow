import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLicenseSchema, paginationSchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/licenses
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const query = paginationSchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
    });

    const where = {
      deletedAt: null,
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { vendor: { contains: query.search } },
        ],
      }),
      ...(query.categoryId && { categoryId: query.categoryId }),
    };

    const [data, total] = await prisma.$transaction([
      prisma.license.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.license.count({ where }),
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

// POST /api/licenses
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = createLicenseSchema.parse(body);

    const license = await prisma.license.create({
      data: {
        ...input,
        availableSeats: input.totalSeats,
        expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
        purchaseCost: input.purchaseCost ?? null,
        licenseKey: input.licenseKey ?? null,
      },
      include: { category: true },
    });

    const { ipAddress, userAgent } = getRequestMeta(req);
    await createAuditLog({
      entityType: "License",
      entityId: license.id,
      action: "CREATED",
      changedBy: (session.user as { id: string }).id,
      newValue: input as Record<string, unknown>,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: license }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

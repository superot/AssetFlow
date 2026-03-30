import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAssetSchema, paginationSchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/assets
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const query = paginationSchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortDir: searchParams.get("sortDir") ?? undefined,
    });

    const where = {
      deletedAt: null,
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { assetTag: { contains: query.search } },
          { serialNumber: { contains: query.search } },
          { model: { contains: query.search } },
        ],
      }),
      ...(query.status && { status: query.status }),
      ...(query.categoryId && { categoryId: query.categoryId }),
    };

    const VALID_SORT = ["name", "assetTag", "status", "warrantyExpiry", "purchaseCost", "createdAt"];
    const sortField = VALID_SORT.includes(query.sortBy ?? "") ? query.sortBy! : "createdAt";
    const sortDir = query.sortDir ?? "desc";

    const [rawData, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        include: {
          category: true,
          assignments: {
            where: { returnedAt: null },
            select: { id: true, user: { select: { name: true, email: true } } },
            take: 1,
          },
        },
        orderBy: { [sortField]: sortDir },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.asset.count({ where }),
    ]);

    const data = rawData.map(({ assignments, ...asset }) => ({
      ...asset,
      assignments: [],
      currentAssignment: assignments[0] ?? null,
    }));

    return NextResponse.json({
      data,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
}

// POST /api/assets
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = createAssetSchema.parse(body);

    const asset = await prisma.asset.create({
      data: {
        ...input,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : null,
        purchaseCost: input.purchaseCost ?? null,
      },
      include: { category: true },
    });

    const { ipAddress, userAgent } = getRequestMeta(req);
    await createAuditLog({
      entityType: "Asset",
      entityId: asset.id,
      action: "CREATED",
      changedBy: (session.user as { id: string }).id,
      newValue: input as Record<string, unknown>,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCategorySchema } from "@/lib/validations";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/categories
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type"); // "HARDWARE" | "SOFTWARE"
  const categories = await prisma.category.findMany({
    where: type ? { type: type as "HARDWARE" | "SOFTWARE" } : undefined,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: categories });
}

// POST /api/categories
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = createCategorySchema.parse(body);

    const category = await prisma.category.create({ data: input });
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

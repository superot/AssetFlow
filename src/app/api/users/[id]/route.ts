import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateUserSchema } from "@/lib/validations";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

// GET /api/users/:id
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user as any).findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      location: true,
      lastLoginAt: true,
      department: true,
      createdAt: true,
      assignments: {
        where: { returnedAt: null },
        include: {
          asset: { include: { category: true } },
          license: { include: { category: true } },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

// PATCH /api/users/:id
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = updateUserSchema.parse(body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma.user as any).update({
      where: { id: params.id },
      data: input,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        location: true,
        departmentId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

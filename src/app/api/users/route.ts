import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUserSchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

// GET /api/users
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? undefined;
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const status = searchParams.get("status"); // "active" | "inactive" | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users: any[] = await (prisma.user as any).findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }),
      ...(departmentId && { departmentId }),
      ...(status === "active" && { isActive: true }),
      ...(status === "inactive" && { isActive: false }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      location: true,
      departmentId: true,
      lastLoginAt: true,
      department: { select: { id: true, name: true } },
      createdAt: true,
      _count: { select: { assignments: { where: { returnedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });

  const mapped = users.map(({ _count, ...u }: { _count: { assignments: number } } & Record<string, unknown>) => ({
    ...u,
    activeAssignmentCount: _count.assignments,
  }));

  return NextResponse.json({ data: mapped });
}

// POST /api/users
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = createUserSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        departmentId: input.departmentId ?? null,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        departmentId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/users  — bulk delete
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ ids: z.array(z.string()).min(1) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const currentUserId = (session.user as { id: string }).id;
    const ids = parsed.data.ids.filter((id) => id !== currentUserId);
    if (ids.length === 0)
      return NextResponse.json({ error: "Cannot delete your own account." }, { status: 409 });

    // Block if any selected user has ANY assignments (active or returned) —
    // Assignment rows have a FK to User with no cascade, so they'd block the delete.
    const withAssignments = await prisma.user.findMany({
      where: {
        id: { in: ids },
        OR: [
          { assignments: { some: {} } },
          { assignmentsCreated: { some: {} } },
        ],
      },
      select: { name: true, email: true },
    });
    if (withAssignments.length > 0) {
      const names = withAssignments.map((u) => u.name ?? u.email).join(", ");
      return NextResponse.json(
        { error: `Cannot delete users with assignment history: ${names}. Deactivate them instead.` },
        { status: 409 }
      );
    }

    // Block if any selected user has audit log entries (changedBy FK, no cascade)
    const withAuditLogs = await prisma.auditLog.findFirst({
      where: { changedBy: { in: ids } },
      select: { changedBy: true },
    });
    if (withAuditLogs) {
      return NextResponse.json(
        { error: "Cannot delete users who have audit log entries. Deactivate them instead." },
        { status: 409 }
      );
    }

    await prisma.user.deleteMany({ where: { id: { in: ids } } });

    const { ipAddress, userAgent } = getRequestMeta(req);
    await createAuditLog({
      entityType: "User",
      entityId: `bulk:${ids.length}`,
      action: "DELETED",
      changedBy: currentUserId,
      newValue: { deletedIds: ids },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: { deleted: ids.length } });
  } catch (e) {
    console.error("DELETE /api/users error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

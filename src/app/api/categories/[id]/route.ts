import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateCategorySchema } from "@/lib/validations";
import { createAuditLog, getRequestMeta } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminGuard(session: any) {
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// PATCH /api/categories/:id
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  try {
    const body = await req.json();
    const input = updateCategorySchema.parse(body);

    const category = await prisma.category.update({
      where: { id: params.id },
      data: input,
    });

    const { ipAddress, userAgent } = getRequestMeta(req);
    await createAuditLog({
      entityType: "Category",
      entityId: params.id,
      action: "UPDATED",
      changedBy: (session!.user as { id: string }).id,
      newValue: input as Record<string, unknown>,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: category });
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }
}

// DELETE /api/categories/:id
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  // Check if in use
  const [assetCount, licenseCount] = await prisma.$transaction([
    prisma.asset.count({ where: { categoryId: params.id, deletedAt: null } }),
    prisma.license.count({ where: { categoryId: params.id, deletedAt: null } }),
  ]);

  if (assetCount > 0 || licenseCount > 0) {
    return NextResponse.json(
      {
        error: `Category is in use by ${assetCount} asset(s) and ${licenseCount} license(s). Reassign them first.`,
      },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id: params.id } });

  const { ipAddress, userAgent } = getRequestMeta(req);
  await createAuditLog({
    entityType: "Category",
    entityId: params.id,
    action: "DELETED",
    changedBy: (session!.user as { id: string }).id,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ message: "Category deleted" });
}

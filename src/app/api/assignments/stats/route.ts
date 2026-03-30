import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [active, assetsDeployed, licensesInUse, returnedThisMonth] =
    await prisma.$transaction([
      prisma.assignment.count({ where: { returnedAt: null } }),
      prisma.assignment.count({ where: { returnedAt: null, assetId: { not: null } } }),
      prisma.assignment.count({ where: { returnedAt: null, licenseId: { not: null } } }),
      prisma.assignment.count({ where: { returnedAt: { gte: startOfMonth } } }),
    ]);

  return NextResponse.json({ data: { active, assetsDeployed, licensesInUse, returnedThisMonth } });
}

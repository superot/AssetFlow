import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/dashboard  — aggregated stats for the overview page
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [
    totalAssets,
    deployedAssets,
    availableAssets,
    assetsUnderRepair,
    expiringWarranties,
    totalLicenses,
    expiringLicenses,
    activeAssignments,
  ] = await prisma.$transaction([
    prisma.asset.count({ where: { deletedAt: null } }),
    prisma.asset.count({ where: { deletedAt: null, status: "DEPLOYED" } }),
    prisma.asset.count({ where: { deletedAt: null, status: "AVAILABLE" } }),
    prisma.asset.count({ where: { deletedAt: null, status: "UNDER_REPAIR" } }),
    prisma.asset.count({
      where: {
        deletedAt: null,
        warrantyExpiry: { gte: new Date(), lte: thirtyDaysFromNow },
      },
    }),
    prisma.license.count({ where: { deletedAt: null } }),
    prisma.license.count({
      where: {
        deletedAt: null,
        expirationDate: { gte: new Date(), lte: thirtyDaysFromNow },
      },
    }),
    prisma.assignment.count({ where: { returnedAt: null } }),
  ]);

  return NextResponse.json({
    data: {
      totalAssets,
      deployedAssets,
      availableAssets,
      assetsUnderRepair,
      expiringWarranties,
      totalLicenses,
      expiringLicenses,
      activeAssignments,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortDir = (searchParams.get("sortDir") ?? "desc") as "asc" | "desc";

  const VALID_SORT = ["name", "assetTag", "status", "warrantyExpiry", "purchaseCost", "createdAt"];
  const sortField = VALID_SORT.includes(sortBy) ? sortBy : "createdAt";

  const where = {
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search } },
        { assetTag: { contains: search } },
        { serialNumber: { contains: search } },
        { model: { contains: search } },
      ],
    }),
    ...(status && { status: status as "AVAILABLE" | "DEPLOYED" | "UNDER_REPAIR" | "ARCHIVED" }),
    ...(categoryId && { categoryId }),
  };

  const assets = await prisma.asset.findMany({
    where,
    include: {
      category: true,
      assignments: {
        where: { returnedAt: null },
        select: { user: { select: { name: true, email: true } } },
        take: 1,
      },
    },
    orderBy: { [sortField]: sortDir },
  });

  const rows = assets.map((a) => ({
    "Asset Tag": a.assetTag,
    "Name": a.name,
    "Serial Number": a.serialNumber ?? "",
    "Model": a.model ?? "",
    "Manufacturer": a.manufacturer ?? "",
    "Category": a.category.name,
    "Status": a.status,
    "Location": a.location ?? "",
    "Assigned To": a.assignments[0]?.user.name ?? a.assignments[0]?.user.email ?? "",
    "Purchase Date": a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString("tr-TR") : "",
    "Warranty Expiry": a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString("tr-TR") : "",
    "Purchase Cost (₺)": a.purchaseCost != null ? Number(a.purchaseCost) : "",
    "Notes": a.notes ?? "",
    "Created At": new Date(a.createdAt).toLocaleDateString("tr-TR"),
  }));

  const wb = XLSX.utils.book_new();
  const ws = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([["Asset Tag", "Name", "Serial Number", "Model", "Manufacturer", "Category", "Status", "Location", "Assigned To", "Purchase Date", "Warranty Expiry", "Purchase Cost (₺)", "Notes", "Created At"]]);

  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length + 4, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Assets");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const now = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assets-${now}.xlsx"`,
    },
  });
}

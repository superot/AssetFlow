import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const format = searchParams.get("format") ?? "xlsx"; // "xlsx" | "csv"

  const assets = await prisma.asset.findMany({
    where: {
      deletedAt: null,
      ...(status && { status: status as "AVAILABLE" | "DEPLOYED" | "UNDER_REPAIR" | "ARCHIVED" }),
    },
    include: {
      category: true,
      assignments: {
        where: { returnedAt: null },
        include: { user: { select: { name: true, email: true } } },
        take: 1,
        orderBy: { assignedAt: "desc" },
      },
    },
    orderBy: { assetTag: "asc" },
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
    "Assigned To": a.assignments[0]?.user.name ?? "",
    "Purchase Date": a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString("tr-TR") : "",
    "Warranty Expiry": a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString("tr-TR") : "",
    "Purchase Cost": a.purchaseCost != null ? Number(a.purchaseCost) : "",
    "Notes": a.notes ?? "",
    "Created At": new Date(a.createdAt).toLocaleDateString("tr-TR"),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length + 4, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Assets");

  const bookType = format === "csv" ? "csv" : "xlsx";
  const buf = XLSX.write(wb, { type: "buffer", bookType });
  const ext = format === "csv" ? "csv" : "xlsx";
  const mime = format === "csv"
    ? "text/csv"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="assets-report.${ext}"`,
    },
  });
}

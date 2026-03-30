import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const format = searchParams.get("format") ?? "xlsx";
  const activeOnly = searchParams.get("active") === "true";

  const assignments = await prisma.assignment.findMany({
    where: activeOnly ? { returnedAt: null } : {},
    include: {
      user: { select: { name: true, email: true } },
      createdBy: { select: { name: true } },
      asset: { include: { category: true } },
      license: { include: { category: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  const rows = assignments.map((a) => ({
    "Type": a.assetId ? "Hardware" : "Software",
    "Item Name": a.asset?.name ?? a.license?.name ?? "",
    "Asset Tag / License": a.asset?.assetTag ?? a.license?.vendor ?? "",
    "Category": a.asset?.category.name ?? a.license?.category.name ?? "",
    "Assigned To": a.user.name ?? a.user.email,
    "Assigned By": a.createdBy.name ?? "",
    "Assigned At": new Date(a.assignedAt).toLocaleDateString("tr-TR"),
    "Returned At": a.returnedAt ? new Date(a.returnedAt).toLocaleDateString("tr-TR") : "",
    "Status": a.returnedAt ? "Returned" : "Active",
    "Notes": a.notes ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length + 4, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Assignments");

  const bookType = format === "csv" ? "csv" : "xlsx";
  const buf = XLSX.write(wb, { type: "buffer", bookType });
  const ext = format === "csv" ? "csv" : "xlsx";
  const mime = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="assignments-report.${ext}"`,
    },
  });
}

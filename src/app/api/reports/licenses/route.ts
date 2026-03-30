import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";

  const licenses = await prisma.license.findMany({
    where: { deletedAt: null },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  const rows = licenses.map((l) => ({
    "Name": l.name,
    "Vendor": l.vendor ?? "",
    "Category": l.category.name,
    "License Key": l.licenseKey ?? "",
    "Total Seats": l.totalSeats,
    "Available Seats": l.availableSeats,
    "Used Seats": l.totalSeats - l.availableSeats,
    "Is Subscription": l.isSubscription ? "Yes" : "No",
    "Expiration Date": l.expirationDate ? new Date(l.expirationDate).toLocaleDateString("tr-TR") : "",
    "Purchase Cost": l.purchaseCost != null ? Number(l.purchaseCost) : "",
    "Notes": l.notes ?? "",
    "Created At": new Date(l.createdAt).toLocaleDateString("tr-TR"),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length + 4, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Licenses");

  const bookType = format === "csv" ? "csv" : "xlsx";
  const buf = XLSX.write(wb, { type: "buffer", bookType });
  const ext = format === "csv" ? "csv" : "xlsx";
  const mime = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="licenses-report.${ext}"`,
    },
  });
}

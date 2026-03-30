import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function daysBetween(from: Date, to: Date | null): number {
  const end = to ?? new Date();
  return Math.max(0, Math.floor((end.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const active = searchParams.get("active");
  const userId = searchParams.get("userId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "assignedAt";
  const sortDir = (searchParams.get("sortDir") ?? "desc") as "asc" | "desc";

  const VALID_SORT = ["assignedAt", "returnedAt"];
  const sortField = VALID_SORT.includes(sortBy) ? sortBy : "assignedAt";

  const where = {
    ...(userId && { userId }),
    ...(active === "true" && { returnedAt: null }),
    ...(type === "asset" && { assetId: { not: null } }),
    ...(type === "license" && { licenseId: { not: null } }),
    ...(search && {
      OR: [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { asset: { name: { contains: search } } },
        { asset: { assetTag: { contains: search } } },
        { license: { name: { contains: search } } },
      ],
    }),
  };

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      user: { select: { name: true, email: true, department: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      asset: { include: { category: true } },
      license: { include: { category: true } },
    },
    orderBy: { [sortField]: sortDir },
  });

  const rows = assignments.map((a) => ({
    "Type": a.assetId ? "Hardware" : "Software",
    "Item Name": a.asset?.name ?? a.license?.name ?? "",
    "Asset Tag / Vendor": a.asset?.assetTag ?? a.license?.vendor ?? "",
    "Category": a.asset?.category.name ?? a.license?.category.name ?? "",
    "Assigned To": a.user.name ?? a.user.email,
    "Email": a.user.email,
    "Department": (a.user as { department?: { name: string } | null }).department?.name ?? "",
    "Assigned By": a.createdBy.name ?? "",
    "Assigned At": new Date(a.assignedAt).toLocaleDateString("tr-TR"),
    "Returned At": a.returnedAt ? new Date(a.returnedAt).toLocaleDateString("tr-TR") : "",
    "Duration (days)": daysBetween(new Date(a.assignedAt), a.returnedAt ? new Date(a.returnedAt) : null),
    "Status": a.returnedAt ? "Returned" : "Active",
    "Notes": a.notes ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.aoa_to_sheet([["Type", "Item Name", "Asset Tag / Vendor", "Category", "Assigned To", "Email", "Department", "Assigned By", "Assigned At", "Returned At", "Duration (days)", "Status", "Notes"]]);

  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length + 4, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, "Assignments");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const now = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assignments-${now}.xlsx"`,
    },
  });
}

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

interface RouteParams {
  params: { type: string };
}

const ASSET_HEADERS = [
  "Asset Tag",
  "Name",
  "Serial Number",
  "Model",
  "Manufacturer",
  "Category",
  "Status",
  "Purchase Date",
  "Warranty Expiry",
  "Purchase Cost",
  "Location",
  "Notes",
];

const ASSET_EXAMPLE = [
  "AST-0001",
  "Dell Latitude 5540",
  "SN1234567",
  "Latitude 5540",
  "Dell",
  "Laptop",
  "AVAILABLE",
  "2024-01-15",
  "2027-01-15",
  "15000",
  "Istanbul Office",
  "",
];

const LICENSE_HEADERS = [
  "Name",
  "License Key",
  "Vendor",
  "Category",
  "Total Seats",
  "Expiration Date",
  "Is Subscription",
  "Purchase Cost",
  "Notes",
];

const LICENSE_EXAMPLE = [
  "Microsoft 365 Business",
  "XXXXX-XXXXX-XXXXX-XXXXX",
  "Microsoft",
  "Productivity",
  "25",
  "2025-12-31",
  "true",
  "50000",
  "",
];

export async function GET(_req: Request, { params }: RouteParams) {
  const { type } = params;

  if (type !== "assets" && type !== "licenses") {
    return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
  }

  const headers = type === "assets" ? ASSET_HEADERS : LICENSE_HEADERS;
  const example = type === "assets" ? ASSET_EXAMPLE : LICENSE_EXAMPLE;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  XLSX.utils.book_append_sheet(wb, ws, type === "assets" ? "Assets" : "Licenses");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type}-import-template.xlsx"`,
    },
  });
}

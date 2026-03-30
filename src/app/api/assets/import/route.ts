import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const rowSchema = z.object({
  assetTag: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  serialNumber: z.string().max(100).optional().nullable(),
  model: z.string().max(150).optional().nullable(),
  manufacturer: z.string().max(150).optional().nullable(),
  categoryName: z.string().min(1),
  status: z.enum(["AVAILABLE", "DEPLOYED", "UNDER_REPAIR", "ARCHIVED"]).default("AVAILABLE"),
  purchaseDate: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  purchaseCost: z.coerce.number().nonnegative().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// POST /api/assets/import  — multipart form-data with file field "file"
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Only CSV and Excel files are supported" }, { status: 400 });
  }

  // Parse file
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (!rows.length) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  // Pre-load categories to map name → id
  const categories = await prisma.category.findMany({ where: { type: "HARDWARE" } });
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  const errors: { row: number; message: string }[] = [];
  const toCreate: Parameters<typeof prisma.asset.create>[0]["data"][] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const parsed = rowSchema.safeParse({
      assetTag: rawRow["Asset Tag"] ?? rawRow["assetTag"],
      name: rawRow["Name"] ?? rawRow["name"],
      serialNumber: rawRow["Serial Number"] ?? rawRow["serialNumber"],
      model: rawRow["Model"] ?? rawRow["model"],
      manufacturer: rawRow["Manufacturer"] ?? rawRow["manufacturer"],
      categoryName: rawRow["Category"] ?? rawRow["categoryName"],
      status: rawRow["Status"] ?? rawRow["status"] ?? "AVAILABLE",
      purchaseDate: rawRow["Purchase Date"] ?? rawRow["purchaseDate"],
      warrantyExpiry: rawRow["Warranty Expiry"] ?? rawRow["warrantyExpiry"],
      purchaseCost: rawRow["Purchase Cost"] ?? rawRow["purchaseCost"],
      location: rawRow["Location"] ?? rawRow["location"],
      notes: rawRow["Notes"] ?? rawRow["notes"],
    });

    if (!parsed.success) {
      errors.push({ row: i + 2, message: parsed.error.issues[0].message });
      continue;
    }

    const data = parsed.data;
    const categoryId = categoryMap.get(data.categoryName.toLowerCase());
    if (!categoryId) {
      errors.push({ row: i + 2, message: `Category "${data.categoryName}" not found` });
      continue;
    }

    toCreate.push({
      assetTag: data.assetTag,
      name: data.name,
      serialNumber: data.serialNumber ?? null,
      model: data.model ?? null,
      manufacturer: data.manufacturer ?? null,
      categoryId,
      status: data.status,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
      purchaseCost: data.purchaseCost ?? null,
      location: data.location ?? null,
      notes: data.notes ?? null,
    });
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ error: "No valid rows to import", errors }, { status: 422 });
  }

  // Bulk create — skip duplicates by catching unique constraint errors per row
  let created = 0;
  const skipped: string[] = [];
  const userId = (session.user as { id: string }).id;

  for (const data of toCreate) {
    try {
      const asset = await prisma.asset.create({ data: data as Parameters<typeof prisma.asset.create>[0]["data"] });
      await createAuditLog({
        entityType: "Asset",
        entityId: asset.id,
        action: "CREATED",
        changedBy: userId,
        newValue: { source: "import", assetTag: asset.assetTag },
      });
      created++;
    } catch {
      skipped.push(String(data.assetTag));
    }
  }

  return NextResponse.json({
    created,
    skipped: skipped.length,
    skippedTags: skipped,
    validationErrors: errors,
  });
}

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const rowSchema = z.object({
  name: z.string().min(1).max(200),
  licenseKey: z.string().max(500).optional().nullable(),
  vendor: z.string().max(150).optional().nullable(),
  categoryName: z.string().min(1),
  totalSeats: z.coerce.number().int().positive().default(1),
  expirationDate: z.string().optional().nullable(),
  isSubscription: z.coerce.boolean().default(false),
  purchaseCost: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Only CSV and Excel files are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (!rows.length) return NextResponse.json({ error: "File is empty" }, { status: 400 });

  const categories = await prisma.category.findMany({ where: { type: "SOFTWARE" } });
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  const errors: { row: number; message: string }[] = [];
  const userId = (session.user as { id: string }).id;
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const parsed = rowSchema.safeParse({
      name: rawRow["Name"] ?? rawRow["name"],
      licenseKey: rawRow["License Key"] ?? rawRow["licenseKey"],
      vendor: rawRow["Vendor"] ?? rawRow["vendor"],
      categoryName: rawRow["Category"] ?? rawRow["categoryName"],
      totalSeats: rawRow["Total Seats"] ?? rawRow["totalSeats"] ?? 1,
      expirationDate: rawRow["Expiration Date"] ?? rawRow["expirationDate"],
      isSubscription: rawRow["Is Subscription"] ?? rawRow["isSubscription"] ?? false,
      purchaseCost: rawRow["Purchase Cost"] ?? rawRow["purchaseCost"],
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

    try {
      const license = await prisma.license.create({
        data: {
          name: data.name,
          licenseKey: data.licenseKey ?? null,
          vendor: data.vendor ?? null,
          categoryId,
          totalSeats: data.totalSeats,
          availableSeats: data.totalSeats,
          expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
          isSubscription: data.isSubscription,
          purchaseCost: data.purchaseCost ?? null,
          notes: data.notes ?? null,
        },
      });
      await createAuditLog({
        entityType: "License",
        entityId: license.id,
        action: "CREATED",
        changedBy: userId,
        newValue: { source: "import", name: license.name },
      });
      created++;
    } catch {
      errors.push({ row: i + 2, message: "Failed to create (possible duplicate)" });
    }
  }

  return NextResponse.json({ created, validationErrors: errors });
}

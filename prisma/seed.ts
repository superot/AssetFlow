import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Categories ────────────────────────────────────────────
  const hardwareCategories = [
    "Laptop",
    "Desktop",
    "Monitor",
    "Keyboard & Mouse",
    "Printer",
    "Server",
    "Network Equipment",
    "Mobile Phone",
    "Tablet",
    "Peripheral",
    "UPS",
    "Other Hardware",
  ];

  const softwareCategories = [
    "Operating System",
    "Office / Productivity",
    "Security & Antivirus",
    "Design & Creative",
    "Development Tools",
    "Communication",
    "ERP / CRM",
    "Cloud Service",
    "Other Software",
  ];

  for (const name of hardwareCategories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, type: "HARDWARE" },
    });
  }

  for (const name of softwareCategories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, type: "SOFTWARE" },
    });
  }

  console.log(`✓ ${hardwareCategories.length} hardware + ${softwareCategories.length} software categories seeded`);

  // ── Demo Department ───────────────────────────────────────
  const dept = await prisma.department.upsert({
    where: { name: "IT Department" },
    update: {},
    create: { name: "IT Department", description: "Information Technology" },
  });
  console.log(`✓ Department: ${dept.name}`);

  // ── Admin User ────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("admin123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@assetflow.local" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@assetflow.local",
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      departmentId: dept.id,
    },
  });
  console.log(`✓ Admin user: ${admin.email} / password: admin123!`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

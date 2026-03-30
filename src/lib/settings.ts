import { prisma } from "./prisma";

export async function getSetting(key: string): Promise<string | null> {
  const row = await (prisma as any).systemSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await (prisma as any).systemSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  await (prisma as any).systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function upsertSettings(record: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(record).map(([k, v]) => upsertSetting(k, v)));
}

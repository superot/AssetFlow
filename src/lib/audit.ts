import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { AuditAction } from "@/types";

interface AuditLogParams {
  entityType: "Asset" | "License" | "Assignment" | "User" | "Category" | "SystemSetting";
  entityId: string;
  action: AuditAction;
  changedBy: string;
  // Accept plain objects; cast to Prisma.InputJsonValue internally
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write a single audit log entry.
 * Call inside or outside a transaction; pass `tx` to run within one.
 */
export async function createAuditLog(
  params: AuditLogParams,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changedBy: params.changedBy,
      oldValue: params.oldValue === null
        ? Prisma.JsonNull
        : (params.oldValue as Prisma.InputJsonValue | undefined),
      newValue: params.newValue === null
        ? Prisma.JsonNull
        : (params.newValue as Prisma.InputJsonValue | undefined),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}

/** Extract basic request metadata for audit purposes */
export function getRequestMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };
}

import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";
import { logger } from "./logger";

export async function logAudit(
  req: Request,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: string,
): Promise<void> {
  if (!req.user) return;
  try {
    await db.insert(auditLogsTable).values({
      userId: req.user.userId,
      userName: req.user.name,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      details: details ?? null,
      ipAddress: req.ip ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}

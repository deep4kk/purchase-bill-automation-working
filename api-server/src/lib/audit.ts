import type { Request } from "express";
import { logger } from "./logger";
import { createAuditLog } from "./dal";

export async function logAudit(
  req: Request,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: string,
): Promise<void> {
  if (!req.user) return;
  try {
    await createAuditLog({
      userId: req.user.userId,
      userName: req.user.name,
      action,
      resourceType,
      resourceId: resourceId ?? undefined,
      details: details ?? undefined,
      ipAddress: req.ip ?? undefined,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}

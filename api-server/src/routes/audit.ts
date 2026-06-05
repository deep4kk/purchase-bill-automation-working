import { Router } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/audit-logs", authenticate, async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;
  const conditions = [];
  if (params.success) {
    if (params.data.action) conditions.push(eq(auditLogsTable.action, params.data.action));
    if (params.data.userId) conditions.push(eq(auditLogsTable.userId, parseInt(params.data.userId)));
    if (params.data.resourceType) conditions.push(eq(auditLogsTable.resourceType, params.data.resourceType));
    if (params.data.dateFrom) conditions.push(gte(auditLogsTable.createdAt, new Date(params.data.dateFrom)));
    if (params.data.dateTo) conditions.push(lte(auditLogsTable.createdAt, new Date(params.data.dateTo)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(auditLogsTable).where(where).limit(limit).offset(offset).orderBy(auditLogsTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogsTable).where(where);
  res.json({
    data: rows.map((r) => ({
      id: String(r.id),
      userId: String(r.userId),
      userName: r.userName,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId ?? null,
      details: r.details ?? null,
      ipAddress: r.ipAddress ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: Number(count),
    page,
    limit,
  });
});

export default router;

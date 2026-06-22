import { Router } from "express";
import { authenticate } from "../lib/auth";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";
import { findAuditLogs } from "../lib/dal";
import { buildDateRangeFilter } from "../lib/filters";

const router = Router();

router.get("/audit-logs", authenticate, async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const sortBy = params.success ? params.data.sortBy : undefined;
  const sortOrder = params.success ? params.data.sortOrder : undefined;

  const filter: Record<string, unknown> = {};
  if (params.success) {
    if (params.data.action) filter.action = params.data.action;
    if (params.data.userId) filter.userId = params.data.userId;
    if (params.data.resourceType) filter.resourceType = params.data.resourceType;
    if (params.data.dateFrom || params.data.dateTo) {
      Object.assign(
        filter,
        buildDateRangeFilter(
          "createdAt",
          params.data.dateFrom ? new Date(params.data.dateFrom).toISOString() : undefined,
          params.data.dateTo ? new Date(params.data.dateTo).toISOString() : undefined,
        ),
      );
    }
  }

  const result = await findAuditLogs(filter, { page, limit, sortBy, sortOrder });
  res.json({
    data: result.data.map((r) => ({
      id: r._id.toHexString(),
      userId: r.userId,
      userName: r.userName ?? null,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId ?? null,
      details: r.details ?? null,
      ipAddress: r.ipAddress ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: result.total,
    page,
    limit,
    sortBy: result.sortBy,
    sortOrder: result.sortOrder,
  });
});

export default router;

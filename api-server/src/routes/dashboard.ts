import { Router } from "express";
import { db, invoicesTable, suppliersTable, reconciliationRecordsTable } from "@workspace/db";
import { eq, gte, sql } from "drizzle-orm";
import { authenticate } from "../lib/auth";

const router = Router();

router.get("/dashboard/stats", authenticate, async (_req, res): Promise<void> => {
  const [totalInvoices] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable);
  const [pendingReview] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "extracted"));
  const [erpPushSuccess] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "pushed"));
  const [erpPushFailed] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "failed"));
  const [extractingNow] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.status, "extracting"));
  const [totalSuppliers] = await db.select({ count: sql<number>`count(*)` }).from(suppliersTable);
  const [matchedSuppliers] = await db.select({ count: sql<number>`count(*)` }).from(suppliersTable).where(eq(suppliersTable.isMatched, true));
  const [reconcPending] = await db.select({ count: sql<number>`count(*)` }).from(reconciliationRecordsTable).where(eq(reconciliationRecordsTable.status, "missing_in_erp"));
  const [totalRecon] = await db.select({ count: sql<number>`count(*)` }).from(reconciliationRecordsTable);
  const [matchedRecon] = await db.select({ count: sql<number>`count(*)` }).from(reconciliationRecordsTable).where(eq(reconciliationRecordsTable.status, "matched"));

  const total = Number(totalRecon?.count ?? 0);
  const matched = Number(matchedRecon?.count ?? 0);
  const gstrMatchPercent = total > 0 ? Math.round((matched / total) * 10000) / 100 : 0;
  const totalSup = Number(totalSuppliers?.count ?? 0);
  const matchedSup = Number(matchedSuppliers?.count ?? 0);

  res.json({
    invoicesProcessed: Number(erpPushSuccess?.count ?? 0),
    pendingReview: Number(pendingReview?.count ?? 0),
    matchedSuppliers: matchedSup,
    unmatchedSuppliers: totalSup - matchedSup,
    erpPushSuccess: Number(erpPushSuccess?.count ?? 0),
    erpPushFailed: Number(erpPushFailed?.count ?? 0),
    gstrMatchPercent,
    reconciliationPending: Number(reconcPending?.count ?? 0),
    totalInvoices: Number(totalInvoices?.count ?? 0),
    extractingNow: Number(extractingNow?.count ?? 0),
  });
});

router.get("/dashboard/recent-invoices", authenticate, async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const rows = await db.select().from(invoicesTable).orderBy(invoicesTable.createdAt).limit(limit);
  res.json(rows.map((inv) => ({
    id: String(inv.id),
    fileName: inv.fileName,
    fileUrl: inv.fileUrl,
    fileType: inv.fileType,
    status: inv.status,
    supplierName: inv.supplierName ?? null,
    supplierGstin: inv.supplierGstin ?? null,
    matchedSupplierId: inv.matchedSupplierId ? String(inv.matchedSupplierId) : null,
    matchedSupplierName: inv.matchedSupplierName ?? null,
    supplierMatchStatus: inv.supplierMatchStatus,
    invoiceNumber: inv.invoiceNumber ?? null,
    invoiceDate: inv.invoiceDate ?? null,
    placeOfSupply: inv.placeOfSupply ?? null,
    taxableValue: inv.taxableValue !== null ? Number(inv.taxableValue) : null,
    cgst: inv.cgst !== null ? Number(inv.cgst) : null,
    sgst: inv.sgst !== null ? Number(inv.sgst) : null,
    igst: inv.igst !== null ? Number(inv.igst) : null,
    grandTotal: inv.grandTotal !== null ? Number(inv.grandTotal) : null,
    items: Array.isArray(inv.items) ? inv.items : [],
    confidenceScore: inv.confidenceScore !== null ? Number(inv.confidenceScore) : null,
    erpDocumentId: inv.erpDocumentId ?? null,
    erpStatus: inv.erpStatus ?? null,
    erpError: inv.erpError ?? null,
    extractedAt: inv.extractedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
  })));
});

router.get("/dashboard/invoice-trend", authenticate, async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db
    .select({
      date: sql<string>`DATE(created_at)`,
      count: sql<number>`count(*)`,
      pushed: sql<number>`count(*) filter (where status = 'pushed')`,
    })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, thirtyDaysAgo))
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`);

  res.json(rows.map((r) => ({ date: r.date, count: Number(r.count), pushed: Number(r.pushed) })));
});

router.get("/dashboard/supplier-stats", authenticate, async (_req, res): Promise<void> => {
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(suppliersTable);
  const [matched] = await db.select({ count: sql<number>`count(*)` }).from(suppliersTable).where(eq(suppliersTable.isMatched, true));

  const topRows = await db
    .select({
      name: invoicesTable.supplierName,
      count: sql<number>`count(*)`,
    })
    .from(invoicesTable)
    .groupBy(invoicesTable.supplierName)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  res.json({
    total: Number(total?.count ?? 0),
    matched: Number(matched?.count ?? 0),
    unmatched: Number(total?.count ?? 0) - Number(matched?.count ?? 0),
    topSuppliers: topRows
      .filter((r) => r.name)
      .map((r) => ({ name: r.name!, count: Number(r.count) })),
  });
});

export default router;

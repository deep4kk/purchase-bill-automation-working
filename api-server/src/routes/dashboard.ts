import { Router } from "express";
import { authenticate } from "../lib/auth";
import {
  findInvoices,
  getDb,
  COLLECTIONS,
} from "../lib/dal";

const router = Router();

router.get("/dashboard/stats", authenticate, async (_req, res): Promise<void> => {
  const db = getDb();

  const [totalInvoices, pendingReview, erpPushSuccess, erpPushFailed, extractingNow] = await Promise.all([
    db.collection(COLLECTIONS.INVOICES).countDocuments(),
    db.collection(COLLECTIONS.INVOICES).countDocuments({ status: "extracted" }),
    db.collection(COLLECTIONS.INVOICES).countDocuments({ status: "pushed" }),
    db.collection(COLLECTIONS.INVOICES).countDocuments({ status: "failed" }),
    db.collection(COLLECTIONS.INVOICES).countDocuments({ status: "extracting" }),
  ]);

  const [totalSuppliers, matchedSuppliers, reconcPending, totalRecon, matchedRecon] = await Promise.all([
    db.collection(COLLECTIONS.SUPPLIERS).countDocuments(),
    db.collection(COLLECTIONS.SUPPLIERS).countDocuments({ isMatched: true }),
    db.collection(COLLECTIONS.RECONCILIATION_RECORDS).countDocuments({ status: "missing_in_erp" }),
    db.collection(COLLECTIONS.RECONCILIATION_RECORDS).countDocuments(),
    db.collection(COLLECTIONS.RECONCILIATION_RECORDS).countDocuments({ status: "matched" }),
  ]);

  const total = totalRecon ?? 0;
  const matched = matchedRecon ?? 0;
  const gstrMatchPercent = total > 0 ? Math.round((matched / total) * 10000) / 100 : 0;
  const totalSup = totalSuppliers ?? 0;
  const matchedSup = matchedSuppliers ?? 0;

  res.json({
    invoicesProcessed: erpPushSuccess ?? 0,
    pendingReview: pendingReview ?? 0,
    matchedSuppliers: matchedSup,
    unmatchedSuppliers: totalSup - matchedSup,
    erpPushSuccess: erpPushSuccess ?? 0,
    erpPushFailed: erpPushFailed ?? 0,
    gstrMatchPercent,
    reconciliationPending: reconcPending ?? 0,
    totalInvoices: totalInvoices ?? 0,
    extractingNow: extractingNow ?? 0,
  });
});

router.get("/dashboard/recent-invoices", authenticate, async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const result = await findInvoices({}, { page: 1, limit, sortBy: "createdAt", sortOrder: "asc" });
  
  res.json(result.data.map((inv) => ({
    id: inv._id.toHexString(),
    fileName: inv.fileName,
    fileUrl: inv.fileUrl,
    fileType: inv.fileType,
    status: inv.status,
    supplierName: inv.supplierName ?? null,
    supplierGstin: inv.supplierGstin ?? null,
    matchedSupplierId: inv.matchedSupplierId ?? null,
    matchedSupplierName: inv.matchedSupplierName ?? null,
    supplierMatchStatus: inv.supplierMatchStatus,
    invoiceNumber: inv.invoiceNumber ?? null,
    invoiceDate: inv.invoiceDate ?? null,
    placeOfSupply: inv.placeOfSupply ?? null,
    taxableValue: inv.taxableValue != null ? Number(inv.taxableValue) : null,
    cgst: inv.cgst != null ? Number(inv.cgst) : null,
    sgst: inv.sgst != null ? Number(inv.sgst) : null,
    igst: inv.igst != null ? Number(inv.igst) : null,
    grandTotal: inv.grandTotal != null ? Number(inv.grandTotal) : null,
    items: Array.isArray(inv.items) ? inv.items : [],
    confidenceScore: inv.confidenceScore != null ? Number(inv.confidenceScore) : null,
    erpDocumentId: inv.erpDocumentId ?? null,
    erpStatus: inv.erpStatus ?? null,
    erpError: inv.erpError ?? null,
    extractedAt: inv.extractedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  })));
});

router.get("/dashboard/invoice-trend", authenticate, async (_req, res): Promise<void> => {
  const db = getDb();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db.collection(COLLECTIONS.INVOICES).aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        pushed: { $sum: { $cond: [{ $eq: ["$status", "pushed"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", count: 1, pushed: 1 } },
  ]).toArray();

  res.json(rows);
});

router.get("/dashboard/supplier-stats", authenticate, async (_req, res): Promise<void> => {
  const db = getDb();
  const total = await db.collection(COLLECTIONS.SUPPLIERS).countDocuments();
  const matched = await db.collection(COLLECTIONS.SUPPLIERS).countDocuments({ isMatched: true });

  // Get top suppliers by invoice count
  const invoices = await db.collection(COLLECTIONS.INVOICES)
    .aggregate([
      { $group: { _id: "$supplierName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ])
    .toArray();

  res.json({
    total: total ?? 0,
    matched: matched ?? 0,
    unmatched: (total ?? 0) - (matched ?? 0),
    topSuppliers: invoices
      .filter((r: { _id: string | null }) => r._id)
      .map((r: { _id: string; count: number }) => ({ name: r._id, count: r.count })),
  });
});

export default router;

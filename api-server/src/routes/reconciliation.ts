import { Router } from "express";
import { db, reconciliationRecordsTable, gstr2bRecordsTable, invoicesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { ListReconciliationRecordsQueryParams, RunReconciliationBody } from "@workspace/api-zod";

const router = Router();

function formatRecord(r: typeof reconciliationRecordsTable.$inferSelect) {
  return {
    id: String(r.id),
    period: r.period,
    status: r.status,
    supplierGstin: r.supplierGstin,
    supplierName: r.supplierName,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    erpTaxableValue: r.erpTaxableValue !== null ? Number(r.erpTaxableValue) : null,
    erpCgst: r.erpCgst !== null ? Number(r.erpCgst) : null,
    erpSgst: r.erpSgst !== null ? Number(r.erpSgst) : null,
    erpIgst: r.erpIgst !== null ? Number(r.erpIgst) : null,
    gstr2bTaxableValue: r.gstr2bTaxableValue !== null ? Number(r.gstr2bTaxableValue) : null,
    gstr2bCgst: r.gstr2bCgst !== null ? Number(r.gstr2bCgst) : null,
    gstr2bSgst: r.gstr2bSgst !== null ? Number(r.gstr2bSgst) : null,
    gstr2bIgst: r.gstr2bIgst !== null ? Number(r.gstr2bIgst) : null,
    mismatchAmount: r.mismatchAmount !== null ? Number(r.mismatchAmount) : null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reconciliation", authenticate, async (req, res): Promise<void> => {
  const params = ListReconciliationRecordsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;
  const conditions = [];
  if (params.success) {
    if (params.data.period) conditions.push(eq(reconciliationRecordsTable.period, params.data.period));
    if (params.data.status) conditions.push(eq(reconciliationRecordsTable.status, params.data.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(reconciliationRecordsTable).where(where).limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(reconciliationRecordsTable).where(where);
  res.json({ data: rows.map(formatRecord), total: Number(count), page, limit });
});

router.post("/reconciliation/run", authenticate, async (req, res): Promise<void> => {
  const parsed = RunReconciliationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { period } = parsed.data;

  await db.delete(reconciliationRecordsTable).where(eq(reconciliationRecordsTable.period, period));

  const gstr2bRows = await db.select().from(gstr2bRecordsTable).where(eq(gstr2bRecordsTable.period, period));
  const erpInvoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.status, "pushed")));

  const erpMap = new Map<string, typeof invoicesTable.$inferSelect>();
  for (const inv of erpInvoices) {
    if (inv.supplierGstin && inv.invoiceNumber) {
      erpMap.set(`${inv.supplierGstin}__${inv.invoiceNumber}`, inv);
    }
  }

  const gstrMap = new Map<string, typeof gstr2bRecordsTable.$inferSelect>();
  for (const g of gstr2bRows) {
    gstrMap.set(`${g.supplierGstin}__${g.invoiceNumber}`, g);
  }

  const insertRecords: Array<typeof reconciliationRecordsTable.$inferInsert> = [];
  const processedKeys = new Set<string>();

  for (const g of gstr2bRows) {
    const key = `${g.supplierGstin}__${g.invoiceNumber}`;
    processedKeys.add(key);
    const erp = erpMap.get(key);

    if (!erp) {
      insertRecords.push({
        period,
        status: "missing_in_erp",
        supplierGstin: g.supplierGstin,
        supplierName: g.supplierName,
        invoiceNumber: g.invoiceNumber,
        invoiceDate: g.invoiceDate,
        gstr2bTaxableValue: g.taxableValue,
        gstr2bCgst: g.cgst,
        gstr2bSgst: g.sgst,
        gstr2bIgst: g.igst,
        erpTaxableValue: null,
        erpCgst: null,
        erpSgst: null,
        erpIgst: null,
        mismatchAmount: null,
      });
      continue;
    }

    const erpTaxable = Number(erp.taxableValue ?? 0);
    const gstrTaxable = Number(g.taxableValue ?? 0);
    const erpGst = Number(erp.cgst ?? 0) + Number(erp.sgst ?? 0) + Number(erp.igst ?? 0);
    const gstrGst = Number(g.cgst ?? 0) + Number(g.sgst ?? 0) + Number(g.igst ?? 0);
    const taxableDiff = Math.abs(erpTaxable - gstrTaxable);
    const gstDiff = Math.abs(erpGst - gstrGst);

    let status = "matched";
    if (taxableDiff > 1) status = "amount_mismatch";
    else if (gstDiff > 1) status = "gst_mismatch";

    insertRecords.push({
      period,
      status,
      supplierGstin: g.supplierGstin,
      supplierName: g.supplierName,
      invoiceNumber: g.invoiceNumber,
      invoiceDate: g.invoiceDate,
      gstr2bTaxableValue: g.taxableValue,
      gstr2bCgst: g.cgst,
      gstr2bSgst: g.sgst,
      gstr2bIgst: g.igst,
      erpTaxableValue: erp.taxableValue,
      erpCgst: erp.cgst,
      erpSgst: erp.sgst,
      erpIgst: erp.igst,
      mismatchAmount: status === "matched" ? null : Math.max(taxableDiff, gstDiff).toFixed(2),
    });
  }

  for (const erp of erpInvoices) {
    if (!erp.supplierGstin || !erp.invoiceNumber) continue;
    const key = `${erp.supplierGstin}__${erp.invoiceNumber}`;
    if (processedKeys.has(key)) continue;
    insertRecords.push({
      period,
      status: "missing_in_gstr2b",
      supplierGstin: erp.supplierGstin,
      supplierName: erp.supplierName ?? erp.matchedSupplierName ?? "Unknown",
      invoiceNumber: erp.invoiceNumber,
      invoiceDate: erp.invoiceDate ?? "",
      erpTaxableValue: erp.taxableValue,
      erpCgst: erp.cgst,
      erpSgst: erp.sgst,
      erpIgst: erp.igst,
      gstr2bTaxableValue: null,
      gstr2bCgst: null,
      gstr2bSgst: null,
      gstr2bIgst: null,
      mismatchAmount: null,
    });
  }

  if (insertRecords.length > 0) {
    await db.insert(reconciliationRecordsTable).values(insertRecords as typeof reconciliationRecordsTable.$inferInsert[]);
  }

  const total = insertRecords.length;
  const matched = insertRecords.filter((r) => r.status === "matched").length;
  const matchPercentage = total > 0 ? Math.round((matched / total) * 10000) / 100 : 0;

  await logAudit(req, "reconciliation_run", "reconciliation", undefined, `Period: ${period}, Total: ${total}`);

  res.json({
    period,
    total,
    matched,
    missingInErp: insertRecords.filter((r) => r.status === "missing_in_erp").length,
    missingInGstr2b: insertRecords.filter((r) => r.status === "missing_in_gstr2b").length,
    amountMismatch: insertRecords.filter((r) => r.status === "amount_mismatch").length,
    gstMismatch: insertRecords.filter((r) => r.status === "gst_mismatch").length,
    duplicate: 0,
    matchPercentage,
  });
});

router.get("/reconciliation/summary", authenticate, async (req, res): Promise<void> => {
  const period = req.query.period as string | undefined;
  const conditions = period ? [eq(reconciliationRecordsTable.period, period)] : [];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(reconciliationRecordsTable).where(where);
  const total = rows.length;
  const matched = rows.filter((r) => r.status === "matched").length;
  res.json({
    period: period ?? "all",
    total,
    matched,
    missingInErp: rows.filter((r) => r.status === "missing_in_erp").length,
    missingInGstr2b: rows.filter((r) => r.status === "missing_in_gstr2b").length,
    amountMismatch: rows.filter((r) => r.status === "amount_mismatch").length,
    gstMismatch: rows.filter((r) => r.status === "gst_mismatch").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    matchPercentage: total > 0 ? Math.round((matched / total) * 10000) / 100 : 0,
  });
});

export default router;

import { Router } from "express";
import { authenticate } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { ListReconciliationRecordsQueryParams, RunReconciliationBody } from "@workspace/api-zod";
import {
  findReconciliationRecords,
  deleteReconciliationByPeriod,
  findReconciliationByPeriod,
  createReconciliationRecords,
  findGstr2bByPeriod,
  findInvoices,
} from "../lib/dal";
import { ReconciliationRecord, Invoice, Gstr2bRecord } from "../lib/schemas";

const router = Router();

function formatRecord(r: ReconciliationRecord & { _id: { toHexString: () => string } }) {
  return {
    id: r._id.toHexString(),
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
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/reconciliation", authenticate, async (req, res): Promise<void> => {
  const params = ListReconciliationRecordsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const sortBy = params.success ? params.data.sortBy : undefined;
  const sortOrder = params.success ? params.data.sortOrder : undefined;

  const filter: Record<string, unknown> = {};
  if (params.success) {
    if (params.data.period) filter.period = params.data.period;
    if (params.data.status) filter.status = params.data.status;
  }

  const result = await findReconciliationRecords(filter, { page, limit, sortBy, sortOrder });
  res.json({ data: result.data.map(formatRecord), total: result.total, page, limit, sortBy: result.sortBy, sortOrder: result.sortOrder });
});

router.post("/reconciliation/run", authenticate, async (req, res): Promise<void> => {
  const parsed = RunReconciliationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { period } = parsed.data;

  await deleteReconciliationByPeriod(period);

  const gstr2bRows = await findGstr2bByPeriod(period);
  const erpInvoicesResult = await findInvoices({ status: "pushed" }, { limit: 10000 });
  const erpInvoices = erpInvoicesResult.data;

  const erpMap = new Map<string, Invoice>();
  for (const inv of erpInvoices) {
    if (inv.supplierGstin && inv.invoiceNumber) {
      erpMap.set(`${inv.supplierGstin}__${inv.invoiceNumber}`, inv);
    }
  }

  const insertRecords: Array<Omit<ReconciliationRecord, "_id" | "createdAt" | "updatedAt">> = [];
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
        erpTaxableValue: undefined,
        erpCgst: undefined,
        erpSgst: undefined,
        erpIgst: undefined,
        mismatchAmount: undefined,
      });
      continue;
    }

    const erpTaxable = Number(erp.taxableValue ?? 0);
    const gstrTaxable = Number(g.taxableValue ?? 0);
    const erpGst = Number(erp.cgst ?? 0) + Number(erp.sgst ?? 0) + Number(erp.igst ?? 0);
    const gstrGst = Number(g.cgst ?? 0) + Number(g.sgst ?? 0) + Number(g.igst ?? 0);
    const taxableDiff = Math.abs(erpTaxable - gstrTaxable);
    const gstDiff = Math.abs(erpGst - gstrGst);

    let status: ReconciliationRecord["status"] = "matched";
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
      mismatchAmount: status === "matched" ? undefined : Math.max(taxableDiff, gstDiff).toFixed(2),
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
      gstr2bTaxableValue: undefined,
      gstr2bCgst: undefined,
      gstr2bSgst: undefined,
      gstr2bIgst: undefined,
      mismatchAmount: undefined,
    });
  }

  if (insertRecords.length > 0) {
    await createReconciliationRecords(insertRecords);
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
  const filter: Record<string, unknown> = {};
  if (period) filter.period = period;

  const rows = await findReconciliationByPeriod(period ?? "");
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

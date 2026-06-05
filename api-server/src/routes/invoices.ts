import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, invoicesTable, suppliersTable } from "@workspace/db";
import { eq, ilike, and, sql, gte, lte } from "drizzle-orm";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { extractInvoiceWithAI, matchSupplierWithAI } from "../lib/ai";
import { ensureUploadDir, UPLOAD_DIR, getFileUrl } from "../lib/storage";
import {
  ListInvoicesQueryParams,
  GetInvoiceParams,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  DeleteInvoiceParams,
  ExtractInvoiceParams,
  MatchSupplierParams,
  MatchSupplierBody,
  PushInvoiceToErpParams,
  ApproveInvoiceParams,
} from "@workspace/api-zod";
import { erpConnectionsTable } from "@workspace/db";

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

function formatInvoice(inv: typeof invoicesTable.$inferSelect) {
  return {
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
  };
}

router.get("/invoices", authenticate, async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;
  const conditions = [];
  if (params.success) {
    if (params.data.status) conditions.push(eq(invoicesTable.status, params.data.status));
    if (params.data.search) conditions.push(ilike(invoicesTable.supplierName, `%${params.data.search}%`));
    if (params.data.supplierId) conditions.push(eq(invoicesTable.matchedSupplierId, parseInt(params.data.supplierId)));
    if (params.data.dateFrom) conditions.push(gte(invoicesTable.invoiceDate, params.data.dateFrom));
    if (params.data.dateTo) conditions.push(lte(invoicesTable.invoiceDate, params.data.dateTo));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(invoicesTable).where(where).limit(limit).offset(offset).orderBy(invoicesTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(where);
  res.json({ data: rows.map(formatInvoice), total: Number(count), page, limit });
});

async function runExtraction(invId: number, filePath: string, fileType: string) {
  try {
    await db.update(invoicesTable).set({ status: "extracting" }).where(eq(invoicesTable.id, invId));
    const extracted = await extractInvoiceWithAI(filePath, fileType);
    const suppliers = await db.select({ id: suppliersTable.id, name: suppliersTable.name, gstin: suppliersTable.gstin }).from(suppliersTable);
    const matchResult = await matchSupplierWithAI(extracted.supplierName, extracted.supplierGstin, suppliers);
    let matchedSupplierName: string | null = null;
    if (matchResult.matchedId) {
      const matched = suppliers.find((s) => s.id === matchResult.matchedId);
      matchedSupplierName = matched?.name ?? null;
    }
    await db.update(invoicesTable).set({
      status: "extracted",
      supplierName: extracted.supplierName,
      supplierGstin: extracted.supplierGstin,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      placeOfSupply: extracted.placeOfSupply,
      taxableValue: extracted.taxableValue?.toString() ?? null,
      cgst: extracted.cgst?.toString() ?? null,
      sgst: extracted.sgst?.toString() ?? null,
      igst: extracted.igst?.toString() ?? null,
      grandTotal: extracted.grandTotal?.toString() ?? null,
      items: extracted.items as unknown as typeof invoicesTable.$inferInsert["items"],
      confidenceScore: extracted.confidenceScore.toString(),
      matchedSupplierId: matchResult.matchedId,
      matchedSupplierName,
      supplierMatchStatus: matchResult.matchedId ? "matched" : "unmatched",
      extractedAt: new Date(),
    }).where(eq(invoicesTable.id, invId));
  } catch {
    await db.update(invoicesTable).set({ status: "failed" }).where(eq(invoicesTable.id, invId));
  }
}

router.post("/invoices/upload", authenticate, upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }
  const inserted = [];
  for (const file of files) {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const [inv] = await db.insert(invoicesTable).values({
      fileName: file.originalname,
      fileUrl: getFileUrl(file.filename),
      fileType: ext,
      status: "pending",
      uploadedBy: req.user!.userId,
      items: [],
    }).returning();
    await logAudit(req, "invoice_uploaded", "invoice", String(inv!.id), file.originalname);
    inserted.push(formatInvoice(inv!));
    // Auto-extract in background — don't block the response
    const filePath = path.join(UPLOAD_DIR, file.filename);
    setImmediate(() => runExtraction(inv!.id, filePath, ext));
  }
  res.status(201).json(inserted);
});

router.get("/invoices/:invoiceId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const id = parseInt(rawId, 10);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json(formatInvoice(inv));
});

router.put("/invoices/:invoiceId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const id = parseInt(rawId, 10);
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Fetch current values for diff
  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }

  const { remark, ...fields } = parsed.data;

  // Build a human-readable before/after diff for scalar fields
  const scalarFields: Array<{ key: keyof typeof fields; label: string }> = [
    { key: "invoiceNumber", label: "Invoice Number" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "supplierName", label: "Supplier Name" },
    { key: "supplierGstin", label: "Supplier GSTIN" },
    { key: "placeOfSupply", label: "Place of Supply" },
    { key: "taxableValue", label: "Taxable Value" },
    { key: "cgst", label: "CGST" },
    { key: "sgst", label: "SGST" },
    { key: "igst", label: "IGST" },
    { key: "grandTotal", label: "Grand Total" },
  ];

  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
  for (const { key, label } of scalarFields) {
    if (key in fields) {
      const oldVal = existing[key as keyof typeof existing];
      const newVal = (fields as Record<string, unknown>)[key];
      const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : "";
      const newStr = newVal !== null && newVal !== undefined ? String(newVal) : "";
      if (oldStr !== newStr) {
        changes.push({ field: label, from: oldVal ?? null, to: newVal ?? null });
      }
    }
  }
  // Note items change without full diff (too verbose)
  if ("items" in fields && JSON.stringify(existing.items) !== JSON.stringify(fields.items)) {
    changes.push({ field: "Line Items", from: `${(existing.items as unknown[])?.length ?? 0} items`, to: `${(fields.items as unknown[])?.length ?? 0} items` });
  }

  const updateData: Partial<typeof invoicesTable.$inferSelect> = { ...fields } as unknown as Partial<typeof invoicesTable.$inferSelect>;
  if (fields.matchedSupplierId) {
    (updateData as Record<string, unknown>).matchedSupplierId = parseInt(fields.matchedSupplierId);
  }

  const [inv] = await db.update(invoicesTable)
    .set({ ...updateData, status: "reviewing" } as unknown as typeof invoicesTable.$inferInsert)
    .where(eq(invoicesTable.id, id))
    .returning();
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  const auditDetails = JSON.stringify({ remark, changes });
  await logAudit(req, "invoice_edited", "invoice", String(id), auditDetails);
  res.json(formatInvoice(inv));
});

router.delete("/invoices/:invoiceId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const id = parseInt(rawId, 10);
  const [inv] = await db.delete(invoicesTable).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  const filePath = path.join(UPLOAD_DIR, path.basename(inv.fileUrl));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await logAudit(req, "invoice_deleted", "invoice", String(id));
  res.json({ message: "Invoice deleted" });
});

router.post("/invoices/:invoiceId/extract", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const id = parseInt(rawId, 10);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  await db.update(invoicesTable).set({ status: "extracting" }).where(eq(invoicesTable.id, id));

  try {
    const filePath = path.join(UPLOAD_DIR, path.basename(inv.fileUrl));
    const extracted = await extractInvoiceWithAI(filePath, inv.fileType);

    const suppliers = await db.select({ id: suppliersTable.id, name: suppliersTable.name, gstin: suppliersTable.gstin }).from(suppliersTable);
    const matchResult = await matchSupplierWithAI(extracted.supplierName, extracted.supplierGstin, suppliers);

    let matchedSupplierName: string | null = null;
    if (matchResult.matchedId) {
      const matched = suppliers.find((s) => s.id === matchResult.matchedId);
      matchedSupplierName = matched?.name ?? null;
    }

    const [updated] = await db.update(invoicesTable).set({
      status: "extracted",
      supplierName: extracted.supplierName,
      supplierGstin: extracted.supplierGstin,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      placeOfSupply: extracted.placeOfSupply,
      taxableValue: extracted.taxableValue?.toString() ?? null,
      cgst: extracted.cgst?.toString() ?? null,
      sgst: extracted.sgst?.toString() ?? null,
      igst: extracted.igst?.toString() ?? null,
      grandTotal: extracted.grandTotal?.toString() ?? null,
      items: extracted.items as unknown as typeof invoicesTable.$inferInsert["items"],
      confidenceScore: extracted.confidenceScore.toString(),
      matchedSupplierId: matchResult.matchedId,
      matchedSupplierName,
      supplierMatchStatus: matchResult.matchedId ? "matched" : "unmatched",
      extractedAt: new Date(),
    }).where(eq(invoicesTable.id, id)).returning();

    await logAudit(req, "invoice_extracted", "invoice", String(id), `Confidence: ${extracted.confidenceScore}`);
    res.json(formatInvoice(updated!));
  } catch (err) {
    await db.update(invoicesTable).set({ status: "failed" }).where(eq(invoicesTable.id, id));
    req.log.error({ err }, "Invoice extraction failed");
    res.status(500).json({ error: "Extraction failed" });
  }
});

router.post("/invoices/:invoiceId/match-supplier", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const id = parseInt(rawId, 10);
  const parsed = MatchSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const supplierId = parsed.data.supplierId ? parseInt(parsed.data.supplierId) : null;
  let matchedSupplierName: string | null = null;
  if (supplierId) {
    const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supplierId));
    matchedSupplierName = s?.name ?? null;
  }

  const [inv] = await db.update(invoicesTable).set({
    matchedSupplierId: supplierId,
    matchedSupplierName,
    supplierMatchStatus: supplierId ? "manual" : "unmatched",
  }).where(eq(invoicesTable.id, id)).returning();

  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json(formatInvoice(inv));
});

router.post("/invoices/:invoiceId/approve", authenticate, requireRole("admin", "accounts", "purchase_manager"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const id = parseInt(rawId, 10);
  const [inv] = await db.update(invoicesTable).set({ status: "approved" }).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  await logAudit(req, "invoice_approved", "invoice", String(id));
  res.json(formatInvoice(inv));
});

router.post("/invoices/:invoiceId/push-to-erp", authenticate, requireRole("admin", "accounts", "purchase_manager"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const id = parseInt(rawId, 10);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  const [conn] = await db.select().from(erpConnectionsTable).limit(1);
  if (!conn?.isConnected) {
    res.json({ success: false, erpDocumentId: null, status: "failed", message: "ERP not connected" });
    return;
  }

  try {
    const items = Array.isArray(inv.items) ? inv.items as Array<Record<string, unknown>> : [];
    const erpPayload = {
      doctype: "Purchase Invoice",
      supplier: inv.matchedSupplierName ?? inv.supplierName,
      posting_date: inv.invoiceDate ?? new Date().toISOString().split("T")[0],
      bill_no: inv.invoiceNumber,
      items: items.map((item) => ({
        item_name: item.description,
        qty: item.quantity ?? 1,
        rate: item.rate ?? 0,
        uom: item.uom ?? "NOS",
        gst_hsn_code: item.hsn ?? "",
      })),
    };

    const response = await fetch(`${conn.erpUrl}/api/resource/Purchase Invoice`, {
      method: "POST",
      headers: {
        Authorization: `token ${conn.apiKey}:${conn.apiSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(erpPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json() as { data?: { name?: string } };
      const erpDocumentId = data.data?.name ?? null;
      await db.update(invoicesTable).set({ status: "pushed", erpDocumentId, erpStatus: "Draft", erpError: null }).where(eq(invoicesTable.id, id));
      await logAudit(req, "erp_push_success", "invoice", String(id), erpDocumentId ?? undefined);
      res.json({ success: true, erpDocumentId, status: "Draft", message: "Purchase invoice created in ERPNext" });
    } else {
      const errText = await response.text();
      await db.update(invoicesTable).set({ status: "failed", erpStatus: "Failed", erpError: errText }).where(eq(invoicesTable.id, id));
      await logAudit(req, "erp_push_failed", "invoice", String(id), errText);
      res.json({ success: false, erpDocumentId: null, status: "Failed", message: errText });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db.update(invoicesTable).set({ status: "failed", erpStatus: "Failed", erpError: msg }).where(eq(invoicesTable.id, id));
    res.json({ success: false, erpDocumentId: null, status: "Failed", message: msg });
  }
});

export default router;

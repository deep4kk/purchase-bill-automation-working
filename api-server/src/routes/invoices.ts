import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { logger } from "../lib/logger";
import { extractInvoiceWithAI, matchSupplierWithAI } from "../lib/ai";
import { ensureUploadDir, UPLOAD_DIR } from "../lib/storage";
import { getStorageProvider } from "../lib/storage-adapter";
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
import {
  findInvoices,
  findInvoiceById,
  findSupplierById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getErpConnection,
  toStringId,
} from "../lib/dal";
import { Invoice, InvoiceItem } from "../lib/schemas";
import { buildDateRangeFilter } from "../lib/filters";
import { getCachedSuppliers, invalidateSupplierCache } from "../lib/cache";

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

function formatInvoice(inv: Invoice & { _id: { toHexString: () => string }; createdAt: Date; updatedAt: Date }) {
  return {
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
    extractionError: inv.extractionError ?? null,
    extractedAt: inv.extractedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

router.get("/invoices", authenticate, async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const sortBy = params.success ? params.data.sortBy : undefined;
  const sortOrder = params.success ? params.data.sortOrder : undefined;

  const filter: Record<string, unknown> = {};
  if (params.success) {
    if (params.data.status) filter.status = params.data.status;
    if (params.data.search) filter.supplierName = { $regex: params.data.search, $options: "i" };
    if (params.data.supplierId) filter.matchedSupplierId = params.data.supplierId;
    if (params.data.dateFrom || params.data.dateTo) {
      Object.assign(filter, buildDateRangeFilter("invoiceDate", params.data.dateFrom, params.data.dateTo));
    }
  }

  const result = await findInvoices(filter, { page, limit, sortBy, sortOrder });
  res.json({ data: result.data.map(formatInvoice), total: result.total, page, limit, sortBy: result.sortBy, sortOrder: result.sortOrder });
});

async function runExtraction(invId: string, filePath: string, fileType: string) {
  try {
    logger.info({ invoiceId: invId, filePath, fileType }, "Background extraction started");
    await updateInvoice(invId, { status: "extracting" });
    const extracted = await extractInvoiceWithAI(filePath, fileType);
    const suppliers = await getCachedSuppliers();
    const matchResult = await matchSupplierWithAI(extracted.supplierName, extracted.supplierGstin, suppliers);
    let matchedSupplierName: string | null = null;
    if (matchResult.matchedId) {
      const matched = suppliers.find((s) => s.id === matchResult.matchedId);
      matchedSupplierName = matched?.name ?? null;
    }
    await updateInvoice(invId, {
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
      items: extracted.items,
      confidenceScore: extracted.confidenceScore.toString(),
      matchedSupplierId: matchResult.matchedId ?? undefined,
      matchedSupplierName,
      supplierMatchStatus: matchResult.matchedId ? "matched" : "unmatched",
      extractedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown extraction error";
    logger.error({ err, invoiceId: invId }, "Background extraction failed");
    await updateInvoice(invId, { status: "failed", extractionError: message });
  }
}

router.post("/invoices/upload", authenticate, upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  const storageProvider = getStorageProvider();
  const inserted = [];

  for (const file of files) {
    try {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      const localFilePath = path.join(UPLOAD_DIR, file.filename);

      // Upload to configured storage (disk or Cloudinary)
      const uploadResult = await storageProvider.uploadFile(localFilePath, file.filename);

      const inv = await createInvoice({
        fileName: file.originalname,
        fileUrl: uploadResult.url,
        fileType: ext,
        status: "pending",
        uploadedBy: req.user!.userId,
        items: [],
      });
      await logAudit(req, "invoice_uploaded", "invoice", inv._id.toHexString(), file.originalname);
      inserted.push(formatInvoice(inv));

      logger.info({ invoiceId: inv._id.toHexString(), fileName: file.originalname }, "Invoice uploaded, scheduling background extraction");

      setImmediate(async () => {
        try {
          await runExtraction(inv._id.toHexString(), localFilePath, ext);
          // Clean up local file AFTER extraction completes (if using Cloudinary)
          if (process.env.STORAGE_TYPE === "cloudinary" && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            logger.info({ fileName: file.originalname }, "Local file deleted after extraction");
          }
        } catch (err) {
          logger.error({ err, invoiceId: inv._id.toHexString() }, "Background extraction task failed");
          // Still clean up file if extraction failed
          if (process.env.STORAGE_TYPE === "cloudinary" && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
          }
        }
      });
    } catch (err) {
      logger.error({ err, fileName: file.originalname }, "File upload failed");
    }
  }

  res.status(201).json(inserted);
});

router.get("/invoices/:invoiceId", authenticate, async (req, res): Promise<void> => {
  const invoiceId = req.params.invoiceId;
  const inv = await findInvoiceById(invoiceId);
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json(formatInvoice(inv));
});

router.put("/invoices/:invoiceId", authenticate, async (req, res): Promise<void> => {
  const invoiceId = req.params.invoiceId;
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await findInvoiceById(invoiceId);
  if (!existing) { res.status(404).json({ error: "Invoice not found" }); return; }

  const { remark, ...fields } = parsed.data;

  const scalarFields: Array<{ key: string; label: string }> = [
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
      const oldVal = (existing as Record<string, unknown>)[key];
      const newVal = (fields as Record<string, unknown>)[key];
      const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : "";
      const newStr = newVal !== null && newVal !== undefined ? String(newVal) : "";
      if (oldStr !== newStr) {
        changes.push({ field: label, from: oldVal ?? null, to: newVal ?? null });
      }
    }
  }
  if ("items" in fields && JSON.stringify(existing.items) !== JSON.stringify(fields.items)) {
    changes.push({ field: "Line Items", from: `${(existing.items as unknown[])?.length ?? 0} items`, to: `${(fields.items as unknown[])?.length ?? 0} items` });
  }

  const updateData: Record<string, unknown> = { ...fields, status: "reviewing" };

  const inv = await updateInvoice(invoiceId, updateData as Partial<Invoice>);
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  const auditDetails = JSON.stringify({ remark, changes });
  await logAudit(req, "invoice_edited", "invoice", invoiceId, auditDetails);
  res.json(formatInvoice(inv));
});

router.delete("/invoices/:invoiceId", authenticate, async (req, res): Promise<void> => {
  const invoiceId = req.params.invoiceId;
  const inv = await deleteInvoice(invoiceId);
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  const filePath = path.join(UPLOAD_DIR, path.basename(inv.fileUrl));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await logAudit(req, "invoice_deleted", "invoice", invoiceId);
  res.json({ message: "Invoice deleted" });
});

router.post("/invoices/:invoiceId/extract", authenticate, async (req, res): Promise<void> => {
  const invoiceId = req.params.invoiceId;
  const inv = await findInvoiceById(invoiceId);
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  await updateInvoice(invoiceId, { status: "extracting" });

  try {
    const filePath = path.join(UPLOAD_DIR, path.basename(inv.fileUrl));
    const extracted = await extractInvoiceWithAI(filePath, inv.fileType);

    const suppliers = await getCachedSuppliers();
    const matchResult = await matchSupplierWithAI(extracted.supplierName, extracted.supplierGstin, suppliers);

    let matchedSupplierName: string | null = null;
    if (matchResult.matchedId) {
      const matched = suppliers.find((s) => s.id === matchResult.matchedId);
      matchedSupplierName = matched?.name ?? null;
    }

    const updated = await updateInvoice(invoiceId, {
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
      items: extracted.items,
      confidenceScore: extracted.confidenceScore.toString(),
      matchedSupplierId: matchResult.matchedId ?? undefined,
      matchedSupplierName,
      supplierMatchStatus: matchResult.matchedId ? "matched" : "unmatched",
      extractedAt: new Date(),
    });

    await logAudit(req, "invoice_extracted", "invoice", invoiceId, `Confidence: ${extracted.confidenceScore}`);
    res.json(formatInvoice(updated!));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateInvoice(invoiceId, { status: "failed", extractionError: message });
    req.log.error({ err }, "Invoice extraction failed");
    res.status(500).json({ error: "Extraction failed", detail: message });
  }
});

router.post("/invoices/:invoiceId/match-supplier", authenticate, async (req, res): Promise<void> => {
  const invoiceId = req.params.invoiceId;
  const parsed = MatchSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const supplierId = parsed.data.supplierId ?? null;
  let matchedSupplierName: string | null = null;
  if (supplierId) {
    const supplier = await findSupplierById(supplierId);
    if (!supplier) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }
    matchedSupplierName = supplier.name;
  }

  const inv = await updateInvoice(invoiceId, {
    matchedSupplierId: supplierId ?? undefined,
    matchedSupplierName,
    supplierMatchStatus: supplierId ? "manual" : "unmatched",
    extractionError: undefined,
  });

  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json(formatInvoice(inv));
});

router.post("/invoices/:invoiceId/approve", authenticate, requireRole("admin", "accounts", "purchase_manager"), async (req, res): Promise<void> => {
  const invoiceId = req.params.invoiceId;
  const inv = await updateInvoice(invoiceId, { status: "approved" });
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  await logAudit(req, "invoice_approved", "invoice", invoiceId);
  res.json(formatInvoice(inv));
});

router.post("/invoices/bulk/approve", authenticate, requireRole("admin", "accounts", "purchase_manager"), async (req, res): Promise<void> => {
  const { invoiceIds } = req.body as { invoiceIds: string[] };
  
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    res.status(400).json({ error: "invoiceIds array is required and must not be empty" });
    return;
  }

  const results = { approved: [] as string[], failed: [] as { id: string; error: string }[] };

  for (const invoiceId of invoiceIds) {
    try {
      const inv = await updateInvoice(invoiceId, { status: "approved" });
      if (inv) {
        await logAudit(req, "invoice_approved", "invoice", invoiceId);
        results.approved.push(invoiceId);
      } else {
        results.failed.push({ id: invoiceId, error: "Invoice not found" });
      }
    } catch (err) {
      logger.error({ err, invoiceId }, "Bulk approve failed for invoice");
      results.failed.push({ id: invoiceId, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  res.json(results);
});

router.post("/invoices/:invoiceId/push-to-erp", authenticate, requireRole("admin", "accounts", "purchase_manager"), async (req, res): Promise<void> => {
  const invoiceId = req.params.invoiceId;
  const inv = await findInvoiceById(invoiceId);
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  const conn = await getErpConnection();
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
      await updateInvoice(invoiceId, { status: "pushed", erpDocumentId, erpStatus: "Draft", erpError: undefined });
      await logAudit(req, "erp_push_success", "invoice", invoiceId, erpDocumentId ?? undefined);
      res.json({ success: true, erpDocumentId, status: "Draft", message: "Purchase invoice created in ERPNext" });
    } else {
      const errText = await response.text();
      await updateInvoice(invoiceId, { status: "failed", erpStatus: "Failed", erpError: errText });
      await logAudit(req, "erp_push_failed", "invoice", invoiceId, errText);
      res.json({ success: false, erpDocumentId: null, status: "Failed", message: errText });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await updateInvoice(invoiceId, { status: "failed", erpStatus: "Failed", erpError: msg });
    res.json({ success: false, erpDocumentId: null, status: "Failed", message: msg });
  }
});

export default router;

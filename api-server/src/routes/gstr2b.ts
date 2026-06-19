import { Router } from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { ListGstr2bRecordsQueryParams } from "@workspace/api-zod";
import * as XLSX from "xlsx";
import { UPLOAD_DIR } from "../lib/storage";
import {
  findGstr2bRecords,
  getDistinctPeriods,
  createGstr2bRecords,
} from "../lib/dal";
import { Gstr2bRecord } from "../lib/schemas";

const router = Router();
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

function formatRecord(r: Gstr2bRecord & { _id: { toHexString: () => string } }) {
  return {
    id: r._id.toHexString(),
    period: r.period,
    supplierGstin: r.supplierGstin,
    supplierName: r.supplierName,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    taxableValue: Number(r.taxableValue),
    cgst: Number(r.cgst),
    sgst: Number(r.sgst),
    igst: Number(r.igst),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/gstr2b", authenticate, async (req, res): Promise<void> => {
  const params = ListGstr2bRecordsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const sortBy = params.success ? params.data.sortBy : undefined;
  const sortOrder = params.success ? params.data.sortOrder : undefined;

  const filter: Record<string, unknown> = {};
  if (params.success) {
    if (params.data.search) filter.supplierName = { $regex: params.data.search, $options: "i" };
    if (params.data.period) filter.period = params.data.period;
  }

  const result = await findGstr2bRecords(filter, { page, limit, sortBy, sortOrder });
  res.json({ data: result.data.map(formatRecord), total: result.total, page, limit, sortBy: result.sortBy, sortOrder: result.sortOrder });
});

router.post("/gstr2b/import", authenticate, upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, imported: 0, skipped: 0, errors: ["No file uploaded"], message: "No file uploaded" });
    return;
  }

  const period = (req.body as Record<string, string>).period ?? new Date().toISOString().substring(0, 7).replace("-", "");

  try {
    const workbook = XLSX.readFile(file.path);

    function parseDDMMYYYY(str: string): string {
      const parts = String(str ?? "").trim().split("/");
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
      return str;
    }

    const isGovtFormat = workbook.SheetNames.includes("B2B");

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const records: Array<Omit<Gstr2bRecord, "_id" | "createdAt" | "updatedAt">> = [];

    if (isGovtFormat) {
      const b2bRaw = XLSX.utils.sheet_to_json(workbook.Sheets["B2B"]!, { header: 1, defval: "" }) as unknown[][];
      const b2bData = b2bRaw.slice(5).filter((r) => r[0] !== "" && r[2] !== "");

      for (const row of b2bData) {
        const gstin   = String(row[0]).trim();
        const name    = String(row[1]).trim();
        const invNo   = String(row[2]).trim();
        const invDate = parseDDMMYYYY(String(row[4]));
        const taxable = Number(row[8]) || 0;
        const igst    = Number(row[9]) || 0;
        const cgst    = Number(row[10]) || 0;
        const sgst    = Number(row[11]) || 0;
        if (!gstin || !invNo) { skipped++; continue; }
        records.push({
          period, supplierGstin: gstin, supplierName: name || gstin,
          invoiceNumber: invNo, invoiceDate: invDate || new Date().toISOString().split("T")[0]!,
          taxableValue: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
        });
        imported++;
      }

      if (workbook.SheetNames.includes("B2B-CDNR")) {
        const cdnrRaw = XLSX.utils.sheet_to_json(workbook.Sheets["B2B-CDNR"]!, { header: 1, defval: "" }) as unknown[][];
        const cdnrData = cdnrRaw.slice(5).filter((r) => r[0] !== "" && r[2] !== "");
        for (const row of cdnrData) {
          const gstin   = String(row[0]).trim();
          const name    = String(row[1]).trim();
          const noteNo  = `CDN-${String(row[2]).trim()}`;
          const noteDate = parseDDMMYYYY(String(row[5]));
          const taxable = Number(row[9]) || 0;
          const igst    = Number(row[10]) || 0;
          const cgst    = Number(row[11]) || 0;
          const sgst    = Number(row[12]) || 0;
          if (!gstin) { skipped++; continue; }
          records.push({
            period, supplierGstin: gstin, supplierName: name || gstin,
            invoiceNumber: noteNo, invoiceDate: noteDate || new Date().toISOString().split("T")[0]!,
            taxableValue: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
          });
          imported++;
        }
      }
    } else {
      const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        try {
          const gstin   = String(row["GSTIN of Supplier"] ?? row["Supplier GSTIN"] ?? row["gstin"] ?? "").trim();
          const name    = String(row["Supplier Name"] ?? row["Trade/Legal name of Supplier"] ?? row["name"] ?? "").trim();
          const invNo   = String(row["Invoice Number"] ?? row["Invoice No"] ?? row["invoice_number"] ?? "").trim();
          const invDate = String(row["Invoice Date"] ?? row["Date of Invoice"] ?? row["invoice_date"] ?? "").trim();
          const taxable = Number(row["Taxable Value"] ?? row["taxable_value"] ?? 0);
          const cgst    = Number(row["CGST"] ?? row["cgst"] ?? 0);
          const sgst    = Number(row["SGST/UTGST"] ?? row["SGST"] ?? row["sgst"] ?? 0);
          const igst    = Number(row["IGST"] ?? row["igst"] ?? 0);
          if (!gstin || !invNo) { skipped++; continue; }
          records.push({
            period, supplierGstin: gstin, supplierName: name || gstin,
            invoiceNumber: invNo, invoiceDate: invDate || new Date().toISOString().split("T")[0]!,
            taxableValue: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
          });
          imported++;
        } catch {
          errors.push(`Row ${i + 2}: Failed to process`);
          skipped++;
        }
      }
    }

    if (records.length > 0) {
      await createGstr2bRecords(records);
    }

    await logAudit(req, "gstr2b_imported", "gstr2b", undefined, `Period: ${period}, Imported: ${imported}`);
    res.json({ success: true, imported, skipped, errors, message: `Imported ${imported} records for period ${period}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ success: false, imported: 0, skipped: 0, errors: [msg], message: "Failed to parse file" });
  }
});

router.get("/gstr2b/periods", authenticate, async (_req, res): Promise<void> => {
  const periods = await getDistinctPeriods();
  res.json(periods);
});

export default router;

import { Router } from "express";
import multer from "multer";
import path from "path";
import { db, gstr2bRecordsTable } from "@workspace/db";
import { ilike, and, eq, sql } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { ListGstr2bRecordsQueryParams } from "@workspace/api-zod";
import * as XLSX from "xlsx";
import { UPLOAD_DIR } from "../lib/storage";

const router = Router();
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 10 * 1024 * 1024 } });

function formatRecord(r: typeof gstr2bRecordsTable.$inferSelect) {
  return {
    id: String(r.id),
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
  };
}

router.get("/gstr2b", authenticate, async (req, res): Promise<void> => {
  const params = ListGstr2bRecordsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;
  const conditions = [];
  if (params.success) {
    if (params.data.search) conditions.push(ilike(gstr2bRecordsTable.supplierName, `%${params.data.search}%`));
    if (params.data.period) conditions.push(eq(gstr2bRecordsTable.period, params.data.period));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(gstr2bRecordsTable).where(where).limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(gstr2bRecordsTable).where(where);
  res.json({ data: rows.map(formatRecord), total: Number(count), page, limit });
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

    // Detect government GSTR-2B format: has a "B2B" sheet
    const isGovtFormat = workbook.SheetNames.includes("B2B");

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    if (isGovtFormat) {
      // Government GSTR-2B Excel: B2B sheet with positional columns, data from row index 5
      // [0]=GSTIN [1]=Name [2]=InvNo [3]=Type [4]=Date(DD/MM/YYYY) [5]=InvValue
      // [8]=TaxableValue [9]=IGST [10]=CGST [11]=SGST [12]=Cess
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
        try {
          await db.insert(gstr2bRecordsTable).values({
            period, supplierGstin: gstin, supplierName: name || gstin,
            invoiceNumber: invNo, invoiceDate: invDate || new Date().toISOString().split("T")[0]!,
            taxableValue: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
          }).onConflictDoNothing();
          imported++;
        } catch { skipped++; }
      }

      // Also import B2B-CDNR (credit/debit notes) if present
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
          try {
            await db.insert(gstr2bRecordsTable).values({
              period, supplierGstin: gstin, supplierName: name || gstin,
              invoiceNumber: noteNo, invoiceDate: noteDate || new Date().toISOString().split("T")[0]!,
              taxableValue: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
            }).onConflictDoNothing();
            imported++;
          } catch { skipped++; }
        }
      }
    } else {
      // Generic/custom format: use header-based parsing
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
          await db.insert(gstr2bRecordsTable).values({
            period, supplierGstin: gstin, supplierName: name || gstin,
            invoiceNumber: invNo, invoiceDate: invDate || new Date().toISOString().split("T")[0]!,
            taxableValue: taxable.toFixed(2), cgst: cgst.toFixed(2), sgst: sgst.toFixed(2), igst: igst.toFixed(2),
          }).onConflictDoNothing();
          imported++;
        } catch {
          errors.push(`Row ${i + 2}: Failed to process`);
          skipped++;
        }
      }
    }

    await logAudit(req, "gstr2b_imported", "gstr2b", undefined, `Period: ${period}, Imported: ${imported}`);
    res.json({ success: true, imported, skipped, errors, message: `Imported ${imported} records for period ${period}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ success: false, imported: 0, skipped: 0, errors: [msg], message: "Failed to parse file" });
  }
});

router.get("/gstr2b/periods", authenticate, async (_req, res): Promise<void> => {
  const result = await db
    .selectDistinct({ period: gstr2bRecordsTable.period })
    .from(gstr2bRecordsTable)
    .orderBy(gstr2bRecordsTable.period);
  res.json(result.map((r) => r.period));
});

export default router;

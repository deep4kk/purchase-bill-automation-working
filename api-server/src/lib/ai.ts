import fs from "fs";
import { logger } from "./logger";

let _genAI: import("@google/genai").GoogleGenAI | null = null;

function getGenAI(): import("@google/genai").GoogleGenAI | null {
  if (!process.env.GOOGLE_API_KEY) return null;
  if (!_genAI) {
    const { GoogleGenAI } = require("@google/genai");
    _genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  }
  return _genAI;
}

export interface ExtractedInvoiceItem {
  id: string;
  description: string;
  hsn: string | null;
  quantity: number | null;
  uom: string | null;
  rate: number | null;
  amount: number | null;
  gstPercent: number | null;
  matchedItemId: null;
  matchScore: null;
}

export interface ExtractedInvoice {
  supplierName: string | null;
  supplierGstin: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  placeOfSupply: string | null;
  taxableValue: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  grandTotal: number | null;
  items: ExtractedInvoiceItem[];
  confidenceScore: number;
}

const EXTRACTION_PROMPT = `You are an expert GST invoice data extractor for Indian tax invoices.
Extract all fields from this invoice image with high accuracy.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "supplierName": string or null,
  "supplierGstin": string or null,
  "invoiceNumber": string or null,
  "invoiceDate": string or null (YYYY-MM-DD format),
  "placeOfSupply": string or null,
  "taxableValue": number or null,
  "cgst": number or null,
  "sgst": number or null,
  "igst": number or null,
  "grandTotal": number or null,
  "items": [
    {
      "description": string,
      "hsn": string or null,
      "quantity": number or null,
      "uom": string or null,
      "rate": number or null,
      "amount": number or null,
      "gstPercent": number or null
    }
  ],
  "confidenceScore": number between 0 and 1
}

Rules:
- supplierName/supplierGstin: the SELLER (not the buyer)
- invoiceDate: convert to YYYY-MM-DD
- taxableValue: subtotal before GST
- cgst/sgst: for intra-state; igst: for inter-state
- grandTotal: final amount payable
- confidenceScore: 0.9+ if clearly readable, lower if blurry/partial`;

export async function extractInvoiceWithAI(filePath: string, fileType: string): Promise<ExtractedInvoice> {
  const genAI = getGenAI();
  if (!genAI) {
    logger.warn("GOOGLE_API_KEY not set — returning mock extraction");
    return getMockExtraction();
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");
    const mimeType = fileType === "pdf" ? "application/pdf" : `image/${fileType === "jpg" ? "jpeg" : fileType}`;

    const response = await (genAI as unknown as { models: { generateContent: (opts: unknown) => Promise<{ text: string }> } }).models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: EXTRACTION_PROMPT },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    });

    const content = response.text ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Gemini response");

    const extracted = JSON.parse(jsonMatch[0]) as Omit<ExtractedInvoice, "items"> & {
      items: Array<Omit<ExtractedInvoiceItem, "id" | "matchedItemId" | "matchScore">>;
    };

    return {
      ...extracted,
      items: (extracted.items ?? []).map((item, i) => ({
        ...item,
        id: `item-${i + 1}`,
        matchedItemId: null,
        matchScore: null,
      })),
    };
  } catch (err) {
    logger.error({ err }, "Gemini extraction failed");
    return getMockExtraction();
  }
}

export async function matchSupplierWithAI(
  supplierName: string | null,
  supplierGstin: string | null,
  erpSuppliers: Array<{ id: string; name: string; gstin: string | null }>,
): Promise<{ matchedId: string | null; confidence: number }> {
  if (!supplierGstin && !supplierName) return { matchedId: null, confidence: 0 };

  if (supplierGstin) {
    const gstinMatch = erpSuppliers.find((s) => s.gstin === supplierGstin);
    if (gstinMatch) return { matchedId: gstinMatch.id, confidence: 0.99 };
  }

  if (supplierName) {
    const normalizedInput = supplierName.toLowerCase().replace(/[^a-z0-9]/g, "");
    let bestMatch: { id: string; score: number } | null = null;
    for (const s of erpSuppliers) {
      const normalizedName = s.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName)) {
        const score = Math.min(normalizedInput.length, normalizedName.length) / Math.max(normalizedInput.length, normalizedName.length);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { id: s.id, score };
        }
      }
    }
    if (bestMatch && bestMatch.score > 0.6) return { matchedId: bestMatch.id, confidence: bestMatch.score };
  }

  return { matchedId: null, confidence: 0 };
}

function getMockExtraction(): ExtractedInvoice {
  return {
    supplierName: null,
    supplierGstin: null,
    invoiceNumber: null,
    invoiceDate: null,
    placeOfSupply: null,
    taxableValue: null,
    cgst: null,
    sgst: null,
    igst: null,
    grandTotal: null,
    items: [],
    confidenceScore: 0,
  };
}

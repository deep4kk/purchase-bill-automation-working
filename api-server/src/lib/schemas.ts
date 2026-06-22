import { ObjectId } from "mongodb";

// Base document with timestamps
export interface BaseDocument {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// User document
export interface User extends BaseDocument {
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "accounts" | "purchase_manager" | "auditor";
  resetToken?: string;
  resetTokenExpiry?: Date;
}

// Invoice document
export interface Invoice extends BaseDocument {
  fileName: string;
  fileUrl: string;
  fileType: string;
  status: "pending" | "extracting" | "extracted" | "reviewing" | "approved" | "pushed" | "failed";
  uploadedBy: string;
  supplierName?: string;
  supplierGstin?: string;
  matchedSupplierId?: string;
  matchedSupplierName?: string;
  supplierMatchStatus?: "matched" | "unmatched" | "manual";
  invoiceNumber?: string;
  invoiceDate?: string;
  placeOfSupply?: string;
  taxableValue?: string;
  cgst?: string;
  sgst?: string;
  igst?: string;
  grandTotal?: string;
  items: InvoiceItem[];
  confidenceScore?: string;
  erpDocumentId?: string;
  erpStatus?: string;
  erpError?: string;
  extractedAt?: Date;
  extractionError?: string;
  remark?: string;
}

export interface InvoiceItem {
  description?: string;
  hsn?: string;
  quantity?: number;
  rate?: number;
  uom?: string;
  amount?: number;
}

// Supplier document
export interface Supplier extends BaseDocument {
  name: string;
  gstin?: string;
  erpSupplierId?: string;
  address?: string;
  phone?: string;
  email?: string;
  isMatched: boolean;
}

// Item document
export interface Item extends BaseDocument {
  name: string;
  itemCode?: string;
  erpItemCode?: string;
  hsn?: string;
  uom?: string;
  gstRate?: number;
}

// GSTR-2B Record document
export interface Gstr2bRecord extends BaseDocument {
  period: string;
  supplierGstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
}

// Reconciliation Record document
export interface ReconciliationRecord extends BaseDocument {
  period: string;
  status: "matched" | "amount_mismatch" | "gst_mismatch" | "missing_in_erp" | "missing_in_gstr2b" | "duplicate";
  supplierGstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  erpTaxableValue?: string;
  erpCgst?: string;
  erpSgst?: string;
  erpIgst?: string;
  gstr2bTaxableValue?: string;
  gstr2bCgst?: string;
  gstr2bSgst?: string;
  gstr2bIgst?: string;
  mismatchAmount?: string;
}

// ERP Connection document
export interface ErpConnection extends BaseDocument {
  erpUrl: string;
  apiKey: string;
  apiSecret: string;
  isConnected: boolean;
  lastSyncedAt?: Date;
}

// Audit Log document
export interface AuditLog extends BaseDocument {
  userId: string;
  userName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
}

// Collection names
export const COLLECTIONS = {
  USERS: "users",
  INVOICES: "invoices",
  SUPPLIERS: "suppliers",
  ITEMS: "items",
  GSTR2B_RECORDS: "gstr2b_records",
  RECONCILIATION_RECORDS: "reconciliation_records",
  ERP_CONNECTIONS: "erp_connections",
  AUDIT_LOGS: "audit_logs",
} as const;
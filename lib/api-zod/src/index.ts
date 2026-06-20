import { z } from "zod";

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const HealthCheckResponse = z.object({
  status: z.string(),
});

export const RegisterBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "accounts", "purchase_manager", "auditor"]).optional(),
});

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

export const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export const ListUsersQueryParams = paginationQuery;

export const UpdateUserRoleParams = z.object({
  userId: z.string().min(1),
});

export const UpdateUserRoleBody = z.object({
  role: z.enum(["admin", "accounts", "purchase_manager", "auditor"]),
});

export const UpdateErpSettingsBody = z.object({
  erpUrl: z.string().min(1),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export const ListAuditLogsQueryParams = paginationQuery.extend({
  action: z.string().optional(),
  userId: z.string().optional(),
  resourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const invoiceStatus = z.enum([
  "pending",
  "extracting",
  "extracted",
  "reviewing",
  "approved",
  "pushed",
  "failed",
]);

export const ListInvoicesQueryParams = paginationQuery.extend({
  status: invoiceStatus.optional(),
  search: z.string().optional(),
  supplierId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const GetInvoiceParams = z.object({
  invoiceId: z.string().min(1),
});

const invoiceItemSchema = z.object({
  description: z.string().optional(),
  hsn: z.string().optional(),
  quantity: z.number().optional(),
  rate: z.number().optional(),
  amount: z.number().optional(),
  uom: z.string().optional(),
  gstRate: z.number().optional(),
});

export const UpdateInvoiceParams = z.object({
  invoiceId: z.string().min(1),
});

export const UpdateInvoiceBody = z.object({
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  supplierGstin: z.string().nullable().optional(),
  placeOfSupply: z.string().nullable().optional(),
  taxableValue: z.union([z.string(), z.number()]).nullable().optional(),
  cgst: z.union([z.string(), z.number()]).nullable().optional(),
  sgst: z.union([z.string(), z.number()]).nullable().optional(),
  igst: z.union([z.string(), z.number()]).nullable().optional(),
  grandTotal: z.union([z.string(), z.number()]).nullable().optional(),
  items: z.array(invoiceItemSchema).optional(),
  remark: z.string().optional(),
});

export const DeleteInvoiceParams = z.object({
  invoiceId: z.string().min(1),
});

export const ExtractInvoiceParams = z.object({
  invoiceId: z.string().min(1),
});

export const MatchSupplierParams = z.object({
  invoiceId: z.string().min(1),
});

export const MatchSupplierBody = z.object({
  supplierId: z.string().nullable().optional(),
});

export const PushInvoiceToErpParams = z.object({
  invoiceId: z.string().min(1),
});

export const ApproveInvoiceParams = z.object({
  invoiceId: z.string().min(1),
});

export const ListSuppliersQueryParams = paginationQuery.extend({
  search: z.string().optional(),
  matched: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional(),
});

export const CreateSupplierBody = z.object({
  name: z.string().min(1),
  gstin: z.string().optional(),
  erpSupplierId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isMatched: z.boolean().optional(),
});

export const GetSupplierParams = z.object({
  supplierId: z.string().min(1),
});

export const UpdateSupplierParams = z.object({
  supplierId: z.string().min(1),
});

export const UpdateSupplierBody = CreateSupplierBody.partial();

export const DeleteSupplierParams = z.object({
  supplierId: z.string().min(1),
});

export const ListItemsQueryParams = paginationQuery.extend({
  search: z.string().optional(),
});

export const CreateItemBody = z.object({
  name: z.string().min(1),
  itemCode: z.string().optional(),
  erpItemCode: z.string().optional(),
  hsn: z.string().optional(),
  uom: z.string().optional(),
  gstRate: z.union([z.string(), z.number()]).optional(),
});

export const UpdateItemParams = z.object({
  itemId: z.string().min(1),
});

export const UpdateItemBody = CreateItemBody.partial();

export const DeleteItemParams = z.object({
  itemId: z.string().min(1),
});

export const ListGstr2bRecordsQueryParams = paginationQuery.extend({
  search: z.string().optional(),
  period: z.string().optional(),
});

export const ListReconciliationRecordsQueryParams = paginationQuery.extend({
  period: z.string().optional(),
  status: z
    .enum([
      "matched",
      "missing_in_erp",
      "missing_in_gstr2b",
      "amount_mismatch",
      "gst_mismatch",
      "duplicate",
    ])
    .optional(),
});

export const RunReconciliationBody = z.object({
  period: z.string().min(1),
});

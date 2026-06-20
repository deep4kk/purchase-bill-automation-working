import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiFetch, buildQueryString } from "./client";

export type { UseQueryResult };

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export type RegisterInputRole =
  | "admin"
  | "accounts"
  | "purchase_manager"
  | "auditor";

export type RoleUpdateRole = RegisterInputRole;

export type ListInvoicesStatus =
  | "pending"
  | "extracting"
  | "extracted"
  | "reviewing"
  | "approved"
  | "pushed"
  | "failed";

export type ListReconciliationRecordsStatus =
  | "matched"
  | "missing_in_erp"
  | "missing_in_gstr2b"
  | "amount_mismatch"
  | "gst_mismatch"
  | "duplicate";

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: string;
}

type QueryOptions<TData> = {
  query?: Partial<Omit<UseQueryOptions<TData, Error>, "queryKey" | "queryFn">>;
};

export { setAuthTokenGetter } from "./client";

// Auth
export function useRegister(
  options?: UseMutationOptions<
    { token: string; user: User },
    Error,
    { data: { name: string; email: string; password: string; role?: RegisterInputRole } }
  >,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    ...options,
  });
}

export function useLogin(
  options?: UseMutationOptions<
    { token: string; user: User },
    Error,
    { data: { email: string; password: string } }
  >,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    ...options,
  });
}

export function useForgotPassword(
  options?: UseMutationOptions<
    { message: string },
    Error,
    { data: { email: string } }
  >,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useResetPassword(
  options?: UseMutationOptions<
    { message: string },
    Error,
    { data: { token: string; password: string } }
  >,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function getListUsersQueryKey(params?: Record<string, unknown>) {
  return ["listUsers", params] as const;
}

export function useListUsers(
  params?: { page?: number; limit?: number },
  options?: QueryOptions<PaginatedResponse<User>>,
) {
  return useQuery({
    queryKey: getListUsersQueryKey(params),
    queryFn: () =>
      apiFetch<PaginatedResponse<User>>(`/auth/users${buildQueryString(params)}`),
    ...options?.query,
  });
}

export function useUpdateUserRole(
  options?: UseMutationOptions<
    User,
    Error,
    { userId: string; data: { role: RoleUpdateRole } }
  >,
) {
  return useMutation({
    mutationFn: ({ userId, data }) =>
      apiFetch(`/auth/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

// Dashboard
export function useGetDashboardStats(options?: QueryOptions<Record<string, number>>) {
  return useQuery({
    queryKey: ["dashboardStats"] as const,
    queryFn: () => apiFetch("/dashboard/stats"),
    ...options?.query,
  });
}

export function useGetRecentInvoices(
  params?: { limit?: number },
  options?: QueryOptions<unknown[]>,
) {
  return useQuery({
    queryKey: ["recentInvoices", params] as const,
    queryFn: () =>
      apiFetch(`/dashboard/recent-invoices${buildQueryString(params)}`),
    ...options?.query,
  });
}

export function useGetInvoiceTrend(options?: QueryOptions<Array<{ date: string; count: number; pushed: number }>>) {
  return useQuery({
    queryKey: ["invoiceTrend"] as const,
    queryFn: () => apiFetch("/dashboard/invoice-trend"),
    ...options?.query,
  });
}

export function useGetSupplierStats(options?: QueryOptions<Record<string, unknown>>) {
  return useQuery({
    queryKey: ["supplierStats"] as const,
    queryFn: () => apiFetch("/dashboard/supplier-stats"),
    ...options?.query,
  });
}

// Invoices
export function getListInvoicesQueryKey(params?: Record<string, unknown>) {
  return ["listInvoices", params] as const;
}

export function useListInvoices(
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ListInvoicesStatus;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  options?: QueryOptions<PaginatedResponse<Record<string, unknown>>>,
) {
  return useQuery({
    queryKey: getListInvoicesQueryKey(params),
    queryFn: () =>
      apiFetch(`/invoices${buildQueryString(params)}`),
    ...options?.query,
  });
}

export function getGetInvoiceQueryKey(invoiceId: string) {
  return ["getInvoice", invoiceId] as const;
}

export function useGetInvoice(
  invoiceId: string,
  options?: QueryOptions<Record<string, unknown>>,
) {
  return useQuery({
    queryKey: getGetInvoiceQueryKey(invoiceId),
    queryFn: () => apiFetch(`/invoices/${invoiceId}`),
    enabled: !!invoiceId,
    ...options?.query,
  });
}

export function useUpdateInvoice(
  options?: UseMutationOptions<
    Record<string, unknown>,
    Error,
    { invoiceId: string; data: Record<string, unknown> }
  >,
) {
  return useMutation({
    mutationFn: ({ invoiceId, data }) =>
      apiFetch(`/invoices/${invoiceId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

export function useExtractInvoice(
  options?: UseMutationOptions<Record<string, unknown>, Error, { invoiceId: string }>,
) {
  return useMutation({
    mutationFn: ({ invoiceId }) =>
      apiFetch(`/invoices/${invoiceId}/extract`, { method: "POST" }),
    ...options,
  });
}

export function useApproveInvoice(
  options?: UseMutationOptions<Record<string, unknown>, Error, { invoiceId: string }>,
) {
  return useMutation({
    mutationFn: ({ invoiceId }) =>
      apiFetch(`/invoices/${invoiceId}/approve`, { method: "POST" }),
    ...options,
  });
}

export function usePushInvoiceToErp(
  options?: UseMutationOptions<
    Record<string, unknown>,
    Error,
    { invoiceId: string }
  >,
) {
  return useMutation({
    mutationFn: ({ invoiceId }) =>
      apiFetch(`/invoices/${invoiceId}/push-to-erp`, { method: "POST" }),
    ...options,
  });
}

export function useMatchSupplier(
  options?: UseMutationOptions<
    Record<string, unknown>,
    Error,
    { invoiceId: string; data: { supplierId: string | null } }
  >,
) {
  return useMutation({
    mutationFn: ({ invoiceId, data }) =>
      apiFetch(`/invoices/${invoiceId}/match-supplier`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

// Suppliers
export function getListSuppliersQueryKey(params?: Record<string, unknown>) {
  return ["listSuppliers", params] as const;
}

export function useListSuppliers(
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    matched?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  options?: QueryOptions<PaginatedResponse<Record<string, unknown>>>,
) {
  return useQuery({
    queryKey: getListSuppliersQueryKey(params),
    queryFn: () =>
      apiFetch(`/suppliers${buildQueryString(params)}`),
    ...options?.query,
  });
}

// Items
export function useListItems(
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  options?: QueryOptions<PaginatedResponse<Record<string, unknown>>>,
) {
  return useQuery({
    queryKey: ["listItems", params] as const,
    queryFn: () => apiFetch(`/items${buildQueryString(params)}`),
    ...options?.query,
  });
}

// Audit logs
export function useListAuditLogs(
  params?: {
    page?: number;
    limit?: number;
    action?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  options?: QueryOptions<PaginatedResponse<Record<string, unknown>>>,
) {
  return useQuery({
    queryKey: ["listAuditLogs", params] as const,
    queryFn: () => apiFetch(`/audit-logs${buildQueryString(params)}`),
    ...options?.query,
  });
}

// GSTR-2B
export function getListGstr2bRecordsQueryKey(params?: Record<string, unknown>) {
  return ["listGstr2bRecords", params] as const;
}

export function useListGstr2bRecords(
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    period?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  options?: QueryOptions<PaginatedResponse<Record<string, unknown>>>,
) {
  return useQuery({
    queryKey: getListGstr2bRecordsQueryKey(params),
    queryFn: () => apiFetch(`/gstr2b${buildQueryString(params)}`),
    ...options?.query,
  });
}

export function useListGstr2bPeriods(options?: QueryOptions<string[]>) {
  return useQuery({
    queryKey: ["listGstr2bPeriods"] as const,
    queryFn: () => apiFetch("/gstr2b/periods"),
    ...options?.query,
  });
}

// Reconciliation
export function getListReconciliationRecordsQueryKey(params?: Record<string, unknown>) {
  return ["listReconciliationRecords", params] as const;
}

export function useListReconciliationRecords(
  params?: {
    page?: number;
    limit?: number;
    period?: string;
    status?: ListReconciliationRecordsStatus;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  options?: QueryOptions<PaginatedResponse<Record<string, unknown>>>,
) {
  return useQuery({
    queryKey: getListReconciliationRecordsQueryKey(params),
    queryFn: () =>
      apiFetch(`/reconciliation${buildQueryString(params)}`),
    ...options?.query,
  });
}

export function getGetReconciliationSummaryQueryKey(params?: Record<string, unknown>) {
  return ["getReconciliationSummary", params] as const;
}

export function useGetReconciliationSummary(
  params?: { period?: string },
  options?: QueryOptions<Record<string, unknown>>,
) {
  return useQuery({
    queryKey: getGetReconciliationSummaryQueryKey(params),
    queryFn: () =>
      apiFetch(`/reconciliation/summary${buildQueryString(params)}`),
    ...options?.query,
  });
}

export function useRunReconciliation(
  options?: UseMutationOptions<
    Record<string, unknown>,
    Error,
    { data: { period: string } }
  >,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/reconciliation/run", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...options,
  });
}

// ERP settings
export function useGetErpSettings(options?: QueryOptions<Record<string, unknown>>) {
  return useQuery({
    queryKey: ["erpSettings"] as const,
    queryFn: () => apiFetch("/erp/settings"),
    ...options?.query,
  });
}

export function useUpdateErpSettings(
  options?: UseMutationOptions<
    Record<string, unknown>,
    Error,
    { data: { erpUrl: string; apiKey: string; apiSecret: string } }
  >,
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch("/erp/settings", { method: "PUT", body: JSON.stringify(data) }),
    ...options,
  });
}

export function useTestErpConnection(
  options?: UseMutationOptions<
    { success: boolean; message: string; version: string | null },
    Error,
    void
  >,
) {
  return useMutation({
    mutationFn: () => apiFetch("/erp/test-connection", { method: "POST" }),
    ...options,
  });
}

export function useSyncErpSuppliers(
  options?: UseMutationOptions<
    { success: boolean; synced: number; message: string },
    Error,
    void
  >,
) {
  return useMutation({
    mutationFn: () => apiFetch("/erp/sync/suppliers", { method: "POST" }),
    ...options,
  });
}

export function useSyncErpItems(
  options?: UseMutationOptions<
    { success: boolean; synced: number; message: string },
    Error,
    void
  >,
) {
  return useMutation({
    mutationFn: () => apiFetch("/erp/sync/items", { method: "POST" }),
    ...options,
  });
}

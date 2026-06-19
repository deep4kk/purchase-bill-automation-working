import { Router } from "express";
import { authenticate } from "../lib/auth";
import { logAudit } from "../lib/audit";
import {
  ListSuppliersQueryParams,
  CreateSupplierBody,
  GetSupplierParams,
  UpdateSupplierParams,
  UpdateSupplierBody,
  DeleteSupplierParams,
} from "@workspace/api-zod";
import {
  findSuppliers,
  findSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../lib/dal";
import { Supplier } from "../lib/schemas";

const router = Router();

function formatSupplier(s: Supplier & { _id: { toHexString: () => string } }) {
  return {
    id: s._id.toHexString(),
    name: s.name,
    gstin: s.gstin ?? null,
    erpSupplierId: s.erpSupplierId ?? null,
    address: s.address ?? null,
    phone: s.phone ?? null,
    email: s.email ?? null,
    isMatched: s.isMatched,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/suppliers", authenticate, async (req, res): Promise<void> => {
  const params = ListSuppliersQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const search = params.success ? params.data.search : undefined;
  const matched = params.success ? params.data.matched : undefined;
  const sortBy = params.success ? params.data.sortBy : undefined;
  const sortOrder = params.success ? params.data.sortOrder : undefined;

  const filter: Record<string, unknown> = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (matched !== undefined) filter.isMatched = matched;

  const result = await findSuppliers(filter, { page, limit, sortBy, sortOrder });
  res.json({ data: result.data.map(formatSupplier), total: result.total, page, limit, sortBy: result.sortBy, sortOrder: result.sortOrder });
});

router.post("/suppliers", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const supplier = await createSupplier({ ...parsed.data, isMatched: parsed.data.isMatched ?? false });
  await logAudit(req, "supplier_created", "supplier", supplier._id.toHexString());
  res.status(201).json(formatSupplier(supplier));
});

router.get("/suppliers/:supplierId", authenticate, async (req, res): Promise<void> => {
  const supplierId = req.params.supplierId;
  const supplier = await findSupplierById(supplierId);
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(formatSupplier(supplier));
});

router.put("/suppliers/:supplierId", authenticate, async (req, res): Promise<void> => {
  const supplierId = req.params.supplierId;
  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const supplier = await updateSupplier(supplierId, parsed.data);
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  await logAudit(req, "supplier_updated", "supplier", supplierId);
  res.json(formatSupplier(supplier));
});

router.delete("/suppliers/:supplierId", authenticate, async (req, res): Promise<void> => {
  const supplierId = req.params.supplierId;
  const deleted = await deleteSupplier(supplierId);
  if (!deleted) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  await logAudit(req, "supplier_deleted", "supplier", supplierId);
  res.json({ message: "Supplier deleted" });
});

export default router;

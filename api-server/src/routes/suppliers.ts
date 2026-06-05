import { Router } from "express";
import { db, suppliersTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
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

const router = Router();

function formatSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    id: String(s.id),
    name: s.name,
    gstin: s.gstin ?? null,
    erpSupplierId: s.erpSupplierId ?? null,
    address: s.address ?? null,
    phone: s.phone ?? null,
    email: s.email ?? null,
    isMatched: s.isMatched,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/suppliers", authenticate, async (req, res): Promise<void> => {
  const params = ListSuppliersQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const search = params.success ? params.data.search : undefined;
  const matched = params.success ? params.data.matched : undefined;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) conditions.push(ilike(suppliersTable.name, `%${search}%`));
  if (matched !== undefined) conditions.push(eq(suppliersTable.isMatched, matched));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(suppliersTable).where(where).limit(limit).offset(offset).orderBy(suppliersTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(suppliersTable).where(where);

  res.json({ data: rows.map(formatSupplier), total: Number(count), page, limit });
});

router.post("/suppliers", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.insert(suppliersTable).values(parsed.data).returning();
  await logAudit(req, "supplier_created", "supplier", String(supplier.id));
  res.status(201).json(formatSupplier(supplier));
});

router.get("/suppliers/:supplierId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.supplierId) ? req.params.supplierId[0] : req.params.supplierId;
  const id = parseInt(rawId, 10);
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(formatSupplier(supplier));
});

router.put("/suppliers/:supplierId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.supplierId) ? req.params.supplierId[0] : req.params.supplierId;
  const id = parseInt(rawId, 10);
  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.update(suppliersTable).set(parsed.data).where(eq(suppliersTable.id, id)).returning();
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  await logAudit(req, "supplier_updated", "supplier", String(id));
  res.json(formatSupplier(supplier));
});

router.delete("/suppliers/:supplierId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.supplierId) ? req.params.supplierId[0] : req.params.supplierId;
  const id = parseInt(rawId, 10);
  const [deleted] = await db.delete(suppliersTable).where(eq(suppliersTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  await logAudit(req, "supplier_deleted", "supplier", String(id));
  res.json({ message: "Supplier deleted" });
});

export default router;

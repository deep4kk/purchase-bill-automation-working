import { Router } from "express";
import { db, itemsTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { logAudit } from "../lib/audit";
import {
  ListItemsQueryParams,
  CreateItemBody,
  UpdateItemParams,
  UpdateItemBody,
  DeleteItemParams,
} from "@workspace/api-zod";

const router = Router();

function formatItem(i: typeof itemsTable.$inferSelect) {
  return {
    id: String(i.id),
    name: i.name,
    itemCode: i.itemCode ?? null,
    erpItemCode: i.erpItemCode ?? null,
    hsn: i.hsn ?? null,
    uom: i.uom ?? null,
    gstRate: i.gstRate !== null ? Number(i.gstRate) : null,
    createdAt: i.createdAt.toISOString(),
  };
}

router.get("/items", authenticate, async (req, res): Promise<void> => {
  const params = ListItemsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const search = params.success ? params.data.search : undefined;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) conditions.push(ilike(itemsTable.name, `%${search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(itemsTable).where(where).limit(limit).offset(offset).orderBy(itemsTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(itemsTable).where(where);

  res.json({ data: rows.map(formatItem), total: Number(count), page, limit });
});

router.post("/items", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(itemsTable).values(parsed.data).returning();
  await logAudit(req, "item_created", "item", String(item.id));
  res.status(201).json(formatItem(item));
});

router.put("/items/:itemId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
  const id = parseInt(rawId, 10);
  const parsed = UpdateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.update(itemsTable).set(parsed.data).where(eq(itemsTable.id, id)).returning();
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  await logAudit(req, "item_updated", "item", String(id));
  res.json(formatItem(item));
});

router.delete("/items/:itemId", authenticate, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
  const id = parseInt(rawId, 10);
  const [deleted] = await db.delete(itemsTable).where(eq(itemsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  await logAudit(req, "item_deleted", "item", String(id));
  res.json({ message: "Item deleted" });
});

export default router;

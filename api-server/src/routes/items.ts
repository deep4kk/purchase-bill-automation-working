import { Router } from "express";
import { authenticate } from "../lib/auth";
import { logAudit } from "../lib/audit";
import {
  ListItemsQueryParams,
  CreateItemBody,
  UpdateItemParams,
  UpdateItemBody,
  DeleteItemParams,
} from "@workspace/api-zod";
import {
  findItems,
  findItemById,
  createItem,
  updateItem,
  deleteItem,
} from "../lib/dal";
import { Item } from "../lib/schemas";

const router = Router();

function formatItem(i: Item & { _id: { toHexString: () => string } }) {
  return {
    id: i._id.toHexString(),
    name: i.name,
    itemCode: i.itemCode ?? null,
    erpItemCode: i.erpItemCode ?? null,
    hsn: i.hsn ?? null,
    uom: i.uom ?? null,
    gstRate: i.gstRate != null ? Number(i.gstRate) : null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

router.get("/items", authenticate, async (req, res): Promise<void> => {
  const params = ListItemsQueryParams.safeParse(req.query);
  const page = params.success ? (params.data.page ?? 1) : 1;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const search = params.success ? params.data.search : undefined;
  const sortBy = params.success ? params.data.sortBy : undefined;
  const sortOrder = params.success ? params.data.sortOrder : undefined;

  const filter: Record<string, unknown> = {};
  if (search) filter.name = { $regex: search, $options: "i" };

  const result = await findItems(filter, { page, limit, sortBy, sortOrder });
  res.json({ data: result.data.map(formatItem), total: result.total, page, limit, sortBy: result.sortBy, sortOrder: result.sortOrder });
});

router.post("/items", authenticate, async (req, res): Promise<void> => {
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const item = await createItem(parsed.data);
  await logAudit(req, "item_created", "item", item._id.toHexString());
  res.status(201).json(formatItem(item));
});

router.put("/items/:itemId", authenticate, async (req, res): Promise<void> => {
  const itemId = req.params.itemId;
  const parsed = UpdateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const item = await updateItem(itemId, parsed.data);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  await logAudit(req, "item_updated", "item", itemId);
  res.json(formatItem(item));
});

router.delete("/items/:itemId", authenticate, async (req, res): Promise<void> => {
  const itemId = req.params.itemId;
  const deleted = await deleteItem(itemId);
  if (!deleted) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  await logAudit(req, "item_deleted", "item", itemId);
  res.json({ message: "Item deleted" });
});

export default router;

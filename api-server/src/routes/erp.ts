import { Router } from "express";
import { db, erpConnectionsTable, suppliersTable, itemsTable } from "@workspace/db";
import { authenticate, requireRole } from "../lib/auth";
import { UpdateErpSettingsBody } from "@workspace/api-zod";

const router = Router();

async function getErpConnection() {
  const [conn] = await db.select().from(erpConnectionsTable).limit(1);
  return conn;
}

function formatSettings(c: typeof erpConnectionsTable.$inferSelect) {
  return {
    id: String(c.id),
    erpUrl: c.erpUrl,
    apiKey: c.apiKey,
    isConnected: c.isConnected,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
  };
}

router.get("/erp/settings", authenticate, async (_req, res): Promise<void> => {
  const conn = await getErpConnection();
  if (!conn) {
    res.json({ id: "0", erpUrl: "", apiKey: "", isConnected: false, lastSyncedAt: null });
    return;
  }
  res.json(formatSettings(conn));
});

router.put("/erp/settings", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = UpdateErpSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { erpUrl, apiKey, apiSecret } = parsed.data;
  const existing = await getErpConnection();
  let conn;
  if (existing) {
    [conn] = await db.update(erpConnectionsTable).set({ erpUrl, apiKey, apiSecret }).where((t) => t.id.equals(existing.id)).returning();
  } else {
    [conn] = await db.insert(erpConnectionsTable).values({ erpUrl, apiKey, apiSecret, isConnected: false }).returning();
  }
  res.json(formatSettings(conn));
});

router.post("/erp/test-connection", authenticate, async (_req, res): Promise<void> => {
  const conn = await getErpConnection();
  if (!conn) {
    res.json({ success: false, message: "ERP settings not configured", version: null });
    return;
  }
  try {
    const response = await fetch(`${conn.erpUrl}/api/method/version`, {
      headers: { Authorization: `token ${conn.apiKey}:${conn.apiSecret}` },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json() as { message?: string };
      await db.update(erpConnectionsTable).set({ isConnected: true }).where((t) => t.id.equals(conn.id));
      res.json({ success: true, message: "Connection successful", version: data.message ?? null });
    } else {
      res.json({ success: false, message: `Connection failed: HTTP ${response.status}`, version: null });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.json({ success: false, message: `Connection failed: ${msg}`, version: null });
  }
});

router.post("/erp/sync/suppliers", authenticate, requireRole("admin", "accounts"), async (req, res): Promise<void> => {
  const conn = await getErpConnection();
  if (!conn?.isConnected) {
    res.json({ success: false, synced: 0, message: "ERP not connected" });
    return;
  }
  try {
    const response = await fetch(
      `${conn.erpUrl}/api/resource/Supplier?fields=["name","supplier_name","gstin"]&limit_page_length=500`,
      { headers: { Authorization: `token ${conn.apiKey}:${conn.apiSecret}` } },
    );
    if (!response.ok) {
      res.json({ success: false, synced: 0, message: `ERP error: ${response.status}` });
      return;
    }
    const data = await response.json() as { data: Array<{ name: string; supplier_name: string; gstin?: string }> };
    let synced = 0;
    for (const s of data.data ?? []) {
      await db.insert(suppliersTable).values({
        name: s.supplier_name || s.name,
        gstin: s.gstin ?? null,
        erpSupplierId: s.name,
        isMatched: true,
      }).onConflictDoUpdate({ target: suppliersTable.erpSupplierId, set: { name: s.supplier_name || s.name, gstin: s.gstin ?? null, isMatched: true } }).catch(() => null);
      synced++;
    }
    await db.update(erpConnectionsTable).set({ lastSyncedAt: new Date() }).where((t) => t.id.equals(conn.id));
    res.json({ success: true, synced, message: `Synced ${synced} suppliers` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.json({ success: false, synced: 0, message: msg });
  }
});

router.post("/erp/sync/items", authenticate, requireRole("admin", "accounts"), async (req, res): Promise<void> => {
  const conn = await getErpConnection();
  if (!conn?.isConnected) {
    res.json({ success: false, synced: 0, message: "ERP not connected" });
    return;
  }
  try {
    const response = await fetch(
      `${conn.erpUrl}/api/resource/Item?fields=["name","item_name","item_code","gst_hsn_code","stock_uom"]&limit_page_length=500`,
      { headers: { Authorization: `token ${conn.apiKey}:${conn.apiSecret}` } },
    );
    if (!response.ok) {
      res.json({ success: false, synced: 0, message: `ERP error: ${response.status}` });
      return;
    }
    const data = await response.json() as { data: Array<{ name: string; item_name: string; item_code?: string; gst_hsn_code?: string; stock_uom?: string }> };
    let synced = 0;
    for (const item of data.data ?? []) {
      await db.insert(itemsTable).values({
        name: item.item_name || item.name,
        itemCode: item.item_code ?? null,
        erpItemCode: item.name,
        hsn: item.gst_hsn_code ?? null,
        uom: item.stock_uom ?? null,
      }).onConflictDoNothing().catch(() => null);
      synced++;
    }
    res.json({ success: true, synced, message: `Synced ${synced} items` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.json({ success: false, synced: 0, message: msg });
  }
});

router.post("/erp/sync/companies", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  res.json({ success: true, synced: 0, message: "Company sync not yet implemented — connect ERPNext first" });
});

export default router;

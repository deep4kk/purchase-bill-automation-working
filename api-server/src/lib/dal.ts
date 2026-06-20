import { ObjectId, Filter, Sort, Collection } from "mongodb";
import { getDb } from "./mongodb";
import {
  User,
  Invoice,
  Supplier,
  Item,
  Gstr2bRecord,
  ReconciliationRecord,
  ErpConnection,
  AuditLog,
  COLLECTIONS,
} from "./schemas";

export { getDb } from "./mongodb";
export { COLLECTIONS } from "./schemas";

// Helper to convert string ID to ObjectId
export function toObjectId(id: string | number): ObjectId {
  return new ObjectId(id);
}

// Helper to convert ObjectId to string
export function toStringId(doc: { _id: ObjectId }): string {
  return doc._id.toHexString();
}

// Pagination helper
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function getPaginationSort(options: PaginationOptions): Sort | undefined {
  const sortBy = options.sortBy || "updatedAt";
  const sortOrder = options.sortOrder || "desc";
  return { [sortBy]: sortOrder === "asc" ? 1 : -1 };
}

async function paginate<T>(
  collection: Collection<T>,
  filter: Filter<T> = {},
  options: PaginationOptions = {}
): Promise<PaginatedResult<T & { _id: ObjectId }>> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const skip = (page - 1) * limit;
  const sort = getPaginationSort(options);

  const [data, total] = await Promise.all([
    collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return { data, total, page, limit, sortBy: options.sortBy, sortOrder: options.sortOrder };
}

// ================== USER DAL ==================

export async function findUsers(options: PaginationOptions = {}): Promise<PaginatedResult<User & { _id: ObjectId }>> {
  const db = getDb();
  return paginate(db.collection<User>(COLLECTIONS.USERS), {}, { ...options, sortBy: options.sortBy || "createdAt" });
}

export async function findUserById(id: string | number): Promise<(User & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<User>(COLLECTIONS.USERS).findOne({ _id: toObjectId(id) });
}

export async function findUserByEmail(email: string): Promise<(User & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<User>(COLLECTIONS.USERS).findOne({ email });
}

export async function findUserByResetToken(token: string): Promise<(User & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<User>(COLLECTIONS.USERS).findOne({ resetToken: token });
}

export async function createUser(user: Omit<User, "_id" | "createdAt" | "updatedAt">): Promise<User & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<User>(COLLECTIONS.USERS).insertOne({
    ...user,
    createdAt: now,
    updatedAt: now,
  });
  return { ...user, _id: result.insertedId, createdAt: now, updatedAt: now };
}

export async function updateUser(id: string | number, updates: Partial<User>): Promise<(User & { _id: ObjectId }) | null> {
  const db = getDb();
  const result = await db.collection<User>(COLLECTIONS.USERS).findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result;
}

// ================== INVOICE DAL ==================

export async function findInvoices(
  filter: Filter<Invoice> = {},
  options: PaginationOptions = {}
): Promise<PaginatedResult<Invoice & { _id: ObjectId }>> {
  const db = getDb();
  return paginate(db.collection<Invoice>(COLLECTIONS.INVOICES), filter, { ...options, sortBy: options.sortBy || "updatedAt" });
}

export async function findInvoiceById(id: string | number): Promise<(Invoice & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<Invoice>(COLLECTIONS.INVOICES).findOne({ _id: toObjectId(id) });
}

export async function createInvoice(invoice: Omit<Invoice, "_id" | "createdAt" | "updatedAt">): Promise<Invoice & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<Invoice>(COLLECTIONS.INVOICES).insertOne({
    ...invoice,
    createdAt: now,
    updatedAt: now,
  });
  return { ...invoice, _id: result.insertedId, createdAt: now, updatedAt: now };
}

export async function updateInvoice(
  id: string | number,
  updates: Partial<Invoice>
): Promise<(Invoice & { _id: ObjectId }) | null> {
  const db = getDb();
  const result = await db.collection<Invoice>(COLLECTIONS.INVOICES).findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result;
}

export async function deleteInvoice(id: string | number): Promise<(Invoice & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<Invoice>(COLLECTIONS.INVOICES).findOneAndDelete({ _id: toObjectId(id) });
}

// ================== SUPPLIER DAL ==================

export async function findSuppliers(
  filter: Filter<Supplier> = {},
  options: PaginationOptions = {}
): Promise<PaginatedResult<Supplier & { _id: ObjectId }>> {
  const db = getDb();
  return paginate(db.collection<Supplier>(COLLECTIONS.SUPPLIERS), filter, { ...options, sortBy: options.sortBy || "updatedAt" });
}

export async function findSupplierById(id: string | number): Promise<(Supplier & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<Supplier>(COLLECTIONS.SUPPLIERS).findOne({ _id: toObjectId(id) });
}

export async function findSupplierByErpId(erpSupplierId: string): Promise<(Supplier & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<Supplier>(COLLECTIONS.SUPPLIERS).findOne({ erpSupplierId });
}

export async function createSupplier(supplier: Omit<Supplier, "_id" | "createdAt" | "updatedAt">): Promise<Supplier & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<Supplier>(COLLECTIONS.SUPPLIERS).insertOne({
    ...supplier,
    createdAt: now,
    updatedAt: now,
  });
  return { ...supplier, _id: result.insertedId, createdAt: now, updatedAt: now };
}

export async function updateSupplier(
  id: string | number,
  updates: Partial<Supplier>
): Promise<(Supplier & { _id: ObjectId }) | null> {
  const db = getDb();
  const result = await db.collection<Supplier>(COLLECTIONS.SUPPLIERS).findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result;
}

export async function deleteSupplier(id: string | number): Promise<(Supplier & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<Supplier>(COLLECTIONS.SUPPLIERS).findOneAndDelete({ _id: toObjectId(id) });
}

export async function upsertSupplierByErpId(
  erpSupplierId: string,
  supplier: Omit<Supplier, "_id" | "createdAt" | "updatedAt" | "erpSupplierId">
): Promise<Supplier & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<Supplier>(COLLECTIONS.SUPPLIERS).findOneAndUpdate(
    { erpSupplierId },
    {
      $set: { ...supplier, erpSupplierId, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );
  return result!;
}

// ================== ITEM DAL ==================

export async function findItems(
  filter: Filter<Item> = {},
  options: PaginationOptions = {}
): Promise<PaginatedResult<Item & { _id: ObjectId }>> {
  const db = getDb();
  return paginate(db.collection<Item>(COLLECTIONS.ITEMS), filter, { ...options, sortBy: options.sortBy || "updatedAt" });
}

export async function findItemById(id: string | number): Promise<(Item & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<Item>(COLLECTIONS.ITEMS).findOne({ _id: toObjectId(id) });
}

export async function createItem(item: Omit<Item, "_id" | "createdAt" | "updatedAt">): Promise<Item & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<Item>(COLLECTIONS.ITEMS).insertOne({
    ...item,
    createdAt: now,
    updatedAt: now,
  });
  return { ...item, _id: result.insertedId, createdAt: now, updatedAt: now };
}

export async function updateItem(
  id: string | number,
  updates: Partial<Item>
): Promise<(Item & { _id: ObjectId }) | null> {
  const db = getDb();
  const result = await db.collection<Item>(COLLECTIONS.ITEMS).findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result;
}

export async function deleteItem(id: string | number): Promise<(Item & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<Item>(COLLECTIONS.ITEMS).findOneAndDelete({ _id: toObjectId(id) });
}

export async function upsertItemByErpId(
  erpItemCode: string,
  item: Omit<Item, "_id" | "createdAt" | "updatedAt" | "erpItemCode">
): Promise<Item & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<Item>(COLLECTIONS.ITEMS).findOneAndUpdate(
    { erpItemCode },
    {
      $set: { ...item, erpItemCode, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );
  return result!;
}

// ================== GSTR2B RECORD DAL ==================

export async function findGstr2bRecords(
  filter: Filter<Gstr2bRecord> = {},
  options: PaginationOptions = {}
): Promise<PaginatedResult<Gstr2bRecord & { _id: ObjectId }>> {
  const db = getDb();
  return paginate(db.collection<Gstr2bRecord>(COLLECTIONS.GSTR2B_RECORDS), filter, { ...options, sortBy: options.sortBy || "updatedAt" });
}

export async function getDistinctPeriods(): Promise<string[]> {
  const db = getDb();
  const periods = await db.collection<Gstr2bRecord>(COLLECTIONS.GSTR2B_RECORDS)
    .distinct("period");
  return periods.sort();
}

export async function createGstr2bRecord(record: Omit<Gstr2bRecord, "_id" | "createdAt" | "updatedAt">): Promise<Gstr2bRecord & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<Gstr2bRecord>(COLLECTIONS.GSTR2B_RECORDS).insertOne({
    ...record,
    createdAt: now,
    updatedAt: now,
  });
  return { ...record, _id: result.insertedId, createdAt: now, updatedAt: now };
}

export async function createGstr2bRecords(records: Array<Omit<Gstr2bRecord, "_id" | "createdAt" | "updatedAt">>): Promise<number> {
  if (records.length === 0) return 0;
  const db = getDb();
  const now = new Date();
  const docs = records.map(r => ({ ...r, createdAt: now, updatedAt: now }));
  const result = await db.collection<Gstr2bRecord>(COLLECTIONS.GSTR2B_RECORDS).insertMany(docs, { ordered: false });
  return result.insertedCount;
}

export async function findGstr2bByPeriod(period: string): Promise<Array<Gstr2bRecord & { _id: ObjectId }>> {
  const db = getDb();
  return db.collection<Gstr2bRecord>(COLLECTIONS.GSTR2B_RECORDS).find({ period }).toArray();
}

// ================== RECONCILIATION RECORD DAL ==================

export async function findReconciliationRecords(
  filter: Filter<ReconciliationRecord> = {},
  options: PaginationOptions = {}
): Promise<PaginatedResult<ReconciliationRecord & { _id: ObjectId }>> {
  const db = getDb();
  return paginate(db.collection<ReconciliationRecord>(COLLECTIONS.RECONCILIATION_RECORDS), filter, { ...options, sortBy: options.sortBy || "updatedAt" });
}

export async function deleteReconciliationByPeriod(period: string): Promise<number> {
  const db = getDb();
  const result = await db.collection<ReconciliationRecord>(COLLECTIONS.RECONCILIATION_RECORDS).deleteMany({ period });
  return result.deletedCount;
}

export async function findReconciliationByPeriod(period: string): Promise<Array<ReconciliationRecord & { _id: ObjectId }>> {
  const db = getDb();
  return db.collection<ReconciliationRecord>(COLLECTIONS.RECONCILIATION_RECORDS).find({ period }).toArray();
}

export async function createReconciliationRecord(record: Omit<ReconciliationRecord, "_id" | "createdAt" | "updatedAt">): Promise<ReconciliationRecord & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<ReconciliationRecord>(COLLECTIONS.RECONCILIATION_RECORDS).insertOne({
    ...record,
    createdAt: now,
    updatedAt: now,
  });
  return { ...record, _id: result.insertedId, createdAt: now, updatedAt: now };
}

export async function createReconciliationRecords(records: Array<Omit<ReconciliationRecord, "_id" | "createdAt" | "updatedAt">>): Promise<number> {
  if (records.length === 0) return 0;
  const db = getDb();
  const now = new Date();
  const docs = records.map(r => ({ ...r, createdAt: now, updatedAt: now }));
  const result = await db.collection<ReconciliationRecord>(COLLECTIONS.RECONCILIATION_RECORDS).insertMany(docs, { ordered: false });
  return result.insertedCount;
}

// ================== ERP CONNECTION DAL ==================

export async function getErpConnection(): Promise<(ErpConnection & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<ErpConnection>(COLLECTIONS.ERP_CONNECTIONS).findOne({});
}

export async function createOrUpdateErpConnection(settings: Omit<ErpConnection, "_id" | "createdAt" | "updatedAt" | "isConnected">): Promise<ErpConnection & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<ErpConnection>(COLLECTIONS.ERP_CONNECTIONS).findOneAndUpdate(
    {},
    {
      $set: { ...settings, updatedAt: now },
      $setOnInsert: { createdAt: now, isConnected: false },
    },
    { upsert: true, returnDocument: "after" }
  );
  return result!;
}

export async function updateErpConnection(updates: Partial<ErpConnection>): Promise<(ErpConnection & { _id: ObjectId }) | null> {
  const db = getDb();
  return db.collection<ErpConnection>(COLLECTIONS.ERP_CONNECTIONS).findOneAndUpdate(
    {},
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
}

// ================== AUDIT LOG DAL ==================

export async function findAuditLogs(
  filter: Filter<AuditLog> = {},
  options: PaginationOptions = {}
): Promise<PaginatedResult<AuditLog & { _id: ObjectId }>> {
  const db = getDb();
  return paginate(db.collection<AuditLog>(COLLECTIONS.AUDIT_LOGS), filter, { ...options, sortBy: options.sortBy || "createdAt" });
}

export async function createAuditLog(log: Omit<AuditLog, "_id" | "createdAt" | "updatedAt">): Promise<AuditLog & { _id: ObjectId }> {
  const db = getDb();
  const now = new Date();
  const result = await db.collection<AuditLog>(COLLECTIONS.AUDIT_LOGS).insertOne({
    ...log,
    createdAt: now,
    updatedAt: now,
  });
  return { ...log, _id: result.insertedId, createdAt: now, updatedAt: now };
}
import { MongoClient, Db } from "mongodb";
import { COLLECTIONS } from "./schemas";
import { logger } from "./logger";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB ?? "purchase_bill_automation";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToMongoDB(): Promise<Db> {
  if (db) return db;
  
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  
  // Test connection
  await db.command({ ping: 1 });
  console.log("Connected to MongoDB successfully");
  
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectToMongoDB() first.");
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error("MongoDB client not initialized. Call connectToMongoDB() first.");
  }
  return client;
}

export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export async function createIndexes(): Promise<void> {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectToMongoDB() first.");
  }

  // Users indexes
  await db.collection(COLLECTIONS.USERS).createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { resetToken: 1 }, sparse: true },
  ]);

  // Invoices indexes
  await db.collection(COLLECTIONS.INVOICES).createIndexes([
    { key: { updatedAt: -1 } },
    { key: { status: 1 } },
    { key: { supplierName: 1 } },
    { key: { matchedSupplierId: 1 } },
    { key: { invoiceDate: 1 } },
  ]);

  // Suppliers indexes
  await db.collection(COLLECTIONS.SUPPLIERS).createIndexes([
    { key: { updatedAt: -1 } },
    { key: { name: "text" } },
    { key: { erpSupplierId: 1 }, unique: true, sparse: true },
    { key: { gstin: 1 }, sparse: true },
  ]);

  // Items indexes
  await db.collection(COLLECTIONS.ITEMS).createIndexes([
    { key: { updatedAt: -1 } },
    { key: { name: "text" } },
    { key: { erpItemCode: 1 }, unique: true, sparse: true },
  ]);

  // GSTR2B records indexes
  await db.collection(COLLECTIONS.GSTR2B_RECORDS).createIndexes([
    { key: { period: 1 } },
    { key: { supplierName: "text" } },
    { key: { supplierGstin: 1, invoiceNumber: 1 } },
  ]);

  // Idempotency: same supplier+invoice+period should only exist once.
  // If the collection already has duplicates, skip with a warning rather
  // than crash startup. New uploads use upserts, so duplicates stop appearing.
  try {
    await db.collection(COLLECTIONS.GSTR2B_RECORDS).createIndex(
      { period: 1, supplierGstin: 1, invoiceNumber: 1 },
      { unique: true, name: "uniq_period_gstin_invoiceno" },
    );
  } catch (err) {
    logger.warn(
      { err },
      "Could not create unique index on gstr2b_records — collection may contain duplicates. New imports will still upsert by the same key.",
    );
  }

  // Reconciliation records indexes
  await db.collection(COLLECTIONS.RECONCILIATION_RECORDS).createIndexes([
    { key: { period: 1 } },
    { key: { status: 1 } },
  ]);

  // Audit logs indexes
  await db.collection(COLLECTIONS.AUDIT_LOGS).createIndexes([
    { key: { createdAt: -1 } },
    { key: { action: 1 } },
    { key: { userId: 1 } },
    { key: { resourceType: 1 } },
  ]);

  console.log("MongoDB indexes created successfully");
}
import { MongoClient, type Db } from 'mongodb';
import type { SmartLibStore } from './store.js';

const STATE_COLLECTION = 'smartlib_state';
const STATE_DOC_ID = 'primary';

declare global {
  // eslint-disable-next-line no-var
  var __smartlibMongoClientPromise: Promise<MongoClient> | undefined;
}

let mongoConnected = false;
let lastMongoError: string | null = null;

export function getMongoUri(): string | null {
  const raw = (process.env.MONGODB_URI || '').trim();
  if (!raw) return null;
  if (!raw.startsWith('mongodb://') && !raw.startsWith('mongodb+srv://')) return null;
  if (raw.includes('<db_password>') || raw.includes('<password>') || raw.includes('<username>')) {
    return null;
  }
  return raw;
}

export function getMongoDatabaseName(): string {
  const configured = (process.env.MONGODB_DATABASE || '').trim();
  if (configured) return configured;
  const uri = getMongoUri();
  if (uri) {
    try {
      const url = new URL(uri);
      const dbFromPath = url.pathname.replace(/^\/+/, '').trim();
      if (dbFromPath) return dbFromPath;
    } catch {
      // Fallback to default database name
    }
  }
  return 'smartlib';
}

export function isMongoConfigured(): boolean {
  return getMongoUri() !== null;
}

export function getMongoStatus(): {
  configured: boolean;
  connected: boolean;
  database: string;
  lastError: string | null;
} {
  return {
    configured: isMongoConfigured(),
    connected: mongoConnected,
    database: getMongoDatabaseName(),
    lastError: lastMongoError,
  };
}

async function getMongoDb(): Promise<Db | null> {
  const uri = getMongoUri();
  if (!uri) return null;

  try {
    if (!globalThis.__smartlibMongoClientPromise) {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        maxPoolSize: 10,
      });
      globalThis.__smartlibMongoClientPromise = client.connect();
    }
    const client = await globalThis.__smartlibMongoClientPromise;
    mongoConnected = true;
    lastMongoError = null;
    return client.db(getMongoDatabaseName());
  } catch (err) {
    mongoConnected = false;
    lastMongoError = err instanceof Error ? err.message : 'MongoDB connection failed';
    globalThis.__smartlibMongoClientPromise = undefined;
    console.error('[SMARTLIB MongoDB] Connection error:', lastMongoError);
    return null;
  }
}

export async function loadStateFromMongo(): Promise<SmartLibStore | null> {
  const db = await getMongoDb();
  if (!db) return null;

  try {
    const doc = await db
      .collection<{ _id: string; payload: SmartLibStore; updatedAt: string }>(STATE_COLLECTION)
      .findOne({ _id: STATE_DOC_ID });
    return doc?.payload ?? null;
  } catch (err) {
    lastMongoError = err instanceof Error ? err.message : 'Failed to load state from MongoDB';
    console.error('[SMARTLIB MongoDB] Load error:', lastMongoError);
    return null;
  }
}

async function syncCollectionDocs<T extends { id: string }>(
  db: Db,
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  const ops = items.map((item) => ({
    replaceOne: {
      filter: { _id: item.id },
      replacement: { ...(item as object) },
      upsert: true,
    },
  }));
  await db.collection<{ _id: string }>(collectionName).bulkWrite(ops, { ordered: false });
}

export async function saveStateToMongo(store: SmartLibStore): Promise<boolean> {
  const db = await getMongoDb();
  if (!db) return false;

  try {
    await db
      .collection<{ _id: string; payload: SmartLibStore; updatedAt: string; currency: string; locale: string }>(
        STATE_COLLECTION
      )
      .replaceOne(
        { _id: STATE_DOC_ID },
        {
          payload: store,
          currency: 'INR',
          locale: 'en-IN',
          updatedAt: new Date().toISOString(),
        },
        { upsert: true }
      );

    // Mirror primary domain entities into dedicated MongoDB Atlas collections for direct querying & inspection
    await Promise.all([
      syncCollectionDocs(db, 'users', store.users),
      syncCollectionDocs(db, 'library_branches', store.branches),
      syncCollectionDocs(db, 'books', store.books),
      syncCollectionDocs(db, 'book_copies', store.bookCopies),
      syncCollectionDocs(db, 'book_issues', store.bookIssues),
      syncCollectionDocs(db, 'reservations', store.reservations),
      syncCollectionDocs(db, 'fines', store.fines),
      syncCollectionDocs(db, 'fine_payments', store.finePayments),
      syncCollectionDocs(db, 'seat_reservations', store.seatReservations),
      syncCollectionDocs(db, 'library_policies', store.policies),
      syncCollectionDocs(db, 'audit_logs', store.auditLogs.slice(0, 200)),
    ]);

    mongoConnected = true;
    lastMongoError = null;
    return true;
  } catch (err) {
    lastMongoError = err instanceof Error ? err.message : 'Failed to save state to MongoDB';
    console.error('[SMARTLIB MongoDB] Save error:', lastMongoError);
    return false;
  }
}

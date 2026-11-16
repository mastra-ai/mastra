import { MongoClient } from 'mongodb';
import type { Db, Document } from 'mongodb';

export const ATLAS_LOCAL_URI =
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';
export const DB_NAME = 'vector_db';
export const REGISTRY = '__mastra_vector_indexes__';

export async function rawClient(): Promise<MongoClient> {
  return new MongoClient(ATLAS_LOCAL_URI).connect();
}

export async function seedCollection(db: Db, name: string, docs: Document[] = []): Promise<void> {
  await db.createCollection(name);
  if (docs.length) await db.collection(name).insertMany(docs);
}

export async function createRawSearchIndex(
  db: Db,
  coll: string,
  name: string,
  definition: Document,
  type: 'search' | 'vectorSearch' = 'vectorSearch',
): Promise<void> {
  await db.collection(coll).createSearchIndex({ name, type, definition });
}

export async function searchIndexNames(db: Db, coll: string): Promise<string[]> {
  const idx = await db.collection(coll).listSearchIndexes().toArray();
  return idx.map(i => i.name as string);
}

export async function seedRegistry(db: Db, doc: Document): Promise<void> {
  await db.collection(REGISTRY).insertOne(doc);
}

let counter = 0;
export function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${counter++}`;
}

export async function waitFor(cond: () => Promise<boolean>, ms = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await cond()) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`waitFor timed out after ${ms}ms`);
}

export function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}

import { ConsoleLogger } from '@mastra/core/logger';
import { MongoClient, MongoNetworkError, MongoServerError } from 'mongodb';
import type { CommandStartedEvent, Db, Document } from 'mongodb';
import type { MongoDBVector } from '../';

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

/** A test hook that signals `reached` when called, then blocks until `release` resolves. */
export function pause() {
  const reached = deferred();
  const release = deferred();
  return {
    reached,
    release,
    hook: async () => {
      reached.resolve();
      await release.promise;
    },
  };
}

/** Fails fast instead of hanging when a hook is never called. */
export async function reached(p: { reached: { promise: Promise<void> } }): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    p.reached.promise,
    new Promise((_r, reject) => (timer = setTimeout(() => reject(new Error('hook not reached')), 15_000))),
  ]).finally(() => clearTimeout(timer));
}

/** Every command the store's client sends from now on. The store needs `options: { monitorCommands: true }`. */
export function captureCommands(store: MongoDBVector): CommandStartedEvent[] {
  const events: CommandStartedEvent[] = [];
  (store as any).client.on('commandStarted', (e: CommandStartedEvent) => events.push(e));
  return events;
}

/** The store's `createSearchIndexesCommand` seam: `run` sends the real command. */
type CreateCommandHook = (command: Document, run: () => Promise<Document>) => Promise<Document>;

/** The id Atlas lists for search index `name` on `coll`, if any. */
export async function listedId(db: Db, coll: string, name: string): Promise<string | undefined> {
  const [row] = await db.collection(coll).listSearchIndexes(name).toArray();
  return (row as { id?: string } | undefined)?.id;
}

/**
 * Emulates the cluster's answer to an identical create: the existing index's id. Atlas Local
 * answers with a fake id, or refuses a racing identical create as a duplicate name.
 */
export function clusterCreateMode(db: Db): CreateCommandHook {
  return async (command, run) => {
    const name = command.indexes[0].name as string;
    let reply: Document;
    try {
      reply = await run();
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 2 && /duplicate index name/i.test(error.message))) {
        throw error;
      }
      reply = { ok: 1, indexesCreated: [{ name }] };
    }
    const id = await listedId(db, command.createSearchIndexes, name);
    const created = reply.indexesCreated?.[0];
    return id && created && created.id !== id ? { ...reply, indexesCreated: [{ ...created, id }] } : reply;
  };
}

/** A create whose response is lost: optionally sent for real first. */
export function unknownCreateMode(opts: { perform: boolean }): CreateCommandHook {
  return async (_command, run) => {
    if (opts.perform) await run();
    throw new MongoNetworkError('simulated lost response');
  };
}

/** Records every `warn` and `error` message the store logs from now on. */
export function captureLogs(store: MongoDBVector): { warn: string[]; error: string[] } {
  const logs = { warn: [] as string[], error: [] as string[] };
  class Capture extends ConsoleLogger {
    warn(message: string) {
      logs.warn.push(message);
    }
    error(message: string) {
      logs.error.push(message);
    }
    // MastraBase installs a child logger; keep recording into the same arrays.
    child(): ConsoleLogger {
      return this;
    }
  }
  store.__setLogger(new Capture());
  return logs;
}

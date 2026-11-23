import { ConsoleLogger } from '@mastra/core/logger';
import { MongoClient, MongoNetworkError, MongoServerError, ReadPreference } from 'mongodb';
import type { CommandStartedEvent, Db, Document, ListSearchIndexesOptions } from 'mongodb';
import type { MongoDBVector } from '../';
import { isLiveRow } from '../provisioning';

/** `OWNERSHIP_TEST_URI` points the suites at an Atlas cluster instead (design §7 cluster runs). */
export const ATLAS_LOCAL_URI =
  process.env.OWNERSHIP_TEST_URI ??
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';
export const DB_NAME = 'vector_db';
export const REGISTRY = '__mastra_vector_indexes__';
export const JOURNAL = '__mastra_vector_ops__';

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

/**
 * The search-index names on `coll` once they equal `expected`, or the last listing after `ms`. A
 * drop is asynchronous on an Atlas cluster, so a name can stay listed for a while after it.
 */
export async function settledNames(db: Db, coll: string, expected: string[], ms = 30000): Promise<string[]> {
  const start = Date.now();
  let names = await searchIndexNames(db, coll);
  while (JSON.stringify(names) !== JSON.stringify(expected) && Date.now() - start < ms) {
    await new Promise(r => setTimeout(r, 500));
    names = await searchIndexNames(db, coll);
  }
  return names;
}

export async function seedRegistry(db: Db, doc: Document): Promise<void> {
  await db.collection(REGISTRY).insertOne(doc);
}

export async function seedJournal(db: Db, doc: Document): Promise<void> {
  await db.collection(JOURNAL).insertOne(doc);
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

/** Every search-index row listed on `name`, on the primary; none when the collection is missing. */
function listRows(db: Db, name: string): Promise<Document[]> {
  return db
    .collection(name)
    .listSearchIndexes({
      readPreference: ReadPreference.primary,
      readConcern: { level: 'local' },
    } as ListSearchIndexesOptions)
    .toArray()
    .then(rows => rows as Document[])
    .catch(err => {
      // Only a missing collection has no rows; any other failure must not read as "clean".
      if (err?.code === 26 || err?.codeName === 'NamespaceNotFound') return [] as Document[];
      throw err;
    });
}

/**
 * Drop a collection after dropping its search indexes by id and waiting until none is listed.
 * Atlas Local keeps the indexes of a collection dropped with them as DOES_NOT_EXIST rows, which
 * come back when a collection of that name is recreated and then block createIndex (stuck row).
 */
export async function dropCollectionWithSearchIndexes(db: Db, name: string): Promise<void> {
  for (const row of await listRows(db, name)) {
    await db.command({ dropSearchIndex: name, id: row.id }, { readPreference: 'primary' }).catch(err => {
      if (err?.code !== 26 && err?.code !== 27) throw err;
    });
  }
  for (let i = 0; i < 60 && (await listRows(db, name)).length; i++) await new Promise(r => setTimeout(r, 250));
  await db.dropCollection(name);
}

type DropHook = (collectionName: string, name: string, id: string) => Promise<void>;

/** Chain `fn` after the store's current `beforeSearchIndexDrop` hook; returns the installed hook. */
function chainDropHook(store: MongoDBVector, fn: DropHook): DropHook {
  const hooks = ((store as any).testHooks ??= {});
  const previous: DropHook | undefined = hooks.beforeSearchIndexDrop;
  const hook: DropHook = async (collectionName, name, id) => {
    await previous?.(collectionName, name, id);
    await fn(collectionName, name, id);
  };
  hooks.beforeSearchIndexDrop = hook;
  return hook;
}

/** Merge `extra` into the store's test hooks, keeping the ones already set (the checker's drop hook). */
export function hooks(store: MongoDBVector, extra: Document): Document {
  return Object.assign(((store as any).testHooks ??= {}), extra);
}

/** Every search-index drop the store sends from now on. */
export function recordDrops(store: MongoDBVector): { drops: { collectionName: string; name: string; id: string }[] } {
  const drops: { collectionName: string; name: string; id: string }[] = [];
  chainDropHook(store, async (collectionName, name, id) => {
    drops.push({ collectionName, name, id });
  });
  return { drops };
}

const references = (d: Document, name: string) =>
  d.searchIndexName === name ||
  d.textSearchIndexName === name ||
  (d.retiredTextIndexNames ?? []).includes(name) ||
  (d.retiredVectorIndexNames ?? []).includes(name);

/**
 * The shared end-of-test invariant checker (design §7). At every drop the stores send it reads the
 * registry on the primary and records a violation when a live registration references the name
 * (I11a); it samples `rev` per `_id`/`generation` there and in {@link assertClean}.
 *
 * R13: a drop whose cleanup record has `dropDecided` is not blocked by a registration (one written
 * after the decision). Instead {@link assertClean} checks the post-condition: no live registration
 * records the dropped id, and every live registration referencing the name has a live index of
 * another id under it, so none is left attached to the dropped incarnation.
 */
export function installInvariantChecker(
  db: Db,
  stores: MongoDBVector[],
): {
  assertClean(
    colls: string[],
    opts?: { expectedLeaks?: string[]; userIndexes?: string[]; journalExpected?: boolean },
  ): Promise<void>;
  /** Reset each store's test hooks to the checker's drop hook alone. */
  restoreHooks(): void;
  violations: string[];
} {
  const violations: string[] = [];
  const decidedDrops: { collectionName: string; name: string; id: string }[] = [];
  const revs = new Map<string, number>();
  const primary = { readPreference: ReadPreference.primary };
  const registry = () => db.collection(REGISTRY, primary);
  const sample = (docs: Document[]) => {
    for (const d of docs) {
      if (typeof d.rev !== 'number') continue;
      const key = `${d._id}/${d.generation}`;
      const last = revs.get(key);
      if (last !== undefined && d.rev < last) violations.push(`rev of "${d._id}" went down from ${last} to ${d.rev}`);
      revs.set(key, Math.max(last ?? d.rev, d.rev));
    }
  };
  // Each read and its sample run one at a time, so concurrent drops sample revs in read order.
  let serial: Promise<unknown> = Promise.resolve();
  const readAndSample = (read: () => Promise<Document[]>): Promise<Document[]> => {
    const next = serial.then(async () => {
      const docs = await read();
      sample(docs);
      return docs;
    });
    serial = next.catch(() => {});
    return next;
  };
  const installed = stores.map(store => {
    const hook = chainDropHook(store, async (collectionName, name, id) => {
      const docs = await readAndSample(() => registry().find({ collectionName }).toArray());
      const users = docs.filter(d => d.deleting !== true && references(d, name)).map(d => d._id);
      const decided = await db
        .collection(JOURNAL, primary)
        .findOne({ collectionName, name, indexId: id, state: 'orphaned', dropDecided: true });
      if (decided) {
        decidedDrops.push({ collectionName, name, id });
        // R13 exempts registrations written after the decision, never one that records this incarnation.
        const holders = docs.filter(
          d => d.deleting !== true && d.indexIds?.some((e: Document) => e.name === name && e.id === id),
        );
        if (holders.length)
          violations.push(`dropped "${name}" (id ${id}) on "${collectionName}" recorded by ${holders.map(d => d._id)}`);
      } else if (users.length)
        violations.push(`dropped "${name}" (id ${id}) on "${collectionName}" referenced by ${users}`);
    });
    return { store, hook };
  });
  return {
    violations,
    restoreHooks() {
      for (const { store, hook } of installed) (store as any).testHooks = { beforeSearchIndexDrop: hook };
    },
    async assertClean(colls, opts = {}) {
      const problems: string[] = [];
      const allowed = new Set([...(opts.expectedLeaks ?? []), ...(opts.userIndexes ?? [])]);
      const docs = await readAndSample(() =>
        registry()
          .find({ collectionName: { $in: colls } })
          .toArray(),
      );
      const journal = await db
        .collection(JOURNAL, primary)
        .find({ collectionName: { $in: colls } })
        .toArray();
      for (const coll of colls) {
        // A dying row is on its way out; it holds nothing.
        for (const row of (await listRows(db, coll)).filter(r => isLiveRow(r as any))) {
          if (allowed.has(row.name)) continue;
          const held =
            docs.some(
              d =>
                d.collectionName === coll && d.indexIds?.some((e: Document) => e.name === row.name && e.id === row.id),
            ) || journal.some(j => j.collectionName === coll && (j.indexId === row.id || j.candidateId === row.id));
          if (!held) problems.push(`search index "${row.name}" (id ${row.id}) on "${coll}" is held by no record`);
        }
      }
      for (const drop of decidedDrops.filter(d => colls.includes(d.collectionName))) {
        const { collectionName, name, id } = drop;
        decidedDrops.splice(decidedDrops.indexOf(drop), 1);
        const live = docs.filter(d => d.collectionName === collectionName && d.deleting !== true);
        for (const d of live.filter(d => d.indexIds?.some((e: Document) => e.name === name && e.id === id)))
          problems.push(`"${d._id}" records the dropped "${name}" (id ${id}) on "${collectionName}"`);
        const row = (await listRows(db, collectionName)).find(r => r.name === name && isLiveRow(r as any));
        for (const d of live.filter(d => references(d, name)))
          if (!row || row.id === id)
            problems.push(`"${d._id}" references "${name}" on "${collectionName}", whose index (id ${id}) was dropped`);
      }
      if (journal.length && !opts.journalExpected) problems.push(`journal not empty: ${journal.map(j => j._id)}`);
      problems.push(...violations.splice(0));
      if (problems.length) throw new Error(`invariant checker:\n${problems.join('\n')}`);
    },
  };
}

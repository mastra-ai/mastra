import { randomUUID } from 'node:crypto';
import type { KnowledgeStorage } from '../storage/domains/knowledge/base';
import type {
  KnowledgeImportOwnedPage,
  KnowledgeImportRun,
  KnowledgeImportRunCounts,
} from '../storage/domains/knowledge/importers';
import { knowledgePagePath } from '../storage/domains/knowledge/pages';
import type { KnowledgeNote } from '../storage/domains/knowledge/pages';
import {
  addKnowledgeNote,
  removeKnowledgeNote,
  removeKnowledgePage,
  updateKnowledgeNote,
  upsertKnowledgePage,
} from './host-writes';
import type {
  KnowledgeAddNoteInput,
  KnowledgeHostWriter,
  KnowledgeRemovePageInput,
  KnowledgeUpdateNoteInput,
  KnowledgeUpsertPageInput,
  KnowledgeUpsertPageResult,
} from './host-writes';
import type { Knowledge } from './index';

/**
 * Brings content from an outside source (a ticket tracker, a wiki, a CRM) into Knowledge pages and
 * notes. Write what the source has on every run through `ctx.pages`; Knowledge skips pages that
 * didn't change and, after a full run, removes the pages this importer wrote before but not this time.
 *
 * @experimental
 */
export interface KnowledgeImporter<TOptions = unknown> {
  /** Stable id: letters, digits, `-`, `_`, `.` and `:`. Runs, cursors and page ownership are keyed on it. */
  id: string;
  description?: string;
  run(ctx: KnowledgeImporterContext<TOptions>): Promise<void>;
}

/** @experimental */
export interface KnowledgeImporterContext<TOptions = unknown> {
  runId: string;
  importerId: string;
  options: TOptions;
  /** Nothing is written: page writes are compared with what is stored and counted, state saves are dropped. */
  dryRun: boolean;
  /** Whether this run removes the importer's pages it didn't write; see {@link KnowledgeRunImporterOptions}. */
  incremental: boolean;
  /** Aborted when the run is canceled; stop fetching and return or throw. */
  signal: AbortSignal;
  pages: KnowledgeImporterPages;
  /** Per-importer JSON values, e.g. cursors. A dry run reads saved values and sees its own sets. */
  state: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
  };
  log(message: string, data?: Record<string, unknown>): void;
}

/** Host writes recorded as `importer:<id>`. @experimental */
export interface KnowledgeImporterPages {
  upsert(input: Omit<KnowledgeUpsertPageInput, 'author'>): Promise<KnowledgeUpsertPageResult>;
  /** Removes the page now; `false` when there was none. */
  remove(input: Omit<KnowledgeRemovePageInput, 'author'>): Promise<boolean>;
  /** Keeps a page this importer wrote in an earlier run without rewriting it, so the run doesn't remove it. */
  keep(input: { scope: string; path: string }): void;
  /** In a dry run, returns a placeholder note that was not stored. */
  addNote(input: Omit<KnowledgeAddNoteInput, 'author'>): Promise<KnowledgeNote>;
  updateNote(input: Omit<KnowledgeUpdateNoteInput, 'author'>): Promise<KnowledgeNote>;
  removeNote(input: { id: string }): Promise<boolean>;
}

/** @experimental */
export interface KnowledgeRunImporterOptions<TOptions = unknown> {
  options?: TOptions;
  dryRun?: boolean;
  /**
   * For importers that fetch only what changed since a cursor: the run doesn't remove pages it
   * didn't write. Remove deleted items with `ctx.pages.remove`. Default `false`.
   */
  incremental?: boolean;
  signal?: AbortSignal;
}

/** @experimental */
export class KnowledgeImporterBusyError extends Error {
  constructor(importerId: string) {
    super(`Knowledge importer "${importerId}" is already running.`);
    this.name = 'KnowledgeImporterBusyError';
  }
}

const IMPORTER_ID = /^[A-Za-z0-9._:-]+$/;

/** @internal */
export function assertKnowledgeImporter(importer: KnowledgeImporter<any>): void {
  if (!importer || typeof importer.run !== 'function') {
    throw new Error('A Knowledge importer needs an `id` and a `run` function.');
  }
  if (typeof importer.id !== 'string' || !IMPORTER_ID.test(importer.id)) {
    throw new Error(
      `Knowledge importer id "${String(importer.id)}" may only use letters, digits, "-", "_", "." and ":".`,
    );
  }
}

function ownedKey(page: KnowledgeImportOwnedPage): string {
  return JSON.stringify([page.scope, page.path]);
}

function emptyCounts(): KnowledgeImportRunCounts {
  return { created: 0, updated: 0, unchanged: 0, removed: 0, notes: 0 };
}

/** @internal */
export interface KnowledgeImporterHost extends KnowledgeHostWriter {
  log(level: 'info' | 'warn', message: string, data?: Record<string, unknown>): void;
}

async function executeKnowledgeImporter<TOptions>(
  host: KnowledgeImporterHost,
  importer: KnowledgeImporter<TOptions>,
  input: KnowledgeRunImporterOptions<TOptions>,
): Promise<KnowledgeImportRun> {
  const storage = await host.getStorage();
  if (!storage.getCapabilities().supportsImporters) {
    throw new Error(
      'Knowledge importers need a storage adapter that stores importer runs (in-memory, LibSQL or PostgreSQL).',
    );
  }
  const author = `importer:${importer.id}`;
  const dryRun = input.dryRun ?? false;
  const incremental = input.incremental ?? false;
  const counts = emptyCounts();
  const controller = new AbortController();
  const onAbort = () => controller.abort(input.signal?.reason);

  const run = await storage.createImportRun({
    id: randomUUID(),
    importerId: importer.id,
    status: 'running',
    dryRun,
    incremental,
    counts,
    startedAt: new Date(),
  });

  if (input.signal?.aborted) onAbort();
  else input.signal?.addEventListener('abort', onAbort, { once: true });

  const touched = new Map<string, KnowledgeImportOwnedPage>();
  /** Pages this importer created in earlier runs. Only these, and pages it creates now, can be swept. */
  let owned = new Set<string>();
  const keeps: Array<{ scope: string; path: string }> = [];
  /** State saved by this run; written only when it succeeds, so a failed run doesn't move a cursor. */
  const pendingState = new Map<string, unknown>();
  const dryCreated = new Set<string>();
  const scopeAddresses = new Map<string, string>();

  /** The stored address of `scope` (canonical), or the input when the scope doesn't exist yet. */
  const canonicalScope = async (scope: string): Promise<string> => {
    const known = scopeAddresses.get(scope);
    if (known) return known;
    const [page] = await storage.getScopesByAddress([scope]);
    if (!page?.address) return scope;
    scopeAddresses.set(scope, page.address);
    return page.address;
  };
  const ownedPage = async (scope: string, path: string): Promise<KnowledgeImportOwnedPage> => ({
    scope: await canonicalScope(scope),
    path: knowledgePagePath(path).join('/'),
  });
  const checkAbort = () => {
    if (controller.signal.aborted) {
      throw controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Import canceled.');
    }
  };

  const pages: KnowledgeImporterPages = {
    async upsert(page) {
      checkAbort();
      const result = dryRun ? await previewUpsert(storage, page) : await upsertKnowledgePage(host, { ...page, author });
      if (dryRun && result.status === 'created') dryCreated.add(ownedKey(await ownedPage(page.scope, page.path)));
      counts[result.status]++;
      const ownedEntry = await ownedPage(page.scope, page.path);
      const key = ownedKey(ownedEntry);
      // A page someone else created stays theirs: writing to it doesn't let a later run remove it.
      if (result.status === 'created' || owned.has(key)) {
        touched.set(key, ownedEntry);
        if (!dryRun && !owned.has(key)) {
          await storage.updateImportOwnedPages({ importerId: importer.id, add: [ownedEntry] });
          owned.add(key);
        }
      }
      return result;
    },
    async remove(page) {
      checkAbort();
      const ownedEntry = await ownedPage(page.scope, page.path);
      touched.delete(ownedKey(ownedEntry));
      if (dryRun) {
        const exists = await pageExists(storage, page.scope, page.path);
        if (exists) counts.removed++;
        return exists;
      }
      const removed = await removeKnowledgePage(host, { ...page, author });
      await storage.updateImportOwnedPages({ importerId: importer.id, remove: [ownedEntry] });
      owned.delete(ownedKey(ownedEntry));
      if (removed) counts.removed++;
      return removed !== null;
    },
    keep(page) {
      // Resolved to the stored scope address before the sweep.
      keeps.push(page);
    },
    async addNote(note) {
      checkAbort();
      if (dryRun) {
        if (
          !dryCreated.has(ownedKey(await ownedPage(note.scope, note.path))) &&
          !(await pageExists(storage, note.scope, note.path))
        ) {
          throw new Error(`No page at ${note.scope}#${note.path}: upsert it first.`);
        }
        counts.notes++;
        return dryRunNote(note.text);
      }
      const added = await addKnowledgeNote(host, { ...note, author });
      counts.notes++;
      return added;
    },
    async updateNote(note) {
      checkAbort();
      if (dryRun) {
        if ((await storage.getNote({ id: note.id, read: 'all' })) === null) {
          throw new Error(`Knowledge note "${note.id}" does not exist.`);
        }
        counts.notes++;
        return dryRunNote(note.text);
      }
      const updated = await updateKnowledgeNote(host, { ...note, author });
      counts.notes++;
      return updated;
    },
    async removeNote({ id }) {
      checkAbort();
      if (dryRun) {
        const exists = (await storage.getNote({ id, read: 'all' })) !== null;
        if (exists) counts.notes++;
        return exists;
      }
      const removed = await removeKnowledgeNote(host, { id, author });
      if (removed) counts.notes++;
      return removed !== null;
    },
  };
  const ctx: KnowledgeImporterContext<TOptions> = {
    runId: run.id,
    importerId: importer.id,
    options: input.options as TOptions,
    dryRun,
    incremental,
    signal: controller.signal,
    pages,
    state: {
      async get<T>(key: string) {
        if (pendingState.has(key)) return pendingState.get(key) as T | undefined;
        return (await storage.getImportState({ importerId: importer.id, key })) as T | undefined;
      },
      async set(key, value) {
        if (value !== undefined) JSON.stringify(value);
        pendingState.set(key, value);
      },
    },
    log: (message, data) => host.log('info', `[knowledge importer ${importer.id}] ${message}`, data),
  };

  let status: KnowledgeImportRun['status'] = 'succeeded';
  let error: string | undefined;
  const sweepFailures: string[] = [];
  try {
    owned = new Set((await storage.listImportOwnedPages({ importerId: importer.id })).map(ownedKey));
    await importer.run(ctx);
    checkAbort();
    if (!incremental) {
      for (const page of keeps) {
        const owned = await ownedPage(page.scope, page.path);
        touched.set(ownedKey(owned), owned);
      }
      await sweep();
    }
    if (sweepFailures.length > 0) {
      status = 'failed';
      error = `Could not remove ${sweepFailures.length} page(s): ${sweepFailures.join('; ')}`;
    } else if (!dryRun) {
      for (const [key, value] of pendingState) {
        await storage.setImportState({ importerId: importer.id, key, value });
      }
    }
  } catch (caught) {
    status = controller.signal.aborted ? 'canceled' : 'failed';
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    input.signal?.removeEventListener('abort', onAbort);
  }

  return storage.updateImportRun({ id: run.id, status, counts, error, completedAt: new Date() });

  /** Removes the pages this importer owns but didn't write or keep in this run, deepest first. */
  async function sweep() {
    const stale = (await storage.listImportOwnedPages({ importerId: importer.id }))
      .filter(page => !touched.has(ownedKey(page)))
      .sort((a, b) => b.path.split('/').length - a.path.split('/').length);
    const failed: KnowledgeImportOwnedPage[] = [];
    // Not abortable once started: a canceled run must not have removed anything.
    for (const page of stale) {
      if (dryRun) {
        if (await pageExists(storage, page.scope, page.path)) counts.removed++;
        continue;
      }
      try {
        if (await removeKnowledgePage(host, { ...page, author })) counts.removed++;
        await storage.updateImportOwnedPages({ importerId: importer.id, remove: [page] });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        // A child of ours that failed to go keeps the parent owned, so a later run retries both.
        const ownChildLeft = failed.some(child => child.scope === page.scope && child.path.startsWith(`${page.path}/`));
        if (/has child pages/.test(message) && !ownChildLeft) {
          // Someone added child pages under it: the page is theirs to keep now, so stop owning it.
          await storage.updateImportOwnedPages({ importerId: importer.id, remove: [page] });
          host.log('info', `[knowledge importer ${importer.id}] kept ${page.scope}#${page.path}: it has child pages`);
        } else {
          failed.push(page);
          sweepFailures.push(`${page.scope}#${page.path}: ${message}`);
        }
      }
    }
  }
}

async function pageExists(storage: KnowledgeStorage, scope: string, path: string): Promise<boolean> {
  const [scopePage] = await storage.getScopesByAddress([scope]);
  if (!scopePage) return false;
  return (await storage.getPageByPath({ scopeId: scopePage.id, path: knowledgePagePath(path), read: 'all' })) !== null;
}

/** What `upsertKnowledgePage` would return, without writing. Mirrors its unchanged rule. */
async function previewUpsert(
  storage: KnowledgeStorage,
  input: Omit<KnowledgeUpsertPageInput, 'author'>,
): Promise<KnowledgeUpsertPageResult> {
  const keys = knowledgePagePath(input.path);
  if (keys.length === 0) throw new Error(`Knowledge page path "${input.path}" needs at least one key.`);
  const [scopePage] = await storage.getScopesByAddress([input.scope]);
  const existing = scopePage ? await storage.getPageByPath({ scopeId: scopePage.id, path: keys, read: 'all' }) : null;
  if (!existing) {
    const now = new Date();
    return {
      status: 'created',
      page: {
        id: `dry-run:${keys.join('/')}`,
        scopeId: scopePage?.id ?? '',
        parentId: null,
        isScope: false,
        key: keys.at(-1),
        position: '',
        name: input.name,
        description: input.description,
        body: input.body,
        version: 0,
        createdAt: now,
        updatedAt: now,
      } as KnowledgeUpsertPageResult['page'],
    };
  }
  const unchanged =
    input.name === existing.name &&
    (input.description === undefined || input.description === (existing.description ?? '')) &&
    (input.body === undefined || input.body === (existing.body ?? ''));
  return { status: unchanged ? 'unchanged' : 'updated', page: existing };
}

function dryRunNote(text: string): KnowledgeNote {
  return { id: `dry-run:${randomUUID()}`, text } as KnowledgeNote;
}

/** @internal Not exported from the package, so only `runKnowledgeImporter` reaches the host writer. */
export const knowledgeImporterHost = Symbol('knowledgeImporterHost');

const running = new WeakMap<Knowledge, Set<string>>();

/**
 * Runs an importer against an existing Knowledge instance and returns its finished run. Nothing is
 * registered: pass the importer each time. A failing or canceled importer doesn't throw: the run says
 * `failed` or `canceled` with the error, keeps the writes it made, removes no stale pages and saves no
 * state (state keys are saved one at a time, so a storage error while saving them can leave some
 * saved). Throws {@link KnowledgeImporterBusyError} when the same importer id is already running on
 * this instance; runs aren't locked across processes, so schedule each importer on one worker.
 * Scheduling is up to you.
 *
 * Writes are host writes made as `importer:<id>`. **Host-only**, like `Knowledge.upsertPage`.
 *
 * @experimental
 */
export async function runKnowledgeImporter<TOptions>(
  knowledge: Knowledge,
  importer: KnowledgeImporter<TOptions>,
  options: KnowledgeRunImporterOptions<TOptions> = {},
): Promise<KnowledgeImportRun> {
  assertKnowledgeImporter(importer);
  let ids = running.get(knowledge);
  if (!ids) running.set(knowledge, (ids = new Set()));
  if (ids.has(importer.id)) throw new KnowledgeImporterBusyError(importer.id);
  ids.add(importer.id);
  try {
    return await executeKnowledgeImporter(knowledge[knowledgeImporterHost](), importer, options);
  } finally {
    ids.delete(importer.id);
  }
}

/** @experimental */
export async function getKnowledgeImportRun(knowledge: Knowledge, runId: string): Promise<KnowledgeImportRun | null> {
  return (await knowledge.getStorage()).getImportRun({ id: runId });
}

/** Newest first; 20 by default. @experimental */
export async function listKnowledgeImportRuns(
  knowledge: Knowledge,
  input: { importerId?: string; limit?: number } = {},
): Promise<KnowledgeImportRun[]> {
  return (await knowledge.getStorage()).listImportRuns(input);
}

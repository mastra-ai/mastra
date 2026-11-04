/** @experimental */
export type KnowledgeImportRunStatus = 'running' | 'succeeded' | 'failed' | 'canceled';

/** What one import run did. A dry run counts what it would have done. @experimental */
export interface KnowledgeImportRunCounts {
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  notes: number;
}

/** @experimental */
export interface KnowledgeImportRun {
  id: string;
  importerId: string;
  status: KnowledgeImportRunStatus;
  dryRun: boolean;
  /** An incremental run doesn't remove the importer's pages it didn't write. */
  incremental: boolean;
  counts: KnowledgeImportRunCounts;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/** A page an importer wrote, by canonical scope address and normalized key path. @experimental */
export interface KnowledgeImportOwnedPage {
  scope: string;
  path: string;
}

/**
 * Storage for importer runs, cursors and page ownership, alongside the page store. Adapters that
 * implement it report `supportsImporters` in their capabilities.
 *
 * @experimental
 */
export interface KnowledgeImporterStore {
  /** A JSON value the importer saved, or `undefined`. */
  getImportState(input: { importerId: string; key: string }): Promise<unknown>;
  /** Saves a JSON-serializable value; `undefined` deletes the key. */
  setImportState(input: { importerId: string; key: string; value: unknown }): Promise<void>;
  createImportRun(run: KnowledgeImportRun): Promise<KnowledgeImportRun>;
  updateImportRun(input: {
    id: string;
    status: KnowledgeImportRunStatus;
    counts: KnowledgeImportRunCounts;
    error?: string;
    completedAt?: Date;
  }): Promise<KnowledgeImportRun>;
  getImportRun(input: { id: string }): Promise<KnowledgeImportRun | null>;
  /** Newest first. */
  listImportRuns(input: { importerId?: string; limit?: number }): Promise<KnowledgeImportRun[]>;
  listImportOwnedPages(input: { importerId: string }): Promise<KnowledgeImportOwnedPage[]>;
  updateImportOwnedPages(input: {
    importerId: string;
    add?: readonly KnowledgeImportOwnedPage[];
    remove?: readonly KnowledgeImportOwnedPage[];
  }): Promise<void>;
}

/** @experimental */
export const TABLE_KNOWLEDGE_IMPORTER_STATE = 'mastra_knowledge_importer_state';
/** @experimental */
export const TABLE_KNOWLEDGE_IMPORTER_RUNS = 'mastra_knowledge_importer_runs';
/** @experimental */
export const TABLE_KNOWLEDGE_IMPORTER_PAGES = 'mastra_knowledge_importer_pages';

export const DEFAULT_KNOWLEDGE_IMPORT_RUNS_LIMIT = 20;

/** In-memory importer storage; also the reference behavior adapters are tested against. @internal */
export class InMemoryKnowledgeImporterStore implements KnowledgeImporterStore {
  #state = new Map<string, string>();
  #runs = new Map<string, KnowledgeImportRun>();
  #pages = new Map<string, Map<string, KnowledgeImportOwnedPage>>();

  async getImportState({ importerId, key }: { importerId: string; key: string }) {
    const raw = this.#state.get(JSON.stringify([importerId, key]));
    return raw === undefined ? undefined : JSON.parse(raw);
  }

  async setImportState({ importerId, key, value }: { importerId: string; key: string; value: unknown }) {
    const id = JSON.stringify([importerId, key]);
    if (value === undefined) this.#state.delete(id);
    else this.#state.set(id, JSON.stringify(value));
  }

  async createImportRun(run: KnowledgeImportRun) {
    if (this.#runs.has(run.id)) throw new Error(`Knowledge import run ${run.id} already exists.`);
    this.#runs.set(run.id, cloneRun(run));
    return cloneRun(run);
  }

  async updateImportRun(input: Parameters<KnowledgeImporterStore['updateImportRun']>[0]) {
    const run = this.#runs.get(input.id);
    if (!run) throw new Error(`Knowledge import run ${input.id} not found.`);
    const next: KnowledgeImportRun = {
      ...run,
      status: input.status,
      counts: { ...input.counts },
      error: input.error,
      completedAt: input.completedAt,
    };
    this.#runs.set(run.id, next);
    return cloneRun(next);
  }

  async getImportRun({ id }: { id: string }) {
    const run = this.#runs.get(id);
    return run ? cloneRun(run) : null;
  }

  async listImportRuns({ importerId, limit }: { importerId?: string; limit?: number }) {
    return [...this.#runs.values()]
      .filter(run => importerId === undefined || run.importerId === importerId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || (a.id < b.id ? 1 : -1))
      .slice(0, limit ?? DEFAULT_KNOWLEDGE_IMPORT_RUNS_LIMIT)
      .map(cloneRun);
  }

  async listImportOwnedPages({ importerId }: { importerId: string }) {
    return [...(this.#pages.get(importerId)?.values() ?? [])].map(page => ({ ...page }));
  }

  async updateImportOwnedPages(input: Parameters<KnowledgeImporterStore['updateImportOwnedPages']>[0]) {
    let pages = this.#pages.get(input.importerId);
    if (!pages) this.#pages.set(input.importerId, (pages = new Map()));
    for (const page of input.remove ?? []) pages.delete(JSON.stringify([page.scope, page.path]));
    for (const page of input.add ?? []) pages.set(JSON.stringify([page.scope, page.path]), { ...page });
  }

  clear() {
    this.#state.clear();
    this.#runs.clear();
    this.#pages.clear();
  }
}

function cloneRun(run: KnowledgeImportRun): KnowledgeImportRun {
  return {
    ...run,
    counts: { ...run.counts },
    startedAt: new Date(run.startedAt),
    completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
  };
}

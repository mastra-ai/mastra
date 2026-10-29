import { resolve } from 'node:path';

import {
  inspectKnowledgePagesSchema,
  KNOWLEDGE_PAGES_SCHEMA_VERSION,
  KNOWLEDGE_RESETTABLE_TABLE_NAMES,
  KNOWLEDGE_STORAGE_CONTRACT_VERSION,
  KNOWLEDGE_STORAGE_SCHEMA_VERSION,
  TABLE_KNOWLEDGE_PAGES_STATE,
} from '@internal/core/knowledge-compat';
import { KnowledgeSchemaResetRequiredError, KnowledgeStorage } from '@mastra/core/storage';
import type { KnowledgePageStore } from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type {
  SqliteClient as Client,
  SqliteInValue as InValue,
  SqliteResultSet as ResultSet,
  SqliteTransaction as Transaction,
} from '../../db/client';
import { withClientWriteLock } from '../../db/write-lock';
import { KNOWLEDGE_PAGE_DDL, LibSQLKnowledgePages } from './pages';

interface Executor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

function canonicalizeLibSQLUrl(url: string): string | undefined {
  if (url.includes(':memory:')) {
    // Every connection to a shared-cache in-memory URI in this process opens the same database.
    return /[?&]cache=shared(?:&|$)/.test(url) ? 'file::memory:?cache=shared' : undefined;
  }
  if (url.startsWith('file:')) {
    const [path] = url.slice('file:'.length).split('?');
    if (url.startsWith('file://')) {
      const parsed = new URL(url);
      const host = parsed.hostname.toLocaleLowerCase();
      const filePath = host && host !== 'localhost' ? `//${host}${parsed.pathname}` : parsed.pathname;
      return `file:${resolve(decodeURIComponent(filePath))}`;
    }
    return `file:${resolve(decodeURIComponent(path!))}`;
  }

  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === 'libsql:' || parsed.protocol === 'https:' ? '443' : '80');
    return `${parsed.protocol}//${parsed.hostname.toLocaleLowerCase()}:${port}${parsed.pathname}`;
  } catch {
    return url;
  }
}

const unidentifiedClientIsolationKey = {};

export function getLibSQLKnowledgeIsolationKey(
  config: { url?: string; client?: Client; storageIsolationKey?: unknown },
  client?: Client,
): unknown {
  if (config.storageIsolationKey !== undefined) return config.storageIsolationKey;
  if (!config.url) return unidentifiedClientIsolationKey;
  const urlKey = canonicalizeLibSQLUrl(config.url);
  // A private in-memory URL opens a database that only its own client can reach.
  return urlKey ? `libsql:${urlKey}` : (client ?? config.client ?? config);
}

export class KnowledgeLibSQL extends KnowledgeStorage {
  readonly #client: Client;
  readonly #db: LibSQLDB;
  readonly #pages: LibSQLKnowledgePages;

  constructor(config: LibSQLDomainConfig) {
    const client = resolveClient(config);
    const storageIsolationKey = config.storageIsolationKey ?? getLibSQLKnowledgeIsolationKey(config, client);
    super({ storageIsolationKey });
    this.#client = client;
    this.#db = new LibSQLDB({
      client: this.#client,
      maxRetries: config.maxRetries,
      initialBackoffMs: config.initialBackoffMs,
    });
    this.#pages = new LibSQLKnowledgePages({
      read: this.#client,
      transaction: operation => this.#transaction(operation),
    });
  }

  override getCapabilities() {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      supportsSchemaInspection: true,
      supportsExplicitReset: true,
    } as const;
  }

  override async dangerouslyClearAll(): Promise<void> {
    await this.#pages.clearAll();
  }

  // Schema-4 page store: delegates to LibSQLKnowledgePages.
  async #inspectPages(tx: Pick<Executor, 'execute'>) {
    const tables = await tx.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra\\_knowledge\\_%' ESCAPE '\\'",
    });
    const tableNames = tables.rows.map(row => String(row.name));
    let schemaVersion: number | undefined;
    if (tableNames.includes(TABLE_KNOWLEDGE_PAGES_STATE)) {
      const state = await tx.execute({
        sql: `SELECT schemaVersion FROM "${TABLE_KNOWLEDGE_PAGES_STATE}" WHERE id = 'knowledge'`,
      });
      if (state.rows[0]) schemaVersion = Number(state.rows[0].schemaVersion);
    }
    return inspectKnowledgePagesSchema({ tableNames, schemaVersion });
  }

  override async inspectSchema() {
    return this.#inspectPages(this.#client);
  }

  override async init(): Promise<void> {
    await this.#transaction(async tx => {
      const inspection = await this.#inspectPages(tx);
      if (inspection.status === 'incompatible-reset-required') throw new KnowledgeSchemaResetRequiredError(inspection);
      for (const statement of KNOWLEDGE_PAGE_DDL) await tx.execute(statement);
      await tx.execute({
        sql: `INSERT OR IGNORE INTO "${TABLE_KNOWLEDGE_PAGES_STATE}" (id, schemaVersion) VALUES ('knowledge', ?)`,
        args: [KNOWLEDGE_PAGES_SCHEMA_VERSION],
      });
    });
  }

  override async dangerouslyReset(): Promise<void> {
    await withClientWriteLock(this.#client, async () => {
      await this.#client.batch(
        KNOWLEDGE_RESETTABLE_TABLE_NAMES.map(table => ({ sql: `DROP TABLE IF EXISTS "${table}"`, args: [] })),
        'write',
      );
    });
    await this.init();
  }

  override materializeScope(
    input: Parameters<KnowledgePageStore['materializeScope']>[0],
  ): ReturnType<KnowledgePageStore['materializeScope']> {
    return this.#pages.materializeScope(input);
  }

  override getScopesByAddress(
    input: Parameters<KnowledgePageStore['getScopesByAddress']>[0],
  ): ReturnType<KnowledgePageStore['getScopesByAddress']> {
    return this.#pages.getScopesByAddress(input);
  }

  override listChildScopes(
    input: Parameters<KnowledgePageStore['listChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['listChildScopes']> {
    return this.#pages.listChildScopes(input);
  }

  override getPage(input: Parameters<KnowledgePageStore['getPage']>[0]): ReturnType<KnowledgePageStore['getPage']> {
    return this.#pages.getPage(input);
  }

  override getPageByPath(
    input: Parameters<KnowledgePageStore['getPageByPath']>[0],
  ): ReturnType<KnowledgePageStore['getPageByPath']> {
    return this.#pages.getPageByPath(input);
  }

  override findPagesByName(
    input: Parameters<KnowledgePageStore['findPagesByName']>[0],
  ): ReturnType<KnowledgePageStore['findPagesByName']> {
    return this.#pages.findPagesByName(input);
  }

  override listChildPages(
    input: Parameters<KnowledgePageStore['listChildPages']>[0],
  ): ReturnType<KnowledgePageStore['listChildPages']> {
    return this.#pages.listChildPages(input);
  }

  override listPages(
    input: Parameters<KnowledgePageStore['listPages']>[0],
  ): ReturnType<KnowledgePageStore['listPages']> {
    return this.#pages.listPages(input);
  }

  override createPage(
    input: Parameters<KnowledgePageStore['createPage']>[0],
  ): ReturnType<KnowledgePageStore['createPage']> {
    return this.#pages.createPage(input);
  }

  override updatePage(
    input: Parameters<KnowledgePageStore['updatePage']>[0],
  ): ReturnType<KnowledgePageStore['updatePage']> {
    return this.#pages.updatePage(input);
  }

  override movePage(input: Parameters<KnowledgePageStore['movePage']>[0]): ReturnType<KnowledgePageStore['movePage']> {
    return this.#pages.movePage(input);
  }

  override mergePages(
    input: Parameters<KnowledgePageStore['mergePages']>[0],
  ): ReturnType<KnowledgePageStore['mergePages']> {
    return this.#pages.mergePages(input);
  }

  override deletePage(
    input: Parameters<KnowledgePageStore['deletePage']>[0],
  ): ReturnType<KnowledgePageStore['deletePage']> {
    return this.#pages.deletePage(input);
  }

  override getNote(input: Parameters<KnowledgePageStore['getNote']>[0]): ReturnType<KnowledgePageStore['getNote']> {
    return this.#pages.getNote(input);
  }

  override listNotes(
    input: Parameters<KnowledgePageStore['listNotes']>[0],
  ): ReturnType<KnowledgePageStore['listNotes']> {
    return this.#pages.listNotes(input);
  }

  override listNotesMentioning(
    input: Parameters<KnowledgePageStore['listNotesMentioning']>[0],
  ): ReturnType<KnowledgePageStore['listNotesMentioning']> {
    return this.#pages.listNotesMentioning(input);
  }

  override addNote(input: Parameters<KnowledgePageStore['addNote']>[0]): ReturnType<KnowledgePageStore['addNote']> {
    return this.#pages.addNote(input);
  }

  override restampNote(
    input: Parameters<KnowledgePageStore['restampNote']>[0],
  ): ReturnType<KnowledgePageStore['restampNote']> {
    return this.#pages.restampNote(input);
  }

  override removeNote(
    input: Parameters<KnowledgePageStore['removeNote']>[0],
  ): ReturnType<KnowledgePageStore['removeNote']> {
    return this.#pages.removeNote(input);
  }

  override restoreNote(
    input: Parameters<KnowledgePageStore['restoreNote']>[0],
  ): ReturnType<KnowledgePageStore['restoreNote']> {
    return this.#pages.restoreNote(input);
  }

  override searchPages(
    input: Parameters<KnowledgePageStore['searchPages']>[0],
  ): ReturnType<KnowledgePageStore['searchPages']> {
    return this.#pages.searchPages(input);
  }

  override listPageActivity(
    input: Parameters<KnowledgePageStore['listPageActivity']>[0],
  ): ReturnType<KnowledgePageStore['listPageActivity']> {
    return this.#pages.listPageActivity(input);
  }

  override addPinAudience(
    input: Parameters<KnowledgePageStore['addPinAudience']>[0],
  ): ReturnType<KnowledgePageStore['addPinAudience']> {
    return this.#pages.addPinAudience(input);
  }

  override removePinAudience(
    input: Parameters<KnowledgePageStore['removePinAudience']>[0],
  ): ReturnType<KnowledgePageStore['removePinAudience']> {
    return this.#pages.removePinAudience(input);
  }

  override listPins(input: Parameters<KnowledgePageStore['listPins']>[0]): ReturnType<KnowledgePageStore['listPins']> {
    return this.#pages.listPins(input);
  }

  async #transaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.#db.executeWriteOperationWithRetry(
      () =>
        withClientWriteLock(this.#client, async () => {
          const tx = await this.#client.transaction('write');
          try {
            const result = await operation(tx);
            await tx.commit();
            return result;
          } catch (error) {
            if (!tx.closed) await tx.rollback();
            throw error;
          }
        }),
      'write knowledge state',
    );
  }
}

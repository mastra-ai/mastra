import { createKnowledgePagesCoreLoader, KNOWLEDGE_PAGES_SCHEMA_VERSION } from '@internal/core/knowledge-compat';
import { coreFeatures } from '@mastra/core/features';
import { KnowledgeStorage } from '@mastra/core/storage';
import type { KnowledgePageStore, KnowledgeTransactionOptions } from '@mastra/core/storage';
import { defaults as pgDefaults } from 'pg';

import { TransactionClient, TransactionDeadlineError } from '../../client';
import type { TxClient } from '../../client';
import type { DbClient, PgDomainConfig } from '../../db';
import { resolvePgConfig } from '../../db';
import { PgKnowledgeImporters, pgKnowledgeImportersDDL } from './importers';
import { PgKnowledgePages, pgKnowledgePagesDDL } from './pages';
import { inspectPgKnowledgePagesSchema, initPgKnowledgePagesSchema, resetPgKnowledgePagesSchema } from './pages-schema';

const loadKnowledgePagesCore = createKnowledgePagesCoreLoader(coreFeatures, () => import('@mastra/core/storage'));

type PgKnowledgeIsolationConfig = {
  schemaName?: string;
  client?: DbClient;
  pool?: object;
  connectionString?: string;
  host?: string;
  port?: number | string;
  database?: string;
  user?: string;
};

type PgConnectionField = 'host' | 'port' | 'database' | 'user';

// Mirrors how `pg` resolves each connection field: explicit option, then PG* env var, then pg.defaults.
function pgSetting(config: Partial<Record<PgConnectionField, unknown>>, key: PgConnectionField): string | undefined {
  const value = config[key] || process.env[`PG${key.toUpperCase()}`] || pgDefaults[key];
  return value === undefined || value === null || value === '' ? undefined : String(value);
}

function effectivePgTarget(config: Partial<Record<PgConnectionField, unknown>>): string | undefined {
  const host = pgSetting(config, 'host');
  const database = pgSetting(config, 'database') ?? pgSetting(config, 'user');
  if (!host || !database) return undefined;
  const canonicalHost = host.startsWith('/') ? host : host.toLocaleLowerCase();
  return `${canonicalHost}:${pgSetting(config, 'port') ?? '5432'}/${database}`;
}

function canonicalPgTarget(config: PgKnowledgeIsolationConfig): string | undefined {
  if (config.connectionString) {
    try {
      const parsed = new URL(config.connectionString);
      return effectivePgTarget({
        host: decodeURIComponent(parsed.hostname) || config.host,
        port: parsed.port || config.port,
        database: decodeURIComponent(parsed.pathname.slice(1)) || config.database,
        user: decodeURIComponent(parsed.username) || config.user,
      });
    } catch {
      return config.connectionString;
    }
  }
  return effectivePgTarget(config);
}

function pgSourceConfig(source: object | undefined): PgKnowledgeIsolationConfig | undefined {
  if (!source || !('options' in source)) return undefined;
  return (source as { options?: PgKnowledgeIsolationConfig }).options;
}

function pgClientPool(client: DbClient | undefined): object | undefined {
  if (!client || !('$pool' in client)) return undefined;
  return (client as DbClient & { $pool?: object }).$pool;
}

export function getPgKnowledgeIsolationKey(config: PgKnowledgeIsolationConfig): unknown {
  const schema = config.schemaName ?? 'public';
  const pool = config.pool ?? pgClientPool(config.client);
  const poolConfig = pgSourceConfig(pool);
  const hasOwnTarget = Boolean(config.connectionString || config.host || config.database);
  const target = hasOwnTarget ? canonicalPgTarget(config) : poolConfig ? canonicalPgTarget(poolConfig) : undefined;
  if (target) return `pg:${target}:schema:${schema}`;
  // Without a resolvable target, assume any two such stores may share a database so registration fails closed.
  // Callers that know the stores are distinct can pass storageIsolationKey.
  return `pg:unidentified:schema:${schema}`;
}

/**
 * A `DbClient` over one open transaction, for a {@link KnowledgePG} transaction view. Every query runs
 * on the transaction; `tx` opens a savepoint, so a store method that fails undoes only its own
 * statements and leaves the transaction usable. Savepoints nest, so calls on a view are awaited one
 * at a time, as on a single connection.
 */
class TransactionDbClient implements DbClient {
  readonly #tx: TxClient;
  #savepoints = 0;

  constructor(tx: TxClient) {
    this.#tx = tx;
  }

  get $pool(): never {
    throw new Error('A Knowledge transaction view has no pool of its own.');
  }

  connect(): never {
    throw new Error('A Knowledge transaction view has no pool of its own.');
  }

  none: DbClient['none'] = (query, values) => this.#tx.none(query, values);
  one: DbClient['one'] = (query, values) => this.#tx.one(query, values);
  oneOrNone: DbClient['oneOrNone'] = (query, values) => this.#tx.oneOrNone(query, values);
  any: DbClient['any'] = (query, values) => this.#tx.any(query, values);
  manyOrNone: DbClient['manyOrNone'] = (query, values) => this.#tx.manyOrNone(query, values);
  many: DbClient['many'] = (query, values) => this.#tx.many(query, values);
  query: DbClient['query'] = (query, values) => this.#tx.query(query, values);

  tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    const tx = this.#tx;
    if (!(tx instanceof TransactionClient)) {
      return Promise.reject(
        new Error('Knowledge transactions need a client from @mastra/pg (a pool, connection string or PoolAdapter).'),
      );
    }
    return tx.savepoint(`knowledge_sp_${++this.#savepoints}`, () => callback(tx));
  }
}

const transactionClients = new WeakMap<KnowledgeStorage, TxClient>();
const UNWRAP = Symbol.for('mastra.knowledge.unwrap');

/**
 * The transaction behind a {@link KnowledgePG} transaction view, for tables that must commit with
 * the page writes: this package's own, and a host's (an importer host's `admit(tx)` records its
 * claim through it, in the run's start transaction).
 * @experimental
 */
export function pgKnowledgeTransactionClient(view: KnowledgeStorage): TxClient {
  // A `getStorage()` view wraps the adapter's; it answers this key with the view it wraps.
  const tx =
    transactionClients.get(view) ??
    transactionClients.get((view as { [UNWRAP]?: KnowledgeStorage })[UNWRAP] as KnowledgeStorage);
  if (!tx) throw new Error('Not a KnowledgePG transaction view.');
  return tx;
}

type PageStoreMethod = {
  [K in keyof KnowledgePageStore]: KnowledgePageStore[K] extends (...args: never[]) => unknown ? K : never;
}[keyof KnowledgePageStore];

/** @experimental Knowledge APIs are experimental and may change without notice. */
export class KnowledgePG extends KnowledgeStorage {
  static getExportDDL(schemaName?: string): string[] {
    return pgKnowledgePagesDDL(schemaName).map(statement => `${statement};`);
  }

  readonly #client: DbClient;
  readonly #schemaName?: string;
  readonly #pages: PgKnowledgePages;
  readonly #importers?: PgKnowledgeImporters;

  /** The importer tables' DDL, for provisioning them ahead of time when storage init is disabled. */
  static getImportersExportDDL(schemaName?: string): string[] {
    return pgKnowledgeImportersDDL(schemaName).map(statement => `${statement};`);
  }

  constructor(config: PgDomainConfig) {
    super({ storageIsolationKey: config.storageIsolationKey ?? getPgKnowledgeIsolationKey(config) });
    const { client, schemaName } = resolvePgConfig(config);
    this.#client = client;
    this.#schemaName = schemaName;
    if (coreFeatures.has('knowledge-importers')) this.#importers = new PgKnowledgeImporters({ client, schemaName });
    this.#pages = new PgKnowledgePages({
      client,
      schemaName,
      bounds: async () => {
        const core = await loadKnowledgePagesCore();
        return {
          assertKnowledgePageDescriptionWithinBound: core.assertKnowledgePageDescriptionWithinBound,
          assertKnowledgeNoteTextWithinBound: core.assertKnowledgeNoteTextWithinBound,
        };
      },
    });
  }

  override getCapabilities() {
    return {
      ...super.getCapabilities(),
      schemaVersion: KNOWLEDGE_PAGES_SCHEMA_VERSION,
      supportsSchemaInspection: true,
      supportsExplicitReset: true,
      supportsPinKinds: true,
      supportsTransactions: true,
      enforcesTransactionDeadline: true,
      supportsActivityDateRange: true,
      supportsActivityAscending: true,
    } as const;
  }

  /** Same client and schema as the pages: on a transaction view, the view's transaction. */
  override get importers(): PgKnowledgeImporters | undefined {
    return this.#importers;
  }

  async init(): Promise<void> {
    await initPgKnowledgePagesSchema(this.#client, this.#schemaName);
  }

  override async transaction<T>(
    operation: (tx: KnowledgeStorage) => Promise<T>,
    options?: KnowledgeTransactionOptions,
  ): Promise<T> {
    // A view joins its own transaction through a savepoint, under the outer deadline.
    if (transactionClients.has(this)) return this.#client.tx(() => operation(this));
    try {
      return await this.#client.tx(
        tx => {
          const view = new KnowledgePG({
            client: new TransactionDbClient(tx),
            schemaName: this.#schemaName,
            storageIsolationKey: this.getStorageIsolationKey(),
          });
          transactionClients.set(view, tx);
          return operation(view);
        },
        { deadlineAt: options?.deadlineAt },
      );
    } catch (error) {
      if (!(error instanceof TransactionDeadlineError)) throw error;
      // Cores from before transaction deadlines have no class for it; they get the pg error.
      const core = (await import('@mastra/core/storage')) as {
        KnowledgeTransactionDeadlineError?: new (o: object) => Error;
      };
      throw core.KnowledgeTransactionDeadlineError
        ? new core.KnowledgeTransactionDeadlineError({ cause: error })
        : error;
    }
  }

  override async inspectSchema() {
    return inspectPgKnowledgePagesSchema(this.#client, this.#schemaName);
  }

  /** Pages and importer rows go together, in one transaction: no node map outlives its pages. */
  override async dangerouslyReset(): Promise<void> {
    await this.#client.tx(async tx => {
      const client = new TransactionDbClient(tx);
      if (this.#importers) await new PgKnowledgeImporters({ client, schemaName: this.#schemaName }).clearOnReset();
      await resetPgKnowledgePagesSchema(client, this.#schemaName);
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#pages.clearAll();
  }

  /**
   * Run once after any restore that doesn't replay to the end: a logical dump (`pg_dump`/`pg_restore`),
   * a point-in-time recovery, or an older base backup, and after a failover to an asynchronous standby
   * that hadn't received every transaction (the store can't detect that one). Until it runs, logically restored activity
   * stays hidden from oldest-first reads; afterwards, positions handed out before are refused and
   * readers restart from `since`. Not needed after `pg_upgrade` or a physical restore that replays
   * all of the WAL.
   */
  rebaseActivityFeed(): Promise<void> {
    return this.#pages.rebaseActivityFeed();
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

  override listScopeDeclarations(): ReturnType<KnowledgePageStore['listScopeDeclarations']> {
    return this.#pages.listScopeDeclarations();
  }

  override renameScopeDeclaration(
    input: Parameters<KnowledgePageStore['renameScopeDeclaration']>[0],
  ): ReturnType<KnowledgePageStore['renameScopeDeclaration']> {
    return this.#pages.renameScopeDeclaration(input);
  }

  override listChildScopes(
    input: Parameters<KnowledgePageStore['listChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['listChildScopes']> {
    return this.#pages.listChildScopes(input);
  }

  override countChildScopes(
    input: Parameters<KnowledgePageStore['countChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['countChildScopes']> {
    return this.#pages.countChildScopes(input);
  }

  override getPages(input: Parameters<KnowledgePageStore['getPages']>[0]): ReturnType<KnowledgePageStore['getPages']> {
    return this.#pages.getPages(input);
  }

  override lockPages(ids: string[]): Promise<void> {
    return this.#pages.lockPages(ids);
  }

  override lockSubtree(rootId: string): Promise<string[]> {
    return this.#pages.lockSubtree(rootId);
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

  override countChildPages(
    input: Parameters<KnowledgePageStore['countChildPages']>[0],
  ): ReturnType<KnowledgePageStore['countChildPages']> {
    return this.#pages.countChildPages(input);
  }

  override replacePageBodyLinks(
    input: Parameters<KnowledgePageStore['replacePageBodyLinks']>[0],
  ): ReturnType<KnowledgePageStore['replacePageBodyLinks']> {
    return this.#pages.replacePageBodyLinks(input);
  }

  override listPageBodyLinkSources(
    input: Parameters<KnowledgePageStore['listPageBodyLinkSources']>[0],
  ): ReturnType<KnowledgePageStore['listPageBodyLinkSources']> {
    return this.#pages.listPageBodyLinkSources(input);
  }

  override countPageLinks(
    input: Parameters<KnowledgePageStore['countPageLinks']>[0],
  ): ReturnType<KnowledgePageStore['countPageLinks']> {
    return this.#pages.countPageLinks(input);
  }

  override listPageLinks(
    input: Parameters<KnowledgePageStore['listPageLinks']>[0],
  ): ReturnType<KnowledgePageStore['listPageLinks']> {
    return this.#pages.listPageLinks(input);
  }

  override countNotes(
    input: Parameters<KnowledgePageStore['countNotes']>[0],
  ): ReturnType<KnowledgePageStore['countNotes']> {
    return this.#pages.countNotes(input);
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
}

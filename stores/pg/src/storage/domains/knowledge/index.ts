import { createKnowledgePagesCoreLoader, KNOWLEDGE_PAGES_SCHEMA_VERSION } from '@internal/core/knowledge-compat';
import { coreFeatures } from '@mastra/core/features';
import { KnowledgeStorage } from '@mastra/core/storage';
import type { KnowledgePageStore } from '@mastra/core/storage';
import { defaults as pgDefaults } from 'pg';

import type { DbClient, PgDomainConfig } from '../../db';
import { resolvePgConfig } from '../../db';
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

  constructor(config: PgDomainConfig) {
    super({ storageIsolationKey: config.storageIsolationKey ?? getPgKnowledgeIsolationKey(config) });
    const { client, schemaName } = resolvePgConfig(config);
    this.#client = client;
    this.#schemaName = schemaName;
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
    } as const;
  }

  async init(): Promise<void> {
    await initPgKnowledgePagesSchema(this.#client, this.#schemaName);
  }

  override async inspectSchema() {
    return inspectPgKnowledgePagesSchema(this.#client, this.#schemaName);
  }

  override async dangerouslyReset(): Promise<void> {
    await resetPgKnowledgePagesSchema(this.#client, this.#schemaName);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#pages.clearAll();
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

  override getPageByKey(
    input: Parameters<KnowledgePageStore['getPageByKey']>[0],
  ): ReturnType<KnowledgePageStore['getPageByKey']> {
    return this.#pages.getPageByKey(input);
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
}

import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ChannelsStorage,
  createStorageErrorId,
  TABLE_CHANNEL_CONFIG,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type { ChannelConfig, ChannelInstallation, CreateIndexOptions } from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

const INSTALLATIONS = TABLE_CHANNEL_INSTALLATIONS;
const CONFIG = TABLE_CHANNEL_CONFIG;
const WEBHOOK_INDEX = 'mastra_channel_installations_webhookid_idx';

function rowToInstallation(row: Record<string, any>): ChannelInstallation {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: INSTALLATIONS, row });
  return {
    id: String(t.id),
    platform: String(t.platform),
    agentId: String(t.agentId),
    status: t.status as ChannelInstallation['status'],
    webhookId: t.webhookId == null ? undefined : String(t.webhookId),
    data: (t.data ?? {}) as Record<string, unknown>,
    configHash: t.configHash == null ? undefined : String(t.configHash),
    error: t.error == null ? undefined : String(t.error),
    createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt),
  };
}

function rowToConfig(row: Record<string, any>): ChannelConfig {
  const t = transformFromSpannerRow<Record<string, any>>({ tableName: CONFIG, row });
  return {
    platform: String(t.platform),
    data: (t.data ?? {}) as Record<string, unknown>,
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt),
  };
}

/**
 * Spanner-backed storage for multi-platform channel installations and per-platform
 * configuration. Installations live in `mastra_channel_installations` (keyed by
 * `id`); platform config lives in `mastra_channel_config` (keyed by `platform`).
 */
export class ChannelsSpanner extends ChannelsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_CHANNEL_INSTALLATIONS, TABLE_CHANNEL_CONFIG] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (ChannelsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: INSTALLATIONS, schema: TABLE_SCHEMAS[INSTALLATIONS] });
    await this.db.createTable({ tableName: CONFIG, schema: TABLE_SCHEMAS[CONFIG] });
    await this.createDefaultIndexes();
    await this.ensureWebhookUniqueIndex();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        // getInstallationByAgent: WHERE platform = @p AND agentId = @a
        name: 'mastra_channel_installations_platform_agentid_idx',
        table: INSTALLATIONS,
        columns: ['platform', 'agentId'],
      },
      {
        // listInstallations: WHERE platform = @p ORDER BY createdAt DESC
        name: 'mastra_channel_installations_platform_createdat_idx',
        table: INSTALLATIONS,
        columns: ['platform', 'createdAt DESC'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  /**
   * Creates a NULL_FILTERED UNIQUE index on `webhookId`. A plain Spanner UNIQUE
   * index treats NULL as a value and would reject a second installation without a
   * webhook (a legitimate state for pending installs). Created via
   * raw DDL because the shared index helper can't express NULL_FILTERED.
   */
  private async ensureWebhookUniqueIndex(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    // In validate mode the schema is externally owned, never issue DDL, but
    // still verify the expected index is present so a drifted schema is caught.
    if (this.db.initMode === 'validate') {
      if (!(await this.webhookIndexExists())) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'CHANNEL_WEBHOOK_INDEX', 'VALIDATE_FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Index ${WEBHOOK_INDEX} on ${INSTALLATIONS} does not exist (initMode='validate' will not create it)`,
          details: { indexName: WEBHOOK_INDEX, tableName: INSTALLATIONS },
        });
      }
      return;
    }
    if (await this.webhookIndexExists()) return;
    const ddl =
      `CREATE UNIQUE NULL_FILTERED INDEX ${quoteIdent(WEBHOOK_INDEX, 'index name')} ` +
      `ON ${quoteIdent(INSTALLATIONS, 'table name')} (${quoteIdent('webhookId', 'column name')})`;
    try {
      const [operation] = await this.database.updateSchema([ddl]);
      await operation.promise();
    } catch (error) {
      // Tolerate a concurrent creator that won the race, but otherwise surface
      // the failure: this index enforces webhook uniqueness, a data-integrity
      // invariant we must not silently drop (mirrors SpannerDB.createIndexes'
      // handling of unique indexes).
      if (await this.webhookIndexExists()) return;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CHANNEL_WEBHOOK_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName: WEBHOOK_INDEX },
        },
        error,
      );
    }
  }

  /** Returns true when the unique webhookId index already exists. */
  private async webhookIndexExists(): Promise<boolean> {
    const [rows] = await this.database.run({
      sql: `SELECT 1 AS found FROM INFORMATION_SCHEMA.INDEXES
            WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @indexName`,
      params: { indexName: WEBHOOK_INDEX },
      json: true,
    });
    return (rows as unknown[]).length > 0;
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: INSTALLATIONS });
    await this.db.clearTable({ tableName: CONFIG });
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    try {
      const now = new Date();
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [rows] = await tx.run({
              sql: `SELECT ${quoteIdent('id', 'column name')} FROM ${quoteIdent(INSTALLATIONS, 'table name')}
                    WHERE ${quoteIdent('id', 'column name')} = @id LIMIT 1`,
              params: { id: installation.id },
              json: true,
            });
            const data: Record<string, any> = {
              platform: installation.platform,
              agentId: installation.agentId,
              status: installation.status,
              webhookId: installation.webhookId ?? null,
              data: installation.data ?? {},
              configHash: installation.configHash ?? null,
              error: installation.error ?? null,
              updatedAt: now,
            };
            if ((rows as unknown[]).length > 0) {
              // Upsert that preserves the original createdAt
              await this.db.update({ tableName: INSTALLATIONS, keys: { id: installation.id }, data, transaction: tx });
            } else {
              await this.db.insert({
                tableName: INSTALLATIONS,
                record: { id: installation.id, ...data, createdAt: installation.createdAt ?? now },
                transaction: tx,
              });
            }
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'SAVE_INSTALLATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: installation.id, platform: installation.platform },
        },
        error,
      );
    }
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    try {
      const row = await this.db.load<Record<string, any>>({ tableName: INSTALLATIONS, keys: { id } });
      return row ? rowToInstallation(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_INSTALLATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(INSTALLATIONS, 'table name')}
              WHERE ${quoteIdent('platform', 'column name')} = @platform
                AND ${quoteIdent('agentId', 'column name')} = @agentId
              ORDER BY CASE ${quoteIdent('status', 'column name')}
                         WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                       ${quoteIdent('updatedAt', 'column name')} DESC
              LIMIT 1`,
        params: { platform, agentId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? rowToInstallation(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_INSTALLATION_BY_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { platform, agentId },
        },
        error,
      );
    }
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(INSTALLATIONS, 'table name')}
              WHERE ${quoteIdent('webhookId', 'column name')} = @webhookId LIMIT 1`,
        params: { webhookId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? rowToInstallation(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_INSTALLATION_BY_WEBHOOK_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { webhookId },
        },
        error,
      );
    }
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(INSTALLATIONS, 'table name')}
              WHERE ${quoteIdent('platform', 'column name')} = @platform
              ORDER BY ${quoteIdent('createdAt', 'column name')} DESC`,
        params: { platform },
        json: true,
      });
      return (rows as Array<Record<string, any>>).map(rowToInstallation);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_INSTALLATIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { platform },
        },
        error,
      );
    }
  }

  async deleteInstallation(id: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(INSTALLATIONS, 'table name')} WHERE ${quoteIdent('id', 'column name')} = @id`,
        params: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_INSTALLATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    try {
      await this.db.upsert({
        tableName: CONFIG,
        record: {
          platform: config.platform,
          data: config.data ?? {},
          updatedAt: config.updatedAt ?? new Date(),
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'SAVE_CONFIG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { platform: config.platform },
        },
        error,
      );
    }
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    try {
      const row = await this.db.load<Record<string, any>>({ tableName: CONFIG, keys: { platform } });
      return row ? rowToConfig(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_CONFIG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { platform },
        },
        error,
      );
    }
  }

  async deleteConfig(platform: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(CONFIG, 'table name')} WHERE ${quoteIdent('platform', 'column name')} = @platform`,
        params: { platform },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_CONFIG', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { platform },
        },
        error,
      );
    }
  }
}

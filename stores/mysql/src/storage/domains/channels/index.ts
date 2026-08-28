import {
  ChannelsStorage,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_CHANNEL_CONFIG,
  TABLE_CHANNEL_STATE,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type { ChannelInstallation, ChannelConfig, ChannelStateEntry, CreateIndexOptions } from '@mastra/core/storage';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL, generateIndexSQL } from '../operations';
import { formatTableName, quoteIdentifier, transformToSqlValue, parseDateTime } from '../utils';

/** `key` is a MySQL reserved word, so these must stay quoted. */
const COL = {
  ownerId: quoteIdentifier('ownerId', 'column name'),
  key: quoteIdentifier('key', 'column name'),
  value: quoteIdentifier('value', 'column name'),
  expiresAt: quoteIdentifier('expiresAt', 'column name'),
  createdAt: quoteIdentifier('createdAt', 'column name'),
  updatedAt: quoteIdentifier('updatedAt', 'column name'),
} as const;

const sqlNow = () => transformToSqlValue(new Date());

export class ChannelsMySQL extends ChannelsStorage {
  override readonly supportsChannelState = true;

  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_CHANNEL_INSTALLATIONS, TABLE_CHANNEL_CONFIG, TABLE_CHANNEL_STATE] as const;

  constructor({
    pool,
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    pool: Pool;
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (ChannelsMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.operations.createTable({
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      schema: TABLE_SCHEMAS[TABLE_CHANNEL_INSTALLATIONS],
    });
    await this.operations.createTable({
      tableName: TABLE_CHANNEL_CONFIG,
      schema: TABLE_SCHEMAS[TABLE_CHANNEL_CONFIG],
    });
    await this.operations.createTable({
      tableName: TABLE_CHANNEL_STATE,
      schema: TABLE_SCHEMAS[TABLE_CHANNEL_STATE],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(prefix: string = ''): CreateIndexOptions[] {
    return [
      {
        name: `${prefix}idx_channel_installations_webhook`,
        table: TABLE_CHANNEL_INSTALLATIONS,
        columns: ['webhookId'],
        unique: true,
      },
      {
        name: `${prefix}idx_channel_installations_platform_agent`,
        table: TABLE_CHANNEL_INSTALLATIONS,
        columns: ['platform', 'agentId'],
      },
      {
        name: `${prefix}idx_channel_state_expires_at`,
        table: TABLE_CHANNEL_STATE,
        columns: ['expiresAt'],
      },
    ];
  }

  static getExportDDL(): string[] {
    const statements: string[] = [];

    for (const tableName of ChannelsMySQL.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
        }),
      );
    }

    for (const idx of ChannelsMySQL.getDefaultIndexDefs()) {
      statements.push(generateIndexSQL(idx));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return ChannelsMySQL.getDefaultIndexDefs('');
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      await this.operations.createIndex(indexDef);
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_CHANNEL_INSTALLATIONS });
    await this.operations.clearTable({ tableName: TABLE_CHANNEL_CONFIG });
    await this.operations.clearTable({ tableName: TABLE_CHANNEL_STATE });
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    const now = new Date();
    await this.pool.execute(
      `INSERT INTO ${formatTableName(TABLE_CHANNEL_INSTALLATIONS)} (${quoteIdentifier('id', 'column name')}, ${quoteIdentifier('platform', 'column name')}, ${quoteIdentifier('agentId', 'column name')}, ${quoteIdentifier('status', 'column name')}, ${quoteIdentifier('webhookId', 'column name')}, ${quoteIdentifier('data', 'column name')}, ${quoteIdentifier('configHash', 'column name')}, ${quoteIdentifier('error', 'column name')}, ${quoteIdentifier('createdAt', 'column name')}, ${quoteIdentifier('updatedAt', 'column name')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ${quoteIdentifier('platform', 'column name')} = VALUES(${quoteIdentifier('platform', 'column name')}), ${quoteIdentifier('agentId', 'column name')} = VALUES(${quoteIdentifier('agentId', 'column name')}), ${quoteIdentifier('status', 'column name')} = VALUES(${quoteIdentifier('status', 'column name')}), ${quoteIdentifier('webhookId', 'column name')} = VALUES(${quoteIdentifier('webhookId', 'column name')}), ${quoteIdentifier('data', 'column name')} = VALUES(${quoteIdentifier('data', 'column name')}), ${quoteIdentifier('configHash', 'column name')} = VALUES(${quoteIdentifier('configHash', 'column name')}), ${quoteIdentifier('error', 'column name')} = VALUES(${quoteIdentifier('error', 'column name')}), ${quoteIdentifier('updatedAt', 'column name')} = VALUES(${quoteIdentifier('updatedAt', 'column name')})`,
      [
        installation.id,
        installation.platform,
        installation.agentId,
        installation.status,
        installation.webhookId ?? null,
        JSON.stringify(installation.data),
        installation.configHash ?? null,
        installation.error ?? null,
        transformToSqlValue(installation.createdAt ?? now),
        transformToSqlValue(now),
      ],
    );
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_CHANNEL_INSTALLATIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [id],
    );
    const row = rows[0];
    return row ? this.parseInstallationRow(row) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_CHANNEL_INSTALLATIONS)} WHERE ${quoteIdentifier('platform', 'column name')} = ? AND ${quoteIdentifier('agentId', 'column name')} = ? ORDER BY CASE ${quoteIdentifier('status', 'column name')} WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, ${quoteIdentifier('updatedAt', 'column name')} DESC LIMIT 1`,
      [platform, agentId],
    );
    const row = rows[0];
    return row ? this.parseInstallationRow(row) : null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_CHANNEL_INSTALLATIONS)} WHERE ${quoteIdentifier('webhookId', 'column name')} = ?`,
      [webhookId],
    );
    const row = rows[0];
    return row ? this.parseInstallationRow(row) : null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_CHANNEL_INSTALLATIONS)} WHERE ${quoteIdentifier('platform', 'column name')} = ? ORDER BY ${quoteIdentifier('createdAt', 'column name')} DESC`,
      [platform],
    );
    return rows.map(row => this.parseInstallationRow(row));
  }

  async deleteInstallation(id: string): Promise<void> {
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_CHANNEL_INSTALLATIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [id],
    );
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    await this.pool.execute(
      `INSERT INTO ${formatTableName(TABLE_CHANNEL_CONFIG)} (${quoteIdentifier('platform', 'column name')}, ${quoteIdentifier('data', 'column name')}, ${quoteIdentifier('updatedAt', 'column name')}) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ${quoteIdentifier('data', 'column name')} = VALUES(${quoteIdentifier('data', 'column name')}), ${quoteIdentifier('updatedAt', 'column name')} = VALUES(${quoteIdentifier('updatedAt', 'column name')})`,
      [config.platform, JSON.stringify(config.data), transformToSqlValue(config.updatedAt)],
    );
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_CHANNEL_CONFIG)} WHERE ${quoteIdentifier('platform', 'column name')} = ?`,
      [platform],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      platform: row.platform as string,
      data: typeof row.data === 'string' ? JSON.parse(row.data || '{}') : row.data,
      updatedAt: parseDateTime(row.updatedAt) ?? new Date(),
    };
  }

  async deleteConfig(platform: string): Promise<void> {
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_CHANNEL_CONFIG)} WHERE ${quoteIdentifier('platform', 'column name')} = ?`,
      [platform],
    );
  }

  async getState(ownerId: string, key: string): Promise<ChannelStateEntry | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT ${COL.value} FROM ${formatTableName(TABLE_CHANNEL_STATE)}
       WHERE ${COL.ownerId} = ? AND ${COL.key} = ? AND (${COL.expiresAt} IS NULL OR ${COL.expiresAt} > ?)`,
      [ownerId, key, Date.now()],
    );
    const row = rows[0];
    if (!row) return null;
    // mysql2 already decodes JSON columns, so row.value is the value itself, not JSON text.
    return { value: row.value };
  }

  async setState(ownerId: string, key: string, value: unknown, expiresAt: number | null): Promise<void> {
    await this.pool.execute(
      `INSERT INTO ${formatTableName(TABLE_CHANNEL_STATE)}
         (${COL.ownerId}, ${COL.key}, ${COL.value}, ${COL.expiresAt}, ${COL.createdAt}, ${COL.updatedAt})
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ${COL.value} = VALUES(${COL.value}),
         ${COL.expiresAt} = VALUES(${COL.expiresAt}),
         ${COL.updatedAt} = VALUES(${COL.updatedAt})`,
      [ownerId, key, JSON.stringify(value ?? null), expiresAt, sqlNow(), sqlNow()],
    );
  }

  async setStateIfNotExists(ownerId: string, key: string, value: unknown, expiresAt: number | null): Promise<boolean> {
    // Not an upsert: mysql2 connects with CLIENT_FOUND_ROWS, so `ON DUPLICATE KEY UPDATE`
    // reports affectedRows=1 for a row it matched but did not change — indistinguishable
    // from a fresh insert. INSERT IGNORE reports a clean 1/0. The DELETE is scoped to
    // expired rows, so a live claim survives it and the INSERT is then refused by the
    // unique key, which also resolves racing callers.
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_CHANNEL_STATE)}
       WHERE ${COL.ownerId} = ? AND ${COL.key} = ? AND ${COL.expiresAt} IS NOT NULL AND ${COL.expiresAt} <= ?`,
      [ownerId, key, Date.now()],
    );
    // INSERT IGNORE hides every error, not just the duplicate-key one this relies on. Safe
    // here because the only bound values are JSON.stringify output and a number|null.
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT IGNORE INTO ${formatTableName(TABLE_CHANNEL_STATE)}
         (${COL.ownerId}, ${COL.key}, ${COL.value}, ${COL.expiresAt}, ${COL.createdAt}, ${COL.updatedAt})
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ownerId, key, JSON.stringify(value ?? null), expiresAt, sqlNow(), sqlNow()],
    );
    return result.affectedRows > 0;
  }

  async deleteState(ownerId: string, key: string): Promise<void> {
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_CHANNEL_STATE)} WHERE ${COL.ownerId} = ? AND ${COL.key} = ?`,
      [ownerId, key],
    );
  }

  async deleteExpiredState(now: number): Promise<void> {
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_CHANNEL_STATE)}
       WHERE ${COL.expiresAt} IS NOT NULL AND ${COL.expiresAt} <= ?`,
      [now],
    );
  }

  private parseInstallationRow(row: Record<string, unknown>): ChannelInstallation {
    return {
      id: row.id as string,
      platform: row.platform as string,
      agentId: row.agentId as string,
      status: row.status as 'pending' | 'active' | 'error',
      webhookId: (row.webhookId as string) || undefined,
      data: typeof row.data === 'string' ? JSON.parse(row.data || '{}') : row.data,
      configHash: (row.configHash as string) || undefined,
      error: (row.error as string) || undefined,
      createdAt: parseDateTime(row.createdAt as string | number | Date | null | undefined) ?? new Date(),
      updatedAt: parseDateTime(row.updatedAt as string | number | Date | null | undefined) ?? new Date(),
    };
  }
}

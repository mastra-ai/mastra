import { BlobStore, TABLE_SKILL_BLOBS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { StorageBlobEntry } from '@mastra/core/storage';

import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class BlobsPG extends BlobStore {
  #db: PgDB;
  #schema: string;

  static readonly MANAGED_TABLES = [TABLE_SKILL_BLOBS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_SKILL_BLOBS,
      schema: TABLE_SCHEMAS[TABLE_SKILL_BLOBS],
    });
  }

  async put(entry: StorageBlobEntry): Promise<void> {
    const tableName = getTableName({ indexName: TABLE_SKILL_BLOBS, schemaName: getSchemaName(this.#schema) });
    const now = entry.createdAt ?? new Date();
    const nowIso = now.toISOString();
    await this.#db.client.none(
      `INSERT INTO ${tableName} ("hash", "content", "size", "mimeType", "createdAt", "createdAtZ")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("hash") DO NOTHING`,
      [entry.hash, entry.content, entry.size, entry.mimeType ?? null, nowIso, nowIso],
    );
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    const tableName = getTableName({ indexName: TABLE_SKILL_BLOBS, schemaName: getSchemaName(this.#schema) });
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "hash" = $1`, [hash]);
    if (!row) return null;
    return this.#parseRow(row);
  }

  async has(hash: string): Promise<boolean> {
    const tableName = getTableName({ indexName: TABLE_SKILL_BLOBS, schemaName: getSchemaName(this.#schema) });
    const row = await this.#db.client.oneOrNone(`SELECT 1 FROM ${tableName} WHERE "hash" = $1 LIMIT 1`, [hash]);
    return row !== null;
  }

  async delete(hash: string): Promise<boolean> {
    const tableName = getTableName({ indexName: TABLE_SKILL_BLOBS, schemaName: getSchemaName(this.#schema) });
    const result = await this.#db.client.query(`DELETE FROM ${tableName} WHERE "hash" = $1`, [hash]);
    return (result.rowCount ?? 0) > 0;
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;
    for (const entry of entries) {
      await this.put(entry);
    }
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;

    const tableName = getTableName({ indexName: TABLE_SKILL_BLOBS, schemaName: getSchemaName(this.#schema) });
    const placeholders = hashes.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.#db.client.manyOrNone(
      `SELECT * FROM ${tableName} WHERE "hash" IN (${placeholders})`,
      hashes,
    );
    for (const row of rows) {
      const entry = this.#parseRow(row);
      result.set(entry.hash, entry);
    }
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SKILL_BLOBS });
  }

  #parseRow(row: Record<string, unknown>): StorageBlobEntry {
    return {
      hash: row.hash as string,
      content: row.content as string,
      size: Number(row.size),
      mimeType: (row.mimeType as string) || undefined,
      createdAt: new Date((row.createdAtZ as string) || (row.createdAt as string)),
    };
  }
}

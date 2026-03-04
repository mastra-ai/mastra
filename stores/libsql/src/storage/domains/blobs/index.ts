import type { Client } from '@libsql/client';
import { BlobStore, TABLE_SKILL_BLOBS, SKILL_BLOBS_SCHEMA } from '@mastra/core/storage';
import type { StorageBlobEntry } from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class BlobsLibSQL extends BlobStore {
  #db: LibSQLDB;
  #client: Client;

  static readonly MANAGED_TABLES = [TABLE_SKILL_BLOBS] as const;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SKILL_BLOBS, schema: SKILL_BLOBS_SCHEMA });
  }

  async put(entry: StorageBlobEntry): Promise<void> {
    const now = entry.createdAt ?? new Date();
    await this.#client.execute({
      sql: `INSERT OR IGNORE INTO "${TABLE_SKILL_BLOBS}" ("hash", "content", "size", "mimeType", "createdAt") VALUES (?, ?, ?, ?, ?)`,
      args: [entry.hash, entry.content, entry.size, entry.mimeType ?? null, now.toISOString()],
    });
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SKILL_BLOBS)} FROM "${TABLE_SKILL_BLOBS}" WHERE "hash" = ?`,
      args: [hash],
    });
    if (!result.rows.length) return null;
    return this.#parseRow(result.rows[0]!);
  }

  async has(hash: string): Promise<boolean> {
    const result = await this.#client.execute({
      sql: `SELECT 1 FROM "${TABLE_SKILL_BLOBS}" WHERE "hash" = ? LIMIT 1`,
      args: [hash],
    });
    return result.rows.length > 0;
  }

  async delete(hash: string): Promise<boolean> {
    const result = await this.#client.execute({
      sql: `DELETE FROM "${TABLE_SKILL_BLOBS}" WHERE "hash" = ?`,
      args: [hash],
    });
    return result.rowsAffected > 0;
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.#db.batchInsert({
      tableName: TABLE_SKILL_BLOBS,
      records: entries.map(entry => ({
        hash: entry.hash,
        content: entry.content,
        size: entry.size,
        mimeType: entry.mimeType ?? null,
        createdAt: (entry.createdAt ?? new Date()).toISOString(),
      })),
    });
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;

    // SQLite has a limit on the number of parameters, batch in groups of 500
    const batchSize = 500;
    for (let i = 0; i < hashes.length; i += batchSize) {
      const batch = hashes.slice(i, i + batchSize);
      const placeholders = batch.map(() => '?').join(', ');
      const queryResult = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_SKILL_BLOBS)} FROM "${TABLE_SKILL_BLOBS}" WHERE "hash" IN (${placeholders})`,
        args: batch,
      });
      for (const row of queryResult.rows) {
        const entry = this.#parseRow(row);
        result.set(entry.hash, entry);
      }
    }
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SKILL_BLOBS });
  }

  #parseRow(row: Record<string, unknown>): StorageBlobEntry {
    return {
      hash: row.hash as string,
      content: row.content as string,
      size: Number(row.size),
      mimeType: (row.mimeType as string) || undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}

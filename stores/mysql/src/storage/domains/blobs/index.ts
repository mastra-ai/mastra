import type { Pool, RowDataPacket } from 'mysql2/promise';
import { BlobStore, TABLE_SKILL_BLOBS, SKILL_BLOBS_SCHEMA } from '@mastra/core/storage';
import type { StorageBlobEntry } from '@mastra/core/storage';

import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, quoteIdentifier, transformToSqlValue } from '../utils';

export class BlobsMySQL extends BlobStore {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SKILL_BLOBS, schema: SKILL_BLOBS_SCHEMA });
  }

  async put(entry: StorageBlobEntry): Promise<void> {
    const now = entry.createdAt ?? new Date();
    await this.pool.execute(
      `INSERT IGNORE INTO ${formatTableName(TABLE_SKILL_BLOBS)} (${quoteIdentifier('hash', 'column name')}, ${quoteIdentifier('content', 'column name')}, ${quoteIdentifier('size', 'column name')}, ${quoteIdentifier('mimeType', 'column name')}, ${quoteIdentifier('createdAt', 'column name')}) VALUES (?, ?, ?, ?, ?)`,
      [entry.hash, entry.content, entry.size, entry.mimeType ?? null, transformToSqlValue(now)],
    );
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_SKILL_BLOBS)} WHERE ${quoteIdentifier('hash', 'column name')} = ?`,
      [hash],
    );
    if (!rows.length) return null;
    return this.#parseRow(rows[0]!);
  }

  async has(hash: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${formatTableName(TABLE_SKILL_BLOBS)} WHERE ${quoteIdentifier('hash', 'column name')} = ? LIMIT 1`,
      [hash],
    );
    return rows.length > 0;
  }

  async delete(hash: string): Promise<boolean> {
    const [result] = await this.pool.execute<any>(
      `DELETE FROM ${formatTableName(TABLE_SKILL_BLOBS)} WHERE ${quoteIdentifier('hash', 'column name')} = ?`,
      [hash],
    );
    return result.affectedRows > 0;
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.operations.batchInsert({
      tableName: TABLE_SKILL_BLOBS,
      records: entries.map(entry => ({
        hash: entry.hash,
        content: entry.content,
        size: entry.size,
        mimeType: entry.mimeType ?? null,
        createdAt: entry.createdAt ?? new Date(),
      })),
    });
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;

    const batchSize = 500;
    for (let i = 0; i < hashes.length; i += batchSize) {
      const batch = hashes.slice(i, i + batchSize);
      const placeholders = batch.map(() => '?').join(', ');
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_SKILL_BLOBS)} WHERE ${quoteIdentifier('hash', 'column name')} IN (${placeholders})`,
        batch,
      );
      for (const row of rows) {
        const entry = this.#parseRow(row);
        result.set(entry.hash, entry);
      }
    }
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SKILL_BLOBS });
  }

  #parseRow(row: Record<string, unknown>): StorageBlobEntry {
    return {
      hash: row.hash as string,
      content: row.content as string,
      size: Number(row.size),
      mimeType: (row.mimeType as string) || undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }
}

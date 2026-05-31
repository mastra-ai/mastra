import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { BlobStore, createStorageErrorId, SKILL_BLOBS_SCHEMA, TABLE_SKILL_BLOBS } from '@mastra/core/storage';
import type { CreateIndexOptions, StorageBlobEntry } from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

/**
 * Content-addressable blob store backed by Spanner. Blobs are keyed by their
 * SHA-256 hash; duplicate puts are no-ops thanks to `INSERT OR IGNORE`.
 */
export class BlobsSpanner extends BlobStore {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SKILL_BLOBS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (BlobsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /** Creates the blobs table and any caller-supplied custom indexes. */
  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SKILL_BLOBS, schema: SKILL_BLOBS_SCHEMA });
    await this.createCustomIndexes();
  }

  /** Creates custom indexes routed to the blobs table; no-op when none supplied. */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  /** Removes every row from the blobs table. Intended for tests. */
  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SKILL_BLOBS });
  }

  /** Decodes a raw Spanner row into the public `StorageBlobEntry` shape. */
  private parseRow(row: Record<string, any>): StorageBlobEntry {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_SKILL_BLOBS, row });
    return {
      hash: transformed.hash,
      content: transformed.content,
      size: Number(transformed.size),
      mimeType: transformed.mimeType ?? undefined,
      createdAt: transformed.createdAt,
    };
  }

  /** Stores a single blob keyed by its hash. Idempotent: a repeat hash is a no-op. */
  async put(entry: StorageBlobEntry): Promise<void> {
    try {
      // INSERT OR IGNORE makes the call idempotent for content-addressable
      // hashes. A repeat put with the same hash is a no-op.
      const sql = `INSERT OR IGNORE INTO ${quoteIdent(TABLE_SKILL_BLOBS, 'table name')} (
        ${quoteIdent('hash', 'column name')},
        ${quoteIdent('content', 'column name')},
        ${quoteIdent('size', 'column name')},
        ${quoteIdent('mimeType', 'column name')},
        ${quoteIdent('createdAt', 'column name')}
      ) VALUES (@hash, @content, @size, @mimeType, @createdAt)`;
      await this.db.runDml({
        sql,
        params: {
          hash: entry.hash,
          content: entry.content,
          size: entry.size,
          mimeType: entry.mimeType ?? null,
          createdAt: (entry.createdAt ?? new Date()).toISOString(),
        },
        // createdAt must be hinted as TIMESTAMP, otherwise the client infers
        // STRING from the ISO payload and the bind fails the STRING -> TIMESTAMP
        // coercion (matches the rule applied in SpannerDB.insert).
        types: {
          createdAt: 'timestamp',
          ...(entry.mimeType == null ? { mimeType: 'string' } : {}),
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BLOB_PUT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash: entry.hash },
        },
        error,
      );
    }
  }

  /** Fetches a blob by its hash, or `null` when no row matches. */
  async get(hash: string): Promise<StorageBlobEntry | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SKILL_BLOBS, 'table name')} WHERE ${quoteIdent('hash', 'column name')} = @hash LIMIT 1`,
        params: { hash },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseRow(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BLOB_GET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash },
        },
        error,
      );
    }
  }

  /** Returns true when a blob with the given hash exists; cheaper than `get`. */
  async has(hash: string): Promise<boolean> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT 1 AS found FROM ${quoteIdent(TABLE_SKILL_BLOBS, 'table name')} WHERE ${quoteIdent('hash', 'column name')} = @hash LIMIT 1`,
        params: { hash },
        json: true,
      });
      return (rows as unknown[]).length > 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BLOB_HAS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash },
        },
        error,
      );
    }
  }

  /** Deletes the blob with the given hash. Returns true when a row was removed. */
  async delete(hash: string): Promise<boolean> {
    try {
      const rowCount = await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_SKILL_BLOBS, 'table name')} WHERE ${quoteIdent('hash', 'column name')} = @hash`,
        params: { hash },
      });
      return rowCount > 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BLOB_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash },
        },
        error,
      );
    }
  }

  /** Atomically stores a batch of blobs in a single Spanner transaction. */
  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      // Wrap all inserts in a single transaction so that the whole batch either
      // commits or fails together. INSERT OR IGNORE keeps repeat hashes safe.
      const tableName = quoteIdent(TABLE_SKILL_BLOBS, 'table name');
      const insertSql = `INSERT OR IGNORE INTO ${tableName} (
        ${quoteIdent('hash', 'column name')},
        ${quoteIdent('content', 'column name')},
        ${quoteIdent('size', 'column name')},
        ${quoteIdent('mimeType', 'column name')},
        ${quoteIdent('createdAt', 'column name')}
      ) VALUES (@hash, @content, @size, @mimeType, @createdAt)`;
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            for (const entry of entries) {
              await tx.runUpdate({
                sql: insertSql,
                params: {
                  hash: entry.hash,
                  content: entry.content,
                  size: entry.size,
                  mimeType: entry.mimeType ?? null,
                  createdAt: (entry.createdAt ?? new Date()).toISOString(),
                },
                types: {
                  createdAt: 'timestamp',
                  ...(entry.mimeType == null ? { mimeType: 'string' } : {}),
                },
              });
            }
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BLOB_PUT_MANY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: entries.length },
        },
        error,
      );
    }
  }

  /** Fetches multiple blobs by hash in chunks of 500. Missing hashes are absent from the map. */
  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;
    try {
      const tableName = quoteIdent(TABLE_SKILL_BLOBS, 'table name');
      const batchSize = 500;
      for (let i = 0; i < hashes.length; i += batchSize) {
        const batch = hashes.slice(i, i + batchSize);
        const [rows] = await this.database.run({
          sql: `SELECT * FROM ${tableName} WHERE ${quoteIdent('hash', 'column name')} IN UNNEST(@hashes)`,
          params: { hashes: batch },
          types: { hashes: { type: 'array', child: { type: 'string' } } },
          json: true,
        });
        for (const row of rows as Array<Record<string, any>>) {
          const entry = this.parseRow(row);
          result.set(entry.hash, entry);
        }
      }
      return result;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BLOB_GET_MANY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: hashes.length },
        },
        error,
      );
    }
  }
}

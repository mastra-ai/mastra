import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DeleteVectorsParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '@mastra/core/vector';
import { escapeIdent, recordKey, SurrealDBConnector } from '../shared/connector';
import type { SurrealDBDomainConfig } from '../shared/connector';
import { SurrealFilterTranslator } from './filter';
import type { SurrealVectorFilter } from './filter';

export type { SurrealVectorFilter } from './filter';
export { SurrealFilterTranslator } from './filter';

type Metric = NonNullable<CreateIndexParams['metric']>;

export type SurrealVectorConfig = SurrealDBDomainConfig & {
  id: string;
  /**
   * HNSW candidate list size used at query time (`<|k, ef|>`); higher is more accurate and slower.
   * The effective value is never below `topK`.
   * @default 64
   */
  efSearch?: number;
};

/** Registry of vector indexes (one SurrealDB table each) with their dimension and metric. */
const REGISTRY_TABLE = 'mastra_vector_index';

const INDEX_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** HNSW distance for each metric; dot product has no HNSW distance and is searched exactly. */
const HNSW_DISTANCE: Partial<Record<Metric, string>> = { cosine: 'COSINE', euclidean: 'EUCLIDEAN' };

/** Rows are written in batches so very large upserts stay well under request size limits. */
const UPSERT_BATCH_SIZE = 500;

interface IndexInfo {
  dimension: number;
  metric: Metric;
}

/**
 * SurrealDB vector store. Each index is a table with an `embedding` field indexed by HNSW and a
 * `metadata` object; queries run as SurrealQL KNN searches with metadata filters applied in the
 * same statement.
 *
 * @example
 * ```typescript
 * const vector = new SurrealVector({
 *   id: 'surrealdb-vector',
 *   url: 'ws://localhost:8000',
 *   username: 'root',
 *   password: 'root',
 * });
 *
 * await vector.createIndex({ indexName: 'docs', dimension: 1536 });
 * await vector.upsert({ indexName: 'docs', vectors, metadata });
 * const results = await vector.query({ indexName: 'docs', queryVector, topK: 5, filter: { source: 'faq' } });
 * ```
 */
export class SurrealVector extends MastraVector<SurrealVectorFilter> {
  #connector: SurrealDBConnector;
  #efSearch: number;
  #indexes = new Map<string, IndexInfo>();
  #ready?: Promise<void>;

  constructor({ id, efSearch, ...config }: SurrealVectorConfig) {
    super({ id });
    this.#connector = SurrealDBConnector.from(config as SurrealDBDomainConfig);
    this.#efSearch = efSearch ?? 64;
  }

  /** Opens the connection and defines the namespace, database and index registry (once). */
  #init(): Promise<void> {
    this.#ready ??= (async () => {
      await this.#connector.ensureDatabase();
      await this.#connector.query(
        `DEFINE TABLE IF NOT EXISTS ${REGISTRY_TABLE} SCHEMAFULL;
         DEFINE FIELD IF NOT EXISTS dimension ON ${REGISTRY_TABLE} TYPE int;
         DEFINE FIELD IF NOT EXISTS metric ON ${REGISTRY_TABLE} TYPE string;`,
      );
    })().catch(error => {
      this.#ready = undefined;
      throw error;
    });
    return this.#ready;
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    try {
      validateIndexName(indexName);
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }
      if (!['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
        throw new Error(`Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`);
      }
    } catch (error) {
      throw this.#error('CREATE_INDEX', 'INVALID_ARGS', error, { indexName }, ErrorCategory.USER);
    }

    try {
      await this.#init();
      const existing = await this.#lookupIndex(indexName);
      if (existing) {
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }

      const table = escapeIdent(indexName);
      const distance = HNSW_DISTANCE[metric];
      await this.#connector.transaction(
        [
          `DEFINE TABLE IF NOT EXISTS ${table} SCHEMAFULL`,
          `DEFINE FIELD IF NOT EXISTS embedding ON ${table} TYPE array<float>`,
          `DEFINE FIELD IF NOT EXISTS metadata ON ${table} TYPE option<object> FLEXIBLE`,
          ...(distance
            ? [
                `DEFINE INDEX IF NOT EXISTS ${escapeIdent(`${indexName}_hnsw`)} ON ${table} FIELDS embedding HNSW DIMENSION ${dimension} DIST ${distance} TYPE F32`,
              ]
            : []),
          `UPSERT type::record('${REGISTRY_TABLE}', $name) CONTENT { dimension: $dimension, metric: $metric } RETURN NONE`,
        ],
        { name: indexName, dimension, metric },
      );
      this.#indexes.set(indexName, { dimension, metric });
    } catch (error) {
      throw this.#error('CREATE_INDEX', 'FAILED', error, { indexName, dimension, metric });
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      await this.#init();
      const ids = await this.#connector.queryAll<unknown>(`SELECT VALUE id FROM ${REGISTRY_TABLE}`);
      return ids.map(recordKey);
    } catch (error) {
      throw this.#error('LIST_INDEXES', 'FAILED', error);
    }
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const info = await this.#requireIndex('DESCRIBE_INDEX', indexName);
    try {
      const [count] = await this.#connector.query<[number]>(
        `RETURN (SELECT count() AS count FROM ${escapeIdent(indexName)} GROUP ALL)[0].count ?? 0`,
      );
      return { dimension: info.dimension, metric: info.metric, count: Number(count ?? 0) };
    } catch (error) {
      throw this.#error('DESCRIBE_INDEX', 'FAILED', error, { indexName });
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      validateIndexName(indexName);
      await this.#init();
      await this.#connector.transaction(
        [`REMOVE TABLE IF EXISTS ${escapeIdent(indexName)}`, `DELETE type::record('${REGISTRY_TABLE}', $name)`],
        { name: indexName },
      );
      this.#indexes.delete(indexName);
    } catch (error) {
      throw this.#error('DELETE_INDEX', 'FAILED', error, { indexName });
    }
  }

  async upsert({ indexName, vectors, metadata, ids, deleteFilter }: UpsertVectorParams): Promise<string[]> {
    const info = await this.#requireIndex('UPSERT', indexName);
    try {
      if (!Array.isArray(vectors) || vectors.length === 0) throw new Error('vectors must be a non-empty array');
      if (metadata && metadata.length !== vectors.length) {
        throw new Error(`metadata length (${metadata.length}) must match vectors length (${vectors.length})`);
      }
      if (ids && ids.length !== vectors.length) {
        throw new Error(`ids length (${ids.length}) must match vectors length (${vectors.length})`);
      }
      vectors.forEach(vector => validateVector(vector, info.dimension));
    } catch (error) {
      throw this.#error('UPSERT', 'INVALID_ARGS', error, { indexName }, ErrorCategory.USER);
    }

    try {
      const vectorIds = ids ?? vectors.map(() => crypto.randomUUID());
      const rows = vectors.map((embedding, i) => ({
        id: vectorIds[i],
        embedding,
        metadata: toMetadata(metadata?.[i]),
      }));
      const table = escapeIdent(indexName);
      const bindings: Record<string, unknown> = {};
      const deleteCondition = deleteFilter
        ? new SurrealFilterTranslator().translate(deleteFilter as SurrealVectorFilter, bindings)
        : undefined;

      const insert = (param: string) =>
        `INSERT INTO ${table} $${param} ON DUPLICATE KEY UPDATE embedding = $input.embedding, metadata = $input.metadata RETURN NONE`;

      if (deleteCondition) {
        // The delete and every insert batch commit together, so a failed batch never
        // leaves the old rows deleted and only part of the replacement written.
        const statements = [`DELETE ${table} WHERE ${deleteCondition}`];
        const batchBindings: Record<string, unknown> = { ...bindings };
        for (let start = 0, batch = 0; start < rows.length; start += UPSERT_BATCH_SIZE, batch++) {
          batchBindings[`rows${batch}`] = rows.slice(start, start + UPSERT_BATCH_SIZE);
          statements.push(insert(`rows${batch}`));
        }
        await this.#connector.transaction(statements, batchBindings);
        return vectorIds;
      }

      for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE) {
        await this.#connector.transaction([insert('rows')], { rows: rows.slice(start, start + UPSERT_BATCH_SIZE) });
      }
      return vectorIds;
    } catch (error) {
      throw this.#error('UPSERT', 'FAILED', error, { indexName, count: vectors.length });
    }
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: QueryVectorParams<SurrealVectorFilter>): Promise<QueryResult[]> {
    const info = await this.#requireIndex('QUERY', indexName);
    let condition: string | undefined;
    const bindings: Record<string, unknown> = {};
    try {
      if (!Number.isInteger(topK) || topK <= 0) throw new Error('topK must be a positive integer');
      if (!queryVector) throw new Error('queryVector is required');
      validateVector(queryVector, info.dimension);
      condition = new SurrealFilterTranslator().translate(filter, bindings);
    } catch (error) {
      throw this.#error('QUERY', 'INVALID_ARGS', error, { indexName }, ErrorCategory.USER);
    }

    try {
      const table = escapeIdent(indexName);
      const fields = `id, metadata${includeVector ? ', embedding' : ''}`;
      bindings.vector = queryVector;
      bindings.topK = topK;

      let rows: Array<{ id: unknown; metadata?: Record<string, unknown>; embedding?: number[]; score: number }>;
      if (info.metric === 'dotproduct') {
        rows = await this.#connector.queryAll(
          `SELECT ${fields}, vector::dot(embedding, $vector) AS score FROM ${table}
             ${condition ? `WHERE ${condition}` : ''} ORDER BY score DESC LIMIT $topK`,
          bindings,
        );
      } else {
        // HNSW search; the filter is applied during the search, not after it.
        const ef = Math.max(this.#efSearch, topK);
        const knn = `embedding <|${topK},${ef}|> $vector`;
        const distanceRows = await this.#connector.queryAll<{
          id: unknown;
          metadata?: Record<string, unknown>;
          embedding?: number[];
          distance: number;
        }>(
          `SELECT ${fields}, vector::distance::knn() AS distance FROM ${table}
             WHERE ${knn}${condition ? ` AND ${condition}` : ''} ORDER BY distance ASC`,
          bindings,
        );
        rows = distanceRows.map(({ distance, ...row }) => ({
          ...row,
          score: info.metric === 'euclidean' ? 1 / (1 + distance) : 1 - distance,
        }));
      }

      return rows.map(row => ({
        id: recordKey(row.id),
        score: Number(row.score),
        metadata: row.metadata ?? {},
        ...(includeVector && row.embedding ? { vector: Array.from(row.embedding) } : {}),
      }));
    } catch (error) {
      throw this.#error('QUERY', 'FAILED', error, { indexName });
    }
  }

  async updateVector(params: UpdateVectorParams<SurrealVectorFilter>): Promise<void> {
    const { indexName, update } = params;
    const id = 'id' in params ? params.id : undefined;
    const filter = 'filter' in params ? params.filter : undefined;
    const info = await this.#requireIndex('UPDATE_VECTOR', indexName);

    const bindings: Record<string, unknown> = {};
    let condition: string | undefined;
    try {
      if (id !== undefined && filter !== undefined) throw new Error('id and filter are mutually exclusive');
      if (id === undefined && filter === undefined) throw new Error('Either id or filter must be provided');
      if (!update || (update.vector === undefined && update.metadata === undefined)) {
        throw new Error('No updates provided');
      }
      if (update.vector !== undefined) validateVector(update.vector, info.dimension);
      if (filter !== undefined) {
        condition = new SurrealFilterTranslator().translate(filter, bindings);
        if (!condition) throw new Error('Cannot update vectors with an empty filter');
      }
    } catch (error) {
      throw this.#error('UPDATE_VECTOR', 'INVALID_ARGS', error, { indexName }, ErrorCategory.USER);
    }

    try {
      const sets: string[] = [];
      if (update.vector !== undefined) {
        sets.push('embedding = $embedding');
        bindings.embedding = update.vector;
      }
      if (update.metadata !== undefined) {
        sets.push('metadata = $metadata');
        bindings.metadata = toMetadata(update.metadata);
      }
      const table = escapeIdent(indexName);
      const target = id !== undefined ? `type::record('${indexName}', $id)` : table;
      if (id !== undefined) bindings.id = id;
      await this.#connector.query(
        `UPDATE ${target} SET ${sets.join(', ')} ${condition ? `WHERE ${condition}` : ''} RETURN NONE`,
        bindings,
      );
    } catch (error) {
      throw this.#error('UPDATE_VECTOR', 'FAILED', error, { indexName, ...(id ? { id } : {}) });
    }
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    await this.#requireIndex('DELETE_VECTOR', indexName);
    try {
      await this.#connector.query(`DELETE type::record('${indexName}', $id)`, { id });
    } catch (error) {
      throw this.#error('DELETE_VECTOR', 'FAILED', error, { indexName, id });
    }
  }

  async deleteVectors({ indexName, ids, filter }: DeleteVectorsParams<SurrealVectorFilter>): Promise<void> {
    await this.#requireIndex('DELETE_VECTORS', indexName);
    const bindings: Record<string, unknown> = {};
    let condition: string | undefined;
    try {
      if (ids && filter) throw new Error('ids and filter are mutually exclusive');
      if (!ids && !filter) throw new Error('Either filter or ids must be provided');
      if (filter) {
        condition = new SurrealFilterTranslator().translate(filter, bindings);
        if (!condition) throw new Error('Cannot delete with an empty filter');
      }
      if (ids && ids.length === 0) throw new Error('Cannot delete with an empty ids array');
    } catch (error) {
      throw this.#error('DELETE_VECTORS', 'INVALID_ARGS', error, { indexName }, ErrorCategory.USER);
    }
    try {
      if (ids) {
        await this.#connector.query(`FOR $id IN $ids { DELETE type::record('${indexName}', $id); }`, { ids });
      } else {
        await this.#connector.query(`DELETE ${escapeIdent(indexName)} WHERE ${condition}`, bindings);
      }
    } catch (error) {
      throw this.#error('DELETE_VECTORS', 'FAILED', error, { indexName });
    }
  }

  /** Closes the connection when this vector store owns it. */
  async disconnect(): Promise<void> {
    await this.#connector.close();
  }

  async #lookupIndex(indexName: string): Promise<IndexInfo | undefined> {
    const cached = this.#indexes.get(indexName);
    if (cached) return cached;
    const [row] = await this.#connector.query<[IndexInfo | undefined]>(
      `SELECT dimension, metric FROM ONLY type::record('${REGISTRY_TABLE}', $name)`,
      { name: indexName },
    );
    if (!row) return undefined;
    const info = { dimension: Number(row.dimension), metric: row.metric };
    this.#indexes.set(indexName, info);
    return info;
  }

  async #requireIndex(operation: string, indexName: string): Promise<IndexInfo> {
    let info: IndexInfo | undefined;
    try {
      validateIndexName(indexName);
      await this.#init();
      info = await this.#lookupIndex(indexName);
    } catch (error) {
      throw this.#error(operation, 'FAILED', error, { indexName });
    }
    if (!info) {
      throw new MastraError({
        id: createVectorErrorId('SURREALDB', operation, 'INDEX_NOT_FOUND'),
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        text: `Index "${indexName}" does not exist`,
        details: { indexName },
      });
    }
    return info;
  }

  #error(
    operation: string,
    status: string,
    error: unknown,
    details?: Record<string, string | number>,
    category: ErrorCategory = ErrorCategory.THIRD_PARTY,
  ): MastraError {
    if (error instanceof MastraError) return error;
    return new MastraError(
      {
        id: createVectorErrorId('SURREALDB', operation, status),
        domain: ErrorDomain.MASTRA_VECTOR,
        category,
        text: error instanceof Error ? error.message : undefined,
        details,
      },
      error,
    );
  }
}

function validateIndexName(indexName: string): void {
  if (typeof indexName !== 'string' || !INDEX_NAME.test(indexName)) {
    throw new Error(
      `Invalid index name "${indexName}": use letters, digits and underscores, starting with a letter or underscore (max 63 characters)`,
    );
  }
}

function validateVector(vector: unknown, dimension: number): void {
  if (!Array.isArray(vector)) throw new Error('Vector must be an array of numbers');
  if (vector.length !== dimension) {
    throw new Error(`Vector dimension mismatch: expected ${dimension}, got ${vector.length}`);
  }
  if (!vector.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error('Vector values must be finite numbers');
  }
}

/** Metadata is stored as a plain JSON object. */
function toMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return metadata ? (JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>) : {};
}

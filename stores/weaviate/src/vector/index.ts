import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector, validateUpsertInput, validateVectorValues, validateTopK } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
  DeleteVectorsParams,
} from '@mastra/core/vector';
import weaviate, { generateUuid5 } from 'weaviate-client';
import type { WeaviateClient, Collection } from 'weaviate-client';

import { encodeMetaKey, decodeMetaKey, encodeMetaProperties } from './encoding';
import { WeaviateFilterTranslator } from './filter';
import type { WeaviateVectorFilter } from './filter';

/**
 * Weaviate distance metrics mapped from Mastra metric names.
 * @see https://weaviate.io/developers/weaviate/config-refs/distances
 */
const DISTANCE_MAPPING: Record<string, 'cosine' | 'l2-squared' | 'dot'> = {
  cosine: 'cosine',
  euclidean: 'l2-squared',
  dotproduct: 'dot',
};

const REVERSE_DISTANCE_MAPPING: Record<string, 'cosine' | 'euclidean' | 'dotproduct'> = {
  cosine: 'cosine',
  'l2-squared': 'euclidean',
  dot: 'dotproduct',
};

/** Reserved property used to round-trip the caller-supplied vector id. */
const MASTRA_ID_PROPERTY = 'mastraId';

/** Metadata stored on a collection's description to preserve Mastra semantics. */
interface CollectionMeta {
  name: string;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
}

/**
 * Connection options for the Weaviate vector store.
 * These map directly to `weaviate.connectToCustom`.
 */
export interface WeaviateVectorParams {
  /** Unique identifier for this vector store instance. */
  id: string;
  /** The hostname of the HTTP server. Defaults to `localhost`. */
  httpHost?: string;
  /** The port of the HTTP server. Defaults to `8080`. */
  httpPort?: number;
  /** Whether to use a secure connection to the HTTP server. Defaults to `false`. */
  httpSecure?: boolean;
  /** The hostname of the gRPC server. Defaults to the HTTP host. */
  grpcHost?: string;
  /** The port of the gRPC server. Defaults to `50051`. */
  grpcPort?: number;
  /** Whether to use a secure connection to the gRPC server. Defaults to `false`. */
  grpcSecure?: boolean;
  /** API key for authenticating with Weaviate (e.g. Weaviate Cloud). */
  apiKey?: string;
  /** Additional headers to include in requests (e.g. vectorizer API keys). */
  headers?: Record<string, string>;
}

/**
 * A Mastra vector store backed by Weaviate.
 *
 * Vectors are stored in `vectorizer: none` collections (Mastra supplies the
 * embeddings). Because Weaviate requires UUID object ids and capitalised
 * collection names, this adapter maps arbitrary Mastra ids to deterministic
 * UUIDv5 values (preserving the original id in a reserved property) and
 * preserves the original index name in the collection description.
 */
export class WeaviateVector extends MastraVector<WeaviateVectorFilter> {
  private clientPromise: Promise<WeaviateClient> | null = null;
  private readonly connectOptions: WeaviateVectorParams;
  /** Cache of property names known to exist in a collection's schema. */
  private readonly knownProperties = new Map<string, Set<string>>();
  /** Serializes schema mutations per collection to avoid concurrent addProperty races. */
  private readonly schemaLocks = new Map<string, Promise<void>>();

  constructor(params: WeaviateVectorParams) {
    super({ id: params.id });
    this.connectOptions = params;
  }

  private getClient(): Promise<WeaviateClient> {
    if (!this.clientPromise) {
      const { httpHost, httpPort, httpSecure, grpcHost, grpcPort, grpcSecure, apiKey, headers } = this.connectOptions;
      this.clientPromise = weaviate.connectToCustom({
        httpHost: httpHost ?? 'localhost',
        httpPort: httpPort ?? 8080,
        httpSecure: httpSecure ?? false,
        grpcHost: grpcHost ?? httpHost ?? 'localhost',
        grpcPort: grpcPort ?? 50051,
        grpcSecure: grpcSecure ?? false,
        ...(apiKey ? { authCredentials: new weaviate.ApiKey(apiKey) } : {}),
        ...(headers ? { headers } : {}),
      });
    }
    return this.clientPromise;
  }

  /** Closes the underlying Weaviate connection. */
  async disconnect(): Promise<void> {
    if (this.clientPromise) {
      const client = await this.clientPromise;
      await client.close();
      this.clientPromise = null;
    }
  }

  /** Weaviate collection names must start with an uppercase letter. */
  private toCollectionName(indexName: string): string {
    return indexName.charAt(0).toUpperCase() + indexName.slice(1);
  }

  private async getCollection(indexName: string): Promise<Collection> {
    const client = await this.getClient();
    return client.collections.get(this.toCollectionName(indexName));
  }

  private parseMeta(description?: string): CollectionMeta | null {
    if (!description) return null;
    try {
      const parsed = JSON.parse(description);
      if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') {
        return parsed as CollectionMeta;
      }
    } catch {
      // Not a Mastra-managed description.
    }
    return null;
  }

  private inferDataType(value: unknown): 'text' | 'number' | 'boolean' | 'text[]' | 'number[]' | 'boolean[]' | null {
    if (typeof value === 'string') return 'text';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) {
      const first = value.find(v => v !== null && v !== undefined);
      if (typeof first === 'string') return 'text[]';
      if (typeof first === 'number') return 'number[]';
      if (typeof first === 'boolean') return 'boolean[]';
      // Arrays of objects (or empty arrays) are left to Weaviate's auto-schema.
      return null;
    }
    return null;
  }

  /**
   * Ensures every metadata key across the batch exists as a collection property.
   * Weaviate's auto-schema would create text properties with `word` tokenization
   * (breaking exact-match filtering), so properties are created explicitly with
   * `field` tokenization for text values.
   */
  private async ensureProperties(
    collection: Collection,
    collectionName: string,
    metadata: Record<string, any>[] | undefined,
  ): Promise<void> {
    if (!metadata?.length) return;
    // Chain schema mutations for the same collection so concurrent upserts do not
    // race on addProperty (which would surface as partial-success failures).
    const prev = this.schemaLocks.get(collectionName) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => this.ensurePropertiesLocked(collection, collectionName, metadata));
    this.schemaLocks.set(collectionName, next);
    await next;
  }

  private async ensurePropertiesLocked(
    collection: Collection,
    collectionName: string,
    metadata: Record<string, any>[],
  ): Promise<void> {
    let known = this.knownProperties.get(collectionName);
    if (!known) {
      const config = await collection.config.get();
      known = new Set(config.properties.map(p => p.name));
      this.knownProperties.set(collectionName, known);
    }

    const seen = new Map<string, 'text' | 'number' | 'boolean' | 'text[]' | 'number[]' | 'boolean[]'>();
    for (const row of metadata) {
      if (!row) continue;
      for (const [rawKey, value] of Object.entries(row)) {
        const key = encodeMetaKey(rawKey);
        if (known.has(key) || seen.has(key) || value === null || value === undefined) continue;
        const dataType = this.inferDataType(value);
        if (dataType) seen.set(key, dataType);
      }
    }

    for (const [name, dataType] of seen) {
      try {
        await collection.config.addProperty({
          name,
          dataType,
          ...(dataType === 'text' || dataType === 'text[]' ? { tokenization: 'field' } : {}),
        } as any);
      } catch (error) {
        // Tolerate a property that already exists (e.g. added by a racing caller).
        if (!/already/i.test((error as Error)?.message ?? '')) throw error;
      }
      known.add(name);
    }
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    try {
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'CREATE_INDEX', 'INVALID_ARGS'),
          text: 'Dimension must be a positive integer',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, dimension },
        });
      }

      const distance = DISTANCE_MAPPING[metric];
      if (!distance) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'CREATE_INDEX', 'INVALID_ARGS'),
          text: `Invalid metric: ${metric}. Must be one of: cosine, euclidean, dotproduct`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, metric },
        });
      }

      const client = await this.getClient();
      const collectionName = this.toCollectionName(indexName);

      if (await client.collections.exists(collectionName)) {
        // Weaviate capitalises the first letter of collection names, so distinct
        // Mastra index names (e.g. `documents` and `Documents`) map to one
        // collection. Reject the collision instead of silently sharing storage.
        const existingConfig = await client.collections.get(collectionName).config.get();
        const existingMeta = this.parseMeta(existingConfig.description);
        if (existingMeta && existingMeta.name !== indexName) {
          throw new MastraError({
            id: createVectorErrorId('WEAVIATE', 'CREATE_INDEX', 'NAME_COLLISION'),
            text: `Index name "${indexName}" collides with existing index "${existingMeta.name}" (Weaviate collection "${collectionName}"). Weaviate capitalises the first letter of collection names, so these names cannot coexist.`,
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName, existingName: existingMeta.name, collectionName },
          });
        }
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }

      const meta: CollectionMeta = { name: indexName, dimension, metric };
      await client.collections.create({
        name: collectionName,
        description: JSON.stringify(meta),
        // Store the original Mastra id as an exact-match ("field") text property so
        // arbitrary (e.g. numeric) ids are not misinterpreted by Weaviate's auto-schema.
        properties: [{ name: MASTRA_ID_PROPERTY, dataType: 'text', tokenization: 'field' }],
        // Index null state so `$exists` / null-equality filters are supported.
        invertedIndex: weaviate.configure.invertedIndex({ indexNullState: true }),
        vectorizers: weaviate.configure.vectors.selfProvided({
          vectorIndexConfig: weaviate.configure.vectorIndex.hnsw({ distanceMetric: distance }),
        }),
      });
      this.knownProperties.set(collectionName, new Set([MASTRA_ID_PROPERTY]));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /** Fetches a collection's stored metadata, throwing if the index does not exist. */
  private async requireMeta(indexName: string, operation: string): Promise<CollectionMeta | null> {
    const client = await this.getClient();
    const collectionName = this.toCollectionName(indexName);
    if (!(await client.collections.exists(collectionName))) {
      throw new MastraError({
        id: createVectorErrorId('WEAVIATE', operation, 'INDEX_NOT_FOUND'),
        text: `Index ${indexName} does not exist`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    const config = await client.collections.get(collectionName).config.get();
    return this.parseMeta(config.description);
  }

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    try {
      validateUpsertInput('WEAVIATE', vectors, metadata, ids);
      validateVectorValues('WEAVIATE', vectors);

      const meta = await this.requireMeta(indexName, 'UPSERT');
      if (meta?.dimension) {
        const mismatch = vectors.find(v => v.length !== meta.dimension);
        if (mismatch) {
          throw new MastraError({
            id: createVectorErrorId('WEAVIATE', 'UPSERT', 'DIMENSION_MISMATCH'),
            text: `Vector dimension ${mismatch.length} does not match index dimension ${meta.dimension}`,
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName, expected: meta.dimension, actual: mismatch.length },
          });
        }
      }

      const collection = await this.getCollection(indexName);
      await this.ensureProperties(collection, this.toCollectionName(indexName), metadata);
      const originalIds = ids ?? vectors.map(() => crypto.randomUUID());

      const objects = vectors.map((vector, i) => {
        const originalId = originalIds[i]!;
        return {
          id: generateUuid5(originalId),
          vectors: vector,
          properties: {
            ...encodeMetaProperties(metadata?.[i]),
            [MASTRA_ID_PROPERTY]: originalId,
          },
        };
      });

      const result = await collection.data.insertMany(objects);
      if (result.hasErrors) {
        const firstError = Object.values(result.errors)[0];
        throw new Error(firstError?.message ?? 'Weaviate insertMany reported errors');
      }

      return originalIds;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  private transformFilter(collection: Collection, filter?: WeaviateVectorFilter) {
    const translator = new WeaviateFilterTranslator();
    return translator.translate(filter, collection.filter as any);
  }

  private toQueryResult(obj: any, includeVector?: boolean): QueryResult {
    const raw = obj.properties ?? {};
    const originalId = raw[MASTRA_ID_PROPERTY];
    const properties: Record<string, any> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key === MASTRA_ID_PROPERTY || value === undefined) continue;
      properties[decodeMetaKey(key)] = value;
    }

    const distance = obj.metadata?.distance;
    const score = typeof distance === 'number' ? 1 - distance : (obj.metadata?.certainty ?? 0);

    const result: QueryResult = {
      id: typeof originalId === 'string' ? originalId : obj.uuid,
      score,
      metadata: properties,
    };

    if (includeVector) {
      const vectors = obj.vectors ?? {};
      result.vector = vectors.default ?? Object.values(vectors)[0];
    }

    return result;
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: QueryVectorParams<WeaviateVectorFilter>): Promise<QueryResult[]> {
    try {
      validateTopK('WEAVIATE', topK);

      const meta = await this.requireMeta(indexName, 'QUERY');
      if (queryVector && meta?.dimension && queryVector.length !== meta.dimension) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'QUERY', 'DIMENSION_MISMATCH'),
          text: `Query vector dimension ${queryVector.length} does not match index dimension ${meta.dimension}`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, expected: meta.dimension, actual: queryVector.length },
        });
      }

      const collection = await this.getCollection(indexName);
      const filters = this.transformFilter(collection, filter);
      const returnMetadata = ['distance'] as const;

      if (queryVector) {
        const response = await collection.query.nearVector(queryVector, {
          limit: topK,
          includeVector,
          returnMetadata: returnMetadata as any,
          ...(filters ? { filters } : {}),
        });
        return response.objects.map(obj => this.toQueryResult(obj, includeVector));
      }

      const response = await collection.query.fetchObjects({
        limit: topK,
        includeVector,
        ...(filters ? { filters } : {}),
      });
      return response.objects.map(obj => this.toQueryResult(obj, includeVector));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const client = await this.getClient();
      const collections = await client.collections.listAll();
      return collections.map(config => {
        const meta = this.parseMeta(config.description);
        return meta?.name ?? config.name;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const client = await this.getClient();
      const collectionName = this.toCollectionName(indexName);
      if (!(await client.collections.exists(collectionName))) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'DESCRIBE_INDEX', 'INDEX_NOT_FOUND'),
          text: `Index ${indexName} does not exist`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      const collection = client.collections.get(collectionName);
      const config = await collection.config.get();
      const meta = this.parseMeta(config.description);

      const count = await collection.length();

      let dimension = meta?.dimension ?? 0;
      if (!dimension) {
        // Fall back to sampling a stored vector when dimension is unknown.
        const sample = await collection.query.fetchObjects({ limit: 1, includeVector: true });
        const vectors = sample.objects[0]?.vectors ?? {};
        const vec = (vectors as any).default ?? Object.values(vectors)[0];
        if (Array.isArray(vec)) dimension = vec.length;
      }

      let metric = meta?.metric;
      if (!metric) {
        const vectorConfig = (config.vectorizers as any)?.default ?? Object.values(config.vectorizers ?? {})[0];
        const distance = vectorConfig?.indexConfig?.distance;
        metric = distance ? REVERSE_DISTANCE_MAPPING[distance] : undefined;
      }

      return { dimension, count, metric };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      const client = await this.getClient();
      await client.collections.delete(this.toCollectionName(indexName));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async updateVector({ indexName, id, filter, update }: UpdateVectorParams<WeaviateVectorFilter>): Promise<void> {
    try {
      if (id !== undefined && filter !== undefined) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'UPDATE_VECTOR', 'INVALID_ARGS'),
          text: 'id and filter are mutually exclusive',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      if (!update || (!update.vector && !update.metadata)) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'UPDATE_VECTOR', 'INVALID_ARGS'),
          text: 'Update data is required: no updates provided',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      // Validate the id/filter target BEFORE touching the collection, otherwise a
      // rejected update (missing target or empty filter) would still mutate the
      // collection schema via ensureProperties below.
      if (id === undefined && filter === undefined) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'UPDATE_VECTOR', 'INVALID_ARGS'),
          text: 'Either id or filter must be provided',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      if (id === undefined && (typeof filter !== 'object' || filter === null || Object.keys(filter).length === 0)) {
        throw new MastraError({
          id: createVectorErrorId('WEAVIATE', 'UPDATE_VECTOR', 'INVALID_ARGS'),
          text: 'A non-empty filter is required: empty filter not allowed',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }

      const collection = await this.getCollection(indexName);

      // Mirror upsert's schema handling: create any missing properties with
      // `field` tokenization and encode reserved keys, otherwise updated metadata
      // would be auto-schemad with `word` tokenization (breaking exact-match
      // filters) or clash with Weaviate's reserved property names.
      if (update.metadata) {
        await this.ensureProperties(collection, this.toCollectionName(indexName), [update.metadata]);
      }
      const encodedProperties = update.metadata ? encodeMetaProperties(update.metadata) : undefined;

      const applyUpdate = async (uuid: string) => {
        await collection.data.update({
          id: uuid,
          ...(encodedProperties ? { properties: encodedProperties } : {}),
          ...(update.vector ? { vectors: update.vector } : {}),
        });
      };

      if (id !== undefined) {
        await applyUpdate(generateUuid5(id));
        return;
      }

      const filters = this.transformFilter(collection, filter!);
      const matches = await collection.query.fetchObjects({ limit: 10000, ...(filters ? { filters } : {}) });
      for (const obj of matches.objects) {
        await applyUpdate(obj.uuid);
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, ...(id ? { id } : {}) },
        },
        error,
      );
    }
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      const collection = await this.getCollection(indexName);
      await collection.data.deleteById(generateUuid5(id));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<WeaviateVectorFilter>): Promise<void> {
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('WEAVIATE', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both ids and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('WEAVIATE', 'DELETE_VECTORS', 'NO_TARGET'),
        text: 'Either filter or ids must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('WEAVIATE', 'DELETE_VECTORS', 'EMPTY_IDS'),
        text: 'Cannot delete with empty ids array',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (filter && typeof filter === 'object' && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('WEAVIATE', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        text: 'Cannot delete with empty filter object',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      const collection = await this.getCollection(indexName);
      if (ids) {
        for (const id of ids) {
          await collection.data.deleteById(generateUuid5(id));
        }
      } else if (filter) {
        const filters = this.transformFilter(collection, filter);
        if (filters) {
          await collection.data.deleteMany(filters);
        }
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('WEAVIATE', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
    }
  }
}

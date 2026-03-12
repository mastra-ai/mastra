import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector, validateUpsert, validateTopK } from '@mastra/core/vector';
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
import { ChromaClient, CloudClient } from 'chromadb';
import type { ChromaClientArgs, RecordSet, Where, WhereDocument, Collection, Metadata, Search } from 'chromadb';
import type { ChromaVectorFilter } from './filter';
import { ChromaFilterTranslator } from './filter';

interface ChromaUpsertVectorParams extends UpsertVectorParams {
  documents?: string[];
}

interface ChromaQueryVectorParams extends QueryVectorParams<ChromaVectorFilter> {
  documentFilter?: WhereDocument | null;
}

interface ChromaGetRecordsParams {
  indexName: string;
  ids?: string[];
  filter?: ChromaVectorFilter;
  documentFilter?: WhereDocument | null;
  includeVector?: boolean;
  limit?: number;
  offset?: number;
}

type MastraMetadata = {
  dimension?: number;
};

type ChromaVectorArgs = ChromaClientArgs & { apiKey?: string };

const spaceMappings = {
  cosine: 'cosine',
  euclidean: 'l2',
  dotproduct: 'ip',
  l2: 'euclidean',
  ip: 'dotproduct',
};

export class ChromaVector extends MastraVector<ChromaVectorFilter> {
  private client: ChromaClient;
  private collections: Map<string, Collection>;

  constructor({ id, ...chromaClientArgs }: ChromaVectorArgs & { id: string }) {
    super({ id });
    if (chromaClientArgs?.apiKey) {
      this.client = new CloudClient({
        apiKey: chromaClientArgs.apiKey,
        tenant: chromaClientArgs.tenant,
        database: chromaClientArgs.database,
      });
    } else {
      this.client = new ChromaClient(chromaClientArgs);
    }
    this.collections = new Map();
  }

  async getCollection({ indexName, forceUpdate = false }: { indexName: string; forceUpdate?: boolean }) {
    let collection = this.collections.get(indexName);
    if (forceUpdate || !collection) {
      try {
        collection = await this.client.getCollection({ name: indexName });
        this.collections.set(indexName, collection);
        return collection;
      } catch {
        throw new MastraError({
          id: createVectorErrorId('CHROMA', 'GET_COLLECTION', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        });
      }
    }
    return collection;
  }

  private validateVectorDimensions(vectors: number[][], dimension: number): void {
    for (let i = 0; i < vectors.length; i++) {
      if (vectors?.[i]?.length !== dimension) {
        throw new Error(
          `Vector at index ${i} has invalid dimension ${vectors?.[i]?.length}. Expected ${dimension} dimensions.`,
        );
      }
    }
  }

  async upsert({ indexName, vectors, metadata, ids, documents }: ChromaUpsertVectorParams): Promise<string[]> {
    // Validate input parameters and vector values
    validateUpsert('CHROMA', vectors, metadata, ids, true);

    try {
      const collection = await this.getCollection({ indexName });

      const stats = await this.describeIndex({ indexName });
      this.validateVectorDimensions(vectors, stats.dimension);
      const generatedIds = ids || vectors.map(() => crypto.randomUUID());

      await collection.upsert({
        ids: generatedIds,
        embeddings: vectors,
        metadatas: metadata,
        documents: documents,
      });

      return generatedIds;
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'CREATE_INDEX', 'INVALID_DIMENSION'),
        text: 'Dimension must be a positive integer',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { dimension },
      });
    }

    const hnswSpace = spaceMappings[metric] as 'cosine' | 'l2' | 'ip' | undefined;

    if (!hnswSpace || !['cosine', 'l2', 'ip'].includes(hnswSpace)) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'CREATE_INDEX', 'INVALID_METRIC'),
        text: `Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`,
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { metric },
      });
    }

    try {
      const collection = await this.client.createCollection({
        name: indexName,
        metadata: { dimension },
        configuration: { hnsw: { space: hnswSpace } },
        embeddingFunction: null,
      });
      this.collections.set(indexName, collection);
    } catch (error: any) {
      // Check for 'already exists' error
      const message = error?.message || error?.toString();
      if (message && message.toLowerCase().includes('already exists')) {
        // Fetch collection info and check dimension
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  transformFilter(filter?: ChromaVectorFilter) {
    const translator = new ChromaFilterTranslator();
    const translatedFilter = translator.translate(filter);
    return translatedFilter ? (translatedFilter as Where) : undefined;
  }

  async query<T extends Metadata = Metadata>({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    documentFilter,
  }: ChromaQueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Chroma queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate topK parameter
    validateTopK('CHROMA', topK);

    try {
      const collection = await this.getCollection({ indexName });

      const defaultInclude: ['documents', 'metadatas', 'distances'] = ['documents', 'metadatas', 'distances'];

      const translatedFilter = this.transformFilter(filter);
      const results = await collection.query<T>({
        queryEmbeddings: [queryVector],
        nResults: topK,
        where: translatedFilter ?? undefined,
        whereDocument: documentFilter ?? undefined,
        include: includeVector ? [...defaultInclude, 'embeddings'] : defaultInclude,
      });

      return (results.ids[0] || []).map((id: string, index: number) => {
        // Chroma returns distances (lower = more similar), convert to similarity scores (higher = more similar)
        // For cosine: similarity = 1 - distance
        const distance = results.distances?.[0]?.[index] || 0;
        const score = 1 - distance;
        return {
          id,
          score,
          metadata: results.metadatas?.[0]?.[index] || {},
          document: results.documents?.[0]?.[index] ?? undefined,
          ...(includeVector && { vector: results.embeddings?.[0]?.[index] || [] }),
        };
      });
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'QUERY', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async hybridSearch({ indexName, search }: { indexName: string; search: Search }): Promise<QueryResult[]> {
    try {
      const collection = await this.getCollection({ indexName });
      const results = await collection.search(search);
      return (results.rows()[0] ?? []).map(record => ({
        id: record.id,
        score: record.score ?? 0,
        metadata: record.metadata ?? undefined,
        vector: record.embedding ?? undefined,
        document: record.document ?? undefined,
      }));
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'SEARCH_API', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async get<T extends Metadata = Metadata>({
    indexName,
    ids,
    filter,
    includeVector = false,
    documentFilter,
    offset,
    limit,
  }: ChromaGetRecordsParams) {
    try {
      const collection = await this.getCollection({ indexName });

      const defaultInclude: ['documents', 'metadatas'] = ['documents', 'metadatas'];
      const translatedFilter = this.transformFilter(filter);

      const result = await collection.get<T>({
        ids,
        where: translatedFilter ?? undefined,
        whereDocument: documentFilter ?? undefined,
        offset,
        limit,
        include: includeVector ? [...defaultInclude, 'embeddings'] : defaultInclude,
      });
      return result.rows();
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'GET', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const collections = await this.client.listCollections();
      return collections.map(collection => collection.name);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const collection = await this.getCollection({ indexName });
      const count = await collection.count();
      const metadata = collection.metadata as MastraMetadata | undefined;
      const space = collection.configuration.hnsw?.space || collection.configuration.spann?.space || undefined;

      return {
        dimension: metadata?.dimension || 0,
        count,
        metric: space ? (spaceMappings[space] as 'cosine' | 'euclidean' | 'dotproduct') : undefined,
      };
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      await this.client.deleteCollection({ name: indexName });
      this.collections.delete(indexName);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async forkIndex({ indexName, newIndexName }: { indexName: string; newIndexName: string }): Promise<void> {
    try {
      const collection = await this.getCollection({ indexName, forceUpdate: true });
      const forkedCollection = await collection.fork({ name: newIndexName });
      this.collections.set(newIndexName, forkedCollection);
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'FORK_INDEX', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID or multiple vectors matching a filter.
   * @param indexName - The name of the index containing the vector(s).
   * @param id - The ID of the vector to update (mutually exclusive with filter).
   * @param filter - Filter to match multiple vectors to update (mutually exclusive with id).
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, filter, update }: UpdateVectorParams<ChromaVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (id && filter) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both id and filter - they are mutually exclusive',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!id && !filter) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'UPDATE_VECTOR', 'NO_TARGET'),
        text: 'Either id or filter must be provided',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        text: 'No updates provided',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: {
          indexName,
          ...(id && { id }),
        },
      });
    }

    // Validate filter is not empty
    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
        text: 'Filter cannot be an empty filter object',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      const collection: Collection = await this.getCollection({ indexName });

      // Validate vector dimensions if provided
      if (update?.vector) {
        const stats = await this.describeIndex({ indexName });
        this.validateVectorDimensions([update.vector], stats.dimension);
      }

      if (id) {
        // Update single vector by ID
        const updateRecordSet: RecordSet = { ids: [id] };

        if (update?.vector) {
          updateRecordSet.embeddings = [update.vector];
        }

        if (update?.metadata) {
          updateRecordSet.metadatas = [update.metadata];
        }

        return await collection.update(updateRecordSet);
      } else if (filter) {
        // Update multiple vectors matching filter
        // First, get all vectors matching the filter
        const translatedFilter = this.transformFilter(filter);
        const matchingVectors = await collection.get({
          where: translatedFilter ?? undefined,
          include: ['embeddings', 'metadatas'],
        });

        const vectorRows = matchingVectors.rows();
        if (vectorRows.length === 0) {
          // No vectors to update - this is not an error
          return;
        }

        // Prepare update for all matching vectors
        const updateRecordSet: RecordSet = {
          ids: vectorRows.map(row => row.id),
        };

        if (update?.vector) {
          // Use the same new vector for all matching records
          updateRecordSet.embeddings = vectorRows.map(() => update.vector!);
        }

        if (update?.metadata) {
          // Use the same new metadata for all matching records
          updateRecordSet.metadatas = vectorRows.map(() => update.metadata!);
        }

        return await collection.update(updateRecordSet);
      }
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
            ...(filter && { filter: JSON.stringify(filter) }),
          },
        },
        error,
      );
    }
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      const collection: Collection = await this.getCollection({ indexName });
      await collection.delete({ ids: [id] });
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
          },
        },
        error,
      );
    }
  }

  /**
   * Deletes multiple vectors by IDs or filter.
   * @param indexName - The name of the index containing the vectors.
   * @param ids - Array of vector IDs to delete (mutually exclusive with filter).
   * @param filter - Filter to match vectors to delete (mutually exclusive with ids).
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if both ids and filter are provided, or if neither is provided.
   */
  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<ChromaVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both ids and filter - they are mutually exclusive',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'DELETE_VECTORS', 'NO_TARGET'),
        text: 'Either filter or ids must be provided',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate ids array is not empty
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'DELETE_VECTORS', 'EMPTY_IDS'),
        text: 'Cannot delete with empty ids array',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate filter is not empty
    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('CHROMA', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        text: 'Cannot delete with empty filter object',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      const collection: Collection = await this.getCollection({ indexName });

      if (ids) {
        // Delete by IDs
        await collection.delete({ ids });
      } else if (filter) {
        // Delete by filter
        const translatedFilter = this.transformFilter(filter);
        await collection.delete({
          where: translatedFilter ?? undefined,
        });
      }
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('CHROMA', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.MASTRA_VECTOR,
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

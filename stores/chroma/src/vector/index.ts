import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { MastraVector } from '@mastra/core/vector';
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
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { ChromaClient } from 'chromadb';
import type { UpdateRecordsParams, Collection } from 'chromadb';
import { ChromaFilterTranslator } from './filter';

interface ChromaUpsertVectorParams extends UpsertVectorParams {
  documents?: string[];
}

interface ChromaQueryVectorParams extends QueryVectorParams {
  documentFilter?: VectorFilter;
}

export class ChromaVector extends MastraVector {
  private client: ChromaClient;
  private collections: Map<string, any>;

  constructor({
    path,
    auth,
  }: {
    path: string;
    auth?: {
      provider: string;
      credentials: string;
    };
  }) {
    super();
    this.client = new ChromaClient({
      path,
      auth,
    });
    this.collections = new Map();
  }

  async getCollection(indexName: string, throwIfNotExists: boolean = true) {
    try {
      const collection = await this.client.getCollection({ name: indexName, embeddingFunction: undefined as any });
      this.collections.set(indexName, collection);
    } catch {
      if (throwIfNotExists) {
        throw new Error(`Index ${indexName} does not exist`);
      }
      return null;
    }
    return this.collections.get(indexName);
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
    try {
      const collection = await this.getCollection(indexName);

      const stats = await this.describeIndex({ indexName });
      this.validateVectorDimensions(vectors, stats.dimension);
      const generatedIds = ids || vectors.map(() => crypto.randomUUID());
      const normalizedMetadata = metadata || vectors.map(() => ({}));

      await collection.upsert({
        ids: generatedIds,
        embeddings: vectors,
        metadatas: normalizedMetadata,
        documents: documents,
      });

      return generatedIds;
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'CHROMA_VECTOR_UPSERT_FAILED',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  private HnswSpaceMap = {
    cosine: 'cosine',
    euclidean: 'l2',
    dotproduct: 'ip',
    l2: 'euclidean',
    ip: 'dotproduct',
  };

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new MastraError({
        id: 'CHROMA_VECTOR_CREATE_INDEX_INVALID_DIMENSION',
        text: 'Dimension must be a positive integer',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { dimension },
      });
    }
    const hnswSpace = this.HnswSpaceMap[metric];
    if (!hnswSpace || !['cosine', 'l2', 'ip'].includes(hnswSpace)) {
      throw new MastraError({
        id: 'CHROMA_VECTOR_CREATE_INDEX_INVALID_METRIC',
        text: `Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`,
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { metric },
      });
    }
    try {
      await this.client.createCollection({
        name: indexName,
        metadata: {
          dimension,
          'hnsw:space': hnswSpace,
        },
      });
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
          id: 'CHROMA_VECTOR_CREATE_INDEX_FAILED',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new ChromaFilterTranslator();
    return translator.translate(filter);
  }
  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    documentFilter,
  }: ChromaQueryVectorParams): Promise<QueryResult[]> {
    try {
      const collection = await this.getCollection(indexName, true);

      const defaultInclude = ['documents', 'metadatas', 'distances'];

      const translatedFilter = this.transformFilter(filter);
      const results = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: topK,
        where: translatedFilter,
        whereDocument: documentFilter,
        include: includeVector ? [...defaultInclude, 'embeddings'] : defaultInclude,
      });

      return (results.ids[0] || []).map((id: string, index: number) => ({
        id,
        score: results.distances?.[0]?.[index] || 0,
        metadata: results.metadatas?.[0]?.[index] || {},
        document: results.documents?.[0]?.[index],
        ...(includeVector && { vector: results.embeddings?.[0]?.[index] || [] }),
      }));
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'CHROMA_VECTOR_QUERY_FAILED',
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
      return collections.map(collection => collection);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CHROMA_VECTOR_LIST_INDEXES_FAILED',
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
      const collection = await this.getCollection(indexName);
      const count = await collection.count();
      const metadata = collection.metadata;

      const hnswSpace = metadata?.['hnsw:space'] as 'cosine' | 'l2' | 'ip';

      return {
        dimension: metadata?.dimension || 0,
        count,
        metric: this.HnswSpaceMap[hnswSpace] as 'cosine' | 'euclidean' | 'dotproduct',
      };
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'CHROMA_VECTOR_DESCRIBE_INDEX_FAILED',
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
          id: 'CHROMA_VECTOR_DELETE_INDEX_FAILED',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: 'CHROMA_VECTOR_UPDATE_NO_PAYLOAD',
        text: 'No updates provided for vector',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName, id },
      });
    }

    try {
      const collection: Collection = await this.getCollection(indexName, true);

      const updateOptions: UpdateRecordsParams = { ids: [id] };

      if (update?.vector) {
        const stats = await this.describeIndex({ indexName });
        this.validateVectorDimensions([update.vector], stats.dimension);
        updateOptions.embeddings = [update.vector];
      }

      if (update?.metadata) {
        updateOptions.metadatas = [update.metadata];
      }

      return await collection.update(updateOptions);
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'CHROMA_VECTOR_UPDATE_FAILED',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      const collection: Collection = await this.getCollection(indexName, true);
      await collection.delete({ ids: [id] });
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: 'CHROMA_VECTOR_DELETE_FAILED',
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }
}

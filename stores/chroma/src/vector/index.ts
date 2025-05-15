import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
  QueryVectorArgs,
  UpsertVectorArgs,
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

type ChromaUpsertArgs = [...UpsertVectorArgs, string[]?];

interface ChromaQueryVectorParams extends QueryVectorParams {
  documentFilter?: VectorFilter;
}

type ChromaQueryArgs = [...QueryVectorArgs, VectorFilter?];

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

  async upsert(...args: ParamsToArgs<ChromaUpsertVectorParams> | ChromaUpsertArgs): Promise<string[]> {
    const params = this.normalizeArgs<ChromaUpsertVectorParams, ChromaUpsertArgs>('upsert', args, ['documents']);

    const { indexName, vectors, metadata, ids, documents } = params;

    const collection = await this.getCollection(indexName);

    // Get index stats to check dimension
    const stats = await this.describeIndex({ indexName });

    // Validate vector dimensions
    this.validateVectorDimensions(vectors, stats.dimension);

    // Generate IDs if not provided
    const generatedIds = ids || vectors.map(() => crypto.randomUUID());

    // Ensure metadata exists for each vector
    const normalizedMetadata = metadata || vectors.map(() => ({}));

    await collection.upsert({
      ids: generatedIds,
      embeddings: vectors,
      metadatas: normalizedMetadata,
      documents: documents,
    });

    return generatedIds;
  }

  private HnswSpaceMap = {
    cosine: 'cosine',
    euclidean: 'l2',
    dotproduct: 'ip',
    l2: 'euclidean',
    ip: 'dotproduct',
  };

  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);
    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    const hnswSpace = this.HnswSpaceMap[metric];
    if (!['cosine', 'l2', 'ip'].includes(hnswSpace)) {
      throw new Error(`Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`);
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
      throw error;
    }
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new ChromaFilterTranslator();
    return translator.translate(filter);
  }
  async query(...args: ParamsToArgs<ChromaQueryVectorParams> | ChromaQueryArgs): Promise<QueryResult[]> {
    const params = this.normalizeArgs<ChromaQueryVectorParams, ChromaQueryArgs>('query', args, ['documentFilter']);

    const { indexName, queryVector, topK = 10, filter, includeVector = false, documentFilter } = params;

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

    // Transform ChromaDB results to QueryResult format
    return (results.ids[0] || []).map((id: string, index: number) => ({
      id,
      score: results.distances?.[0]?.[index] || 0,
      metadata: results.metadatas?.[0]?.[index] || {},
      document: results.documents?.[0]?.[index],
      ...(includeVector && { vector: results.embeddings?.[0]?.[index] || [] }),
    }));
  }

  async listIndexes(): Promise<string[]> {
    const collections = await this.client.listCollections();
    return collections.map(collection => collection);
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param params - The parameters for describing an index
   * @param params.indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex(...args: ParamsToArgs<DescribeIndexParams>): Promise<IndexStats> {
    const params = this.normalizeArgs<DescribeIndexParams>('describeIndex', args);
    const { indexName } = params;

    const collection = await this.getCollection(indexName);
    const count = await collection.count();
    const metadata = collection.metadata;

    const hnswSpace = metadata?.['hnsw:space'] as 'cosine' | 'l2' | 'ip';

    return {
      dimension: metadata?.dimension || 0,
      count,
      metric: this.HnswSpaceMap[hnswSpace] as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  async deleteIndex(...args: ParamsToArgs<DeleteIndexParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteIndexParams>('deleteIndex', args);
    const { indexName } = params;
    await this.client.deleteCollection({ name: indexName });
    this.collections.delete(indexName);
  }

  /**
   * @deprecated Use {@link updateVector} instead. This method will be removed on May 20th, 2025.
   *
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateIndexById(
    indexName: string,
    id: string,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    this.logger.warn(
      `Deprecation Warning: updateIndexById() is deprecated. 
    Please use updateVector() instead. 
    updateIndexById() will be removed on May 20th, 2025.`,
    );
    await this.updateVector({ indexName, id, update });
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
  async updateVector(...args: ParamsToArgs<UpdateVectorParams>): Promise<void> {
    const params = this.normalizeArgs<UpdateVectorParams>('updateVector', args);
    const { indexName, id, update } = params;
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

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
      throw new Error(`Failed to update vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }

  /**
   * @deprecated Use {@link deleteVector} instead. This method will be removed on May 20th, 2025.
   *
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteIndexById(indexName: string, id: string): Promise<void> {
    this.logger.warn(
      `Deprecation Warning: deleteIndexById() is deprecated. Please use deleteVector() instead. deleteIndexById() will be removed on May 20th.`,
    );
    await this.deleteVector(indexName, id);
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector(...args: ParamsToArgs<DeleteVectorParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteVectorParams>('deleteVector', args);

    const { indexName, id } = params;
    try {
      const collection: Collection = await this.getCollection(indexName, true);
      await collection.delete({ ids: [id] });
    } catch (error: any) {
      throw new Error(`Failed to delete vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }
}

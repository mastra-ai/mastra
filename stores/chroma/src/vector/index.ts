import { type Filter } from '@mastra/core/filter';
import { MastraVector, type QueryResult, type IndexStats } from '@mastra/core/vector';
import { ChromaClient } from 'chromadb';

import { ChromaFilterTranslator } from './filter';

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

  private async getCollection(indexName: string, throwIfNotExists: boolean = true) {
    try {
      const collection = await this.client.getCollection({ name: indexName, embeddingFunction: undefined as any });
      this.collections.set(indexName, collection);
    } catch (error) {
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

  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
    const collection = await this.getCollection(indexName);

    // Get index stats to check dimension
    const stats = await this.describeIndex(indexName);

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
    });

    return generatedIds;
  }

  async createIndex(
    indexName: string,
    dimension: number,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  ): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    await this.client.createCollection({
      name: indexName,
      metadata: {
        dimension,
        metric,
      },
    });
  }

  transformFilter(filter?: Filter) {
    const chromaFilter = new ChromaFilterTranslator();
    const translatedFilter = chromaFilter.translate(filter);
    return translatedFilter;
  }
  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Filter,
    includeVector: boolean = false,
  ): Promise<QueryResult[]> {
    const collection = await this.getCollection(indexName, true);

    const defaultInclude = ['documents', 'metadatas', 'distances'];

    const translatedFilter = this.transformFilter(filter);

    const results = await collection.query({
      queryEmbeddings: [queryVector],
      nResults: topK,
      where: translatedFilter,
      include: includeVector ? [...defaultInclude, 'embeddings'] : defaultInclude,
    });

    // Transform ChromaDB results to QueryResult format
    return (results.ids[0] || []).map((id: string, index: number) => ({
      id,
      score: results.distances?.[0]?.[index] || 0,
      metadata: results.metadatas?.[0]?.[index] || {},
      ...(includeVector && { vector: results.embeddings?.[0]?.[index] || [] }),
    }));
  }

  async listIndexes(): Promise<string[]> {
    const collections = await this.client.listCollections();
    return collections.map(collection => collection);
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    const collection = await this.getCollection(indexName);
    const count = await collection.count();
    const metadata = collection.metadata;

    return {
      dimension: metadata?.dimension || 0,
      count,
      metric: metadata?.metric as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    await this.client.deleteCollection({ name: indexName });
    this.collections.delete(indexName);
  }
}

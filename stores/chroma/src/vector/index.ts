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
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { ChromaClient } from 'chromadb';

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
    await this.client.createCollection({
      name: indexName,
      metadata: {
        dimension,
        'hnsw:space': this.HnswSpaceMap[metric],
      },
    });
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

  async describeIndex(indexName: string): Promise<IndexStats> {
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

  async deleteIndex(indexName: string): Promise<void> {
    await this.client.deleteCollection({ name: indexName });
    this.collections.delete(indexName);
  }
}

import { MastraVector, QueryResult, IndexStats } from '@mastra/core';
import { QdrantClient, Schemas } from '@qdrant/js-client-rest';

const BATCH_SIZE = 256;
const DISTANCE_MAPPING: Record<string, Schemas['Distance']> = {
  cosine: 'Cosine',
  euclidean: 'Euclid',
  dotproduct: 'Dot',
};

export class QdrantVector extends MastraVector {
  private client: QdrantClient;

  constructor(url: string, apiKey?: string, https?: boolean) {
    super();

    this.client = new QdrantClient({
      url,
      apiKey,
      https,
    });
  }

  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
    const pointIds = ids || vectors.map(() => crypto.randomUUID());

    const records = vectors.map((vector, i) => ({
      id: pointIds[i],
      vector: vector,
      payload: metadata?.[i] || {},
    }));

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await this.client.upsert(indexName, {
        // @ts-expect-error
        points: batch,
        wait: true,
      });
    }

    return pointIds;
  }

  async createIndex(
    indexName: string,
    dimension: number,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  ): Promise<void> {
    await this.client.createCollection(indexName, {
      vectors: {
        // @ts-expect-error
        size: dimension,
        // @ts-expect-error
        distance: DISTANCE_MAPPING[metric],
      },
    });
  }

  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, any>,
  ): Promise<QueryResult[]> {
    const results = (
      await this.client.query(indexName, {
        query: queryVector,
        limit: topK,
        filter: filter,
        with_payload: true,
      })
    ).points;

    return results.map(match => ({
      id: match.id as string,
      score: match.score || 0,
      metadata: match.payload as Record<string, any>,
    }));
  }

  async listIndexes(): Promise<string[]> {
    const response = await this.client.getCollections();
    return response.collections.map(collection => collection.name) || [];
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    const { config, points_count } = await this.client.getCollection(indexName);

    const distance = config.params.vectors?.distance as Schemas['Distance'];
    return {
      dimension: config.params.vectors?.size as number,
      count: points_count || 0,
      // @ts-expect-error
      metric: Object.keys(DISTANCE_MAPPING).find(key => DISTANCE_MAPPING[key] === distance),
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    await this.client.deleteCollection(indexName);
  }
}

import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  VectorFilter,
  ParamsToArgs,
} from '@mastra/core/vector';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Schemas } from '@qdrant/js-client-rest';

import { QdrantFilterTranslator } from './filter';

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

    const baseClient = new QdrantClient({
      url,
      apiKey,
      https,
    });

    const telemetry = this.__getTelemetry();
    this.client =
      telemetry?.traceClass(baseClient, {
        spanNamePrefix: 'qdrant-vector',
        attributes: {
          'vector.type': 'qdrant',
        },
      }) ?? baseClient;
  }

  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);

    const { indexName, vectors, metadata, ids } = params;

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

  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);

    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    await this.client.createCollection(indexName, {
      vectors: {
        // @ts-expect-error
        size: dimension,
        // @ts-expect-error
        distance: DISTANCE_MAPPING[metric],
      },
    });
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new QdrantFilterTranslator();
    return translator.translate(filter);
  }

  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);

    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    const translatedFilter = this.transformFilter(filter) ?? {};

    const results = (
      await this.client.query(indexName, {
        query: queryVector,
        limit: topK,
        filter: translatedFilter,
        with_payload: true,
        with_vector: includeVector,
      })
    ).points;

    return results.map(match => {
      let vector: number[] = [];
      if (includeVector) {
        if (Array.isArray(match.vector)) {
          // If it's already an array of numbers
          vector = match.vector as number[];
        } else if (typeof match.vector === 'object' && match.vector !== null) {
          // If it's an object with vector data
          vector = Object.values(match.vector).filter(v => typeof v === 'number');
        }
      }

      return {
        id: match.id as string,
        score: match.score || 0,
        metadata: match.payload as Record<string, any>,
        ...(includeVector && { vector }),
      };
    });
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

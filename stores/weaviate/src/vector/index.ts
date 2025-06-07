import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  UpdateVectorParams,
  DeleteVectorParams,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import weaviate from 'weaviate-client';
import type { Collection, ConnectToCustomOptions, VectorDistance, WeaviateClient } from 'weaviate-client';

import { WeaviateFilterTranslator } from './filter';

const BATCH_SIZE = 500;
const DISTANCE_MAPPING: Record<string, VectorDistance> = {
  cosine: 'cosine',
  euclidean: 'l2-squared',
  dotproduct: 'dot',
};

export type WeaviateVectorOptions = ConnectToCustomOptions;

export class WeaviateVector extends MastraVector {
  private client: WeaviateClient;

  private constructor(baseClient: WeaviateClient) {
    super();

    const telemetry = this.__getTelemetry();
    this.client =
      telemetry?.traceClass(baseClient, {
        spanNamePrefix: 'weaviate-vector',
        attributes: {
          'vector.type': 'weaviate',
        },
      }) ?? baseClient;
  }

  public static use = (opts?: WeaviateVectorOptions): Promise<WeaviateVector> =>
    weaviate.connectToCustom(opts || {}).then(client => new WeaviateVector(client));

  public async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    const objects = vectors.map((vector, i) => ({
      id: ids?.[i] || undefined,
      vectors: vector,
      properties: metadata?.[i] || {},
    }));

    const collection = this.client.collections.use(indexName);
    let uuids: string[] = [];
    for (let i = 0; i < objects.length; i += BATCH_SIZE) {
      const batch = objects.slice(i, i + BATCH_SIZE);
      const res = await collection.data.insertMany(batch);
      if (res.hasErrors) {
        const errs = Object.values(res.errors);
        throw new Error(`Error upserting ${errs.length} objects: ${errs.map(e => e.message).join(', ')}`);
      }
      uuids = uuids.concat(Object.values(res.uuids));
    }

    return uuids;
  }

  public createIndex({ indexName, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    return this.client.collections
      .create({
        name: indexName,
        invertedIndex: weaviate.configure.invertedIndex({
          indexNullState: true,
          indexPropertyLength: true,
          indexTimestamps: true,
        }),
        vectorizers: weaviate.configure.vectorizer.none({
          vectorIndexConfig: weaviate.configure.vectorIndex.hnsw({
            distanceMetric: DISTANCE_MAPPING[metric],
          }),
        }),
      })
      .then(() => {});
  }

  transformFilter = (collection: Collection, filter?: VectorFilter) =>
    WeaviateFilterTranslator.use(collection).translate(filter);

  query({ indexName, queryVector, topK, filter, includeVector }: QueryVectorParams): Promise<QueryResult[]> {
    const collection = this.client.collections.use(indexName);
    return collection.query
      .nearVector(queryVector, {
        limit: topK,
        filters: this.transformFilter(collection, filter),
        includeVector,
        returnMetadata: ['distance'],
      })
      .then(res =>
        res.objects.map(obj => ({
          id: obj.uuid,
          score: obj.metadata?.distance || 0,
          metadata: obj.properties,
          vector: obj.vectors.default,
        })),
      );
  }

  listIndexes = (): Promise<string[]> => this.client.collections.listAll().then(cols => cols.map(col => col.name));

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const collection = this.client.collections.use(indexName);
    const [config, count, anObj] = await Promise.all([
      collection.config.get(),
      collection.length(),
      collection.query.fetchObjects({ limit: 1, includeVector: true }).then(res => res.objects[0]),
    ]);

    const distance = config.vectorizers.default?.indexConfig.distance;
    return {
      dimension: anObj?.vectors.default?.length || -1,
      count,
      metric: Object.keys(DISTANCE_MAPPING).find(key => DISTANCE_MAPPING[key] === distance) as IndexStats['metric'],
    };
  }

  deleteIndex = ({ indexName }: DeleteIndexParams): Promise<void> => this.client.collections.delete(indexName);

  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    if (!update.vector && !update.metadata) {
      throw new Error('No updates provided');
    }
    try {
      await this.client.collections.use(indexName).data.update({
        id,
        vectors: update.vector,
        properties: update.metadata,
      });
    } catch (error) {
      console.error('Error inserting into Weaviate index:', error);
      throw error;
    }
  }

  deleteVector = ({ indexName, id }: DeleteVectorParams): Promise<void> =>
    this.client.collections
      .use(indexName)
      .data.deleteById(id)
      .then(() => {});
}

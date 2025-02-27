import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  VectorFilter,
} from '@mastra/core/vector';
import Cloudflare from 'cloudflare';

import { VectorizeFilterTranslator } from './filter';

export class CloudflareVector extends MastraVector {
  client: Cloudflare;
  accountId: string;

  constructor({ accountId, apiToken }: { accountId: string; apiToken: string }) {
    super();
    this.accountId = accountId;

    this.client = new Cloudflare({
      apiKey: apiToken,
    });
  }

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    const generatedIds = ids || vectors.map(() => crypto.randomUUID());

    // Create NDJSON string - each line is a JSON object
    const ndjson = vectors
      .map((vector, index) =>
        JSON.stringify({
          id: generatedIds[index]!,
          values: vector,
          metadata: metadata?.[index],
        }),
      )
      .join('\n');

    // Note: __binaryRequest is required for proper NDJSON handling
    await this.client.vectorize.indexes.upsert(
      indexName,
      {
        account_id: this.accountId,
        body: ndjson,
      },
      {
        __binaryRequest: true,
      },
    );

    return generatedIds;
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new VectorizeFilterTranslator();
    return translator.translate(filter);
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    await this.client.vectorize.indexes.create({
      account_id: this.accountId,
      config: {
        dimensions: dimension,
        metric: metric === 'dotproduct' ? 'dot-product' : metric,
      },
      name: indexName,
    });
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: QueryVectorParams): Promise<QueryResult[]> {
    const translatedFilter = this.transformFilter(filter) ?? {};
    const response = await this.client.vectorize.indexes.query(indexName, {
      account_id: this.accountId,
      vector: queryVector,
      returnValues: includeVector,
      returnMetadata: 'all',
      topK,
      filter: translatedFilter,
    });

    return (
      response?.matches?.map((match: any) => {
        return {
          id: match.id,
          metadata: match.metadata,
          score: match.score,
          vector: match.values,
        };
      }) || []
    );
  }

  async listIndexes(): Promise<string[]> {
    const res = await this.client.vectorize.indexes.list({
      account_id: this.accountId,
    });

    return res?.result?.map(index => index.name!) || [];
  }

  async describeIndex(indexName: string) {
    const index = await this.client.vectorize.indexes.get(indexName, {
      account_id: this.accountId,
    });

    const described = await this.client.vectorize.indexes.info(indexName, {
      account_id: this.accountId,
    });

    return {
      dimension: described?.dimensions!,
      // Since vector_count is not available in the response,
      // we might need a separate API call to get the count if needed
      count: described?.vectorCount || 0,
      metric: index?.config?.metric as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    await this.client.vectorize.indexes.delete(indexName, {
      account_id: this.accountId,
    });
  }

  async createMetadataIndex(indexName: string, propertyName: string, indexType: 'string' | 'number' | 'boolean') {
    await this.client.vectorize.indexes.metadataIndex.create(indexName, {
      account_id: this.accountId,
      propertyName,
      indexType,
    });
  }

  async deleteMetadataIndex(indexName: string, propertyName: string) {
    await this.client.vectorize.indexes.metadataIndex.delete(indexName, {
      account_id: this.accountId,
      propertyName,
    });
  }

  async listMetadataIndexes(indexName: string) {
    const res = await this.client.vectorize.indexes.metadataIndex.list(indexName, {
      account_id: this.accountId,
    });

    return res?.metadataIndexes ?? [];
  }
}

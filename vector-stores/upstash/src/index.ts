import { type Filter } from '@mastra/core/filter';
import { MastraVector, type QueryResult } from '@mastra/core/vector';
import { Index } from '@upstash/vector';

import { UpstashFilterTranslator } from './filter';

export class UpstashVector extends MastraVector {
  private client: Index;

  constructor({ url, token }: { url: string; token: string }) {
    super();
    this.client = new Index({
      url,
      token,
    });
  }

  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
    const generatedIds = ids || vectors.map(() => crypto.randomUUID());

    const points = vectors.map((vector, index) => ({
      id: generatedIds[index]!,
      vector,
      metadata: metadata?.[index],
    }));

    await this.client.upsert(points, {
      namespace: indexName,
    });
    return generatedIds;
  }

  transformFilter(filter?: Filter) {
    const translator = new UpstashFilterTranslator();
    return translator.translate(filter);
  }

  async createIndex(
    _indexName: string,
    _dimension: number,
    _metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  ): Promise<void> {
    console.log('No need to call createIndex for Upstash');
  }

  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Filter,
    includeVector: boolean = false,
  ): Promise<QueryResult[]> {
    const ns = this.client.namespace(indexName);

    const filterString = this.transformFilter(filter);
    const results = await ns.query({
      topK,
      vector: queryVector,
      includeVectors: includeVector,
      includeMetadata: true,
      ...(filterString ? { filter: filterString } : {}),
    });

    // Map the results to our expected format
    return (results || []).map(result => ({
      id: `${result.id}`,
      score: result.score,
      metadata: result.metadata,
      ...(includeVector && { vector: result.vector || [] }),
    }));
  }

  async listIndexes(): Promise<string[]> {
    const indexes = await this.client.listNamespaces();
    return indexes.filter(Boolean);
  }

  async describeIndex(indexName: string) {
    const info = await this.client.info();

    return {
      dimension: info.dimension,
      count: info.namespaces?.[indexName]?.vectorCount || 0,
      metric: info?.similarityFunction?.toLowerCase() as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.client.deleteNamespace(indexName);
    } catch (error) {
      console.error('Failed to delete namespace:', error);
    }
  }
}

throw new Error(
  '@mastra/vector-upstash is deprecated. Please use @mastra/upstash instead:\n\n' +
    'npm install @mastra/upstash\n\n' +
    'Then update your imports:\n' +
    "import { UpstashVector } from '@mastra/upstash'",
);

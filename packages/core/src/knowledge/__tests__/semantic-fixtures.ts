import { APICallError } from '@internal/ai-sdk-v5';
import { estimateTokenCount } from 'tokenx';
import { MastraVector } from '../../vector';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DeleteVectorsParams,
  DescribeIndexParams,
  IndexStats,
  MastraEmbeddingModel,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '../../vector';

/** A real exact-cosine vector store held in memory; records every topK it is asked for. */
export class MemoryVector extends MastraVector {
  indexes = new Map<string, { dimension: number; rows: Map<string, number[]> }>();
  topKs: number[] = [];

  constructor() {
    super({ id: 'memory-vector' });
  }
  async query({ indexName, queryVector, topK = 10 }: QueryVectorParams): Promise<QueryResult[]> {
    this.topKs.push(topK);
    const rows = this.indexes.get(indexName)?.rows ?? new Map<string, number[]>();
    const norm = (v: number[]) => Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
    const q = queryVector!;
    return [...rows]
      .map(([id, v]) => ({ id, score: v.reduce((a, x, i) => a + x * q[i]!, 0) / (norm(v) * norm(q)) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, topK);
  }
  /** Upserts left to fail, like a cold scale-to-zero database timing out the connection; -1 fails them all. */
  failUpserts = 0;
  upserts = 0;
  async upsert({ indexName, ids, vectors }: UpsertVectorParams): Promise<string[]> {
    this.upserts++;
    if (this.failUpserts !== 0) {
      if (this.failUpserts > 0) this.failUpserts--;
      throw new Error('Connection terminated due to connection timeout');
    }
    const index = this.indexes.get(indexName)!;
    ids!.forEach((id, i) => index.rows.set(id, vectors[i]!));
    return ids!;
  }
  async createIndex({ indexName, dimension }: CreateIndexParams): Promise<void> {
    this.indexes.set(indexName, { dimension, rows: new Map() });
  }
  async listIndexes(): Promise<string[]> {
    return [...this.indexes.keys()];
  }
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const index = this.indexes.get(indexName)!;
    return { dimension: index.dimension, count: index.rows.size, metric: 'cosine' };
  }
  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    this.indexes.delete(indexName);
  }
  async updateVector(_: UpdateVectorParams): Promise<void> {
    throw new Error('not used');
  }
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    this.indexes.get(indexName)?.rows.delete(id);
  }
  /** Set to make deleteVectors throw, like Astra, which can't delete by id list. */
  failDeletes = false;
  async deleteVectors({ indexName, ids }: DeleteVectorsParams): Promise<void> {
    if (this.failDeletes) throw new Error('deleteVectors is not supported');
    for (const id of ids ?? []) this.indexes.get(indexName)?.rows.delete(id);
  }
  ids(): string[] {
    return [...this.indexes.values()].flatMap(index => [...index.rows.keys()]);
  }
}

/** Words map onto concept axes, so "reimbursement" lands near "refund" with no shared word. */
const CONCEPTS: Record<string, number> = {
  refund: 0,
  refunds: 0,
  reimbursement: 0,
  money: 0,
  back: 0,
  shipping: 1,
  delivery: 1,
  courier: 1,
  holiday: 2,
  vacation: 2,
  leave: 2,
};
export type EmbedderState = {
  fail: boolean;
  calls: number;
  transient?: number;
  options?: Record<string, unknown>[];
  /** Refuses any input over this many estimated tokens, like a real embedder's input limit. */
  maxTokens?: number;
};
export function conceptEmbedder(state: EmbedderState): MastraEmbeddingModel<string> {
  return {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'concepts',
    maxEmbeddingsPerCall: 1,
    supportsParallelCalls: true,
    doEmbed: async ({ values, ...options }: { values: string[] } & Record<string, unknown>) => {
      state.calls++;
      state.options?.push(options);
      if (state.fail) throw new Error('embedder down');
      if (state.maxTokens && values.some(text => estimateTokenCount(text) > state.maxTokens!)) {
        throw new APICallError({
          message: 'input too long',
          url: 'x',
          requestBodyValues: {},
          statusCode: 400,
          isRetryable: false,
        });
      }
      if (state.transient && state.transient-- > 0) {
        throw new APICallError({
          message: 'rate limited',
          url: 'x',
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: true,
        });
      }
      return {
        embeddings: values.map(text => {
          const v = [0.01, 0.01, 0.01, 0.01];
          for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
            const axis = CONCEPTS[word];
            v[axis ?? 3]! += axis === undefined ? 0.05 : 1;
          }
          return v;
        }),
      };
    },
  } as unknown as MastraEmbeddingModel<string>;
}

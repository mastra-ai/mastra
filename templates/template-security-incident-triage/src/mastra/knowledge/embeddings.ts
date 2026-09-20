import { mkdir } from 'node:fs/promises';

import type { FlagEmbedding } from '@mastra/fastembed';

import { sha256 } from './hashes.js';
import { EMBEDDING_DIMENSION } from './schemas.js';
import { readRunbookConfig } from './config.js';

export interface RunbookEmbedder {
  readonly provider: 'fastembed' | 'deterministic-test';
  readonly model: 'bge-small-en-v1.5' | 'deterministic-test-v1';
  readonly dimension: 384;
  embedDocuments(values: readonly string[]): Promise<readonly number[][]>;
  embedQuery(value: string): Promise<readonly number[]>;
}

export class DeterministicRunbookEmbedder implements RunbookEmbedder {
  readonly provider = 'deterministic-test' as const;
  readonly model = 'deterministic-test-v1' as const;
  readonly dimension = EMBEDDING_DIMENSION;

  async embedDocuments(values: readonly string[]): Promise<readonly number[][]> {
    return values.map(value => deterministicVector(value));
  }

  async embedQuery(value: string): Promise<readonly number[]> {
    return deterministicVector(value);
  }
}

export class FastEmbedRunbookEmbedder implements RunbookEmbedder {
  readonly provider = 'fastembed' as const;
  readonly model = 'bge-small-en-v1.5' as const;
  readonly dimension = EMBEDDING_DIMENSION;
  private modelPromise?: Promise<FlagEmbedding>;

  constructor(private readonly cacheDir = readRunbookConfig().fastembedCacheDir) {}

  async embedDocuments(values: readonly string[]): Promise<readonly number[][]> {
    const model = await this.getModel();
    const output: number[][] = [];
    for await (const batch of model.passageEmbed([...values], 256)) output.push(...batch);
    return validateVectors(output, values.length);
  }

  async embedQuery(value: string): Promise<readonly number[]> {
    const model = await this.getModel();
    return validateVectors([await model.queryEmbed(value)], 1)[0] ?? [];
  }

  private getModel(): Promise<FlagEmbedding> {
    this.modelPromise ??= this.loadModel();
    return this.modelPromise;
  }

  private async loadModel(): Promise<FlagEmbedding> {
    await mkdir(this.cacheDir, { recursive: true });
    const { EmbeddingModel, FlagEmbedding } = await import('@mastra/fastembed');
    return FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
      cacheDir: this.cacheDir,
      showDownloadProgress: false,
    });
  }
}

function deterministicVector(value: string): number[] {
  const output = Array.from({ length: EMBEDDING_DIMENSION }, () => 0);
  const tokens = value.toLowerCase().match(/[a-z0-9_]+/gu) ?? [];
  for (const token of tokens) {
    const digest = sha256(token);
    const index = Number.parseInt(digest.slice(0, 8), 16) % output.length;
    const sign = Number.parseInt(digest.slice(8, 10), 16) % 2 === 0 ? 1 : -1;
    output[index] = (output[index] ?? 0) + sign;
  }
  const norm = Math.hypot(...output) || 1;
  return output.map(item => item / norm);
}

function validateVectors(vectors: readonly number[][], expected: number): readonly number[][] {
  if (
    vectors.length !== expected ||
    vectors.some(vector => vector.length !== EMBEDDING_DIMENSION || vector.some(value => !Number.isFinite(value)))
  ) {
    throw new Error('FastEmbed returned an invalid embedding shape');
  }
  return vectors;
}

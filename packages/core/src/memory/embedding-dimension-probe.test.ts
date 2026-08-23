/**
 * Regression tests for getEmbeddingDimension()'s failure handling.
 *
 * Previously, a failed dimension probe was swallowed (console.warn only) and treated as
 * "this is the default 1536-dim embedder", silently baking a wrong vector index name into
 * the SemanticRecall processor. See memory.ts getEmbeddingDimension()/getEmbeddingIndexName().
 */
import { describe, it, expect, vi } from 'vitest';
import type { MastraEmbeddingModel, MastraVector } from '../vector';
import { MockMemory } from './mock';

function makeMemory({ rejectProbe }: { rejectProbe: boolean }) {
  const memory = new MockMemory({ enableMessageHistory: false });

  const vector = {
    listIndexes: vi.fn().mockResolvedValue([]),
    createIndex: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue([]),
  } as unknown as MastraVector;

  const embedder = {
    modelId: 'test-embedder',
    doEmbed: vi.fn(async ({ values }: { values: string[] }) => {
      if (rejectProbe && values.length === 1 && values[0] === 'a') {
        throw new Error('provider rejected embed request: input too short');
      }
      return { embeddings: values.map(() => [0.1, 0.2, 0.3]) };
    }),
  } as unknown as MastraEmbeddingModel<string>;

  (memory as any).vector = vector;
  (memory as any).embedder = embedder;
  (memory as any).threadConfig = {
    ...(memory as any).threadConfig,
    semanticRecall: true,
    lastMessages: false,
  };

  return { memory, embedder };
}

describe('MastraMemory embedding dimension probe failure handling', () => {
  it('throws instead of silently falling back to the default 1536-dim index name when the probe fails', async () => {
    const { memory } = makeMemory({ rejectProbe: true });

    await expect(memory.getInputProcessors()).rejects.toThrow(
      /Failed to determine the embedder's output dimension/,
    );
  });

  it('clears the cached probe so a later call retries instead of staying permanently broken', async () => {
    const { memory, embedder } = makeMemory({ rejectProbe: true });

    await expect(memory.getInputProcessors()).rejects.toThrow();

    // Embedder recovers (e.g. a transient network issue clears)
    vi.mocked(embedder.doEmbed).mockImplementation(async ({ values }: { values: string[] }) => ({
      embeddings: values.map(() => [0.1, 0.2, 0.3]),
    }));

    const processors = await memory.getInputProcessors();
    expect(processors.find(p => p.id === 'semantic-recall')).toBeDefined();
  });

  it('still builds the SemanticRecall processor normally when the probe succeeds', async () => {
    const { memory } = makeMemory({ rejectProbe: false });

    const processors = await memory.getInputProcessors();
    expect(processors.find(p => p.id === 'semantic-recall')).toBeDefined();
  });
});

/**
 * A configured `embeddingDimension` replaces the `doEmbed(['a'])` dimension probe.
 *
 * @see https://github.com/mastra-ai/mastra/issues/25809
 */
import { describe, expect, it } from 'vitest';

import type { MastraEmbeddingModel, MastraVector } from '../vector';

import { MockMemory } from './mock';

function countingEmbedder(dimension: number) {
  const calls: { values: string[] }[] = [];
  const embedder = {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'counting-embedder',
    maxEmbeddingsPerCall: 100,
    supportsParallelCalls: true,
    async doEmbed({ values }: { values: string[] }) {
      calls.push({ values });
      return { embeddings: values.map(() => Array.from({ length: dimension }, () => 0.1)) };
    },
  } as unknown as MastraEmbeddingModel<string>;
  return { embedder, calls };
}

const vector = { isSelfEmbedding: false, indexSeparator: '_' } as unknown as MastraVector;

function createMemory(embedder: MastraEmbeddingModel<string>, embeddingDimension?: number) {
  return new MockMemory({
    enableMessageHistory: false,
    options: { semanticRecall: true },
    vector,
    embedder,
    embeddingDimension,
  });
}

async function semanticRecallIndexNames(memory: MockMemory) {
  const input = await memory.getInputProcessors();
  const output = await memory.getOutputProcessors();
  return [...input, ...output]
    .filter(p => p.id === 'semantic-recall')
    .map(p => (p as unknown as { indexName: string }).indexName);
}

describe('MastraMemory embeddingDimension (#25809)', () => {
  it('skips the probe and uses the same index name as probing when the dimension is configured', async () => {
    const configured = countingEmbedder(1024);
    const configuredNames = await semanticRecallIndexNames(createMemory(configured.embedder, 1024));

    const probed = countingEmbedder(1024);
    const probedNames = await semanticRecallIndexNames(createMemory(probed.embedder));

    expect(configured.calls).toHaveLength(0);
    expect(probed.calls).toEqual([{ values: ['a'] }]);
    expect(configuredNames).toEqual(['memory_messages_1024', 'memory_messages_1024']);
    expect(configuredNames).toEqual(probedNames);
  });

  it('keeps the default index name when the configured dimension is 1536', async () => {
    const configured = countingEmbedder(1536);
    const configuredNames = await semanticRecallIndexNames(createMemory(configured.embedder, 1536));

    const probed = countingEmbedder(1536);
    const probedNames = await semanticRecallIndexNames(createMemory(probed.embedder));

    expect(configured.calls).toHaveLength(0);
    expect(configuredNames).toEqual(['memory_messages', 'memory_messages']);
    expect(configuredNames).toEqual(probedNames);
  });

  it('probes the embedder once and caches the result when no dimension is configured', async () => {
    const { embedder, calls } = countingEmbedder(768);
    const memory = createMemory(embedder);

    const first = await semanticRecallIndexNames(memory);
    const second = await semanticRecallIndexNames(memory);

    expect(calls).toEqual([{ values: ['a'] }]);
    expect(first).toEqual(['memory_messages_768', 'memory_messages_768']);
    expect(second).toEqual(first);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects embeddingDimension %s', value => {
    const { embedder } = countingEmbedder(1024);
    expect(() => createMemory(embedder, value)).toThrow(/embeddingDimension must be a positive integer/);
  });
});

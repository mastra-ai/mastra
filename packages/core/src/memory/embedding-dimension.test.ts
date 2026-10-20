/**
 * A configured `embeddingDimension` replaces the `doEmbed(['a'])` dimension probe.
 *
 * @see https://github.com/mastra-ai/mastra/issues/25809
 */
import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../agent/message-list';
import type { Processor } from '../processors';
import { RequestContext } from '../request-context';
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

function recordingVector() {
  const createIndexCalls: { indexName: string; dimension?: number }[] = [];
  const upsertCalls: { indexName: string }[] = [];
  const vector = {
    isSelfEmbedding: false,
    indexSeparator: '_',
    async createIndex(params: { indexName: string; dimension?: number }) {
      createIndexCalls.push({ indexName: params.indexName, dimension: params.dimension });
    },
    async upsert(params: { indexName: string }) {
      upsertCalls.push({ indexName: params.indexName });
      return [];
    },
    async query() {
      return [];
    },
  } as unknown as MastraVector;
  return { vector, createIndexCalls, upsertCalls };
}

function createMemory(
  embedder: MastraEmbeddingModel<string>,
  embeddingDimension?: number,
  memoryVector: MastraVector = vector,
) {
  return new MockMemory({
    enableMessageHistory: false,
    options: { semanticRecall: true },
    vector: memoryVector,
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

  describe('when the configured dimension does not match the embedder', () => {
    const mismatch = /configured with embeddingDimension 768, but the embedder returned 1536-dimensional embeddings/;

    function requestContext() {
      const ctx = new RequestContext();
      ctx.set('MastraMemory', { thread: { id: 'thread-1' }, resourceId: 'resource-1' });
      return ctx;
    }

    function message(role: 'user' | 'assistant', text: string): MastraDBMessage {
      return {
        id: `msg-${role}`,
        role,
        threadId: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text }] },
      };
    }

    function semanticRecall(processors: Processor[]) {
      const processor = processors.find(p => p.id === 'semantic-recall');
      if (!processor) throw new Error('SemanticRecall processor missing');
      return processor;
    }

    it('throws from the SemanticRecall input processor before creating or querying the index', async () => {
      const { embedder } = countingEmbedder(1536);
      const { vector: recording, createIndexCalls } = recordingVector();
      const memory = createMemory(embedder, 768, recording);
      const processor = semanticRecall(await memory.getInputProcessors());

      await expect(
        processor.processInput!({
          messages: [message('user', 'what did we discuss?')],
          messageList: undefined as never,
          abort: (() => {
            throw new Error('abort');
          }) as never,
          requestContext: requestContext(),
        }),
      ).rejects.toThrow(mismatch);
      expect(createIndexCalls).toEqual([]);
    });

    it('throws from the SemanticRecall output processor before creating the index or upserting', async () => {
      const { embedder } = countingEmbedder(1536);
      const { vector: recording, createIndexCalls, upsertCalls } = recordingVector();
      const memory = createMemory(embedder, 768, recording);
      const processor = semanticRecall(await memory.getOutputProcessors());

      await expect(
        processor.processOutputResult!({
          messages: [message('assistant', 'here is the answer')],
          abort: (() => {
            throw new Error('abort');
          }) as never,
          requestContext: requestContext(),
        } as never),
      ).rejects.toThrow(mismatch);
      expect(createIndexCalls).toEqual([]);
      expect(upsertCalls).toEqual([]);
    });

    it('throws from createEmbeddingIndex, used by Memory recall and saveMessages, before creating an index', async () => {
      const { embedder } = countingEmbedder(1536);
      const { vector: recording, createIndexCalls } = recordingVector();
      const memory = createMemory(embedder, 768, recording) as unknown as {
        createEmbeddingIndex(dimension?: number): Promise<{ indexName: string }>;
      };

      await expect(memory.createEmbeddingIndex(1536)).rejects.toMatchObject({
        id: 'MASTRA_MEMORY_EMBEDDING_DIMENSION_MISMATCH',
        category: 'USER',
        details: { configured: 768, actual: 1536 },
      });
      expect(createIndexCalls).toEqual([]);
    });

    it('creates the index as before when the configured dimension matches', async () => {
      const { embedder } = countingEmbedder(768);
      const { vector: recording, createIndexCalls } = recordingVector();
      const memory = createMemory(embedder, 768, recording) as unknown as {
        createEmbeddingIndex(dimension?: number): Promise<{ indexName: string }>;
      };

      await expect(memory.createEmbeddingIndex(768)).resolves.toEqual({ indexName: 'memory_messages_768' });
      expect(createIndexCalls).toEqual([{ indexName: 'memory_messages_768', dimension: 768 }]);
    });
  });
});

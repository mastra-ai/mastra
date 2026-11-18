import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { describe, expect, it } from 'vitest';

import { Memory } from './index';

/**
 * The run stores the user's message before it asks the model, so a reload during the reply still
 * shows it. With semantic recall on, that early write must not index the message a second time:
 * the turn's own save indexes it once.
 */

function makeVectorStore() {
  const upserted: string[] = [];
  const store = {
    id: 'recording-vector',
    async createIndex() {},
    async listIndexes() {
      return [];
    },
    async describeIndex() {
      return { dimension: 3, metric: 'cosine', count: 0 };
    },
    async upsert({ ids, metadata }: { ids: string[]; metadata: Record<string, any>[] }) {
      upserted.push(...metadata.map(row => row.message_id));
      return ids;
    },
    async query() {
      return [];
    },
    async deleteVectors() {},
  };
  return { store: store as unknown as MastraVector, upserted };
}

const embedder = {
  specificationVersion: 'v1' as const,
  provider: 'test',
  modelId: 'length-embedder',
  maxEmbeddingsPerCall: 256,
  supportsParallelCalls: true,
  async doEmbed({ values }: { values: string[] }) {
    return { embeddings: values.map(value => [value.length, 1, 1]), usage: { tokens: values.length } };
  },
};

describe('user message stored before the model request', () => {
  it('is stored when the model is asked and indexed once for semantic recall', async () => {
    const vector = makeVectorStore();
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector: vector.store,
      embedder: embedder as any,
      options: { lastMessages: 10, semanticRecall: true },
    });
    const threadId = randomUUID();
    const resourceId = 'resource-1';
    const storedAtRequest: string[][] = [];
    const storedUser = async () => {
      const { messages } = await memory.recall({ threadId, resourceId });
      return messages.filter(message => message.role === 'user');
    };

    const agent = new Agent({
      id: 'recall-agent',
      name: 'recall-agent',
      instructions: 'test',
      memory,
      model: new MockLanguageModelV2({
        doStream: async () => {
          storedAtRequest.push(
            (await storedUser()).flatMap(message =>
              message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])),
            ),
          );
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'r1', modelId: 'mock', timestamp: new Date(0) },
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'hi' },
              { type: 'text-end', id: 't1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
          };
        },
      }),
    });

    const result = await agent.stream('remember the blue door', { memory: { thread: threadId, resource: resourceId } });
    await result.consumeStream();

    expect(storedAtRequest).toEqual([['remember the blue door']]);
    const [user] = await storedUser();
    expect(vector.upserted.filter(id => id === user!.id)).toHaveLength(1);
  });
});

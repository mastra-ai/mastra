import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory, Subconscious } from '@mastra/memory';
import type { EmbeddingModel } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

function message(threadId: string, resourceId: string): MastraDBMessage {
  return {
    id: randomUUID(),
    threadId,
    resourceId,
    role: 'user',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'Maya Chen owns Project Atlas, whose staging region is cobalt.' }],
    },
  };
}

const embedder: EmbeddingModel<string> = {
  specificationVersion: 'v1',
  provider: 'aimock',
  modelId: 'deterministic-embedding',
  maxEmbeddingsPerCall: 128,
  supportsParallelCalls: true,
  async doEmbed({ values }) {
    return { embeddings: values.map(() => [0.1, 0.2, 0.3, 0.4]) };
  },
};

describe('Subconscious LibSQL integration', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  it('captures durable scoped knowledge in one shared structured call and reconciles semantic vectors', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-libsql-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();

    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'capture-observation', modelId: 'aimock', timestamp: new Date() },
        { type: 'text-start', id: 'capture-text' },
        {
          type: 'text-delta',
          id: 'capture-text',
          delta: '<observations>Maya Chen owns Project Atlas. The staging region is cobalt.</observations>',
        },
        { type: 'text-end', id: 'capture-text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }));
    const doGenerate = vi.fn(async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 30, outputTokens: 20, totalTokens: 50 },
      warnings: [],
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            capture: {
              entities: [
                {
                  name: 'Project Atlas',
                  kind: 'project',
                  facts: [{ text: '[[Maya Chen]] owns [[Project Atlas]].' }, { text: 'The staging region is cobalt.' }],
                },
              ],
            },
          }),
        },
      ],
    }));
    const model = new MockLanguageModelV2({ doStream: doStream as never, doGenerate: doGenerate as never });
    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          subconscious: new Subconscious({ observation: ['capture'], reflection: [] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const threadId = randomUUID();
    const resourceId = randomUUID();
    await memory.createThread({ threadId, resourceId, title: 'Subconscious capture' });
    await memory.saveMessages({ messages: [message(threadId, resourceId)] });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    const result = await (await memory.omEngine)!.observe({ threadId, resourceId, requestContext });
    expect(result.observed).toBe(true);
    expect(doStream).toHaveBeenCalledOnce();
    expect(doGenerate).toHaveBeenCalledOnce();

    const knowledge = (await storage.getStore('knowledge'))!;
    const scope = ['org:acme', `resource:${resourceId}`, `thread:${threadId}`];
    const atlas = await knowledge.resolveEntity({ name: 'Project Atlas', scope });
    expect(atlas).toMatchObject({ kind: 'project', scope: scope.slice(0, 2) });
    expect((await knowledge.factsAbout({ entityId: atlas!.id, scope })).facts).toHaveLength(2);

    expect(await memory.drainKnowledgeSemanticIndex(scope)).toBeGreaterThan(0);
    expect(await knowledge.listSemanticOutbox({ status: 'pending', scope })).toEqual([]);
    const indexName = (await vector.listIndexes()).find(name => name.startsWith('knowledge_documents_dimension'))!;
    const matches = await vector.query({ indexName, queryVector: [0.1, 0.2, 0.3, 0.4], topK: 20 });
    expect(matches.map(match => match.id)).toContain(`knowledge:entity:${atlas!.id}`);
  });
});

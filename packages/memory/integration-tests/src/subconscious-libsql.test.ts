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

function message(threadId: string, resourceId: string, text = 'Maya Chen owns Project Atlas.'): MastraDBMessage {
  return {
    id: randomUUID(),
    threadId,
    resourceId,
    role: 'user',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
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

  it('captures durable scoped knowledge, publishes activity, and reconciles semantic vectors', async () => {
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
              entities:
                doGenerate.mock.calls.length === 1
                  ? [
                      {
                        name: 'Project Atlas',
                        kind: 'project',
                        facts: [
                          { text: '[[Maya Chen]] owns [[Project Atlas]].' },
                          { text: 'The staging region is cobalt.' },
                        ],
                      },
                      {
                        name: 'Alpha Secret',
                        kind: 'note',
                        scope: 'thread',
                        facts: [{ text: 'Only the alpha thread may see this.', scope: 'thread' }],
                      },
                    ]
                  : [],
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
    const alphaSignals: Array<{ contents: string; cacheKey: string }> = [];
    const sendAlphaStateSignal = vi.fn(async signal => {
      alphaSignals.push(signal as { contents: string; cacheKey: string });
      return { skipped: false } as any;
    });

    const result = await (await memory.omEngine)!.observe({
      threadId,
      resourceId,
      requestContext,
      sendStateSignal: sendAlphaStateSignal,
    });
    expect(result.observed).toBe(true);
    expect(alphaSignals[0]?.contents).toContain('[[Project Atlas]]');
    expect(alphaSignals[0]?.contents).toContain('[[Alpha Secret]]');

    const knowledge = (await storage.getStore('knowledge'))!;
    const scope = ['org:acme', `resource:${resourceId}`, `thread:${threadId}`];
    const atlas = await knowledge.resolveEntity({ name: 'Project Atlas', scope });
    expect(atlas).toMatchObject({ kind: 'project', scope: scope.slice(0, 2) });
    expect((await knowledge.factsAbout({ entityId: atlas!.id, scope })).facts).toHaveLength(2);

    const betaThreadId = randomUUID();
    await memory.createThread({ threadId: betaThreadId, resourceId, title: 'Sibling thread' });
    const betaScope = ['org:acme', `resource:${resourceId}`, `thread:${betaThreadId}`];
    const betaCache = new Map<string, string>();
    const betaEmissions: string[] = [];
    const sendBetaStateSignal = vi.fn(async signal => {
      const state = signal as { id: string; cacheKey: string; contents: string };
      if (betaCache.get(state.id) === state.cacheKey) return { skipped: true, reason: 'unchanged' } as any;
      betaCache.set(state.id, state.cacheKey);
      betaEmissions.push(state.contents);
      return { skipped: false } as any;
    });
    for (const text of ['What changed?', 'Anything else?']) {
      await memory.saveMessages({ messages: [message(betaThreadId, resourceId, text)] });
      const betaResult = await (await memory.omEngine)!.observe({
        threadId: betaThreadId,
        resourceId,
        requestContext,
        sendStateSignal: sendBetaStateSignal,
      });
      expect(betaResult.observed).toBe(true);
    }
    expect(betaEmissions).toHaveLength(1);
    expect(betaEmissions[0]).toContain('[[Project Atlas]]');
    expect(betaEmissions[0]).not.toContain('[[Alpha Secret]]');
    expect(sendBetaStateSignal).toHaveBeenCalledTimes(2);
    expect(sendBetaStateSignal.mock.calls[0]?.[0]).toMatchObject({
      cacheKey: sendBetaStateSignal.mock.calls[1]?.[0].cacheKey,
    });
    expect(await knowledge.listActivity({ scope: betaScope, limit: 20 })).not.toEqual([]);
    expect(doStream).toHaveBeenCalledTimes(3);
    expect(doGenerate).toHaveBeenCalledTimes(3);

    expect(await memory.drainKnowledgeSemanticIndex(scope)).toBeGreaterThan(0);
    expect(await knowledge.listSemanticOutbox({ status: 'pending', scope })).toEqual([]);
    const indexName = (await vector.listIndexes()).find(name => name.startsWith('knowledge_documents_dimension'))!;
    const matches = await vector.query({ indexName, queryVector: [0.1, 0.2, 0.3, 0.4], topK: 20 });
    expect(matches.map(match => match.id)).toContain(`knowledge:entity:${atlas!.id}`);

    const alphaSecret = await knowledge.resolveEntity({ name: 'Alpha Secret', scope });
    await knowledge.appendFact({
      parentEntityId: alphaSecret!.id,
      text: 'The shared cobalt checklist is ready.',
      scope: scope.slice(0, 2),
      sourceThreadId: threadId,
      resolutionScope: scope,
      defaultScope: scope,
    });

    const tools = memory.listTools();
    const toolContext = { agent: { threadId: betaThreadId, resourceId }, requestContext } as any;
    const search = await tools.knowledge_search!.execute?.({ query: 'cobalt staging' }, toolContext);
    expect(search).toMatchObject({
      results: expect.arrayContaining([expect.objectContaining({ name: 'Project Atlas' })]),
    });
    expect((search as any).results.map((item: any) => item.name)).not.toContain('Alpha Secret');
    expect((search as any).results).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'fact', name: '(private entity)' })]),
    );
    const read = await tools.knowledge_read!.execute?.({ type: 'entity', name: 'Project Atlas' }, toolContext);
    expect(read).toMatchObject({ found: true, entity: { name: 'Project Atlas' } });
    const hidden = await tools.knowledge_read!.execute?.({ type: 'entity', name: 'Alpha Secret' }, toolContext);
    expect(hidden).toEqual({ found: false });
    const browse = await tools.knowledge_browse!.execute?.({}, toolContext);
    expect((browse as any).records.map((record: any) => record.name)).not.toContain('Alpha Secret');
  });
});

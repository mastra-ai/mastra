import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent, createSignal } from '@mastra/core/agent';
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

  it('runs remind after observation and emits one scoped remembered signal', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-remind-libsql-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();

    let streamCall = 0;
    const reminder = 'Project Atlas launches January 15. Source fact: fact-atlas-launch.';
    const model = new MockLanguageModelV2({
      doStream: async () => {
        streamCall += 1;
        const text =
          streamCall === 1 ? '<observations>\n- The user is scheduling Project Atlas.\n</observations>' : reminder;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `remind-${streamCall}`, modelId: 'aimock', timestamp: new Date() },
            { type: 'text-start', id: `text-${streamCall}` },
            { type: 'text-delta', id: `text-${streamCall}`, delta: text },
            { type: 'text-end', id: `text-${streamCall}` },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        warnings: [],
        content: [{ type: 'text' as const, text: reminder }],
      }),
    });
    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          subconscious: new Subconscious({ observation: ['remind'], reflection: [] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const scope = ['org:acme', `resource:${resourceId}`, `thread:${threadId}`];
    const knowledge = (await storage.getStore('knowledge'))!;
    const atlas = await knowledge.createEntity({ name: 'Project Atlas', kind: 'project', scope: scope.slice(0, 2) });
    await knowledge.appendFact({
      id: 'fact-atlas-launch',
      parentEntityId: atlas.id,
      text: '[[Project Atlas]] launches January 15.',
      scope: scope.slice(0, 2),
      sourceThreadId: threadId,
      resolutionScope: scope,
      defaultScope: scope.slice(0, 2),
    });
    await memory.createThread({ threadId, resourceId, title: 'Subconscious remind' });
    await memory.saveMessages({ messages: [message(threadId, resourceId, 'Help me schedule the launch.')] });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const sendSignal = vi.fn(async () => undefined) as any;
    const mainAgent = new Agent({ id: 'main-agent', name: 'Main Agent', instructions: 'Help the user.', model });
    const getModel = vi.spyOn(mainAgent, 'getModel');

    const result = await (await memory.omEngine)!.observe({
      threadId,
      resourceId,
      agent: mainAgent,
      requestContext,
      sendSignal,
    });

    expect(result.observed).toBe(true);
    expect(getModel).toHaveBeenCalled();
    expect(streamCall).toBe(1);
    expect(sendSignal).toHaveBeenCalledOnce();
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reactive', tagName: 'remembered', contents: expect.stringContaining(reminder) }),
    );
  });

  it('targets a resource-scoped reminder to its observed thread', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-remind-resource-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();
    const resourceId = randomUUID();
    const threadIds = [randomUUID(), randomUUID()];
    const observations = threadIds
      .map(threadId => `<thread id="${threadId}">\n- Project Atlas planning is active.\n</thread>`)
      .join('\n');
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resource-observation', modelId: 'aimock', timestamp: new Date() },
          { type: 'text-start', id: 'resource-text' },
          { type: 'text-delta', id: 'resource-text', delta: `<observations>${observations}</observations>` },
          { type: 'text-end', id: 'resource-text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        warnings: [],
        content: [{ type: 'text' as const, text: 'Project Atlas launches January 15.' }],
      }),
    });
    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          scope: 'resource',
          subconscious: new Subconscious({ observation: ['remind'], reflection: [] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const knowledge = (await storage.getStore('knowledge'))!;
    const entity = await knowledge.createEntity({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', `resource:${resourceId}`],
    });
    await knowledge.appendFact({
      parentEntityId: entity.id,
      text: '[[Project Atlas]] launches January 15.',
      scope: ['org:acme', `resource:${resourceId}`],
      sourceThreadId: threadIds[0]!,
      resolutionScope: ['org:acme', `resource:${resourceId}`, `thread:${threadIds[0]}`],
      defaultScope: ['org:acme', `resource:${resourceId}`],
    });
    for (const threadId of threadIds) {
      await memory.createThread({ threadId, resourceId, title: `Resource reminder ${threadId}` });
      await memory.saveMessages({ messages: [message(threadId, resourceId, 'Plan Project Atlas.')] });
    }
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const mainAgent = new Agent({ id: 'resource-main-agent', name: 'Main Agent', instructions: 'Help.', model });
    const targetedDeliveries: Array<{
      resourceId?: string;
      threadId?: string;
      ifActive?: { behavior?: string };
      ifIdle?: { behavior?: string };
    }> = [];
    const getModel = vi.spyOn(mainAgent, 'getModel');
    vi.spyOn(mainAgent, 'sendSignal').mockImplementation((signal, options) => {
      targetedDeliveries.push(options);
      return {
        signal: createSignal(signal),
        accepted: Promise.resolve({ action: 'persist' }),
        persisted: Promise.resolve(),
      } as any;
    });

    const result = await (await memory.omEngine)!.observe({
      threadId: threadIds[0],
      resourceId,
      agent: mainAgent,
      requestContext,
      sendSignal: vi.fn(async () => undefined) as any,
    });

    expect(result.observed).toBe(true);
    expect(getModel).toHaveBeenCalled();
    expect(targetedDeliveries).toEqual([
      expect.objectContaining({
        resourceId,
        threadId: threadIds[0],
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'persist' },
      }),
    ]);
  });

  it('runs curate after reflection with cursor recovery, CAS, and application restore', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-curate-libsql-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const streamCall = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: randomUUID(), modelId: 'aimock', timestamp: new Date() },
        { type: 'text-start', id: 'text' },
        {
          type: 'text-delta',
          id: 'text',
          delta:
            streamCall.mock.calls.length === 1
              ? '<observations>- Project Atlas launches soon.</observations>'
              : '- Project Atlas launches soon.',
        },
        { type: 'text-end', id: 'text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }));
    const model = new MockLanguageModelV2({ doStream: streamCall as never });
    let completionFactId = '';
    const curateGenerate = vi.fn(async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text' as const, text: `<curation-complete through="${completionFactId}" />` }],
    }));
    const curatorModel = new MockLanguageModelV2({ doGenerate: curateGenerate as never });
    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          subconscious: new Subconscious({
            observation: [],
            reflection: [{ name: 'curate', model: curatorModel }],
          }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
          reflection: { observationTokens: 1, bufferActivation: 0 },
        },
      },
    });
    await memory.createThread({ threadId, resourceId, title: 'Curator lifecycle' });
    const knowledge = (await storage.getStore('knowledge'))!;
    const scope = ['org:acme', `resource:${resourceId}`, `thread:${threadId}`];
    const entity = await knowledge.createEntity({ name: 'Project Atlas', kind: 'project', scope });
    const fact = await knowledge.appendFact({
      parentEntityId: entity.id,
      text: '[[Project Atlas]] launches soon.',
      scope,
      sourceThreadId: threadId,
      resolutionScope: scope,
      defaultScope: scope,
    });
    completionFactId = fact.id;
    await memory.saveMessages({ messages: [message(threadId, resourceId, 'Project Atlas launches soon.')] });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    const mainAgent = new Agent({ id: 'main', name: 'Main', instructions: 'Help.', model });
    const om = (await memory.omEngine)!;
    const result = await om.observe({
      threadId,
      resourceId,
      agent: mainAgent,
      requestContext,
      sendStateSignal: vi.fn(async () => ({ skipped: false }) as any),
    });
    if (curateGenerate.mock.calls.length === 0) {
      const memoryStore = (await storage.getStore('memory'))!;
      const record = (await memoryStore.getObservationalMemory(threadId, resourceId))!;
      await om.reflector.maybeReflect({
        record,
        observationTokens: 100_000,
        threadId,
        mainAgent,
        requestContext,
        sendStateSignal: vi.fn(async () => ({ skipped: false }) as any),
      });
    }

    expect(result.observed).toBe(true);
    expect(curateGenerate).toHaveBeenCalledOnce();
    expect(await knowledge.getCurationCursor({ sourceThreadId: threadId, agent: 'curate' })).toMatchObject({
      lastFactId: fact.id,
    });
    await expect(
      knowledge.updateEntity({ id: entity.id, version: entity.version + 1, name: 'Stale Atlas' }),
    ).rejects.toThrow('version');

    await knowledge.removeFact({ id: fact.id, deletedBy: 'subconscious:curate' });
    expect(await knowledge.getFact({ id: fact.id })).toBeNull();
    await memory.drainKnowledgeSemanticIndex(scope);
    const indexName = (await vector.listIndexes()).find(name => name.startsWith('knowledge_documents_dimension'))!;
    const queryVector = (await embedder.doEmbed({ values: ['Project Atlas launch'] })).embeddings[0]!;
    expect((await vector.query({ indexName, queryVector, topK: 20 })).some(match => match.id.endsWith(fact.id))).toBe(
      false,
    );

    await knowledge.restoreFact({ id: fact.id });
    await memory.drainKnowledgeSemanticIndex(scope);
    expect(await knowledge.getFact({ id: fact.id })).toMatchObject({ deletedAt: undefined, deletedBy: undefined });
    expect((await vector.query({ indexName, queryVector, topK: 20 })).some(match => match.id.endsWith(fact.id))).toBe(
      true,
    );
  });
});

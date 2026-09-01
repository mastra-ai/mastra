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

  it('curates durable scoped knowledge after observation and reconciles semantic vectors', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-libsql-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();

    let streamCall = 0;
    const doStream = vi.fn(async () => {
      streamCall += 1;
      const chunks =
        streamCall === 1
          ? [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'response-metadata' as const, id: 'observe', modelId: 'aimock', timestamp: new Date() },
              { type: 'text-start' as const, id: 'observe-text' },
              {
                type: 'text-delta' as const,
                id: 'observe-text',
                delta: '<observations>Maya Chen owns Project Atlas. The staging region is cobalt.</observations>',
              },
              { type: 'text-end' as const, id: 'observe-text' },
              {
                type: 'finish' as const,
                finishReason: 'stop' as const,
                usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
              },
            ]
          : streamCall === 2
            ? [
                { type: 'stream-start' as const, warnings: [] },
                { type: 'response-metadata' as const, id: 'curate', modelId: 'aimock', timestamp: new Date() },
                { type: 'tool-input-start' as const, id: 'create-atlas', toolName: 'knowledge_create' },
                {
                  type: 'tool-input-delta' as const,
                  id: 'create-atlas',
                  delta: JSON.stringify({
                    name: 'Project Atlas',
                    kind: 'project',
                    text: '[[Maya Chen]] owns [[Project Atlas]]. The staging region is cobalt.',
                    nodeScope: 'resource',
                    scope: 'resource',
                  }),
                },
                { type: 'tool-input-end' as const, id: 'create-atlas' },
                { type: 'tool-input-start' as const, id: 'create-alpha-secret', toolName: 'knowledge_create' },
                {
                  type: 'tool-input-delta' as const,
                  id: 'create-alpha-secret',
                  delta: JSON.stringify({
                    name: 'Alpha Secret',
                    kind: 'note',
                    text: 'Only the alpha thread may see this.',
                    nodeScope: 'thread',
                    scope: 'thread',
                  }),
                },
                { type: 'tool-input-end' as const, id: 'create-alpha-secret' },
                {
                  type: 'finish' as const,
                  finishReason: 'tool-calls' as const,
                  usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
                },
              ]
            : [
                { type: 'stream-start' as const, warnings: [] },
                { type: 'response-metadata' as const, id: 'curated', modelId: 'aimock', timestamp: new Date() },
                { type: 'text-start' as const, id: 'curated-text' },
                { type: 'text-delta' as const, id: 'curated-text', delta: 'Curated.' },
                { type: 'text-end' as const, id: 'curated-text' },
                {
                  type: 'finish' as const,
                  finishReason: 'stop' as const,
                  usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
                },
              ];
      return { stream: convertArrayToReadableStream(chunks as never) };
    });
    const model = new MockLanguageModelV2({ doStream: doStream as never });
    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          experimental_subconscious: new Subconscious({ observation: [{ name: 'curate', model }] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const threadId = randomUUID();
    const resourceId = randomUUID();
    await memory.createThread({ threadId, resourceId, title: 'Subconscious curation' });
    await memory.saveMessages({ messages: [message(threadId, resourceId)] });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    const result = await (await memory.omEngine)!.observe({
      threadId,
      resourceId,
      requestContext,
      sendStateSignal: vi.fn(async () => ({ skipped: false }) as any),
    });
    expect(result.observed).toBe(true);
    expect(doStream).toHaveBeenCalledTimes(3);

    const knowledge = (await storage.getStore('knowledge'))!;
    const scope = ['org:acme', `resource:${resourceId}`, `thread:${threadId}`];
    const atlas = await knowledge.resolveNode({ name: 'Project Atlas', scope });
    expect(atlas).toMatchObject({ kind: 'project', scope: scope.slice(0, 2) });
    expect((await knowledge.listKnowledgeAbout({ node: atlas!.id, scope })).records).toHaveLength(1);
    expect(await knowledge.listActivity({ scope, limit: 20 })).not.toEqual([]);

    expect(await memory.drainKnowledgeSemanticIndex(scope)).toBeGreaterThan(0);
    expect(await knowledge.listSemanticOutbox({ status: 'pending', scope })).toEqual([]);
    const indexName = (await vector.listIndexes()).find(name => name.startsWith('knowledge_documents_dimension'))!;
    const matches = await vector.query({ indexName, queryVector: [0.1, 0.2, 0.3, 0.4], topK: 20 });
    expect(matches.map(match => match.id)).toContain(`knowledge:node:${atlas!.id}`);

    const betaThreadId = randomUUID();
    await memory.createThread({ threadId: betaThreadId, resourceId, title: 'Sibling thread' });
    const tools = memory.listTools();
    const toolContext = { agent: { threadId: betaThreadId, resourceId }, requestContext } as any;
    const search = await tools.knowledge_search!.execute?.({ query: 'cobalt staging' }, toolContext);
    expect(search).toMatchObject({
      results: expect.arrayContaining([expect.objectContaining({ name: 'Project Atlas' })]),
    });
    expect((search as any).results.map((item: any) => item.name)).not.toContain('Alpha Secret');
    const read = await tools.knowledge_read!.execute?.({ name: 'Project Atlas' }, toolContext);
    expect(read).toMatchObject({ found: true, node: { name: 'Project Atlas' } });
    const hidden = await tools.knowledge_read!.execute?.({ name: 'Alpha Secret' }, toolContext);
    expect(hidden).toEqual({ found: false });
  });

  it('runs remind after observation and emits one scoped remembered signal', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-remind-libsql-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();

    let streamCall = 0;
    const reminder = 'Project Atlas launches January 15. Source KnowledgeRecord: record-atlas-launch.';
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
          experimental_subconscious: new Subconscious({ observation: ['remind'] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const scope = ['org:acme', `resource:${resourceId}`, `thread:${threadId}`];
    const knowledge = (await storage.getStore('knowledge'))!;
    const atlas = await knowledge.createNode({ name: 'Project Atlas', kind: 'project', scope: scope.slice(0, 2) });
    await knowledge.appendKnowledge({
      id: 'record-atlas-launch',
      node: atlas.id,
      text: '[[Project Atlas]] launches January 15.',
      scope: scope.slice(0, 2),
      sourceThreadId: 'source-thread',
      resolutionScope: scope,
      defaultScope: scope.slice(0, 2),
    });
    await memory.drainKnowledgeSemanticIndex(scope);
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
    expect(getModel).not.toHaveBeenCalled();
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
        content: [
          {
            type: 'text' as const,
            text: 'Project Atlas launches January 15. Source KnowledgeRecord: record-atlas-resource-launch.',
          },
        ],
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
          experimental_subconscious: new Subconscious({ observation: ['remind'] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const knowledge = (await storage.getStore('knowledge'))!;
    const node = await knowledge.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', `resource:${resourceId}`],
    });
    await knowledge.appendKnowledge({
      id: 'record-atlas-resource-launch',
      node: node.id,
      text: '[[Project Atlas]] launches January 15.',
      scope: ['org:acme', `resource:${resourceId}`],
      sourceThreadId: 'source-thread',
      resolutionScope: ['org:acme', `resource:${resourceId}`, `thread:${threadIds[0]}`],
      defaultScope: ['org:acme', `resource:${resourceId}`],
    });
    await memory.drainKnowledgeSemanticIndex(['org:acme', `resource:${resourceId}`]);
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
    expect(getModel).not.toHaveBeenCalled();
    expect(targetedDeliveries).toEqual([
      expect.objectContaining({
        resourceId,
        threadId: threadIds[0],
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'persist' },
      }),
    ]);
  });
});

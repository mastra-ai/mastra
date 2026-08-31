import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent, createSignal } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory, Subconscious } from '@mastra/memory';
import type { EmbeddingModel } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLearnerHandler } from '../../src/processors/observational-memory/subconscious/learn';
import type { ResolvedSubconsciousConfig } from '../../src/processors/observational-memory/subconscious/types';

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

async function createScopeIds(memory: Memory, store: any, resourceId: string, threadId: string): Promise<string[]> {
  const knowledge = memory.getKnowledgeInstance();
  if (knowledge) {
    const organization = await knowledge.materializeScope({
      address: 'org:acme',
      contextualScopeAddress: 'org:acme',
      parameters: { orgId: 'acme' },
    });
    const resourceAddress = `resource:${resourceId}`;
    const resource = await knowledge.materializeScope({
      address: resourceAddress,
      parentAddresses: ['org:acme'],
      contextualScopeAddress: 'org:acme',
      parameters: { orgId: 'acme', resourceId },
    });
    const threadAddress = `${resourceAddress}:thread:${threadId}`;
    const thread = await knowledge.materializeScope({
      address: threadAddress,
      parentAddresses: [resourceAddress],
      contextualScopeAddress: resourceAddress,
      parameters: { orgId: 'acme', resourceId, threadId },
    });
    const resourceCompanionAddress = `${resourceAddress}:uncurated`;
    const resourceCompanion = await knowledge.materializeScope({
      address: resourceCompanionAddress,
      name: 'uncurated',
      parentAddresses: [resourceAddress],
      contextualScopeAddress: resourceAddress,
      parameters: { orgId: 'acme', resourceId, threadId },
    });
    const threadCompanionAddress = `${threadAddress}:uncurated`;
    const threadCompanion = await knowledge.materializeScope({
      address: threadCompanionAddress,
      name: 'uncurated',
      parentAddresses: [threadAddress],
      contextualScopeAddress: threadAddress,
      parameters: { orgId: 'acme', resourceId, threadId },
    });
    return [
      organization.scopes['org:acme']!,
      resource.scopes[resourceAddress]!,
      thread.scopes[threadAddress]!,
      resourceCompanion.scopes[resourceCompanionAddress]!,
      threadCompanion.scopes[threadCompanionAddress]!,
    ];
  }
  const organization = await store.createNode({ name: 'Acme', isScope: true, scopeIds: [] });
  const resource = await store.createNode({
    name: `Resource ${resourceId}`,
    isScope: true,
    scopeIds: [organization.id],
  });
  const thread = await store.createNode({ name: `Thread ${threadId}`, isScope: true, scopeIds: [resource.id] });
  return [organization.id, resource.id, thread.id];
}

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
              nodes:
                doGenerate.mock.calls.length === 1
                  ? [
                      {
                        name: 'Project Atlas',
                        kind: 'project',
                        records: [
                          {
                            text: '[[Maya Chen]] owns [[Project Atlas]].',
                            reason: 'The ownership relationship determines who can answer project questions.',
                          },
                          {
                            text: 'The staging region is cobalt.',
                            reason: 'The deployment region is required for later staging operations.',
                          },
                        ],
                      },
                      {
                        name: 'Alpha Secret',
                        kind: 'note',
                        scope: 'thread',
                        records: [
                          {
                            text: 'Only the alpha thread may see this.',
                            scope: 'thread',
                            reason: 'The secret must remain scoped to the thread where it was disclosed.',
                          },
                        ],
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
      knowledge: new Knowledge({ id: 'default', storage }),
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          experimental_subconscious: new Subconscious({ observation: ['capture'], reflection: [] }),
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
    const scopeIds = await createScopeIds(memory, knowledge, resourceId, threadId);
    const atlas = await knowledge.resolveNode({ name: 'Project Atlas', scopeIds });
    expect(atlas).toMatchObject({ kind: 'project' });
    expect(await knowledge.getNodeScopeIds(atlas!.id)).toEqual([scopeIds[4]]);
    expect((await knowledge.listRecords({ node: atlas!.id, scopeIds })).records).toHaveLength(2);

    const betaThreadId = randomUUID();
    await memory.createThread({ threadId: betaThreadId, resourceId, title: 'Sibling thread' });
    const betaScopeIds = await createScopeIds(memory, knowledge, resourceId, betaThreadId);
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
    expect(betaEmissions[0]).toContain('Recent updates:');
    expect(betaEmissions[0]).toContain('create: record');
    expect(betaEmissions[0]).not.toContain('Alpha Secret');
    expect(sendBetaStateSignal).toHaveBeenCalledTimes(2);
    expect(sendBetaStateSignal.mock.calls[0]?.[0]).toMatchObject({
      cacheKey: sendBetaStateSignal.mock.calls[1]?.[0].cacheKey,
    });
    expect(await knowledge.listActivity({ scopeIds: betaScopeIds, limit: 20 })).not.toEqual([]);
    expect(doStream).toHaveBeenCalledTimes(3);
    expect(doGenerate).toHaveBeenCalledTimes(3);

    expect(await memory.drainKnowledgeSemanticIndex(scopeIds)).toBeGreaterThan(0);
    expect(await knowledge.listSemanticOutbox({ status: 'pending', scopeIds })).toEqual([]);
    const indexName = (await vector.listIndexes()).find(name => name.startsWith('knowledge_documents_dimension'))!;
    const matches = await vector.query({ indexName, queryVector: [0.1, 0.2, 0.3, 0.4], topK: 20 });
    expect(matches.map(match => match.id)).toContain(`knowledge:node:${atlas!.id}`);

    const alphaSecret = await knowledge.resolveNode({ name: 'Alpha Secret', scopeIds });
    await knowledge.createRecord({
      node: alphaSecret!,
      text: 'The shared cobalt checklist is ready.',
      scopeIds: [scopeIds[3]!],
      source: threadId,
      resolutionScopeIds: scopeIds,
      metadata: { sourceThreadId: threadId },
    });
    await memory.drainKnowledgeSemanticIndex(scopeIds);

    const tools = memory.listTools();
    const toolContext = { agent: { threadId: betaThreadId, resourceId }, requestContext } as any;
    const search = await tools.knowledge_search!.execute?.({ query: 'cobalt' }, toolContext);
    expect((search as any).results.map((result: any) => result.name)).not.toContain('Alpha Secret');
    expect((search as any).results).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'record', name: '(private node)' })]),
    );
    const read = await tools.knowledge_read!.execute?.({ name: 'Project Atlas' }, toolContext);
    expect(read).toEqual({ found: false });
    const hidden = await tools.knowledge_read!.execute?.({ name: 'Alpha Secret' }, toolContext);
    expect(hidden).toEqual({ found: false });
    const browse = await tools.knowledge_browse!.execute?.({}, toolContext);
    expect((browse as any).nodes.map((node: any) => node.name)).not.toContain('Alpha Secret');
  });

  it('runs remind after observation and emits one scoped remembered signal', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-remind-libsql-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();

    let streamCall = 0;
    const reminderRecordId = '10000000-0000-4000-8000-000000000010';
    const reminder = `Project Atlas launches January 15. Source KnowledgeRecord: ${reminderRecordId}.`;
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
      knowledge: new Knowledge({ id: 'default', storage }),
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          experimental_subconscious: new Subconscious({ observation: ['remind'], reflection: [] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const knowledge = (await storage.getStore('knowledge'))!;
    const scopeIds = await createScopeIds(memory, knowledge, resourceId, threadId);
    const atlas = await knowledge.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[1]!] });
    await knowledge.createRecord({
      id: reminderRecordId,
      node: atlas,
      text: '[[Project Atlas]] launches January 15.',
      scopeIds: [scopeIds[1]!],
      source: 'source-thread',
      resolutionScopeIds: scopeIds,
      metadata: { sourceThreadId: 'source-thread' },
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
    const reminderRecordId = '10000000-0000-4000-8000-000000000011';
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
            text: `Project Atlas launches January 15. Source KnowledgeRecord: ${reminderRecordId}.`,
          },
        ],
      }),
    });
    const memory = new Memory({
      storage,
      knowledge: new Knowledge({ id: 'default', storage }),
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          scope: 'resource',
          experimental_subconscious: new Subconscious({ observation: ['remind'], reflection: [] }),
          observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
        },
      },
    });
    const knowledge = (await storage.getStore('knowledge'))!;
    const scopeIds = await createScopeIds(memory, knowledge, resourceId, threadIds[0]!);
    const node = await knowledge.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scopeIds: [scopeIds[1]!],
    });
    await knowledge.createRecord({
      id: reminderRecordId,
      node,
      text: '[[Project Atlas]] launches January 15.',
      scopeIds: [scopeIds[1]!],
      source: 'source-thread',
      resolutionScopeIds: scopeIds,
      metadata: { sourceThreadId: 'source-thread' },
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
    let completionItemId = '';
    const curateGenerate = vi.fn(async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text' as const, text: `<curation-complete through="${completionItemId}" />` }],
    }));
    const curatorModel = new MockLanguageModelV2({ doGenerate: curateGenerate as never });
    const memory = new Memory({
      storage,
      knowledge: new Knowledge({ id: 'default', storage }),
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model,
          experimental_subconscious: new Subconscious({
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
    const scopeIds = await createScopeIds(memory, knowledge, resourceId, threadId);
    const node = await knowledge.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[2]!] });
    const record = await knowledge.createRecord({
      node,
      text: '[[Project Atlas]] launches soon.',
      scopeIds: [scopeIds[2]!],
      source: threadId,
      resolutionScopeIds: scopeIds,
      metadata: { sourceThreadId: threadId },
    });
    completionItemId = record.id;
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
    expect(await knowledge.getCurationCursorInternal({ sourceThreadId: threadId, agent: 'curate' })).toMatchObject({
      lastKnowledgeId: record.id,
    });
    await expect(knowledge.updateNode({ id: node.id, version: node.version + 1, name: 'Stale Atlas' })).rejects.toThrow(
      'version',
    );

    const deleted = await knowledge.deleteRecord({
      id: record.id,
      version: record.version,
      deletedBy: 'subconscious:curate',
    });
    expect(await knowledge.getRecordInternal({ id: record.id })).toBeNull();
    await memory.drainKnowledgeSemanticIndex(scopeIds);
    const indexName = (await vector.listIndexes()).find(name => name.startsWith('knowledge_documents_dimension'))!;
    const queryVector = (await embedder.doEmbed({ values: ['Project Atlas launch'] })).embeddings[0]!;
    expect((await vector.query({ indexName, queryVector, topK: 20 })).some(match => match.id.endsWith(record.id))).toBe(
      false,
    );

    await knowledge.restoreRecord({ id: record.id, version: deleted.version });
    await memory.drainKnowledgeSemanticIndex(scopeIds);
    expect(await knowledge.getRecordInternal({ id: record.id })).toMatchObject({
      deletedAt: undefined,
      deletedBy: undefined,
    });
    expect((await vector.query({ indexName, queryVector, topK: 20 })).some(match => match.id.endsWith(record.id))).toBe(
      true,
    );
  });

  it('learns and updates one skill with idempotent LibSQL evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-learn-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'knowledge.db')}` });
    await storage.init();
    const memory = new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }) });
    const knowledge = (await storage.getStore('knowledge'))!;
    const threadId = randomUUID();
    const resourceId = randomUUID();
    const scopeIds = await createScopeIds(memory, knowledge, resourceId, threadId);
    const project = await knowledge.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[2]!] });
    const appendSource = (text: string) =>
      knowledge.createRecord({
        node: project,
        text,
        scopeIds: [scopeIds[2]!],
        source: threadId,
        resolutionScopeIds: scopeIds,
        metadata: { sourceThreadId: threadId },
      });
    const first = await appendSource('Deploy Atlas by validating then publishing.');
    const second = await appendSource('Another deploy validated, published, then checked health.');
    let pendingIds = [first.id, second.id];
    let modelStep = 0;
    const learnGenerate = async () => {
      modelStep++;
      if (modelStep % 2 === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          warnings: [],
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `learn-${modelStep}`,
              toolName: 'knowledge_record_skill',
              input: JSON.stringify({
                name: 'deploy-atlas-safely',
                procedure: 'Validate, publish, then verify the health check.',
                sourceRecordIds: pendingIds,
              }),
            },
          ],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        warnings: [],
        content: [{ type: 'text' as const, text: `<learning-complete through="${pendingIds.at(-1)}" />` }],
      };
    };
    const learnerModel = new MockLanguageModelV2({ doGenerate: learnGenerate as never });
    const config: ResolvedSubconsciousConfig = {
      observation: [],
      reflection: [{ name: 'learn', maxSteps: 5, builtIn: true }],
      learnedGuidance: true,
      tools: true,
      activity: { recentUpdates: 10 },
    };
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const handler = createLearnerHandler(
      memory as any,
      config,
      new Memory({ storage, options: { observationalMemory: false } }) as any,
    );
    const run = () =>
      handler({
        parentThreadId: threadId,
        resourceId,
        observations: 'Full raw observations preserve the repeated deploy sequence.',
        requestContext,
        mainAgent: { getModel: vi.fn(async () => learnerModel) } as any,
      });

    await run();
    const third = await appendSource('A third deploy repeated validation and publish.');
    const fourth = await appendSource('Recovery again finished with a health check.');
    pendingIds = [third.id, fourth.id];
    await run();

    const skills = await knowledge.listNodes({ scopeIds, kind: 'skill' });
    expect(skills).toHaveLength(1);
    const evidence = await knowledge.listRecords({ node: skills[0]!.id, scopeIds });
    expect(evidence.records).toHaveLength(4);
    expect(new Set(evidence.records.map(record => record.id)).size).toBe(4);
    expect(await knowledge.getCurationCursorInternal({ sourceThreadId: threadId, agent: 'learn' })).toMatchObject({
      lastKnowledgeId: fourth.id,
    });
  });
});

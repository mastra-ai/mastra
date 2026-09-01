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

import { RemindContinuationProcessor } from '../../src/processors/observational-memory/subconscious/remind-continuation';
import {
  ensureOwnedRemindThread,
  getRemindProtocol,
  getRemindThreadId,
  REMIND_PROTOCOL_METADATA_KEY,
} from '../../src/processors/observational-memory/subconscious/remind-protocol';
import type {
  RemindContinuationEvent,
  RemindProtocolEvent,
  RemindQuestionEvent,
} from '../../src/processors/observational-memory/subconscious/remind-protocol';
import {
  createAskMemoryTool,
  createReplyToMemoryQuestionTool,
} from '../../src/processors/observational-memory/subconscious/remind-questions';

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

function protocolMessage(event: RemindProtocolEvent, text: string): MastraDBMessage {
  return {
    id: event.eventId,
    threadId: getRemindThreadId(event.parentThreadId),
    resourceId: event.resourceId,
    role: 'user',
    createdAt: new Date(event.createdAt),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: { [REMIND_PROTOCOL_METADATA_KEY]: event },
    },
  };
}

function questionEvent(parentThreadId: string, resourceId: string, replyId: string): RemindQuestionEvent {
  const eventId = `${replyId}:question`;
  return {
    kind: 'question',
    eventId,
    deliveryId: `${eventId}:delivery`,
    parentAgentId: 'main-agent',
    parentThreadId,
    resourceId,
    createdAt: Date.now(),
    replyId,
    replyRequired: true,
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

    const observerStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'observe', modelId: 'aimock', timestamp: new Date() },
        { type: 'text-start', id: 'observe-text' },
        {
          type: 'text-delta',
          id: 'observe-text',
          delta: '<observations>\n- 🔴 Maya Chen owns Project Atlas. The staging region is cobalt.\n</observations>',
        },
        { type: 'text-end', id: 'observe-text' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }));
    const observerModel = new MockLanguageModelV2({ doStream: observerStream });
    let curatorCall = 0;
    const curatorGenerate = vi.fn(async () => {
      curatorCall += 1;
      if (curatorCall === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'create-atlas',
              toolName: 'knowledge_create',
              input: JSON.stringify({
                name: 'Project Atlas',
                kind: 'project',
                text: '[[Maya Chen]] owns [[Project Atlas]]. The staging region is cobalt.',
                nodeScope: 'resource',
                scope: 'resource',
              }),
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'create-alpha-secret',
              toolName: 'knowledge_create',
              input: JSON.stringify({
                name: 'Alpha Secret',
                kind: 'note',
                text: 'Only the alpha thread may see this.',
                nodeScope: 'thread',
                scope: 'thread',
              }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        content: [{ type: 'text' as const, text: 'Curated.' }],
        warnings: [],
      };
    });
    const curatorModel = new MockLanguageModelV2({ doGenerate: curatorGenerate });
    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        observationalMemory: {
          enabled: true,
          model: observerModel,
          experimental_subconscious: new Subconscious({ observation: [{ name: 'curate', model: curatorModel }] }),
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

    const om = (await memory.omEngine)!;
    const committed = vi.fn(om.getOnObservationCommitted()!);
    om.setOnObservationCommitted(committed);
    const result = await om.observe({
      threadId,
      resourceId,
      requestContext,
      sendStateSignal: vi.fn(async () => ({ skipped: false }) as any),
    });
    expect(result.observed).toBe(true);
    expect(observerStream).toHaveBeenCalledOnce();
    const omRecord = await (await storage.getStore('memory'))!.getObservationalMemory(threadId, resourceId);
    expect(omRecord?.activeObservations).toContain('Maya Chen owns Project Atlas');
    expect(committed).toHaveBeenCalledOnce();
    expect(curatorGenerate).toHaveBeenCalledTimes(2);

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

  it('persists passive reminder continuity and suppresses a duplicate across Memory reconstruction', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-remind-libsql-'));
    directories.push(directory);
    const databaseUrl = `file:${join(directory, 'knowledge.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url: databaseUrl });
    const vector = new LibSQLVector({ id: randomUUID(), url: databaseUrl });
    await storage.init();

    let streamCall = 0;
    let sentReminder = false;
    const reminder = 'Project Atlas launches January 15. Source KnowledgeRecord: record-atlas-launch.';
    const model = new MockLanguageModelV2({
      doStream: async options => {
        streamCall += 1;
        const prompt = JSON.stringify(options.prompt);
        const eventId = prompt.match(/Passive reminder check (subconscious:remind:[^"\\\\]+:event)/)?.[1];
        if (eventId && !sentReminder) {
          sentReminder = true;
          const input = JSON.stringify({ eventId, reminder, sourceIds: ['record-atlas-launch'] });
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `remind-${streamCall}`, modelId: 'aimock', timestamp: new Date() },
              { type: 'tool-input-start', id: 'send-reminder', toolName: 'send_reminder' },
              { type: 'tool-input-delta', id: 'send-reminder', delta: input },
              { type: 'tool-call', toolCallId: 'send-reminder', toolName: 'send_reminder', input },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `remind-${streamCall}`, modelId: 'aimock', timestamp: new Date() },
            { type: 'text-start', id: `text-${streamCall}` },
            {
              type: 'text-delta',
              id: `text-${streamCall}`,
              delta: '<observations>\n- The user is scheduling Project Atlas.\n</observations>',
            },
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
    const parentSendSignal = vi.spyOn(mainAgent, 'sendSignal').mockImplementation((signal => ({
      signal,
      accepted: Promise.resolve({ action: 'deliver', runId: 'parent-run' }),
    })) as any);
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
    expect(streamCall).toBe(3);
    expect(parentSendSignal).toHaveBeenCalledOnce();
    expect(parentSendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reactive', tagName: 'remembered', contents: expect.stringContaining(reminder) }),
      expect.objectContaining({ threadId, resourceId }),
    );

    const reconstructed = new Memory({
      storage,
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
    await reconstructed.saveMessages({ messages: [message(threadId, resourceId, 'Check the launch schedule again.')] });
    const second = await (await reconstructed.omEngine)!.observe({
      threadId,
      resourceId,
      agent: mainAgent,
      requestContext,
      sendSignal,
    });

    expect(second.observed).toBe(true);
    expect(parentSendSignal).toHaveBeenCalledOnce();
    const reminderHistory = await (await storage.getStore('memory'))!.listMessages({
      threadId: getRemindThreadId(threadId),
      resourceId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(
      reminderHistory.messages.map(getRemindProtocol).filter(event => event?.kind === 'passive-check'),
    ).toHaveLength(2);
    expect(reminderHistory.messages.some(message => message.role === 'assistant')).toBe(true);
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
    let sentReminder = false;
    const model = new MockLanguageModelV2({
      doStream: async options => {
        const prompt = JSON.stringify(options.prompt);
        const eventId = prompt.match(/Passive reminder check (subconscious:remind:[^"\\\\]+:event)/)?.[1];
        if (eventId && !sentReminder) {
          sentReminder = true;
          const input = JSON.stringify({
            eventId,
            reminder: 'Project Atlas launches January 15. Source KnowledgeRecord: record-atlas-resource-launch.',
            sourceIds: ['record-atlas-resource-launch'],
          });
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'resource-remind', modelId: 'aimock', timestamp: new Date() },
              { type: 'tool-input-start', id: 'resource-send', toolName: 'send_reminder' },
              { type: 'tool-input-delta', id: 'resource-send', delta: input },
              { type: 'tool-call', toolCallId: 'resource-send', toolName: 'send_reminder', input },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        return {
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
        };
      },
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
        ifActive: { behavior: 'persist' },
        ifIdle: { behavior: 'persist' },
      }),
      expect.objectContaining({
        resourceId,
        threadId: threadIds[0],
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'discard' },
      }),
    ]);
  });

  it('persists an accepted memory question and correlated terminal reply across Memory reconstruction', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-question-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'memory.db')}` });
    await storage.init();
    const parentThreadId = randomUUID();
    const resourceId = randomUUID();
    const memory = new Memory({ storage });
    await memory.createThread({ threadId: parentThreadId, resourceId, title: 'Question parent' });
    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
        content: [{ type: 'text' as const, text: 'idle' }],
      }),
    });
    const parentAgent = new Agent({ id: 'main-agent', name: 'Main Agent', instructions: 'Help.', model });
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'sidekick-run' }),
    })) as any);
    const ask = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true, maxSteps: 5 },
      getParentAgent: () => parentAgent,
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    const accepted = (await ask.execute?.({ question: 'What is the Atlas launch date?' }, {
      agent: { agentId: 'main-agent', threadId: parentThreadId, resourceId, messages: [] },
      requestContext,
    } as any)) as { accepted: boolean; replyId: string; status: string };
    sendMessage.mockRestore();

    expect(accepted).toMatchObject({ accepted: true, status: 'pending', replyId: expect.any(String) });
    const reconstructed = new Memory({ storage });
    const reminderThreadId = getRemindThreadId(parentThreadId);
    const stored = await (await storage.getStore('memory'))!.listMessages({
      threadId: reminderThreadId,
      resourceId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    const question = stored.messages.find(message => getRemindProtocol(message)?.kind === 'question')!;
    expect(getRemindProtocol(question)).toMatchObject({ replyId: accepted.replyId, parentThreadId, resourceId });

    const deliveredSignals: unknown[] = [];
    vi.spyOn(parentAgent, 'sendSignal').mockImplementation((signal => {
      deliveredSignals.push(signal);
      return { signal, accepted: Promise.resolve({ action: 'deliver', runId: 'parent-run' }) };
    }) as any);
    const reply = createReplyToMemoryQuestionTool({
      memory: reconstructed,
      parentAgent,
      parentAgentId: 'main-agent',
      parentThreadId,
      reminderThreadId,
      resourceId,
    });
    const result = await reply.execute?.({ replyId: accepted.replyId, answer: 'January 15.', moreComing: false }, {
      agent: { messages: [question] },
    } as any);

    expect(result).toMatchObject({ delivered: true, replyId: accepted.replyId, moreComing: false });
    expect(deliveredSignals).toEqual([
      expect.objectContaining({ id: `${accepted.replyId}:terminal:signal`, contents: 'January 15.' }),
    ]);
    const finalStored = await (await storage.getStore('memory'))!.listMessages({
      threadId: reminderThreadId,
      resourceId,
      perPage: false,
    });
    expect(finalStored.messages.map(getRemindProtocol).filter(Boolean)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'terminal-pending-delivery', replyId: accepted.replyId }),
        expect.objectContaining({ kind: 'terminal-delivered', replyId: accepted.replyId }),
      ]),
    );
  });

  it('reconstructs two continuation attempts and emits one terminal failure through LibSQL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-continuation-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'memory.db')}` });
    await storage.init();
    const memory = new Memory({ storage });
    const parentThreadId = randomUUID();
    const resourceId = randomUUID();
    const reminderThreadId = getRemindThreadId(parentThreadId);
    await memory.createThread({ threadId: parentThreadId, resourceId });
    await ensureOwnedRemindThread({ memory, parentThreadId, resourceId });
    const replyId = `subconscious:remind:${randomUUID()}:reply`;
    const question = questionEvent(parentThreadId, resourceId, replyId);
    const continuation = (attempt: number): RemindContinuationEvent => {
      const eventId = `${replyId}:continuation:${attempt}`;
      return {
        kind: 'continuation',
        eventId,
        deliveryId: `${eventId}:delivery`,
        parentAgentId: 'main-agent',
        parentThreadId,
        resourceId,
        createdAt: question.createdAt + attempt,
        outstandingReplyIds: [replyId],
        attempts: { [replyId]: attempt },
      };
    };
    await memory.saveMessages({
      messages: [
        protocolMessage(question, 'Memory question\n\nWhat is the launch date?'),
        protocolMessage(continuation(1), `Continue unresolved memory question ${replyId}.`),
        protocolMessage(continuation(2), `Continue unresolved memory question ${replyId}.`),
      ],
    });

    const reconstructed = new Memory({ storage });
    const parentSignals: unknown[] = [];
    const parentAgent = {
      sendSignal: vi.fn((signal: unknown) => {
        parentSignals.push(signal);
        return { signal, accepted: Promise.resolve({ action: 'deliver', runId: 'parent-run' }) };
      }),
    } as any;
    const processor = new RemindContinuationProcessor({
      memory: reconstructed,
      threadId: reminderThreadId,
      resourceId,
      parentThreadId,
      parentAgent,
      parentAgentId: 'main-agent',
      maxSteps: 5,
      getReminderAgent: () => {
        throw new Error('No continuation wake should occur after attempt two.');
      },
    });

    await processor.processOutputResult({
      state: {},
      messages: [],
      requestContext: new RequestContext(),
      result: { text: '', finishReason: 'stop', steps: [] },
    } as any);

    expect(parentSignals).toEqual([
      expect.objectContaining({
        id: `${replyId}:terminal:signal`,
        contents: 'Unable to answer this memory question after two continuation attempts.',
      }),
    ]);
    const finalStored = await (await storage.getStore('memory'))!.listMessages({
      threadId: reminderThreadId,
      resourceId,
      perPage: false,
    });
    expect(finalStored.messages.map(getRemindProtocol).filter(Boolean)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'terminal-pending-delivery', replyId, outcome: 'unable-to-answer' }),
        expect.objectContaining({ kind: 'terminal-delivered', replyId, outcome: 'unable-to-answer' }),
      ]),
    );
  });

  it('isolates owned reminder threads by resource and cascades deletion conservatively', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-delete-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'memory.db')}` });
    await storage.init();
    const memory = new Memory({ storage });
    const ownedParentId = randomUUID();
    const unmarkedParentId = randomUUID();
    const foreignParentId = randomUUID();
    const ownedResourceId = randomUUID();
    const foreignResourceId = randomUUID();
    for (const [threadId, resourceId] of [
      [ownedParentId, ownedResourceId],
      [unmarkedParentId, ownedResourceId],
      [foreignParentId, ownedResourceId],
    ]) {
      await memory.createThread({ threadId, resourceId });
    }
    const owned = await ensureOwnedRemindThread({ memory, parentThreadId: ownedParentId, resourceId: ownedResourceId });
    await memory.saveMessages({ messages: [message(owned.id, ownedResourceId, 'Owned reminder history')] });
    await memory.createThread({ threadId: getRemindThreadId(unmarkedParentId), resourceId: ownedResourceId });
    await memory.createThread({ threadId: getRemindThreadId(foreignParentId), resourceId: foreignResourceId });

    await memory.deleteThread(ownedParentId);
    await memory.deleteThread(unmarkedParentId);
    await memory.deleteThread(foreignParentId);
    await memory.settled();

    expect(await memory.getThreadById({ threadId: owned.id })).toBeNull();
    expect(await memory.getThreadById({ threadId: getRemindThreadId(unmarkedParentId) })).not.toBeNull();
    expect(await memory.getThreadById({ threadId: getRemindThreadId(foreignParentId) })).not.toBeNull();
    await expect(
      ensureOwnedRemindThread({ memory, parentThreadId: foreignParentId, resourceId: ownedResourceId }),
    ).rejects.toThrow('ownership metadata does not match');
  });

  it('deduplicates terminal delivery after delivered-marker persistence fails and state is reconstructed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'subconscious-signal-dedupe-libsql-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'memory.db')}` });
    await storage.init();
    const memory = new Memory({ storage });
    const parentThreadId = randomUUID();
    const resourceId = randomUUID();
    const replyId = `subconscious:remind:${randomUUID()}:reply`;
    const question = questionEvent(parentThreadId, resourceId, replyId);
    await memory.createThread({ threadId: parentThreadId, resourceId });
    const reminderThread = await ensureOwnedRemindThread({ memory, parentThreadId, resourceId });
    const questionMessage = protocolMessage(question, `Memory question ${replyId}\n\nWhen is the launch?`);
    await memory.saveMessages({ messages: [questionMessage] });
    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
        content: [{ type: 'text' as const, text: 'unused' }],
      }),
    });
    const parentAgent = new Agent({ id: 'main-agent', name: 'Main Agent', instructions: 'Help.', model, memory });
    const sendSignal = vi.spyOn(parentAgent, 'sendSignal');
    const originalSave = memory.saveMessages.bind(memory);
    let failDeliveredMarker = true;
    vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
      if (failDeliveredMarker && getRemindProtocol(args.messages[0]!)?.kind === 'terminal-delivered') {
        failDeliveredMarker = false;
        throw new Error('marker unavailable');
      }
      return await originalSave(args);
    });
    const firstReply = createReplyToMemoryQuestionTool({
      memory,
      parentAgent,
      parentAgentId: 'main-agent',
      parentThreadId,
      reminderThreadId: reminderThread.id,
      resourceId,
    });
    const first = await firstReply.execute?.({ replyId, answer: 'January 15.', moreComing: false }, {
      agent: { messages: [questionMessage] },
    } as any);
    expect(first).toMatchObject({ delivered: false, reason: 'delivery-marker-unknown' });
    const callsAfterFirstDelivery = sendSignal.mock.calls.length;

    const reconstructed = new Memory({ storage });
    const secondReply = createReplyToMemoryQuestionTool({
      memory: reconstructed,
      parentAgent,
      parentAgentId: 'main-agent',
      parentThreadId,
      reminderThreadId: reminderThread.id,
      resourceId,
    });
    const second = await secondReply.execute?.({ replyId, answer: 'January 15.', moreComing: false }, {
      agent: { messages: [questionMessage] },
    } as any);
    expect(second).toMatchObject({ delivered: true, replyId });
    expect(sendSignal).toHaveBeenCalledTimes(callsAfterFirstDelivery);

    const signalId = `${replyId}:terminal:signal`;
    const persisted = await (await storage.getStore('memory'))!.listMessagesById({
      messageIds: [signalId, `${replyId}:terminal:delivered`],
    });
    expect(persisted.messages.filter(message => message.id === signalId)).toHaveLength(1);
    expect(persisted.messages.find(message => message.id === signalId)).toMatchObject({
      id: signalId,
      threadId: parentThreadId,
      resourceId,
      role: 'signal',
    });
    expect(
      getRemindProtocol(persisted.messages.find(message => message.id === `${replyId}:terminal:delivered`)!),
    ).toMatchObject({
      kind: 'terminal-delivered',
      replyId,
    });
  });

});

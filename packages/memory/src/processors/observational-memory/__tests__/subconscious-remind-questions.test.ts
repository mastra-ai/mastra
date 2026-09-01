import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { Subconscious } from '../subconscious';
import {
  ensureOwnedRemindThread,
  getRemindProtocol,
  getRemindThreadId,
  REMIND_DELIVERY_METADATA_KEY,
  REMIND_PROTOCOL_METADATA_KEY,
  RemindEventReferenceProcessor,
} from '../subconscious/remind-protocol';
import type { RemindProtocolEvent, RemindQuestionEvent } from '../subconscious/remind-protocol';
import { createAskMemoryTool, createReplyToMemoryQuestionTool } from '../subconscious/remind-questions';

const parentThreadId = 'parent-thread';
const resourceId = 'resource-1';
const parentAgentId = 'parent-agent';

function createParentAgent(sendSignal = vi.fn()) {
  return {
    id: parentAgentId,
    getModel: vi.fn(async () => 'openai/gpt-5-mini'),
    getMastraInstance: vi.fn(),
    getPubSub: vi.fn(),
    sendSignal: vi.fn((signal: unknown, options: unknown) => {
      sendSignal(signal, options);
      return {
        signal,
        accepted: Promise.resolve({ action: 'deliver', runId: 'parent-run' }),
      };
    }),
  } as any;
}

function toolContext(messages: unknown[] = []) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'org-1');
  return {
    agent: { agentId: parentAgentId, threadId: parentThreadId, resourceId, messages },
    requestContext,
  } as any;
}

function questionEvent(replyId = 'subconscious:remind:test:reply'): RemindQuestionEvent {
  return {
    kind: 'question',
    eventId: `${replyId}:question`,
    deliveryId: `${replyId}:question:delivery`,
    parentAgentId,
    parentThreadId,
    resourceId,
    createdAt: Date.now(),
    replyId,
    replyRequired: true,
  };
}

function protocolMessage(
  event: RemindProtocolEvent,
  text: string,
  overrides: Partial<MastraDBMessage> = {},
): MastraDBMessage {
  return {
    id: event.eventId,
    role: 'user',
    threadId: getRemindThreadId(parentThreadId),
    resourceId,
    createdAt: new Date(event.createdAt),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: { [REMIND_PROTOCOL_METADATA_KEY]: event },
    },
    ...overrides,
  };
}

async function seedQuestion(memory: Memory, replyId = 'subconscious:remind:test:reply') {
  const thread = await ensureOwnedRemindThread({ memory, parentThreadId, resourceId });
  const event = questionEvent(replyId);
  const message = protocolMessage(event, `Memory question ${replyId}\n\nWhat did I decide?`);
  await memory.saveMessages({ messages: [message] });
  return { thread, event, message };
}

function createReplyTool(memory: Memory, parentAgent = createParentAgent()) {
  return createReplyToMemoryQuestionTool({
    memory,
    parentAgent,
    parentAgentId,
    parentThreadId,
    reminderThreadId: getRemindThreadId(parentThreadId),
    resourceId,
  });
}

async function storedProtocols(memory: Memory) {
  const store = await memory.storage.getStore('memory');
  const stored = await store!.listMessages({
    threadId: getRemindThreadId(parentThreadId),
    resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  return stored.messages.flatMap(message => {
    const protocol = getRemindProtocol(message);
    return protocol ? [protocol] : [];
  });
}

describe('Subconscious reminder questions', () => {
  it('exposes ask_memory with enabled Subconscious knowledge tools', () => {
    const memory = new Memory({ storage: new InMemoryStore() });

    expect(
      memory.listTools({
        observationalMemory: {
          model: 'openai/gpt-5-mini',
          experimental_subconscious: new Subconscious(),
        },
      }),
    ).toHaveProperty('ask_memory');
    expect(
      memory.listTools({
        observationalMemory: {
          model: 'openai/gpt-5-mini',
          experimental_subconscious: new Subconscious({ tools: false }),
        },
      }),
    ).not.toHaveProperty('ask_memory');
  });

  it('persists a canonical question before accepting native delivery', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const parentAgent = createParentAgent();
    const order: string[] = [];
    const store = await memory.storage.getStore('memory');
    const originalSave = store!.saveMessages.bind(store);
    const save = vi.spyOn(store!, 'saveMessages').mockImplementation(async args => {
      const protocol = getRemindProtocol(args.messages[0]!);
      if (protocol?.kind === 'question') order.push('question-saved');
      return await originalSave(args);
    });
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => {
      order.push('delivery-accepted');
      return { accepted: Promise.resolve({ action: 'deliver', runId: 'sidekick-run' }) };
    }) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true, maxSteps: 5 },
      getParentAgent: () => parentAgent,
    });

    const result = (await tool.execute?.({ question: 'What did I decide?' }, toolContext())) as any;

    expect(result).toMatchObject({
      accepted: true,
      status: 'pending',
      replyId: expect.stringMatching(/^subconscious:remind:/),
    });
    expect(order).toEqual(['question-saved', 'delivery-accepted']);
    const protocols = await storedProtocols(memory);
    expect(protocols).toEqual([
      expect.objectContaining({
        kind: 'question',
        eventId: `${result.replyId}:question`,
        deliveryId: `${result.replyId}:question:delivery`,
        replyId: result.replyId,
        parentThreadId,
        resourceId,
        replyRequired: true,
        createdAt: expect.any(Number),
      }),
    ]);
    sendMessage.mockRestore();
    save.mockRestore();
  });

  it.each(['wake', 'deliver'] as const)('accepts native %s routing without waiting for an answer', async action => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const consumeStream = vi.fn(async () => undefined);
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => ({
      accepted: Promise.resolve(
        action === 'wake' ? { action, runId: 'run-1', output: { consumeStream } } : { action, runId: 'run-1' },
      ),
    })) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true },
      getParentAgent: () => createParentAgent(),
    });

    const result = (await tool.execute?.({ question: 'Question?' }, toolContext())) as any;

    expect(result.status).toBe('pending');
    await vi.waitFor(() => expect(consumeStream).toHaveBeenCalledTimes(action === 'wake' ? 1 : 0));
    sendMessage.mockRestore();
  });

  it('does not bind accepted sidekick work to caller abort', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const abortController = new AbortController();
    abortController.abort();
    let deliveryOptions: any;
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation(((
      _message: unknown,
      options: unknown,
    ) => {
      deliveryOptions = options;
      return { accepted: Promise.resolve({ action: 'deliver', runId: 'sidekick-run' }) };
    }) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true },
      getParentAgent: () => createParentAgent(),
    });
    const context = { ...toolContext(), abortSignal: abortController.signal };

    const result = (await tool.execute?.({ question: 'Question?' }, context)) as any;

    expect(result.status).toBe('pending');
    expect(deliveryOptions.ifIdle.streamOptions).not.toHaveProperty('abortSignal');
    sendMessage.mockRestore();
  });

  it('stores passive checks and explicit questions in one sidekick history', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const thread = await ensureOwnedRemindThread({ memory, parentThreadId, resourceId });
    const passive: RemindProtocolEvent = {
      kind: 'passive-check',
      eventId: 'subconscious:remind:passive:event',
      deliveryId: 'subconscious:remind:passive:delivery',
      parentAgentId,
      parentThreadId,
      resourceId,
      createdAt: Date.now(),
      replyRequired: false,
      candidateIds: ['record-1'],
    };
    await memory.saveMessages({
      messages: [protocolMessage(passive, 'Passive reminder check', { threadId: thread.id })],
    });
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'sidekick-run' }),
    })) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true },
      getParentAgent: () => createParentAgent(),
    });

    const result = (await tool.execute?.({ question: 'Question?' }, toolContext())) as any;

    expect(result.status).toBe('pending');
    expect((await storedProtocols(memory)).map(protocol => protocol.kind)).toEqual(['passive-check', 'question']);
    sendMessage.mockRestore();
  });

  it('persists concurrent questions separately while native active-run delivery owns their order', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const deliveredEventIds: string[] = [];
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation(((message: any) => {
      deliveredEventIds.push(message.metadata[REMIND_DELIVERY_METADATA_KEY].eventId);
      return { accepted: Promise.resolve({ action: 'deliver', runId: 'sidekick-run' }) };
    }) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true },
      getParentAgent: () => createParentAgent(),
    });

    const results = (await Promise.all([
      tool.execute?.({ question: 'First question?' }, toolContext()),
      tool.execute?.({ question: 'Second question?' }, toolContext()),
    ])) as any[];
    const questionEvents = (await storedProtocols(memory)).filter(protocol => protocol.kind === 'question');

    expect(results).toHaveLength(2);
    expect(results.every(result => result.accepted && result.status === 'pending')).toBe(true);
    expect(new Set(results.map(result => result.replyId)).size).toBe(2);
    expect(questionEvents).toHaveLength(2);
    expect(deliveredEventIds).toHaveLength(2);
    expect(new Set(deliveredEventIds)).toEqual(new Set(results.map(result => `${result.replyId}:question`)));
    sendMessage.mockRestore();
  });

  it('records a clean routing rejection after a durable question', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'blocked', reason: 'suspended' }),
    })) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true },
      getParentAgent: () => createParentAgent(),
    });

    const result = (await tool.execute?.({ question: 'Question?' }, toolContext())) as any;
    const protocols = await storedProtocols(memory);

    expect(result).toMatchObject({ accepted: false, status: 'rejected', replyId: expect.any(String) });
    expect(protocols.map(protocol => protocol.kind)).toEqual(['question', 'routing-failure']);
    sendMessage.mockRestore();
  });

  it('returns delivery_unknown when rejection-state persistence also fails', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'blocked', reason: 'suspended' }),
    })) as any);
    const originalSave = Memory.prototype.saveMessages;
    const save = vi.spyOn(Memory.prototype, 'saveMessages').mockImplementation(async function (args: any) {
      const protocol = getRemindProtocol(args.messages[0]);
      if (protocol?.kind === 'routing-failure') throw new Error('marker unavailable');
      return await originalSave.call(this, args);
    });
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true },
      getParentAgent: () => createParentAgent(),
    });

    const result = (await tool.execute?.({ question: 'Question?' }, toolContext())) as any;

    expect(result).toMatchObject({ accepted: false, status: 'delivery_unknown', replyId: expect.any(String) });
    expect((await storedProtocols(memory)).map(protocol => protocol.kind)).toEqual(['question']);
    sendMessage.mockRestore();
    save.mockRestore();
  });

  it('resolves lightweight references once and filters ledger-only events from provider input', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { event, message, thread } = await seedQuestion(memory);
    const partial: RemindProtocolEvent = {
      kind: 'partial-reply',
      eventId: `${event.replyId}:partial:1`,
      deliveryId: `${event.replyId}:partial:1:delivery`,
      parentAgentId,
      parentThreadId,
      resourceId,
      createdAt: event.createdAt + 1,
      replyId: event.replyId,
      sequence: 1,
      moreComing: true,
    };
    const partialMessage = protocolMessage(partial, `Partial reply for ${event.replyId}`);
    await memory.saveMessages({ messages: [partialMessage] });
    const reference: MastraDBMessage = {
      id: `${event.deliveryId}:signal-row`,
      role: 'signal',
      threadId: thread.id,
      resourceId,
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: `Resolve canonical reminder event ${event.eventId}.` }],
        metadata: { signal: { metadata: { [REMIND_DELIVERY_METADATA_KEY]: { eventId: event.eventId } } } },
      },
    };
    const wrongParentEvent = {
      ...questionEvent('subconscious:remind:wrong-input:reply'),
      parentAgentId: 'other-agent',
    };
    const wrongParentMessage = protocolMessage(wrongParentEvent, `Memory question ${wrongParentEvent.replyId}`);
    const malformedMessage: MastraDBMessage = {
      ...message,
      id: 'malformed-protocol',
      content: { ...message.content, metadata: { [REMIND_PROTOCOL_METADATA_KEY]: { kind: 'question' } } },
    };
    const processor = new RemindEventReferenceProcessor(memory, thread.id, resourceId, undefined, parentAgentId);

    const resolved = await processor.processInputStep({
      messages: [partialMessage, wrongParentMessage, malformedMessage, reference],
    } as any);
    expect(resolved?.messages).toHaveLength(1);
    expect(resolved?.messages[0]).toMatchObject({ id: message.id, role: 'user' });
    expect(getRemindProtocol(resolved!.messages[0]!)).toMatchObject({ kind: 'question', replyId: event.replyId });

    const deduplicated = await processor.processInputStep({ messages: [message, reference] } as any);
    expect(deduplicated?.messages).toEqual([message]);
  });

  it('exposes the reply tool to the provider only with a trusted question in input', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { thread, message } = await seedQuestion(memory);
    const processor = new RemindEventReferenceProcessor(memory, thread.id, resourceId, 'reply_to_memory_question');
    const tools = { knowledge_search: {}, reply_to_memory_question: {} };

    const passive = await processor.processInputStep({ messages: [], tools } as any);
    const question = await processor.processInputStep({ messages: [message], tools } as any);

    expect(passive?.activeTools).toEqual(['knowledge_search']);
    expect(question?.activeTools).toBeUndefined();
  });

  it('rejects unknown and current-input-missing reply IDs without parent delivery', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { event, message } = await seedQuestion(memory);
    const sent = vi.fn();
    const tool = createReplyTool(memory, createParentAgent(sent));

    const unknown = await tool.execute?.(
      { replyId: 'unknown', answer: 'No', moreComing: false },
      toolContext([message]),
    );
    const missing = await tool.execute?.({ replyId: event.replyId, answer: 'No', moreComing: false }, toolContext([]));

    expect(unknown).toMatchObject({ delivered: false, reason: 'untrusted-or-unknown-reply-id' });
    expect(missing).toMatchObject({ delivered: false, reason: 'untrusted-or-unknown-reply-id' });
    expect(sent).not.toHaveBeenCalled();
  });

  it('rejects question events with wrong parent or resource provenance', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    await ensureOwnedRemindThread({ memory, parentThreadId, resourceId });
    const wrongParent = { ...questionEvent('subconscious:remind:wrong-parent:reply'), parentThreadId: 'other-parent' };
    const wrongResource = {
      ...questionEvent('subconscious:remind:wrong-resource:reply'),
      resourceId: 'other-resource',
    };
    const parentMessage = protocolMessage(wrongParent, `Memory question ${wrongParent.replyId}`);
    const resourceMessage = protocolMessage(wrongResource, `Memory question ${wrongResource.replyId}`);
    await memory.saveMessages({ messages: [parentMessage, resourceMessage] });
    const parentAgent = createParentAgent();
    const tool = createReplyTool(memory, parentAgent);

    const parentResult = await tool.execute?.(
      { replyId: wrongParent.replyId, answer: 'No', moreComing: false },
      toolContext([parentMessage]),
    );
    const resourceResult = await tool.execute?.(
      { replyId: wrongResource.replyId, answer: 'No', moreComing: false },
      toolContext([resourceMessage]),
    );

    expect(parentResult).toMatchObject({ delivered: false, reason: 'untrusted-or-unknown-reply-id' });
    expect(resourceResult).toMatchObject({ delivered: false, reason: 'untrusted-or-unknown-reply-id' });
    expect(parentAgent.sendSignal).not.toHaveBeenCalled();
  });

  it('persists monotonic partial replies and never wakes an idle parent', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { event, message } = await seedQuestion(memory);
    const sent = vi.fn();
    const parentAgent = createParentAgent(sent);
    const tool = createReplyTool(memory, parentAgent);
    const context = toolContext([message]);

    const first = await tool.execute?.({ replyId: event.replyId, answer: 'First', moreComing: true }, context);
    const second = await tool.execute?.({ replyId: event.replyId, answer: 'Second', moreComing: true }, context);

    expect(first).toMatchObject({ delivered: true, sequence: 1, moreComing: true });
    expect(second).toMatchObject({ delivered: true, sequence: 2, moreComing: true });
    expect(parentAgent.sendSignal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: `${event.replyId}:partial:1:signal` }),
      expect.objectContaining({ ifIdle: { behavior: 'persist' } }),
    );
    expect(parentAgent.sendSignal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: `${event.replyId}:partial:2:signal` }),
      expect.objectContaining({ ifIdle: { behavior: 'persist' } }),
    );
    expect((await storedProtocols(memory)).map(protocol => protocol.kind)).toEqual([
      'question',
      'partial-reply',
      'partial-reply',
    ]);
  });

  it('persists terminal pending before delivery and delivered after acceptance', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { event, message } = await seedQuestion(memory);
    const order: string[] = [];
    const parentAgent = createParentAgent();
    parentAgent.sendSignal = vi.fn((signal: any) => {
      order.push(`send:${signal.id}`);
      return { signal, accepted: Promise.resolve({ action: 'deliver', runId: 'parent-run' }) };
    });
    const originalSave = memory.saveMessages.bind(memory);
    vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
      const protocol = getRemindProtocol(args.messages[0]!);
      if (protocol && protocol.kind !== 'question') order.push(`save:${protocol.kind}`);
      return await originalSave(args);
    });
    const tool = createReplyTool(memory, parentAgent);

    const result = await tool.execute?.(
      { replyId: event.replyId, answer: 'Final answer', moreComing: false },
      toolContext([message]),
    );
    const duplicate = await tool.execute?.(
      { replyId: event.replyId, answer: 'Duplicate', moreComing: false },
      toolContext([message]),
    );

    expect(result).toMatchObject({ delivered: true, moreComing: false, outcome: 'answer' });
    expect(order).toEqual([
      'save:terminal-pending-delivery',
      `send:${event.replyId}:terminal:signal`,
      'save:terminal-delivered',
    ]);
    expect(duplicate).toMatchObject({ delivered: false, reason: 'already-terminal' });
    expect(parentAgent.sendSignal).toHaveBeenCalledOnce();
  });

  it('resumes a persisted pending terminal delivery with its canonical answer body', async () => {
    const storage = new InMemoryStore();
    const firstMemory = new Memory({ storage });
    const { event, message } = await seedQuestion(firstMemory);
    const pending: RemindProtocolEvent = {
      kind: 'terminal-pending-delivery',
      eventId: `${event.replyId}:terminal:pending`,
      deliveryId: `${event.replyId}:terminal:signal`,
      parentAgentId,
      parentThreadId,
      resourceId,
      createdAt: event.createdAt + 1,
      replyId: event.replyId,
      outcome: 'answer',
    };
    await firstMemory.saveMessages({
      messages: [protocolMessage(pending, `Terminal reply pending delivery for ${event.replyId}\n\nCanonical answer`)],
    });

    const secondMemory = new Memory({ storage });
    const parentAgent = createParentAgent();
    const tool = createReplyTool(secondMemory, parentAgent);
    const result = await tool.execute?.(
      { replyId: event.replyId, answer: 'Different retry input', moreComing: false },
      toolContext([message]),
    );

    expect(result).toMatchObject({ delivered: true, moreComing: false });
    expect(parentAgent.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'Canonical answer' }),
      expect.anything(),
    );
  });

  it('retries terminal delivery twice with one deterministic signal ID before exhaustion', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { event, message } = await seedQuestion(memory);
    const parentAgent = createParentAgent();
    parentAgent.sendSignal = vi.fn((signal: any) => ({
      signal,
      accepted: Promise.resolve({ action: 'blocked', reason: 'blocked' }),
    }));
    const tool = createReplyTool(memory, parentAgent);

    const result = await tool.execute?.(
      { replyId: event.replyId, answer: 'Final answer', moreComing: false },
      toolContext([message]),
    );

    expect(result).toMatchObject({ delivered: false, reason: 'delivery-exhausted' });
    expect(parentAgent.sendSignal).toHaveBeenCalledTimes(2);
    expect(parentAgent.sendSignal.mock.calls.map(call => call[0].id)).toEqual([
      `${event.replyId}:terminal:signal`,
      `${event.replyId}:terminal:signal`,
    ]);
    expect((await storedProtocols(memory)).filter(protocol => protocol.kind === 'delivery-failure')).toEqual([
      expect.objectContaining({ attempt: 1, exhausted: false }),
      expect.objectContaining({ attempt: 2, exhausted: true }),
    ]);
  });

  it('does not resend in-run when delivered-marker persistence fails', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { event, message } = await seedQuestion(memory);
    const parentAgent = createParentAgent();
    const originalSave = memory.saveMessages.bind(memory);
    vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
      if (getRemindProtocol(args.messages[0]!)?.kind === 'terminal-delivered') throw new Error('marker unavailable');
      return await originalSave(args);
    });
    const tool = createReplyTool(memory, parentAgent);

    const first = await tool.execute?.(
      { replyId: event.replyId, answer: 'Final answer', moreComing: false },
      toolContext([message]),
    );
    const second = await tool.execute?.(
      { replyId: event.replyId, answer: 'Final answer', moreComing: false },
      toolContext([message]),
    );

    expect(first).toMatchObject({ delivered: false, reason: 'delivery-marker-unknown' });
    expect(second).toMatchObject({ delivered: false, reason: 'terminal-delivery-already-attempted' });
    expect(parentAgent.sendSignal).toHaveBeenCalledOnce();
    expect(parentAgent.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ id: `${event.replyId}:terminal:signal` }),
      expect.anything(),
    );
  });

  it('reconstructs terminal state from canonical events with a second Memory instance', async () => {
    const storage = new InMemoryStore();
    const firstMemory = new Memory({ storage });
    const { event, message } = await seedQuestion(firstMemory);
    const parentAgent = createParentAgent();
    const firstTool = createReplyTool(firstMemory, parentAgent);
    await firstTool.execute?.(
      { replyId: event.replyId, answer: 'Final answer', moreComing: false },
      toolContext([message]),
    );

    const secondMemory = new Memory({ storage });
    const secondTool = createReplyTool(secondMemory, parentAgent);
    const duplicate = await secondTool.execute?.(
      { replyId: event.replyId, answer: 'Duplicate', moreComing: false },
      toolContext([message]),
    );

    expect(duplicate).toMatchObject({ delivered: false, reason: 'already-terminal' });
    expect(parentAgent.sendSignal).toHaveBeenCalledOnce();
  });
});

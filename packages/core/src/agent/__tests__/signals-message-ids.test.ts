import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  createBlockingFirstTextStreamModel,
  nextTick,
  readNextRunWithParts,
  waitForActiveRun,
  waitForCondition,
} from './signals-test-utils';

describe('Agent signals: message ids', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('starts an idle thread run when sendMessage is called', async () => {
    const agent = new Agent({
      id: 'idle-message-agent',
      name: 'Idle Message Agent',
      instructions: 'Test',
      model: createTextStreamModel('message response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'idle-message-thread',
      resourceId: 'idle-message-user',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    const result = await agent.sendMessage(
      { contents: 'Hello from sendMessage', attributes: { sentFrom: 'test' } },
      {
        resourceId: 'idle-message-user',
        threadId: 'idle-message-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-message-user', thread: 'idle-message-thread' } } },
      },
    );

    const subscribedRun = await nextRun;
    await expect(result.accepted).resolves.toMatchObject({ action: 'wake', runId: subscribedRun.value.runId });
    expect(result.signal).toMatchObject({ type: 'user', tagName: 'user', contents: 'Hello from sendMessage' });
    const signalPart = subscribedRun.value.parts.find((part: any) => part.type === 'data-user-message');
    expect(signalPart?.data).toMatchObject({
      id: result.signal.id,
      type: 'user',
      tagName: 'user',
      contents: 'Hello from sendMessage',
      attributes: { sentFrom: 'test' },
    });
    expect(subscribedRun.value.text).toBe('message response');

    subscription.unsubscribe();
  });

  it('uses the configured message ID generator for persisted sendMessage signal rows', async () => {
    const memory = new MockMemory();
    const threadId = 'configured-send-message-thread';
    const resourceId = 'configured-send-message-user';
    await memory.createThread({ threadId, resourceId });

    let sequence = 0;
    const idGenerator = vi.fn((context?: { idType?: string; source?: string; entityId?: string }) => {
      sequence += 1;
      return `${context?.idType ?? 'id'}_custom_${sequence}`;
    });

    const agent = new Agent({
      id: 'configured-send-message-agent',
      name: 'Configured Send Message Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
      memory,
    });

    new Mastra({
      agents: { configuredSendMessageAgent: agent },
      idGenerator,
      logger: false,
    });

    const result = agent.sendMessage(
      { contents: 'persist with configured id' },
      {
        resourceId,
        threadId,
        ifActive: { behavior: 'persist' },
        ifIdle: { behavior: 'persist' },
      },
    );

    await expect(result.persisted).resolves.toBeUndefined();

    expect(result.signal.id).toMatch(/^message_custom_\d+$/);
    const recalled = await memory.recall({ threadId, resourceId });
    const persistedSignal = recalled.messages.find(message => message.role === 'signal');

    expect(persistedSignal?.id).toBe(result.signal.id);
    expect(persistedSignal?.id).toMatch(/^message_custom_\d+$/);
    expect(idGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        idType: 'message',
        source: 'agent',
        entityId: 'configured-send-message-agent',
        threadId,
        resourceId,
      }),
    );
  });

  it('preserves explicit sendSignal IDs', async () => {
    const memory = new MockMemory();
    const threadId = 'explicit-signal-id-thread';
    const resourceId = 'explicit-signal-id-user';
    await memory.createThread({ threadId, resourceId });

    const agent = new Agent({
      id: 'explicit-signal-id-agent',
      name: 'Explicit Signal ID Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
      memory,
    });

    new Mastra({
      agents: { explicitSignalIdAgent: agent },
      idGenerator: () => 'message_custom_generated',
      logger: false,
    });

    const result = agent.sendSignal(
      { id: 'caller-signal-id', type: 'system-reminder', contents: 'remember this' },
      {
        resourceId,
        threadId,
        ifIdle: { behavior: 'persist' },
      },
    );

    await expect(result.persisted).resolves.toBeUndefined();
    expect(result.signal.id).toBe('caller-signal-id');
  });

  it('uses the configured message ID generator for queueMessage signals', async () => {
    const memory = new MockMemory();
    const threadId = 'configured-queue-message-thread';
    const resourceId = 'configured-queue-message-user';
    await memory.createThread({ threadId, resourceId });

    let sequence = 0;
    const idGenerator = vi.fn((context?: { idType?: string; source?: string; entityId?: string }) => {
      sequence += 1;
      return `${context?.idType ?? 'id'}_custom_${sequence}`;
    });

    const agent = new Agent({
      id: 'configured-queue-message-agent',
      name: 'Configured Queue Message Agent',
      instructions: 'Test',
      model: createTextStreamModel('queued response'),
      memory,
    });

    new Mastra({
      agents: { configuredQueueMessageAgent: agent },
      idGenerator,
      logger: false,
    });

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    const result = agent.queueMessage('queue with configured id', { resourceId, threadId });

    expect(result.signal.id).toMatch(/^message_custom_\d+$/);
    expect(idGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        idType: 'message',
        source: 'agent',
        entityId: 'configured-queue-message-agent',
        threadId,
        resourceId,
      }),
    );

    const queuedRun = await nextRun;
    expect(queuedRun.value.text).toBe('queued response');
    subscription.unsubscribe();
  });

  it('resolves run id context before generating sendMessage signal IDs', async () => {
    const threadId = 'run-id-send-message-id-thread';
    const resourceId = 'run-id-send-message-id-user';
    let sequence = 0;
    const idGenerator = vi.fn(context => {
      sequence += 1;
      if (context?.idType === 'message') return `message_custom_${context.threadId}_${context.resourceId}`;
      return `${context?.idType ?? 'id'}_custom_${sequence}`;
    });
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'message response');
    const agent = new Agent({
      id: 'run-id-send-message-id-agent',
      name: 'Run Id Send Message Id Agent',
      instructions: 'Test',
      model,
    });

    new Mastra({
      agents: { runIdSendMessageIdAgent: agent },
      idGenerator,
      logger: false,
    });

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const stream = await agent.stream('Hello', { memory: { thread: threadId, resource: resourceId } });

    try {
      await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
      await waitForCondition(() => stream._getImmediateText() === 'first response');
      const result = agent.sendMessage('message by run id', { runId: stream.runId });

      expect(result.signal.id).toBe(`message_custom_${threadId}_${resourceId}`);
      expect(idGenerator).toHaveBeenCalledWith(
        expect.objectContaining({
          idType: 'message',
          source: 'agent',
          entityId: 'run-id-send-message-id-agent',
          threadId,
          resourceId,
        }),
      );
    } finally {
      releaseFirst();
      subscription.unsubscribe();
    }

    await expect(stream.text).resolves.toBe('first responsemessage response');
  });

  it('resolves run id context before generating queueMessage signal IDs', async () => {
    const threadId = 'run-id-queue-message-id-thread';
    const resourceId = 'run-id-queue-message-id-user';
    let sequence = 0;
    const idGenerator = vi.fn(context => {
      sequence += 1;
      if (context?.idType === 'message') return `message_custom_${context.threadId}_${context.resourceId}`;
      return `${context?.idType ?? 'id'}_custom_${sequence}`;
    });
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'first response',
      'queued response',
    );
    const agent = new Agent({
      id: 'run-id-queue-message-id-agent',
      name: 'Run Id Queue Message Id Agent',
      instructions: 'Test',
      model,
    });

    new Mastra({
      agents: { runIdQueueMessageIdAgent: agent },
      idGenerator,
      logger: false,
    });

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const stream = await agent.stream('Hello', { memory: { thread: threadId, resource: resourceId } });

    try {
      await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
      const result = agent.queueMessage('queue by run id', { runId: stream.runId });

      expect(result.signal.id).toBe(`message_custom_${threadId}_${resourceId}`);
      expect(result.runId).not.toBe(stream.runId);
      expect(idGenerator).toHaveBeenCalledWith(
        expect.objectContaining({
          idType: 'message',
          source: 'agent',
          entityId: 'run-id-queue-message-id-agent',
          threadId,
          resourceId,
        }),
      );
      await nextTick();
      expect(getStreamCount()).toBe(1);
    } finally {
      releaseFirst();
      subscription.unsubscribe();
    }

    await expect(stream.text).resolves.toBe('first response');
  });
});

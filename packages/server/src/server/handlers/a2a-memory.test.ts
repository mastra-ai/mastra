import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryTaskStore } from '../a2a/store';
import { handleMessageSend, handleMessageStream } from './a2a';

describe.each(['send', 'stream'] as const)('A2A %s real Agent memory', transport => {
  it('persists messages under the generated context and authenticated resource', async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const agent = new Agent({
      id: 'memory-agent',
      name: 'Memory agent',
      instructions: 'Reply briefly',
      memory,
      model: {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-model',
        supportedUrls: {},
        doGenerate: async () => ({
          content: [{ type: 'text', text: 'Hello back' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 2 },
          warnings: [],
        }),
        doStream: async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'text' });
              controller.enqueue({ type: 'text-delta', id: 'text', delta: 'Hello back' });
              controller.enqueue({ type: 'text-end', id: 'text' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 2 } });
              controller.close();
            },
          }),
        }),
      },
    });
    const taskStore = new InMemoryTaskStore();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'authenticated-user');
    const input = {
      agent,
      agentId: agent.id,
      taskStore,
      requestContext,
      requestId: 'real-memory',
      params: {
        message: {
          kind: 'message' as const,
          messageId: 'user-message',
          role: 'user' as const,
          parts: [{ kind: 'text' as const, text: 'Hello' }],
          metadata: { resourceId: 'untrusted-message' },
        },
        metadata: { resourceId: 'untrusted-params' },
      },
    };
    let taskId = '';
    let contextId = '';
    if (transport === 'send') {
      const { result } = await handleMessageSend(input);
      taskId = result.id;
      contextId = result.contextId;
    } else {
      for await (const event of handleMessageStream(input)) {
        if (event.result.kind === 'task') {
          taskId = event.result.id;
          contextId = event.result.contextId;
        }
      }
    }
    expect(contextId).not.toBe('');
    expect(await memory.getThreadById({ threadId: contextId })).toMatchObject({
      id: contextId,
      resourceId: 'authenticated-user',
    });
    const recalled = await memory.recall({ threadId: contextId });
    expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(recalled.messages.every(message => message.resourceId === 'authenticated-user')).toBe(true);
    expect(await taskStore.load({ agentId: agent.id, taskId })).toMatchObject({
      contextId,
      status: { state: 'completed' },
      metadata: { resourceId: 'authenticated-user' },
    });
  });

  it('authorizes the destination before mutating task state or invoking the model', async () => {
    const memory = new MockMemory({ storage: new InMemoryStore() });
    const doGenerate = vi.fn();
    const agent = new Agent({
      id: 'denied-agent',
      name: 'Denied agent',
      instructions: 'Reply briefly',
      memory,
      model: {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-model',
        supportedUrls: {},
        doGenerate,
        doStream: vi.fn(),
      },
    });
    const mastra = new Mastra({ logger: false, agents: { [agent.id]: agent } });
    const require = vi.fn().mockRejectedValue(Object.assign(new Error('FGA denied'), { status: 403 }));
    vi.spyOn(mastra, 'getServer').mockReturnValue({ fga: { require } } as any);
    const taskStore = new InMemoryTaskStore();
    const save = vi.spyOn(taskStore, 'save');
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'authenticated-user');
    requestContext.set('user', { id: 'user-1' });
    const input = {
      mastra,
      agent,
      agentId: agent.id,
      taskStore,
      requestContext,
      requestId: 'denied-memory',
      params: {
        message: {
          kind: 'message' as const,
          messageId: 'denied-user-message',
          contextId: 'denied-thread',
          role: 'user' as const,
          parts: [{ kind: 'text' as const, text: 'Hello' }],
        },
      },
    };

    const execution =
      transport === 'send'
        ? handleMessageSend(input)
        : (async () => {
            for await (const _event of handleMessageStream(input)) {
              // Authorization must reject before the first stream event.
            }
          })();
    await expect(execution).rejects.toMatchObject({ status: 403, message: 'FGA denied' });
    expect(save).not.toHaveBeenCalled();
    expect(doGenerate).not.toHaveBeenCalled();
    expect(await memory.getThreadById({ threadId: 'denied-thread' })).toBeNull();
  });

  it('rejects hidden pending branch destinations before any side effect', async () => {
    const memory = new MockMemory({ storage: new InMemoryStore() });
    Object.defineProperty(memory, '__mastraInspectThreadBranchState', {
      configurable: true,
      value: vi.fn().mockResolvedValue({ state: 'pending' }),
    });
    const doGenerate = vi.fn();
    const agent = new Agent({
      id: 'pending-agent',
      name: 'Pending agent',
      instructions: 'Reply briefly',
      memory,
      model: {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-model',
        supportedUrls: {},
        doGenerate,
        doStream: vi.fn(),
      },
    });
    const mastra = new Mastra({ logger: false, agents: { [agent.id]: agent } });
    const taskStore = new InMemoryTaskStore();
    const save = vi.spyOn(taskStore, 'save');
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'authenticated-user');
    const input = {
      mastra,
      agent,
      agentId: agent.id,
      taskStore,
      requestContext,
      requestId: 'pending-memory',
      params: {
        message: {
          kind: 'message' as const,
          messageId: 'pending-user-message',
          contextId: 'pending-thread',
          role: 'user' as const,
          parts: [{ kind: 'text' as const, text: 'Hello' }],
        },
      },
    };

    const execution =
      transport === 'send'
        ? handleMessageSend(input)
        : (async () => {
            for await (const _event of handleMessageStream(input)) {
              // Pending branches must reject before the first stream event.
            }
          })();
    await expect(execution).rejects.toMatchObject({ id: 'BRANCH_NOT_FOUND' });
    expect(save).not.toHaveBeenCalled();
    expect(doGenerate).not.toHaveBeenCalled();
  });
});

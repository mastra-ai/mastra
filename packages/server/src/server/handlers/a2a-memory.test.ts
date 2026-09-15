import { Agent } from '@mastra/core/agent';
import { MockMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
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
});

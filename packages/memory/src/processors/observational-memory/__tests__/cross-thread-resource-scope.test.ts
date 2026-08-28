import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent, MessageList } from '@mastra/core/agent';
import { MemoryRunState } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { loadMemoryContextMessages } from '../observation-turn/load-memory-context';

const longResponseText =
  'I understand your request completely. Let me provide you with a comprehensive and detailed response that covers all the important aspects of what you asked about. Here are my thoughts and recommendations based on the information you provided.';

function createMockOmModel(responseText: string) {
  let streamCallCount = 0;
  let generateCallCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      generateCallCount++;
      if (generateCallCount % 2 === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${generateCallCount}`,
              toolName: 'test',
              input: JSON.stringify({ action: 'go' }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        text: responseText,
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },
    doStream: async () => {
      streamCallCount++;
      if (streamCallCount % 2 === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: 'r1', modelId: 'mock', timestamp: new Date() },
            { type: 'tool-input-start' as const, id: `call-${streamCallCount}`, toolName: 'test' },
            {
              type: 'tool-input-delta' as const,
              id: `call-${streamCallCount}`,
              delta: JSON.stringify({ action: 'go' }),
            },
            { type: 'tool-input-end' as const, id: `call-${streamCallCount}` },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
            },
          ]),
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'r2', modelId: 'mock', timestamp: new Date() },
          { type: 'text-start' as const, id: 't1' },
          { type: 'text-delta' as const, id: 't1', delta: responseText },
          { type: 'text-end' as const, id: 't1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
        ]),
      };
    },
  });
}

function createSimpleModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'o1', modelId: 'mock', timestamp: new Date() },
        { type: 'text-start' as const, id: 't1' },
        { type: 'text-delta' as const, id: 't1', delta: text },
        { type: 'text-end' as const, id: 't1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

const observerText = `<observations>
## January 28, 2026
- 🔴 User asked for help with a task
</observations>
<current-task>Help the user</current-task>`;

const omTriggerTool = createTool({
  id: 'test',
  description: 'Trigger tool for OM testing',
  inputSchema: z.object({ action: z.string().optional() }),
  execute: async () => ({ success: true }),
});

describe('repro #15367 — cross-thread messages with resource-scoped OM', () => {
  it('does not throw wrong threadId when generating on thread B with history on thread A', async () => {
    const store = new InMemoryStore();
    const memory = new Memory({
      storage: store,
      options: {
        lastMessages: 5,
        observationalMemory: {
          enabled: true,
          scope: 'resource',
          observation: {
            model: createSimpleModel(observerText) as any,
            messageTokens: 20,
            bufferTokens: false,
          },
          reflection: {
            model: createSimpleModel(observerText) as any,
            observationTokens: 50000,
          },
        },
      },
    });

    const agent = new Agent({
      id: 'repro-15367',
      name: 'repro',
      instructions: 'helpful',
      model: createMockOmModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory,
    });

    const resource = 'resource-1';
    await agent.generate('Hello from thread A, I need help with something important.', {
      memory: { thread: 'thread-A', resource },
    });

    const memoryStore = await store.getStore('memory');
    const recordA = await memoryStore!.getObservationalMemory(null, resource);
    expect(recordA?.activeObservations).toBeTruthy();

    // An unobserved message living on thread A, created after the observation boundary so
    // the OM date filter keeps it. With resource scope, getContext() loads it for ANY thread
    // of the resource — which is exactly how a foreign threadId reaches the message list.
    const boundary = recordA?.lastObservedAt ? new Date(recordA.lastObservedAt).getTime() : Date.now();
    await memoryStore!.saveMessages({
      messages: [
        {
          id: 'cross-thread-user-1',
          threadId: 'thread-A',
          resourceId: resource,
          role: 'user',
          createdAt: new Date(boundary + 1000),
          content: { format: 2, parts: [{ type: 'text', text: 'A later message on thread A' }] },
        } as any,
      ],
    });

    // Guard against the scenario silently going vacuous: thread B's context must actually
    // contain the thread-A message, otherwise the threadId guard is never exercised below.
    const runState = new MemoryRunState({ memory, threadId: 'thread-B', resourceId: resource });
    const listMessagesByResourceId = vi.spyOn(memoryStore!, 'listMessagesByResourceId');
    const getObservationalMemory = vi.spyOn(memoryStore!, 'getObservationalMemory');
    const context = await memory.getContext({ threadId: 'thread-B', resourceId: resource, runState });
    const storageReadsAfterFirstContext = {
      messages: listMessagesByResourceId.mock.calls.length,
      record: getObservationalMemory.mock.calls.length,
    };
    await memory.getContext({ threadId: 'thread-B', resourceId: resource, runState });
    expect(listMessagesByResourceId).toHaveBeenCalledTimes(storageReadsAfterFirstContext.messages);
    expect(getObservationalMemory).toHaveBeenCalledTimes(storageReadsAfterFirstContext.record);
    const crossThread = context.messages.find(m => m.id === 'cross-thread-user-1');
    expect(crossThread).toBeTruthy();
    expect(crossThread!.threadId).toBe('thread-A');

    // The path that feeds resource-scoped context into a thread-bound MessageList:
    // a message from thread A must be accepted by a list bound to thread B, and keep its
    // own threadId. Without the `memory` exemption in inputToMastraDBMessage this throws
    // "Received input message with wrong threadId".
    const messageList = new MessageList({ threadId: 'thread-B', resourceId: resource });
    await loadMemoryContextMessages({
      memory: memory as any,
      messageList,
      threadId: 'thread-B',
      resourceId: resource,
      runState,
    });
    expect(listMessagesByResourceId).toHaveBeenCalledTimes(storageReadsAfterFirstContext.messages);
    expect(getObservationalMemory).toHaveBeenCalledTimes(storageReadsAfterFirstContext.record);

    const loaded = messageList.get.all.db().find(m => m.id === 'cross-thread-user-1');
    expect(loaded).toBeTruthy();
    expect(loaded!.threadId).toBe('thread-A');

    const res = await agent.generate('Hello from thread B, help me too.', {
      memory: { thread: 'thread-B', resource },
    });
    expect(res.text).toBeTruthy();

    const res2 = await agent.generate('Second turn on thread B.', {
      memory: { thread: 'thread-B', resource },
    });
    expect(res2.text).toBeTruthy();

    // stream path
    const stream = await agent.stream('Third turn on thread B, streamed.', {
      memory: { thread: 'thread-B', resource },
    });
    let text = '';
    for await (const chunk of stream.textStream) text += chunk;
    expect(text).toBeTruthy();

    // Injected cross-thread context is read-only: it must not be re-homed onto thread B.
    const threadB = await memoryStore!.listMessages({ threadId: 'thread-B', perPage: false });
    const threadA = await memoryStore!.listMessages({ threadId: 'thread-A', perPage: false });
    expect(threadB.messages.map(m => m.id)).not.toContain('cross-thread-user-1');
    expect(threadA.messages.map(m => m.id)).toContain('cross-thread-user-1');
  }, 60000);
});

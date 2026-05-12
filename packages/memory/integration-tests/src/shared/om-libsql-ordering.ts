/**
 * Helpers for LibSQL + Observational Memory integration tests in with-libsql-storage.test.ts:
 * - Agent.generate ordering (with/without bufferTokens)
 * - Scripted buffer + post-seal id scenario (#14745)
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import type { MemoryStorage } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { ObservationalMemory } from '@mastra/memory/processors';
import type { MemoryContextProvider } from '@mastra/memory/processors';
import { expect } from 'vitest';
import { z } from 'zod';

export const OM_ORDERING_LONG_TEXT =
  'I understand your request completely. Let me provide you with a comprehensive and detailed response that covers all the important aspects of what you asked about. Here are my thoughts and recommendations based on the information you provided. I hope this detailed explanation helps clarify everything you need to know about the topic at hand. Please let me know if you have any follow-up questions or need additional clarification on any of these points.';

export function createOmOrderingMockModel() {
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
              toolCallId: `call-${generateCallCount}-${Date.now()}`,
              toolName: 'test',
              input: JSON.stringify({ action: 'trigger' }),
            },
          ],
          warnings: [],
        };
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        text: OM_ORDERING_LONG_TEXT,
        content: [{ type: 'text' as const, text: OM_ORDERING_LONG_TEXT }],
        warnings: [],
      };
    },
  });
}

export function createOmOrderingMockObserverModel() {
  const text = `<observations>
## January 28, 2026
### Thread: test-thread
- User asked for help with a task
- Assistant provided a detailed response
</observations>
<current-task>Help the user with their request</current-task>
<suggested-response>I can help you with that.</suggested-response>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate call');
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

export function createOmOrderingMockReflectorModel() {
  const text = `<observations>
## Condensed
- User needs help with tasks
</observations>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate call');
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'ref-1', modelId: 'mock-reflector', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

export const omOrderingTestTool = createTool({
  id: 'test',
  description: 'Test tool for OM LibSQL ordering tests',
  inputSchema: z.object({ action: z.string().optional() }),
  execute: async () => ({ success: true, message: 'Tool executed' }),
});

export function getMessageText(msg: { content?: unknown }): string {
  const c = msg.content as any;
  if (typeof c === 'string') return c;
  if (c?.parts) {
    return c.parts
      .filter((p: { type?: string }) => p.type === 'text')
      .map((p: { text?: string }) => p.text)
      .join('');
  }
  return '';
}

export function messageHasToolInvocation(msg: { content?: unknown }): boolean {
  const c = msg.content as any;
  if (!c?.parts) return false;
  return c.parts.some((p: { type?: string }) => p.type === 'tool-invocation');
}

export function assertCreatedAtMonotonic(messages: { createdAt: Date | string }[]): void {
  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i - 1]!.createdAt).getTime();
    const curr = new Date(messages[i]!.createdAt).getTime();
    expect(curr).toBeGreaterThanOrEqual(prev);
  }
}

export function assertUniqueMessageIds(messages: { id: string }[]): void {
  const ids = messages.map(m => m.id);
  expect(new Set(ids).size).toBe(ids.length);
}

/**
 * When tool-invocation parts exist in storage, they must come before the final
 * assistant text (by message order, then part order). If nothing is persisted as
 * tool-invocation (common without bufferTokens), this is a no-op.
 */
export function assertToolInvocationBeforeFinalText(
  messages: { role?: string; content?: unknown }[],
  finalTextMarker: string,
): void {
  let firstTool: { mi: number; pi: number } | null = null;
  let firstText: { mi: number; pi: number } | null = null;

  for (let mi = 0; mi < messages.length; mi++) {
    const parts = (messages[mi]!.content as any)?.parts as Array<{ type?: string; text?: string }> | undefined;
    if (!parts) continue;
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi]!;
      if (p.type === 'tool-invocation' && !firstTool) firstTool = { mi, pi };
      if (p.type === 'text' && p.text?.includes(finalTextMarker) && !firstText) firstText = { mi, pi };
    }
  }

  if (!firstTool) return;

  expect(firstText, 'final assistant text must exist when tool-invocation is stored').not.toBeNull();
  const t = firstTool!;
  const x = firstText!;
  const toolBefore = t.mi < x.mi || (t.mi === x.mi && t.pi < x.pi);
  expect(toolBefore).toBe(true);
}

// ─── #14745 buffer seal + rotated assistant id (awaited om.buffer, not processInputStep) ───

/** Distinct id returned by rotateResponseMessageId — must appear on persisted post-seal row when rotation runs. */
export const OM_14745_POST_SEAL_ASSISTANT_ID = 'om-14745-post-seal-assistant-id';

/** Pre-seal streaming assistant id (same id the actor uses before seal). */
export const OM_14745_PRE_SEAL_ASSISTANT_ID = 'om-14745-pre-seal-assistant-id';

/** Marker text only present on the continuation assistant message after seal. */
export const OM_14745_POST_SEAL_TEXT = 'OM_14745_POST_SEAL_CONTINUATION_MARKER';
export const OM_14745_TOOL_CALL_ID = 'om-14745-tool-call-id';

export function createOm14745MockObserverModel() {
  const observationText = `<observations>
* Buffered chunk observed
</observations>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate — OM observer should stream');
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'mock-response', modelId: 'mock-model', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: observationText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createOm14745DbMessage(
  content: string,
  role: 'user' | 'assistant',
  id: string,
  createdAt: Date,
  threadId: string,
  resourceId: string,
): MastraDBMessage {
  const messageContent: MastraMessageContentV2 = {
    format: 2,
    parts: [{ type: 'text', text: content }],
  };

  return {
    id,
    role,
    content: messageContent,
    type: 'text',
    createdAt,
    threadId,
    resourceId,
  };
}

export function createLibsqlOmMemoryProvider(om: ObservationalMemory): MemoryContextProvider {
  return {
    getContext: async ({ threadId, resourceId }) => {
      const record = await om.getRecord(threadId, resourceId);
      let systemMessage: string | undefined;

      if (record?.activeObservations) {
        systemMessage = await om.buildContextSystemMessage({
          threadId,
          resourceId,
          record,
        });
      }

      const storage = om.getStorage() as MemoryStorage;
      const dateFilter = record?.lastObservedAt
        ? { dateRange: { start: new Date(new Date(record.lastObservedAt).getTime() + 1) } }
        : undefined;
      const result = await storage.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
        filter: dateFilter,
      });

      return {
        systemMessage,
        messages: result.messages,
        hasObservations: !!record?.activeObservations,
        omRecord: record,
        continuationMessage: undefined,
        otherThreadsContext: undefined,
      };
    },
    persistMessages: async (messages: MastraDBMessage[]) => {
      if (messages.length === 0) return;
      const storage = om.getStorage() as MemoryStorage;
      await storage.saveMessages({ messages });
    },
  };
}

/**
 * Awaited `buffer()` with processor-shaped `beforeBuffer` (seal → rotate → persist), then post-seal assistant
 * chunk and `om.persistMessages`. Uses awaited buffer to avoid processInputStep vs fire-and-forget buffer race.
 */
export async function runOm14745RotationScenario(opts: {
  memoryStore: MemoryStorage;
  threadId: string;
  resourceId: string;
  rotateResponseMessageId: () => string;
}): Promise<void> {
  const { memoryStore, threadId, resourceId, rotateResponseMessageId } = opts;

  await memoryStore.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: 'OM 14745',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    },
  });

  const om = new ObservationalMemory({
    storage: memoryStore,
    scope: 'thread',
    observation: {
      model: createOm14745MockObserverModel(),
      messageTokens: 1000,
      bufferTokens: 200,
      bufferActivation: 0.8,
    },
    reflection: {
      model: createOm14745MockObserverModel(),
      observationTokens: 50000,
    },
  });

  const memoryProvider = createLibsqlOmMemoryProvider(om);

  let streamingAssistantId = OM_14745_PRE_SEAL_ASSISTANT_ID;

  const rotate = () => {
    const next = rotateResponseMessageId();
    streamingAssistantId = next;
    return next;
  };

  const messageList = new MessageList({ threadId, resourceId });
  const base = Date.now();

  for (let i = 0; i < 10; i++) {
    messageList.add(
      createOm14745DbMessage(
        `Warmup ${i}: `.padEnd(200, 'x'),
        i % 2 === 0 ? 'user' : 'assistant',
        `om14745-warmup-${i}`,
        new Date(base + (i + 1) * 1000),
        threadId,
        resourceId,
      ),
      'memory',
    );
  }

  messageList.add(
    createOm14745DbMessage(
      'Warmup separator user',
      'user',
      'om14745-separator-user',
      new Date(base + 19_500),
      threadId,
      resourceId,
    ),
    'memory',
  );

  messageList.add(
    {
      id: OM_14745_PRE_SEAL_ASSISTANT_ID,
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'call',
              toolCallId: OM_14745_TOOL_CALL_ID,
              toolName: 'test',
              args: { action: 'trigger' },
            },
          },
          { type: 'text', text: 'Pre-seal assistant body '.padEnd(400, 'p') },
        ],
      },
      type: 'text',
      createdAt: new Date(base + 20_000),
      threadId,
      resourceId,
    } as MastraDBMessage,
    'response',
  );

  const record = await om.getOrCreateRecord(threadId, resourceId);
  const status = await om.getStatus({
    threadId,
    resourceId,
    messages: messageList.get.all.db(),
  });

  if (!status.shouldBuffer) {
    throw new Error(
      `OM 14745 harness requires shouldBuffer=true (pending=${status.pendingTokens}, threshold=${status.threshold}, shouldObserve=${status.shouldObserve})`,
    );
  }

  const bufResult = await om.buffer({
    threadId,
    resourceId,
    messages: om.getUnobservedMessages(messageList.get.all.db(), record),
    pendingTokens: status.pendingTokens,
    record,
    beforeBuffer: async (candidates: MastraDBMessage[]) => {
      if (candidates.length === 0) {
        return;
      }

      om.sealMessagesForBuffering(candidates);

      try {
        await Promise.resolve(rotate());
      } catch {
        /* match processor: hook failures are logged in production, not rethrown */
      }

      await memoryProvider.persistMessages(candidates);
    },
  });

  if (!bufResult.buffered) {
    throw new Error('OM 14745 harness: expected om.buffer() to run (buffered=false)');
  }

  messageList.updateToolInvocation({
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId: OM_14745_TOOL_CALL_ID,
      toolName: 'test',
      args: {},
      result: { success: true, message: 'Tool executed after seal' },
    },
  });

  messageList.add(
    {
      id: streamingAssistantId,
      role: 'assistant',
      content: {
        format: 2,
        parts: [{ type: 'text', text: OM_14745_POST_SEAL_TEXT }],
      },
      type: 'text',
      createdAt: new Date(base + 21_000),
      threadId,
      resourceId,
    } as MastraDBMessage,
    'response',
  );

  const newOutput = messageList.clear.response.db();
  if (newOutput.length > 0) {
    await om.persistMessages(newOutput, threadId, resourceId);
    for (const msg of newOutput) {
      messageList.add(msg, 'memory');
    }
  }
}

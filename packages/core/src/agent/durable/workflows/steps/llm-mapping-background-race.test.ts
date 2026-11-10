import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { createDurableLLMMappingStep } from './llm-mapping';

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const runId = 'background-mapping-race';
const threadId = 'background-mapping-thread';
const taskId = 'background-task-1';
const toolCallId = 'background-call';
const runningMetadata = { mastra: { backgroundTask: { taskId, status: 'running' } } };
const startedAt = new Date('2026-01-01T00:00:00.000Z');
const completedAt = new Date('2026-01-01T00:00:05.000Z');

function parts(list: MessageList) {
  return list.get.all.db().flatMap(message => message.content.parts ?? []);
}

function invocation(list: MessageList) {
  return parts(list).find(part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId);
}

afterEach(() => {
  globalRunRegistry.delete(runId);
  vi.restoreAllMocks();
});

function seedRunningCall() {
  const list = new MessageList({ threadId, resourceId: 'user-1' });
  list.add(
    {
      id: 'assistant-message',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId, toolName: 'research', args: {}, result: { taskId } },
            providerMetadata: runningMetadata,
          },
        ],
      },
    },
    'response',
  );
  // serialize() returns the live message objects; deep-copy so the snapshot
  // does not share metadata with the live list.
  const staleSnapshot = JSON.parse(JSON.stringify(list.serialize()));
  return { list, staleSnapshot };
}

function settle(list: MessageList, status: string, result: unknown) {
  list.updateToolInvocation(
    {
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId, toolName: 'research', args: {}, result },
      providerMetadata: { mastra: { backgroundTask: { taskId, status } } },
    },
    { mode: 'stream', backgroundTasks: { [toolCallId]: { taskId, startedAt, completedAt } } },
  );
  expect(invocation(list)?.providerMetadata?.mastra?.backgroundTask?.status).toBe(status);
}

async function runMapping(staleSnapshot: unknown, { modelOutputComputed }: { modelOutputComputed: boolean }) {
  const step = createDurableLLMMappingStep();
  return (step as any).execute({
    inputData: {
      runId,
      agentId: 'agent-1',
      messageId: 'assistant-message',
      state: { threadId, resourceId: 'user-1', threadExists: true },
      toolResults: [
        {
          toolCallId,
          toolName: 'research',
          args: {},
          result: { taskId },
          providerMetadata: runningMetadata,
          ...(modelOutputComputed ? { modelOutputComputed: true } : {}),
        },
      ],
      llmOutput: {
        messageListState: staleSnapshot,
        stepResult: {
          isContinued: true,
          reason: 'tool-calls',
          totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
        text: '',
        toolCalls: [],
      },
    },
    mastra: { getLogger: () => undefined },
    requestContext: new Map(),
  });
}

function expectSettledPersisted(output: { messageListState: any }, status: string, result: unknown) {
  const persisted = new MessageList({ threadId, resourceId: 'user-1' });
  persisted.deserialize(output.messageListState);
  expect(invocation(persisted)?.toolInvocation.result).toEqual(result);
  expect(invocation(persisted)?.providerMetadata?.mastra?.backgroundTask?.status).toBe(status);
  const message = persisted.get.all.db().find(m => m.id === 'assistant-message');
  const entry = (message?.content.metadata?.backgroundTasks as Record<string, any> | undefined)?.[toolCallId];
  expect(entry?.taskId).toBe(taskId);
  expect(new Date(entry?.startedAt).toISOString()).toBe(startedAt.toISOString());
  expect(new Date(entry?.completedAt).toISOString()).toBe(completedAt.toISOString());
}

const outcomes = [
  { status: 'completed', result: { summary: 'done' } },
  { status: 'failed', result: { error: 'research failed' } },
];

describe('durable mapping of a concurrently completed background task', () => {
  it.each(outcomes)(
    'preserves a $status background result when it arrives during the transcript read',
    async ({ status, result }) => {
      const { list, staleSnapshot } = seedRunningCall();
      globalRunRegistry.set(runId, { messageList: list } as any);

      // The mapping read yields before deserializing the older workflow snapshot.
      // Complete the task at that boundary, after the first live-state scan.
      let completedDuringRead = false;
      queueMicrotask(() => {
        completedDuringRead = true;
        settle(list, status, result);
      });

      const output = await runMapping(staleSnapshot, { modelOutputComputed: true });

      expect(completedDuringRead).toBe(true);
      expectSettledPersisted(output, status, result);
    },
  );

  it.each(outcomes)(
    'preserves a $status background result when it arrives while toModelOutput awaits',
    async ({ status, result }) => {
      const { list, staleSnapshot } = seedRunningCall();
      let mapperCalls = 0;
      const research = {
        toModelOutput: async (output: unknown) => {
          mapperCalls++;
          // The task settles while the mapper is awaiting, after the
          // pre-deserialize scans have already seen it running.
          settle(list, status, result);
          await new Promise(resolve => setTimeout(resolve, 0));
          return { type: 'json', value: output };
        },
      };
      globalRunRegistry.set(runId, { messageList: list, tools: { research } } as any);

      const output = await runMapping(staleSnapshot, { modelOutputComputed: false });

      expect(mapperCalls).toBe(1);
      expectSettledPersisted(output, status, result);
    },
  );
});

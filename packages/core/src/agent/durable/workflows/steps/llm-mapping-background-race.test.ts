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

describe('durable mapping of a concurrently completed background task', () => {
  it.each([
    { status: 'completed', result: { summary: 'done' } },
    { status: 'failed', result: { error: 'research failed' } },
  ])('preserves a $status background result when it arrives during the transcript read', async ({ status, result }) => {
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
    const staleSnapshot = list.serialize();
    globalRunRegistry.set(runId, { messageList: list } as any);

    // The mapping read yields before deserializing the older workflow snapshot.
    // Complete the task at that boundary, after the first live-state scan.
    let completedDuringRead = false;
    queueMicrotask(() => {
      completedDuringRead = true;
      list.updateToolInvocation(
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId, toolName: 'research', args: {}, result },
          providerMetadata: { mastra: { backgroundTask: { taskId, status } } },
        },
        { mode: 'stream' },
      );
      expect(invocation(list)?.providerMetadata?.mastra?.backgroundTask?.status).toBe(status);
    });

    const step = createDurableLLMMappingStep();
    const output = await (step as any).execute({
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
            modelOutputComputed: true,
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

    expect(completedDuringRead).toBe(true);
    const persisted = new MessageList({ threadId, resourceId: 'user-1' });
    persisted.deserialize(output.messageListState);
    expect(invocation(persisted)?.toolInvocation.result).toEqual(result);
    expect(invocation(persisted)?.providerMetadata?.mastra?.backgroundTask?.status).toBe(status);
  });
});

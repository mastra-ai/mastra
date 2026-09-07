import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { OutputResult, ProcessOutputResultArgs } from '../../../../processors';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import type { DurableAgenticWorkflowInput, RunRegistryEntry } from '../../types';

const resolveRuntimeDependencies = vi.fn();

vi.mock('../../utils/resolve-runtime', () => ({
  resolveRuntimeDependencies: (...args: any[]) => resolveRuntimeDependencies(...args),
}));

const { runDurableFinishSideEffects } = await import('../finalize-run');

function makeInitData(state: Record<string, unknown>): DurableAgenticWorkflowInput {
  return {
    runId: 'run-1',
    agentId: 'agent-1',
    agentName: 'agent-1',
    state,
  } as unknown as DurableAgenticWorkflowInput;
}

function makeMessageListState() {
  const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
  list.add({ role: 'user', content: 'hello' }, 'user');
  list.add({ role: 'assistant', content: 'hi there' }, 'response');
  return list.serialize();
}

describe('runDurableFinishSideEffects', () => {
  beforeEach(() => {
    resolveRuntimeDependencies.mockReset();
    globalRunRegistry.delete('run-1');
  });

  afterEach(() => {
    globalRunRegistry.delete('run-1');
  });

  it('persists with the save queue the rebuild returned, even when the registry entry is not updated', async () => {
    const flushMessages = vi.fn().mockResolvedValue(undefined);
    const createThread = vi.fn().mockResolvedValue(undefined);

    // A hydrated entry that was seeded without a save queue: resolveRuntimeDependencies
    // skips its registry write-back in that case, so the return value is the only handle.
    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
    } as unknown as RunRegistryEntry);

    resolveRuntimeDependencies.mockResolvedValue({
      saveQueueManager: { flushMessages },
      memory: { createThread },
    });

    await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
      messageListState: makeMessageListState(),
      mastra: { getLogger: () => undefined } as any,
    });

    expect(flushMessages).toHaveBeenCalledTimes(1);
  });

  it('skips title generation for an observational-memory run, matching the persistence guard', async () => {
    const generateThreadTitle = vi.fn().mockResolvedValue(undefined);
    const flushMessages = vi.fn().mockResolvedValue(undefined);

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      generateThreadTitle,
      saveQueueManager: { flushMessages },
      memory: { createThread: vi.fn() },
    } as unknown as RunRegistryEntry);

    await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: makeInitData({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        threadExists: true,
        observationalMemory: true,
      }),
      messageListState: makeMessageListState(),
    });

    // Neither finish-time memory write runs, so the run cannot leave behind a
    // titled thread that holds no messages.
    expect(flushMessages).not.toHaveBeenCalled();
    expect(generateThreadTitle).not.toHaveBeenCalled();
  });

  it('still generates a title for an ordinary run', async () => {
    const generateThreadTitle = vi.fn().mockResolvedValue(undefined);

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      generateThreadTitle,
    } as unknown as RunRegistryEntry);

    await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
      messageListState: makeMessageListState(),
    });

    expect(generateThreadTitle).toHaveBeenCalledTimes(1);
  });

  it.each(['abort', 'aborted'])(
    'preserves final output and persistence without titling a %s result',
    async finishReason => {
      const generateThreadTitle = vi.fn().mockResolvedValue(undefined);
      const flushMessages = vi.fn().mockResolvedValue(undefined);
      const outputResult: OutputResult = {
        text: 'hi there',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        finishReason,
        steps: [],
      };
      const processOutputResult = vi.fn(({ messageList }: ProcessOutputResultArgs) => messageList);
      globalRunRegistry.set('run-1', {
        isPlaceholder: false,
        outputProcessors: [{ id: 'final-observer', processOutputResult }],
        generateThreadTitle,
        saveQueueManager: { flushMessages },
        memory: { createThread: vi.fn() },
      } as unknown as RunRegistryEntry);

      const result = await runDurableFinishSideEffects({
        runId: 'run-1',
        initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
        messageListState: makeMessageListState(),
        outputResult,
      });

      expect(processOutputResult).toHaveBeenCalledTimes(1);
      expect(processOutputResult.mock.calls[0]?.[0].result).toBe(outputResult);
      expect(flushMessages).toHaveBeenCalledTimes(1);
      expect(flushMessages.mock.calls[0]?.[0]).toBe(processOutputResult.mock.calls[0]?.[0].messageList);
      expect(result.outputText).toBe('hi there');
      expect(generateThreadTitle).not.toHaveBeenCalled();
    },
  );

  it('deserializes into the run MessageList the stream is already holding', async () => {
    const existing = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      messageList: existing,
    } as unknown as RunRegistryEntry);

    await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
      messageListState: makeMessageListState(),
    });

    expect(globalRunRegistry.get('run-1')?.messageList).toBe(existing);
    expect(existing.get.all.db().length).toBeGreaterThan(0);
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import type { DurableAgenticWorkflowInput, RunRegistryEntry } from '../../types';

const resolveRuntimeDependencies = vi.fn();
const authorizeDurableMemory = vi.fn().mockResolvedValue(undefined);

vi.mock('../../memory-fga', () => ({
  authorizeDurableMemory: (...args: any[]) => authorizeDurableMemory(...args),
  getDurableMemoryAuthorizationChecks: vi.fn(() => new Map()),
}));

vi.mock('../../utils/resolve-runtime', () => ({
  resolveRuntimeDependencies: (...args: any[]) => resolveRuntimeDependencies(...args),
}));

const { runDurableFinishSideEffects } = await import('../finalize-run');

function makeInitData(
  state: Record<string, unknown>,
  options?: DurableAgenticWorkflowInput['options'],
): DurableAgenticWorkflowInput {
  return {
    runId: 'run-1',
    agentId: 'agent-1',
    agentName: 'agent-1',
    ...(options ? { options } : {}),
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
    authorizeDurableMemory.mockReset().mockResolvedValue(undefined);
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
      mastra: { getLogger: () => undefined, getServer: () => undefined } as any,
    });

    expect(flushMessages).toHaveBeenCalledTimes(1);
  });

  it('denies before durable finish persistence writes', async () => {
    const denial = new Error('memory write denied');
    authorizeDurableMemory.mockRejectedValueOnce(denial);
    const flushMessages = vi.fn();
    const createThread = vi.fn();

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      saveQueueManager: { flushMessages },
      memory: { createThread },
    } as unknown as RunRegistryEntry);

    await expect(
      runDurableFinishSideEffects({
        runId: 'run-1',
        initData: makeInitData(
          { threadId: 'thread-1', resourceId: 'resource-1', threadExists: false },
          { actor: true },
        ),
        messageListState: makeMessageListState(),
      }),
    ).rejects.toBe(denial);

    expect(authorizeDurableMemory).toHaveBeenCalledWith(
      expect.any(Map),
      expect.objectContaining({
        permission: 'memory:write',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        agentId: 'agent-1',
        actor: true,
      }),
    );
    expect(createThread).not.toHaveBeenCalled();
    expect(flushMessages).not.toHaveBeenCalled();
  });

  it('denies before durable title generation when memory reads are denied', async () => {
    const denial = new Error('memory read denied');
    authorizeDurableMemory.mockImplementation(async (_checks, input) => {
      if (input.permission === 'memory:read') throw denial;
    });
    const generateThreadTitle = vi.fn();

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      generateThreadTitle,
    } as unknown as RunRegistryEntry);

    await expect(
      runDurableFinishSideEffects({
        runId: 'run-1',
        initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
        messageListState: makeMessageListState(),
      }),
    ).rejects.toBe(denial);

    expect(generateThreadTitle).not.toHaveBeenCalled();
  });

  it('denies before durable title generation when memory writes are denied', async () => {
    const denial = new Error('memory write denied');
    authorizeDurableMemory.mockImplementation(async (_checks, input) => {
      if (input.permission === 'memory:write') throw denial;
    });
    const generateThreadTitle = vi.fn();

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      generateThreadTitle,
    } as unknown as RunRegistryEntry);

    await expect(
      runDurableFinishSideEffects({
        runId: 'run-1',
        initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
        messageListState: makeMessageListState(),
      }),
    ).rejects.toBe(denial);

    expect(authorizeDurableMemory).toHaveBeenCalledWith(
      expect.any(Map),
      expect.objectContaining({ permission: 'memory:read' }),
    );
    expect(generateThreadTitle).not.toHaveBeenCalled();
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

    const result = await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
      messageListState: makeMessageListState(),
    });
    await result.titleGeneration;

    expect(generateThreadTitle).toHaveBeenCalledTimes(1);
  });

  it('returns title generation for the workflow to manage after finishing', async () => {
    let resolveTitle: () => void;
    const titlePending = new Promise<void>(resolve => {
      resolveTitle = resolve;
    });
    const generateThreadTitle = vi.fn().mockReturnValue(titlePending);

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      generateThreadTitle,
    } as unknown as RunRegistryEntry);

    const finishResult = await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
      messageListState: makeMessageListState(),
    });
    let titleResolved = false;
    const managedTitleGeneration = finishResult.titleGeneration?.then(() => {
      titleResolved = true;
    });

    expect(generateThreadTitle).toHaveBeenCalledTimes(1);
    expect(titleResolved).toBe(false);

    resolveTitle!();
    await managedTitleGeneration;
    expect(titleResolved).toBe(true);
  });

  it('handles title generation failures without failing the durable run', async () => {
    const error = new Error('title generation failed');
    const generateThreadTitle = vi.fn().mockRejectedValue(error);
    const warn = vi.fn();

    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [],
      generateThreadTitle,
    } as unknown as RunRegistryEntry);

    const result = await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
      messageListState: makeMessageListState(),
      logger: { warn } as any,
    });
    await expect(result.titleGeneration).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[DurableAgent] Error generating thread title', {
      runId: 'run-1',
      error,
    });
  });

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

  // A recovered run or remote worker has no live registry config, only the JSON Schema
  // and options persisted in the workflow input.
  describe('structured output on a recovered run (persisted config only)', () => {
    const jsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' }, age: { type: 'number' } },
      required: ['name', 'age'],
      additionalProperties: false,
    };

    async function finishRecovered({
      text,
      finishReason = 'stop',
      structuredOutput = {},
    }: {
      text: string;
      finishReason?: string;
      structuredOutput?: Record<string, unknown>;
    }) {
      let flushed: MessageList | undefined;
      const flushMessages = vi.fn(async (list: MessageList) => {
        flushed = list;
      });
      resolveRuntimeDependencies.mockResolvedValue({
        saveQueueManager: { flushMessages },
        memory: { createThread: vi.fn() },
      });

      const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
      list.add({ role: 'user', content: 'who is it?' }, 'user');
      list.add({ role: 'assistant', content: text }, 'response');

      await runDurableFinishSideEffects({
        runId: 'run-1',
        initData: {
          ...makeInitData({ threadId: 'thread-1', resourceId: 'resource-1', threadExists: true }),
          options: { structuredOutput: { schema: jsonSchema, ...structuredOutput } },
        } as unknown as DurableAgenticWorkflowInput,
        messageListState: list.serialize(),
        mastra: { getLogger: () => undefined } as any,
        outputResult: { text, finishReason } as any,
      });

      expect(globalRunRegistry.get('run-1')?.structuredOutput).toBeUndefined();
      expect(flushMessages).toHaveBeenCalledTimes(1);
      return flushed!.get.response.db().findLast(m => m.role === 'assistant')?.content.metadata?.structuredOutput;
    }

    it('validates with the persisted JSON Schema', async () => {
      await expect(finishRecovered({ text: JSON.stringify({ name: 'Alice', age: 30 }) })).resolves.toEqual({
        name: 'Alice',
        age: 30,
      });
    });

    it('saves nothing when validation fails without a fallback', async () => {
      await expect(finishRecovered({ text: JSON.stringify({ name: 'Alice' }) })).resolves.toBeUndefined();
    });

    it('saves the persisted fallbackValue when errorStrategy is fallback', async () => {
      await expect(
        finishRecovered({
          text: JSON.stringify({ name: 'Alice' }),
          structuredOutput: { errorStrategy: 'fallback', fallbackValue: { name: 'Fallback', age: 1 } },
        }),
      ).resolves.toEqual({ name: 'Fallback', age: 1 });
    });

    it.each(['length', 'content-filter'])('does not validate truncated output (%s)', async finishReason => {
      await expect(
        finishRecovered({ text: JSON.stringify({ name: 'Alice', age: 30 }), finishReason }),
      ).resolves.toBeUndefined();
    });
  });

  // Observational memory saves the turn from its output processor and the finish-step
  // flush is skipped, so the object must already be on the message when processors run.
  it('attaches structured output before output processors run (observational memory)', async () => {
    let seenByProcessor: unknown;
    const flushMessages = vi.fn();
    globalRunRegistry.set('run-1', {
      isPlaceholder: false,
      outputProcessors: [
        {
          id: 'om-like',
          processOutputResult: async ({ messages }: { messages: any[] }) => {
            seenByProcessor = messages.findLast(m => m.role === 'assistant')?.content.metadata?.structuredOutput;
            return messages;
          },
        },
      ],
      saveQueueManager: { flushMessages },
      memory: { createThread: vi.fn() },
    } as unknown as RunRegistryEntry);

    const text = JSON.stringify({ name: 'Alice', age: 30 });
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    list.add({ role: 'user', content: 'who is it?' }, 'user');
    list.add({ role: 'assistant', content: text }, 'response');

    await runDurableFinishSideEffects({
      runId: 'run-1',
      initData: {
        ...makeInitData({
          threadId: 'thread-1',
          resourceId: 'resource-1',
          threadExists: true,
          observationalMemory: true,
        }),
        options: {
          structuredOutput: {
            schema: {
              type: 'object',
              properties: { name: { type: 'string' }, age: { type: 'number' } },
              required: ['name', 'age'],
            },
          },
        },
      } as unknown as DurableAgenticWorkflowInput,
      messageListState: list.serialize(),
      outputResult: { text, finishReason: 'stop' } as any,
    });

    expect(seenByProcessor).toEqual({ name: 'Alice', age: 30 });
    expect(flushMessages).not.toHaveBeenCalled();
  });
});

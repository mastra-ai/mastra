import { describe, expect, it, vi } from 'vitest';
import type { IFGAProvider } from '../../../../auth/ee/interfaces/fga';
import { MessageList } from '../../../message-list';
import { DurableExecutionFenceError, EXECUTION_SUPERSEDED_ERROR_ID } from '../../execution-fence';
import { globalRunRegistry } from '../../run-registry';
import * as resolveRuntime from '../../utils/resolve-runtime';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async () => ({
  restoreRequestContext: (
    await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')
  ).restoreRequestContext,
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

const toolRequiresApproval = vi.mocked(resolveRuntime.toolRequiresApproval);

function makeParams(runId: string, overrides: Record<string, any> = {}) {
  return {
    getState: async () => ({}),
    inputData: {
      toolCallId: 'call-1',
      toolName: 'secureTool',
      args: { query: 'mastra' },
    },
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    getInitData: () => ({
      runId,
      agentId: 'agent-1',
      options: {},
      state: {},
    }),
    ...overrides,
  };
}

describe('durable tool-call FGA error propagation', () => {
  it('re-throws FGADeniedError instead of serializing it as a recoverable tool error', async () => {
    const runId = 'durable-tool-fga-run';
    const denial = new Error('access denied');
    denial.name = 'FGADeniedError';
    const execute = vi.fn().mockRejectedValue(denial);
    globalRunRegistry.set(runId, { tools: { secureTool: { execute } } } as any);

    try {
      await expect((createDurableToolCallStep() as any).execute(makeParams(runId))).rejects.toThrow('access denied');
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('serializes non-FGA errors as recoverable tool errors', async () => {
    const runId = 'durable-tool-generic-error-run';
    const execute = vi.fn().mockRejectedValue(new Error('boom'));
    globalRunRegistry.set(runId, { tools: { secureTool: { execute } } } as any);

    try {
      const result = await (createDurableToolCallStep() as any).execute(makeParams(runId));
      expect(result.error).toMatchObject({ name: 'Error', message: 'boom' });
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('denies suspension-time message flushing before storage', async () => {
    const runId = 'durable-tool-memory-write-denied';
    const denial = new Error('memory write denied');
    denial.name = 'FGADeniedError';
    const require = vi.fn().mockRejectedValue(denial);
    const fgaProvider: IFGAProvider = {
      check: vi.fn(),
      require,
      filterAccessible: vi.fn(),
    };
    const flushMessages = vi.fn();
    const actor = { actorKind: 'user' } as const;
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    messageList.add({ role: 'assistant', content: 'approval required' }, 'response');
    toolRequiresApproval.mockResolvedValueOnce(true);
    globalRunRegistry.set(runId, {
      tools: { secureTool: { execute: vi.fn() } },
      saveQueueManager: { flushMessages },
      memory: { recall: async () => ({ messages: [] }) },
      messageList,
    } as any);

    try {
      await expect(
        (createDurableToolCallStep() as any).execute(
          makeParams(runId, {
            mastra: { getLogger: () => undefined, getServer: () => ({ fga: fgaProvider }) },
            getInitData: () => ({
              runId,
              agentId: 'agent-1',
              options: { actor },
              requestContextEntries: { user: { id: 'user-1' }, organizationId: 'org-1' },
              state: { threadId: 'thread-1', resourceId: 'resource-1', threadExists: true },
            }),
          }),
        ),
      ).rejects.toBe(denial);

      expect(flushMessages).not.toHaveBeenCalled();
      expect(require).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          permission: 'memory:write',
          resource: { type: 'thread', id: 'thread-1' },
          context: expect.objectContaining({
            metadata: expect.objectContaining({ agentId: 'agent-1' }),
          }),
        }),
      );
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('denies reading the thread to recover a cross-process tool call before storage (#30123)', async () => {
    const runId = 'durable-tool-memory-read-denied';
    const denial = new Error('memory read denied');
    denial.name = 'FGADeniedError';
    const require = vi.fn(async (_user: unknown, { permission }: { permission: string }) => {
      if (permission === 'memory:read') throw denial;
    });
    const fgaProvider: IFGAProvider = {
      check: vi.fn(),
      require,
      filterAccessible: vi.fn(),
    };
    const recall = vi.fn().mockResolvedValue({ messages: [] });
    const flushMessages = vi.fn();
    toolRequiresApproval.mockResolvedValueOnce(true);
    // A live list without the assistant tool call, as in a worker other than the LLM step's.
    globalRunRegistry.set(runId, {
      tools: { secureTool: { execute: vi.fn() } },
      saveQueueManager: { flushMessages },
      memory: { recall },
      messageList: new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' }),
    } as any);
    // The LLM step's transcript, which carries the assistant tool call.
    const messageListState = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' })
      .add(
        {
          id: 'assistant-1',
          role: 'assistant',
          createdAt: new Date(),
          threadId: 'thread-1',
          resourceId: 'resource-1',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'secureTool', args: {} },
              },
            ],
          },
        },
        'response',
      )
      .serialize();

    try {
      await expect(
        (createDurableToolCallStep() as any).execute(
          makeParams(runId, {
            getState: async () => ({ messageListState }),
            mastra: { getLogger: () => undefined, getServer: () => ({ fga: fgaProvider }) },
            getInitData: () => ({
              runId,
              agentId: 'agent-1',
              options: { actor: { actorKind: 'user' } },
              requestContextEntries: { user: { id: 'user-1' } },
              state: { threadId: 'thread-1', resourceId: 'resource-1', threadExists: true },
            }),
          }),
        ),
      ).rejects.toBe(denial);

      expect(require.mock.calls.map(([, { permission }]) => permission)).toEqual(['memory:write', 'memory:read']);
      expect(recall).not.toHaveBeenCalled();
      expect(flushMessages).not.toHaveBeenCalled();
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('denies suspension-time message flushing for a system actor before storage', async () => {
    const runId = 'durable-tool-memory-write-denied-system-actor';
    const denial = new Error('memory write denied');
    denial.name = 'FGADeniedError';
    const requireActor = vi.fn().mockRejectedValue(denial);
    const fgaProvider: IFGAProvider = {
      check: vi.fn(),
      require: vi.fn(),
      requireActor,
      filterAccessible: vi.fn(),
    };
    const flushMessages = vi.fn();
    const actor = { actorKind: 'system' } as const;
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    messageList.add({ role: 'assistant', content: 'approval required' }, 'response');
    toolRequiresApproval.mockResolvedValueOnce(true);
    globalRunRegistry.set(runId, {
      tools: { secureTool: { execute: vi.fn() } },
      saveQueueManager: { flushMessages },
      memory: { recall: async () => ({ messages: [] }) },
      messageList,
    } as any);

    try {
      await expect(
        (createDurableToolCallStep() as any).execute(
          makeParams(runId, {
            mastra: { getLogger: () => undefined, getServer: () => ({ fga: fgaProvider }) },
            getInitData: () => ({
              runId,
              agentId: 'agent-1',
              options: { actor },
              requestContextEntries: { organizationId: 'org-1' },
              state: { threadId: 'thread-1', resourceId: 'resource-1', threadExists: true },
            }),
          }),
        ),
      ).rejects.toBe(denial);

      expect(flushMessages).not.toHaveBeenCalled();
      expect(requireActor).toHaveBeenCalledWith(
        actor,
        expect.objectContaining({
          permission: 'memory:write',
          resource: { type: 'thread', id: 'thread-1' },
          context: expect.objectContaining({
            metadata: expect.objectContaining({ agentId: 'agent-1' }),
          }),
        }),
      );
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  describe('when recovering the tool call message cannot read storage (#30123)', () => {
    // A live list without the assistant tool call, as in a worker other than the LLM step's,
    // and the LLM step's transcript, which carries it.
    async function runApproval(
      runId: string,
      recall: () => Promise<unknown>,
      getState?: (keys?: string[]) => Promise<unknown>,
      // A tool that suspends while it runs; without one the call waits for approval first.
      execute?: (input: unknown, context: any) => Promise<unknown>,
    ) {
      const flushMessages = vi.fn();
      const suspend = vi.fn();
      if (!execute) toolRequiresApproval.mockResolvedValueOnce(true);
      globalRunRegistry.set(runId, {
        tools: { secureTool: { execute: execute ?? vi.fn() } },
        saveQueueManager: { flushMessages },
        memory: { recall: vi.fn(recall) },
        messageList: new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' }),
      } as any);
      const messageListState = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' })
        .add(
          {
            id: 'assistant-1',
            role: 'assistant',
            createdAt: new Date(),
            threadId: 'thread-1',
            resourceId: 'resource-1',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'secureTool', args: {} },
                },
              ],
            },
          },
          'response',
        )
        .serialize();
      const run = (createDurableToolCallStep() as any).execute(
        makeParams(runId, {
          suspend,
          mastra: { getLogger: () => undefined, getServer: () => undefined },
          getState: getState ?? (async () => ({ messageListState })),
          getInitData: () => ({
            runId,
            agentId: 'agent-1',
            options: {},
            state: { threadId: 'thread-1', resourceId: 'resource-1', threadExists: true },
          }),
        }),
      );
      return { run, suspend, flushMessages };
    }

    it('still suspends for approval when the recall fails, without annotating a copy of the message', async () => {
      const runId = 'durable-tool-recovery-recall-fails';
      try {
        const { run, suspend, flushMessages } = await runApproval(runId, async () => {
          throw new Error('storage unavailable');
        });
        await run;
        expect(suspend).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'approval', toolCallId: 'call-1' }),
          expect.anything(),
        );
        // Nothing to save: the only copy at hand may be stale against storage.
        for (const [list] of flushMessages.mock.calls) {
          expect(list.get.all.db().some((m: any) => m.content.metadata?.pendingToolApprovals)).toBe(false);
        }
      } finally {
        globalRunRegistry.delete(runId);
      }
    });

    it('still suspends for approval when the transcript cannot be read', async () => {
      const runId = 'durable-tool-recovery-transcript-fails';
      try {
        const { run, suspend } = await runApproval(
          runId,
          async () => ({ messages: [] }),
          async (keys?: string[]) => {
            if (keys?.includes('messageListState')) throw new Error('storage unavailable');
            return {};
          },
        );
        await run;
        expect(suspend).toHaveBeenCalledWith(expect.objectContaining({ type: 'approval' }), expect.anything());
      } finally {
        globalRunRegistry.delete(runId);
      }
    });

    it('stops without suspending when the recall hits the execution fence', async () => {
      const runId = 'durable-tool-recovery-recall-fenced';
      const fenced = new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, {
        agentId: 'agent-1',
        runId,
        executionId: 'execution-1',
      });
      try {
        const { run, suspend } = await runApproval(runId, async () => {
          throw fenced;
        });
        await expect(run).rejects.toBe(fenced);
        expect(suspend).not.toHaveBeenCalled();
      } finally {
        globalRunRegistry.delete(runId);
      }
    });

    it('stops the step instead of reporting a tool error when a suspending tool hits the execution fence', async () => {
      const runId = 'durable-tool-recovery-recall-fenced-in-execution';
      const fenced = new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, {
        agentId: 'agent-1',
        runId,
        executionId: 'execution-1',
      });
      try {
        const { run, suspend } = await runApproval(
          runId,
          async () => {
            throw fenced;
          },
          undefined,
          // The tool sees the rejected suspension as an ordinary error and lets it propagate.
          async (_input, context) => context.suspend({ question: 'Favourite colour?' }),
        );
        await expect(run).rejects.toBe(fenced);
        expect(suspend).not.toHaveBeenCalled();
      } finally {
        globalRunRegistry.delete(runId);
      }
    });
  });
});

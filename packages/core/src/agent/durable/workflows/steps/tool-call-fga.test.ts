import { describe, expect, it, vi } from 'vitest';
import type { IFGAProvider } from '../../../../auth/ee/interfaces/fga';
import { MessageList } from '../../../message-list';
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
      memory: {},
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
});

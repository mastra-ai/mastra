import { describe, expect, it, vi } from 'vitest';
import type { MCPToolExecutionContext } from '../../../../tools';
import { globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async () => ({
  restoreRequestContext: (
    await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')
  ).restoreRequestContext,
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

describe('durable tool-call context forwarding', () => {
  it('uses the current workflow-segment actor instead of the initial actor', async () => {
    const runId = 'durable-tool-actor-run';
    const execute = vi.fn().mockResolvedValue('ok');
    const initialActor = { actorKind: 'system' as const, sourceWorkflow: 'initial-run' };
    const resumeActor = { actorKind: 'system' as const, sourceWorkflow: 'approval-resume' };
    globalRunRegistry.set(runId, { tools: { secureTool: { execute } } } as any);

    try {
      await (createDurableToolCallStep() as any).execute({
        inputData: {
          toolCallId: 'call-1',
          toolName: 'secureTool',
          args: { query: 'mastra' },
        },
        mastra: { getLogger: () => undefined },
        suspend: vi.fn(),
        actor: resumeActor,
        getInitData: () => ({
          runId,
          agentId: 'agent-1',
          options: { actor: initialActor },
          state: {},
        }),
      });

      expect(execute).toHaveBeenCalledWith({ query: 'mastra' }, expect.objectContaining({ actor: resumeActor }));
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('forwards MCP protocol context from the run registry', async () => {
    const runId = 'durable-tool-mcp-run';
    const execute = vi.fn().mockResolvedValue('ok');
    const mcp: MCPToolExecutionContext = {
      extra: {
        signal: new AbortController().signal,
        requestId: 'request-1',
        sendNotification: vi.fn(),
        sendRequest: vi.fn(),
      },
      elicitation: { sendRequest: vi.fn() },
    };
    globalRunRegistry.set(runId, { tools: { secureTool: { execute } }, mcp } as any);

    try {
      await (createDurableToolCallStep() as any).execute({
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
      });

      expect(execute).toHaveBeenCalledWith({ query: 'mastra' }, expect.objectContaining({ mcp }));
    } finally {
      globalRunRegistry.delete(runId);
    }
  });
});

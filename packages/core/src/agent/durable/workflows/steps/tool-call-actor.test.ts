import { describe, expect, it, vi } from 'vitest';
import { globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', () => ({
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

describe('durable tool-call actor forwarding', () => {
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
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent, emitSuspendedEvent } from '../../stream-adapter';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async () => ({
  restoreRequestContext: (
    await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')
  ).restoreRequestContext,
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'outer-run';
const TOOL_CALL_ID = 'outer-tool-call';
const OUTER_TOOL_NAME = 'agent-billing';
const OUTER_ARGS = { prompt: 'Charge the customer' };
const INNER_APPROVAL = {
  toolCallId: 'inner-tool-call',
  toolName: 'charge-card',
  args: { amountCents: 500 },
};

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable agent-as-tool nested approval details', () => {
  it('emits inner tool details while preserving the outer tool call id for resume', async () => {
    const suspend = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn(async (_args: unknown, options: any) => {
      await options.suspend(
        { requireToolApproval: INNER_APPROVAL },
        { requireToolApproval: true, runId: 'inner-run', isAgentSuspend: true },
      );
    });
    globalRunRegistry.set(RUN_ID, { tools: { [OUTER_TOOL_NAME]: { execute } } } as any);

    await (createDurableToolCallStep() as any).execute({
      inputData: { toolCallId: TOOL_CALL_ID, toolName: OUTER_TOOL_NAME, args: OUTER_ARGS },
      mastra: { getLogger: () => undefined },
      suspend,
      requestContext: new Map(),
      getInitData: () => ({ runId: RUN_ID, agentId: 'supervisor', options: {}, state: {} }),
      [PUBSUB_SYMBOL]: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() },
    });

    expect(emitChunkEvent).toHaveBeenCalledWith(
      expect.anything(),
      RUN_ID,
      expect.objectContaining({
        type: 'tool-call-approval',
        payload: expect.objectContaining({
          toolCallId: TOOL_CALL_ID,
          toolName: INNER_APPROVAL.toolName,
          args: INNER_APPROVAL.args,
        }),
      }),
    );
    expect(emitSuspendedEvent).toHaveBeenCalledWith(
      expect.anything(),
      RUN_ID,
      expect.objectContaining({
        toolCallId: TOOL_CALL_ID,
        toolName: INNER_APPROVAL.toolName,
        args: INNER_APPROVAL.args,
        type: 'approval',
      }),
    );
    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        requireToolApproval: {
          toolCallId: TOOL_CALL_ID,
          toolName: INNER_APPROVAL.toolName,
          args: INNER_APPROVAL.args,
        },
        suspendedToolRunId: 'inner-run',
      }),
      { resumeLabel: TOOL_CALL_ID },
    );
  });
});

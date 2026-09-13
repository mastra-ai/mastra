import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
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

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'outer-run';
const TOOL_CALL_ID = 'outer-tool-call';
const OUTER_TOOL_NAME = 'workflow-billing';
const INNER_RUN_ID = 'inner-suspended-run';

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

async function runDurableToolCall(
  args: Record<string, unknown>,
  execute: ReturnType<typeof vi.fn>,
  extra: object = {},
) {
  globalRunRegistry.set(RUN_ID, { tools: { [OUTER_TOOL_NAME]: { execute } } } as any);
  const suspend = vi.fn().mockResolvedValue(undefined);

  await (createDurableToolCallStep() as any).execute({
    inputData: { toolCallId: TOOL_CALL_ID, toolName: OUTER_TOOL_NAME, args },
    mastra: { getLogger: () => undefined },
    suspend,
    requestContext: new Map(),
    getInitData: () => ({ runId: RUN_ID, agentId: 'supervisor', options: {}, state: {} }),
    [PUBSUB_SYMBOL]: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() },
    ...extra,
  });

  return { suspend, execute };
}

describe('durable workflow-tool suspendedToolRunId', () => {
  it('lets the framework-resolved run id win over a model sentinel', async () => {
    const execute = vi.fn(async () => ({ ok: true }));

    await runDurableToolCall({ prompt: 'charge', suspendedToolRunId: 'null' }, execute, {
      resumeData: { approved: true },
      suspendData: { suspendedToolRunId: INNER_RUN_ID },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0]).toMatchObject({ suspendedToolRunId: INNER_RUN_ID });
  });

  it('drops a sentinel when no framework run id resolves', async () => {
    const execute = vi.fn(async () => ({ ok: true }));

    await runDurableToolCall({ prompt: 'charge', suspendedToolRunId: 'null' }, execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0]).not.toHaveProperty('suspendedToolRunId');
  });
});

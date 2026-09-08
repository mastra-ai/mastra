import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRunRegistryActivityForTests, globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async () => ({
  restoreRequestContext: (
    await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')
  ).restoreRequestContext,
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

describe('durable tool-call registry keep-alive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    __resetRunRegistryActivityForTests();
    globalRunRegistry.clear();
    vi.useRealTimers();
  });

  it('holds the run active only while tool execution is pending', async () => {
    const runId = 'durable-tool-keep-alive-run';
    let resolveTool!: (value: string) => void;
    const execute = vi.fn(
      () =>
        new Promise<string>(resolve => {
          resolveTool = resolve;
        }),
    );
    globalRunRegistry.set(runId, { tools: { slowTool: { execute } } } as any);

    const timerCountBeforeExecution = vi.getTimerCount();
    const execution = (createDurableToolCallStep() as any).execute({
      inputData: {
        toolCallId: 'call-1',
        toolName: 'slowTool',
        args: {},
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

    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(vi.getTimerCount()).toBeGreaterThan(timerCountBeforeExecution);

    resolveTool('done');
    await execution;

    expect(vi.getTimerCount()).toBe(timerCountBeforeExecution);
  });
});

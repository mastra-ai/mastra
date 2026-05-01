import { describe, expect, it, vi } from 'vitest';
import { createBackgroundTaskCheckStep } from './background-task-check-step';

function makeRunningTask(id: string) {
  return {
    id,
    toolName: 'dummy',
    toolCallId: id,
    runId: 'run-1',
    agentId: 'a1',
    status: 'running' as const,
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 1000,
    createdAt: new Date(),
    args: {},
  };
}

function baseInput() {
  return {
    stepResult: { isContinued: false },
    output: { text: '', toolCalls: [], toolResults: [] },
  };
}

function makeParams({
  skipBgTaskWait,
  waitTimeoutMs,
  runningTasks = [makeRunningTask('t1')],
}: {
  skipBgTaskWait?: boolean;
  waitTimeoutMs?: number;
  runningTasks?: ReturnType<typeof makeRunningTask>[];
}) {
  const listTasks = vi.fn(async () => ({ tasks: runningTasks, total: runningTasks.length }));
  const waitForNextTask = vi.fn(async () => runningTasks[0]);

  const bgManager = { listTasks, waitForNextTask } as any;

  return {
    params: {
      agentId: 'a1',
      runId: 'run-1',
      controller: { enqueue: vi.fn() } as any,
      _internal: {
        backgroundTaskManager: bgManager,
        skipBgTaskWait,
        agentBackgroundConfig: waitTimeoutMs ? { waitTimeoutMs } : undefined,
      },
    } as any,
    listTasks,
    waitForNextTask,
  };
}

describe('backgroundTaskCheckStep', () => {
  it('passes through unchanged when no manager is configured', async () => {
    const step = createBackgroundTaskCheckStep({
      agentId: 'a1',
      runId: 'run-1',
      controller: { enqueue: vi.fn() } as any,
      _internal: {},
    } as any);

    const input = baseInput();
    const result = await (step as any).execute({ inputData: input, retryCount: 0 });

    expect(result).toBe(input);
  });

  it('passes through unchanged when there are no running tasks', async () => {
    const { params, waitForNextTask } = makeParams({ runningTasks: [] });
    const step = createBackgroundTaskCheckStep(params);

    const input = baseInput();
    const result = await (step as any).execute({ inputData: input, retryCount: 0 });

    expect(result).toBe(input);
    expect(waitForNextTask).not.toHaveBeenCalled();
  });

  it('skips the in-loop wait when _skipBgTaskWait is set and flags pending', async () => {
    const { params, waitForNextTask } = makeParams({
      skipBgTaskWait: true,
      waitTimeoutMs: 60_000,
    });
    const step = createBackgroundTaskCheckStep(params);

    // retryCount > 0 and waitTimeoutMs set would normally trigger a wait.
    const result = await (step as any).execute({ inputData: baseInput(), retryCount: 1 });

    expect(waitForNextTask).not.toHaveBeenCalled();
    expect(result.backgroundTaskPending).toBe(true);
  });

  it('flags pending without waiting on first invocation (retryCount=0)', async () => {
    const { params, waitForNextTask } = makeParams({ waitTimeoutMs: 60_000 });
    const step = createBackgroundTaskCheckStep(params);

    const result = await (step as any).execute({ inputData: baseInput(), retryCount: 0 });

    expect(waitForNextTask).not.toHaveBeenCalled();
    expect(result.backgroundTaskPending).toBe(true);
  });

  it('waits for next task when retryCount > 0 and a wait timeout is configured', async () => {
    const { params, waitForNextTask } = makeParams({ waitTimeoutMs: 60_000 });
    const step = createBackgroundTaskCheckStep(params);

    const result = await (step as any).execute({ inputData: baseInput(), retryCount: 1 });

    expect(waitForNextTask).toHaveBeenCalledTimes(1);
    expect(result.backgroundTaskPending).toBe(true);
    expect(result.stepResult.isContinued).toBe(true);
  });
});

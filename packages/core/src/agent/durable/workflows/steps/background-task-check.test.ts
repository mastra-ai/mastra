import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalRunRegistry } from '../../run-registry';
import { createDurableBackgroundTaskCheckStep } from './background-task-check';

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

function setupRegistry({
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

  const bgManager = { listTasks, waitForNextTask, config: {} } as any;

  const runId = 'run-1';
  const agentId = 'a1';

  globalRunRegistry.set(runId, {
    backgroundTaskManager: bgManager,
    backgroundTasksConfig: waitTimeoutMs ? { waitTimeoutMs } : undefined,
    tools: {},
    model: {} as any,
  } as any);

  const getInitData = () => ({
    runId,
    agentId,
    options: skipBgTaskWait ? { skipBgTaskWait } : undefined,
    state: { threadId: 'thread-1', resourceId: 'user-1' },
  });

  return { listTasks, waitForNextTask, getInitData, runId };
}

afterEach(() => {
  globalRunRegistry.delete('run-1');
});

describe('createDurableBackgroundTaskCheckStep', () => {
  it('passes through unchanged when no manager is configured', async () => {
    const runId = 'run-no-mgr';
    globalRunRegistry.set(runId, { tools: {}, model: {} as any } as any);

    const step = createDurableBackgroundTaskCheckStep();
    const input = baseInput();
    const result = await (step as any).execute({
      inputData: input,
      retryCount: 0,
      getInitData: () => ({ runId, agentId: 'a1' }),
    });

    expect(result).toBe(input);
    globalRunRegistry.delete(runId);
  });

  it('passes through unchanged when there are no running tasks', async () => {
    const { waitForNextTask, getInitData } = setupRegistry({ runningTasks: [] });
    const step = createDurableBackgroundTaskCheckStep();

    const input = baseInput();
    const result = await (step as any).execute({
      inputData: input,
      retryCount: 0,
      getInitData,
    });

    expect(result).toBe(input);
    expect(waitForNextTask).not.toHaveBeenCalled();
  });

  it('skips the in-loop wait when skipBgTaskWait is set and flags pending', async () => {
    const { waitForNextTask, getInitData } = setupRegistry({
      skipBgTaskWait: true,
      waitTimeoutMs: 60_000,
    });
    const step = createDurableBackgroundTaskCheckStep();

    const result = await (step as any).execute({
      inputData: baseInput(),
      retryCount: 1,
      getInitData,
    });

    expect(waitForNextTask).not.toHaveBeenCalled();
    expect(result.backgroundTaskPending).toBe(true);
  });

  it('flags pending without waiting on first invocation (retryCount=0)', async () => {
    const { waitForNextTask, getInitData } = setupRegistry({ waitTimeoutMs: 60_000 });
    const step = createDurableBackgroundTaskCheckStep();

    const result = await (step as any).execute({
      inputData: baseInput(),
      retryCount: 0,
      getInitData,
    });

    expect(waitForNextTask).not.toHaveBeenCalled();
    expect(result.backgroundTaskPending).toBe(true);
  });

  it('waits for next task when retryCount > 0 and a wait timeout is configured', async () => {
    const { waitForNextTask, getInitData } = setupRegistry({ waitTimeoutMs: 60_000 });
    const step = createDurableBackgroundTaskCheckStep();

    const result = await (step as any).execute({
      inputData: baseInput(),
      retryCount: 1,
      getInitData,
    });

    expect(waitForNextTask).toHaveBeenCalledTimes(1);
    expect(result.backgroundTaskPending).toBe(true);
    expect(result.stepResult.isContinued).toBe(true);
  });
});

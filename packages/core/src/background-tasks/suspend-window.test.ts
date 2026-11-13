import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import type { BackgroundTaskManager } from './manager';
import type { BackgroundTask, ToolExecutor } from './types';
import { BACKGROUND_TASK_WORKFLOW_ID } from './workflow-id';

// #30226: a background task was stored as `suspended` and ran its suspend hooks
// (in an agent run, they write the deferred call's open request to the message
// list) before its workflow run had suspended, so a shutdown or crash in that
// window lost the task. These tests hold a task while it is being stored as
// suspended or running its suspend hooks, then shut down, crash, or answer it.

type Approval = ToolExecutor & { calls: unknown[]; abortSignal?: AbortSignal };

/** A background tool that asks once for approval and finishes when it is answered. */
function approvalTool(): Approval {
  const tool: Approval = {
    calls: [],
    execute: async (_args, options) => {
      tool.calls.push(options.resumeData);
      if (options.resumeData !== undefined) return `ran with ${JSON.stringify(options.resumeData)}`;
      tool.abortSignal = options.abortSignal;
      await options.suspend?.({ question: 'Approve?' });
    },
  };
  return tool;
}

/**
 * Holds the task inside its suspend hooks, right after it is stored as
 * `suspended`. Resolves once there; the hook finishes when `until()` does.
 */
function holdSuspendHook(manager: BackgroundTaskManager, until: () => Promise<unknown>): Promise<void> {
  let reached!: () => void;
  const held = new Promise<void>(resolve => (reached = resolve));
  const runHooks = manager.runLocalSuspendHooks.bind(manager);
  manager.runLocalSuspendHooks = async (task: BackgroundTask) => {
    await runHooks(task);
    reached();
    await until();
  };
  return held;
}

/**
 * Resolves when shutdown aborts the tool, as it did to a task in this window
 * before the fix, or 200 ms after shutdown starts if it never does.
 */
function shutdownReaches(tool: Approval, shutdownStarted: Promise<void>): Promise<void> {
  return new Promise(resolve => {
    tool.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
    void shutdownStarted.then(() => setTimeout(resolve, 200));
  });
}

const mastras: Mastra[] = [];

function start(storage: InMemoryStore, tool: Approval): Mastra {
  const mastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
  mastra.backgroundTaskManager!.registerStaticExecutor('approval', tool);
  mastras.push(mastra);
  return mastra;
}

const payload = (id: string) => ({
  toolName: 'approval',
  toolCallId: id,
  agentId: 'agent',
  runId: id,
  args: {},
  maxRetries: 0,
});

async function restartedStorageTask(storage: InMemoryStore, taskId: string): Promise<BackgroundTask | null> {
  return (await storage.getStore('backgroundTasks'))!.getTask(taskId);
}

async function settled(manager: BackgroundTaskManager, taskId: string): Promise<BackgroundTask> {
  let task: BackgroundTask | null = null;
  await vi.waitFor(
    async () => {
      task = await manager.getTask(taskId);
      expect(task?.status).toMatch(/^(completed|failed|cancelled|timed_out)$/);
    },
    { timeout: 5000, interval: 20 },
  );
  return task!;
}

afterEach(async () => {
  await Promise.allSettled(mastras.splice(0).map(mastra => mastra.shutdown()));
});

describe('a background task that has just suspended (#30226)', () => {
  it('stays suspended through a graceful shutdown and is answered after the restart', async () => {
    const storage = new InMemoryStore();
    const first = approvalTool();
    const mastra = start(storage, first);
    const manager = mastra.backgroundTaskManager!;
    let shutdownStarted!: () => void;
    const started = new Promise<void>(resolve => (shutdownStarted = resolve));
    const held = holdSuspendHook(manager, () => shutdownReaches(first, started));
    const { task } = await manager.enqueue(payload('shutdown'));
    await held;
    expect((await manager.getTask(task.id))?.status).toBe('suspended');

    const stopping = mastra.shutdown({ drainTimeout: 2000 });
    shutdownStarted();
    await stopping;

    const stored = await (await storage.getStore('backgroundTasks'))!.getTask(task.id);
    expect(stored?.status).toBe('suspended');
    expect(stored?.suspendPayload).toEqual({ question: 'Approve?' });

    const second = approvalTool();
    const restarted = start(storage, second).backgroundTaskManager!;
    await restarted.resume(task.id, { approved: true });
    const done = await settled(restarted, task.id);
    expect(done.status).toBe('completed');
    expect(done.result).toBe('ran with {"approved":true}');
    expect(second.calls).toEqual([{ approved: true }]);
  });

  it('stays resumable when shutdown starts while the task is being stored as suspended', async () => {
    const storage = new InMemoryStore();
    const tool = approvalTool();
    const mastra = start(storage, tool);
    const manager = mastra.backgroundTaskManager!;
    const tasks = (await storage.getStore('backgroundTasks'))!;

    // Hold the write that stores the task as suspended until shutdown reaches it.
    let suspendWriteReached!: () => void;
    const suspendWriteHeld = new Promise<void>(resolve => (suspendWriteReached = resolve));
    let shutdownStarted!: () => void;
    const started = new Promise<void>(resolve => (shutdownStarted = resolve));
    const updateTask = tasks.updateTask.bind(tasks);
    tasks.updateTask = async (taskId, update, options) => {
      if (update.status === 'suspended') {
        suspendWriteReached();
        await shutdownReaches(tool, started);
      }
      return updateTask(taskId, update, options);
    };

    const { task } = await manager.enqueue(payload('race'));
    await suspendWriteHeld;

    const stopping = mastra.shutdown({ drainTimeout: 2000 });
    shutdownStarted();
    await stopping;
    tasks.updateTask = updateTask;

    expect((await tasks.getTask(task.id))?.status).toBe('suspended');
    const second = approvalTool();
    const restarted = start(storage, second).backgroundTaskManager!;
    await restarted.resume(task.id, { approved: true });
    const done = await settled(restarted, task.id);
    expect(done.status).toBe('completed');
    expect(second.calls).toEqual([{ approved: true }]);
  });

  it('keeps the question of a tool that is aborted by shutdown after it asked', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(mastra);
    const manager = mastra.backgroundTaskManager!;
    let asked!: () => void;
    const hasAsked = new Promise<void>(resolve => (asked = resolve));
    manager.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        await options.suspend?.({ question: 'Approve?' });
        asked();
        // Still finishing up when shutdown aborts it.
        await new Promise(resolve => options.abortSignal?.addEventListener('abort', resolve, { once: true }));
        throw new Error('aborted');
      },
    });

    const { task } = await manager.enqueue(payload('asked-then-aborted'));
    await hasAsked;
    await mastra.shutdown({ drainTimeout: 2000 });

    const stored = await restartedStorageTask(storage, task.id);
    expect(stored?.status).toBe('suspended');
    expect(stored?.suspendPayload).toEqual({ question: 'Approve?' });
    const second = approvalTool();
    const restarted = start(storage, second).backgroundTaskManager!;
    await restarted.resume(task.id, { approved: true });
    expect((await settled(restarted, task.id)).status).toBe('completed');
    expect(second.calls).toEqual([{ approved: true }]);
  });

  it('keeps a suspension that lands while shutdown is cancelling the task', async () => {
    // Shutdown cancels a running task without retries. If the tool suspends at
    // that moment and the suspension is stored first, the task must stay suspended.
    const storage = new InMemoryStore();
    const mastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(mastra);
    const manager = mastra.backgroundTaskManager!;
    manager.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        if (options.resumeData !== undefined) return `ran with ${JSON.stringify(options.resumeData)}`;
        await new Promise(resolve => options.abortSignal?.addEventListener('abort', resolve, { once: true }));
        await options.suspend?.({ question: 'Approve?' });
      },
    });
    const tasks = (await storage.getStore('backgroundTasks'))!;
    // Hold shutdown's cancel write until the suspension has been stored.
    let suspensionStored!: () => void;
    const stored = new Promise<void>(resolve => (suspensionStored = resolve));
    const updateTask = tasks.updateTask.bind(tasks);
    tasks.updateTask = async (taskId, update, options) => {
      if (update.status === 'cancelled') await stored;
      const updated = await updateTask(taskId, update, options);
      if (update.status === 'suspended' && updated) suspensionStored();
      return updated;
    };

    const { task } = await manager.enqueue(payload('cancel-race'));
    await vi.waitFor(async () => expect((await tasks.getTask(task.id))?.status).toBe('running'));
    await mastra.shutdown({ drainTimeout: 2000 });
    tasks.updateTask = updateTask;

    expect((await tasks.getTask(task.id))?.status).toBe('suspended');
    const second = approvalTool();
    const restarted = start(storage, second).backgroundTaskManager!;
    await restarted.resume(task.id, { approved: true });
    expect((await settled(restarted, task.id)).status).toBe('completed');
    expect(second.calls).toEqual([{ approved: true }]);
  });

  it('keeps the run of a worker that took the task over when the first worker suspends late', async () => {
    const storage = new InMemoryStore();
    const tasks = (await storage.getStore('backgroundTasks'))!;
    // Hold the first worker's write that stores the suspension.
    let firstWriteReached!: () => void;
    const firstWriteHeld = new Promise<void>(resolve => (firstWriteReached = resolve));
    let releaseFirstWrite!: () => void;
    const firstWriteGate = new Promise<void>(resolve => (releaseFirstWrite = resolve));
    let firstWriteDone!: Promise<boolean>;
    let heldOne = false;
    const updateTask = tasks.updateTask.bind(tasks);
    tasks.updateTask = async (taskId, update, options) => {
      if (update.status === 'suspended' && !heldOne) {
        heldOne = true;
        firstWriteReached();
        firstWriteDone = firstWriteGate.then(() => updateTask(taskId, update, options));
        return firstWriteDone;
      }
      return updateTask(taskId, update, options);
    };

    const first = start(storage, approvalTool()).backgroundTaskManager!;
    const { task } = await first.enqueue(payload('takeover'));
    await firstWriteHeld;

    // Another worker takes the task over and suspends it with its own run.
    const tool = approvalTool();
    const second = start(storage, tool).backgroundTaskManager!;
    await second.restart(task.id);
    await vi.waitFor(async () => expect((await tasks.getTask(task.id))?.status).toBe('suspended'), {
      timeout: 5000,
      interval: 20,
    });

    releaseFirstWrite();
    expect(await firstWriteDone).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 50));

    await second.resume(task.id, { approved: true });
    const done = await settled(second, task.id);
    expect(done.status).toBe('completed');
    expect(tool.calls).toEqual([undefined, { approved: true }]);
  });

  it('keeps the run of a worker that took the task over when the first worker fails to store its suspension', async () => {
    const storage = new InMemoryStore();
    const tasks = (await storage.getStore('backgroundTasks'))!;
    // The first worker's suspension write is held, then fails.
    let firstWriteReached!: () => void;
    const firstWriteHeld = new Promise<void>(resolve => (firstWriteReached = resolve));
    let failFirstWrite!: () => void;
    const firstWriteGate = new Promise<void>(resolve => (failFirstWrite = resolve));
    let heldOne = false;
    const updateTask = tasks.updateTask.bind(tasks);
    tasks.updateTask = async (taskId, update, options) => {
      if (update.status === 'suspended' && !heldOne) {
        heldOne = true;
        firstWriteReached();
        await firstWriteGate;
        throw new Error('storage unavailable');
      }
      return updateTask(taskId, update, options);
    };

    const first = start(storage, approvalTool()).backgroundTaskManager!;
    const { task } = await first.enqueue(payload('takeover-write-fails'));
    await firstWriteHeld;

    const second = start(storage, approvalTool()).backgroundTaskManager!;
    await second.restart(task.id);
    await vi.waitFor(async () => expect((await tasks.getTask(task.id))?.status).toBe('suspended'), {
      timeout: 5000,
      interval: 20,
    });

    failFirstWrite();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect((await tasks.getTask(task.id))?.status).toBe('suspended');

    // A third worker answers it.
    const tool = approvalTool();
    const third = start(storage, tool).backgroundTaskManager!;
    await third.resume(task.id, { approved: true });
    expect((await settled(third, task.id)).status).toBe('completed');
    expect(tool.calls).toEqual([{ approved: true }]);
  });

  it('stays resumable when shutdown reads the task while its suspension is being stored', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(mastra);
    const manager = mastra.backgroundTaskManager!;
    let asked!: () => void;
    const hasAsked = new Promise<void>(resolve => (asked = resolve));
    manager.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        await options.suspend?.({ question: 'Approve?' });
        asked();
        await new Promise(resolve => options.abortSignal?.addEventListener('abort', resolve, { once: true }));
      },
    });
    const tasks = (await storage.getStore('backgroundTasks'))!;
    // Hold the write that stores the suspension, and make shutdown's cancel read
    // the task only once that write is in flight.
    let writeReached!: () => void;
    const writeHeld = new Promise<void>(resolve => (writeReached = resolve));
    let cancelRead!: () => void;
    const cancelHasRead = new Promise<void>(resolve => (cancelRead = resolve));
    const updateTask = tasks.updateTask.bind(tasks);
    const getTask = tasks.getTask.bind(tasks);
    tasks.updateTask = async (taskId, update, options) => {
      if (update.status === 'suspended') {
        writeReached();
        await Promise.race([cancelHasRead, new Promise(resolve => setTimeout(resolve, 500))]);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      return updateTask(taskId, update, options);
    };
    tasks.getTask = async taskId => {
      if (/cancel/i.test(new Error().stack ?? '')) {
        await Promise.race([writeHeld, new Promise(resolve => setTimeout(resolve, 500))]);
        const task = await getTask(taskId);
        cancelRead();
        return task;
      }
      return getTask(taskId);
    };

    const { task } = await manager.enqueue(payload('cancel-reads-late'));
    await hasAsked;
    await mastra.shutdown({ drainTimeout: 2000 });
    tasks.updateTask = updateTask;
    tasks.getTask = getTask;

    expect((await tasks.getTask(task.id))?.status).toBe('suspended');
    const second = approvalTool();
    const restarted = start(storage, second).backgroundTaskManager!;
    await restarted.resume(task.id, { approved: true });
    expect((await settled(restarted, task.id)).status).toBe('completed');
  });

  it('keeps the question of a worker that took the task over when the first worker suspends late', async () => {
    const storage = new InMemoryStore();
    const tasks = (await storage.getStore('backgroundTasks'))!;
    let firstAsked!: () => void;
    const firstHasAsked = new Promise<void>(resolve => (firstAsked = resolve));
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>(resolve => (releaseFirst = resolve));
    const first = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(first);
    first.backgroundTaskManager!.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        await options.suspend?.({ question: 'Asked by the first worker' });
        firstAsked();
        await firstReleased;
      },
    });
    const { task } = await first.backgroundTaskManager!.enqueue(payload('takeover-late-suspend'));
    await firstHasAsked;

    const answered: unknown[] = [];
    const second = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(second);
    second.backgroundTaskManager!.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        if (options.resumeData !== undefined) {
          answered.push(options.suspendPayload);
          return 'done';
        }
        await options.suspend?.({ question: 'Asked by the second worker' });
      },
    });
    await second.backgroundTaskManager!.restart(task.id);
    await vi.waitFor(async () => expect((await tasks.getTask(task.id))?.status).toBe('suspended'), {
      timeout: 5000,
      interval: 20,
    });

    releaseFirst();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect((await tasks.getTask(task.id))?.suspendPayload).toEqual({ question: 'Asked by the second worker' });
    await second.backgroundTaskManager!.resume(task.id, { approved: true });

    expect((await settled(second.backgroundTaskManager!, task.id)).status).toBe('completed');
    expect(answered).toEqual([{ question: 'Asked by the second worker' }]);
  });

  it('is answered once after a crash, without running the tool from the start again', async () => {
    const storage = new InMemoryStore();
    const crashedTool = approvalTool();
    const crashed = start(storage, crashedTool);
    // The hook never finishes: this instance "dies" here and writes nothing more.
    const held = holdSuspendHook(crashed.backgroundTaskManager!, () => new Promise(() => {}));
    const { task } = await crashed.backgroundTaskManager!.enqueue(payload('crash'));
    await held;
    mastras.splice(mastras.indexOf(crashed), 1);

    const tool = approvalTool();
    const restarted = start(storage, tool).backgroundTaskManager!;
    expect((await restarted.getTask(task.id))?.status).toBe('suspended');
    await restarted.resume(task.id, { approved: true });
    const done = await settled(restarted, task.id);

    expect(done.status).toBe('completed');
    expect(done.result).toBe('ran with {"approved":true}');
    expect(crashedTool.calls).toEqual([undefined]);
    expect(tool.calls).toEqual([{ approved: true }]);
  });

  it('asks its next question normally after being answered following a crash', async () => {
    const storage = new InMemoryStore();
    const crashed = start(storage, approvalTool());
    const held = holdSuspendHook(crashed.backgroundTaskManager!, () => new Promise(() => {}));
    const { task } = await crashed.backgroundTaskManager!.enqueue(payload('two-questions'));
    await held;
    mastras.splice(mastras.indexOf(crashed), 1);

    // After the first answer, the tool asks a second question.
    const calls: Array<{ resumeData: unknown; suspendPayload: unknown }> = [];
    const restarted = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(restarted);
    const manager = restarted.backgroundTaskManager!;
    manager.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        calls.push({ resumeData: options.resumeData, suspendPayload: options.suspendPayload });
        if (options.suspendPayload && (options.suspendPayload as { question: string }).question === 'Approve?') {
          await options.suspend?.({ question: 'Are you sure?' });
          return;
        }
        return `confirmed with ${JSON.stringify(options.resumeData)}`;
      },
    });

    await manager.resume(task.id, { approved: true });
    await vi.waitFor(
      async () => expect((await manager.getTask(task.id))?.suspendPayload).toEqual({ question: 'Are you sure?' }),
      { timeout: 5000, interval: 20 },
    );
    await manager.resume(task.id, { sure: true });
    const done = await settled(manager, task.id);

    expect(done.status).toBe('completed');
    expect(done.result).toBe('confirmed with {"sure":true}');
    expect(calls).toEqual([
      { resumeData: { approved: true }, suspendPayload: { question: 'Approve?' } },
      { resumeData: { sure: true }, suspendPayload: { question: 'Are you sure?' } },
    ]);
  });

  it('resumes the same sub-agent run after a crash when a delegated agent asked the question', async () => {
    // Agent-as-tool delegations suspend with the sub-agent's run id in the
    // suspend options; only the run's snapshot carries it, not the task row.
    const storage = new InMemoryStore();
    const delegate = (seen: unknown[]): ToolExecutor => ({
      execute: async (_args, options) => {
        seen.push({ resumeData: options.resumeData, suspendedToolRunId: options.suspendedToolRunId });
        if (options.resumeData !== undefined) return 'sub-agent finished';
        await options.suspend?.({ question: 'Approve?' }, { isAgentSuspend: true, runId: 'sub-agent-run-1' });
      },
    });
    const crashed = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    crashed.backgroundTaskManager!.registerStaticExecutor('approval', delegate([]));
    const held = holdSuspendHook(crashed.backgroundTaskManager!, () => new Promise(() => {}));
    const { task } = await crashed.backgroundTaskManager!.enqueue(payload('delegated'));
    await held;

    const seen: unknown[] = [];
    const restarted = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(restarted);
    restarted.backgroundTaskManager!.registerStaticExecutor('approval', delegate(seen));
    await restarted.backgroundTaskManager!.resume(task.id, { approved: true });
    const done = await settled(restarted.backgroundTaskManager!, task.id);

    expect(done.status).toBe('completed');
    expect(seen).toEqual([{ resumeData: { approved: true }, suspendedToolRunId: 'sub-agent-run-1' }]);
  });

  it('leaves a task answered on another worker alone when the first worker finishes suspending late', async () => {
    const storage = new InMemoryStore();
    const first = start(storage, approvalTool());
    let finishHook!: () => void;
    const held = holdSuspendHook(
      first.backgroundTaskManager!,
      () => new Promise<void>(resolve => (finishHook = resolve)),
    );
    const { task } = await first.backgroundTaskManager!.enqueue(payload('two-workers'));
    await held;

    const calls: Array<{ resumeData: unknown; suspendPayload: unknown }> = [];
    const second = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true } });
    mastras.push(second);
    const manager = second.backgroundTaskManager!;
    manager.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        calls.push({ resumeData: options.resumeData, suspendPayload: options.suspendPayload });
        if ((options.suspendPayload as { question?: string } | undefined)?.question === 'Approve?') {
          await options.suspend?.({ question: 'Are you sure?' });
          return;
        }
        return 'confirmed';
      },
    });
    await manager.resume(task.id, { approved: true });
    await vi.waitFor(
      async () => expect((await manager.getTask(task.id))?.suspendPayload).toEqual({ question: 'Are you sure?' }),
      { timeout: 5000, interval: 20 },
    );

    // The first worker's suspend hooks finish only now.
    finishHook();
    await new Promise(resolve => setTimeout(resolve, 50));
    await manager.resume(task.id, { sure: true });
    const done = await settled(manager, task.id);

    expect(done.status).toBe('completed');
    expect(calls).toEqual([
      { resumeData: { approved: true }, suspendPayload: { question: 'Approve?' } },
      { resumeData: { sure: true }, suspendPayload: { question: 'Are you sure?' } },
    ]);
  });

  it('is answered when the answer arrives while the suspend hooks still run', async () => {
    const storage = new InMemoryStore();
    const tool = approvalTool();
    const manager = start(storage, tool).backgroundTaskManager!;
    let finishHook!: () => void;
    const held = holdSuspendHook(manager, () => new Promise<void>(resolve => (finishHook = resolve)));
    const { task } = await manager.enqueue(payload('answered-early'));
    await held;

    // A client answers the open request the hook just recorded.
    await manager.resume(task.id, { approved: true });
    finishHook();
    const done = await settled(manager, task.id);

    expect(done.status).toBe('completed');
    expect(done.result).toBe('ran with {"approved":true}');
    expect(tool.calls).toEqual([undefined, { approved: true }]);
  });

  it('keeps the lease and slot of a task answered while its suspend hooks run, even if they outlast the lease', async () => {
    // The run that suspended finishes its hooks after the resumed run has
    // claimed the task; its cleanup must not drop the resumed run's lease or slot.
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true, leaseDurationMs: 3000, globalConcurrency: 1, perAgentConcurrency: 1 },
    });
    mastras.push(mastra);
    const manager = mastra.backgroundTaskManager!;
    let finishWork!: () => void;
    const workDone = new Promise<void>(resolve => (finishWork = resolve));
    const started: string[] = [];
    const approval: ToolExecutor = {
      execute: async (_args, options) => {
        if (options.resumeData === undefined) {
          await options.suspend?.({ question: 'Approve?' });
          return;
        }
        started.push('approval resumed');
        await workDone;
        return 'done';
      },
    };
    let finishHook!: () => void;
    const held = holdSuspendHook(manager, () => new Promise<void>(resolve => (finishHook = resolve)));
    const { task } = await manager.enqueue(payload('lease'), { executor: approval });
    await held;

    await manager.resume(task.id, { approved: true });
    await vi.waitFor(() => expect(started).toEqual(['approval resumed']), { timeout: 5000, interval: 20 });
    await new Promise(resolve => setTimeout(resolve, 3500));
    finishHook();
    await new Promise(resolve => setTimeout(resolve, 50));

    // The heartbeat (every second) still renews the resumed run's lease...
    const leaseAfterHooks = (await manager.getTask(task.id))!.leaseExpiresAt!.getTime();
    await vi.waitFor(
      async () => expect((await manager.getTask(task.id))!.leaseExpiresAt!.getTime()).toBeGreaterThan(leaseAfterHooks),
      { timeout: 2500, interval: 100 },
    );
    // ...and it still holds the only slot.
    const { task: queued } = await manager.enqueue(
      { ...payload('queued'), toolName: 'other' },
      { executor: { execute: async () => started.push('other') } },
    );
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(started).toEqual(['approval resumed']);

    finishWork();
    expect((await settled(manager, task.id)).status).toBe('completed');
    expect((await settled(manager, queued.id)).status).toBe('completed');
  }, 15000);

  it('keeps the concurrency limit for a task answered while its suspend hooks still run', async () => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true, globalConcurrency: 1, perAgentConcurrency: 1 },
    });
    mastras.push(mastra);
    const manager = mastra.backgroundTaskManager!;
    let finishWork!: () => void;
    const workDone = new Promise<void>(resolve => (finishWork = resolve));
    const started: string[] = [];
    const approval: ToolExecutor = {
      execute: async (_args, options) => {
        if (options.resumeData === undefined) {
          await options.suspend?.({ question: 'Approve?' });
          return;
        }
        started.push('approval resumed');
        await workDone;
        return 'done';
      },
    };
    const other: ToolExecutor = {
      execute: async () => {
        started.push('other');
        return 'done';
      },
    };
    let finishHook!: () => void;
    const held = holdSuspendHook(manager, () => new Promise<void>(resolve => (finishHook = resolve)));
    const { task } = await manager.enqueue(payload('limited'), { executor: approval });
    await held;

    await manager.resume(task.id, { approved: true });
    finishHook();
    await vi.waitFor(() => expect(started).toEqual(['approval resumed']), { timeout: 5000, interval: 20 });
    const { task: queued } = await manager.enqueue({ ...payload('queued'), toolName: 'other' }, { executor: other });
    await new Promise(resolve => setTimeout(resolve, 100));

    // The resumed task holds the only slot, so the other one waits for it.
    expect(started).toEqual(['approval resumed']);
    finishWork();
    expect((await settled(manager, task.id)).status).toBe('completed');
    expect((await settled(manager, queued.id)).status).toBe('completed');
    expect(started).toEqual(['approval resumed', 'other']);
  });

  it('is answered promptly under a concurrency limit of one when nothing else runs', async () => {
    const storage = new InMemoryStore();
    const tool = approvalTool();
    const mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true, globalConcurrency: 1, perAgentConcurrency: 1 },
    });
    mastras.push(mastra);
    const manager = mastra.backgroundTaskManager!;
    manager.registerStaticExecutor('approval', tool);
    let finishHook!: () => void;
    const held = holdSuspendHook(manager, () => new Promise<void>(resolve => (finishHook = resolve)));
    const { task } = await manager.enqueue(payload('only-task'));
    await held;

    await manager.resume(task.id, { approved: true });
    finishHook();
    await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('completed'), {
      timeout: 1000,
      interval: 20,
    });
    expect(tool.calls).toEqual([undefined, { approved: true }]);
  });

  it('keeps the concurrency limit across workers for a task answered while its suspend hooks run', async () => {
    const storage = new InMemoryStore();
    const limits = { enabled: true, globalConcurrency: 1, perAgentConcurrency: 1 };
    const running = new Set<string>();
    let overlapped = false;
    const track = async (name: string, work: Promise<unknown>) => {
      running.add(name);
      if (running.size > 1) overlapped = true;
      try {
        await work;
      } finally {
        running.delete(name);
      }
    };
    let finishApproval!: () => void;
    const approvalDone = new Promise<void>(resolve => (finishApproval = resolve));

    const first = new Mastra({ logger: false, storage, backgroundTasks: limits });
    mastras.push(first);
    first.backgroundTaskManager!.registerStaticExecutor('approval', {
      execute: async (_args, options) => {
        if (options.resumeData === undefined) {
          await options.suspend?.({ question: 'Approve?' });
          return;
        }
        await track('approval', approvalDone);
        return 'done';
      },
    });
    const second = new Mastra({ logger: false, storage, backgroundTasks: limits });
    mastras.push(second);
    second.backgroundTaskManager!.registerStaticExecutor('other', {
      execute: async () => {
        await track('other', Promise.resolve());
        return 'done';
      },
    });

    let finishHook!: () => void;
    const held = holdSuspendHook(
      first.backgroundTaskManager!,
      () => new Promise<void>(resolve => (finishHook = resolve)),
    );
    const { task } = await first.backgroundTaskManager!.enqueue(payload('portable'));
    await held;
    await first.backgroundTaskManager!.resume(task.id, { approved: true });
    await vi.waitFor(() => expect(running.has('approval')).toBe(true), { timeout: 5000, interval: 20 });

    // Another worker's task waits for the slot the answered task holds, even
    // after the first run's suspend hooks finish.
    const { task: other } = await second.backgroundTaskManager!.enqueue({ ...payload('other'), toolName: 'other' });
    finishHook();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect((await second.backgroundTaskManager!.getTask(other.id))?.status).toBe('pending');

    finishApproval();
    expect((await settled(first.backgroundTaskManager!, task.id)).status).toBe('completed');
    expect(overlapped).toBe(false);
  });

  it('fails the task instead of leaving it running when storing the suspension fails', async () => {
    const storage = new InMemoryStore();
    const manager = start(storage, approvalTool()).backgroundTaskManager!;
    const tasks = (await storage.getStore('backgroundTasks'))!;
    const updateTask = tasks.updateTask.bind(tasks);
    let failed = false;
    tasks.updateTask = async (taskId, update, options) => {
      if (update.status === 'suspended' && !failed) {
        failed = true;
        throw new Error('storage unavailable');
      }
      return updateTask(taskId, update, options);
    };

    const { task } = await manager.enqueue(payload('write-fails'));
    const done = await settled(manager, task.id);

    expect(done.status).toBe('failed');
    expect(done.error?.message).toBe('storage unavailable');
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () =>
      expect(
        await workflows.getWorkflowRunById({ runId: task.id, workflowName: BACKGROUND_TASK_WORKFLOW_ID }),
      ).toBeNull(),
    );
  });

  it('asks again after a crash between saving the suspended run and storing the task as suspended', async () => {
    const storage = new InMemoryStore();
    const tasks = (await storage.getStore('backgroundTasks'))!;
    // The first worker dies while storing the suspension: its write never lands.
    let writeReached!: () => void;
    const writeHeld = new Promise<void>(resolve => (writeReached = resolve));
    let heldOne = false;
    const updateTask = tasks.updateTask.bind(tasks);
    tasks.updateTask = async (taskId, update, options) => {
      if (update.status === 'suspended' && !heldOne) {
        heldOne = true;
        writeReached();
        return new Promise<boolean>(() => {});
      }
      return updateTask(taskId, update, options);
    };
    const crashed = start(storage, approvalTool());
    const { task } = await crashed.backgroundTaskManager!.enqueue({ ...payload('crash-before-row'), maxRetries: 1 });
    await writeHeld;
    mastras.splice(mastras.indexOf(crashed), 1);
    expect((await tasks.getTask(task.id))?.status).toBe('running');

    // Recovery runs the task again over the run's suspended snapshot.
    const tool = approvalTool();
    const restarted = start(storage, tool).backgroundTaskManager!;
    await restarted.restart(task.id);
    await vi.waitFor(async () => expect((await tasks.getTask(task.id))?.status).toBe('suspended'), {
      timeout: 5000,
      interval: 20,
    });
    await restarted.resume(task.id, { approved: true });

    expect((await settled(restarted, task.id)).status).toBe('completed');
    expect(tool.calls).toEqual([undefined, { approved: true }]);
  });

  it('is answered even if its suspend hooks never return', async () => {
    const storage = new InMemoryStore();
    const tool = approvalTool();
    const mastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: true, leaseDurationMs: 3000 } });
    mastras.push(mastra);
    const manager = mastra.backgroundTaskManager!;
    manager.registerStaticExecutor('approval', tool);
    const held = holdSuspendHook(manager, () => new Promise(() => {}));
    const { task } = await manager.enqueue(payload('hung-hook'));
    await held;

    await manager.resume(task.id, { approved: true });
    await vi.waitFor(async () => expect((await manager.getTask(task.id))?.status).toBe('completed'), {
      timeout: 5000,
      interval: 50,
    });
    expect(tool.calls).toEqual([undefined, { approved: true }]);
  });

  it('does not announce a suspension that was already answered when its hooks finish', async () => {
    const storage = new InMemoryStore();
    const manager = start(storage, approvalTool()).backgroundTaskManager!;
    const events: string[] = [];
    const publish = manager.publishLifecycleEvent.bind(manager);
    manager.publishLifecycleEvent = async (type, task) => {
      if (task.toolCallId === 'announce') events.push(type);
      return publish(type, task);
    };
    let finishHook!: () => void;
    const held = holdSuspendHook(manager, () => new Promise<void>(resolve => (finishHook = resolve)));
    const { task } = await manager.enqueue(payload('announce'));
    await held;

    await manager.resume(task.id, { approved: true });
    expect((await settled(manager, task.id)).status).toBe('completed');
    finishHook();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(events).toContain('task.completed');
    expect(events).not.toContain('task.suspended');
  });

  it('still announces the suspension when a suspend hook throws', async () => {
    const storage = new InMemoryStore();
    const manager = start(storage, approvalTool()).backgroundTaskManager!;
    const events: string[] = [];
    const publish = manager.publishLifecycleEvent.bind(manager);
    manager.publishLifecycleEvent = async (type, task) => {
      if (task.toolCallId === 'hook-throws') events.push(type);
      return publish(type, task);
    };
    manager.runLocalSuspendHooks = async () => {
      throw new Error('hook failed');
    };
    const { task } = await manager.enqueue(payload('hook-throws'));

    await vi.waitFor(() => expect(events).toContain('task.suspended'), { timeout: 5000, interval: 20 });
    expect((await manager.getTask(task.id))?.status).toBe('suspended');
  });

  it('is still cancelled by an explicit cancel() after the restart', async () => {
    const storage = new InMemoryStore();
    const first = approvalTool();
    const mastra = start(storage, first);
    let shutdownStarted!: () => void;
    const started = new Promise<void>(resolve => (shutdownStarted = resolve));
    const held = holdSuspendHook(mastra.backgroundTaskManager!, () => shutdownReaches(first, started));
    const { task } = await mastra.backgroundTaskManager!.enqueue(payload('cancel'));
    await held;
    const stopping = mastra.shutdown({ drainTimeout: 2000 });
    shutdownStarted();
    await stopping;
    expect((await restartedStorageTask(storage, task.id))?.status).toBe('suspended');

    const restarted = start(storage, approvalTool()).backgroundTaskManager!;
    await restarted.cancel(task.id);
    expect((await restarted.getTask(task.id))?.status).toBe('cancelled');
  });
});

/**
 * A command the agent stopped waiting on (started with `background: true`, or a
 * foreground command that ran past `foregroundDetachMs`) notifies the agent that
 * started it when it exits, waking its idle thread with the result.
 *
 * Real pieces throughout: LocalSandbox runs real shell processes, and the
 * notification goes through a real Agent registered on Mastra with in-memory
 * notification storage. Only the model is mocked.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTextStreamModel, readNextRunWithParts, withTimeout } from '../../../agent/__tests__/signals-test-utils';
import { Agent } from '../../../agent/agent';
import { agentThreadStreamRuntime } from '../../../agent/thread-stream-runtime';
import { Mastra } from '../../../mastra';
import { InMemoryNotificationsStorage } from '../../../notifications/storage';
import { MastraCompositeStore } from '../../../storage/base';
import { WORKSPACE_TOOLS } from '../../constants';
import { LocalSandbox } from '../../sandbox/local-sandbox';
import { Workspace } from '../../workspace';
import { executeCommandWithBackgroundTool } from '../execute-command';
import type { ExecuteCommandToolConfig } from '../types';

const thread = { resourceId: 'user-1', threadId: 'thread-1' };

async function setup(config: ExecuteCommandToolConfig = {}) {
  const notifications = new InMemoryNotificationsStorage();
  const agent = new Agent({
    id: 'builder',
    name: 'Builder',
    instructions: 'Test',
    model: createTextStreamModel('saw it'),
  });
  const mastra = new Mastra({
    agents: { builder: agent },
    storage: new MastraCompositeStore({ id: 'store', domains: { notifications } }),
    logger: false,
  });
  const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation: 'none' });
  const workspace = new Workspace({ sandbox, tools: { [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: config } });
  await workspace.init();

  const subscription = await agent.subscribeToThread(thread);
  const runs = subscription.stream[Symbol.asyncIterator]();
  const context = {
    workspace,
    mastra,
    agent: { agentId: 'builder', toolCallId: 'call-1', ...thread },
  } as any;
  const run = (input: Record<string, unknown>) => executeCommandWithBackgroundTool.execute!(input as any, context);

  return { notifications, workspace, subscription, runs, run };
}

/** The notification signal that woke the next run. */
async function nextWake(runs: AsyncIterator<any>, timeoutMs = 5_000) {
  const next = await withTimeout(readNextRunWithParts(runs), 'no run was woken', timeoutMs);
  if (next.done) throw new Error('thread stream ended');
  return next.value.parts.find((part: any) => part.type === 'data-signal')?.data;
}

describe('execute_command: telling the agent when a process it stopped waiting on exits', () => {
  let cleanup: Array<() => Promise<void> | void> = [];
  beforeEach(() => agentThreadStreamRuntime.resetForTests());
  afterEach(async () => {
    for (const fn of cleanup.reverse()) await fn();
    cleanup = [];
  });

  it('wakes the idle thread with the exit code and output of a background process', async () => {
    const { run, runs, subscription, workspace } = await setup();
    cleanup.push(
      () => subscription.unsubscribe(),
      () => workspace.destroy(),
    );

    const started = await run({ command: 'sleep 0.3; echo built 42 files; exit 3', background: true });
    expect(started).toMatch(/^Started background process \(PID: \d+\)\. You'll be notified when it exits$/);

    const signal = await nextWake(runs);
    expect(signal).toMatchObject({ type: 'notification', attributes: { source: 'workspace', kind: 'process-exit' } });
    expect(signal.contents).toContain('exited with code 3');
    expect(signal.contents).toContain('built 42 files');
  });

  it('moves a foreground command that runs too long to the background, then wakes the thread when it exits', async () => {
    const { run, runs, subscription, workspace } = await setup({ foregroundDetachMs: 300 });
    cleanup.push(
      () => subscription.unsubscribe(),
      () => workspace.destroy(),
    );

    const startedAt = Date.now();
    const returned = (await run({ command: 'echo compiling; sleep 1; echo done compiling' })) as string;
    expect(Date.now() - startedAt).toBeLessThan(900);
    expect(returned).toContain('compiling');
    expect(returned).not.toContain('done compiling');
    const pid = returned.match(/moved to the background \(PID: (\d+)\)/)?.[1];
    expect(pid).toBeDefined();
    expect(returned).toContain("You'll be notified when it exits.");

    // Still running, and readable like any background process.
    const handle = await workspace.sandbox!.processes!.get(pid!);
    expect(handle?.exitCode).toBeUndefined();

    const signal = await nextWake(runs);
    expect(signal.contents).toContain(`Background process ${pid}`);
    expect(signal.contents).toContain('exited with code 0');
    expect(signal.contents).toContain('done compiling');
  });

  it('returns a foreground command that finishes in time as usual, without a notification', async () => {
    const { run, notifications, subscription, workspace } = await setup({ foregroundDetachMs: 2_000 });
    cleanup.push(
      () => subscription.unsubscribe(),
      () => workspace.destroy(),
    );

    await expect(run({ command: 'echo quick' })).resolves.toBe('quick\n');
    await new Promise(resolve => setTimeout(resolve, 200));
    await expect(notifications.listNotifications({ threadId: thread.threadId })).resolves.toEqual([]);
  });

  it("doesn't notify about a process the agent killed", async () => {
    const { run, notifications, subscription, workspace } = await setup();
    cleanup.push(
      () => subscription.unsubscribe(),
      () => workspace.destroy(),
    );

    const started = (await run({ command: 'sleep 30', background: true })) as string;
    const pid = started.match(/PID: (\d+)/)![1]!;
    await workspace.sandbox!.processes!.kill(pid);
    await new Promise(resolve => setTimeout(resolve, 300));

    await expect(notifications.listNotifications({ threadId: thread.threadId })).resolves.toEqual([]);
  });

  it('stays quiet when notifyOnExit is off', async () => {
    const { run, notifications, subscription, workspace } = await setup({
      backgroundProcesses: { notifyOnExit: false },
    });
    cleanup.push(
      () => subscription.unsubscribe(),
      () => workspace.destroy(),
    );

    await expect(run({ command: 'echo hi', background: true })).resolves.toMatch(
      /^Started background process \(PID: \d+\)$/,
    );
    await new Promise(resolve => setTimeout(resolve, 300));
    await expect(notifications.listNotifications({ threadId: thread.threadId })).resolves.toEqual([]);
  });
});

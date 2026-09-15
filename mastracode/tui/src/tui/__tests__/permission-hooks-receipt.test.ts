/**
 * Regression tests for #20861: PermissionRequest hooks must fire the moment a
 * permission-prompt event is received by the controller subscription listener,
 * BEFORE the event enters the TUI's serialized dispatch queue. A pending
 * prompt blocks that queue until the user answers, so a hook dispatched from
 * inside a queued handler is starved exactly when its external integration
 * matters most.
 *
 * These tests exercise the REAL subscription listener (subscribeToAgentController)
 * and the REAL receipt-time tap in display.ts. Hook dispatch is observed at the
 * state.hookManager boundary: the tap reaches the manager off the harness
 * state, so a plain recording object is the correct interception point — no
 * module mocking of the SDK. Events are delivered through the captured
 * listener, never via direct handleEvent calls, so the queue semantics are
 * genuinely exercised (the #20399 trap).
 *
 * notify.js is mocked only to keep the sibling notification tap inert; nothing
 * in this suite asserts on it.
 */
import { mkdirSync, mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HookManager } from '@mastra/code-sdk/hooks/manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
}));

vi.mock('../notify.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../notify.js')>()),
  sendNotification: mocks.sendNotification,
}));

import { subscribeToAgentController } from '../setup.js';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function createHarness(hookManager: unknown) {
  let listener: ((event: any) => Promise<void>) | undefined;
  const state = {
    session: {
      state: { get: vi.fn(() => ({ notifications: 'off' })) },
      subscribe: vi.fn((handler: any) => {
        listener = handler;
        return vi.fn();
      }),
    },
    hookManager,
  } as any;

  const releaseBlocker = createDeferred<void>();
  const handled: string[] = [];
  const handleEvent = vi.fn(async (event: { type: string }) => {
    handled.push(`start:${event.type}`);
    if (event.type === 'blocking_prompt') {
      await releaseBlocker.promise;
    }
    handled.push(`end:${event.type}`);
  });

  subscribeToAgentController(state, handleEvent);
  if (!listener) throw new Error('subscribe did not capture a listener');

  return {
    state,
    listener: listener as (event: any) => Promise<void>,
    releaseBlocker,
    handled,
    handleEvent,
  };
}

function createRecordingManager() {
  return {
    runPermissionRequest: vi.fn().mockResolvedValue({ allowed: true, results: [], warnings: [] }),
  };
}

beforeEach(() => {
  mocks.sendNotification.mockClear();
});

describe('PermissionRequest hooks fire at event receipt (#20861)', () => {
  it('dispatches tool_approval while the queue is blocked by a pending prompt', async () => {
    const manager = createRecordingManager();
    const { listener, releaseBlocker, handled } = createHarness(manager);

    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();
    expect(handled).toEqual(['start:blocking_prompt']);

    const second = listener({
      type: 'tool_approval_required',
      toolCallId: 'call-approve',
      toolName: 'execute_command',
      args: { command: 'rm -rf /' },
    });

    // The queue is still blocked — the hook must already have been dispatched.
    expect(handled).toEqual(['start:blocking_prompt']);
    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);
    expect(manager.runPermissionRequest).toHaveBeenCalledWith('tool_approval', 'call-approve', 'execute_command', {
      command: 'rm -rf /',
    });

    releaseBlocker.resolve();
    await blocked;
    await second;
    expect(handled).toEqual([
      'start:blocking_prompt',
      'end:blocking_prompt',
      'start:tool_approval_required',
      'end:tool_approval_required',
    ]);
  });

  it('dispatches sandbox_access for request_access while the queue is blocked', async () => {
    const manager = createRecordingManager();
    const { listener, releaseBlocker, handled } = createHarness(manager);

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    const suspendPayload = { kind: 'sandbox_access_request', path: '/tmp/project', reason: 'read files' };
    void listener({
      type: 'tool_suspended',
      toolCallId: 'call-sandbox',
      toolName: 'request_access',
      suspendPayload,
    });

    expect(handled).toEqual(['start:blocking_prompt']);
    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);
    expect(manager.runPermissionRequest).toHaveBeenCalledWith(
      'sandbox_access',
      'call-sandbox',
      'request_access',
      suspendPayload,
    );
    releaseBlocker.resolve();
  });

  it('dispatches sandbox_access by payload kind regardless of toolName', async () => {
    const manager = createRecordingManager();
    const { listener, releaseBlocker } = createHarness(manager);

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    const suspendPayload = { kind: 'sandbox_access_request', path: '/opt/shared' };
    void listener({
      type: 'tool_suspended',
      toolCallId: 'call-sandbox-kind',
      toolName: 'some_workspace_tool',
      suspendPayload,
    });

    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);
    expect(manager.runPermissionRequest).toHaveBeenCalledWith(
      'sandbox_access',
      'call-sandbox-kind',
      'some_workspace_tool',
      suspendPayload,
    );
    releaseBlocker.resolve();
  });

  it('dispatches plan_approval for submit_plan while the queue is blocked', async () => {
    const manager = createRecordingManager();
    const { listener, releaseBlocker, handled } = createHarness(manager);

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    const suspendPayload = { path: '.mastracode/plans/change.md' };
    void listener({
      type: 'tool_suspended',
      toolCallId: 'call-plan',
      toolName: 'submit_plan',
      suspendPayload,
    });

    expect(handled).toEqual(['start:blocking_prompt']);
    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);
    expect(manager.runPermissionRequest).toHaveBeenCalledWith(
      'plan_approval',
      'call-plan',
      'submit_plan',
      suspendPayload,
    );
    releaseBlocker.resolve();
  });

  it('dispatches each permission hook exactly once across receipt and queue drain', async () => {
    const manager = createRecordingManager();
    const { listener, releaseBlocker } = createHarness(manager);

    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    const approval = listener({
      type: 'tool_approval_required',
      toolCallId: 'call-once',
      toolName: 'execute_command',
      args: { command: 'ls' },
    });

    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);

    // Release the queue and let both events drain fully. The queued handler
    // must NOT re-dispatch the permission hook — exactly once per event.
    releaseBlocker.resolve();
    await blocked;
    await approval;
    await Promise.resolve();
    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch a permission hook for ask_user suspensions', async () => {
    const manager = createRecordingManager();
    const { listener, releaseBlocker, handled } = createHarness(manager);

    const blocked = listener({
      type: 'tool_suspended',
      toolCallId: 'call-ask',
      toolName: 'ask_user',
      suspendPayload: { question: 'Continue?' },
    });

    expect(manager.runPermissionRequest).not.toHaveBeenCalled();
    releaseBlocker.resolve();
    await blocked;
    expect(handled).toEqual(['start:tool_suspended', 'end:tool_suspended']);
    expect(manager.runPermissionRequest).not.toHaveBeenCalled();
  });

  it('does not break event delivery when the hook dispatch rejects', async () => {
    const manager = {
      runPermissionRequest: vi.fn().mockRejectedValue(new Error('hook process exploded')),
    };
    const { listener, releaseBlocker, handled } = createHarness(manager);

    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    const second = listener({
      type: 'tool_approval_required',
      toolCallId: 'call-reject',
      toolName: 'execute_command',
      args: {},
    });

    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);
    releaseBlocker.resolve();
    await blocked;
    await second;
    expect(handled).toEqual([
      'start:blocking_prompt',
      'end:blocking_prompt',
      'start:tool_approval_required',
      'end:tool_approval_required',
    ]);
  });

  it('does not break event delivery when the hook dispatch throws synchronously', async () => {
    // A synchronous throw (before any promise exists) is what the tap's
    // try/catch wrapper guards against — .catch(() => {}) alone cannot.
    const manager = {
      runPermissionRequest: vi.fn(() => {
        throw new Error('synchronous failure');
      }),
    };
    const { listener, releaseBlocker, handled } = createHarness(manager);

    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    const second = listener({
      type: 'tool_approval_required',
      toolCallId: 'call-throw',
      toolName: 'execute_command',
      args: {},
    });

    expect(manager.runPermissionRequest).toHaveBeenCalledTimes(1);
    releaseBlocker.resolve();
    await blocked;
    await second;
    expect(handled).toEqual([
      'start:blocking_prompt',
      'end:blocking_prompt',
      'start:tool_approval_required',
      'end:tool_approval_required',
    ]);
  });
});

describe('runId edge with a real HookManager (#20861, Risk R1)', () => {
  let tmpProject: string;
  let tmpHome: string;

  beforeEach(() => {
    tmpProject = mkdtempSync(join(tmpdir(), 'permission-hooks-receipt-project-'));
    tmpHome = mkdtempSync(join(tmpdir(), 'permission-hooks-receipt-home-'));
  });

  afterEach(() => {
    rmSync(tmpProject, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it('silently no-ops when a permission event arrives with no preceding agent_start', async () => {
    // The runId bail lives in the real HookManager.runPermissionRequest — a
    // fake manager would never execute it. HookManager reads hook config from
    // the filesystem at construction, so config is injected via controlled
    // temp dirs (project + home) to keep the test hermetic.
    //
    // The receipt-time tap sets runId when agent_start arrives (see
    // runPermissionHooksForEvent in display.ts). This test deliberately sends
    // NO agent_start, so the runId remains unset and the hook bails — proving
    // the guard still works when no run has been started.
    const marker = join(tmpProject, 'permission-hook-ran.marker');
    mkdirSync(join(tmpProject, '.mastracode'), { recursive: true });
    writeFileSync(
      join(tmpProject, '.mastracode', 'hooks.json'),
      JSON.stringify({
        PermissionRequest: [
          {
            type: 'command',
            command: `node -e "require('node:fs').appendFileSync('${marker}', 'x')"`,
            timeout: 5000,
          },
        ],
      }),
    );

    const manager = new HookManager(tmpProject, 'session-runid-test', '.mastracode', tmpHome);
    // Sanity: the injected config actually loaded — otherwise the hooks-empty
    // bail would mask the runId bail and this test would pass vacuously.
    expect(manager.getConfig().PermissionRequest).toHaveLength(1);
    expect(manager.getRunId()).toBeUndefined();

    // Drive the real listener with the real manager: setRunId never called.
    const spy = vi.spyOn(manager, 'runPermissionRequest');
    const { listener, releaseBlocker } = createHarness(manager);
    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    // The receipt-time path itself reaches the real manager with the right
    // arguments even though the queue is blocked...
    void listener({
      type: 'tool_approval_required',
      toolCallId: 'call-norunid',
      toolName: 'execute_command',
      args: {},
    });
    expect(spy).toHaveBeenCalledWith('tool_approval', 'call-norunid', 'execute_command', {});

    // ...and the bail is deterministic: awaiting that dispatch's own result
    // either returns empty immediately or awaits the spawned hook to
    // completion — in which case the marker would exist by the time the
    // await resolves.
    const result = await spy.mock.results[0]!.value;
    expect(result.results).toEqual([]);
    expect(existsSync(marker)).toBe(false);

    releaseBlocker.resolve();
    await blocked;
  });

  it('sets runId at receipt time so a permission event after agent_start fires the hook', async () => {
    // The receipt-time tap (runPermissionHooksForEvent in display.ts) sets the
    // runId when agent_start arrives, BEFORE the queued handler processes it.
    // This closes the race where a tool_suspended arriving in the same
    // synchronous batch as agent_start would find runId unset and bail.
    const marker = join(tmpProject, 'permission-hook-ran.marker');
    mkdirSync(join(tmpProject, '.mastracode'), { recursive: true });
    writeFileSync(
      join(tmpProject, '.mastracode', 'hooks.json'),
      JSON.stringify({
        PermissionRequest: [
          {
            type: 'command',
            command: `node -e "require('node:fs').appendFileSync('${marker}', 'x')"`,
            timeout: 5000,
          },
        ],
      }),
    );

    const manager = new HookManager(tmpProject, 'session-runid-test', '.mastracode', tmpHome);
    expect(manager.getConfig().PermissionRequest).toHaveLength(1);
    expect(manager.getRunId()).toBeUndefined();

    const spy = vi.spyOn(manager, 'runPermissionRequest');
    const { listener, releaseBlocker } = createHarness(manager);
    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    // agent_start arrives at receipt time — the tap should set the runId.
    void listener({ type: 'agent_start' });
    expect(manager.getRunId()).toBeDefined();

    // tool_suspended for request_access arrives in the same batch — the hook
    // must fire now that runId is set.
    void listener({
      type: 'tool_suspended',
      toolCallId: 'call-access',
      toolName: 'request_access',
      suspendPayload: { kind: 'sandbox_access_request', path: '/tmp/test' },
    });
    expect(spy).toHaveBeenCalledWith('sandbox_access', 'call-access', 'request_access', {
      kind: 'sandbox_access_request',
      path: '/tmp/test',
    });

    // The hook process should have run and written the marker.
    const result = await spy.mock.results[0]!.value;
    expect(result.results).toHaveLength(1);
    expect(existsSync(marker)).toBe(true);

    releaseBlocker.resolve();
    await blocked;
  });
});

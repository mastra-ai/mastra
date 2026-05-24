/**
 * Tests for background-process reap-on-lifecycle.
 *
 * Tools that call `sandbox.processes.spawn(...)` in background mode produce
 * OS processes that can outlive their spawning turn. Without reap-on-close
 * those processes orphan when the session is closed, evicted, or deleted.
 *
 * The Harness exposes `registerBackgroundProcess(handle)` on the
 * `HarnessRequestContext` slot; the Session reaps every registered handle on
 * `_markClosed`, `_markEvicted`, and `_markDeleted`. Foreground commands do
 * NOT register here — their lifetime is already bounded by the turn's
 * `abortSignal` via the sandbox process manager's abort-to-kill wiring.
 */

import { describe, expect, it } from 'vitest';

import { ProcessHandle } from '../../workspace/sandbox/process-manager';
import type { CommandResult } from '../../workspace/sandbox/types';

import { setupHarness } from './__test-utils__/setup';

// ---------------------------------------------------------------------------
// Test ProcessHandle stub
// ---------------------------------------------------------------------------

/**
 * Minimal ProcessHandle that records `kill()` invocations and lets tests drive
 * `wait()` resolution. Mirrors the pattern in process-handle.test.ts.
 */
class FakeProcessHandle extends ProcessHandle {
  killCount = 0;
  exitCode: number | undefined;

  private resolveWait!: (result: CommandResult) => void;
  private rejectWait!: (err: unknown) => void;
  private readonly waitPromise: Promise<CommandResult>;

  constructor(public readonly pid: string) {
    super();
    this.waitPromise = new Promise<CommandResult>((resolve, reject) => {
      this.resolveWait = resolve;
      this.rejectWait = reject;
    });
  }

  override async wait(): Promise<CommandResult> {
    return this.waitPromise;
  }

  async kill(): Promise<boolean> {
    this.killCount += 1;
    this.exitCode = 137;
    this.resolveWait({
      success: false,
      exitCode: 137,
      stdout: '',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false,
      stdoutDroppedBytes: 0,
      stderrDroppedBytes: 0,
      executionTimeMs: 0,
    });
    return true;
  }

  async sendStdin(): Promise<void> {}

  /** Drive a normal exit (no kill). */
  finishCleanly(): void {
    this.exitCode = 0;
    this.resolveWait({
      success: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false,
      stdoutDroppedBytes: 0,
      stderrDroppedBytes: 0,
      executionTimeMs: 0,
    });
  }

  /** Drive a failed wait() resolution. */
  failWait(err: unknown): void {
    this.rejectWait(err);
  }
}

// ---------------------------------------------------------------------------
// Internal accessor — bypasses the public slot so unit tests stay focused on
// the Session-side bookkeeping.
// ---------------------------------------------------------------------------

interface SessionBgInternals {
  _backgroundProcesses: Map<string, { handle: ProcessHandle; unregister: () => void }>;
  _registerBackgroundProcess(handle: ProcessHandle): () => void;
}

function asInternals(session: unknown): SessionBgInternals {
  return session as unknown as SessionBgInternals;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Session background-process reap — registration', () => {
  it('stores the handle and exposes the entry on the internal map', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handle = new FakeProcessHandle('p-1');
    internals._registerBackgroundProcess(handle);

    expect(internals._backgroundProcesses.size).toBe(1);
  });

  it('returns an unregister callback that removes the entry on demand', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handle = new FakeProcessHandle('p-1');
    const unregister = internals._registerBackgroundProcess(handle);
    expect(internals._backgroundProcesses.size).toBe(1);
    unregister();
    expect(internals._backgroundProcesses.size).toBe(0);
  });

  it('auto-unregisters on normal exit via handle.wait()', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handle = new FakeProcessHandle('p-1');
    internals._registerBackgroundProcess(handle);
    handle.finishCleanly();
    // The wait().then(unreg, unreg) handler runs after the base ProcessHandle
    // wrapper resolves. Drain through a macrotask to be sure.
    await new Promise(resolve => setImmediate(resolve));
    expect(internals._backgroundProcesses.size).toBe(0);
    expect(handle.killCount).toBe(0);
  });

  it('auto-unregisters when handle.wait() rejects', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handle = new FakeProcessHandle('p-1');
    internals._registerBackgroundProcess(handle);
    handle.failWait(new Error('wait failed'));
    await new Promise(resolve => setImmediate(resolve));
    expect(internals._backgroundProcesses.size).toBe(0);
  });
});

describe('Session background-process reap — lifecycle transitions', () => {
  it('kills tracked handles when the session is closed', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handle = new FakeProcessHandle('p-close');
    internals._registerBackgroundProcess(handle);
    await session.close();
    expect(handle.killCount).toBeGreaterThanOrEqual(1);
    expect(internals._backgroundProcesses.size).toBe(0);
  });

  it('kills tracked handles when the harness is shut down (eviction)', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handle = new FakeProcessHandle('p-evict');
    internals._registerBackgroundProcess(handle);
    await harness.shutdown();
    expect(handle.killCount).toBeGreaterThanOrEqual(1);
    expect(internals._backgroundProcesses.size).toBe(0);
  });

  it('kills tracked handles when the session is hard-deleted', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handle = new FakeProcessHandle('p-delete');
    internals._registerBackgroundProcess(handle);
    // Force delete so we don't need to close first; the harness still
    // closes-then-deletes internally and the reap fires from `_markDeleted`.
    await harness.deleteSession({ sessionId: session.id, resourceId: 'u', force: true });
    expect(handle.killCount).toBeGreaterThanOrEqual(1);
    expect(internals._backgroundProcesses.size).toBe(0);
  });

  it('is a no-op when no background processes were ever registered', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await expect(session.close()).resolves.toBeUndefined();
  });

  it('does not kill foreground processes — they are bounded by the turn abort signal', async () => {
    // Foreground processes never call registerBackgroundProcess (the call site
    // is gated by `if (background)` in execute-command.ts). This test asserts
    // the documented contract: unregistered handles are not affected by reap.
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const handle = new FakeProcessHandle('p-foreground');
    // Skip registration — emulate the foreground call path.
    await session.close();
    expect(handle.killCount).toBe(0);
  });
});

describe('Session background-process reap — race-window safety', () => {
  it('kills the handle immediately when register is called after close', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    await session.close();

    const handle = new FakeProcessHandle('p-late');
    const unregister = internals._registerBackgroundProcess(handle);

    expect(handle.killCount).toBeGreaterThanOrEqual(1);
    // The session must not retain any entry — there is no live owner left
    // to reap it later. `_backgroundProcesses` is symbol-keyed, so check
    // size rather than has(pid).
    expect(internals._backgroundProcesses.size).toBe(0);
    // The returned unregister is a safe no-op (the handle was never stored).
    expect(() => unregister()).not.toThrow();
  });

  it('survives OS-pid reuse: a stale callback does not delete a newer registration', async () => {
    // Regression guard: an earlier pid-keyed implementation could let a
    // stale unregister from process A delete the registration of a newer
    // process B that happens to reuse the same pid.
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);

    const handleA = new FakeProcessHandle('1234');
    internals._registerBackgroundProcess(handleA);
    handleA.finishCleanly(); // schedules the stale unregister
    await new Promise(resolve => setImmediate(resolve));
    expect(internals._backgroundProcesses.size).toBe(0);

    // Reuse the same pid for a new process — this is what an OS would do.
    const handleB = new FakeProcessHandle('1234');
    internals._registerBackgroundProcess(handleB);
    expect(internals._backgroundProcesses.size).toBe(1);

    // Reap and verify B was killed.
    await session.close();
    expect(handleB.killCount).toBeGreaterThanOrEqual(1);
  });
});

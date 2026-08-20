import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { LocalSandbox } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __clearSessionSandboxesForTests,
  createSessionSetupHook,
  evictSessionSandbox,
  getSessionSandbox,
  peekSessionSandbox,
  runSessionSetupFallback,
} from './session-sandbox.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
});

describe('session sandbox memo', () => {
  const construct = (id: string) => ({ id, provider: 'test' }) as unknown as WorkspaceSandbox;

  it('constructs once per session id and returns the memoized instance', () => {
    const factory = vi.fn(() => construct('sb-1'));
    const first = getSessionSandbox('sess-1', factory);
    const second = getSessionSandbox('sess-1', factory);
    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('keeps sessions independent', () => {
    const a = getSessionSandbox('sess-a', () => construct('sb-a'));
    const b = getSessionSandbox('sess-b', () => construct('sb-b'));
    expect(a).not.toBe(b);
  });

  it('peek never constructs', () => {
    expect(peekSessionSandbox('sess-1')).toBeUndefined();
    const made = getSessionSandbox('sess-1', () => construct('sb-1'));
    expect(peekSessionSandbox('sess-1')).toBe(made);
  });

  it('evict drops the instance so the next access reconstructs', () => {
    const first = getSessionSandbox('sess-1', () => construct('sb-1'));
    evictSessionSandbox('sess-1');
    const second = getSessionSandbox('sess-1', () => construct('sb-2'));
    expect(second).not.toBe(first);
  });

  it('does not memoize when construction throws', () => {
    expect(() =>
      getSessionSandbox('sess-1', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(peekSessionSandbox('sess-1')).toBeUndefined();
  });
});

describe('session setup hook + fallback', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-bootstrap-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('runs setup inside start() via the hook, and the fallback no-ops on the shared marker', async () => {
    // The callback forwarded ctx.onStart: setup runs during _start() on the
    // create branch (fresh directory → created: true).
    const hook = createSessionSetupHook(async sb => void (await sb.executeCommand!('touch hook-ran.txt')));
    const boot = path.join(dir, 'fresh');
    const sandbox = new LocalSandbox({ workingDirectory: boot, onStart: hook });
    await sandbox._start();
    await expect(fs.stat(path.join(boot, 'hook-ran.txt'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(boot, '.mastra-bootstrapped'))).resolves.toBeDefined();

    // The factory fallback guards the exact same marker → no re-run.
    await runSessionSetupFallback(sandbox, async sb => void (await sb.executeCommand!('touch fallback-ran.txt')));
    await expect(fs.stat(path.join(boot, 'fallback-ran.txt'))).rejects.toThrow();
  });

  it('the hook skips setup on reconnect when the marker is present', async () => {
    const boot = path.join(dir, 'reconnect');
    const first = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(async sb => void (await sb.executeCommand!('touch first.txt'))),
    });
    await first._start();

    // Second instance reattaches (created: false) → marker probe skips setup.
    const second = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(async sb => void (await sb.executeCommand!('touch second.txt'))),
    });
    await second._start();
    await expect(fs.stat(path.join(boot, 'second.txt'))).rejects.toThrow();
  });

  it('a failed setup fails start() loudly, writes no marker, and the next start self-heals', async () => {
    const boot = path.join(dir, 'fail');
    const failing = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(async () => {
        throw new Error('Session setup failed (exit 7)');
      }),
    });

    await expect(failing._start()).rejects.toThrow(/Session setup failed \(exit 7\)/);
    await expect(fs.stat(path.join(boot, '.mastra-bootstrapped'))).rejects.toThrow();

    // Reconnect (created: false), marker absent → setup re-runs and heals.
    const healed = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(async sb => void (await sb.executeCommand!('touch healed.txt'))),
    });
    await healed._start();
    await expect(fs.stat(path.join(boot, 'healed.txt'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(boot, '.mastra-bootstrapped'))).resolves.toBeDefined();
  });

  it('the fallback runs setup once for callbacks that ignored ctx.onStart', async () => {
    const sandbox = new LocalSandbox({ workingDirectory: dir });
    await sandbox._start();

    await runSessionSetupFallback(sandbox, async sb => void (await sb.executeCommand!('touch fallback-ran.txt')));
    await expect(fs.stat(path.join(dir, 'fallback-ran.txt'))).resolves.toBeDefined();

    // Second call: marker present, no re-run.
    await runSessionSetupFallback(sandbox, async sb => void (await sb.executeCommand!('touch second.txt')));
    await expect(fs.stat(path.join(dir, 'second.txt'))).rejects.toThrow();
  });

  it('the fallback surfaces failures with the exit code and writes no marker', async () => {
    const sandbox = new LocalSandbox({ workingDirectory: dir });
    await sandbox._start();

    await expect(
      runSessionSetupFallback(sandbox, async () => {
        throw new Error('Session setup failed (exit 7)');
      }),
    ).rejects.toThrow(/Session setup failed \(exit 7\)/);
    await runSessionSetupFallback(sandbox, async sb => void (await sb.executeCommand!('touch retried.txt')));
    await expect(fs.stat(path.join(dir, 'retried.txt'))).resolves.toBeDefined();
  });
});

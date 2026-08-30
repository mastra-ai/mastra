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
  resolveSessionWorkdir,
} from './session-sandbox.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
});

describe('session sandbox memo', () => {
  const construct = (id: string) => ({ id, provider: 'test' }) as unknown as WorkspaceSandbox;

  it('constructs once per session id and returns the memoized entry', () => {
    const factory = vi.fn(() => construct('sb-1'));
    const first = getSessionSandbox('sess-1', 'acme/api', factory);
    const second = getSessionSandbox('sess-1', 'acme/api', factory);
    expect(second).toBe(first);
    // Remote workdirs are a runtime fact of the VM — unresolved until start.
    expect(first.workdir).toBeUndefined();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('keeps sessions independent', () => {
    const a = getSessionSandbox('sess-a', 'acme/api', () => construct('sb-a'));
    const b = getSessionSandbox('sess-b', 'acme/api', () => construct('sb-b'));
    expect(a.sandbox).not.toBe(b.sandbox);
  });

  it('peek never constructs', () => {
    expect(peekSessionSandbox('sess-1')).toBeUndefined();
    const made = getSessionSandbox('sess-1', 'acme/api', () => construct('sb-1'));
    expect(peekSessionSandbox('sess-1')?.sandbox).toBe(made.sandbox);
    expect(peekSessionSandbox('sess-1')?.workdir).toBeUndefined();
  });

  it('resolves a remote workdir from the live VM home and memoizes it on the entry', async () => {
    const executeCommand = vi.fn(async () => ({ exitCode: 0, stdout: '/home/user\n', stderr: '' }));
    const sandbox = { id: 'sb-1', provider: 'e2b', executeCommand } as unknown as WorkspaceSandbox;
    const entry = getSessionSandbox('sess-1', 'acme/api', () => sandbox);
    expect(entry.workdir).toBeUndefined();

    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/home/user/api');
    expect(peekSessionSandbox('sess-1')?.workdir).toBe('/home/user/api');

    // Memoized: the second resolution never probes again.
    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/home/user/api');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith('pwd');
  });

  it('rejects a failed home probe without memoizing', async () => {
    const executeCommand = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'no shell' })
      .mockResolvedValue({ exitCode: 0, stdout: '/home/user\n', stderr: '' });
    const sandbox = { id: 'sb-1', provider: 'e2b', executeCommand } as unknown as WorkspaceSandbox;
    getSessionSandbox('sess-1', 'acme/api', () => sandbox);

    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).rejects.toThrow(/default cwd probe failed/);
    expect(peekSessionSandbox('sess-1')?.workdir).toBeUndefined();
    await expect(resolveSessionWorkdir('sess-1', sandbox, 'acme/api')).resolves.toBe('/home/user/api');
  });

  it('resolves a local workdir synchronously at construction', async () => {
    const local = { id: 'sb-l', provider: 'local', workingDirectory: '/srv/sess-1' } as unknown as WorkspaceSandbox;
    const entry = getSessionSandbox('sess-l', 'acme/api', () => local);
    expect(entry.workdir).toBe(path.resolve('/srv/sess-1', 'api'));
    // Resolution answers from the memo without any probe.
    await expect(resolveSessionWorkdir('sess-l', local, 'acme/api')).resolves.toBe(entry.workdir);
  });

  it('evict drops the instance so the next access reconstructs', () => {
    const first = getSessionSandbox('sess-1', 'acme/api', () => construct('sb-1'));
    evictSessionSandbox('sess-1');
    const second = getSessionSandbox('sess-1', 'acme/api', () => construct('sb-2'));
    expect(second.sandbox).not.toBe(first.sandbox);
  });

  it('does not memoize when construction throws', () => {
    expect(() =>
      getSessionSandbox('sess-1', 'acme/api', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(peekSessionSandbox('sess-1')).toBeUndefined();
  });
});

describe('session setup hook', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-bootstrap-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('runs setup inside start() via the hook and writes the marker', async () => {
    // The callback forwarded ctx.onStart: setup runs during _start() on the
    // create branch (fresh directory → outcome: 'created').
    const boot = path.join(dir, 'fresh');
    const hook = createSessionSetupHook(
      async sb => void (await sb.executeCommand!('mkdir -p repo/.git && touch hook-ran.txt')),
      'sess-hook',
      'acme/repo',
    );
    const sandbox = new LocalSandbox({ workingDirectory: boot, onStart: hook });
    await sandbox._start();
    await expect(fs.stat(path.join(boot, 'hook-ran.txt'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(boot, '.mastra-factory/bootstrap'))).resolves.toBeDefined();
  });

  it('the hook skips setup on reconnect when the marker and checkout are present', async () => {
    const boot = path.join(dir, 'reconnect');
    const workdir = path.join(boot, 'repo');
    const first = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async sb => void (await sb.executeCommand!('mkdir -p repo/.git && touch first.txt')),
        'sess-hook',
        'acme/repo',
      ),
    });
    await first._start();

    // Second instance reattaches (outcome: 'connected') → marker probe skips setup.
    const second = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async sb => void (await sb.executeCommand!('touch second.txt')),
        'sess-hook',
        'acme/repo',
      ),
    });
    await second._start();
    await expect(fs.stat(path.join(boot, 'second.txt'))).rejects.toThrow();
  });

  it('a marker without its checkout does not skip setup (removed checkout heals)', async () => {
    const boot = path.join(dir, 'wiped');
    const workdir = path.join(boot, 'repo');
    const first = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async sb => void (await sb.executeCommand!('mkdir -p repo/.git && touch first.txt')),
        'sess-hook',
        'acme/repo',
      ),
    });
    await first._start();

    // The checkout is removed but the marker (beside it) survives — a stale
    // skip cache must not defeat disk truth.
    await fs.rm(workdir, { recursive: true, force: true });
    const second = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async sb => void (await sb.executeCommand!('mkdir -p repo/.git && touch rebuilt.txt')),
        'sess-hook',
        'acme/repo',
      ),
    });
    await second._start();
    await expect(fs.stat(path.join(boot, 'rebuilt.txt'))).resolves.toBeDefined();
  });

  it('a failed setup fails start() loudly, writes no marker, and the next start self-heals', async () => {
    const boot = path.join(dir, 'fail');
    const failing = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async () => {
          throw new Error('Session setup failed (exit 7)');
        },
        'sess-hook',
        'acme/repo',
      ),
    });

    await expect(failing._start()).rejects.toThrow(/Session setup failed \(exit 7\)/);
    await expect(fs.stat(path.join(boot, '.mastra-factory/bootstrap'))).rejects.toThrow();

    // Reconnect (outcome: 'connected'), marker absent → setup re-runs and heals.
    const healed = new LocalSandbox({
      workingDirectory: boot,
      onStart: createSessionSetupHook(
        async sb => void (await sb.executeCommand!('mkdir -p repo/.git && touch healed.txt')),
        'sess-hook',
        'acme/repo',
      ),
    });
    await healed._start();
    await expect(fs.stat(path.join(boot, 'healed.txt'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(boot, '.mastra-factory/bootstrap'))).resolves.toBeDefined();
  });
});

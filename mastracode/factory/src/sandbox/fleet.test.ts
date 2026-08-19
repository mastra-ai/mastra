import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { LocalSandbox } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveContainedLocalWorkdir, SandboxFleet } from './fleet.js';
import type { MaterializationSandbox, SandboxBindingStore } from './fleet.js';

/** Minimal cloneable template sandbox standing in for Railway/Local instances. */
function templateSandbox(
  opts: { provider?: string; idleTimeoutMinutes?: number; workingDirectory?: string } = {},
): WorkspaceSandbox {
  const template = {
    id: 'template-1',
    name: 'Template',
    provider: opts.provider ?? 'railway',
    ...(opts.idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes: opts.idleTimeoutMinutes } : {}),
    ...(opts.workingDirectory !== undefined ? { workingDirectory: opts.workingDirectory } : {}),
    clone: () => template,
  };
  return template as unknown as WorkspaceSandbox;
}

/** Build a fleet from a factory-shaped sandbox runtime. */
function fleet(
  opts: {
    provider?: string;
    idleTimeoutMinutes?: number;
    workdirBase?: string;
    workingDirectory?: string;
    maxSandboxes?: number;
  } = {},
): SandboxFleet {
  return new SandboxFleet({
    machine: templateSandbox(opts),
    workdirBase: opts.workdirBase ?? '/workspace',
    ...(opts.maxSandboxes !== undefined ? { maxSandboxes: opts.maxSandboxes } : {}),
  });
}

describe('provider', () => {
  it('reports the configured template provider', () => {
    expect(fleet({ provider: 'railway' }).provider).toBe('railway');
    expect(fleet({ provider: 'local' }).provider).toBe('local');
  });

  it('reports none when no sandbox is configured', () => {
    expect(new SandboxFleet().provider).toBe('none');
  });
});

describe('enabled', () => {
  it('is true when a sandbox template is configured', () => {
    expect(fleet().enabled).toBe(true);
  });

  it('is false when no sandbox is configured', () => {
    expect(new SandboxFleet().enabled).toBe(false);
  });
});

describe('computeWorkdir', () => {
  it('nests owner/name under the default /workspace base', () => {
    expect(fleet().computeWorkdir('octocat/hello')).toBe('/workspace/octocat/hello');
  });

  it('nests owner/name under a configured base', () => {
    expect(fleet({ workdirBase: '/srv/checkouts' }).computeWorkdir('octocat/hello')).toBe(
      '/srv/checkouts/octocat/hello',
    );
  });

  it('sanitizes unsafe path segments', () => {
    expect(fleet().computeWorkdir('ac me/.hidden repo')).toBe('/workspace/ac-me/hidden-repo');
  });

  it('throws when no sandbox is configured', () => {
    expect(() => new SandboxFleet().computeWorkdir('octocat/hello')).toThrow(/No sandbox configured/);
  });
});

describe('idleMinutes', () => {
  it('defaults to 30 minutes when the template does not expose one', () => {
    expect(fleet().idleMinutes).toBe(30);
  });

  it('defaults to 30 minutes when no sandbox is configured', () => {
    expect(new SandboxFleet().idleMinutes).toBe(30);
  });

  it('reads the window back from the template sandbox', () => {
    expect(fleet({ idleTimeoutMinutes: 45 }).idleMinutes).toBe(45);
  });
});

describe('computeLocalSessionWorkdir', () => {
  it('builds deterministic session checkout paths under the local sandbox root', () => {
    expect(
      fleet({ provider: 'local', workingDirectory: '/tmp/mastracode-local-root' }).computeLocalSessionWorkdir(
        'octocat/hello',
        'session-1',
      ),
    ).toBe(path.resolve('/tmp/mastracode-local-root/github-sessions/octocat/hello/session-1'));
  });

  it('sanitizes repo path segments and keeps the result contained', () => {
    const result = fleet({
      provider: 'local',
      workingDirectory: '/tmp/mastracode-local-root',
    }).computeLocalSessionWorkdir('..owner/..hidden repo', '../../session');

    expect(result).toBe(path.resolve('/tmp/mastracode-local-root/github-sessions/owner/hidden-repo/-..-session'));
    expect(result.startsWith(path.resolve('/tmp/mastracode-local-root') + path.sep)).toBe(true);
  });

  it('throws when the active provider is not local', () => {
    expect(() => fleet({ provider: 'railway' }).computeLocalSessionWorkdir('octocat/hello', 'session-1')).toThrow(
      /local sandbox provider/,
    );
  });
});

describe('resolveContainedLocalWorkdir', () => {
  it('refuses paths outside the configured root', () => {
    expect(() => resolveContainedLocalWorkdir('/tmp/local-root', '..', 'other')).toThrow(/outside configured root/);
  });
});

describe('sandbox option forwarding', () => {
  function fakeSandbox(id = 'sb-1'): MaterializationSandbox {
    return {
      id,
      start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: id } })),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
  }

  it('passes provider working directory and acting user through fresh provisioning and reattach', async () => {
    const calls: unknown[] = [];
    const sandbox = fakeSandbox();
    const subject = fleet();
    subject.setFactory(opts => {
      calls.push(opts);
      return sandbox;
    });
    const store = {
      sandboxId: null as string | null,
      setSandboxId: vi.fn(async (id: string | null) => {
        store.sandboxId = id;
      }),
      clear: vi.fn(async () => {}),
    };

    const options = { workingDirectory: '/tmp/session-1', actingUserId: 'external-user-42' };
    await subject.ensureSandbox(store, { GH_TOKEN: 'token' }, undefined, options);
    await subject.ensureSandbox(store, { GH_TOKEN: 'token' }, undefined, options);

    expect(calls).toEqual([
      expect.objectContaining({
        env: { GH_TOKEN: 'token' },
        workingDirectory: '/tmp/session-1',
        actingUserId: 'external-user-42',
      }),
      expect.objectContaining({
        providerSandboxId: 'sb-1',
        env: { GH_TOKEN: 'token' },
        workingDirectory: '/tmp/session-1',
        actingUserId: 'external-user-42',
      }),
    ]);
  });

  it('passes provider working directory and acting user through direct reattach', async () => {
    const factory = vi.fn(() => fakeSandbox('sb-2'));
    const subject = fleet();
    subject.setFactory(factory);

    await subject.reattachSandbox('sb-2', {
      workingDirectory: '/tmp/session-2',
      actingUserId: 'external-user-42',
    });

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSandboxId: 'sb-2',
        workingDirectory: '/tmp/session-2',
        actingUserId: 'external-user-42',
      }),
    );
  });

  it('forwards provider working directory into the configured machine clone call', async () => {
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'local',
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
      _start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: 'derived-1' } })),
    }));
    const subject = new SandboxFleet({
      machine: { id: 'template', name: 'Template', provider: 'local', clone } as unknown as WorkspaceSandbox,
      workdirBase: '/workspace',
    });

    await subject.reattachSandbox('derived-1', { workingDirectory: '/tmp/session-3' });

    expect(clone).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'derived-1',
        sandboxId: 'derived-1',
        workingDirectory: '/tmp/session-3',
      }),
    );
  });

  it('forwards a fallback seed only on fresh provision and reports that it was used', async () => {
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'railway',
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
      _start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({
        metadata: { sandboxId: 'derived-1', restoredCheckpointName: 'repo-base' },
      })),
    }));
    const subject = new SandboxFleet({
      machine: { id: 'template', name: 'Template', provider: 'railway', clone } as unknown as WorkspaceSandbox,
      workdirBase: '/workspace',
    });
    const store = {
      sandboxId: null as string | null,
      checkpointName: 'session-checkpoint',
      seedCheckpointName: 'repo-base',
      setSandboxId: vi.fn(async (id: string | null) => {
        store.sandboxId = id;
      }),
      clear: vi.fn(async () => {}),
    };

    const provisioned = await subject.ensureSandbox(store);
    const reattached = await subject.ensureSandbox(store);

    expect(clone).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ checkpointName: 'session-checkpoint', seedCheckpointName: 'repo-base' }),
    );
    expect(clone).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ seedCheckpointName: expect.anything() }));
    expect(provisioned.seedCheckpointNameUsed).toBe('repo-base');
    expect(reattached.seedCheckpointNameUsed).toBeUndefined();
  });

  it('does not report the seed when the provider restores the primary checkpoint', async () => {
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'railway',
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
      _start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({
        metadata: { sandboxId: 'derived-1', restoredCheckpointName: 'session-checkpoint' },
      })),
    }));
    const subject = new SandboxFleet({
      machine: { id: 'template', name: 'Template', provider: 'railway', clone } as unknown as WorkspaceSandbox,
      workdirBase: '/workspace',
    });
    const store = {
      sandboxId: null,
      checkpointName: 'session-checkpoint',
      seedCheckpointName: 'repo-base',
      setSandboxId: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };

    const provisioned = await subject.ensureSandbox(store);

    expect(provisioned.seedCheckpointNameUsed).toBeUndefined();
  });

  it('releases a provisioned sandbox when reading provider details fails', async () => {
    const stop = vi.fn(async () => {});
    const getInfo = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider details unavailable'))
      .mockResolvedValue({ metadata: { sandboxId: 'derived-1' } });
    const sandbox = {
      id: 'derived-1',
      start: vi.fn(async () => {}),
      stop,
      getInfo,
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
    const subject = fleet({ maxSandboxes: 1 });
    subject.setFactory(() => sandbox);
    const store = {
      sandboxId: null as string | null,
      setSandboxId: vi.fn(async (id: string | null) => {
        store.sandboxId = id;
      }),
      clear: vi.fn(async () => {}),
    };

    await expect(subject.ensureSandbox(store)).rejects.toThrow('provider details unavailable');
    await expect(subject.ensureSandbox(store)).resolves.toBe(sandbox);

    expect(stop).toHaveBeenCalledOnce();
  });

  it('releases a provisioned sandbox when persisting its provider id fails', async () => {
    const stop = vi.fn(async () => {});
    const sandbox = {
      id: 'derived-1',
      start: vi.fn(async () => {}),
      stop,
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: 'derived-1' } })),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
    const subject = fleet({ maxSandboxes: 1 });
    subject.setFactory(() => sandbox);
    const store = {
      sandboxId: null as string | null,
      setSandboxId: vi
        .fn<(id: string | null) => Promise<void>>()
        .mockRejectedValueOnce(new Error('storage unavailable'))
        .mockImplementation(async id => {
          store.sandboxId = id;
        }),
      clear: vi.fn(async () => {}),
    };

    await expect(subject.ensureSandbox(store)).rejects.toThrow('storage unavailable');
    await expect(subject.ensureSandbox(store)).resolves.toBe(sandbox);

    expect(stop).toHaveBeenCalledOnce();
  });

  it('omits snapshot from the adapter when the provider does not implement it', async () => {
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'railway',
      supportsCheckpoints: true,
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
      _start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: 'derived-1' } })),
    }));
    const subject = new SandboxFleet({
      machine: { id: 'template', name: 'Template', provider: 'railway', clone } as unknown as WorkspaceSandbox,
      workdirBase: '/workspace',
    });
    const store = {
      sandboxId: null,
      setSandboxId: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };

    const sandbox = await subject.ensureSandbox(store);

    expect(sandbox.supportsCheckpoints).toBe(true);
    expect(sandbox.snapshot).toBeUndefined();
  });

  it('never bakes env into the machine clone — commands get it per execution', async () => {
    const executeCommand = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'local',
      executeCommand,
      _start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: 'derived-1' } })),
    }));
    const subject = new SandboxFleet({
      machine: { id: 'template', name: 'Template', provider: 'local', clone } as unknown as WorkspaceSandbox,
      workdirBase: '/workspace',
    });
    const store = {
      sandboxId: null as string | null,
      setSandboxId: vi.fn(async (id: string | null) => {
        store.sandboxId = id;
      }),
      clear: vi.fn(async () => {}),
    };

    const sandbox = await subject.ensureSandbox(store, { GH_TOKEN: 'secret-token' });
    await sandbox.executeCommand('gh auth status');

    // Remote providers persist creation-time env inside the VM for its whole
    // lifetime; a pooled VM claimed by another user must not carry this token.
    expect(clone).toHaveBeenCalledWith(expect.not.objectContaining({ env: expect.anything() }));
    expect(executeCommand).toHaveBeenCalledWith('gh auth status', undefined, {
      env: { GH_TOKEN: 'secret-token' },
    });
  });

  it('uses refreshed environment variables for future sandbox commands', async () => {
    const executeCommand = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'local',
      executeCommand,
      _start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: 'derived-1' } })),
    }));
    const subject = new SandboxFleet({
      machine: { id: 'template', name: 'Template', provider: 'local', clone } as unknown as WorkspaceSandbox,
      workdirBase: '/workspace',
    });
    const store = {
      sandboxId: null as string | null,
      setSandboxId: vi.fn(async (id: string | null) => {
        store.sandboxId = id;
      }),
      clear: vi.fn(async () => {}),
    };

    const sandbox = await subject.ensureSandbox(store, { GH_TOKEN: 'initial-token' });
    await sandbox.executeCommand('gh auth status');
    sandbox.setEnvironmentVariable?.('GH_TOKEN', 'fresh-token');
    await sandbox.executeCommand('gh auth status', undefined, { env: { OTHER: 'value' } });
    await sandbox.executeCommand('gh repo view');

    expect(executeCommand).toHaveBeenNthCalledWith(1, 'gh auth status', undefined, {
      env: { GH_TOKEN: 'initial-token' },
    });
    expect(executeCommand).toHaveBeenNthCalledWith(2, 'gh auth status', undefined, {
      env: { GH_TOKEN: 'fresh-token', OTHER: 'value' },
    });
    expect(executeCommand).toHaveBeenNthCalledWith(3, 'gh repo view', undefined, {
      env: { GH_TOKEN: 'fresh-token' },
    });
  });
});

describe('provision coalescing', () => {
  function bindingStore(checkpointName?: string): SandboxBindingStore & { sandboxId: string | null } {
    const store = {
      sandboxId: null as string | null,
      ...(checkpointName ? { checkpointName } : {}),
      setSandboxId: vi.fn(async (id: string | null) => {
        store.sandboxId = id;
      }),
      clear: vi.fn(async () => {
        store.sandboxId = null;
      }),
    };
    return store;
  }

  /** Sandbox whose `start()` stays pending until released, to hold calls in flight. */
  function slowSandbox(id: string) {
    let release!: () => void;
    let fail!: (error: Error) => void;
    const gate = new Promise<void>((resolve, reject) => {
      release = resolve;
      fail = reject;
    });
    const sandbox: MaterializationSandbox = {
      id,
      start: vi.fn(() => gate),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: id } })),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
      stop: vi.fn(async () => {}),
    };
    return { sandbox, release, fail };
  }

  it('coalesces concurrent ensureSandbox calls for the same binding into one provision', async () => {
    const { sandbox, release } = slowSandbox('sb-1');
    const factory = vi.fn(() => sandbox);
    const subject = fleet();
    subject.setFactory(factory);
    const store = bindingStore('mastracode-session-a');

    const first = subject.ensureSandbox(store, { GH_TOKEN: 'token' });
    const second = subject.ensureSandbox(store, { GH_TOKEN: 'token' });
    release();

    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(sandbox);
    expect(b).toBe(sandbox);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(sandbox.start).toHaveBeenCalledTimes(1);
    expect(store.setSandboxId).toHaveBeenCalledTimes(1);
  });

  it('forwards seedCheckpointName to the factory on fresh provision', async () => {
    const { sandbox, release } = slowSandbox('sb-1');
    const factory = vi.fn(() => sandbox);
    const subject = fleet();
    subject.setFactory(factory);
    const store = { ...bindingStore('mastracode-session-a'), seedCheckpointName: 'repo-pr-1' };

    const pending = subject.ensureSandbox(store);
    release();
    await pending;

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ checkpointName: 'mastracode-session-a', seedCheckpointName: 'repo-pr-1' }),
    );
  });

  it('does not block provisioning across different bindings', async () => {
    const one = slowSandbox('sb-1');
    const two = slowSandbox('sb-2');
    const sandboxes = [one.sandbox, two.sandbox];
    const factory = vi.fn(() => sandboxes.shift()!);
    const subject = fleet();
    subject.setFactory(factory);

    const first = subject.ensureSandbox(bindingStore('mastracode-session-a'));
    const second = subject.ensureSandbox(bindingStore('mastracode-session-b'));
    one.release();
    two.release();

    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(one.sandbox);
    expect(b).toBe(two.sandbox);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('does not coalesce bindings without a stable key', async () => {
    const one = slowSandbox('sb-1');
    const two = slowSandbox('sb-2');
    const sandboxes = [one.sandbox, two.sandbox];
    const factory = vi.fn(() => sandboxes.shift()!);
    const subject = fleet();
    subject.setFactory(factory);

    // No checkpointName and no stored sandbox id — two distinct bindings must
    // each get their own sandbox instead of sharing one.
    const first = subject.ensureSandbox(bindingStore());
    const second = subject.ensureSandbox(bindingStore());
    one.release();
    two.release();

    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(one.sandbox);
    expect(b).toBe(two.sandbox);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('retries fresh after a failed provision instead of caching the rejection', async () => {
    const failed = slowSandbox('sb-fail');
    const ok = slowSandbox('sb-ok');
    const sandboxes = [failed.sandbox, ok.sandbox];
    const factory = vi.fn(() => sandboxes.shift()!);
    const subject = fleet();
    subject.setFactory(factory);
    const store = bindingStore('mastracode-session-a');

    const first = subject.ensureSandbox(store);
    failed.fail(new Error('boom'));
    await expect(first).rejects.toThrow('boom');

    const second = subject.ensureSandbox(store);
    ok.release();
    await expect(second).resolves.toBe(ok.sandbox);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('tears down a coalesced sandbox regardless of which caller holds the handle', async () => {
    const { sandbox, release } = slowSandbox('sb-1');
    const subject = fleet();
    subject.setFactory(() => sandbox);
    const store = bindingStore('mastracode-session-a');

    const first = subject.ensureSandbox(store);
    const second = subject.ensureSandbox(store);
    release();
    const [, shared] = await Promise.all([first, second]);

    await subject.teardownSandbox(store, shared);
    expect(sandbox.stop).toHaveBeenCalledTimes(1);
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(store.sandboxId).toBeNull();
  });
});

describe('LocalSandbox end-to-end through the fleet', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  function localFleet(machine: LocalSandbox): SandboxFleet {
    return new SandboxFleet({ machine, workdirBase: tempDir });
  }

  function bindingStore(extra: Partial<SandboxBindingStore> = {}): SandboxBindingStore & { sandboxId: string | null } {
    const store = {
      sandboxId: null as string | null,
      setSandboxId: vi.fn(async (id: string | null) => {
        store.sandboxId = id;
      }),
      clear: vi.fn(async () => {
        store.sandboxId = null;
      }),
      ...extra,
    };
    return store;
  }

  it('seeds a fresh session sandbox from a repo base checkpoint and snapshots to the session checkpoint', async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'fleet-local-e2e-'));
    const checkpointsDirectory = path.join(tempDir, '.checkpoints');
    const machine = new LocalSandbox({ workingDirectory: path.join(tempDir, 'template'), checkpointsDirectory });

    // 1. Base-checkpoint build: boot a builder sandbox, "clone + setup", snapshot.
    const fleetA = localFleet(machine);
    const builderStore = bindingStore({ checkpointName: 'repo-pr-1' });
    const builderWorkdir = path.join(tempDir, 'builder-work');
    const builder = await fleetA.ensureSandbox(builderStore, undefined, undefined, {
      workingDirectory: builderWorkdir,
    });
    await fs.writeFile(path.join(builderWorkdir, 'cloned.txt'), 'repo');
    await fs.writeFile(path.join(builderWorkdir, 'node_modules.txt'), 'installed');
    await builder.snapshot?.();
    await fleetA.teardownSandbox(builderStore, builder);

    // 2. New session: seeds from the base checkpoint on first provision.
    const sessionStore = bindingStore({
      checkpointName: 'mastracode-session-s1',
      seedCheckpointName: 'repo-pr-1',
    });
    const sessionWorkdir = path.join(tempDir, 'session-work');
    const session = await localFleet(machine).ensureSandbox(sessionStore, undefined, undefined, {
      workingDirectory: sessionWorkdir,
    });
    expect(await fs.readFile(path.join(sessionWorkdir, 'cloned.txt'), 'utf-8')).toBe('repo');
    expect(await fs.readFile(path.join(sessionWorkdir, 'node_modules.txt'), 'utf-8')).toBe('installed');

    // 3. Session snapshots write to the session checkpoint; the base image stays untouched.
    await fs.writeFile(path.join(sessionWorkdir, 'session-edit.txt'), 'work');
    await session.snapshot?.();
    expect((await fs.readdir(path.join(checkpointsDirectory, 'repo-pr-1'))).sort()).toEqual([
      'cloned.txt',
      'node_modules.txt',
    ]);
    expect(await fs.readdir(path.join(checkpointsDirectory, 'mastracode-session-s1'))).toContain('session-edit.txt');
  });
});

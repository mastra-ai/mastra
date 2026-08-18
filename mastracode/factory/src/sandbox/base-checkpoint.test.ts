import { describe, expect, it, vi } from 'vitest';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { BaseCheckpointBuilder, baseCheckpointName, hashSetupCommand } from './base-checkpoint.js';
import { SandboxFleet } from './fleet.js';
import type { MaterializationSandbox, SandboxCreateOptions } from './fleet.js';

interface FakeSandbox extends MaterializationSandbox {
  scripts: string[];
  snapshotCalls: number;
  stopped: boolean;
}

/** Scripted sandbox that behaves like a fresh VM with git installed. */
function fakeSandbox(opts: { supportsCheckpoints?: boolean; failCommand?: RegExp } = {}): FakeSandbox {
  const scripts: string[] = [];
  const sandbox: FakeSandbox = {
    id: 'sb-1',
    scripts,
    snapshotCalls: 0,
    stopped: false,
    start: async () => {},
    getInfo: async () => ({ metadata: { sandboxId: 'provider-sb-1' } }),
    executeCommand: async (_cmd, args) => {
      const script = args?.[1] ?? '';
      scripts.push(script);
      if (opts.failCommand?.test(script)) return { exitCode: 1, stdout: '', stderr: 'boom' };
      // Fresh VM: no existing checkout yet.
      if (script.includes('remote get-url origin')) return { exitCode: 1, stdout: '', stderr: 'not a git repo' };
      if (script.includes('rev-parse HEAD')) return { exitCode: 0, stdout: 'abc123\n', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    stop: async () => {
      sandbox.stopped = true;
    },
    supportsCheckpoints: opts.supportsCheckpoints ?? true,
    snapshot: async () => {
      sandbox.snapshotCalls += 1;
    },
  };
  return sandbox;
}

function fleetWith(build: (opts: SandboxCreateOptions) => MaterializationSandbox): SandboxFleet {
  const fleet = new SandboxFleet({
    machine: { id: 't', name: 't', provider: 'test', clone: () => ({}) } as any,
    workdirBase: '/workspace',
  });
  fleet.setFactory(build);
  return fleet;
}

function fakeStorage() {
  const setBaseCheckpoint = vi.fn(async () => {});
  return {
    handle: { projectRepositories: { setBaseCheckpoint } } as unknown as SourceControlStorageHandle,
    setBaseCheckpoint,
  };
}

function job(storage: SourceControlStorageHandle, overrides: Record<string, unknown> = {}) {
  return {
    projectRepositoryId: 'pr-1',
    repoFullName: 'acme/app',
    defaultBranch: 'main',
    setupCommand: 'pnpm install',
    workdir: '/workspace/acme/app',
    getToken: async () => 'tok',
    storage,
    ...overrides,
  };
}

describe('baseCheckpointName / hashSetupCommand', () => {
  it('derives a stable checkpoint name from the project repository id', () => {
    expect(baseCheckpointName('pr-1')).toBe('repo-pr-1');
  });

  it('hashes the setup command and treats null as null', () => {
    expect(hashSetupCommand(null)).toBeNull();
    expect(hashSetupCommand('pnpm install')).toBe(hashSetupCommand('pnpm install'));
    expect(hashSetupCommand('pnpm install')).not.toBe(hashSetupCommand('npm ci'));
  });
});

describe('BaseCheckpointBuilder', () => {
  it('clones, runs setup, snapshots, stores metadata, and tears down', async () => {
    const sandbox = fakeSandbox();
    const created: SandboxCreateOptions[] = [];
    const fleet = fleetWith(opts => {
      created.push(opts);
      return sandbox;
    });
    const storage = fakeStorage();
    const builder = new BaseCheckpointBuilder({ fleet });

    await builder.request(job(storage.handle));

    expect(created[0]?.checkpointName).toBe('repo-pr-1');
    expect(sandbox.scripts.some(s => s.includes('git clone'))).toBe(true);
    expect(sandbox.scripts.some(s => s.includes('pnpm install'))).toBe(true);
    expect(sandbox.snapshotCalls).toBe(1);
    expect(sandbox.stopped).toBe(true);
    expect(storage.setBaseCheckpoint).toHaveBeenCalledWith({
      id: 'pr-1',
      checkpoint: expect.objectContaining({
        name: 'repo-pr-1',
        sha: 'abc123',
        setupCommandHash: hashSetupCommand('pnpm install'),
      }),
    });
  });

  it('skips snapshot and metadata for sandboxes without checkpoint support', async () => {
    const sandbox = fakeSandbox({ supportsCheckpoints: false });
    const fleet = fleetWith(() => sandbox);
    const storage = fakeStorage();
    const builder = new BaseCheckpointBuilder({ fleet });

    await builder.request(job(storage.handle));

    expect(sandbox.snapshotCalls).toBe(0);
    expect(storage.setBaseCheckpoint).not.toHaveBeenCalled();
    expect(sandbox.stopped).toBe(true);
  });

  it('logs and swallows build failures, still tearing down the sandbox', async () => {
    const sandbox = fakeSandbox({ failCommand: /git clone/ });
    const fleet = fleetWith(() => sandbox);
    const storage = fakeStorage();
    const warn = vi.fn();
    const builder = new BaseCheckpointBuilder({ fleet, logger: { warn } as any });

    await expect(builder.request(job(storage.handle))).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    expect(storage.setBaseCheckpoint).not.toHaveBeenCalled();
    expect(sandbox.stopped).toBe(true);
  });

  it('coalesces triggers arriving mid-build into exactly one follow-up build', async () => {
    let builds = 0;
    let releaseFirstBuild!: () => void;
    const gate = new Promise<void>(resolve => (releaseFirstBuild = resolve));
    const fleet = fleetWith(() => {
      builds += 1;
      const sandbox = fakeSandbox();
      if (builds === 1) {
        const original = sandbox.start;
        sandbox.start = async () => {
          await gate;
          await original();
        };
      }
      return sandbox;
    });
    const storage = fakeStorage();
    const builder = new BaseCheckpointBuilder({ fleet });

    const first = builder.request(job(storage.handle));
    const second = builder.request(job(storage.handle));
    const third = builder.request(job(storage.handle));
    expect(builder.isBuilding('pr-1')).toBe(true);
    releaseFirstBuild();
    await Promise.all([first, second, third]);

    // Three triggers → the in-flight build plus exactly one follow-up.
    expect(builds).toBe(2);
    expect(builder.isBuilding('pr-1')).toBe(false);
  });

  it('builds different repos independently', async () => {
    const fleet = fleetWith(() => fakeSandbox());
    const storage = fakeStorage();
    const builder = new BaseCheckpointBuilder({ fleet });

    await Promise.all([
      builder.request(job(storage.handle)),
      builder.request(job(storage.handle, { projectRepositoryId: 'pr-2' })),
    ]);

    expect(storage.setBaseCheckpoint).toHaveBeenCalledTimes(2);
    const names = storage.setBaseCheckpoint.mock.calls.map((c: any[]) => c[0].checkpoint.name);
    expect(names.sort()).toEqual(['repo-pr-1', 'repo-pr-2']);
  });
});

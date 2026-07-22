import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from '../runtime-config';
import {
  computeLocalSessionSandboxWorkdir,
  computeSandboxWorkdir,
  ensureSandbox,
  getSandboxIdleMinutes,
  getSandboxProvider,
  isSandboxEnabled,
  reattachSandbox,
  resetSandboxFactory,
  resolveContainedLocalWorkdir,
  setSandboxFactory,
  type MaterializationSandbox,
} from './fleet';

/** Minimal cloneable template sandbox standing in for Railway/Local instances. */
function templateSandbox(opts: { provider?: string; idleTimeoutMinutes?: number } = {}): WorkspaceSandbox {
  const template = {
    id: 'template-1',
    name: 'Template',
    provider: opts.provider ?? 'railway',
    ...(opts.idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes: opts.idleTimeoutMinutes } : {}),
    clone: () => template,
  };
  return template as unknown as WorkspaceSandbox;
}

/** Seed the runtime-config registry with a factory-shaped sandbox runtime. */
function seedSandboxRuntime(
  opts: {
    provider?: string;
    idleTimeoutMinutes?: number;
    workdirBase?: string;
    workingDirectory?: string;
    maxSandboxes?: number;
  } = {},
): void {
  seedRuntimeConfig({
    sandbox: {
      machine: Object.assign(templateSandbox(opts), {
        ...(opts.workingDirectory !== undefined ? { workingDirectory: opts.workingDirectory } : {}),
      }),
      workdirBase: opts.workdirBase ?? '/workspace',
      ...(opts.maxSandboxes !== undefined ? { maxSandboxes: opts.maxSandboxes } : {}),
    },
  });
}

afterEach(() => {
  resetSandboxFactory();
  __resetRuntimeConfigForTests();
});

describe('getSandboxProvider', () => {
  it('reports the seeded template provider', () => {
    seedSandboxRuntime({ provider: 'railway' });
    expect(getSandboxProvider()).toBe('railway');
    __resetRuntimeConfigForTests();
    seedSandboxRuntime({ provider: 'local' });
    expect(getSandboxProvider()).toBe('local');
  });

  it('reports none when no sandbox is configured', () => {
    expect(getSandboxProvider()).toBe('none');
  });
});

describe('isSandboxEnabled', () => {
  it('is true when a sandbox template is seeded', () => {
    seedSandboxRuntime();
    expect(isSandboxEnabled()).toBe(true);
  });

  it('is false when no sandbox is configured', () => {
    expect(isSandboxEnabled()).toBe(false);
  });
});

describe('computeSandboxWorkdir', () => {
  it('nests owner/name under the default /workspace base', () => {
    seedSandboxRuntime();
    expect(computeSandboxWorkdir('octocat/hello')).toBe('/workspace/octocat/hello');
  });

  it('nests owner/name under a configured base', () => {
    seedSandboxRuntime({ workdirBase: '/srv/checkouts' });
    expect(computeSandboxWorkdir('octocat/hello')).toBe('/srv/checkouts/octocat/hello');
  });

  it('sanitizes unsafe path segments', () => {
    seedSandboxRuntime();
    expect(computeSandboxWorkdir('ac me/.hidden repo')).toBe('/workspace/ac-me/hidden-repo');
  });

  it('throws when no sandbox is configured', () => {
    expect(() => computeSandboxWorkdir('octocat/hello')).toThrow(/No sandbox configured/);
  });
});

describe('getSandboxIdleMinutes', () => {
  it('defaults to 30 minutes when the template does not expose one', () => {
    seedSandboxRuntime();
    expect(getSandboxIdleMinutes()).toBe(30);
  });

  it('defaults to 30 minutes when no sandbox is configured', () => {
    expect(getSandboxIdleMinutes()).toBe(30);
  });

  it('reads the window back from the template sandbox', () => {
    seedSandboxRuntime({ idleTimeoutMinutes: 45 });
    expect(getSandboxIdleMinutes()).toBe(45);
  });
});

describe('computeLocalSessionSandboxWorkdir', () => {
  it('builds deterministic session checkout paths under the local sandbox root', () => {
    seedSandboxRuntime({ provider: 'local', workingDirectory: '/tmp/mastracode-local-root' });

    expect(computeLocalSessionSandboxWorkdir('octocat/hello', 'session-1')).toBe(
      path.resolve('/tmp/mastracode-local-root/github-sessions/octocat/hello/session-1'),
    );
  });

  it('sanitizes repo path segments and keeps the result contained', () => {
    seedSandboxRuntime({ provider: 'local', workingDirectory: '/tmp/mastracode-local-root' });

    const result = computeLocalSessionSandboxWorkdir('..owner/..hidden repo', '../../session');

    expect(result).toBe(path.resolve('/tmp/mastracode-local-root/github-sessions/owner/hidden-repo/-..-session'));
    expect(result.startsWith(path.resolve('/tmp/mastracode-local-root') + path.sep)).toBe(true);
  });

  it('throws when the active provider is not local', () => {
    seedSandboxRuntime({ provider: 'railway' });

    expect(() => computeLocalSessionSandboxWorkdir('octocat/hello', 'session-1')).toThrow(/local sandbox provider/);
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

  it('passes provider working directory through fresh provisioning and reattach', async () => {
    const calls: unknown[] = [];
    const sandbox = fakeSandbox();
    setSandboxFactory(opts => {
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

    await ensureSandbox(store, { GH_TOKEN: 'token' }, undefined, { workingDirectory: '/tmp/session-1' });
    await ensureSandbox(store, { GH_TOKEN: 'token' }, undefined, { workingDirectory: '/tmp/session-1' });

    expect(calls).toEqual([
      expect.objectContaining({ env: { GH_TOKEN: 'token' }, workingDirectory: '/tmp/session-1' }),
      expect.objectContaining({
        providerSandboxId: 'sb-1',
        env: { GH_TOKEN: 'token' },
        workingDirectory: '/tmp/session-1',
      }),
    ]);
  });

  it('passes provider working directory through direct reattach', async () => {
    const factory = vi.fn(() => fakeSandbox('sb-2'));
    setSandboxFactory(factory);

    await reattachSandbox('sb-2', { workingDirectory: '/tmp/session-2' });

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSandboxId: 'sb-2',
        workingDirectory: '/tmp/session-2',
      }),
    );
  });

  it('forwards provider working directory into the seeded machine clone call', async () => {
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'local',
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
      _start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: 'derived-1' } })),
    }));
    seedRuntimeConfig({
      sandbox: {
        machine: { id: 'template', name: 'Template', provider: 'local', clone } as unknown as WorkspaceSandbox,
        workdirBase: '/workspace',
      },
    });

    await reattachSandbox('derived-1', { workingDirectory: '/tmp/session-3' });

    expect(clone).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'derived-1',
        sandboxId: 'derived-1',
        workingDirectory: '/tmp/session-3',
      }),
    );
  });
});

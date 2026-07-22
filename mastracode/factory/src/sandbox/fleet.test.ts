import path from 'node:path';

import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';
import { resolveContainedLocalWorkdir, SandboxFleet } from './fleet.js';
import type { MaterializationSandbox } from './fleet.js';

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

  it('passes provider working directory through fresh provisioning and reattach', async () => {
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

    await subject.ensureSandbox(store, { GH_TOKEN: 'token' }, undefined, { workingDirectory: '/tmp/session-1' });
    await subject.ensureSandbox(store, { GH_TOKEN: 'token' }, undefined, { workingDirectory: '/tmp/session-1' });

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
    const subject = fleet();
    subject.setFactory(factory);

    await subject.reattachSandbox('sb-2', { workingDirectory: '/tmp/session-2' });

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSandboxId: 'sb-2',
        workingDirectory: '/tmp/session-2',
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

  it('updates the underlying sandbox process environment', async () => {
    const setEnvironmentVariable = vi.fn();
    const clone = vi.fn(() => ({
      id: 'derived-1',
      provider: 'local',
      setEnvironmentVariable,
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
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
    sandbox.setEnvironmentVariable?.('GH_TOKEN', 'fresh-token');

    expect(setEnvironmentVariable).toHaveBeenCalledWith('GH_TOKEN', 'fresh-token');
  });
});

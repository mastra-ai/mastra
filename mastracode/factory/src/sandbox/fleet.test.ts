import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';
import { SandboxFleet } from './fleet';

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

/** Build a fleet from a factory-shaped sandbox runtime. */
function fleet(
  opts: { provider?: string; idleTimeoutMinutes?: number; workdirBase?: string; maxSandboxes?: number } = {},
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

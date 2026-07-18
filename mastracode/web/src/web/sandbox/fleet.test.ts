import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { __resetRuntimeConfigForTests, seedRuntimeConfig } from '../runtime-config';
import {
  computeSandboxWorkdir,
  getSandboxIdleMinutes,
  getSandboxProvider,
  isSandboxEnabled,
  resetSandboxFactory,
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
  opts: { provider?: string; idleTimeoutMinutes?: number; workdirBase?: string; maxSandboxes?: number } = {},
): void {
  seedRuntimeConfig({
    sandbox: {
      machine: templateSandbox(opts),
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

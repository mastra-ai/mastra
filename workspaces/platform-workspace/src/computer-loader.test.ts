import { afterEach, describe, expect, it, vi } from 'vitest';

const loaded = vi.hoisted(() => ({ computer: 0, accessibility: 0 }));

vi.mock('./computer.js', async importOriginal => {
  loaded.computer++;
  return importOriginal();
});
vi.mock('./computer-accessibility.js', async importOriginal => {
  loaded.accessibility++;
  return importOriginal();
});

const base = { accessToken: 'sk_test', projectId: 'proj_123', environmentId: 'env_123' };

describe('computer module isolation', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('never loads the computer module without MASTRA_EXPERIMENTAL_COMPUTER', async () => {
    const { PlatformSandbox, Template } = await import('./index.js');
    const sandbox = new PlatformSandbox({ ...base, computer: true, template: Template() });
    expect(sandbox.computer).toBeUndefined();
    expect(loaded).toEqual({ computer: 0, accessibility: 0 });
  });

  it('with the flag set, loads it on the first computer call, not at construction', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true');
    const { PlatformSandbox, Template } = await import('./index.js');
    const sandbox = new PlatformSandbox({
      ...base,
      computer: true,
      template: Template().desktop(),
      fetch: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    expect(sandbox.computer).toBeDefined();
    expect(loaded).toEqual({ computer: 0, accessibility: 0 });
    await sandbox.computer!.screenshot().catch(() => undefined);
    expect(loaded).toEqual({ computer: 1, accessibility: 1 });
  });
});

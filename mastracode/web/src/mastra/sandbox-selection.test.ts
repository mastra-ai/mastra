import { join } from 'node:path';
import { LocalSandbox } from '@mastra/core/workspace';
import { E2BSandbox, repoTemplateAlias, isNamedTemplateSpec } from '@mastra/e2b';
import { PlatformSandbox } from '@mastra/platform-workspace';
import type { FactorySandboxContext } from '@mastra/factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { selectSandboxConfig } from './sandbox-selection';

const PLATFORM_ENV = {
  MASTRA_ENVIRONMENT_ID: 'env-1',
  MASTRA_PROJECT_ID: 'proj-1',
  MASTRA_PLATFORM_SECRET_KEY: 'k',
};

const CTX: FactorySandboxContext = {
  sessionId: 'session-1',
  workdir: '/workspace/octocat/hello',
  repoFullName: 'octocat/hello',
  repoSha: 'a'.repeat(40),
  setupCommand: 'pnpm install',
  idleTimeoutMinutes: 30,
  onStart: async () => {},
};

function select(env: Record<string, string | undefined>) {
  return selectSandboxConfig({ env, localRoot: '/tmp/sandbox-root', localEnv: () => ({ HOME: '/home/u' }) });
}

describe('selectSandboxConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers Platform when the identity trio is set, even with an E2B key', () => {
    // PlatformClient reads its credentials from the process env at
    // construction; the selection itself is driven by the injected env.
    for (const [key, value] of Object.entries(PLATFORM_ENV)) vi.stubEnv(key, value);
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'test-token');
    const config = select({ ...PLATFORM_ENV, E2B_API_KEY: 'e2b_x' });
    expect(config.create!(CTX)).toBeInstanceOf(PlatformSandbox);
  });

  it('selects E2B over Local when only E2B_API_KEY is set', () => {
    const config = select({ E2B_API_KEY: 'e2b_x' });
    const sandbox = config.create!(CTX);
    expect(sandbox).toBeInstanceOf(E2BSandbox);
    expect(sandbox.id).toBe('session-1');
  });

  it('gives repo-backed E2B sessions the sha-aliased template', () => {
    const config = select({ E2B_API_KEY: 'e2b_x' });
    const sandbox = config.create!(CTX) as E2BSandbox & { templateSpec?: unknown };
    const spec = (sandbox as never as { templateSpec: unknown }).templateSpec;
    expect(isNamedTemplateSpec(spec as never)).toBe(true);
    expect((spec as { alias: string }).alias).toBe(
      repoTemplateAlias({
        repoFullName: CTX.repoFullName!,
        sha: CTX.repoSha,
        setupCommand: CTX.setupCommand,
        workdir: CTX.workdir,
      }),
    );
  });

  it('omits the template for sessions without a repo', () => {
    const config = select({ E2B_API_KEY: 'e2b_x' });
    const sandbox = config.create!({ ...CTX, repoFullName: undefined, repoSha: undefined, setupCommand: undefined });
    expect((sandbox as never as { templateSpec: unknown }).templateSpec).toBeUndefined();
  });

  it('falls back to Local rooted at the per-session directory (parent of the checkout)', () => {
    const config = select({});
    const sandbox = config.create!(CTX);
    expect(sandbox).toBeInstanceOf(LocalSandbox);
    expect(config.localRoot).toBe('/tmp/sandbox-root');
    expect((sandbox as LocalSandbox).workingDirectory).toBe(join('/tmp/sandbox-root', 'session-1'));
  });

  it('treats blank env values as unset', () => {
    const config = select({ E2B_API_KEY: '   ', MASTRA_ENVIRONMENT_ID: '' });
    expect(config.create!(CTX)).toBeInstanceOf(LocalSandbox);
  });
});

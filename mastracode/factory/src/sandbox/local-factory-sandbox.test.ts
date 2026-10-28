import { homedir } from 'node:os';
import { join } from 'node:path';
import { describeFactorySandbox, LocalSandbox } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';
import { LocalFactorySandbox } from './local-factory-sandbox.js';

describe('LocalFactorySandbox', () => {
  it('roots each session under root/sessionId with the configured env', () => {
    const sandbox = new LocalFactorySandbox({ root: '/tmp/mc-sandboxes', env: { PATH: '/usr/bin' } });
    expect(describeFactorySandbox(sandbox)).toMatchObject({
      provider: 'local',
      capabilities: { template: false, builds: { available: false, history: false } },
    });
    const created = sandbox.create({ sessionId: 'sess-1', getRepositoryAccess: undefined }, {});
    expect(created).toBeInstanceOf(LocalSandbox);
    expect(created.id).toBe('sess-1');
    expect(created.workingDirectory).toBe(join('/tmp/mc-sandboxes', 'sess-1'));
    expect(created.env).toEqual({ PATH: '/usr/bin' });
  });

  it('defaults to MASTRACODE_LOCAL_SANDBOX_ROOT and an allow-listed host env', () => {
    vi.stubEnv('MASTRACODE_LOCAL_SANDBOX_ROOT', ' /tmp/mc-env-root ');
    vi.stubEnv('HOME', '/home/dev');
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'secret');
    try {
      const created = new LocalFactorySandbox().create({ sessionId: 'sess-2', getRepositoryAccess: undefined }, {});
      expect(created.workingDirectory).toBe(join('/tmp/mc-env-root', 'sess-2'));
      expect(created.env).toMatchObject({ HOME: '/home/dev' });
      expect(created.env).not.toHaveProperty('GITHUB_APP_PRIVATE_KEY');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('falls back to ~/.mastracode/web/sandboxes without a root override', () => {
    vi.stubEnv('MASTRACODE_LOCAL_SANDBOX_ROOT', '');
    try {
      const created = new LocalFactorySandbox().create({ sessionId: 'sess-3', getRepositoryAccess: undefined }, {});
      expect(created.workingDirectory).toBe(join(homedir(), '.mastracode', 'web', 'sandboxes', 'sess-3'));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

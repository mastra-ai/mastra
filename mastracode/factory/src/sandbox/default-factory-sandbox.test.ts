import { homedir } from 'node:os';
import { join } from 'node:path';
import { LocalSandbox } from '@mastra/core/workspace';
import { PlatformFactorySandbox } from '@mastra/platform-workspace';
import { describe, expect, it } from 'vitest';
import { hasPlatformSandboxEnv, localSandboxEnv, resolveDefaultFactorySandbox } from './default-factory-sandbox.js';

const complete = {
  MASTRA_PLATFORM_ACCESS_TOKEN: 'token',
  MASTRA_PROJECT_ID: 'proj',
  MASTRA_ENVIRONMENT_ID: 'env',
};

describe('resolveDefaultFactorySandbox', () => {
  it('picks the Platform sandbox when the platform env is complete', () => {
    const sandbox = resolveDefaultFactorySandbox(complete);
    expect(sandbox).toBeInstanceOf(PlatformFactorySandbox);
    expect(sandbox.provider).toBe('platform');
  });

  it('accepts a secret key in place of an access token', () => {
    const { MASTRA_PLATFORM_ACCESS_TOKEN: _, ...rest } = complete;
    expect(resolveDefaultFactorySandbox({ ...rest, MASTRA_PLATFORM_SECRET_KEY: 'sk' }).provider).toBe('platform');
  });

  it('falls back to local when the environment id is missing', () => {
    const { MASTRA_ENVIRONMENT_ID: _, ...partial } = complete;
    expect(hasPlatformSandboxEnv(partial)).toBe(false);
    expect(resolveDefaultFactorySandbox(partial).provider).toBe('local');
  });

  it('falls back to local when the project id is missing', () => {
    const { MASTRA_PROJECT_ID: _, ...partial } = complete;
    expect(resolveDefaultFactorySandbox(partial).provider).toBe('local');
  });

  it('treats whitespace-only values as missing', () => {
    expect(resolveDefaultFactorySandbox({ ...complete, MASTRA_PLATFORM_ACCESS_TOKEN: '  ' }).provider).toBe('local');
    expect(resolveDefaultFactorySandbox({ ...complete, MASTRA_ENVIRONMENT_ID: ' ' }).provider).toBe('local');
  });

  it('roots local sessions under ~/.mastracode/factory/sandboxes', async () => {
    const sandbox = resolveDefaultFactorySandbox({});
    expect(sandbox.provider).toBe('local');
    const created = await sandbox.create({ sessionId: 's1' } as never, {});
    expect(created).toBeInstanceOf(LocalSandbox);
    expect((created as LocalSandbox).workingDirectory).toBe(
      join(homedir(), '.mastracode', 'factory', 'sandboxes', 's1'),
    );
  });
});

describe('localSandboxEnv', () => {
  it('keeps allowlisted keys and drops server secrets', () => {
    const env = localSandboxEnv({
      HOME: '/home/me',
      LANG: '',
      DATABASE_URL: 'postgres://secret',
      GITHUB_APP_PRIVATE_KEY: 'pem',
      MASTRA_PLATFORM_SECRET_KEY: 'sk',
    });
    expect(env).toEqual({ HOME: '/home/me' });
  });
});

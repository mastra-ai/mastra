import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { E2BSandbox } from '@mastra/e2b';
import { PlatformSandbox } from '@mastra/platform-workspace';
import { createRemoteFactorySandbox } from './sandbox-provider.js';

describe('createRemoteFactorySandbox', () => {
  beforeEach(() => {
    vi.stubEnv('E2B_API_KEY', '');
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_PROJECT_ID', 'project-1');
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'environment-1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers PlatformSandbox and forwards a credential-free, commit-addressed Factory template', async () => {
    vi.stubEnv('E2B_API_KEY', 'direct-e2b-must-not-win');
    const onStart = vi.fn();
    const getGithubToken = vi.fn();
    const resolveRepoHead = vi.fn().mockResolvedValue('0123456789abcdef0123456789abcdef01234567');
    const sandbox = createRemoteFactorySandbox(
      {
        sessionId: 'session-1',
        repoFullName: 'acme/widgets',
        setupCommand: 'pnpm install',
        onStart,
        getGithubToken,
        actingUserId: 'user-1',
      },
      { platformAccessToken: 'sk_platform', resolveRepoHead },
    );

    expect(sandbox).toBeInstanceOf(PlatformSandbox);
    expect(sandbox).toMatchObject({ id: 'session-1' });
    const resolveTemplate = (sandbox as unknown as { _template: () => Promise<unknown> })._template;
    const definition = await resolveTemplate();
    expect(resolveRepoHead).toHaveBeenCalledWith('acme/widgets');
    expect(getGithubToken).not.toHaveBeenCalled();
    expect(definition).toEqual({
      schemaVersion: 1,
      operations: [
        {
          method: 'runCmd',
          args: [
            [
              'git clone https://github.com/acme/widgets.git "$HOME/widgets"',
              'git -C "$HOME/widgets" fetch origin 0123456789abcdef0123456789abcdef01234567',
              'git -C "$HOME/widgets" checkout 0123456789abcdef0123456789abcdef01234567',
              'cd "$HOME/widgets" && pnpm install',
            ],
          ],
        },
      ],
    });
    expect(JSON.stringify(definition)).not.toContain('token');
    expect((sandbox as unknown as { _onStart?: unknown })._onStart).toBe(onStart);
    expect(
      (sandbox as unknown as { _client?: { actingUserId?: string; sandboxProvider?: string } })._client,
    ).toMatchObject({
      actingUserId: 'user-1',
      sandboxProvider: 'e2b',
    });
  });

  it('leaves inaccessible repositories to the authenticated runtime fallback without requesting a build token', async () => {
    const getGithubToken = vi.fn();
    const sandbox = createRemoteFactorySandbox(
      {
        sessionId: 'session-private',
        repoFullName: 'acme/private-widgets',
        getGithubToken,
      },
      {
        platformAccessToken: 'sk_platform',
        resolveRepoHead: vi.fn().mockResolvedValue(undefined),
      },
    );

    const resolveTemplate = (sandbox as unknown as { _template: () => Promise<unknown> })._template;
    await expect(resolveTemplate()).resolves.toBeUndefined();
    expect(getGithubToken).not.toHaveBeenCalled();
  });

  it('retains direct E2BSandbox for non-Platform remote deployments', () => {
    vi.stubEnv('E2B_API_KEY', 'direct-e2b');
    const getGithubToken = vi.fn();
    const sandbox = createRemoteFactorySandbox(
      {
        sessionId: 'session-2',
        repoFullName: 'acme/widgets',
        getGithubToken,
      },
      {},
    );

    expect(sandbox).toBeInstanceOf(E2BSandbox);
    expect(sandbox).toMatchObject({ id: 'session-2' });
  });

  it('returns undefined when no remote provider is configured', () => {
    expect(createRemoteFactorySandbox({ sessionId: 'session-3' }, {})).toBeUndefined();
  });
});

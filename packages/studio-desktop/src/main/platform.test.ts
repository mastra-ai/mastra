import { describe, expect, it, vi } from 'vitest';
import {
  buildHostedStudioLoginUrl,
  buildPlatformCliLoginUrl,
  fetchPlatformProjects,
  isLaunchableStudioStatus,
  refreshPlatformAccessToken,
} from './platform';
import type { PlatformSession } from './platform';

const session: PlatformSession = {
  baseUrl: 'https://platform.mastra.ai',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  organizationId: 'org_1',
};

describe('Platform desktop helpers', () => {
  it('builds the existing CLI OAuth login URL', () => {
    const url = new URL(buildPlatformCliLoginUrl('https://platform.mastra.ai', 52881, 'state-1'));
    expect(url.pathname).toBe('/v1/auth/login');
    expect(url.searchParams.get('product')).toBe('cli');
    expect(url.searchParams.get('cli_port')).toBe('52881');
    expect(url.searchParams.get('state')).toBe('state-1');
  });

  it('builds a hosted Studio deploy SSO URL', () => {
    const url = new URL(buildHostedStudioLoginUrl('https://platform.mastra.ai', 'https://demo.studio.mastra.cloud'));
    expect(url.pathname).toBe('/v1/auth/login');
    expect(url.searchParams.get('product')).toBe('deploy');
    expect(url.searchParams.get('redirect_uri')).toBe('https://demo.studio.mastra.cloud/api/auth/sso/callback');
    expect(url.searchParams.get('post_login_redirect')).toBe('/');
  });

  it('uses strict launchability statuses', () => {
    expect(isLaunchableStudioStatus('running')).toBe(true);
    expect(isLaunchableStudioStatus('sleeping')).toBe(true);
    expect(isLaunchableStudioStatus('stopped')).toBe(true);
    expect(isLaunchableStudioStatus('deploying')).toBe(false);
    expect(isLaunchableStudioStatus('failed')).toBe(false);
  });

  it('fetches orgs and projects with bearer auth and org scope', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          organizations: [{ id: 'org_1', name: 'Org', role: 'admin', isCurrent: true }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          projects: [
            {
              id: 'proj_1',
              slug: 'demo',
              name: 'Demo',
              organizationId: 'org_1',
              studioEnabled: true,
              serverEnabled: false,
              latestDeployStatus: 'running',
              latestDeployCreatedAt: null,
              instanceUrl: 'https://demo.studio.mastra.cloud',
              serverInstanceUrl: null,
            },
          ],
        }),
      ) as unknown as typeof fetch;

    await expect(fetchPlatformProjects(session, fetchImpl)).resolves.toMatchObject({
      organizationId: 'org_1',
      projects: [{ id: 'proj_1' }],
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://platform.mastra.ai/v1/studio/projects',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'x-organization-id': 'org_1',
        }),
      }),
    );
  });

  it('refreshes Platform access tokens', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
    ) as unknown as typeof fetch;

    await expect(refreshPlatformAccessToken(session, fetchImpl)).resolves.toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });
});

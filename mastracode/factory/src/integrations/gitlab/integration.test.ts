import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { GitLabIntegration } from './integration.js';
import type { GitLabTokenSet } from './oauth.js';

// Only the network edge is mocked: storage, single-flight, and expiry logic all
// run the production code paths against the seeded `:memory:` backend.
const refreshAccessToken = vi.fn<(...args: never[]) => Promise<GitLabTokenSet>>();

vi.mock('./oauth.js', async importOriginal => ({
  ...(await importOriginal<typeof import('./oauth.js')>()),
  refreshAccessToken: (...args: never[]) => refreshAccessToken(...args),
}));

let seed!: FactoryStorageTestSeed;

function integration(options: { accessToken?: string; withOAuthApp?: boolean } = {}): GitLabIntegration {
  const gitlab = new GitLabIntegration({
    ...(options.withOAuthApp === false ? {} : { clientId: 'gl_client', clientSecret: 'gl_secret' }),
    ...(options.accessToken ? { accessToken: options.accessToken } : {}),
  });
  gitlab.initialize({
    storage: seed.integrations.forIntegration('gitlab'),
    projects: seed.projects,
    auth: fakeRouteAuth(),
  });
  return gitlab;
}

/** Stored OAuth grant for `org1`. `expiresAt` is absolute epoch ms. */
function connect(data: Record<string, unknown> = {}) {
  return seed.integrations.forIntegration('gitlab').connections.upsert('org1', {
    userId: 'u1',
    data: {
      accessToken: 'gl-access',
      refreshToken: 'gl-refresh',
      expiresAt: Date.now() + 60 * 60 * 1000,
      ...data,
    },
  });
}

/**
 * Drives credential resolution through the public capability. `resolveIntakeDispatch`
 * is the shortest public path to the resolved token — it reaches
 * `resolveConnectionData` without needing a network round-trip.
 */
function resolve(gitlab: GitLabIntegration) {
  return gitlab.intake.resolveIntakeDispatch({
    orgId: 'org1',
    externalSource: { type: 'issue', externalId: '42!7' },
  });
}

function storedConnection() {
  return seed.integrations.forIntegration('gitlab').connections.get('org1');
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  refreshAccessToken.mockReset();
  refreshAccessToken.mockResolvedValue({
    accessToken: 'gl-access-2',
    refreshToken: 'gl-refresh-2',
    expiresAt: Date.now() + 60 * 60 * 1000,
    scope: 'api',
  });
});

// ── construction ─────────────────────────────────────────────────────────
describe('construction', () => {
  it('rejects a half-configured instance at boot rather than per request', () => {
    expect(() => new GitLabIntegration({})).toThrow(/accessToken or a complete OAuth app/);
    expect(() => new GitLabIntegration({ clientId: 'gl_client' })).toThrow(/accessToken or a complete OAuth app/);
  });

  it('accepts either a static token or a complete OAuth app', () => {
    expect(() => new GitLabIntegration({ accessToken: 'pat' })).not.toThrow();
    expect(() => new GitLabIntegration({ clientId: 'a', clientSecret: 'b' })).not.toThrow();
  });

  it('only demands a stable state signer when an OAuth flow exists', () => {
    // A static-token deploy never signs OAuth state, so forcing a stable signer
    // on it would be a boot requirement with nothing behind it.
    expect(new GitLabIntegration({ accessToken: 'pat' }).requiresStableStateSigner).toBe(false);
    expect(new GitLabIntegration({ clientId: 'a', clientSecret: 'b' }).requiresStableStateSigner).toBe(true);
  });
});

// ── credential resolution ────────────────────────────────────────────────
describe('credential resolution', () => {
  it('uses an unexpired stored grant without spending a refresh', async () => {
    await connect();
    await expect(resolve(integration())).resolves.toMatchObject({
      connection: { type: 'oauth', accessToken: 'gl-access' },
      sourceId: '42',
      issueId: '42!7',
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('treats a grant with no expiry as a non-expiring token', async () => {
    // Static/personal tokens are stored without `expiresAt`; refreshing one
    // would fail, so absence must not be read as "expired".
    await connect({ expiresAt: undefined });
    await expect(resolve(integration())).resolves.toMatchObject({
      connection: { accessToken: 'gl-access' },
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('falls back to the configured static token when no grant is stored', async () => {
    await expect(resolve(integration({ accessToken: 'pat-token' }))).resolves.toMatchObject({
      connection: { accessToken: 'pat-token' },
    });
  });

  it('resolves nothing when neither a grant nor a static token exists', async () => {
    await expect(resolve(integration())).resolves.toBeNull();
  });
});

// ── token rotation ───────────────────────────────────────────────────────
describe('token rotation', () => {
  it('refreshes an expired grant and hands back the new access token', async () => {
    await connect({ expiresAt: Date.now() - 1000 });
    await expect(resolve(integration())).resolves.toMatchObject({
      connection: { accessToken: 'gl-access-2' },
    });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('persists the rotated refresh token, since GitLab invalidates the old one', async () => {
    await connect({ expiresAt: Date.now() - 1000 });
    await resolve(integration());
    // Losing this write would strand the org on a dead refresh token and force
    // a manual reconnect on the next expiry.
    expect((await storedConnection())?.data).toMatchObject({
      accessToken: 'gl-access-2',
      refreshToken: 'gl-refresh-2',
      scope: 'api',
    });
  });

  it('collapses concurrent refreshes onto a single token request', async () => {
    await connect({ expiresAt: Date.now() - 1000 });
    const gitlab = integration();

    // Hold the refresh open so all four callers observe the same in-flight
    // attempt, reproducing the burst a board render fans out.
    let release!: (tokens: GitLabTokenSet) => void;
    refreshAccessToken.mockImplementationOnce(
      () =>
        new Promise<GitLabTokenSet>(resolveWith => {
          release = resolveWith;
        }),
    );

    const inFlight = Promise.all([resolve(gitlab), resolve(gitlab), resolve(gitlab), resolve(gitlab)]);
    // Each caller awaits a storage read before reaching the token endpoint, so
    // wait for the refresh to actually be in flight before releasing it.
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalled());
    release({
      accessToken: 'gl-access-2',
      refreshToken: 'gl-refresh-2',
      expiresAt: Date.now() + 60 * 60 * 1000,
      scope: 'api',
    });

    const results = await inFlight;
    // A second request would rotate the refresh token again and permanently
    // kill whichever result lost the race.
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result).toMatchObject({ connection: { accessToken: 'gl-access-2' } });
    }
  });

  it('refreshes again on a later expiry rather than caching the in-flight entry', async () => {
    await connect({ expiresAt: Date.now() - 1000 });
    const gitlab = integration();
    await resolve(gitlab);

    // The single-flight map is a de-dupe window, not a cache: once the entry is
    // cleared, a subsequently expired grant must be refreshable again.
    await seed.integrations
      .forIntegration('gitlab')
      .connections.update('org1', data => ({ ...data, expiresAt: Date.now() - 1000 }));
    await resolve(gitlab);
    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  it('keeps the org usable on the static token when the grant is unrecoverable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    refreshAccessToken.mockRejectedValue(new Error('invalid_grant'));
    await connect({ expiresAt: Date.now() - 1000 });

    await expect(resolve(integration({ accessToken: 'pat-token' }))).resolves.toMatchObject({
      connection: { accessToken: 'pat-token' },
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resolves nothing when the refresh fails and no static token is configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    refreshAccessToken.mockRejectedValue(new Error('invalid_grant'));
    await connect({ expiresAt: Date.now() - 1000 });

    // Null degrades the board to "not connected" instead of throwing an
    // unhandled rejection through a background dispatch.
    await expect(resolve(integration())).resolves.toBeNull();
    warn.mockRestore();
  });

  it('recovers after a failed refresh instead of latching the failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    refreshAccessToken.mockRejectedValueOnce(new Error('transient'));
    await connect({ expiresAt: Date.now() - 1000 });
    const gitlab = integration();

    await expect(resolve(gitlab)).resolves.toBeNull();
    // The `finally` clearing the in-flight entry is what makes the retry
    // possible; without it the rejected promise would be served forever.
    await expect(resolve(gitlab)).resolves.toMatchObject({ connection: { accessToken: 'gl-access-2' } });
    warn.mockRestore();
  });

  it('does not attempt a refresh for a grant that carries no refresh token', async () => {
    await connect({ expiresAt: Date.now() - 1000, refreshToken: undefined });
    await expect(resolve(integration({ accessToken: 'pat-token' }))).resolves.toMatchObject({
      connection: { accessToken: 'pat-token' },
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});

// ── dispatch resolution ──────────────────────────────────────────────────
describe('resolveIntakeDispatch', () => {
  it('splits the stored external id back into project and issue', async () => {
    await connect();
    await expect(resolve(integration())).resolves.toMatchObject({ sourceId: '42', issueId: '42!7' });
  });

  it('ignores external sources that are not issues', async () => {
    await connect();
    await expect(
      integration().intake.resolveIntakeDispatch({
        orgId: 'org1',
        externalSource: { type: 'pull-request', externalId: '42!7' },
      }),
    ).resolves.toBeNull();
  });

  it('ignores an external id that is not a GitLab ref', async () => {
    await connect();
    // A GitHub-style bare number would otherwise be dispatched against GitLab.
    await expect(
      integration().intake.resolveIntakeDispatch({
        orgId: 'org1',
        externalSource: { type: 'issue', externalId: '7' },
      }),
    ).resolves.toBeNull();
  });
});

// ── diagnostics ──────────────────────────────────────────────────────────
describe('diagnostics', () => {
  it('reports configuration without leaking credential values', () => {
    const snapshot = JSON.stringify(
      new GitLabIntegration({
        clientId: 'gl_client',
        clientSecret: 'gl_secret',
        accessToken: 'pat-token',
        publicUrl: 'https://factory.example.com',
        webhookSecret: 'hook-secret',
      }).diagnostics(),
    );

    expect(snapshot).not.toContain('gl_secret');
    expect(snapshot).not.toContain('pat-token');
    expect(snapshot).not.toContain('hook-secret');
    expect(JSON.parse(snapshot)).toMatchObject({
      oauthConfigured: true,
      staticTokenFallback: true,
      webhookSecretConfigured: true,
      // Intake-only for now: GitLab ships no versionControl surface.
      capabilities: { intake: true, versionControl: false },
    });
  });
});

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
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
    webhookSecret: 'hook-secret',
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
    expect(() => new GitLabIntegration({ webhookSecret: 's' })).toThrow(/accessToken or a complete OAuth app/);
    expect(() => new GitLabIntegration({ clientId: 'gl_client', webhookSecret: 's' })).toThrow(
      /accessToken or a complete OAuth app/,
    );
  });

  it('accepts either a static token or a complete OAuth app', () => {
    expect(() => new GitLabIntegration({ accessToken: 'pat', webhookSecret: 's' })).not.toThrow();
    expect(() => new GitLabIntegration({ clientId: 'a', clientSecret: 'b', webhookSecret: 's' })).not.toThrow();
  });

  it('refuses to construct without a webhook secret', () => {
    // The webhook route is always mounted, bypasses user auth, and dispatches
    // rules that move cards. An unset secret would mount it open, so this has
    // to fail at boot rather than per delivery.
    expect(() => new GitLabIntegration({ accessToken: 'pat' } as never)).toThrow(/requires a webhookSecret/);
    expect(() => new GitLabIntegration({ accessToken: 'pat', webhookSecret: '   ' })).toThrow(
      /requires a webhookSecret/,
    );
  });

  it('only demands a stable state signer when an OAuth flow exists', () => {
    // A static-token deploy never signs OAuth state, so forcing a stable signer
    // on it would be a boot requirement with nothing behind it.
    expect(new GitLabIntegration({ accessToken: 'pat', webhookSecret: 's' }).requiresStableStateSigner).toBe(false);
    expect(
      new GitLabIntegration({ clientId: 'a', clientSecret: 'b', webhookSecret: 's' }).requiresStableStateSigner,
    ).toBe(true);
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

  it('refreshes once a refresh token appears, having skipped the unrefreshable attempt', async () => {
    // The unrefreshable path returns before any `await`, so the attempt settles
    // during construction — a de-dupe entry registered after that would never be
    // cleared by the `finally` and would latch this `null` for the process
    // lifetime, leaving the org unable to refresh even after a valid reconnect.
    await connect({ expiresAt: Date.now() - 1000, refreshToken: undefined });
    const gitlab = integration();

    await expect(resolve(gitlab)).resolves.toBeNull();
    expect(refreshAccessToken).not.toHaveBeenCalled();

    await seed.integrations
      .forIntegration('gitlab')
      .connections.update('org1', data => ({ ...data, refreshToken: 'gl-refresh' }));

    await expect(resolve(gitlab)).resolves.toMatchObject({ connection: { accessToken: 'gl-access-2' } });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
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

// ── webhook route ────────────────────────────────────────────────────────
describe('webhook route', () => {
  const issueBody = {
    object_kind: 'issue',
    user: { username: 'reporter' },
    project: { id: 42, path_with_namespace: 'acme/widgets' },
    object_attributes: {
      iid: 7,
      title: 'Widget falls over',
      url: 'https://gitlab.com/acme/widgets/-/issues/7',
      state: 'opened',
      action: 'open',
      updated_at: '2026-01-02T00:00:00Z',
    },
  };

  /**
   * Mounts the real route on a bare Hono app. `runtime` is omitted unless a
   * test supplies one, mirroring an intake-only host.
   */
  function mount(options: { withRuntime?: boolean } = {}) {
    const gitlab = integration();
    const app = new Hono();
    const runtime = options.withRuntime
      ? { configVersion: 'test-config', workItems: seed.workItems, boards: createBoardRegistry() }
      : undefined;
    mountApiRoutes(
      app,
      gitlab.routes({
        auth: fakeRouteAuth(),
        storage: {
          generic: seed.integrations.forIntegration('gitlab'),
          sourceControl: seed.sourceControl,
          projects: seed.projects,
          memorySettings: seed.memorySettings,
          intake: seed.intake,
          channelIdentity: seed.channelIdentity,
        },
        ...(runtime ? { runtime } : {}),
      } as never),
    );
    return app;
  }

  function post(app: Hono, body: unknown, headers: Record<string, string> = {}) {
    return app.request('/web/gitlab/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('rejects a delivery whose token does not match', async () => {
    const response = await post(mount(), issueBody, { 'x-gitlab-token': 'wrong' });
    expect(response.status).toBe(401);
  });

  it('rejects a delivery carrying no token at all', async () => {
    // The route bypasses user auth, so an absent header must fail closed rather
    // than short-circuit past the comparison.
    expect((await post(mount(), issueBody)).status).toBe(401);
  });

  it('rejects an unparseable body without reaching the rules', async () => {
    const response = await post(mount(), 'not json', { 'x-gitlab-token': 'hook-secret' });
    expect(response.status).toBe(400);
  });

  it('acknowledges a kind Factory has no rule for', async () => {
    // 2xx on purpose: GitLab retries non-2xx, so a pipeline hook must not
    // become a retry loop.
    const response = await post(
      mount(),
      { object_kind: 'pipeline', project: { id: 42, path_with_namespace: 'a/b' } },
      { 'x-gitlab-token': 'hook-secret' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
  });

  it('acknowledges without dispatching when the host has no work-item runtime', async () => {
    const response = await post(mount(), issueBody, { 'x-gitlab-token': 'hook-secret' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
  });

  it('ignores a delivery for a GitLab project nothing is bound to', async () => {
    const response = await post(mount({ withRuntime: true }), issueBody, { 'x-gitlab-token': 'hook-secret' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, event: 'issueOpened', status: 'ignored' });
  });

  it('commits a delivery for a bound project end to end', async () => {
    const app = mount({ withRuntime: true });
    const project = await seed.projects.create({
      orgId: 'org1',
      userId: 'u1',
      input: { name: 'Widgets', repositoryId: null },
    });
    await seed.intake.setBinding({
      orgId: 'org1',
      integrationId: 'gitlab',
      sourceId: '42',
      factoryProjectId: project.id,
      board: null,
    });

    const response = await post(app, issueBody, { 'x-gitlab-token': 'hook-secret' });
    expect(await response.json()).toMatchObject({ ok: true, event: 'issueOpened', status: 'committed' });
    // Proof the HTTP edge reaches storage: the decision is queued for the
    // dispatcher against the bound project.
    const [decision] = await seed.workItems.listDeferredDecisions('org1', project.id);
    expect(decision?.decision).toMatchObject({ type: 'upsertLinkedWorkItem', source: 'gitlab-issue' });
  });

  it('fails the delivery so GitLab retries when ingest throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const app = mount({ withRuntime: true });
      vi.spyOn(seed.intake, 'listBindingsByExternalSource').mockRejectedValue(new Error('storage down'));
      const response = await post(app, issueBody, { 'x-gitlab-token': 'hook-secret' });
      // 500, not 200: a storage blip must not silently drop a card transition.
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'ingest_failed' });
    } finally {
      warn.mockRestore();
    }
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
      capabilities: { intake: true, versionControl: true },
      // Every event the integration dispatches, so a deployment can see which
      // GitLab hooks are worth enabling.
      gitlabRuleEvents: [
        'issueOpened',
        'issueEdited',
        'issueClosed',
        'issueNoteCreated',
        'mergeRequestOpened',
        'mergeRequestUpdated',
        'mergeRequestMerged',
        'mergeRequestClosed',
        'mergeRequestNoteCreated',
      ],
    });
  });
});

import { createChannelLinkStateSigner, createStateSigner } from '@mastra/factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSlackConnectRoutes } from './connect-route.js';

function fakeAuth(tenant: { orgId?: string; userId: string } | undefined) {
  return {
    enabled: () => tenant !== undefined,
    ensureUser: vi.fn().mockResolvedValue(tenant),
    tenant: () => tenant,
    isOrganizationAdmin: vi.fn().mockResolvedValue(false),
  } as any;
}

function fakeStore() {
  const saveAccountLink = vi.fn().mockResolvedValue({ userId: 'x', linkedAt: new Date() });
  const listAccountLinksForUser = vi.fn().mockResolvedValue([]);
  const deleteAccountLinkForUser = vi.fn().mockResolvedValue(true);
  return {
    store: { saveAccountLink, listAccountLinksForUser, deleteAccountLinkForUser } as any,
    saveAccountLink,
    listAccountLinksForUser,
    deleteAccountLinkForUser,
  };
}

// Minimal Hono-ish context: query() + json body + redirect() + json().
function fakeCtx(state?: string, body?: unknown, extraQuery?: Record<string, string>) {
  return {
    req: {
      query: (k: string) => (k === 'state' ? state : extraQuery?.[k]),
      json: vi
        .fn()
        .mockImplementation(() => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body))),
    },
    redirect: vi.fn((url: string) => ({ redirectedTo: url })),
    json: vi.fn((payload: unknown, status?: number) => ({ payload, status: status ?? 200 })),
  } as any;
}

function getHandler(routes: ReturnType<typeof createSlackConnectRoutes>, method = 'GET', path = '/connect/slack') {
  // registerApiRoute returns { path, method, handler, ... }
  const route = routes.find(r => (r as any).method === method && (r as any).path === path);
  return (route as any).handler as (c: any) => Promise<any>;
}

describe('/connect/slack route', () => {
  const signer = createChannelLinkStateSigner('secret');
  const identity = { platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1', channelId: 'C-1' };

  it('writes the account link for an authed tenant with a valid signed state', async () => {
    const { store, saveAccountLink } = fakeStore();
    const routes = createSlackConnectRoutes({
      auth: fakeAuth({ orgId: 'org-9', userId: 'user-9' }),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });
    const c = fakeCtx(signer.sign(identity));

    await getHandler(routes)(c);

    expect(saveAccountLink).toHaveBeenCalledWith({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-1',
      orgId: 'org-9',
      userId: 'user-9',
    });
    expect(c.redirect).toHaveBeenCalledWith('/?slack=connected');
  });

  it('redirects to login (preserving state) when not authenticated', async () => {
    const { store, saveAccountLink } = fakeStore();
    const state = signer.sign(identity);
    const routes = createSlackConnectRoutes({
      auth: fakeAuth(undefined),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });
    const c = fakeCtx(state);

    await getHandler(routes)(c);

    expect(saveAccountLink).not.toHaveBeenCalled();
    const target = c.redirect.mock.calls[0][0];
    expect(target.startsWith('/auth/login?returnTo=')).toBe(true);
    expect(decodeURIComponent(target)).toContain('/connect/slack?state=');
  });

  it('rejects an invalid/forged state without writing', async () => {
    const { store, saveAccountLink } = fakeStore();
    const routes = createSlackConnectRoutes({
      auth: fakeAuth({ orgId: 'org-9', userId: 'user-9' }),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });
    const c = fakeCtx('tampered.state');

    await getHandler(routes)(c);

    expect(saveAccountLink).not.toHaveBeenCalled();
    expect(c.redirect).toHaveBeenCalledWith('/?slack=error');
  });

  it('links a personal account (no org id)', async () => {
    const { store, saveAccountLink } = fakeStore();
    const routes = createSlackConnectRoutes({
      auth: fakeAuth({ userId: 'solo' }),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });
    const c = fakeCtx(signer.sign(identity));

    await getHandler(routes)(c);

    expect(saveAccountLink).toHaveBeenCalledWith({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-1',
      orgId: undefined,
      userId: 'solo',
    });
    expect(c.redirect).toHaveBeenCalledWith('/?slack=connected');
  });
});

describe('/web/channel-accounts routes', () => {
  const signer = createChannelLinkStateSigner('secret');

  it('lists only the caller own links as payloads', async () => {
    const { store, listAccountLinksForUser } = fakeStore();
    const linkedAt = new Date('2026-07-23T17:57:43.368Z');
    listAccountLinksForUser.mockResolvedValue([
      { platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1', userId: 'user-9', linkedAt },
    ]);
    const routes = createSlackConnectRoutes({
      auth: fakeAuth({ orgId: 'org-9', userId: 'user-9' }),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });
    const c = fakeCtx();

    const result = await getHandler(routes, 'GET', '/web/channel-accounts')(c);

    expect(listAccountLinksForUser).toHaveBeenCalledWith('user-9');
    expect(result.payload).toEqual({
      accounts: [
        {
          platform: 'slack',
          externalTeamId: 'T-1',
          externalUserId: 'U-1',
          linkedAt: '2026-07-23T17:57:43.368Z',
        },
      ],
      canConnect: false,
    });
  });

  it('rejects unauthenticated list/delete calls', async () => {
    const { store, listAccountLinksForUser, deleteAccountLinkForUser } = fakeStore();
    const routes = createSlackConnectRoutes({
      auth: fakeAuth(undefined),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });

    const listResult = await getHandler(routes, 'GET', '/web/channel-accounts')(fakeCtx());
    const deleteResult = await getHandler(
      routes,
      'DELETE',
      '/web/channel-accounts',
    )(fakeCtx(undefined, { platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1' }));

    expect(listResult.status).toBe(401);
    expect(deleteResult.status).toBe(401);
    expect(listAccountLinksForUser).not.toHaveBeenCalled();
    expect(deleteAccountLinkForUser).not.toHaveBeenCalled();
  });

  it('deletes with the caller tenant userId guard', async () => {
    const { store, deleteAccountLinkForUser } = fakeStore();
    const routes = createSlackConnectRoutes({
      auth: fakeAuth({ orgId: 'org-9', userId: 'user-9' }),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });
    const c = fakeCtx(undefined, { platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1' });

    const result = await getHandler(routes, 'DELETE', '/web/channel-accounts')(c);

    expect(deleteAccountLinkForUser).toHaveBeenCalledWith({
      userId: 'user-9',
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-1',
    });
    expect(result.payload).toEqual({ deleted: true });
  });

  it('400s a delete without the full sender key', async () => {
    const { store, deleteAccountLinkForUser } = fakeStore();
    const routes = createSlackConnectRoutes({
      auth: fakeAuth({ userId: 'user-9' }),
      accountLinks: store,
      channelLinkStateSigner: signer,
    });
    const c = fakeCtx(undefined, { platform: 'slack' });

    const result = await getHandler(routes, 'DELETE', '/web/channel-accounts')(c);

    expect(result.status).toBe(400);
    expect(deleteAccountLinkForUser).not.toHaveBeenCalled();
  });
});

describe('/connect/slack/oidc (Sign in with Slack)', () => {
  const linkSigner = createChannelLinkStateSigner('secret');
  const tenantSigner = createStateSigner('secret');
  const oidc = {
    clientId: 'client-1',
    clientSecret: 'shh',
    redirectBaseUrl: 'https://tunnel.example',
    uiOrigin: 'http://localhost:5173',
  };

  function oidcRoutes(overrides?: Partial<Parameters<typeof createSlackConnectRoutes>[0]>) {
    const { store, saveAccountLink } = fakeStore();
    const routes = createSlackConnectRoutes({
      auth: fakeAuth({ orgId: 'org-9', userId: 'user-9' }),
      accountLinks: store,
      channelLinkStateSigner: linkSigner,
      tenantStateSigner: tenantSigner,
      oidc,
      ...overrides,
    });
    return { routes, saveAccountLink };
  }

  /** Unsigned JWT with the given payload — claims validation only, no signature. */
  function makeIdToken(claims: Record<string, unknown>): string {
    return `x.${Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')}.y`;
  }

  const validClaims = {
    iss: 'https://slack.com',
    aud: 'client-1',
    'https://slack.com/team_id': 'T-77',
    'https://slack.com/user_id': 'U-77',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('start redirects to Slack authorize with a tenant-bound signed state', async () => {
    const { routes } = oidcRoutes();
    const c = fakeCtx();

    await getHandler(routes, 'GET', '/connect/slack/oidc/start')(c);

    const target = new URL(c.redirect.mock.calls[0][0]);
    expect(target.origin + target.pathname).toBe('https://slack.com/openid/connect/authorize');
    expect(target.searchParams.get('response_type')).toBe('code');
    expect(target.searchParams.get('scope')).toBe('openid profile');
    expect(target.searchParams.get('client_id')).toBe('client-1');
    expect(target.searchParams.get('redirect_uri')).toBe('https://tunnel.example/connect/slack/oidc/callback');
    // The state round-trips the initiating tenant.
    expect(tenantSigner.verify(target.searchParams.get('state') ?? undefined)).toEqual({
      orgId: 'org-9',
      userId: 'user-9',
    });
  });

  it('start sends signed-out visitors through login', async () => {
    const { routes } = oidcRoutes({ auth: fakeAuth(undefined) });
    const c = fakeCtx();

    await getHandler(routes, 'GET', '/connect/slack/oidc/start')(c);

    const target = c.redirect.mock.calls[0][0];
    expect(target.startsWith('/auth/login?returnTo=')).toBe(true);
    expect(decodeURIComponent(target)).toContain('/connect/slack/oidc/start');
  });

  it('start errors out when OIDC is not configured', async () => {
    const { routes } = oidcRoutes({ oidc: undefined });
    const c = fakeCtx();

    await getHandler(routes, 'GET', '/connect/slack/oidc/start')(c);

    expect(c.redirect).toHaveBeenCalledWith('/?slack=error');
  });

  it('callback exchanges the code and writes the link for the state tenant', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id_token: makeIdToken(validClaims) }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { routes, saveAccountLink } = oidcRoutes();
    const c = fakeCtx(tenantSigner.sign('org-9', 'user-9'), undefined, { code: 'code-1' });

    await getHandler(routes, 'GET', '/connect/slack/oidc/callback')(c);

    expect(fetchMock).toHaveBeenCalledWith('https://slack.com/api/openid.connect.token', expect.anything());
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('code')).toBe('code-1');
    expect(body.get('client_id')).toBe('client-1');
    expect(body.get('redirect_uri')).toBe('https://tunnel.example/connect/slack/oidc/callback');
    expect(saveAccountLink).toHaveBeenCalledWith({
      platform: 'slack',
      externalTeamId: 'T-77',
      externalUserId: 'U-77',
      orgId: 'org-9',
      userId: 'user-9',
      externalTeamName: undefined,
      externalUserName: undefined,
    });
    expect(c.redirect).toHaveBeenCalledWith('http://localhost:5173/?slack=connected');
  });

  it('callback stores display names from the profile claims when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        id_token: makeIdToken({ ...validClaims, name: 'Caleb Barnes', 'https://slack.com/team_name': 'Kepler' }),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { routes, saveAccountLink } = oidcRoutes();
    const c = fakeCtx(tenantSigner.sign('org-9', 'user-9'), undefined, { code: 'code-1' });

    await getHandler(routes, 'GET', '/connect/slack/oidc/callback')(c);

    expect(saveAccountLink).toHaveBeenCalledWith(
      expect.objectContaining({ externalTeamName: 'Kepler', externalUserName: 'Caleb Barnes' }),
    );
  });

  it('callback rejects a forged state without calling Slack or writing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { routes, saveAccountLink } = oidcRoutes();
    const c = fakeCtx('tampered.state', undefined, { code: 'code-1' });

    await getHandler(routes, 'GET', '/connect/slack/oidc/callback')(c);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(saveAccountLink).not.toHaveBeenCalled();
    expect(c.redirect).toHaveBeenCalledWith('http://localhost:5173/?slack=error');
  });

  it('callback rejects an id_token minted for a different client (aud mismatch)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id_token: makeIdToken({ ...validClaims, aud: 'someone-else' }) }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { routes, saveAccountLink } = oidcRoutes();
    const c = fakeCtx(tenantSigner.sign('org-9', 'user-9'), undefined, { code: 'code-1' });

    await getHandler(routes, 'GET', '/connect/slack/oidc/callback')(c);

    expect(saveAccountLink).not.toHaveBeenCalled();
    expect(c.redirect).toHaveBeenCalledWith('http://localhost:5173/?slack=error');
  });

  it('callback surfaces a failed token exchange as an error redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_code' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { routes, saveAccountLink } = oidcRoutes();
    const c = fakeCtx(tenantSigner.sign('org-9', 'user-9'), undefined, { code: 'bad' });

    await getHandler(routes, 'GET', '/connect/slack/oidc/callback')(c);

    expect(saveAccountLink).not.toHaveBeenCalled();
    expect(c.redirect).toHaveBeenCalledWith('http://localhost:5173/?slack=error');
  });

  it('list reports canConnect when OIDC is configured', async () => {
    const { routes } = oidcRoutes();
    const result = await getHandler(routes, 'GET', '/web/channel-accounts')(fakeCtx());
    expect(result.payload).toEqual({ accounts: [], canConnect: true });
  });

  it('routes the Connect card deep link to the settings surface instead of the legacy state write', async () => {
    const { routes, saveAccountLink } = oidcRoutes();
    const c = fakeCtx(linkSigner.sign({ platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1' }));

    await getHandler(routes, 'GET', '/connect/slack')(c);

    expect(saveAccountLink).not.toHaveBeenCalled();
    expect(c.redirect).toHaveBeenCalledWith('http://localhost:5173/settings/connected-accounts');
  });
});

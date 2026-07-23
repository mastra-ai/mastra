import { createChannelLinkStateSigner } from '@mastra/factory';
import { describe, expect, it, vi } from 'vitest';

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
function fakeCtx(state?: string, body?: unknown) {
  return {
    req: {
      query: (k: string) => (k === 'state' ? state : undefined),
      json: vi.fn().mockImplementation(() => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body))),
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
    const deleteResult = await getHandler(routes, 'DELETE', '/web/channel-accounts')(
      fakeCtx(undefined, { platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1' }),
    );

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

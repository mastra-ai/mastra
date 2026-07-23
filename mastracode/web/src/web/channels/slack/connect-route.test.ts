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
  return { store: { saveAccountLink } as any, saveAccountLink };
}

// Minimal Hono-ish context: query() + redirect().
function fakeCtx(state?: string) {
  return {
    req: { query: (k: string) => (k === 'state' ? state : undefined) },
    redirect: vi.fn((url: string) => ({ redirectedTo: url })),
  } as any;
}

function getHandler(routes: ReturnType<typeof createSlackConnectRoutes>) {
  // registerApiRoute returns { path, method, handler, ... }
  return (routes[0] as any).handler as (c: any) => Promise<any>;
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
    expect(target.startsWith('/auth/login?redirect_uri=')).toBe(true);
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

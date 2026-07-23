import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { ChannelIdentityStorage, ChannelLinkStateSigner, RouteAuth } from '@mastra/factory';

/**
 * Payload shape for the connected-accounts list: the platform sender key +
 * link time, without the tenant ids (the caller IS the tenant).
 */
export interface ConnectedChannelAccountPayload {
  platform: string;
  externalTeamId: string;
  externalUserId: string;
  linkedAt: string;
}

/**
 * The authed `/connect/slack` route: binds the Slack identity carried by a
 * signed deep-link `state` to the currently signed-in Mastra tenant.
 *
 * The `state` is HMAC-signed by the bot when it prompts an unlinked sender
 * (see `slack.ts` `promptIfUnlinked`), so the Slack identity it carries is
 * trustworthy and a forged `?teamId=&userId=` is rejected. Auth supplies the
 * tenant `(orgId, userId)`; the write is the reverse-index row that lets a
 * later Slack message from that sender resolve this tenant's model credentials.
 *
 * NOTE: this trusts the signed `state` to name the Slack identity rather than
 * running a full "Sign in with Slack" OIDC round-trip. Proving the web user
 * actually controls that Slack identity (vs. a forwarded Connect link) is a
 * follow-up hardening step; the signature already prevents identity forgery.
 */
export function createSlackConnectRoutes(deps: {
  auth: RouteAuth;
  accountLinks: ChannelIdentityStorage;
  channelLinkStateSigner: ChannelLinkStateSigner;
}): ApiRoute[] {
  const { auth, accountLinks, channelLinkStateSigner } = deps;

  // mc-web can resolve a different hono version than @mastra/factory, so the
  // registerApiRoute handler `Context` and the factory `RouteAuth` `Context`
  // are structurally incompatible (private `[GET_MATCH_RESULT]` symbol). Cast
  // through `unknown` at the seam — same `loose()` workaround the factory
  // routes use internally.
  type RouteAuthContext = Parameters<RouteAuth['ensureUser']>[0];
  const loose = (c: unknown): RouteAuthContext => c as RouteAuthContext;

  return [
    registerApiRoute('/connect/slack', {
      method: 'GET',
      // Authenticated via the same bearer/cookie path the factory routes use;
      // handled explicitly below so we can return a friendly redirect on 401.
      requiresAuth: false,
      handler: async c => {
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) {
          // Not signed in — send them through login, preserving the state so
          // they land back here after authenticating.
          const state = c.req.query('state') ?? '';
          const returnTo = `/connect/slack?state=${encodeURIComponent(state)}`;
          return c.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
        }

        const identity = channelLinkStateSigner.verify(c.req.query('state'));
        if (!identity) {
          return c.redirect('/?slack=error');
        }

        await accountLinks.saveAccountLink({
          platform: identity.platform,
          externalTeamId: identity.externalTeamId,
          externalUserId: identity.externalUserId,
          orgId: tenant.orgId,
          userId: tenant.userId,
        });

        return c.redirect('/?slack=connected');
      },
    }),
    // The caller's own linked channel accounts, for the Connected accounts
    // settings surface. Tenant-scoped: you only ever see your own links.
    registerApiRoute('/web/channel-accounts', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized' }, 401);

        const links = await accountLinks.listAccountLinksForUser(tenant.userId);
        const accounts: ConnectedChannelAccountPayload[] = links.map(link => ({
          platform: link.platform,
          externalTeamId: link.externalTeamId,
          externalUserId: link.externalUserId,
          linkedAt: link.linkedAt.toISOString(),
        }));
        return c.json({ accounts });
      },
    }),
    // Self-service disconnect. The storage delete is guarded by the caller's
    // tenant userId, so a known sender key alone can never sever someone
    // else's link.
    registerApiRoute('/web/channel-accounts', {
      method: 'DELETE',
      requiresAuth: false,
      handler: async c => {
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized' }, 401);

        const body = (await c.req.json().catch(() => null)) as {
          platform?: string;
          externalTeamId?: string;
          externalUserId?: string;
        } | null;
        if (!body?.platform || !body.externalTeamId || !body.externalUserId) {
          return c.json({ error: 'platform, externalTeamId and externalUserId are required' }, 400);
        }

        const deleted = await accountLinks.deleteAccountLinkForUser({
          userId: tenant.userId,
          platform: body.platform,
          externalTeamId: body.externalTeamId,
          externalUserId: body.externalUserId,
        });
        return c.json({ deleted });
      },
    }),
  ];
}

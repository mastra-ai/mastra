import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { ChannelIdentityStorage, ChannelLinkStateSigner, RouteAuth, StateSigner } from '@mastra/factory';

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
 * Config for the web-initiated "Sign in with Slack" (OIDC) connect flow. All
 * values come from the env-supplied Slack app. Absent → the OIDC routes
 * respond with an error redirect and the list endpoint reports
 * `canConnect: false` so the UI hides its Connect button.
 */
export interface SlackOidcConfig {
  clientId: string;
  clientSecret: string;
  /**
   * Public HTTPS origin the OIDC `redirect_uri` is built from (Slack rejects
   * plain-http redirect URLs, so locally this is the tunnel origin). Must also
   * be registered as a redirect URL on the Slack app.
   */
  redirectBaseUrl: string;
  /** Browser-facing origin post-connect redirects land on (the SPA host). */
  uiOrigin?: string;
}

const SLACK_AUTHORIZE_URL = 'https://slack.com/openid/connect/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/openid.connect.token';
const OIDC_CALLBACK_PATH = '/connect/slack/oidc/callback';

/**
 * Decode a JWT's payload WITHOUT signature verification. Safe here because the
 * `id_token` arrives directly from Slack's token endpoint over TLS in a
 * confidential-client code exchange — the transport authenticates the issuer,
 * which is the standard OIDC allowance for this flow. `iss`/`aud` are still
 * checked by the caller.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
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
 * proving the web user controls it (a forwarded Connect link could bind
 * someone else's Slack identity to your tenant — self-harm only, since it
 * routes THEIR messages to YOUR credentials). The OIDC routes below offer the
 * proven path; this stays as the low-friction Slack-side entry.
 */
export function createSlackConnectRoutes(deps: {
  auth: RouteAuth;
  accountLinks: ChannelIdentityStorage;
  channelLinkStateSigner: ChannelLinkStateSigner;
  /** Signs the OIDC `state`, binding the round-trip to the initiating tenant. */
  tenantStateSigner?: StateSigner;
  oidc?: SlackOidcConfig;
}): ApiRoute[] {
  const { auth, accountLinks, channelLinkStateSigner, tenantStateSigner, oidc } = deps;
  const oidcEnabled = Boolean(oidc && tenantStateSigner);
  const uiOrigin = oidc?.uiOrigin?.replace(/\/$/, '') ?? '';

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
    // Web-initiated connect: "Sign in with Slack" (OIDC). Unlike the deep-link
    // route above (which trusts the bot-signed Slack identity), this proves the
    // signed-in web user actually CONTROLS the Slack account: Slack itself
    // asserts the (team, user) pair in the id_token.
    registerApiRoute('/connect/slack/oidc/start', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!oidcEnabled) return c.redirect(`${uiOrigin}/?slack=error`);

        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) {
          return c.redirect(`/auth/login?returnTo=${encodeURIComponent('/connect/slack/oidc/start')}`);
        }

        const params = new URLSearchParams({
          response_type: 'code',
          scope: 'openid',
          client_id: oidc!.clientId,
          // Personal accounts have no org; the signer requires a string, so an
          // empty org round-trips and is mapped back to undefined on save.
          state: tenantStateSigner!.sign(tenant.orgId ?? '', tenant.userId),
          redirect_uri: `${oidc!.redirectBaseUrl.replace(/\/$/, '')}${OIDC_CALLBACK_PATH}`,
        });
        return c.redirect(`${SLACK_AUTHORIZE_URL}?${params.toString()}`);
      },
    }),
    // OIDC callback. Authenticates via the signed `state` (which carries the
    // initiating tenant) rather than the session cookie — the callback may
    // arrive on a different origin (the public tunnel) where the SPA's
    // host-scoped cookie is not sent.
    registerApiRoute(OIDC_CALLBACK_PATH, {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!oidcEnabled) return c.redirect(`${uiOrigin}/?slack=error`);

        const tenant = tenantStateSigner!.verify(c.req.query('state'));
        const code = c.req.query('code');
        if (!tenant || !code) return c.redirect(`${uiOrigin}/?slack=error`);

        const tokenRes = await fetch(SLACK_TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: oidc!.clientId,
            client_secret: oidc!.clientSecret,
            code,
            redirect_uri: `${oidc!.redirectBaseUrl.replace(/\/$/, '')}${OIDC_CALLBACK_PATH}`,
          }),
        });
        const token = (await tokenRes.json().catch(() => null)) as { ok?: boolean; id_token?: string } | null;
        if (!tokenRes.ok || !token?.ok || typeof token.id_token !== 'string') {
          return c.redirect(`${uiOrigin}/?slack=error`);
        }

        const claims = decodeJwtPayload(token.id_token);
        const teamId = claims?.['https://slack.com/team_id'];
        const slackUserId = claims?.['https://slack.com/user_id'];
        if (
          !claims ||
          claims.iss !== 'https://slack.com' ||
          claims.aud !== oidc!.clientId ||
          typeof teamId !== 'string' ||
          typeof slackUserId !== 'string'
        ) {
          return c.redirect(`${uiOrigin}/?slack=error`);
        }

        await accountLinks.saveAccountLink({
          platform: 'slack',
          externalTeamId: teamId,
          externalUserId: slackUserId,
          orgId: tenant.orgId || undefined,
          userId: tenant.userId,
        });

        return c.redirect(`${uiOrigin}/?slack=connected`);
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
        // `canConnect` tells the settings UI whether the web-initiated OIDC
        // connect flow is configured (vs. Slack-side Connect card only).
        return c.json({ accounts, canConnect: oidcEnabled });
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

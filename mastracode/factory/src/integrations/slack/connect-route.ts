import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { RouteAuth } from '../../routes/route.js';
import type { StateSigner } from '../../state-signing.js';
import type { ChannelIdentityStorage } from '../../storage/domains/channel-identity/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';

/**
 * Payload shape for the Connections list: the platform sender key +
 * link time, without the tenant ids (the caller IS the tenant).
 */
interface ConnectedChannelAccountPayload {
  platform: string;
  externalTeamId: string;
  externalUserId: string;
  /** Display names captured at link time (OIDC profile claims); ids fall back. */
  externalTeamName?: string;
  externalUserName?: string;
  /** Which Factory project this link's channel runs route to (unset = not picked yet). */
  defaultFactoryProjectId?: string;
  linkedAt: string;
}

/**
 * Config for the web-initiated "Sign in with Slack" (OIDC) connect flow. All
 * values come from the env-supplied Slack app. Absent → the OIDC routes
 * respond with an error redirect and the list endpoint reports
 * `canConnect: false` so the UI hides its Connect button.
 */
interface SlackOidcConfig {
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
const SLACK_TOKEN_TIMEOUT_MS = 10_000;
/** Matches the signer's own `state` lifetime — past it, `verify` rejects anyway. */
const STATE_REPLAY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Decode a JWT's payload WITHOUT signature verification. Safe here because the
 * `id_token` arrives directly from Slack's token endpoint over TLS in a
 * confidential-client code exchange — the transport authenticates the issuer,
 * which is the standard OIDC allowance for this flow. `iss`/`aud`/`exp` are
 * still checked by the caller.
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
 * Slack account-linking routes.
 *
 * A link is only ever written by the OIDC flow below, where Slack itself
 * asserts the `(team, user)` pair in the id_token — so the web user has to
 * actually control the Slack account they bind. `/connect/slack` is just the
 * Slack-side entry point: it carries no identity and writes nothing, it only
 * sends the visitor to Connections, where the flow starts.
 */
export function createSlackConnectRoutes(deps: {
  auth: RouteAuth;
  accountLinks: ChannelIdentityStorage;
  /** Signs the OIDC `state`, binding the round-trip to the initiating tenant. */
  tenantStateSigner?: StateSigner;
  oidc?: SlackOidcConfig;
  /**
   * Factory projects domain, for validating (and listing to) the per-link
   * default factory. Unset → the default-factory PATCH route rejects.
   */
  projects?: FactoryProjectsStorage;
}): ApiRoute[] {
  const { auth, accountLinks, tenantStateSigner, oidc, projects } = deps;
  const oidcEnabled = Boolean(oidc && tenantStateSigner);
  const uiOrigin = oidc?.uiOrigin?.replace(/\/$/, '') ?? '';

  // A signed `state` stays valid for its whole 10-minute window, so on its own
  // it authorizes the binding repeatedly: anyone who captures a callback URL
  // can re-run the exchange with their own fresh Slack `code` and bind their
  // Slack account to the tenant that started the flow. Burning the nonce makes
  // the state single-use. Scope note: this is per-process, so it does not stop
  // a replay routed to a different replica — narrowing that further needs
  // shared storage, which is out of proportion to a 10-minute window here.
  const consumedNonces = new Map<string, number>();
  const consumeNonce = (nonce: string): boolean => {
    const now = Date.now();
    for (const [seen, expiresAt] of consumedNonces) {
      if (expiresAt <= now) consumedNonces.delete(seen);
    }
    if (consumedNonces.has(nonce)) return false;
    consumedNonces.set(nonce, now + STATE_REPLAY_WINDOW_MS);
    return true;
  };

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
      // No auth: nothing here reads a tenant or writes a link. The SPA route
      // this lands on requires a session and bounces through login itself.
      requiresAuth: false,
      handler: async c => c.redirect(`${uiOrigin}/settings/connections`),
    }),
    // Web-initiated connect: "Sign in with Slack" (OIDC). The only route that
    // writes a link, because it is the only one that proves the signed-in web
    // user actually CONTROLS the Slack account: Slack itself asserts the
    // (team, user) pair in the id_token.
    registerApiRoute('/connect/slack/oidc/start', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        if (!oidcEnabled) return c.redirect(`${uiOrigin}/?slack=error`);

        const factoryProjectId = c.req.query('factoryId')?.trim() || undefined;
        const startPath = factoryProjectId
          ? `/connect/slack/oidc/start?factoryId=${encodeURIComponent(factoryProjectId)}`
          : '/connect/slack/oidc/start';

        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) {
          return c.redirect(`/auth/login?returnTo=${encodeURIComponent(startPath)}`);
        }

        const params = new URLSearchParams({
          response_type: 'code',
          // `profile` adds display-name claims (user name, team name) to the
          // id_token so Connections can show names instead of ids.
          scope: 'openid profile',
          client_id: oidc!.clientId,
          // Personal accounts have no org; the signer requires a string, so an
          // empty org round-trips and is mapped back to undefined on save.
          state: tenantStateSigner!.sign(tenant.orgId ?? '', tenant.userId, { factoryProjectId }),
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
        // Burn the state before spending the code, not after saving: a replay
        // must be refused even if the first attempt fails partway through.
        if (!consumeNonce(tenant.nonce)) return c.redirect(`${uiOrigin}/?slack=error`);

        // Bound the exchange: without a deadline a slow token endpoint parks the
        // request until the platform's own timeout, and this route is reachable
        // by anyone holding a signed state.
        const tokenRes = await fetch(SLACK_TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: oidc!.clientId,
            client_secret: oidc!.clientSecret,
            code,
            redirect_uri: `${oidc!.redirectBaseUrl.replace(/\/$/, '')}${OIDC_CALLBACK_PATH}`,
          }),
          signal: AbortSignal.timeout(SLACK_TOKEN_TIMEOUT_MS),
        }).catch(() => null);
        const token = (await tokenRes?.json().catch(() => null)) as { ok?: boolean; id_token?: string } | null;
        if (!tokenRes?.ok || !token?.ok || typeof token.id_token !== 'string') {
          return c.redirect(`${uiOrigin}/?slack=error`);
        }

        const claims = decodeJwtPayload(token.id_token);
        const teamId = claims?.['https://slack.com/team_id'];
        const slackUserId = claims?.['https://slack.com/user_id'];
        // Display-only claims from the `profile` scope — absent claims just
        // mean the settings list falls back to ids.
        const teamName = claims?.['https://slack.com/team_name'];
        const userName = claims?.name;
        // `exp` is seconds since the epoch. A missing or past `exp` means the
        // assertion is not currently valid, so it cannot bind an account.
        const expiresAt = typeof claims?.exp === 'number' ? claims.exp * 1000 : null;
        if (
          !claims ||
          claims.iss !== 'https://slack.com' ||
          claims.aud !== oidc!.clientId ||
          expiresAt === null ||
          expiresAt <= Date.now() ||
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
          externalTeamName: typeof teamName === 'string' ? teamName : undefined,
          externalUserName: typeof userName === 'string' ? userName : undefined,
        });

        const successPath = tenant.factoryProjectId
          ? `/factories/${encodeURIComponent(tenant.factoryProjectId)}/settings/connections/slack`
          : '/settings/connections';
        return c.redirect(`${uiOrigin}${successPath}?slack=connected`);
      },
    }),
    // The caller's own linked channel accounts for Connections. Tenant-scoped:
    // you only ever see your own links.
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
          externalTeamName: link.externalTeamName,
          externalUserName: link.externalUserName,
          defaultFactoryProjectId: link.defaultFactoryProjectId,
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
    // Set (or clear, with `factoryProjectId: null`) which Factory project a
    // link's channel runs route to. The storage write is guarded by the
    // caller's tenant userId — a known sender key alone can never repoint
    // someone else's link — and a non-null factory must exist in the caller's
    // org.
    registerApiRoute('/web/channel-accounts/default-factory', {
      method: 'PATCH',
      requiresAuth: false,
      handler: async c => {
        await auth.ensureUser(loose(c));
        const tenant = auth.tenant(loose(c));
        if (!tenant) return c.json({ error: 'unauthorized' }, 401);

        const body = (await c.req.json().catch(() => null)) as {
          platform?: string;
          externalTeamId?: string;
          externalUserId?: string;
          factoryProjectId?: string | null;
        } | null;
        if (!body?.platform || !body.externalTeamId || !body.externalUserId || body.factoryProjectId === undefined) {
          return c.json(
            { error: 'platform, externalTeamId, externalUserId and factoryProjectId (nullable) are required' },
            400,
          );
        }

        if (body.factoryProjectId !== null) {
          if (!projects) return c.json({ error: 'factory routing is not configured' }, 400);
          const factory = await projects.get({ orgId: tenant.orgId ?? '', id: body.factoryProjectId });
          if (!factory) return c.json({ error: 'unknown factory' }, 400);
        }

        const updated = await accountLinks.setDefaultFactory({
          userId: tenant.userId,
          platform: body.platform,
          externalTeamId: body.externalTeamId,
          externalUserId: body.externalUserId,
          factoryProjectId: body.factoryProjectId,
        });
        return c.json({ updated });
      },
    }),
  ];
}

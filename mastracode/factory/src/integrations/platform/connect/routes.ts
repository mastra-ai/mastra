/**
 * Mastra `apiRoutes` that let the Factory SPA connect and reconnect
 * Platform-managed provider accounts without leaving Factory.
 *
 * The browser cannot talk to the integrations service itself — it has no
 * Platform session — so these routes mint Nango connect/reconnect sessions
 * server-side with the deploy's machine credentials
 * (`MASTRA_PLATFORM_ACCESS_TOKEN`/`MASTRA_PLATFORM_SECRET_KEY`) and hand the
 * short-lived session token back to the SPA, which drives the provider's
 * OAuth popup headlessly via `@nangohq/frontend`. Gating mirrors the
 * Platform's own rule for these providers: a signed-in organization member
 * (org:write parity with Linear), not an organization admin.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { RouteAuth } from '../../../routes/route.js';
import { PlatformApiClient, PlatformApiError } from '../api-client.js';

type RouteContext = Context;

/** Erase a route handler's path-parameterized context to a plain `Context`. */
function loose(c: unknown): RouteContext {
  return c as RouteContext;
}

export interface PlatformConnectProvider {
  /** Platform integration id used to mint connect sessions. */
  integrationId: string;
  /** Connection `integrationId` variants that belong to this provider. */
  connectionIntegrationIds: readonly string[];
}

/**
 * Providers the Factory SPA may connect through these routes. Keys are the
 * SPA-facing provider slugs; `integrationId` is the Platform catalog id used
 * for new connect sessions. Provider-specific PRs extend this registry when
 * their Factory integrations are available.
 */
export const PLATFORM_CONNECT_PROVIDERS: Record<string, PlatformConnectProvider> = {
  jira: { integrationId: 'jira', connectionIntegrationIds: ['jira'] },
  gitlab: { integrationId: 'gitlab', connectionIntegrationIds: ['gitlab', 'gitlab-group', 'gitlab-group-token'] },
};

interface PlatformConnectionRow {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
  displayName?: string | null;
  connectedAt?: string;
}

interface PlatformSessionResponse {
  connectionId: string;
  integrationId: string;
  connectUrl: string;
  sessionToken: string;
  expiresAt: string;
}

export interface BuildPlatformConnectRoutesOptions {
  auth: RouteAuth;
  client: PlatformApiClient;
}

async function resolveOrgTenant(
  c: RouteContext,
  auth: RouteAuth,
): Promise<{ tenant: { orgId: string; userId: string } } | { response: Response }> {
  if (!auth.enabled()) {
    return { response: c.json({ error: 'auth_disabled', message: 'Factory auth is not enabled.' }, 403) };
  }
  await auth.ensureUser(c);
  const tenant = auth.tenant(c);
  if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
  if (!tenant.orgId) {
    return {
      response: c.json(
        {
          error: 'organization_required',
          message: 'Provider connections require an organization. Personal accounts cannot connect providers.',
        },
        403,
      ),
    };
  }
  return { tenant: { orgId: tenant.orgId, userId: tenant.userId } };
}

function providerFromParam(c: RouteContext): PlatformConnectProvider | null {
  const provider = c.req.param('provider');
  return provider ? (PLATFORM_CONNECT_PROVIDERS[provider] ?? null) : null;
}

function platformError(c: RouteContext, err: unknown) {
  if (err instanceof PlatformApiError) {
    if (err.status === 409) {
      return c.json({ error: 'session_pending', message: err.message }, 409);
    }
    if (err.status === 403) {
      return c.json({ error: 'platform_forbidden', message: err.message }, 403);
    }
  }
  return c.json({ error: 'platform_request_failed', message: err instanceof Error ? err.message : String(err) }, 502);
}

/**
 * Build the `/web/integrations/platform/*` routes. Callers only mount these
 * when Platform machine credentials are configured.
 */
export function buildPlatformConnectRoutes(options: BuildPlatformConnectRoutesOptions): ApiRoute[] {
  const { auth, client } = options;

  return [
    registerApiRoute('/web/integrations/platform/:provider/connections', {
      method: 'GET',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const provider = providerFromParam(c);
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          const result = await client.request<{ connections: PlatformConnectionRow[] }>('GET', '/v2/connections');
          const connections = result.connections.filter(connection =>
            provider.connectionIntegrationIds.includes(connection.integrationId),
          );
          return c.json({ connections });
        } catch (err) {
          return platformError(c, err);
        }
      },
    }),
    registerApiRoute('/web/integrations/platform/:provider/connect-session', {
      method: 'POST',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const provider = providerFromParam(c);
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          const session = await client.request<PlatformSessionResponse>(
            'POST',
            `/v2/integrations/${encodeURIComponent(provider.integrationId)}/connect-sessions`,
            {},
          );
          c.header('Cache-Control', 'no-store');
          return c.json(session, 201);
        } catch (err) {
          return platformError(c, err);
        }
      },
    }),
    registerApiRoute('/web/integrations/platform/:provider/connections/:connectionId/reconnect-session', {
      method: 'POST',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const provider = providerFromParam(c);
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        const connectionId = c.req.param('connectionId');
        if (!connectionId) return c.json({ error: 'connection_required' }, 400);
        try {
          // Confirm the connection belongs to this provider before minting so
          // one provider's page cannot reconnect a different provider's
          // connection through this route family.
          const listed = await client.request<{ connections: PlatformConnectionRow[] }>('GET', '/v2/connections');
          const connection = listed.connections.find(
            candidate =>
              candidate.id === connectionId && provider.connectionIntegrationIds.includes(candidate.integrationId),
          );
          if (!connection) return c.json({ error: 'connection_not_found' }, 404);
          const session = await client.request<PlatformSessionResponse>(
            'POST',
            `/v2/connections/${encodeURIComponent(connectionId)}/reconnect-session`,
            {},
          );
          c.header('Cache-Control', 'no-store');
          return c.json(session, 201);
        } catch (err) {
          return platformError(c, err);
        }
      },
    }),
  ];
}

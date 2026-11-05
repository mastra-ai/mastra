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
import { z } from 'zod';

import type { RouteAuth } from '../../../routes/route.js';
import type { PlatformApiClient} from '../api-client.js';
import { PlatformApiError } from '../api-client.js';

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
  'incident-io': { integrationId: 'incident-io', connectionIntegrationIds: ['incident-io'] },
  gitlab: { integrationId: 'gitlab', connectionIntegrationIds: ['gitlab'] },
};

const connectionRowSchema = z.object({
  id: z.string(),
  integrationId: z.string(),
  status: z.string(),
  accountLabel: z.string().nullable(),
  displayName: z.string().nullish(),
  connectedAt: z.string().optional(),
});

const connectionListSchema = z.object({ connections: z.array(connectionRowSchema) });

type PlatformConnectionRow = z.infer<typeof connectionRowSchema>;

const catalogAuthFieldSchema = z.object({
  name: z.string(),
  target: z.enum(['credentials', 'params']).nullish(),
  label: z.string().nullish(),
  description: z.string().nullish(),
  placeholder: z.string().nullish(),
  secret: z.boolean().nullish(),
  required: z.boolean().nullish(),
  order: z.number().nullish(),
});

const catalogSchema = z.object({
  integrations: z.array(
    z.object({
      id: z.string(),
      capabilities: z.object({ mcp: z.boolean().optional() }),
      displayName: z.string().nullish(),
      logoUrl: z.string().nullish(),
      authType: z.string().nullish(),
      authFields: z.array(catalogAuthFieldSchema).nullish(),
    }),
  ),
});

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

async function listConnections(client: PlatformApiClient): Promise<PlatformConnectionRow[]> {
  return connectionListSchema.parse(await client.request<unknown>('GET', '/v2/connections')).connections;
}

async function listCatalog(client: PlatformApiClient) {
  const { integrations } = catalogSchema.parse(await client.request<unknown>('GET', '/v2/integrations'));
  return integrations
    .map(entry => ({
      id: entry.id,
      displayName: entry.displayName ?? entry.id,
      logoUrl: entry.logoUrl ?? null,
      authType: entry.authType ?? null,
      mcp: entry.capabilities.mcp ?? false,
      authFields: [...(entry.authFields ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(field => ({
          name: field.name,
          target: field.target ?? 'credentials',
          label: field.label ?? field.name,
          description: field.description ?? null,
          placeholder: field.placeholder ?? null,
          secret: field.secret ?? false,
          required: field.required ?? false,
        })),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function resolveProvider(c: RouteContext, client: PlatformApiClient): Promise<PlatformConnectProvider | null> {
  const id = c.req.param('provider');
  if (!id) return null;
  const known = PLATFORM_CONNECT_PROVIDERS[id];
  if (known) return known;
  const catalog = await listCatalog(client);
  return catalog.some(entry => entry.id === id) ? { integrationId: id, connectionIntegrationIds: [id] } : null;
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
    registerApiRoute('/web/integrations/platform/catalog', {
      method: 'GET',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          return c.json({ providers: await listCatalog(client) });
        } catch (err) {
          return platformError(c, err);
        }
      },
    }),
    registerApiRoute('/web/integrations/platform/connections', {
      method: 'GET',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          return c.json({ connections: await listConnections(client) });
        } catch (err) {
          return platformError(c, err);
        }
      },
    }),
    registerApiRoute('/web/integrations/platform/:provider/connections', {
      method: 'GET',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const provider = PLATFORM_CONNECT_PROVIDERS[c.req.param('provider') ?? ''];
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          const connections = (await listConnections(client)).filter(connection =>
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
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          const provider = await resolveProvider(c, client);
          if (!provider) return c.json({ error: 'unknown_provider' }, 404);
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
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        const connectionId = c.req.param('connectionId');
        if (!connectionId) return c.json({ error: 'connection_required' }, 400);
        try {
          const provider = await resolveProvider(c, client);
          if (!provider) return c.json({ error: 'unknown_provider' }, 404);
          // Confirm the connection belongs to this provider so one provider cannot reconnect another's connection.
          const connection = (await listConnections(client)).find(
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

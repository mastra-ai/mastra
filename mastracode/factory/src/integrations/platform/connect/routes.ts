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
import type { KnowledgeImporterRoutingStorage } from '../../../storage/domains/importer-routing/base.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
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
  'incident-io': { integrationId: 'incident-io', connectionIntegrationIds: ['incident-io'] },
  // Knowledge-importer providers. Each maps 1:1 to a `@mastra/connect`
  // importer registration; the connect-session flow itself is provider-
  // agnostic so these entries are pure metadata additions. `jira` is
  // intentionally shared with the intake registration above — one Jira
  // connection powers both intake and knowledge imports.
  notion: { integrationId: 'notion', connectionIntegrationIds: ['notion'] },
  confluence: { integrationId: 'confluence', connectionIntegrationIds: ['confluence'] },
  linear: { integrationId: 'linear', connectionIntegrationIds: ['linear'] },
  zendesk: { integrationId: 'zendesk', connectionIntegrationIds: ['zendesk'] },
  fireflies: { integrationId: 'fireflies', connectionIntegrationIds: ['fireflies'] },
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

/**
 * Shape of a single Platform integration catalog entry. We only extract the
 * fields the SPA cares about (display metadata + logo). Other fields the
 * Platform may return are ignored on purpose so a Platform release that adds
 * fields doesn't break the Factory read.
 */
interface PlatformCatalogEntry {
  id: string;
  provider?: string | null;
  displayName?: string | null;
  logoUrl?: string | null;
}

/** SPA-facing catalog row — one per registered `PLATFORM_CONNECT_PROVIDERS`. */
export interface PlatformCatalogRow {
  provider: string;
  integrationId: string;
  displayName: string | null;
  logoUrl: string | null;
}

export interface BuildPlatformConnectRoutesOptions {
  auth: RouteAuth;
  client: PlatformApiClient;
  /**
   * Per-connection knowledge-import routing persistence. When present, the
   * `GET/PUT .../connections/:connectionId/routing` routes are mounted so the
   * SPA can direct each connection's imports to all or selected projects.
   * `projects` validates selected ids against the org's project inventory.
   */
  routing?: KnowledgeImporterRoutingStorage;
  projects?: FactoryProjectsStorage;
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
/**
 * Time-to-live for the in-process catalog snapshot. Five minutes is plenty
 * — the Nango-backed catalog changes only when Mastra's own Platform team
 * adds an integration, and rebuilding the snapshot only involves one HTTP
 * hop; on error we serve the stale snapshot to keep the SPA rendering.
 */
const CATALOG_CACHE_TTL_MS = 5 * 60_000;

/**
 * Build the catalog snapshot: fetch `/v2/integrations`, index it, and
 * project one row per registered SPA provider so a Platform response that
 * omits an entry we've registered still yields a row (with `null` logo).
 */
async function buildCatalogSnapshot(client: PlatformApiClient): Promise<PlatformCatalogRow[]> {
  const result = await client.request<{ integrations: PlatformCatalogEntry[] }>('GET', '/v2/integrations');
  const byId = new Map(result.integrations.map(entry => [entry.id, entry] as const));
  return Object.entries(PLATFORM_CONNECT_PROVIDERS).map(([spaSlug, provider]) => {
    const entry = byId.get(provider.integrationId);
    return {
      provider: spaSlug,
      integrationId: provider.integrationId,
      displayName: entry?.displayName ?? null,
      logoUrl: entry?.logoUrl ?? null,
    };
  });
}

export function buildPlatformConnectRoutes(options: BuildPlatformConnectRoutesOptions): ApiRoute[] {
  const { auth, client, routing, projects } = options;

  let cache: { rows: PlatformCatalogRow[]; fetchedAt: number } | null = null;
  /** In-flight request de-duplication so a burst of card renders shares one call. */
  let inflight: Promise<PlatformCatalogRow[]> | null = null;

  async function loadCatalog(): Promise<PlatformCatalogRow[]> {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CATALOG_CACHE_TTL_MS) return cache.rows;
    // De-duplicate concurrent misses so a burst of card renders shares one
    // Platform fetch _and_ one stale-on-failure guard. The wrapped promise
    // is what every caller awaits, so a rejection is transparently mapped
    // to the stale snapshot for all of them (not just the first arrival).
    if (!inflight) {
      inflight = (async () => {
        try {
          const rows = await buildCatalogSnapshot(client);
          cache = { rows, fetchedAt: Date.now() };
          return rows;
        } catch (err) {
          // Serve stale data on failure so the SPA doesn't blank the section
          // when the Platform catalog service is briefly unreachable.
          if (cache) return cache.rows;
          throw err;
        } finally {
          inflight = null;
        }
      })();
    }
    return inflight;
  }

  return [
    registerApiRoute('/web/integrations/platform/catalog', {
      method: 'GET',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          const rows = await loadCatalog();
          c.header('Cache-Control', 'private, max-age=60');
          return c.json({ integrations: rows });
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
    ...(routing
      ? [
          registerApiRoute('/web/integrations/platform/:provider/connections/:connectionId/routing', {
            method: 'GET',
            requiresAuth: false,
            handler: async rawContext => {
              const c = loose(rawContext);
              const provider = providerFromParam(c);
              if (!provider) return c.json({ error: 'unknown_provider' }, 404);
              const resolved = await resolveOrgTenant(c, auth);
              if ('response' in resolved) return resolved.response;
              const connectionId = c.req.param('connectionId');
              if (!connectionId) return c.json({ error: 'connection_required' }, 400);
              await routing.ensureReady();
              const record = await routing.get(connectionId);
              return c.json({
                routing: record
                  ? { mode: record.mode, projectIds: record.projectIds }
                  : { mode: 'all', projectIds: [] },
              });
            },
          }),
          registerApiRoute('/web/integrations/platform/:provider/connections/:connectionId/routing', {
            method: 'PUT',
            requiresAuth: false,
            handler: async rawContext => {
              const c = loose(rawContext);
              const provider = providerFromParam(c);
              if (!provider) return c.json({ error: 'unknown_provider' }, 404);
              const resolved = await resolveOrgTenant(c, auth);
              if ('response' in resolved) return resolved.response;
              const connectionId = c.req.param('connectionId');
              if (!connectionId) return c.json({ error: 'connection_required' }, 400);

              const body = (await c.req.json().catch(() => null)) as {
                mode?: unknown;
                projectIds?: unknown;
              } | null;
              const mode = body?.mode;
              if (mode !== 'all' && mode !== 'selected') {
                return c.json({ error: 'invalid_mode', message: "mode must be 'all' or 'selected'." }, 400);
              }
              let projectIds: string[] = [];
              if (mode === 'selected') {
                const raw = body?.projectIds;
                if (!Array.isArray(raw) || raw.some(id => typeof id !== 'string' || !id.trim())) {
                  return c.json(
                    { error: 'invalid_project_ids', message: 'projectIds must be an array of project ids.' },
                    400,
                  );
                }
                projectIds = [...new Set(raw as string[])];
                if (projects) {
                  await projects.ensureReady();
                  const known = new Set((await projects.list({ orgId: resolved.tenant.orgId })).map(p => p.id));
                  const unknown = projectIds.filter(id => !known.has(id));
                  if (unknown.length > 0) {
                    return c.json(
                      { error: 'unknown_project', message: `Unknown project id(s): ${unknown.join(', ')}` },
                      400,
                    );
                  }
                }
              }

              try {
                // Same ownership guard as reconnect-session: the connection
                // must belong to this provider's integration ids so one
                // provider's page cannot re-route another provider's sync.
                const listed = await client.request<{ connections: PlatformConnectionRow[] }>(
                  'GET',
                  '/v2/connections',
                );
                const connection = listed.connections.find(
                  candidate =>
                    candidate.id === connectionId &&
                    provider.connectionIntegrationIds.includes(candidate.integrationId),
                );
                if (!connection) return c.json({ error: 'connection_not_found' }, 404);
                await routing.ensureReady();
                const record = await routing.set({
                  orgId: resolved.tenant.orgId,
                  connectionId,
                  integrationId: connection.integrationId,
                  mode,
                  projectIds,
                });
                return c.json({ routing: { mode: record.mode, projectIds: record.projectIds } });
              } catch (err) {
                return platformError(c, err);
              }
            },
          }),
        ]
      : []),
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

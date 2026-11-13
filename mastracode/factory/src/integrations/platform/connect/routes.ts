/**
 * Mastra `apiRoutes` that let the Factory SPA connect and reconnect
 * Platform-managed provider accounts without leaving Factory, and list the
 * Platform project connections whose Mastra Connect tools sessions get.
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

import type { ConnectClient } from '@mastra/connect';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { Context } from 'hono';
import { loose } from '../../../routes/route.js';
import type { RouteAuth } from '../../../routes/route.js';
import type { PlatformConnectBinding } from '../foundation/connect-binding.js';
import { platformErrorMessage, platformErrorStatus } from '../platform-connect.js';
import { offersSessionTools } from './session-tools.js';

type RouteContext = Context;

/**
 * One provider the Factory SPA may connect through these routes. Platform
 * integrations register their own providers, so the route family only serves
 * providers whose integration is installed.
 */
export interface PlatformConnectProviderRegistration {
  /** SPA-facing provider slug, the `:provider` path segment. */
  provider: string;
  /** Platform integration id used to mint connect sessions. */
  integrationId: string;
  /** Connection `integrationId` variants that belong to this provider. */
  connectionIntegrationIds: readonly string[];
  /** The owning integration's Connect plumbing. */
  binding: PlatformConnectBinding;
}

/** An integration that registers providers with the platform connect routes. */
export interface PlatformConnectProviderSource {
  platformConnectProviders(): PlatformConnectProviderRegistration[];
}

export function isPlatformConnectProviderSource(value: unknown): value is PlatformConnectProviderSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<PlatformConnectProviderSource>).platformConnectProviders === 'function'
  );
}

interface ProjectConnectionRow {
  id: string;
  integrationId: string;
  status: string;
  accountLabel?: string | null;
}

interface CatalogEntry {
  id: string;
  displayName?: string | null;
  logoUrl?: string | null;
}

export interface BuildPlatformConnectRoutesOptions {
  auth: RouteAuth;
  providers: readonly PlatformConnectProviderRegistration[];
}

export interface ConnectToolsSource {
  client: ConnectClient;
  projectId: string;
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

function providerFromParam(
  c: RouteContext,
  providers: ReadonlyMap<string, PlatformConnectProviderRegistration>,
): PlatformConnectProviderRegistration | null {
  const provider = c.req.param('provider');
  return provider ? (providers.get(provider) ?? null) : null;
}

function platformError(c: RouteContext, err: unknown) {
  const status = platformErrorStatus(err);
  if (status === 409) {
    return c.json({ error: 'session_pending', message: platformErrorMessage(err) }, 409);
  }
  if (status === 403) {
    return c.json({ error: 'platform_forbidden', message: platformErrorMessage(err) }, 403);
  }
  return c.json({ error: 'platform_request_failed', message: platformErrorMessage(err) }, 502);
}

export function buildConnectToolsRoute(auth: RouteAuth, source: ConnectToolsSource | undefined): ApiRoute {
  return registerApiRoute('/web/integrations/platform/connect-tools', {
    method: 'GET',
    requiresAuth: false,
    handler: async rawContext => {
      const c = loose(rawContext);
      if (!source) {
        return c.json(
          { error: 'connect_tools_off', message: "This Factory's sessions don't get Mastra Connect tools." },
          404,
        );
      }
      if (auth.enabled()) {
        await auth.ensureUser(c);
        if (!auth.tenant(c)) return c.json({ error: 'unauthorized' }, 401);
      }
      const { client, projectId } = source;
      try {
        const [listed, catalog] = await Promise.all([
          client.request<{ connections: ProjectConnectionRow[] }>(
            'GET',
            `/v2/projects/${encodeURIComponent(projectId)}/connections`,
          ),
          client.request<{ integrations: CatalogEntry[] }>('GET', '/v2/integrations').catch((error: unknown) => {
            console.warn(
              `MastraFactory: listing connections without provider names; the Platform catalog failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return { integrations: [] };
          }),
        ]);
        const entries = new Map(catalog.integrations.map(entry => [entry.id, entry]));
        const connections = listed.connections
          .filter(connection => offersSessionTools(connection.integrationId))
          .map(connection => {
            const entry = entries.get(connection.integrationId);
            return {
              id: connection.id,
              integrationId: connection.integrationId,
              providerName: entry?.displayName ?? connection.integrationId,
              logoUrl: entry?.logoUrl ?? null,
              accountLabel: connection.accountLabel ?? null,
              status: connection.status,
            };
          })
          .sort((a, b) => a.providerName.localeCompare(b.providerName));
        return c.json({ projectId, connections });
      } catch (err) {
        return platformError(c, err);
      }
    },
  });
}

/**
 * Build the `/web/integrations/platform/*` routes for the registered
 * providers. Callers only mount these when Platform machine credentials are
 * configured.
 */
export function buildPlatformConnectRoutes(options: BuildPlatformConnectRoutesOptions): ApiRoute[] {
  const { auth } = options;
  const providers = new Map(options.providers.map(registration => [registration.provider, registration]));

  return [
    registerApiRoute('/web/integrations/platform/:provider/connections', {
      method: 'GET',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const provider = providerFromParam(c, providers);
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          const listed = await provider.binding.listConnections({ fresh: true });
          const connections = listed
            .filter(connection => provider.connectionIntegrationIds.includes(connection.integrationId))
            .map(connection => ({
              id: connection.id,
              integrationId: connection.integrationId,
              status: connection.status,
              accountLabel: connection.accountLabel,
              ...(connection.connectedAt ? { connectedAt: connection.connectedAt } : {}),
            }));
          const needsLinking = provider.binding.needsLinking;
          return c.json({ connections, ...(needsLinking.length > 0 ? { needsLinking } : {}) });
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
        const provider = providerFromParam(c, providers);
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        try {
          // Through the project route, so the new connection is born linked
          // to the Factory project and its events are published to it.
          const session = await provider.binding.connect.createConnectSession(provider.integrationId);
          provider.binding.invalidateConnections();
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
        const provider = providerFromParam(c, providers);
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        const connectionId = c.req.param('connectionId');
        if (!connectionId) return c.json({ error: 'connection_required' }, 400);
        try {
          // Confirm the connection is this project's and belongs to this
          // provider before minting, so one provider's page cannot reconnect
          // another provider's (or another project's) connection.
          const listed = await provider.binding.listConnections({ fresh: true });
          const connection = listed.find(
            candidate =>
              candidate.id === connectionId && provider.connectionIntegrationIds.includes(candidate.integrationId),
          );
          if (!connection) return c.json({ error: 'connection_not_found' }, 404);
          const session = await provider.binding.connect.createReconnectSession(connectionId);
          provider.binding.invalidateConnections();
          c.header('Cache-Control', 'no-store');
          return c.json(session, 201);
        } catch (err) {
          return platformError(c, err);
        }
      },
    }),
    registerApiRoute('/web/integrations/platform/:provider/link-connections', {
      method: 'POST',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        const provider = providerFromParam(c, providers);
        if (!provider) return c.json({ error: 'unknown_provider' }, 404);
        const resolved = await resolveOrgTenant(c, auth);
        if ('response' in resolved) return resolved.response;
        if (!(await auth.isOrganizationAdmin(c, resolved.tenant.orgId))) {
          return c.json(
            {
              error: 'organization_admin_required',
              message: 'Organization administrator access is required to link connections.',
            },
            403,
          );
        }
        try {
          const result = await provider.binding.linkOrgConnections();
          return c.json(result);
        } catch (err) {
          return platformError(c, err);
        }
      },
    }),
  ];
}

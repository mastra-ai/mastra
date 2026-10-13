import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';

import {
  createProjectConnectSession,
  disconnectConnection,
  getConnectUrl,
  listIntegrations,
  listProjectConnections,
  resolveClient,
  validateResourceId,
} from './client.js';
import type { ConnectClientOptions, IntegrationCatalogEntry, ProjectConnection, ResolvedClient } from './client.js';
import { MastraConnectError } from './errors.js';
import { renderConnectPage } from './user-connect-page.js';

/**
 * Identity context handed to the optional {@link UserConnectRoutesOptions.resourceId}
 * callback, derived from the server's request pipeline.
 */
export interface UserConnectIdentityContext {
  /** Request-scoped context populated by the server (auth middleware, custom middleware). */
  requestContext?: { get(key: string): unknown };
  /** The authenticated user the server's auth pipeline stored on the request context, when present. */
  user?: unknown;
}

export interface UserConnectRoutesOptions {
  /**
   * Allowlist of platform integration ids exposed to end users (e.g.
   * `['linear', 'slack']`). Providers outside the set 404 on every mounted
   * route. Omit it to expose every provider in the platform catalog. An
   * explicit empty array is rejected: pass a real allowlist or none at all.
   */
  providers?: string[];
  /**
   * Derives the caller's end-user resource key per request. Defaults to the
   * server-derived `MASTRA_RESOURCE_ID_KEY`, which `server.auth.mapUserToResourceId`
   * populates after authentication. A request with no resolvable resource key
   * (callback absent and key unset, callback returning a falsy value, or
   * callback throwing) is rejected with 401 on every mounted route.
   */
  resourceId?: (ctx: UserConnectIdentityContext) => string | undefined | Promise<string | undefined>;
  /** Mount prefix for every route. Default `/connect`. */
  basePath?: string;
  /** Platform project whose connections the routes act on. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /** Platform client configuration. `client.resourceId` is rejected — the routes scope per request. */
  client?: ConnectClientOptions;
  returnTo?: {
    /**
     * Origins (e.g. `https://app.example.com`) allowed as absolute `returnTo`
     * redirect targets on the hosted page. Relative paths are always allowed;
     * everything else is rejected to keep the page free of open redirects.
     */
    allowedOrigins?: string[];
  };
}

/** Route paths that can never be used as a provider id (they collide with static segments). */
const RESERVED_PROVIDER_IDS = new Set(['providers', 'connections', 'sessions']);

const NO_STORE = 'no-store, private';

// Loose structural view of the Hono context core hands to custom API routes.
// Kept `any`-shaped (like core's ApiRouteHandler) so this package does not
// bind to one Hono version.
type RouteContext = any;

interface RouteError {
  status: 400 | 401 | 403 | 404 | 500 | 502;
  code: string;
  message: string;
}

function errorResponse(c: RouteContext, error: RouteError): Response {
  c.header('cache-control', NO_STORE);
  return c.json({ error: { code: error.code, message: error.message } }, error.status);
}

/**
 * Maps a platform-call failure to a safe end-user response. Platform detail
 * strings never reach the end user — this is an unauthenticated-adjacent
 * surface, and the details describe the developer's platform account.
 */
function toRouteError(error: unknown): RouteError {
  if (error instanceof MastraConnectError) {
    if (error.code === 'connection_not_found') {
      return { status: 404, code: 'connection_not_found', message: 'Connection not found.' };
    }
    if (
      error.code === 'missing_access_token' ||
      error.code === 'missing_project_id' ||
      error.code === 'invalid_options'
    ) {
      return { status: 500, code: 'misconfigured', message: 'Connect routes are not configured correctly.' };
    }
    return { status: 502, code: 'platform_error', message: 'Platform request failed.' };
  }
  return { status: 500, code: 'internal_error', message: 'Unexpected error.' };
}

function logRouteError(c: RouteContext, error: unknown): void {
  try {
    const logger = c.get?.('mastra')?.getLogger?.();
    if (logger?.error) {
      logger.error(`[userConnectRoutes] ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  } catch {
    // fall through to console
  }
  console.error('[userConnectRoutes]', error instanceof Error ? error.message : error);
}

const UNAUTHORIZED: RouteError = {
  status: 401,
  code: 'unauthorized',
  message:
    'No end-user identity for this request. Configure server.auth with mapUserToResourceId, or pass a resourceId callback to userConnectRoutes().',
};

/**
 * Validates a `returnTo` redirect target. Relative paths (`/done`) are always
 * allowed; protocol-relative (`//host`), backslash tricks, and non-http(s)
 * schemes are rejected; absolute URLs require their origin to be allowlisted.
 */
export function validateReturnTo(
  raw: string | undefined,
  allowedOrigins: string[],
): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === '') return { ok: true, value: null };
  if (raw.startsWith('/')) {
    // `//host` is protocol-relative and `/\host` is treated the same by
    // browsers — both escape the origin.
    if (raw.startsWith('//') || raw.startsWith('/\\')) return { ok: false };
    return { ok: true, value: raw };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { ok: false };
  if (parsed.username || parsed.password) return { ok: false };
  if (!allowedOrigins.includes(parsed.origin)) return { ok: false };
  return { ok: true, value: parsed.href };
}

function connectionScope(connection: ProjectConnection): 'global' | 'user' {
  return connection.resourceId == null ? 'global' : 'user';
}

/**
 * Builds the mountable end-user connect surface as `ApiRoute[]` for
 * `server.apiRoutes`. The routes do no authentication of their own — the
 * server's auth pipeline authenticates the request and
 * `server.auth.mapUserToResourceId` establishes the end-user resource key the
 * routes are gated on. Every platform call happens server-side with the
 * configured platform token; the browser only ever talks to these routes.
 *
 * ```ts
 * server: {
 *   auth: myAuth,
 *   apiRoutes: [...userConnectRoutes({ providers: ['linear', 'slack'] })],
 * }
 * ```
 */
export function userConnectRoutes(options: UserConnectRoutesOptions): ApiRoute[] {
  if (options.providers !== undefined && (!Array.isArray(options.providers) || options.providers.length === 0)) {
    throw new MastraConnectError(
      'invalid_options',
      'Invalid providers: pass a non-empty allowlist, or omit the option to expose the full platform catalog.',
    );
  }
  const providers = options.providers?.map(provider => {
    const id = typeof provider === 'string' ? provider.trim().toLowerCase() : '';
    if (!id) {
      throw new MastraConnectError('invalid_options', 'Invalid provider id in userConnectRoutes providers allowlist.');
    }
    if (RESERVED_PROVIDER_IDS.has(id) || id.includes('/')) {
      throw new MastraConnectError('invalid_options', `Invalid provider id '${id}': reserved route segment.`);
    }
    return id;
  });
  /** Undefined = no allowlist configured: the full platform catalog is connectable. */
  const allowlist = providers === undefined ? undefined : new Set(providers);

  const basePath = options.basePath ?? '/connect';
  if (!basePath.startsWith('/') || basePath.endsWith('/') || basePath.includes(':') || basePath.includes('*')) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid basePath '${basePath}': expected an absolute path without a trailing slash or route parameters.`,
    );
  }

  const projectId = options.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new MastraConnectError('missing_project_id', 'Missing project id: set MASTRA_PROJECT_ID or pass projectId.');
  }

  if (options.client?.resourceId !== undefined) {
    throw new MastraConnectError(
      'invalid_options',
      'userConnectRoutes derives the resource key per request; do not set client.resourceId.',
    );
  }

  if (options.resourceId !== undefined && typeof options.resourceId !== 'function') {
    throw new MastraConnectError(
      'invalid_options',
      'Invalid resourceId: userConnectRoutes expects a callback deriving the key per request.',
    );
  }

  const allowedOrigins = options.returnTo?.allowedOrigins ?? [];

  /** Resolves the caller's resource key or null when the request carries no usable identity. */
  const identify = async (c: RouteContext): Promise<string | null> => {
    const requestContext = c.get?.('requestContext') as { get(key: string): unknown } | undefined;
    let raw: unknown;
    if (options.resourceId) {
      try {
        raw = await options.resourceId({ requestContext, user: requestContext?.get('user') });
      } catch (error) {
        logRouteError(c, error);
        return null;
      }
    } else {
      raw = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
    }
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    try {
      return validateResourceId(raw);
    } catch (error) {
      logRouteError(c, error);
      return null;
    }
  };

  /**
   * Wraps a handler with the shared gate: resolve the caller identity (401
   * when absent), resolve a resource-scoped platform client, set no-store,
   * and map failures to safe responses.
   */
  const gated =
    (handler: (c: RouteContext, client: ResolvedClient, resourceId: string) => Promise<Response>) =>
    async (c: RouteContext): Promise<Response> => {
      c.header('cache-control', NO_STORE);
      const resourceId = await identify(c);
      if (resourceId === null) return errorResponse(c, UNAUTHORIZED);
      let client: ResolvedClient;
      try {
        client = resolveClient({ ...options.client, resourceId });
      } catch (error) {
        logRouteError(c, error);
        return errorResponse(c, toRouteError(error));
      }
      try {
        return await handler(c, client, resourceId);
      } catch (error) {
        logRouteError(c, error);
        return errorResponse(c, toRouteError(error));
      }
    };

  /** Lists the caller's visible connections (global + own), filtered to the allowlist when one is set. */
  const listVisibleConnections = async (client: ResolvedClient): Promise<ProjectConnection[]> => {
    const connections = await listProjectConnections(client, projectId);
    if (allowlist === undefined) return connections;
    return connections.filter(connection => allowlist.has(connection.integrationId.toLowerCase()));
  };

  const providerParam = (c: RouteContext): string | null => {
    const provider = String(c.req.param('provider') ?? '')
      .trim()
      .toLowerCase();
    if (!provider || RESERVED_PROVIDER_IDS.has(provider) || provider.includes('/')) return null;
    if (allowlist !== undefined && !allowlist.has(provider)) return null;
    return provider;
  };

  const notFound = (c: RouteContext, code: string, message: string): Response =>
    errorResponse(c, { status: 404, code, message });

  // Static paths are registered before the `/:provider` routes so a provider
  // id can never shadow them (and reserved ids are rejected above anyway).
  return [
    {
      path: `${basePath}/providers`,
      method: 'GET',
      requiresAuth: true,
      handler: gated(async (c, client) => {
        const catalog = await listIntegrations(client);
        const toListed = (entry: IntegrationCatalogEntry) => ({
          id: entry.id,
          displayName: entry.displayName ?? null,
          logoUrl: entry.logoUrl ?? null,
          authType: entry.authType ?? null,
          authFields: entry.authFields ?? null,
        });
        if (providers === undefined) {
          // No allowlist configured: the full catalog is connectable.
          return c.json({ providers: catalog.map(toListed) });
        }
        const byId = new Map(catalog.map(entry => [entry.id.toLowerCase(), entry]));
        const visible = providers.flatMap(id => {
          const entry = byId.get(id);
          return entry ? [toListed(entry)] : [];
        });
        return c.json({ providers: visible });
      }),
    },
    {
      path: `${basePath}/connections`,
      method: 'GET',
      requiresAuth: true,
      handler: gated(async (c, client) => {
        const connections = await listVisibleConnections(client);
        return c.json({
          connections: connections.map(connection => ({
            id: connection.id,
            integrationId: connection.integrationId,
            status: connection.status,
            accountLabel: connection.accountLabel ?? null,
            scope: connectionScope(connection),
          })),
        });
      }),
    },
    {
      path: `${basePath}/connections/:id/status`,
      method: 'GET',
      requiresAuth: true,
      handler: gated(async (c, client) => {
        const id = String(c.req.param('id') ?? '');
        const connection = (await listVisibleConnections(client)).find(candidate => candidate.id === id);
        // 404 parity: an invisible connection (another resource's, another
        // project's, or nonexistent) is indistinguishable from an unknown id.
        if (!connection) return notFound(c, 'connection_not_found', 'Connection not found.');
        return c.json({ id: connection.id, status: connection.status, scope: connectionScope(connection) });
      }),
    },
    {
      path: `${basePath}/connections/:id`,
      method: 'DELETE',
      requiresAuth: true,
      handler: gated(async (c, client) => {
        const id = String(c.req.param('id') ?? '');
        const connection = (await listVisibleConnections(client)).find(candidate => candidate.id === id);
        if (!connection) return notFound(c, 'connection_not_found', 'Connection not found.');
        if (connectionScope(connection) === 'global') {
          return errorResponse(c, {
            status: 403,
            code: 'forbidden',
            message: 'Global connections cannot be disconnected from the end-user surface.',
          });
        }
        await disconnectConnection(client, connection.id);
        return c.body(null, 204);
      }),
    },
    {
      path: `${basePath}/connections/:id/launch`,
      method: 'GET',
      requiresAuth: true,
      handler: gated(async (c, client) => {
        // Launch gate: the only way a browser enters the OAuth flow. The
        // vendor connect link is a bearer capability, so it is never returned
        // by the session route; instead the popup navigates here, this route
        // re-fetches the link from the platform under the caller's own
        // resource assertion, and redirects. A caller who is not the
        // session's owner gets a 404 from the platform before any OAuth page
        // ever loads — which is what makes a leaked or fixated launch URL
        // useless.
        const id = String(c.req.param('id') ?? '');
        if (!id) return notFound(c, 'connection_not_found', 'Connection not found.');
        const { connectUrl } = await getConnectUrl(client, id);
        c.header('Cache-Control', 'no-store');
        return c.redirect(connectUrl, 302);
      }),
    },
    {
      path: `${basePath}/:provider/sessions`,
      method: 'POST',
      requiresAuth: true,
      handler: gated(async (c, client) => {
        const provider = providerParam(c);
        if (!provider) return notFound(c, 'provider_not_found', 'Provider not available.');
        if (allowlist === undefined) {
          // Without an allowlist the param only passed shape checks; confirm
          // the provider exists in the catalog so unknown ids 404 instead of
          // surfacing a platform error.
          const known = (await listIntegrations(client)).some(entry => entry.id.toLowerCase() === provider);
          if (!known) return notFound(c, 'provider_not_found', 'Provider not available.');
        }
        const session = await createProjectConnectSession(client, projectId, provider);
        return c.json(
          {
            connectionId: session.connectionId,
            integrationId: session.integrationId,
            // The browser never receives the vendor connect link. It opens
            // the launch gate instead, which verifies the caller's identity
            // against the pending row immediately before OAuth entry.
            launchUrl: `${basePath}/connections/${encodeURIComponent(session.connectionId)}/launch`,
            sessionToken: session.sessionToken,
            expiresAt: session.expiresAt,
          },
          201,
        );
      }),
    },
    {
      path: `${basePath}/:provider`,
      method: 'GET',
      requiresAuth: true,
      handler: gated(async (c, client) => {
        const provider = providerParam(c);
        if (!provider) return notFound(c, 'provider_not_found', 'Provider not available.');
        const returnTo = validateReturnTo(c.req.query('returnTo') ?? undefined, allowedOrigins);
        if (!returnTo.ok) {
          return errorResponse(c, {
            status: 400,
            code: 'invalid_return_to',
            message: 'Invalid returnTo: use a relative path, or allowlist the origin via returnTo.allowedOrigins.',
          });
        }
        const entry = (await listIntegrations(client)).find(candidate => candidate.id.toLowerCase() === provider);
        if (!entry) return notFound(c, 'provider_not_found', 'Provider not available.');
        c.header(
          'content-security-policy',
          [
            "default-src 'none'",
            "script-src 'unsafe-inline'",
            "style-src 'unsafe-inline'",
            'img-src https:',
            "connect-src 'self'",
            "base-uri 'none'",
            "form-action 'none'",
          ].join('; '),
        );
        return c.html(
          renderConnectPage({
            basePath,
            provider: { id: entry.id, displayName: entry.displayName, logoUrl: entry.logoUrl },
            returnTo: returnTo.value,
          }),
        );
      }),
    },
  ];
}

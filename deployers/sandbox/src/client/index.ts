/**
 * Runtime resolver + routing helpers for sandbox deployments.
 *
 * SERVER-ONLY. This module resolves sandbox URLs using provider credentials
 * (e.g. VERCEL_TOKEN) — importing it in the browser would ship those
 * credentials to the client. Use the proxy/handler patterns instead so the
 * browser only ever talks to your own domain.
 */
import { supportsNetworking } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import {
  DEFAULT_PORT,
  getInfoSafe,
  killPreviousServer,
  launchServer,
  resolveRemoteDir,
  tailServerLog,
  waitForHealthy,
} from '../shared';

function assertServerOnly(): void {
  if (typeof (globalThis as { window?: unknown }).window !== 'undefined') {
    throw new Error(
      '@mastra/deployer-sandbox/client is server-only: resolving a sandbox requires provider credentials ' +
        'that must never reach the browser. Proxy requests through your own backend instead ' +
        '(see createSandboxHandler / createSandboxProxy).',
    );
  }
}

export type DeploymentStatus = 'running' | 'stopped' | 'unknown';

export interface GetDeploymentOptions {
  /**
   * The sandbox to resolve. Provider construction is identity — e.g.
   * `new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] })` resolves
   * the same sandbox from any process.
   */
  sandbox: WorkspaceSandbox;
  /** Port the Mastra server listens on. Defaults to 4111. */
  port?: number;
  /**
   * Wake the sandbox when it is not running. Waking starts (resumes) the
   * sandbox and, only if the server is not answering, relaunches it from the
   * recorded launch script — some providers (e.g. E2B) resume processes on
   * wake, others (e.g. Vercel) restore just the filesystem. Defaults to false.
   */
  wake?: boolean;
  /** Directory the app was deployed into. Defaults to `$HOME/mastra-app` resolved inside the sandbox. */
  remoteDir?: string;
  /** Path polled for health. Defaults to `/api`. */
  healthCheckPath?: string;
  /** Max time to wait for health after a wake, in ms. Defaults to 60000. */
  healthCheckTimeoutMs?: number;
}

export interface ResolvedDeployment {
  /** Public URL of the Mastra server, or null when it could not be resolved without waking. */
  url: string | null;
  status: DeploymentStatus;
  /** When the sandbox will auto-shutdown (when known). */
  expiresAt?: Date;
  stop(): Promise<void>;
  destroy(): Promise<void>;
  logs(lines?: number): Promise<string>;
}

/**
 * Resolve (and optionally wake) a sandbox deployment.
 *
 * With `wake: false` (default) the sandbox is not started: the URL is resolved
 * only if the sandbox is already running in this process, otherwise
 * `{ url: null, status: 'stopped' | 'unknown' }` is returned and the caller
 * decides whether to wake.
 *
 * With `wake: true` the sandbox is started (providers resume by identity,
 * e.g. name), the server is relaunched if it is not answering, and the
 * deployment is returned once healthy.
 */
export async function getDeployment(options: GetDeploymentOptions): Promise<ResolvedDeployment> {
  assertServerOnly();

  const {
    sandbox,
    port = DEFAULT_PORT,
    wake = false,
    healthCheckPath = '/api',
    healthCheckTimeoutMs = 60_000,
  } = options;

  const handle = (url: string | null, status: DeploymentStatus, expiresAt?: Date): ResolvedDeployment => ({
    url,
    status,
    expiresAt,
    stop: async () => {
      await sandbox.stop?.();
    },
    destroy: async () => {
      await sandbox.destroy?.();
    },
    // Resolved lazily — reading logs requires a running sandbox anyway.
    logs: async (lines?: number) => tailServerLog(sandbox, await resolveRemoteDir(sandbox, options.remoteDir), lines),
  });

  if (!wake) {
    // Resolve without starting the sandbox (starting can resume billing).
    const url = supportsNetworking(sandbox) ? await sandbox.networking.getPortUrl(port) : null;
    if (!url) {
      return handle(null, 'stopped');
    }
    const healthy = await waitForHealthy(url, { path: healthCheckPath, timeoutMs: 3_000, intervalMs: 1_000 });
    return handle(url, healthy ? 'running' : 'stopped');
  }

  await sandbox.start?.();

  if (!supportsNetworking(sandbox)) {
    throw new Error(`Sandbox provider "${sandbox.provider}" does not support networking (public port URLs).`);
  }
  const url = await sandbox.networking.getPortUrl(port);
  if (!url) {
    throw new Error(
      `Sandbox provider "${sandbox.provider}" did not expose a public URL for port ${port}. ` +
        `Make sure the port is declared when constructing the sandbox (e.g. \`ports: [${port}]\`).`,
    );
  }

  // Some providers (e.g. Vercel) restore the filesystem but not processes on
  // resume, while others (e.g. E2B) resume processes too — relaunch the server
  // from the recorded launch script only when it is not answering.
  let healthy = await waitForHealthy(url, { path: healthCheckPath, timeoutMs: 3_000, intervalMs: 1_000 });
  if (!healthy) {
    const remoteDir = await resolveRemoteDir(sandbox, options.remoteDir);
    await killPreviousServer(sandbox, remoteDir);
    await launchServer(sandbox, remoteDir);
    healthy = await waitForHealthy(url, { path: healthCheckPath, timeoutMs: healthCheckTimeoutMs, intervalMs: 1_000 });
  }
  if (!healthy) {
    const log = await resolveRemoteDir(sandbox, options.remoteDir)
      .then(dir => tailServerLog(sandbox, dir))
      .catch(() => '');
    throw new Error(
      `Woke sandbox but the Mastra server did not become healthy at ${url}${healthCheckPath}.` +
        (log ? `\n\nServer log:\n${log}` : ''),
    );
  }

  const info = await getInfoSafe(sandbox);
  return handle(url, 'running', info?.timeoutAt);
}

// =============================================================================
// Tier 3 helpers
// =============================================================================

export interface CreateSandboxHandlerOptions {
  /**
   * Resolve the current sandbox URL. Called once, cached, and re-invoked when
   * a forwarded request fails at the network level (e.g. the sandbox rotated
   * its URL or went to sleep). Typically wraps `getDeployment`:
   *
   * ```typescript
   * createSandboxHandler({
   *   resolve: async () => {
   *     const dep = await getDeployment({ sandbox, wake: true });
   *     return dep.url!;
   *   },
   * });
   * ```
   */
  resolve: () => Promise<string>;
  /** Shared secret attached as the `x-mastra-sandbox-secret` header on forwarded requests. */
  secret?: string;
}

/**
 * Framework-free route-handler proxy (fetch `Request` → `Response`). Mount it
 * as a catch-all API route; the browser only ever sees your own domain, and
 * the sandbox URL (which rotates across resumes) stays server-side.
 */
export function createSandboxHandler(options: CreateSandboxHandlerOptions): (request: Request) => Promise<Response> {
  assertServerOnly();

  let cachedUrl: Promise<string> | null = null;

  const forward = async (request: Request, baseUrl: string): Promise<Response> => {
    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, baseUrl);

    const headers = new Headers(request.headers);
    headers.delete('host');
    if (options.secret) {
      headers.set('x-mastra-sandbox-secret', options.secret);
    }

    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.body,
      // duplex is required by Node's fetch for streamed request bodies
      duplex: 'half',
      redirect: 'manual',
    } as RequestInit);

    // Redirects are passed through manually — rewrite sandbox-host Locations
    // onto the incoming origin so the rotating sandbox URL never reaches the
    // browser (and subsequent requests keep flowing through this handler).
    const location = response.headers.get('location');
    if (location) {
      const resolved = new URL(location, target);
      if (resolved.origin === new URL(baseUrl).origin) {
        const rewritten = new URL(resolved.pathname + resolved.search + resolved.hash, incoming.origin);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('location', rewritten.toString());
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }
    }

    return response;
  };

  return async (request: Request): Promise<Response> => {
    cachedUrl ??= options.resolve();

    try {
      return await forward(request, await cachedUrl);
    } catch (error) {
      // Connection-level failure: the sandbox may have rotated its URL or gone
      // to sleep. Drop the cached URL so the next request re-resolves, and
      // retry once — but only for idempotent, bodyless methods. A failed
      // connection doesn't prove a write never landed, and a streamed body is
      // already consumed.
      cachedUrl = null;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        throw error;
      }
      cachedUrl = options.resolve();
      try {
        return await forward(request, await cachedUrl);
      } catch (retryError) {
        cachedUrl = null;
        throw retryError;
      }
    }
  };
}

export interface CreateSandboxProxyOptions {
  /** Edge Config item key that holds the current sandbox URL. */
  key: string;
  /**
   * Edge Config connection string (`https://edge-config.vercel.com/ecfg_...?token=...`).
   * Defaults to `process.env.EDGE_CONFIG`.
   */
  edgeConfig?: string;
  /** Shared secret attached as the `x-mastra-sandbox-secret` header on the rewrite. */
  secret?: string;
}

/**
 * Next.js middleware helper for Tier 3 routing: reads the current sandbox URL
 * from Edge Config (kept fresh by the deployer's `alias` option) and rewrites
 * the request to it. Returns `undefined` when no URL is configured so the
 * request falls through.
 *
 * ```typescript
 * // middleware.ts
 * export const middleware = createSandboxProxy({ key: 'my-preview' });
 * export const config = { matcher: '/api/:path*' };
 * ```
 */
export function createSandboxProxy(
  options: CreateSandboxProxyOptions,
): (request: Request) => Promise<Response | undefined> {
  // Reads (and would transmit) the Edge Config bearer token — same
  // server-only contract as the rest of this module.
  assertServerOnly();

  return async (request: Request): Promise<Response | undefined> => {
    const connection = options.edgeConfig ?? process.env.EDGE_CONFIG;
    if (!connection) {
      throw new Error('createSandboxProxy requires an Edge Config connection string (EDGE_CONFIG).');
    }

    const conn = new URL(connection);
    const token = conn.searchParams.get('token');
    const itemUrl = new URL(`${conn.origin}${conn.pathname}/item/${encodeURIComponent(options.key)}`);

    const res = await fetch(itemUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      return undefined;
    }
    const sandboxUrl: unknown = await res.json();
    if (typeof sandboxUrl !== 'string' || !sandboxUrl) {
      return undefined;
    }

    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, sandboxUrl);

    // A Response with the x-middleware-rewrite header is how Next.js
    // middleware expresses a rewrite (NextResponse.rewrite does the same) —
    // this keeps the helper free of a next dependency.
    const headers = new Headers({ 'x-middleware-rewrite': target.toString() });
    if (options.secret) {
      headers.set('x-middleware-request-x-mastra-sandbox-secret', options.secret);
      headers.set('x-middleware-override-headers', 'x-mastra-sandbox-secret');
    }
    return new Response(null, { headers });
  };
}

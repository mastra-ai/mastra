import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { createServer as createHttpsServer } from 'node:https';
import type { Socket } from 'node:net';
import type httpProxy from 'http-proxy';

import type { LocalRoute } from '../types';

/**
 * Configuration for ProxyServer.
 */
export interface ProxyServerConfig {
  /**
   * Port to listen on.
   * @default 3000
   */
  port: number;

  /**
   * Base domain for routing.
   * @default 'localhost'
   */
  baseDomain: string;

  /**
   * Enable TLS (HTTPS).
   * @default false
   */
  tls?: boolean;

  /**
   * TLS certificate (PEM format).
   * Required when tls is true.
   */
  cert?: string;

  /**
   * TLS private key (PEM format).
   * Required when tls is true.
   */
  key?: string;

  /**
   * Enable console logging.
   * @default true
   */
  logRequests?: boolean;

  /**
   * Timeout for proxied requests in ms.
   * @default 30000
   */
  timeout?: number;
}

/**
 * Proxy target resolution result.
 */
export interface ProxyTarget {
  host: string;
  port: number;
  route: LocalRoute;
}

/**
 * Reverse proxy server for local development.
 *
 * Supports both subdomain-based routing (for custom domains like *.mastra.local)
 * and path-based routing (for localhost where subdomains don't work).
 *
 * Uses http-proxy as an optional dependency. If http-proxy is not installed,
 * an error will be thrown when trying to start the proxy.
 *
 * @example
 * ```typescript
 * const proxy = new ProxyServer({
 *   port: 3000,
 *   baseDomain: 'mastra.local',
 * });
 *
 * // Add routes
 * proxy.addRoute(myRoute);
 *
 * // Start proxy
 * await proxy.start();
 *
 * // Requests to http://my-agent.mastra.local:3000 will be proxied
 * // to the route's target
 * ```
 */
export class ProxyServer {
  private readonly config: Required<Omit<ProxyServerConfig, 'cert' | 'key'>> & {
    cert?: string;
    key?: string;
  };
  private readonly routes: Map<string, LocalRoute> = new Map();
  private server: HttpServer | HttpsServer | null = null;
  private proxyInstance: httpProxy | null = null;

  constructor(config: ProxyServerConfig) {
    this.config = {
      port: config.port,
      baseDomain: config.baseDomain,
      tls: config.tls ?? false,
      cert: config.cert,
      key: config.key,
      logRequests: config.logRequests ?? true,
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Add a route to the proxy.
   */
  addRoute(route: LocalRoute): void {
    // For path-based routing (localhost), key by subdomain
    // For subdomain-based routing, key by full hostname
    const key = this.getRouteKey(route);
    this.routes.set(key, route);

    if (this.config.logRequests) {
      console.info(`[ProxyServer] Route added: ${key}`);
    }
  }

  /**
   * Remove a route from the proxy.
   */
  removeRoute(routeId: string): boolean {
    for (const [key, route] of this.routes.entries()) {
      if (route.routeId === routeId) {
        this.routes.delete(key);
        if (this.config.logRequests) {
          console.info(`[ProxyServer] Route removed: ${key}`);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Update a route in the proxy.
   */
  updateRoute(route: LocalRoute): void {
    // Remove old route entry if exists
    this.removeRoute(route.routeId);
    // Add with new key
    this.addRoute(route);
  }

  /**
   * Get route by key.
   */
  getRoute(key: string): LocalRoute | undefined {
    return this.routes.get(key);
  }

  /**
   * Start the proxy server.
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Proxy server is already running');
    }

    // Dynamically import http-proxy
     
    let httpProxyModule: any;
    try {
      httpProxyModule = await import('http-proxy');
    } catch {
      throw new Error(
        'http-proxy is not installed. Install it with: npm install http-proxy\n' +
          'This is an optional dependency for reverse proxy support.',
      );
    }

    // Handle both ESM default export and CommonJS module
    const createProxyServer = httpProxyModule.default?.createProxyServer ?? httpProxyModule.createProxyServer;

    // Create proxy instance
    this.proxyInstance = createProxyServer({
      xfwd: true, // Add X-Forwarded-* headers
      ws: true, // Enable WebSocket support
      timeout: this.config.timeout,
    });

    // Handle proxy errors
    this.proxyInstance!.on('error', (err: Error, _req: unknown, res: unknown) => {
      console.error('[ProxyServer] Proxy error:', err.message);
      if (res && typeof res === 'object' && 'writeHead' in res && typeof (res as ServerResponse).writeHead === 'function') {
        (res as ServerResponse).writeHead(502, { 'Content-Type': 'text/plain' });
        (res as ServerResponse).end('Bad Gateway');
      }
    });

    // Create HTTP or HTTPS server
    const handler = this.handleRequest.bind(this);

    if (this.config.tls) {
      if (!this.config.cert || !this.config.key) {
        throw new Error('TLS enabled but cert and/or key not provided');
      }
      this.server = createHttpsServer(
        {
          cert: this.config.cert,
          key: this.config.key,
        },
        handler,
      );
    } else {
      this.server = createHttpServer(handler);
    }

    // Handle WebSocket upgrades
    this.server.on('upgrade', this.handleUpgrade.bind(this));

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.config.port, () => {
        if (this.config.logRequests) {
          const protocol = this.config.tls ? 'https' : 'http';
          console.info(
            `[ProxyServer] Started on ${protocol}://${this.config.baseDomain}:${this.config.port}`,
          );
        }
        resolve();
      });
    });
  }

  /**
   * Stop the proxy server.
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server!.close(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    if (this.proxyInstance) {
      this.proxyInstance.close();
      this.proxyInstance = null;
    }

    this.server = null;

    if (this.config.logRequests) {
      console.info('[ProxyServer] Stopped');
    }
  }

  /**
   * Check if proxy is running.
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get the port the proxy is listening on.
   */
  getPort(): number {
    return this.config.port;
  }

  /**
   * Get all registered routes.
   */
  getRoutes(): LocalRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Clear all routes.
   */
  clearRoutes(): void {
    this.routes.clear();
    if (this.config.logRequests) {
      console.info('[ProxyServer] All routes cleared');
    }
  }

  /**
   * Handle incoming HTTP request.
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const target = this.resolveTarget(req);

    if (!target) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: No route matches this request');
      return;
    }

    if (this.config.logRequests) {
      console.info(`[ProxyServer] ${req.method} ${req.url} → ${target.host}:${target.port}`);
    }

    // Proxy the request
    this.proxyInstance!.web(req, res, {
      target: `http://${target.host}:${target.port}`,
    });
  }

  /**
   * Handle WebSocket upgrade.
   */
  private handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
    const target = this.resolveTarget(req);

    if (!target) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    if (this.config.logRequests) {
      console.info(`[ProxyServer] WebSocket upgrade → ${target.host}:${target.port}`);
    }

    this.proxyInstance!.ws(req, socket, head, {
      target: `ws://${target.host}:${target.port}`,
    });
  }

  /**
   * Resolve target for a request.
   */
  private resolveTarget(req: IncomingMessage): ProxyTarget | null {
    const host = req.headers.host || '';
    const url = req.url || '/';

    // Try subdomain-based routing first (for custom domains)
    if (this.config.baseDomain !== 'localhost') {
      const subdomain = this.extractSubdomain(host);
      if (subdomain) {
        const route = this.routes.get(subdomain);
        if (route) {
          return {
            host: route.targetHost,
            port: route.targetPort,
            route,
          };
        }
      }
    }

    // Try path-based routing (for localhost)
    const pathMatch = url.match(/^\/([^/]+)(.*)?$/);
    if (pathMatch) {
      const subdomain = pathMatch[1] ?? '';
      const route = this.routes.get(subdomain);
      if (route) {
        // Rewrite URL to strip the subdomain prefix
        const newPath = pathMatch[2] || '/';
        req.url = newPath;
        return {
          host: route.targetHost,
          port: route.targetPort,
          route,
        };
      }
    }

    return null;
  }

  /**
   * Extract subdomain from host header.
   */
  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostname = host.split(':')[0] ?? '';

    // Check if host ends with base domain
    if (!hostname || !hostname.endsWith(this.config.baseDomain)) {
      return null;
    }

    // Extract subdomain (everything before .baseDomain)
    const suffix = `.${this.config.baseDomain}`;
    if (hostname.length <= suffix.length) {
      return null;
    }

    const subdomain = hostname.slice(0, -suffix.length);
    // Handle nested subdomains - just return the first part
    const parts = subdomain.split('.');
    return parts[parts.length - 1] || null;
  }

  /**
   * Get route key for a route.
   */
  private getRouteKey(route: LocalRoute): string {
    // Use subdomain as the key
    return route.subdomain;
  }
}

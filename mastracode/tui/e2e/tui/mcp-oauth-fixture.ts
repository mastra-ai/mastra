import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadMcpSdk } from './mcp-http-fixture.js';
import type { McpFixtureServer } from './mcp-http-fixture.js';

export type McpOAuthFixture = {
  close: () => Promise<void>;
  /** Streamable HTTP MCP endpoint (requires a Bearer token issued by the fixture). */
  url: string;
  /**
   * Release the authorize endpoint when it is being held open (see
   * `holdAuthorize`). Resolves any in-flight authorize request so the OAuth
   * flow can complete. No-op when the endpoint is not held.
   */
  releaseAuthorize: () => void;
};

export type McpOAuthFixtureOptions = {
  name: string;
  registerTools: (server: McpFixtureServer) => void;
  version?: string;
  /**
   * When true, the authorize endpoint parks the request (holding the browser
   * "open") instead of redirecting immediately. This keeps the client's OAuth
   * flow pending so a scenario can exercise cancellation before any code is
   * issued. Call `releaseAuthorize()` to let a held request complete.
   */
  holdAuthorize?: boolean;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown, headers?: Record<string, string>): void {
  res.writeHead(statusCode, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(payload));
}

/**
 * OAuth-protected MCP fixture server for e2e scenarios.
 *
 * A single `node:http` server acts as both the OAuth 2.1 authorization server
 * (RFC 8414 metadata, RFC 7591 dynamic client registration, authorization code
 * grant with PKCE S256) and the protected MCP resource (RFC 9728 metadata,
 * Bearer-gated streamable HTTP endpoint). The authorize endpoint immediately
 * redirects back with a code — no login page — so the e2e harness can act as
 * the browser with a single fetch. All tokens are fake, per-run random strings.
 */
export async function startMcpOAuthFixtureServer(options: McpOAuthFixtureOptions): Promise<McpOAuthFixture> {
  const { McpServer, StreamableHTTPServerTransport } = await loadMcpSdk();
  const activeServers = new Set<McpFixtureServer>();

  const clientsById = new Map<string, { client_id: string; redirect_uris: string[] }>();
  const pendingCodes = new Map<string, { codeChallenge: string; redirectUri: string }>();
  const refreshTokens = new Set<string>();
  const validTokens = new Set<string>();

  // When `holdAuthorize` is set, in-flight authorize requests wait on this
  // promise instead of redirecting; `releaseAuthorize()` resolves it.
  let releaseHeldAuthorize: (() => void) | undefined;
  const authorizeGate = options.holdAuthorize
    ? new Promise<void>(resolve => {
        releaseHeldAuthorize = resolve;
      })
    : undefined;

  let baseUrl = '';

  const createMcpServer = () => {
    const server = new McpServer(
      { name: options.name, version: options.version ?? '1.0.0' },
      { capabilities: { tools: {} } },
    );
    options.registerTools(server);
    activeServers.add(server);
    return server;
  };

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const requestUrl = new URL(req.url ?? '', baseUrl);

      // --- RFC 9728 protected resource metadata (also served under the /mcp
      // suffix for clients that derive the well-known path from the MCP URL) ---
      if (requestUrl.pathname.startsWith('/.well-known/oauth-protected-resource')) {
        sendJson(res, 200, {
          resource: `${baseUrl}/mcp`,
          authorization_servers: [baseUrl],
          bearer_methods_supported: ['header'],
        });
        return;
      }

      // --- RFC 8414 authorization server metadata ---
      if (requestUrl.pathname === '/.well-known/oauth-authorization-server') {
        sendJson(res, 200, {
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/authorize`,
          token_endpoint: `${baseUrl}/token`,
          registration_endpoint: `${baseUrl}/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
        });
        return;
      }

      // --- RFC 7591 dynamic client registration ---
      if (requestUrl.pathname === '/register' && req.method === 'POST') {
        const metadata = JSON.parse(await readBody(req));
        const registration = { client_id: `client-${randomUUID()}`, redirect_uris: metadata.redirect_uris };
        clientsById.set(registration.client_id, registration);
        sendJson(res, 201, {
          ...metadata,
          client_id: registration.client_id,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          token_endpoint_auth_method: 'none',
        });
        return;
      }

      // --- Authorization endpoint: no login page, immediately redirect back ---
      if (requestUrl.pathname === '/authorize') {
        const client = clientsById.get(requestUrl.searchParams.get('client_id') ?? '');
        const redirectUri = requestUrl.searchParams.get('redirect_uri') ?? '';
        if (!client || !client.redirect_uris.includes(redirectUri)) {
          sendJson(res, 400, { error: 'invalid_request', error_description: 'Unknown client or redirect_uri' });
          return;
        }
        // Park the request (browser "open") until released, so a scenario can
        // cancel the pending OAuth flow before any code is issued.
        if (authorizeGate) {
          await authorizeGate;
        }
        const code = `code-${randomUUID()}`;
        pendingCodes.set(code, { codeChallenge: requestUrl.searchParams.get('code_challenge') ?? '', redirectUri });
        const location = new URL(redirectUri);
        location.searchParams.set('code', code);
        location.searchParams.set('state', requestUrl.searchParams.get('state') ?? '');
        res.writeHead(302, { location: location.toString() });
        res.end();
        return;
      }

      // --- Token endpoint: authorization code (PKCE S256) and refresh grants ---
      if (requestUrl.pathname === '/token' && req.method === 'POST') {
        const params = new URLSearchParams(await readBody(req));
        const grantType = params.get('grant_type');
        if (grantType === 'authorization_code') {
          const pending = pendingCodes.get(params.get('code') ?? '');
          const challenge = createHash('sha256')
            .update(params.get('code_verifier') ?? '')
            .digest('base64url');
          if (!pending || pending.codeChallenge !== challenge) {
            sendJson(res, 400, { error: 'invalid_grant' });
            return;
          }
          pendingCodes.delete(params.get('code')!);
        } else if (grantType === 'refresh_token') {
          if (!refreshTokens.has(params.get('refresh_token') ?? '')) {
            sendJson(res, 400, { error: 'invalid_grant' });
            return;
          }
        } else {
          sendJson(res, 400, { error: 'unsupported_grant_type' });
          return;
        }
        const accessToken = `mc-e2e-access-${randomUUID()}`;
        const refreshToken = `mc-e2e-refresh-${randomUUID()}`;
        validTokens.add(accessToken);
        refreshTokens.add(refreshToken);
        sendJson(res, 200, {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refreshToken,
        });
        return;
      }

      // --- Bearer-gated MCP endpoint ---
      if (requestUrl.pathname === '/mcp') {
        const authorization = req.headers.authorization ?? '';
        const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
        if (!validTokens.has(token)) {
          sendJson(
            res,
            401,
            { error: 'invalid_token' },
            {
              'www-authenticate': `Bearer error="invalid_token", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
            },
          );
          return;
        }

        const mcpServer = createMcpServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await mcpServer.connect(transport);
        res.on('finish', () => {
          activeServers.delete(mcpServer);
          void mcpServer.close().catch(() => undefined);
        });
        await transport.handleRequest(req, res);
        return;
      }

      sendJson(res, 404, { error: 'not_found' });
    })().catch(error => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(error instanceof Error ? (error.stack ?? error.message) : error));
    });
  });

  baseUrl = await new Promise<string>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.off('error', reject);
      const address = httpServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error(`${options.name} fixture server did not bind to a port`));
        return;
      }
      resolve(`http://127.0.0.1:${(address as AddressInfo).port}`);
    });
  });

  return {
    close: async () => {
      releaseHeldAuthorize?.();
      await Promise.all([...activeServers].map(server => server.close().catch(() => undefined)));
      activeServers.clear();
      await new Promise<void>(resolve => httpServer.close(() => resolve())).catch(() => undefined);
    },
    url: `${baseUrl}/mcp`,
    releaseAuthorize: () => releaseHeldAuthorize?.(),
  };
}

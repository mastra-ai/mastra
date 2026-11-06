/** Real MCP servers on loopback for Factory MCP server tests. Not bundled (see tsdown.config.ts). */

import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createTool } from '@mastra/core/tools';
import { createOAuthMiddleware, MCPServer } from '@mastra/mcp';
import { onTestFinished } from 'vitest';
import { z } from 'zod';

export interface TestMcpServerCall {
  tool: string;
  args: unknown;
}

export interface TestMcpServer {
  /** Streamable HTTP endpoint, e.g. `http://127.0.0.1:51234/mcp`. */
  url: string;
  host: string;
  /** Every tool invocation the server executed, in order. */
  calls: TestMcpServerCall[];
  /** JSON-RPC methods received, in order (`server/discover`, `tools/list`, `tools/call`, ...). */
  methods: string[];
  /** Accept only this bearer token from now on, as after a credential rotation. */
  acceptToken(token: string): void;
  /** Hold the next request until `release()`; `arrived` resolves once it has come in. */
  holdNextRequest(): { arrived: Promise<void>; release(): void };
  close(): Promise<void>;
}

/**
 * Starts a real `@mastra/mcp` server over Streamable HTTP on `127.0.0.1:0` with
 * `echo` and `add` tools, plus an echo-like tool for each of `extraToolNames`
 * (described by `extraToolDescription` when given).
 * With `bearerToken`, requests without
 * `Authorization: Bearer <token>` get a 401. With `authorizationServer`, the
 * server is an OAuth protected resource (RFC 9728) that accepts the access
 * tokens that authorization server issued. Closed when the test finishes.
 */
export async function startTestMcpServer({
  bearerToken,
  authorizationServer,
  extraToolNames = [],
  extraToolDescription,
}: {
  bearerToken?: string;
  authorizationServer?: TestAuthorizationServer;
  extraToolNames?: string[];
  extraToolDescription?: string;
} = {}): Promise<TestMcpServer> {
  const calls: TestMcpServerCall[] = [];
  const methods: string[] = [];
  const mcp = new MCPServer({
    id: `factory-mcp-test-${randomUUID()}`,
    name: 'Factory MCP test server',
    version: '1.0.0',
    tools: {
      echo: createTool({
        id: 'echo',
        description: 'Echo text back.',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => {
          calls.push({ tool: 'echo', args: { text } });
          return { text };
        },
      }),
      add: createTool({
        id: 'add',
        description: 'Add two numbers.',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => {
          calls.push({ tool: 'add', args: { a, b } });
          return { sum: a + b };
        },
      }),
      ...Object.fromEntries(
        extraToolNames.map(name => [
          name,
          createTool({
            id: name,
            description: extraToolDescription ?? `Echo text back as ${name}.`,
            inputSchema: z.object({ text: z.string() }),
            execute: async ({ text }) => {
              calls.push({ tool: name, args: { text } });
              return { text };
            },
          }),
        ]),
      ),
    },
  });

  let origin = '';
  let oauth: ReturnType<typeof createOAuthMiddleware> | undefined;
  let held: { arrived: () => void; released: Promise<void> } | undefined;
  const http = createServer(async (req, res) => {
    if (held) {
      const { arrived, released } = held;
      held = undefined;
      arrived();
      await released;
    }
    if (oauth && !(await oauth(req, res, new URL(req.url ?? '/', origin))).proceed) return;
    if (bearerToken && req.headers.authorization !== `Bearer ${bearerToken}`) {
      res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (req.method === 'POST') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks).toString('utf8');
      for (const message of [JSON.parse(body)].flat()) {
        if (typeof message?.method === 'string') methods.push(message.method);
      }
      // startHTTP reads the body from the request; hand it the parsed copy.
      (req as typeof req & { body?: unknown }).body = JSON.parse(body);
    }
    await mcp.startHTTP({ url: new URL(req.url ?? '/', origin), httpPath: '/mcp', req, res });
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const { port } = http.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
  if (authorizationServer) {
    oauth = createOAuthMiddleware({
      oauth: {
        resource: `${origin}/mcp`,
        authorizationServers: [authorizationServer.issuer],
        validateToken: async token =>
          authorizationServer.validTokens.has(token)
            ? { valid: true }
            : { valid: false, error: 'invalid_token', errorDescription: 'Token not recognized' },
      },
      mcpPath: '/mcp',
    });
  }

  const close = async () => {
    http.closeAllConnections();
    await new Promise<void>(resolve => http.close(() => resolve()));
    await mcp.close();
  };
  onTestFinished(close);
  return {
    url: `${origin}/mcp`,
    host: `127.0.0.1:${port}`,
    calls,
    methods,
    acceptToken: token => {
      bearerToken = token;
    },
    holdNextRequest: () => {
      let arrived!: () => void;
      let release!: () => void;
      const arrival = new Promise<void>(resolve => (arrived = resolve));
      held = { arrived, released: new Promise<void>(resolve => (release = resolve)) };
      return { arrived: arrival, release };
    },
    close,
  };
}

export interface TestAuthorizationServer {
  issuer: string;
  host: string;
  /** Register a client out of band, the way an operator would. */
  preregister(client: { clientId: string; clientSecret?: string; redirectUris: string[] }): void;
  /** `iss` sent back on authorization responses (RFC 9207); defaults to the issuer. */
  responseIssuer: string;
  /** Deny the next authorizations with `error=access_denied`. */
  deny: boolean;
  /**
   * Fail every token request, echoing the request (tokens, verifier, secret)
   * back: as a plain-text 500, or as an `invalid_request` description.
   */
  echoTokenRequests: false | 'text' | 'oauth';
  /** Access tokens the protected MCP server accepts. */
  validTokens: Set<string>;
  /** Refresh tokens the token endpoint accepts. */
  refreshTokens: Set<string>;
  /** `client_id` of every authorization request, in order. */
  authorizeClientIds: string[];
  /** Grants the token endpoint served, in order. */
  grants: Array<'authorization_code' | 'refresh_token'>;
  /** Times the (never used) dynamic client registration endpoint was contacted. */
  registrationAttempts: number;
  /** Hold the next token request until `release()`; `arrived` resolves once it has come in. */
  holdNextTokenRequest(): { arrived: Promise<void>; release(): void };
  close(): Promise<void>;
}

/**
 * Starts a minimal OAuth 2.1 authorization server on `127.0.0.1:0`: RFC 8414
 * metadata, pre-registered and Client ID Metadata Document (https URL)
 * clients, the authorization code grant with PKCE S256, and the refresh token
 * grant. Closed when the test finishes.
 */
export async function startTestAuthorizationServer(): Promise<TestAuthorizationServer> {
  const clients = new Map<string, { clientSecret?: string; redirectUris: string[] }>();
  const codes = new Map<string, { clientId: string; redirectUri: string; challenge: string }>();
  let issuer = '';
  let heldToken: { arrived: () => void; released: Promise<void> } | undefined;

  const send = (res: ServerResponse, status: number, body: unknown) =>
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  const readForm = async (req: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  };
  const issueTokens = (res: ServerResponse) => {
    const accessToken = `access-${randomUUID()}`;
    const refreshToken = `refresh-${randomUUID()}`;
    server.validTokens.add(accessToken);
    server.refreshTokens.add(refreshToken);
    send(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: 3600, refresh_token: refreshToken });
  };

  const http: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', issuer);
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      return send(res, 200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        registration_endpoint: `${issuer}/register`,
        client_id_metadata_document_supported: true,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
        authorization_response_iss_parameter_supported: true,
      });
    }
    if (url.pathname === '/register') {
      server.registrationAttempts += 1;
      return send(res, 400, { error: 'invalid_request' });
    }
    if (url.pathname === '/authorize') {
      const clientId = url.searchParams.get('client_id') ?? '';
      const redirectUri = url.searchParams.get('redirect_uri') ?? '';
      // A URL client ID stands in for fetching its metadata document.
      const client = clientId.startsWith('https://') ? { redirectUris: [redirectUri] } : clients.get(clientId);
      if (!client?.redirectUris.includes(redirectUri) || url.searchParams.get('code_challenge_method') !== 'S256') {
        return send(res, 400, { error: 'invalid_request' });
      }
      server.authorizeClientIds.push(clientId);
      const location = new URL(redirectUri);
      if (server.deny) {
        location.searchParams.set('error', 'access_denied');
      } else {
        const code = `code-${randomUUID()}`;
        codes.set(code, { clientId, redirectUri, challenge: url.searchParams.get('code_challenge') ?? '' });
        location.searchParams.set('code', code);
      }
      location.searchParams.set('state', url.searchParams.get('state') ?? '');
      location.searchParams.set('iss', server.responseIssuer);
      return res.writeHead(302, { location: location.toString() }).end();
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      if (heldToken) {
        const { arrived, released } = heldToken;
        heldToken = undefined;
        arrived();
        await released;
      }
      const form = await readForm(req);
      if (server.echoTokenRequests === 'text') {
        return res.writeHead(500, { 'content-type': 'text/plain' }).end(`upstream rejected ${form.toString()}`);
      }
      if (server.echoTokenRequests === 'oauth') {
        return send(res, 400, { error: 'invalid_request', error_description: `rejected ${form.toString()}` });
      }
      const basic = req.headers.authorization?.startsWith('Basic ')
        ? Buffer.from(req.headers.authorization.slice(6), 'base64').toString('utf8').split(':').map(decodeURIComponent)
        : undefined;
      const clientId = basic?.[0] ?? form.get('client_id') ?? '';
      const clientSecret = basic?.[1] ?? form.get('client_secret') ?? undefined;
      const registered = clients.get(clientId);
      if (registered?.clientSecret && registered.clientSecret !== clientSecret) {
        return send(res, 401, { error: 'invalid_client' });
      }
      if (form.get('grant_type') === 'authorization_code') {
        const pending = codes.get(form.get('code') ?? '');
        codes.delete(form.get('code') ?? '');
        const verifier = form.get('code_verifier') ?? '';
        if (
          !pending ||
          pending.clientId !== clientId ||
          pending.redirectUri !== form.get('redirect_uri') ||
          createHash('sha256').update(verifier).digest('base64url') !== pending.challenge
        ) {
          return send(res, 400, { error: 'invalid_grant' });
        }
        server.grants.push('authorization_code');
        return issueTokens(res);
      }
      if (form.get('grant_type') === 'refresh_token') {
        const refreshToken = form.get('refresh_token') ?? '';
        if (!server.refreshTokens.delete(refreshToken)) return send(res, 400, { error: 'invalid_grant' });
        server.grants.push('refresh_token');
        return issueTokens(res);
      }
      return send(res, 400, { error: 'unsupported_grant_type' });
    }
    send(res, 404, { error: 'not_found' });
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const { port } = http.address() as AddressInfo;
  issuer = `http://127.0.0.1:${port}`;

  const server: TestAuthorizationServer = {
    issuer,
    host: `127.0.0.1:${port}`,
    preregister: ({ clientId, ...client }) => void clients.set(clientId, client),
    responseIssuer: issuer,
    deny: false,
    echoTokenRequests: false,
    validTokens: new Set(),
    refreshTokens: new Set(),
    authorizeClientIds: [],
    grants: [],
    registrationAttempts: 0,
    holdNextTokenRequest: () => {
      let arrived!: () => void;
      let release!: () => void;
      const arrival = new Promise<void>(resolve => (arrived = resolve));
      heldToken = { arrived, released: new Promise<void>(resolve => (release = resolve)) };
      return { arrived: arrival, release };
    },
    close: async () => {
      http.closeAllConnections();
      await new Promise<void>(resolve => http.close(() => resolve()));
    },
  };
  onTestFinished(server.close);
  return server;
}

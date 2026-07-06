/**
 * Slack user-token OAuth 2.0 + PKCE flow for the `/slack` integration.
 *
 * mastracode drives this flow itself (out-of-band) against the Mastra-published
 * Slack app, then passes the resulting user token to Slack's remote MCP server
 * as a bearer header. This does NOT go through `@mastra/mcp`'s OAuth provider
 * (which assumes Dynamic Client Registration that Slack rejects).
 *
 * PKCE means the app is a public client: the token exchange sends `code` +
 * `code_verifier` and NO client_secret. PKCE also makes refresh tokens expire
 * (~30 days), so `AuthStorage.getApiKey` refreshes silently on expiry.
 *
 * NOTE: This module uses Node.js crypto/http for the loopback callback. It is
 * only intended for CLI use, not browser environments.
 */

// NEVER convert to top-level imports - breaks browser/Vite builds (web-ui)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let _cryptoPromise: Promise<typeof import('node:crypto')> | null = null;
let _randomBytes: ((size: number) => Buffer) | null = null;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let _httpPromise: Promise<typeof import('node:http')> | null = null;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let _http: typeof import('node:http') | null = null;

type HttpServer = {
  off: (event: 'error' | 'listening', listener: (...args: any[]) => void) => HttpServer;
  once: (event: 'error' | 'listening', listener: (...args: any[]) => void) => HttpServer;
  listen: (port: number, hostname: string) => HttpServer;
  close: () => void;
};

if (typeof process !== 'undefined' && (process.versions?.node || process.versions?.bun)) {
  _cryptoPromise = import('node:crypto').then(m => {
    _randomBytes = m.randomBytes;
    return m;
  });
  _httpPromise = import('node:http').then(m => {
    _http = m;
    return m;
  });
}

import { generatePKCE } from '../auth/pkce.js';
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from '../auth/types.js';
import { resolveSlackClientId } from './client-id.js';
import { DEFAULT_SLACK_PERMISSION_LEVEL, scopesForLevel } from './scopes.js';
import type { SlackPermissionLevel } from './scopes.js';

/** Auth provider id under which the Slack user token is stored in auth.json. */
export const SLACK_AUTH_PROVIDER_ID = 'slack';

const AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

/**
 * Loopback ports mastracode binds to for the OAuth callback. These MUST match
 * `oauth_config.redirect_urls` in slack-app-manifest.json.
 */
export const SLACK_CALLBACK_PORTS: readonly number[] = [41927, 41928, 41929];

const DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 12 * 60 * 60;

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Slack connected</title>
</head>
<body>
  <p>Slack connected. Return to your terminal to continue.</p>
</body>
</html>`;

/**
 * Extra login context that the `/slack connect` command sets on the provider
 * right before calling `AuthStorage.login('slack', ...)`, since the generic
 * `OAuthProviderInterface.login` signature can't carry it.
 */
export interface SlackLoginContext {
  permissionLevel: SlackPermissionLevel;
  clientId?: string;
}

let pendingLoginContext: SlackLoginContext | null = null;

/** Set the scopes/client_id to use for the next `login()` call. */
export function setSlackLoginContext(ctx: SlackLoginContext): void {
  pendingLoginContext = ctx;
}

async function getRandomBytes(): Promise<(size: number) => Buffer> {
  if (!_randomBytes && _cryptoPromise) {
    _randomBytes = (await _cryptoPromise).randomBytes;
  }
  if (!_randomBytes) {
    throw new Error('Slack OAuth is only available in Node.js environments');
  }
  return _randomBytes;
}

async function getHttpModule() {
  if (!_http && _httpPromise) {
    _http = await _httpPromise;
  }
  if (!_http) {
    throw new Error('Slack OAuth is only available in Node.js environments');
  }
  return _http;
}

async function createState(): Promise<string> {
  const randomBytes = await getRandomBytes();
  return randomBytes(16).toString('hex');
}

/** Build the Slack authorize URL for the PKCE flow (user-token scopes). */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  challenge: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  // Slack requests user-token scopes via `user_scope` (not `scope`).
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('user_scope', params.scopes.join(','));
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge', params.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  return url.toString();
}

type SlackTokenResponse = {
  ok?: boolean;
  error?: string;
  team?: { id?: string; name?: string };
  authed_user?: {
    id?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
};

function tokenResponseToCredentials(
  json: SlackTokenResponse,
  clientId: string,
  previous?: Partial<OAuthCredentials>,
): OAuthCredentials {
  if (!json.ok) {
    throw new Error(`Slack OAuth failed: ${json.error ?? 'unknown_error'}`);
  }
  const user = json.authed_user;
  if (!user?.access_token) {
    throw new Error('Slack OAuth response missing user access token');
  }
  return {
    access: user.access_token,
    // Slack omits refresh_token when token rotation is off; keep the old one.
    refresh: user.refresh_token ?? (previous?.refresh as string) ?? '',
    expires: Date.now() + (user.expires_in ?? DEFAULT_TOKEN_EXPIRES_IN_SECONDS) * 1000,
    clientId,
    teamId: json.team?.id ?? previous?.teamId,
    teamName: json.team?.name ?? previous?.teamName,
    userId: user.id ?? previous?.userId,
  };
}

/** Exchange an authorization code for Slack user-token credentials (no secret). */
export async function exchangeAuthorizationCode(params: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      code: params.code,
      code_verifier: params.verifier,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Slack token exchange HTTP ${response.status}: ${text}`);
  }
  return tokenResponseToCredentials((await response.json()) as SlackTokenResponse, params.clientId);
}

/** Refresh Slack user-token credentials using the refresh token (no secret). */
export async function refreshSlackToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  const clientId = resolveSlackClientId(credentials.clientId as string | undefined);
  if (!clientId) {
    throw new Error('Cannot refresh Slack token: no client_id available');
  }
  if (!credentials.refresh) {
    throw new Error('Cannot refresh Slack token: no refresh token stored');
  }
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: credentials.refresh,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Slack token refresh HTTP ${response.status}: ${text}`);
  }
  const json = (await response.json()) as SlackTokenResponse;
  // A refresh response returns the rotated token under authed_user as well.
  return tokenResponseToCredentials(json, clientId, credentials);
}

type OAuthServerInfo = {
  redirectUri: string;
  warning?: string;
  close: () => void;
  cancelWait: () => void;
  waitForCode: () => Promise<{ code: string } | null>;
};

function listen(server: HttpServer, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const onError = () => {
      server.off('listening', onListening);
      resolve(false);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(true);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function startLocalOAuthServer(state: string): Promise<OAuthServerInfo> {
  const http = await getHttpModule();
  let lastCode: string | null = null;
  let cancelled = false;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '', 'http://localhost');
      if (url.pathname !== '/callback') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      if (url.searchParams.get('state') !== state) {
        res.statusCode = 400;
        res.end('State mismatch');
        return;
      }
      const code = url.searchParams.get('code');
      if (!code) {
        res.statusCode = 400;
        res.end('Missing authorization code');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(SUCCESS_HTML);
      lastCode = code;
    } catch {
      res.statusCode = 500;
      res.end('Internal error');
    }
  });

  let boundPort: number | null = null;
  for (const port of SLACK_CALLBACK_PORTS) {
    if (await listen(server, port)) {
      boundPort = port;
      break;
    }
  }

  if (boundPort === null) {
    return {
      redirectUri: `http://localhost:${SLACK_CALLBACK_PORTS[0]}/callback`,
      warning: `Slack OAuth requires one of localhost ports ${SLACK_CALLBACK_PORTS.join(', ')}, but all are in use. Free one and retry.`,
      close: () => {
        try {
          server.close();
        } catch {
          // ignore
        }
      },
      cancelWait: () => {},
      waitForCode: async () => null,
    };
  }

  return {
    redirectUri: `http://localhost:${boundPort}/callback`,
    close: () => server.close(),
    cancelWait: () => {
      cancelled = true;
    },
    waitForCode: async () => {
      const sleep = () => new Promise(r => setTimeout(r, 100));
      for (let i = 0; i < 1800; i += 1) {
        if (lastCode) return { code: lastCode };
        if (cancelled) return null;
        await sleep();
      }
      return null;
    },
  };
}

function parseAuthorizationInput(input: string): { code?: string; state?: string } {
  const value = input.trim();
  if (!value) return {};
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
    };
  } catch {
    // not a URL; treat as raw code
  }
  if (value.includes('code=')) {
    const params = new URLSearchParams(value);
    return { code: params.get('code') ?? undefined, state: params.get('state') ?? undefined };
  }
  return { code: value };
}

/** Run the full PKCE loopback login flow and return user-token credentials. */
export async function loginSlack(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  const ctx = pendingLoginContext ?? { permissionLevel: DEFAULT_SLACK_PERMISSION_LEVEL };
  pendingLoginContext = null;

  const clientId = resolveSlackClientId(ctx.clientId);
  if (!clientId) {
    throw new Error(
      'No Slack client_id available. Mastra\u2019s Slack app is not published yet; connect with `/slack connect --byo <client_id>`.',
    );
  }

  const scopes = scopesForLevel(ctx.permissionLevel);
  const state = await createState();
  const { verifier, challenge } = await generatePKCE();
  const server = await startLocalOAuthServer(state);
  if (server.warning) {
    throw new Error(server.warning);
  }

  const url = buildAuthorizeUrl({
    clientId,
    redirectUri: server.redirectUri,
    scopes,
    challenge,
    state,
  });

  callbacks.onAuth({
    url,
    instructions: 'A browser window should open. Approve the Slack permissions to finish.',
  });

  try {
    let code: string | undefined;
    const result = await server.waitForCode();
    if (result?.code) {
      code = result.code;
    } else if (callbacks.onManualCodeInput) {
      const input = await callbacks.onManualCodeInput();
      const parsed = parseAuthorizationInput(input);
      if (parsed.state && parsed.state !== state) {
        throw new Error('State mismatch');
      }
      code = parsed.code;
    }

    if (!code) {
      const input = await callbacks.onPrompt({
        message: 'Paste the authorization code (or full redirect URL):',
      });
      const parsed = parseAuthorizationInput(input);
      if (parsed.state && parsed.state !== state) {
        throw new Error('State mismatch');
      }
      code = parsed.code;
    }

    if (!code) {
      throw new Error('Missing authorization code');
    }

    return await exchangeAuthorizationCode({
      code,
      verifier,
      redirectUri: server.redirectUri,
      clientId,
    });
  } finally {
    server.close();
  }
}

export const __testing = {
  buildAuthorizeUrl,
  parseAuthorizationInput,
  startLocalOAuthServer,
  tokenResponseToCredentials,
};

export const slackOAuthProvider: OAuthProviderInterface = {
  id: SLACK_AUTH_PROVIDER_ID,
  name: 'Slack',
  usesCallbackServer: true,

  async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
    return loginSlack(callbacks);
  },

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    return refreshSlackToken(credentials);
  },

  getApiKey(credentials: OAuthCredentials): string {
    return credentials.access;
  },
};

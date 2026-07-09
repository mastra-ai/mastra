/**
 * Slack user-token OAuth 2.0 + PKCE primitives.
 *
 * These functions authorize a Slack **user account** against a pre-existing
 * Slack app (Mastra's published app by default, or a BYO client_id). The app
 * is a PKCE public client: the token exchange sends `code` + `code_verifier`
 * and NO client_secret, so the client_id is safe to ship.
 *
 * Slack rotates the refresh token on every refresh — callers MUST persist the
 * returned credentials after each call to {@link refreshUserToken}.
 */
import { createServer } from 'node:http';

import type { SlackUserCredentials } from './credential-storage';

const AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

/** Slack user tokens expire after 12h when token rotation is enabled. */
const DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 12 * 60 * 60;

/**
 * Loopback ports the connect flow binds for the OAuth callback. These must be
 * listed in the Slack app's `oauth_config.redirect_urls`.
 */
export const SLACK_CALLBACK_PORTS: readonly number[] = [41927, 41928, 41929];

/** Env var fallback for the OAuth client_id (`MASTRA_SLACK_CLIENT_ID`). */
export function resolveSlackClientId(clientId?: string): string | undefined {
  const explicit = clientId?.trim();
  if (explicit) return explicit;
  const fromEnv = typeof process !== 'undefined' ? process.env?.MASTRA_SLACK_CLIENT_ID?.trim() : undefined;
  return fromEnv || undefined;
}

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

/** Build the Slack authorize URL for the PKCE user-token flow. */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  challenge: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  // User-token scopes go in `user_scope` (`scope` requests bot scopes).
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
  /** Present on the initial `authorization_code` exchange (user token nested). */
  authed_user?: {
    id?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  /**
   * Present on `refresh_token` grants: Slack returns the rotated user token at
   * the TOP level (`token_type: "user"`), NOT nested under `authed_user`.
   */
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: string;
  token_type?: string;
};

export function tokenResponseToCredentials(
  json: SlackTokenResponse,
  clientId: string,
  previous?: Partial<SlackUserCredentials>,
): SlackUserCredentials {
  if (!json.ok) {
    throw new Error(`Slack OAuth failed: ${json.error ?? 'unknown_error'}`);
  }
  // Initial code exchange nests the user token under `authed_user`; refresh
  // responses return it at the top level with `token_type: "user"`.
  const user = json.authed_user;
  const accessToken = user?.access_token ?? json.access_token;
  if (!accessToken) {
    throw new Error('Slack OAuth response missing user access token');
  }
  return {
    accessToken,
    // Slack omits refresh_token when token rotation is off; keep the old one.
    refreshToken: user?.refresh_token ?? json.refresh_token ?? previous?.refreshToken,
    expiresAt: Date.now() + (user?.expires_in ?? json.expires_in ?? DEFAULT_TOKEN_EXPIRES_IN_SECONDS) * 1000,
    clientId,
    teamId: json.team?.id ?? previous?.teamId,
    teamName: json.team?.name ?? previous?.teamName,
    userId: user?.id ?? json.user_id ?? previous?.userId,
  };
}

/** Exchange an authorization code for user-token credentials (no secret). */
export async function exchangeAuthorizationCode(params: {
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<SlackUserCredentials> {
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

/** Slack error codes that mean the refresh token itself is dead. */
const TERMINAL_REFRESH_ERRORS = new Set([
  'invalid_refresh_token',
  'invalid_grant_type',
  'token_revoked',
  'invalid_auth',
]);

/** Thrown when a refresh fails because the refresh token is no longer usable. */
export class SlackRefreshTokenDeadError extends Error {
  constructor(slackError: string) {
    super(`Slack refresh token is no longer valid (${slackError}). Run the connect flow again.`);
    this.name = 'SlackRefreshTokenDeadError';
  }
}

/**
 * Refresh user-token credentials. The response contains a NEW refresh token;
 * the caller must persist the returned credentials immediately.
 *
 * @throws SlackRefreshTokenDeadError when the refresh token is dead and the
 *   user needs to reconnect (vs a transient network/HTTP failure).
 */
export async function refreshUserToken(credentials: SlackUserCredentials): Promise<SlackUserCredentials> {
  const clientId = resolveSlackClientId(credentials.clientId);
  if (!clientId) {
    throw new Error('Cannot refresh Slack token: no client_id available');
  }
  if (!credentials.refreshToken) {
    throw new Error('Cannot refresh Slack token: no refresh token stored');
  }
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: credentials.refreshToken,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Slack token refresh HTTP ${response.status}: ${text}`);
  }
  const json = (await response.json()) as SlackTokenResponse;
  if (!json.ok && json.error && TERMINAL_REFRESH_ERRORS.has(json.error)) {
    throw new SlackRefreshTokenDeadError(json.error);
  }
  return tokenResponseToCredentials(json, clientId, credentials);
}

export type LoopbackServer = {
  redirectUri: string;
  close: () => void;
  cancel: () => void;
  waitForCode: (timeoutMs?: number) => Promise<string | null>;
};

/**
 * Start a loopback HTTP server on one of {@link SLACK_CALLBACK_PORTS} to
 * receive the OAuth redirect. Throws when all ports are busy.
 */
export async function startLoopbackServer(state: string): Promise<LoopbackServer> {
  let lastCode: string | null = null;
  let cancelled = false;

  const server = createServer((req, res) => {
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

  const listen = (port: number): Promise<boolean> =>
    new Promise(resolve => {
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

  let boundPort: number | null = null;
  for (const port of SLACK_CALLBACK_PORTS) {
    if (await listen(port)) {
      boundPort = port;
      break;
    }
  }

  if (boundPort === null) {
    throw new Error(
      `Slack OAuth requires one of localhost ports ${SLACK_CALLBACK_PORTS.join(', ')}, but all are in use. Free one and retry.`,
    );
  }

  return {
    redirectUri: `http://localhost:${boundPort}/callback`,
    close: () => server.close(),
    cancel: () => {
      cancelled = true;
    },
    waitForCode: async (timeoutMs = 180_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (lastCode) return lastCode;
        if (cancelled) return null;
        await new Promise(r => setTimeout(r, 100));
      }
      return null;
    },
  };
}

/** Parse a pasted redirect URL, query string, or raw authorization code. */
export function parseAuthorizationInput(input: string): { code?: string; state?: string } {
  const value = input.trim();
  if (!value) return {};
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
    };
  } catch {
    // not a URL; fall through
  }
  if (value.includes('code=')) {
    const params = new URLSearchParams(value);
    return { code: params.get('code') ?? undefined, state: params.get('state') ?? undefined };
  }
  return { code: value };
}

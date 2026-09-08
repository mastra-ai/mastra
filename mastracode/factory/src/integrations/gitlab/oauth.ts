/**
 * GitLab OAuth 2.0 (authorization code + PKCE).
 *
 * Deliberately separate from `GitLabClient`: the OAuth endpoints live on the
 * instance ORIGIN (`<baseUrl>/oauth/token`), not under the `/api/v4` prefix the
 * client applies to everything else. Routing them through the client would
 * produce `/api/v4/oauth/token`, which 404s.
 *
 * Works identically against gitlab.com and a self-hosted instance — only the
 * origin changes. GitLab 18.x supports PKCE (S256), which we always send even
 * though the app is confidential: it costs one hash and closes the
 * code-interception window on the browser leg.
 *
 * Docs: https://docs.gitlab.com/api/oauth2/
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Full read/write API access. GitLab has no finer-grained issue-write scope. */
export const DEFAULT_GITLAB_SCOPE = 'api';

const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Refresh this many ms before the recorded expiry, to absorb clock skew between
 * this server and the GitLab instance. GitLab access tokens live 7200s, so a
 * 60s margin is cheap insurance.
 */
const TOKEN_REFRESH_SKEW_MS = 60_000;

export interface GitLabTokenSet {
  accessToken: string;
  /** GitLab rotates this on every refresh — always persist the new value. */
  refreshToken: string;
  /** Absolute epoch ms, already skew-adjusted. */
  expiresAt: number;
  scope: string | null;
}

export interface GitLabPkce {
  verifier: string;
  challenge: string;
}

/** RFC 7636: 43–128 chars of base64url. 32 random bytes encodes to 43. */
export function generatePkce(): GitLabPkce {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Constant-time compare for the stored PKCE verifier / nonce checks. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface GitLabOAuthAppConfig {
  /** Instance origin, no trailing slash. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export function buildAuthorizeUrl(
  app: GitLabOAuthAppConfig,
  args: { redirectUri: string; state: string; challenge: string },
): string {
  const url = new URL(`${app.baseUrl}/oauth/authorize`);
  url.searchParams.set('client_id', app.clientId);
  url.searchParams.set('redirect_uri', args.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', args.state);
  url.searchParams.set('scope', app.scope ?? DEFAULT_GITLAB_SCOPE);
  url.searchParams.set('code_challenge', args.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

interface GitLabTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postToken(baseUrl: string, body: Record<string, string>): Promise<GitLabTokenSet> {
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });

  let parsed: GitLabTokenResponse = {};
  try {
    parsed = (await response.json()) as GitLabTokenResponse;
  } catch {
    // Fall through to the status-based error below — a self-hosted instance
    // behind a proxy can answer HTML on failure.
  }

  if (!response.ok || !parsed.access_token || !parsed.refresh_token) {
    const detail = parsed.error_description ?? parsed.error ?? `HTTP ${response.status}`;
    throw new Error(`GitLab OAuth token request failed: ${detail}`);
  }

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    // GitLab reports 7200; default defensively if a version ever omits it.
    expiresAt: Date.now() + (parsed.expires_in ?? 7200) * 1000 - TOKEN_REFRESH_SKEW_MS,
    scope: parsed.scope ?? null,
  };
}

export function exchangeAuthorizationCode(
  app: GitLabOAuthAppConfig,
  args: { code: string; redirectUri: string; verifier: string },
): Promise<GitLabTokenSet> {
  return postToken(app.baseUrl, {
    grant_type: 'authorization_code',
    client_id: app.clientId,
    client_secret: app.clientSecret,
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.verifier,
  });
}

export function refreshAccessToken(
  app: GitLabOAuthAppConfig,
  args: { refreshToken: string; redirectUri: string },
): Promise<GitLabTokenSet> {
  return postToken(app.baseUrl, {
    grant_type: 'refresh_token',
    client_id: app.clientId,
    client_secret: app.clientSecret,
    refresh_token: args.refreshToken,
    redirect_uri: args.redirectUri,
  });
}

/** Best-effort revoke on disconnect; GitLab answers 200 even for unknown tokens. */
export async function revokeToken(app: GitLabOAuthAppConfig, token: string): Promise<void> {
  await fetch(`${app.baseUrl}/oauth/revoke`, {
    method: 'POST',
    signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, token }),
  });
}

export function isExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}

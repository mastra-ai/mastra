/**
 * Anthropic OAuth flow (Claude Pro/Max)
 *
 * Inspired by pi-mono's OAuth implementation:
 * https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/oauth/anthropic.ts
 *
 * The flow is a paste-code PKCE flow: the redirect lands on Anthropic's hosted
 * callback page which displays `code#state` for the user to paste back. That
 * makes it deployable without any inbound connection to the server, so the
 * primitives are split into `startAnthropicLogin()` / `completeAnthropicLogin()`
 * which can span separate HTTP requests (only the PKCE verifier needs to be
 * persisted in between).
 */

import { parseAuthorizationInput } from '../authorization-input.js';
import { generatePKCE } from '../pkce.js';
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from '../types.js';

const decode = (s: string) => atob(s);
const CLIENT_ID = decode('OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl');
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
// pi-mono uses `https://platform.claude.com/v1/oauth/token` with extra scopes
// (user:sessions:claude_code, user:mcp_servers, user:file_upload); we keep the
// console.anthropic.com endpoints that are known to work for our scope set.
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference';

export interface AnthropicLoginStart {
  /** Authorization URL for the user to open. */
  url: string;
  /** PKCE code verifier — persist it to complete the login later. */
  verifier: string;
}

/**
 * Start an Anthropic login: generate PKCE state and build the authorization URL.
 */
export async function startAnthropicLogin(): Promise<AnthropicLoginStart> {
  const { verifier, challenge } = await generatePKCE();

  const authParams = new URLSearchParams({
    code: 'true',
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: verifier,
  });

  return { url: `${AUTHORIZE_URL}?${authParams.toString()}`, verifier };
}

/**
 * Complete an Anthropic login: parse the pasted authorization input
 * (full URL, `code#state`, or query string), validate its state, and exchange
 * it for tokens using the verifier from `startAnthropicLogin()`.
 */
export async function completeAnthropicLogin(input: string, verifier: string): Promise<OAuthCredentials> {
  const { code, state } = parseAuthorizationInput(input);
  if (!code) {
    throw new Error('Missing authorization code');
  }
  if (!state || state !== verifier) {
    throw new Error('Invalid authorization state');
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    // Bound the OAuth exchange so an unresponsive upstream cannot pin the
    // caller (and, in the shipyard server, the containing project lock)
    // indefinitely. See 2025-07-23 shipyard latency incident.
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      state,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Calculate expiry time (current time + expires_in seconds - 5 min buffer)
  const expiresAt = Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000;

  return {
    refresh: tokenData.refresh_token,
    access: tokenData.access_token,
    expires: expiresAt,
  };
}

/**
 * Login with Anthropic OAuth (paste-code flow), blocking on the prompt callback.
 */
export async function loginAnthropic(
  onAuthUrl: (url: string) => void,
  onPromptCode: () => Promise<string>,
): Promise<OAuthCredentials> {
  const { url, verifier } = await startAnthropicLogin();

  // Notify caller with URL to open
  onAuthUrl(url);

  // Wait for user to paste authorization code (format: code#state)
  const authCode = await onPromptCode();

  return completeAnthropicLogin(authCode, verifier);
}

/**
 * Refresh Anthropic OAuth token
 */
export async function refreshAnthropicToken(refreshToken: string): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic token refresh failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    refresh: data.refresh_token,
    access: data.access_token,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000,
  };
}

export const anthropicOAuthProvider: OAuthProviderInterface = {
  id: 'anthropic',
  name: 'Anthropic (Claude Pro/Max)',

  async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
    return loginAnthropic(
      url => callbacks.onAuth({ url }),
      () => callbacks.onPrompt({ message: 'Paste the authorization code:' }),
    );
  },

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    return refreshAnthropicToken(credentials.refresh);
  },

  getApiKey(credentials: OAuthCredentials): string {
    return credentials.access;
  },
};

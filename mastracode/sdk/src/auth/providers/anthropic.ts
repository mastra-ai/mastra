/**
 * Anthropic OAuth flow (Claude Pro/Max)
 *
 * Inspired by pi-mono's OAuth implementation:
 * https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/oauth/anthropic.ts
 */

import { generatePKCE } from '../pkce.js';
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from '../types.js';

const decode = (s: string) => atob(s);
const CLIENT_ID = decode('OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl');
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference';

interface AnthropicTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AnthropicOAuthSession {
  authUrl: string;
  verifier: string;
}

export interface AnthropicOAuthExchangeInput {
  authCode: string;
  verifier: string;
}

function isAnthropicTokenResponse(value: unknown): value is AnthropicTokenResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.access_token === 'string' &&
    typeof record.refresh_token === 'string' &&
    typeof record.expires_in === 'number'
  );
}

export async function createAnthropicOAuthSession(): Promise<AnthropicOAuthSession> {
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

  const authUrl = `${AUTHORIZE_URL}?${authParams.toString()}`;
  return { authUrl, verifier };
}

export async function exchangeAnthropicOAuthCode({
  authCode,
  verifier,
}: AnthropicOAuthExchangeInput): Promise<OAuthCredentials> {
  const splits = authCode.split('#');
  const code = splits[0];
  const state = splits[1];
  if (!code || !state) {
    throw new Error('Authorization code must include the code and state separated by #');
  }
  if (state !== verifier) {
    throw new Error('Authorization state did not match the active login session');
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: code,
      state: state,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData: unknown = await tokenResponse.json();
  if (!isAnthropicTokenResponse(tokenData)) {
    throw new Error('Token exchange failed: invalid token response');
  }

  const expiresAt = Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000;

  return {
    refresh: tokenData.refresh_token,
    access: tokenData.access_token,
    expires: expiresAt,
  };
}

/**
 * Login with Anthropic OAuth (manual code flow).
 */
export async function loginAnthropic(
  onAuthUrl: (url: string) => void,
  onPromptCode: () => Promise<string>,
): Promise<OAuthCredentials> {
  const session = await createAnthropicOAuthSession();
  onAuthUrl(session.authUrl);
  return exchangeAnthropicOAuthCode({ authCode: await onPromptCode(), verifier: session.verifier });
}

/**
 * Refresh Anthropic OAuth token
 */
export async function refreshAnthropicToken(refreshToken: string): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
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

  const data: unknown = await response.json();
  if (!isAnthropicTokenResponse(data)) {
    throw new Error('Anthropic token refresh failed: invalid token response');
  }

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

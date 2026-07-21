/**
 * xAI OAuth flow (Grok)
 *
 * Ported from pi-mono's xAI OAuth implementation:
 * https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/oauth/xai.ts
 *
 * xAI uses a standard RFC 8628 device authorization grant, so the flow needs
 * no inbound connection to the server. The primitives are split into
 * `startXAIDeviceLogin()` / `pollXAIDeviceLogin()` so web routes can persist
 * the JSON-serializable pending state between HTTP requests; the blocking
 * `loginXAI()` wraps them for TUI use.
 */

import { createDeviceCodePollState, pollDeviceCodeUntilComplete, stepDeviceCodePoll } from '../device-code.js';
import type { DeviceCodePollOutcome, DeviceCodePollState } from '../device-code.js';
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from '../types.js';

const CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
const DEVICE_CODE_URL = 'https://auth.x.ai/oauth2/device/code';
const TOKEN_URL = 'https://auth.x.ai/oauth2/token';
const SCOPE = 'openid profile email offline_access grok-cli:access api:access';
const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
const DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 3600;
// Refresh 5 minutes before actual expiry (same skew as Anthropic).
const REFRESH_SKEW_MS = 5 * 60 * 1000;

async function postForm(url: string, params: Record<string, string>, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    signal,
  });
}

/** The verification URI is opened by the user; only accept https URLs. */
function validateVerificationUri(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`xAI device authorization returned an invalid verification_uri: ${raw}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`xAI device authorization returned a non-https verification_uri: ${raw}`);
  }
  return parsed.toString();
}

function credentialsFromTokenResponse(data: unknown, previousRefreshToken?: string): OAuthCredentials {
  const record = (data ?? {}) as Record<string, unknown>;
  const access = record.access_token;
  if (typeof access !== 'string' || access.length === 0) {
    throw new Error('xAI token response missing access_token');
  }

  // xAI may not rotate the refresh token on refresh; keep the previous one.
  const refresh =
    typeof record.refresh_token === 'string' && record.refresh_token.length > 0
      ? record.refresh_token
      : previousRefreshToken;
  if (!refresh) {
    throw new Error('xAI token response missing refresh_token');
  }

  const expiresIn =
    typeof record.expires_in === 'number' && record.expires_in > 0
      ? record.expires_in
      : DEFAULT_TOKEN_EXPIRES_IN_SECONDS;

  return {
    access,
    refresh,
    expires: Date.now() + expiresIn * 1000 - REFRESH_SKEW_MS,
  };
}

/**
 * Serializable pending state for an xAI device-code login. Safe to persist
 * (e.g. a `pending jsonb` column) so polling can span HTTP requests.
 */
export interface XAIDeviceLoginPending {
  deviceCode: string;
  userCode: string;
  /** Verification URL for the user to open (https-only, validated). */
  url: string;
  instructions: string;
  /** RFC 8628 poll-loop state (interval growth, deadline, slow_down count). */
  state: DeviceCodePollState;
}

export type XAIDevicePollResult =
  | { status: 'complete'; credentials: OAuthCredentials }
  | { status: 'pending'; nextPollMs: number; pending: XAIDeviceLoginPending }
  | { status: 'failed'; error: string };

/**
 * Start an xAI device-code login: request a user code and return the
 * serializable pending state for subsequent polls.
 */
export async function startXAIDeviceLogin(options?: { signal?: AbortSignal }): Promise<XAIDeviceLoginPending> {
  const response = await postForm(DEVICE_CODE_URL, { client_id: CLIENT_ID, scope: SCOPE }, options?.signal);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to initiate xAI device authorization: ${response.status}${text ? ` ${text}` : ''}`);
  }

  const data = (await response.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    interval?: number;
    expires_in?: number;
  };

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error('xAI device authorization response missing required fields');
  }

  const url = validateVerificationUri(data.verification_uri_complete ?? data.verification_uri);

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    url,
    instructions: `Enter code: ${data.user_code}`,
    state: createDeviceCodePollState({
      intervalSeconds: data.interval,
      expiresInSeconds: typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 600,
    }),
  };
}

async function pollXAITokenOnce(
  pending: XAIDeviceLoginPending,
  signal?: AbortSignal,
): Promise<DeviceCodePollOutcome<OAuthCredentials>> {
  const response = await postForm(
    TOKEN_URL,
    {
      grant_type: DEVICE_CODE_GRANT_TYPE,
      device_code: pending.deviceCode,
      client_id: CLIENT_ID,
    },
    signal,
  );

  if (response.ok) {
    const data = (await response.json()) as unknown;
    try {
      return { status: 'complete', result: credentialsFromTokenResponse(data) };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
  }

  const text = await response.text().catch(() => '');
  let body: { error?: string; interval?: number } = {};
  try {
    body = JSON.parse(text) as { error?: string; interval?: number };
  } catch {
    // Non-JSON error body — fail loudly below with the raw text.
  }

  switch (body.error) {
    case 'authorization_pending':
      return { status: 'pending', intervalSeconds: body.interval };
    case 'slow_down':
      return { status: 'slow_down', intervalSeconds: body.interval };
    case 'access_denied':
    case 'authorization_denied':
      return { status: 'failed', error: 'xAI authorization was denied' };
    case 'expired_token':
      return { status: 'failed', error: 'xAI device code expired before authorization completed' };
    default:
      return {
        status: 'failed',
        error: `xAI device authorization failed: ${response.status}${text ? ` ${text}` : ''}`,
      };
  }
}

/**
 * Perform exactly one upstream poll for a pending xAI device login.
 * Returns the updated pending state so callers (e.g. web routes) can persist
 * slow_down interval growth between polls. Never throws for flow-level
 * conditions.
 */
export async function pollXAIDeviceLogin(
  pending: XAIDeviceLoginPending,
  options?: { signal?: AbortSignal },
): Promise<XAIDevicePollResult> {
  const step = await stepDeviceCodePoll(pending.state, () => pollXAITokenOnce(pending, options?.signal));

  switch (step.status) {
    case 'complete':
      return { status: 'complete', credentials: step.result };
    case 'failed':
      return { status: 'failed', error: step.error };
    case 'pending':
    case 'slow_down':
      return {
        status: 'pending',
        nextPollMs: step.nextPollMs,
        pending: { ...pending, state: step.state },
      };
  }
}

/**
 * Login with xAI OAuth (device-code flow), blocking until authorized.
 */
export async function loginXAI(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  const pending = await startXAIDeviceLogin({ signal: callbacks.signal });

  callbacks.onAuth({ url: pending.url, instructions: pending.instructions });
  callbacks.onProgress?.('Waiting for xAI device authorization...');

  return pollDeviceCodeUntilComplete({
    state: pending.state,
    pollOnce: () => pollXAITokenOnce(pending, callbacks.signal),
    signal: callbacks.signal,
  });
}

/**
 * Refresh xAI OAuth token
 */
export async function refreshXAIToken(refreshToken: string, signal?: AbortSignal): Promise<OAuthCredentials> {
  const response = await postForm(
    TOKEN_URL,
    {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    },
    signal,
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`xAI token refresh failed: ${response.status}${text ? ` ${text}` : ''}`);
  }

  return credentialsFromTokenResponse((await response.json()) as unknown, refreshToken);
}

export const xaiOAuthProvider: OAuthProviderInterface = {
  id: 'xai',
  name: 'xAI (Grok)',

  async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
    return loginXAI(callbacks);
  },

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    return refreshXAIToken(credentials.refresh);
  },

  getApiKey(credentials: OAuthCredentials): string {
    return credentials.access;
  },
};

/**
 * Cursor subscription OAuth.
 *
 * Browser PKCE login against cursor.com/loginDeepControl, then poll
 * api2.cursor.sh/auth/poll. Same flow Pi uses in pi-cursor-oauth.
 */
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from '../types.js';

const LOGIN_URL = 'https://cursor.com/loginDeepControl';
const POLL_URL = 'https://api2.cursor.sh/auth/poll';
const REFRESH_URL = 'https://api2.cursor.sh/auth/exchange_user_api_key';
const POLL_MAX_ATTEMPTS = 150;
const POLL_BASE_DELAY_MS = 1000;
const POLL_MAX_DELAY_MS = 10_000;
const POLL_BACKOFF = 1.2;
const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_SKEW_MS = 5 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 30_000;

/** Encode bytes for PKCE without base64 padding. */
function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Generate the PKCE values and browser URL for a Cursor login. */
export async function generateCursorAuthParams(): Promise<{
  verifier: string;
  uuid: string;
  loginUrl: string;
}> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = toBase64Url(array);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = toBase64Url(new Uint8Array(hash));
  const uuid = crypto.randomUUID();
  const params = new URLSearchParams({
    challenge,
    uuid,
    mode: 'login',
    redirectTarget: 'cli',
  });
  return { verifier, uuid, loginUrl: `${LOGIN_URL}?${params.toString()}` };
}

/** Read a Cursor JWT expiry with a refresh buffer, or return a safe fallback. */
export function cursorTokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return Date.now() + DEFAULT_TOKEN_TTL_MS - REFRESH_SKEW_MS;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    if (typeof decoded.exp === 'number') return decoded.exp * 1000 - REFRESH_SKEW_MS;
  } catch {
    // Fall through to the default TTL.
  }
  return Date.now() + DEFAULT_TOKEN_TTL_MS - REFRESH_SKEW_MS;
}

/** Wait for the next poll and stop at once when the caller cancels. */
async function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error('Cursor authentication cancelled');
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Cursor authentication cancelled'));
    };
    const onComplete = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    timer = setTimeout(onComplete, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Poll Cursor until the user completes browser authentication. */
export async function pollCursorAuth(
  uuid: string,
  verifier: string,
  signal?: AbortSignal,
  pollDelayMs = POLL_BASE_DELAY_MS,
): Promise<{ accessToken: string; refreshToken: string }> {
  let delay = pollDelayMs;
  let consecutiveErrors = 0;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new Error('Cursor authentication cancelled');
    await abortableSleep(delay, signal);
    try {
      const url = `${POLL_URL}?uuid=${encodeURIComponent(uuid)}&verifier=${encodeURIComponent(verifier)}`;
      const response = await fetch(url, { signal });
      if (response.status === 404) {
        consecutiveErrors = 0;
        delay = Math.min(Math.round(delay * POLL_BACKOFF), POLL_MAX_DELAY_MS);
        continue;
      }
      if (!response.ok) throw new Error(`Poll failed: ${response.status}`);
      const data = (await response.json()) as { accessToken?: unknown; refreshToken?: unknown };
      if (typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
        throw new Error('Cursor poll response missing tokens');
      }
      return { accessToken: data.accessToken, refreshToken: data.refreshToken };
    } catch (error) {
      if (signal?.aborted) throw new Error('Cursor authentication cancelled');
      consecutiveErrors += 1;
      if (consecutiveErrors >= 3) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Too many consecutive errors during Cursor auth polling: ${message}`);
      }
    }
  }
  throw new Error('Cursor authentication polling timeout');
}

/** Start Cursor browser authentication and return its OAuth credentials. */
export async function loginCursor(
  callbacks: OAuthLoginCallbacks,
  options?: { pollDelayMs?: number },
): Promise<OAuthCredentials> {
  const { verifier, uuid, loginUrl } = await generateCursorAuthParams();
  callbacks.onAuth({
    url: loginUrl,
    instructions: 'Approve the Cursor login in your browser. This flow polls automatically.',
  });
  callbacks.onProgress?.('Waiting for Cursor authentication...');
  const { accessToken, refreshToken } = await pollCursorAuth(
    uuid,
    verifier,
    callbacks.signal,
    options?.pollDelayMs ?? POLL_BASE_DELAY_MS,
  );
  return {
    refresh: refreshToken,
    access: accessToken,
    expires: cursorTokenExpiry(accessToken),
  };
}

/** Exchange a Cursor refresh token for current OAuth credentials. */
export async function refreshCursorToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  const bearer =
    typeof credentials.refresh === 'string' && credentials.refresh.length > 0
      ? credentials.refresh
      : credentials.access;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  try {
    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Cursor token refresh failed: ${response.status}${text ? ` ${text}` : ''}`);
    }
    const data = (await response.json()) as { accessToken?: unknown; refreshToken?: unknown };
    if (typeof data.accessToken !== 'string' || !data.accessToken) {
      throw new Error('Cursor token refresh response missing accessToken');
    }
    return {
      refresh: typeof data.refreshToken === 'string' && data.refreshToken.length > 0 ? data.refreshToken : bearer,
      access: data.accessToken,
      expires: cursorTokenExpiry(data.accessToken),
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Cursor token refresh timed out after ${REFRESH_TIMEOUT_MS}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const cursorOAuthProvider: OAuthProviderInterface = {
  id: 'cursor',
  name: 'Cursor',
  login: loginCursor,
  refreshToken: refreshCursorToken,
  getApiKey: credentials => credentials.access,
};

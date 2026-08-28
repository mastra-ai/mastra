import { randomUUID } from 'node:crypto';
import { arch, hostname, platform, release } from 'node:os';
import { getCurrentVersion } from '../../utils/update-check.js';
import {
  abortableSleep,
  createDeviceCodePollState,
  pollDeviceCodeUntilComplete,
  stepDeviceCodePoll,
} from '../device-code.js';
import type { DeviceCodePollOutcome, DeviceCodePollState } from '../device-code.js';
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from '../types.js';

const CLIENT_ID = '17e5f671-d194-4dfb-9706-5516cb48c098';
const OAUTH_HOST = 'https://auth.kimi.com';
const DEVICE_ID_PATTERN = /^[0-9a-f]{32}$/;
const DEFAULT_EXPIRES_IN_SECONDS = 15 * 60;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const REQUEST_TIMEOUT_MS = 30_000;
const REFRESH_MAX_RETRIES = 3;

function asciiHeaderValue(value: string): string {
  const sanitized = value.replace(/[^\x20-\x7E]/g, '').trim();
  return sanitized || 'unknown';
}

const KIMI_DEVICE_DETAILS = {
  'X-Msh-Platform': 'mastracode',
  'X-Msh-Version': asciiHeaderValue(getCurrentVersion()),
  'X-Msh-Device-Name': asciiHeaderValue(hostname()),
  'X-Msh-Device-Model': asciiHeaderValue(`${platform()} ${arch()}`),
  'X-Msh-Os-Version': asciiHeaderValue(release()),
};

export function createKimiCodingDeviceId(): string {
  return randomUUID().replaceAll('-', '');
}

export function isKimiCodingDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

export function getKimiCodingDeviceHeaders(deviceId: string): Record<string, string> {
  if (!isKimiCodingDeviceId(deviceId)) {
    throw new Error('Kimi For Coding credentials have an invalid device ID. Please reconnect the account.');
  }
  return { ...KIMI_DEVICE_DETAILS, 'X-Msh-Device-Id': deviceId };
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([timeout, signal]) : timeout;
}

function trustedHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value = (await response.json()) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function credentialsFromTokenResponse(value: unknown, operation: string, deviceId: string): OAuthCredentials {
  const data = (value ?? {}) as Record<string, unknown>;
  const access = data.access_token;
  const refresh = data.refresh_token;
  const expiresIn = data.expires_in;
  if (
    typeof access !== 'string' ||
    !access ||
    typeof refresh !== 'string' ||
    !refresh ||
    typeof expiresIn !== 'number' ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error(`Kimi For Coding token ${operation} response missing fields`);
  }
  return { access, refresh, expires: Date.now() + expiresIn * 1000, deviceId };
}

export interface KimiCodingDeviceLoginPending {
  clientId: string;
  deviceId: string;
  deviceCode: string;
  userCode: string;
  url: string;
  instructions: string;
  state: DeviceCodePollState;
}

export type KimiCodingDevicePollResult =
  | { status: 'complete'; credentials: OAuthCredentials }
  | { status: 'pending'; nextPollMs: number; pending: KimiCodingDeviceLoginPending }
  | { status: 'failed'; error: string };

export async function startKimiCodingDeviceLogin(options?: {
  signal?: AbortSignal;
}): Promise<KimiCodingDeviceLoginPending> {
  const clientId = CLIENT_ID;
  const deviceId = createKimiCodingDeviceId();
  const response = await fetch(`${OAUTH_HOST}/api/oauth/device_authorization`, {
    method: 'POST',
    headers: {
      ...getKimiCodingDeviceHeaders(deviceId),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ client_id: clientId }).toString(),
    signal: requestSignal(options?.signal),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Kimi For Coding device authorization failed: ${response.status}${text ? ` ${text}` : ''}`);
  }

  const data = await readJson(response);
  const deviceCode = data?.device_code;
  const userCode = data?.user_code;
  const verificationUri = trustedHttpUrl(data?.verification_uri);
  const verificationUriComplete = trustedHttpUrl(data?.verification_uri_complete);
  if (
    typeof deviceCode !== 'string' ||
    !deviceCode ||
    typeof userCode !== 'string' ||
    !userCode ||
    !verificationUri ||
    !verificationUriComplete
  ) {
    throw new Error('Invalid Kimi For Coding device authorization response');
  }

  const interval = data?.interval;
  const expiresIn = data?.expires_in;
  return {
    clientId,
    deviceId,
    deviceCode,
    userCode,
    url: verificationUriComplete,
    instructions: `Enter code: ${userCode}`,
    state: createDeviceCodePollState({
      intervalSeconds:
        typeof interval === 'number' && Number.isFinite(interval) && interval > 0
          ? interval
          : DEFAULT_POLL_INTERVAL_SECONDS,
      expiresInSeconds:
        typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
          ? expiresIn
          : DEFAULT_EXPIRES_IN_SECONDS,
    }),
  };
}

async function pollKimiCodingTokenOnce(
  pending: KimiCodingDeviceLoginPending,
  signal?: AbortSignal,
): Promise<DeviceCodePollOutcome<OAuthCredentials>> {
  const response = await fetch(`${OAUTH_HOST}/api/oauth/token`, {
    method: 'POST',
    headers: {
      ...getKimiCodingDeviceHeaders(pending.deviceId),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: pending.clientId,
      device_code: pending.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }).toString(),
    signal: requestSignal(signal),
  });
  const data = await readJson(response);
  if (response.ok && typeof data?.access_token === 'string') {
    try {
      return { status: 'complete', result: credentialsFromTokenResponse(data, 'poll', pending.deviceId) };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
  }

  const error = data?.error;
  if (error === 'authorization_pending') return { status: 'pending' };
  if (error === 'slow_down') {
    return {
      status: 'slow_down',
      intervalSeconds: typeof data?.interval === 'number' && data.interval > 0 ? data.interval : undefined,
    };
  }
  if (error === 'expired_token') {
    return { status: 'failed', error: 'Kimi For Coding authorization expired. Please restart login.' };
  }
  if (error === 'access_denied') return { status: 'failed', error: 'Kimi For Coding login was denied.' };
  const description = typeof data?.error_description === 'string' ? `: ${data.error_description}` : '';
  return {
    status: 'failed',
    error: `Kimi For Coding token request failed: ${response.status}${typeof error === 'string' ? ` ${error}${description}` : ''}`,
  };
}

export async function pollKimiCodingDeviceLogin(
  pending: KimiCodingDeviceLoginPending,
  options?: { signal?: AbortSignal },
): Promise<KimiCodingDevicePollResult> {
  const step = await stepDeviceCodePoll(pending.state, () => pollKimiCodingTokenOnce(pending, options?.signal));
  if (step.status === 'complete') return { status: 'complete', credentials: step.result };
  if (step.status === 'failed') return { status: 'failed', error: step.error };
  return {
    status: 'pending',
    nextPollMs: step.nextPollMs,
    pending: { ...pending, state: step.state },
  };
}

export async function loginKimiCoding(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  const pending = await startKimiCodingDeviceLogin({ signal: callbacks.signal });
  callbacks.onAuth({ url: pending.url, instructions: pending.instructions });
  callbacks.onProgress?.('Waiting for Kimi For Coding device authorization...');
  return pollDeviceCodeUntilComplete({
    state: pending.state,
    pollOnce: () => pollKimiCodingTokenOnce(pending, callbacks.signal),
    signal: callbacks.signal,
  });
}

export async function refreshKimiCodingToken(
  refreshToken: string,
  options: { signal?: AbortSignal; deviceId: string },
): Promise<OAuthCredentials> {
  const clientId = CLIENT_ID;
  const deviceHeaders = getKimiCodingDeviceHeaders(options.deviceId);
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= REFRESH_MAX_RETRIES; attempt++) {
    if (attempt > 0) await abortableSleep(1000 * 2 ** (attempt - 1), options.signal);
    let response: Response;
    try {
      response = await fetch(`${OAUTH_HOST}/api/oauth/token`, {
        method: 'POST',
        headers: {
          ...deviceHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
        signal: requestSignal(options.signal),
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === REFRESH_MAX_RETRIES) throw lastError;
      continue;
    }
    const data = await readJson(response);
    if (response.ok) return credentialsFromTokenResponse(data, 'refresh', options.deviceId);

    const error = typeof data?.error === 'string' ? ` ${data.error}` : '';
    lastError = new Error(`Kimi For Coding token refresh failed: ${response.status}${error}`);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === REFRESH_MAX_RETRIES) throw lastError;
  }
  throw lastError ?? new Error('Kimi For Coding token refresh failed');
}

export const kimiCodingOAuthProvider: OAuthProviderInterface = {
  id: 'kimi-for-coding',
  name: 'Kimi For Coding',
  login: loginKimiCoding,
  refreshToken: credentials =>
    refreshKimiCodingToken(credentials.refresh, {
      deviceId: typeof credentials.deviceId === 'string' ? credentials.deviceId : '',
    }),
  getApiKey: credentials => credentials.access,
};

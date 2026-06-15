/**
 * GitHub Copilot OAuth flow
 *
 * Inspired by:
 *   - pi-mono: https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/oauth/github-copilot.ts
 *   - opencode: https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/plugin/github-copilot/copilot.ts
 *
 * Storage layout in AuthStorage:
 *   - `refresh` holds the long-lived GitHub OAuth access token (used to mint Copilot tokens).
 *   - `access`  holds the short-lived Copilot bearer token (~30 minutes).
 *   - `expires` is the Copilot bearer expiry (ms epoch, with a 5-minute safety buffer).
 *   - `enterpriseUrl` is the GitHub Enterprise hostname, or undefined for github.com.
 */

import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from '../types.js';

export type GitHubCopilotCredentials = OAuthCredentials & {
  enterpriseUrl?: string;
};

const decode = (s: string): string => atob(s);
// Copilot's public client ID, encoded to mirror the upstream references.
const CLIENT_ID = decode('SXYxLmI1MDdhMDhjODdlY2ZlOTg=');

export const COPILOT_USER_AGENT = 'GitHubCopilotChat/0.35.0';

/** Headers that Copilot endpoints expect from a VS Code-like client. */
export const COPILOT_HEADERS = {
  'User-Agent': COPILOT_USER_AGENT,
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
} as const;

const INITIAL_POLL_INTERVAL_MULTIPLIER = 1.2;
const SLOW_DOWN_POLL_INTERVAL_MULTIPLIER = 1.4;

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
};

type DeviceTokenSuccessResponse = {
  access_token: string;
  token_type?: string;
  scope?: string;
};

type DeviceTokenErrorResponse = {
  error: string;
  error_description?: string;
  interval?: number;
};

/**
 * Normalize a user-entered Enterprise URL/domain into a hostname (e.g. `company.ghe.com`).
 * Returns null for an empty input or an unparseable URL.
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname || null;
  } catch {
    return null;
  }
}

function getUrls(domain: string): {
  deviceCodeUrl: string;
  accessTokenUrl: string;
  copilotTokenUrl: string;
} {
  return {
    deviceCodeUrl: `https://${domain}/login/device/code`,
    accessTokenUrl: `https://${domain}/login/oauth/access_token`,
    copilotTokenUrl: `https://api.${domain}/copilot_internal/v2/token`,
  };
}

/**
 * Parse the `proxy-ep` segment from a Copilot bearer token and convert to its API base URL.
 * Token shape: `tid=...;exp=...;proxy-ep=proxy.individual.githubcopilot.com;...`
 */
function getBaseUrlFromToken(token: string): string | null {
  const match = token.match(/proxy-ep=([^;]+)/);
  if (!match) return null;
  const proxyHost = match[1]!;
  const apiHost = proxyHost.replace(/^proxy\./, 'api.');
  return `https://${apiHost}`;
}

/**
 * Resolve the Copilot API base URL.
 * Prefers the `proxy-ep` parsed from the bearer token, then falls back to enterprise/individual defaults.
 */
export function getGitHubCopilotBaseUrl(token?: string, enterpriseDomain?: string): string {
  if (token) {
    const fromToken = getBaseUrlFromToken(token);
    if (fromToken) return fromToken;
  }
  if (enterpriseDomain) return `https://copilot-api.${enterpriseDomain}`;
  return 'https://api.individual.githubcopilot.com';
}

async function fetchJson(url: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, signal ? { ...init, signal } : init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

async function startDeviceFlow(domain: string, signal?: AbortSignal): Promise<DeviceCodeResponse> {
  const urls = getUrls(domain);
  const data = await fetchJson(
    urls.deviceCodeUrl,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': COPILOT_USER_AGENT,
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: 'read:user',
      }),
    },
    signal,
  );

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid device code response');
  }

  const obj = data as Record<string, unknown>;
  const deviceCode = obj.device_code;
  const userCode = obj.user_code;
  const verificationUri = obj.verification_uri;
  const interval = obj.interval;
  const expiresIn = obj.expires_in;

  if (
    typeof deviceCode !== 'string' ||
    typeof userCode !== 'string' ||
    typeof verificationUri !== 'string' ||
    typeof interval !== 'number' ||
    typeof expiresIn !== 'number'
  ) {
    throw new Error('Invalid device code response fields');
  }

  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    interval,
    expires_in: expiresIn,
  };
}

/** Sleep that can be interrupted by an AbortSignal. */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Login cancelled'));
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error('Login cancelled'));
    };

    timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pollForGitHubAccessToken(
  domain: string,
  deviceCode: string,
  intervalSeconds: number,
  expiresIn: number,
  signal?: AbortSignal,
): Promise<string> {
  const urls = getUrls(domain);
  const deadline = Date.now() + expiresIn * 1000;
  let intervalMs = Math.max(1000, Math.floor(intervalSeconds * 1000));
  let intervalMultiplier = INITIAL_POLL_INTERVAL_MULTIPLIER;
  let slowDownResponses = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error('Login cancelled');
    }

    const remainingMs = deadline - Date.now();
    const waitMs = Math.min(Math.ceil(intervalMs * intervalMultiplier), remainingMs);
    await abortableSleep(waitMs, signal);

    const raw = await fetchJson(
      urls.accessTokenUrl,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': COPILOT_USER_AGENT,
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      },
      signal,
    );

    if (raw && typeof raw === 'object' && typeof (raw as DeviceTokenSuccessResponse).access_token === 'string') {
      return (raw as DeviceTokenSuccessResponse).access_token;
    }

    if (raw && typeof raw === 'object' && typeof (raw as DeviceTokenErrorResponse).error === 'string') {
      const { error, error_description: description, interval } = raw as DeviceTokenErrorResponse;
      if (error === 'authorization_pending') {
        continue;
      }

      if (error === 'slow_down') {
        slowDownResponses += 1;
        intervalMs = typeof interval === 'number' && interval > 0 ? interval * 1000 : Math.max(1000, intervalMs + 5000);
        intervalMultiplier = SLOW_DOWN_POLL_INTERVAL_MULTIPLIER;
        continue;
      }

      const descriptionSuffix = description ? `: ${description}` : '';
      throw new Error(`Device flow failed: ${error}${descriptionSuffix}`);
    }
  }

  if (slowDownResponses > 0) {
    throw new Error(
      'Device flow timed out after one or more slow_down responses. This is often caused by clock drift in WSL or VM environments. Please sync or restart the VM clock and try again.',
    );
  }

  throw new Error('Device flow timed out');
}

/**
 * Refresh the short-lived Copilot bearer token using the long-lived GitHub OAuth token.
 *
 * `refreshToken` here is the GitHub OAuth access token; the Copilot endpoint returns a
 * fresh bearer token (`token`) and absolute expiry (`expires_at`, seconds since epoch).
 */
export async function refreshGitHubCopilotToken(
  refreshToken: string,
  enterpriseDomain?: string,
  signal?: AbortSignal,
): Promise<GitHubCopilotCredentials> {
  const domain = enterpriseDomain || 'github.com';
  const urls = getUrls(domain);

  const raw = await fetchJson(
    urls.copilotTokenUrl,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${refreshToken}`,
        ...COPILOT_HEADERS,
      },
    },
    signal,
  );

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid Copilot token response');
  }

  const obj = raw as Record<string, unknown>;
  const token = obj.token;
  const expiresAt = obj.expires_at;

  if (typeof token !== 'string' || typeof expiresAt !== 'number') {
    throw new Error('Invalid Copilot token response fields');
  }

  const credentials: GitHubCopilotCredentials = {
    refresh: refreshToken,
    access: token,
    // expires_at is seconds; subtract 5 minutes so we refresh before actual expiry.
    expires: expiresAt * 1000 - 5 * 60 * 1000,
  };
  if (enterpriseDomain) {
    credentials.enterpriseUrl = enterpriseDomain;
  }
  return credentials;
}

/**
 * Login with GitHub Copilot OAuth (device-code flow).
 *
 * Prompts for an optional GitHub Enterprise URL/domain, performs the device-code flow,
 * then exchanges the GitHub OAuth token for a Copilot bearer token.
 */
export async function loginGitHubCopilot(options: {
  onAuth: (url: string, instructions?: string) => void;
  onPrompt: (prompt: { message: string; placeholder?: string; allowEmpty?: boolean }) => Promise<string>;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<GitHubCopilotCredentials> {
  const input = await options.onPrompt({
    message: 'GitHub Enterprise URL/domain (blank for github.com)',
    placeholder: 'company.ghe.com',
    allowEmpty: true,
  });

  if (options.signal?.aborted) {
    throw new Error('Login cancelled');
  }

  const trimmed = input.trim();
  const enterpriseDomain = normalizeDomain(input);
  if (trimmed && !enterpriseDomain) {
    throw new Error('Invalid GitHub Enterprise URL/domain');
  }
  const domain = enterpriseDomain || 'github.com';

  const device = await startDeviceFlow(domain, options.signal);
  options.onAuth(device.verification_uri, `Enter code: ${device.user_code}`);

  const githubAccessToken = await pollForGitHubAccessToken(
    domain,
    device.device_code,
    device.interval,
    device.expires_in,
    options.signal,
  );

  options.onProgress?.('Fetching Copilot token...');
  return refreshGitHubCopilotToken(githubAccessToken, enterpriseDomain ?? undefined, options.signal);
}

/**
 * Filtered, normalized entry from the Copilot `/models` API.
 *
 * The full API payload includes a lot of capability metadata; we only keep the bits
 * we need to expose models in `listAvailableModels()` and route requests sensibly.
 */
export type CopilotModelEntry = {
  /** Stable model id (e.g. `claude-sonnet-4.5`, `gpt-4.1`). */
  id: string;
  /** Human-readable display name (e.g. `Claude Sonnet 4.5`). */
  name: string;
  /** Vendor field from the API (e.g. `Anthropic`, `OpenAI`). */
  vendor: string;
  /**
   * Endpoints the model exposes (e.g. `/chat/completions`, `/responses`, `/v1/messages`).
   * Empty when the API didn't return `supported_endpoints` for this entry.
   */
  supportedEndpoints: string[];
  /** True when `supported_endpoints` includes `/v1/messages` (Anthropic-shaped Copilot model). */
  isAnthropicShaped: boolean;
  /** True when `capabilities.supports.vision` is true. */
  supportsVision: boolean;
  /** True when the model supports tool calling. */
  supportsToolCalls: boolean;
};

/**
 * Fetch the Copilot model list available to the current subscription.
 *
 * Hits `${baseURL}/models` with the Copilot bearer token, filters to
 * `model_picker_enabled === true && policy.state !== 'disabled'`, and returns
 * a normalized list. Mirrors opencode's filtering rules.
 *
 * Inspired by:
 *   - opencode: https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/plugin/github-copilot/models.ts
 */
export async function fetchCopilotModels(opts: {
  baseUrl: string;
  bearerToken: string;
  signal?: AbortSignal;
}): Promise<CopilotModelEntry[]> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/models`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${opts.bearerToken}`,
      ...COPILOT_HEADERS,
    },
    signal: opts.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch Copilot models: ${response.status} ${response.statusText}: ${text}`);
  }

  const json = await response.json().catch(() => null);
  if (!json || typeof json !== 'object' || !Array.isArray((json as { data?: unknown }).data)) {
    throw new Error('Invalid Copilot models response: missing `data` array');
  }

  const data = (json as { data: unknown[] }).data;
  const result: CopilotModelEntry[] = [];

  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    if (obj.model_picker_enabled !== true) continue;

    const policy = obj.policy as Record<string, unknown> | undefined;
    if (policy && policy.state === 'disabled') continue;

    const id = obj.id;
    if (typeof id !== 'string' || !id) continue;

    const name = typeof obj.name === 'string' ? obj.name : id;
    const vendor = typeof obj.vendor === 'string' ? obj.vendor : '';

    const capabilities = obj.capabilities as Record<string, unknown> | undefined;
    const supports = capabilities?.supports as Record<string, unknown> | undefined;
    const supportsVision = supports?.vision === true;
    const supportsToolCalls = supports?.tool_calls === true;

    const rawEndpoints = obj.supported_endpoints;
    const supportedEndpoints = Array.isArray(rawEndpoints)
      ? rawEndpoints.filter((e): e is string => typeof e === 'string')
      : [];
    const isAnthropicShaped = supportedEndpoints.includes('/v1/messages');

    result.push({
      id,
      name,
      vendor,
      supportedEndpoints,
      isAnthropicShaped,
      supportsVision,
      supportsToolCalls,
    });
  }

  return result;
}

export const githubCopilotOAuthProvider: OAuthProviderInterface = {
  id: 'github-copilot',
  name: 'GitHub Copilot',

  async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
    return loginGitHubCopilot({
      onAuth: (url, instructions) => callbacks.onAuth({ url, instructions }),
      onPrompt: callbacks.onPrompt,
      onProgress: callbacks.onProgress,
      signal: callbacks.signal,
    });
  },

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    const creds = credentials as GitHubCopilotCredentials;
    return refreshGitHubCopilotToken(creds.refresh, creds.enterpriseUrl);
  },

  getApiKey(credentials: OAuthCredentials): string {
    return credentials.access;
  },
};

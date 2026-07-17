/**
 * OpenAI Codex (ChatGPT OAuth) flow
 *
 * Inspired by pi-mono's OAuth implementation:
 * https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/oauth/openai-codex.ts
 *
 * NOTE: This module uses Node.js crypto and http for the OAuth callback.
 * It is only intended for CLI use, not browser environments.
 */

// NEVER convert to top-level imports - breaks browser/Vite builds (web-ui)
let _randomBytes: ((size: number) => Buffer) | null = null;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let _cryptoPromise: Promise<typeof import('node:crypto')> | null = null;
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

import { parseAuthorizationInput } from '../authorization-input.js';
import { generatePKCE } from '../pkce.js';
import type { AuthMode, OAuthCredentials, OAuthLoginCallbacks, OAuthPrompt, OAuthProviderInterface } from '../types.js';

export const OPENAI_CODEX_AUTH_MODES: ReadonlyArray<AuthMode> = [
  {
    id: 'browser',
    name: 'Browser (local callback)',
    description: 'Opens the browser and waits for the OAuth callback on localhost.',
  },
  {
    id: 'device',
    name: 'Device code (headless)',
    description: 'Shows a code to enter at openai.com — for SSH, remote, or no-browser environments.',
  },
];

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const ISSUER = 'https://auth.openai.com';
const AUTHORIZE_URL = `${ISSUER}/oauth/authorize`;
const TOKEN_URL = `${ISSUER}/oauth/token`;
const DEVICE_USER_CODE_URL = `${ISSUER}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${ISSUER}/api/accounts/deviceauth/token`;
const DEVICE_AUTHORIZE_URL = `${ISSUER}/codex/device`;
const DEVICE_REDIRECT_URI = `${ISSUER}/deviceauth/callback`;
const DEFAULT_CALLBACK_PORT = 1455;
const FALLBACK_CALLBACK_PORT = 1457;
const DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 3600;
const DEVICE_AUTH_TIMEOUT_MS = 15 * 60 * 1000;
const SCOPE = 'openid profile email offline_access api.connectors.read api.connectors.invoke';
const JWT_CLAIM_PATH = 'https://api.openai.com/auth';

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authentication successful</title>
</head>
<body>
  <p>Authentication successful. Return to your terminal to continue.</p>
</body>
</html>`;

type TokenSuccess = {
  type: 'success';
  access: string;
  refresh: string;
  expires: number;
  idToken?: string;
};
type TokenFailure = { type: 'failed' };
type TokenResult = TokenSuccess | TokenFailure;

type JwtPayload = {
  chatgpt_account_id?: string;
  [JWT_CLAIM_PATH]?: {
    chatgpt_account_id?: string;
  };
  [key: string]: unknown;
};

async function createState(): Promise<string> {
  const randomBytes = await getRandomBytes();
  return randomBytes(16).toString('hex');
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1] ?? '';
    const padded = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function extractAccountIdFromClaims(payload: JwtPayload | null | undefined): string | null {
  if (!payload) return null;
  const accountId = payload.chatgpt_account_id ?? payload[JWT_CLAIM_PATH]?.chatgpt_account_id;
  return typeof accountId === 'string' && accountId.length > 0 ? accountId : null;
}

function getAccountId(tokens: { idToken?: string; access: string }, fallback?: string): string | undefined {
  const fromIdToken = tokens.idToken ? extractAccountIdFromClaims(decodeJwt(tokens.idToken)) : null;
  if (fromIdToken) return fromIdToken;

  const fromAccessToken = extractAccountIdFromClaims(decodeJwt(tokens.access));
  if (fromAccessToken) return fromAccessToken;

  return fallback;
}

function requireAccountId(tokens: { idToken?: string; access: string }, fallback?: string): string {
  const accountId = getAccountId(tokens, fallback);
  if (!accountId) {
    throw new Error('Failed to extract ChatGPT account id from OpenAI Codex token');
  }
  return accountId;
}

type TokenResponseJson = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

function tokenResponseToResult(json: TokenResponseJson, logPrefix: string): TokenResult {
  if (!json.access_token || !json.refresh_token) {
    console.error(`[openai-codex] ${logPrefix} response missing fields:`, json);
    return { type: 'failed' };
  }

  return {
    type: 'success',
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + (json.expires_in ?? DEFAULT_TOKEN_EXPIRES_IN_SECONDS) * 1000,
    idToken: json.id_token,
  };
}

async function exchangeAuthorizationCode(code: string, verifier: string, redirectUri: string): Promise<TokenResult> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('[openai-codex] code->token failed:', response.status, text);
    return { type: 'failed' };
  }

  return tokenResponseToResult((await response.json()) as TokenResponseJson, 'token');
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[openai-codex] Token refresh failed:', response.status, text);
      return { type: 'failed' };
    }

    return tokenResponseToResult((await response.json()) as TokenResponseJson, 'Token refresh');
  } catch (error) {
    console.error('[openai-codex] Token refresh error:', error);
    return { type: 'failed' };
  }
}

async function getRandomBytes() {
  if (!_randomBytes && _cryptoPromise) {
    _randomBytes = (await _cryptoPromise).randomBytes;
  }
  if (!_randomBytes) {
    throw new Error('OpenAI Codex OAuth is only available in Node.js environments');
  }
  return _randomBytes;
}

async function createAuthorizationFlow(
  redirectUri: string,
  state: string,
  originator: string = 'mastracode',
): Promise<{ verifier: string; url: string }> {
  const { verifier, challenge } = await generatePKCE();

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('id_token_add_organizations', 'true');
  url.searchParams.set('codex_cli_simplified_flow', 'true');
  url.searchParams.set('originator', originator);

  return { verifier, url: url.toString() };
}

type OAuthServerInfo = {
  redirectUri: string;
  warning?: string;
  close: () => void;
  cancelWait: () => void;
  waitForCode: () => Promise<{ code: string } | null>;
};

type CallbackPorts = {
  defaultPort: number;
  fallbackPort: number;
};

const CODEX_CALLBACK_PORTS: CallbackPorts = {
  defaultPort: DEFAULT_CALLBACK_PORT,
  fallbackPort: FALLBACK_CALLBACK_PORT,
};

async function requestCancel(port: number): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${port}/cancel`, { signal: AbortSignal.timeout(200) });
  } catch {
    // The existing listener might not be a Codex auth server.
  }
}

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

async function bindOAuthServer(server: HttpServer, ports: CallbackPorts): Promise<number | null> {
  await requestCancel(ports.defaultPort);
  if (await listen(server, ports.defaultPort)) return ports.defaultPort;
  if (await listen(server, ports.fallbackPort)) return ports.fallbackPort;

  return null;
}

async function getHttpModule() {
  if (!_http && _httpPromise) {
    _http = await _httpPromise;
  }
  if (!_http) {
    throw new Error('OpenAI Codex OAuth is only available in Node.js environments');
  }
  return _http;
}

async function startLocalOAuthServer(
  state: string,
  ports: CallbackPorts = CODEX_CALLBACK_PORTS,
): Promise<OAuthServerInfo> {
  const http = await getHttpModule();
  let lastCode: string | null = null;
  let cancelled = false;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '', 'http://localhost');
      if (url.pathname === '/cancel') {
        cancelled = true;
        res.statusCode = 200;
        res.end('Cancelled');
        return;
      }
      if (url.pathname !== '/auth/callback') {
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

  return new Promise(resolve => {
    bindOAuthServer(server, ports).then(port => {
      if (!port) {
        resolve({
          redirectUri: `http://localhost:${ports.fallbackPort}/auth/callback`,
          warning: `OpenAI Codex OAuth requires localhost port ${ports.defaultPort} or ${ports.fallbackPort}, but both are in use. Automatic browser callback will not work until one is freed.`,
          close: () => {
            try {
              server.close();
            } catch {
              // ignore
            }
          },
          cancelWait: () => {},
          waitForCode: async () => null,
        });
        return;
      }

      resolve({
        redirectUri: `http://localhost:${port}/auth/callback`,
        close: () => server.close(),
        cancelWait: () => {
          cancelled = true;
        },
        waitForCode: async () => {
          const sleep = () => new Promise(r => setTimeout(r, 100));
          for (let i = 0; i < 600; i += 1) {
            if (lastCode) return { code: lastCode };
            if (cancelled) return null;
            await sleep();
          }
          return null;
        },
      });
    });
  });
}

/**
 * Serializable pending state for a Codex device-code login. Safe to persist
 * (e.g. a `pending jsonb` column) so polling can span HTTP requests — the
 * device token response carries the `code_verifier`, so no PKCE state needs
 * to be kept client-side.
 */
export interface CodexDeviceLoginPending {
  deviceAuthId: string;
  userCode: string;
  /** Verification URL for the user to open. */
  url: string;
  instructions: string;
  /** Poll interval in ms suggested by the server. */
  intervalMs: number;
  /** ms epoch after which the device authorization expires. */
  deadlineAt: number;
}

export type CodexDevicePollResult =
  | { status: 'complete'; credentials: OAuthCredentials }
  | { status: 'pending'; nextPollMs: number }
  | { status: 'failed'; error: string };

/**
 * Start a Codex device-code login: request a user code and return the
 * serializable pending state for subsequent polls.
 */
export async function startCodexDeviceLogin(options?: { signal?: AbortSignal }): Promise<CodexDeviceLoginPending> {
  const response = await fetch(DEVICE_USER_CODE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'mastracode',
    },
    body: JSON.stringify({ client_id: CLIENT_ID, originator: 'mastracode' }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate OpenAI Codex device authorization: ${response.status}`);
  }

  const deviceData = (await response.json()) as {
    device_auth_id?: string;
    user_code?: string;
    usercode?: string;
    interval?: string | number;
  };

  const userCode = deviceData.user_code ?? deviceData.usercode;

  if (!deviceData.device_auth_id || !userCode) {
    throw new Error('OpenAI Codex device authorization response missing required fields');
  }

  const intervalSeconds =
    typeof deviceData.interval === 'number' ? deviceData.interval : Number.parseInt(deviceData.interval ?? '', 10) || 5;

  return {
    deviceAuthId: deviceData.device_auth_id,
    userCode,
    url: DEVICE_AUTHORIZE_URL,
    instructions: `Enter code: ${userCode}`,
    intervalMs: Math.max(intervalSeconds, 1) * 1000,
    deadlineAt: Date.now() + DEVICE_AUTH_TIMEOUT_MS,
  };
}

/**
 * Perform exactly one upstream poll for a pending Codex device login.
 * The Codex device endpoint signals "still pending" via HTTP 403/404 (it is
 * not an RFC 8628 error-JSON endpoint); on success it returns the
 * authorization code plus server-held PKCE verifier, which we exchange
 * immediately for credentials. Never throws for flow-level conditions.
 */
export async function pollCodexDeviceLogin(
  pending: CodexDeviceLoginPending,
  options?: { signal?: AbortSignal },
): Promise<CodexDevicePollResult> {
  if (Date.now() >= pending.deadlineAt) {
    return { status: 'failed', error: 'OpenAI Codex device authorization timed out after 15 minutes' };
  }

  const pollResponse = await fetch(DEVICE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'mastracode',
    },
    body: JSON.stringify({
      device_auth_id: pending.deviceAuthId,
      user_code: pending.userCode,
    }),
    signal: options?.signal,
  });

  if (pollResponse.ok) {
    const data = (await pollResponse.json()) as {
      authorization_code?: string;
      code_verifier?: string;
    };

    if (!data.authorization_code || !data.code_verifier) {
      return { status: 'failed', error: 'OpenAI Codex device token response missing required fields' };
    }

    const tokenResult = await exchangeAuthorizationCode(
      data.authorization_code,
      data.code_verifier,
      DEVICE_REDIRECT_URI,
    );
    if (tokenResult.type !== 'success') {
      return { status: 'failed', error: 'Token exchange failed' };
    }

    let accountId: string;
    try {
      accountId = requireAccountId(tokenResult);
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
    }

    return {
      status: 'complete',
      credentials: {
        access: tokenResult.access,
        refresh: tokenResult.refresh,
        expires: tokenResult.expires,
        accountId,
      },
    };
  }

  if (pollResponse.status !== 403 && pollResponse.status !== 404) {
    const text = await pollResponse.text().catch(() => '');
    return {
      status: 'failed',
      error: `OpenAI Codex device authorization failed: ${pollResponse.status}${text ? ` ${text}` : ''}`,
    };
  }

  return { status: 'pending', nextPollMs: pending.intervalMs };
}

async function loginOpenAICodexDevice(options: {
  onAuth: (info: { url: string; instructions?: string }) => void;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
}): Promise<OAuthCredentials> {
  const pending = await startCodexDeviceLogin({ signal: options.signal });
  const sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));

  options.onAuth({
    url: pending.url,
    instructions: pending.instructions,
  });

  await sleep(pending.intervalMs);

  while (true) {
    if (options.signal?.aborted) {
      throw new Error('Login cancelled');
    }

    const result = await pollCodexDeviceLogin(pending, { signal: options.signal });
    if (result.status === 'complete') {
      return result.credentials;
    }
    if (result.status === 'failed') {
      throw new Error(result.error);
    }

    options.onProgress?.('Waiting for OpenAI Codex device authorization...');
    await sleep(result.nextPollMs);
  }
}

/**
 * Login with OpenAI Codex OAuth
 *
 * @param options.onAuth - Called with URL and instructions when auth starts
 * @param options.onPrompt - Called to prompt user for manual code paste (fallback if no onManualCodeInput)
 * @param options.onProgress - Optional progress messages
 * @param options.onManualCodeInput - Optional promise that resolves with user-pasted code.
 *                                    Races with browser callback - whichever completes first wins.
 *                                    Useful for showing paste input immediately alongside browser flow.
 * @param options.originator - OAuth originator parameter (defaults to "mastracode")
 */
export async function loginOpenAICodex(options: {
  onAuth: (info: { url: string; instructions?: string }) => void;
  onPrompt: (prompt: OAuthPrompt) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
  signal?: AbortSignal;
  originator?: string;
  mode?: 'browser' | 'device';
}): Promise<OAuthCredentials> {
  const envMode =
    typeof process !== 'undefined' && process.env?.MASTRACODE_OPENAI_CODEX_AUTH_MODE === 'device'
      ? 'device'
      : undefined;
  const mode = options.mode ?? envMode ?? 'browser';
  if (mode === 'device') {
    return loginOpenAICodexDevice({
      onAuth: options.onAuth,
      onProgress: options.onProgress,
      signal: options.signal,
    });
  }

  const state = await createState();
  const server = await startLocalOAuthServer(state);
  if (server.warning) {
    options.onProgress?.(server.warning);
  }
  const { verifier, url } = await createAuthorizationFlow(
    server.redirectUri,
    state,
    options.originator ?? 'mastracode',
  );

  options.onAuth({
    url,
    instructions: server.warning
      ? `${server.warning} You can still paste the authorization code or full redirect URL manually.`
      : 'A browser window should open. Complete login to finish.',
  });

  let code: string | undefined;
  try {
    if (options.onManualCodeInput) {
      // Race between browser callback and manual input
      let manualCode: string | undefined;
      let manualError: Error | undefined;
      const manualPromise = options
        .onManualCodeInput()
        .then(input => {
          manualCode = input;
          server.cancelWait();
        })
        .catch(err => {
          manualError = err instanceof Error ? err : new Error(String(err));
          server.cancelWait();
        });

      const result = await server.waitForCode();

      // If manual input was cancelled, throw that error
      if (manualError) {
        throw manualError;
      }

      if (result?.code) {
        // Browser callback won
        code = result.code;
      } else if (manualCode) {
        // Manual input won (or callback timed out and user had entered code)
        const parsed = parseAuthorizationInput(manualCode);
        if (parsed.state && parsed.state !== state) {
          throw new Error('State mismatch');
        }
        code = parsed.code;
      }

      // If still no code, wait for manual promise to complete and try that
      if (!code) {
        await manualPromise;
        if (manualError) {
          throw manualError;
        }
        if (manualCode) {
          const parsed = parseAuthorizationInput(manualCode);
          if (parsed.state && parsed.state !== state) {
            throw new Error('State mismatch');
          }
          code = parsed.code;
        }
      }
    } else {
      // Original flow: wait for callback, then prompt if needed
      const result = await server.waitForCode();
      if (result?.code) {
        code = result.code;
      }
    }

    // Fallback to onPrompt if still no code
    if (!code) {
      const input = await options.onPrompt({
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

    const tokenResult = await exchangeAuthorizationCode(code, verifier, server.redirectUri);
    if (tokenResult.type !== 'success') {
      throw new Error('Token exchange failed');
    }

    const accountId = requireAccountId(tokenResult);

    return {
      access: tokenResult.access,
      refresh: tokenResult.refresh,
      expires: tokenResult.expires,
      accountId,
    };
  } finally {
    server.close();
  }
}

export const __testing = {
  createAuthorizationFlow,
  decodeJwt,
  extractAccountIdFromClaims,
  getAccountId,
  loginOpenAICodexDevice,
  requireAccountId,
  startLocalOAuthServer,
};

/**
 * Refresh OpenAI Codex OAuth token
 */
export async function refreshOpenAICodexToken(
  refreshToken: string,
  previousAccountId?: string,
): Promise<OAuthCredentials> {
  const result = await refreshAccessToken(refreshToken);
  if (result.type !== 'success') {
    throw new Error('Failed to refresh OpenAI Codex token');
  }

  const accountId = requireAccountId(result, previousAccountId);

  return {
    access: result.access,
    refresh: result.refresh,
    expires: result.expires,
    accountId,
  };
}

export const openaiCodexOAuthProvider: OAuthProviderInterface = {
  id: 'openai-codex',
  name: 'ChatGPT Plus/Pro (Codex Subscription)',
  usesCallbackServer: true,
  authModes: OPENAI_CODEX_AUTH_MODES,

  async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
    const mode = callbacks.authMode === 'device' || callbacks.authMode === 'browser' ? callbacks.authMode : undefined;
    return loginOpenAICodex({
      onAuth: callbacks.onAuth,
      onPrompt: callbacks.onPrompt,
      onProgress: callbacks.onProgress,
      onManualCodeInput: callbacks.onManualCodeInput,
      signal: callbacks.signal,
      mode,
    });
  },

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    return refreshOpenAICodexToken(credentials.refresh, credentials.accountId as string | undefined);
  },

  getApiKey(credentials: OAuthCredentials): string {
    return credentials.access;
  },
};

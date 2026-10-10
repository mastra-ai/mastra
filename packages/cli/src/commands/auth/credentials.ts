import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, rename, stat, utimes, writeFile, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, release } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import * as p from '@clack/prompts';

import { MASTRA_PLATFORM_API_URL } from './client.js';

const CREDENTIALS_DIR = join(homedir(), '.mastra');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');
const CREDENTIALS_LOCK_FILE = join(CREDENTIALS_DIR, 'credentials.lock');
const CREDENTIALS_LOCK_RETRY_MS = 50;
const CREDENTIALS_LOCK_TIMEOUT_MS = 30_000;
// A live lock owner refreshes the lock mtime every CREDENTIALS_LOCK_TOUCH_MS, so a
// lock untouched for CREDENTIALS_LOCK_STALE_MS belongs to a crashed process.
const CREDENTIALS_LOCK_TOUCH_MS = 5_000;
const CREDENTIALS_LOCK_STALE_MS = 15_000;
// Must stay well below CREDENTIALS_LOCK_TIMEOUT_MS so a hung refresh request
// releases the lock before waiters give up.
const REFRESH_REQUEST_TIMEOUT_MS = 10_000;

export interface Credentials {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  organizationId: string;
  currentOrgId?: string;
}

export interface LoginOptions {
  skipOnInput?: boolean;
  allowLogin?: boolean;
  timeoutMs?: number;
}

export class LoginCancelledError extends Error {
  constructor() {
    super('Login cancelled.');
    this.name = 'LoginCancelledError';
  }
}

class LoginTimedOutError extends Error {
  constructor() {
    super('Login timed out.');
    this.name = 'LoginTimedOutError';
  }
}

async function acquireCredentialsLock(signal?: AbortSignal): Promise<() => Promise<void>> {
  await mkdir(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  const startedAt = Date.now();

  while (true) {
    signal?.throwIfAborted();
    try {
      await writeFile(CREDENTIALS_LOCK_FILE, JSON.stringify({ pid: process.pid }), {
        encoding: 'utf-8',
        mode: 0o600,
        flag: 'wx',
      });
      // Keep the lock mtime fresh so waiters never mistake a held lock for a
      // stale one, no matter how long the locked operation runs.
      const keepAlive = setInterval(() => {
        const now = new Date();
        void utimes(CREDENTIALS_LOCK_FILE, now, now).catch(() => {});
      }, CREDENTIALS_LOCK_TOUCH_MS);
      keepAlive.unref?.();
      return async () => {
        clearInterval(keepAlive);
        await unlink(CREDENTIALS_LOCK_FILE).catch(() => {});
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    // Reclaim a lock only when its mtime stopped advancing: live owners refresh
    // it every CREDENTIALS_LOCK_TOUCH_MS, so a lock untouched for
    // CREDENTIALS_LOCK_STALE_MS has no live owner (crashed or killed process).
    // The stat happens immediately before the unlink to keep the window in
    // which a freshly swapped-in lock could be removed as small as possible.
    try {
      const lockStat = await stat(CREDENTIALS_LOCK_FILE);
      if (Date.now() - lockStat.mtimeMs >= CREDENTIALS_LOCK_STALE_MS) {
        await unlink(CREDENTIALS_LOCK_FILE).catch(() => {});
        continue;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }

    if (Date.now() - startedAt >= CREDENTIALS_LOCK_TIMEOUT_MS) {
      throw new Error('Timed out waiting for another Mastra CLI process to update credentials.');
    }
    await delay(CREDENTIALS_LOCK_RETRY_MS, undefined, { signal });
  }
}

async function withCredentialsLock<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const releaseLock = await acquireCredentialsLock(signal);
  try {
    return await operation();
  } finally {
    await releaseLock();
  }
}

async function saveCredentialsUnlocked(creds: Credentials): Promise<void> {
  await mkdir(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  const temporaryFile = `${CREDENTIALS_FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, JSON.stringify(creds, null, 2), { mode: 0o600 });
    await rename(temporaryFile, CREDENTIALS_FILE);
  } finally {
    await unlink(temporaryFile).catch(() => {});
  }
  await chmod(CREDENTIALS_DIR, 0o700).catch(() => {});
  await chmod(CREDENTIALS_FILE, 0o600).catch(() => {});
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await withCredentialsLock(() => saveCredentialsUnlocked(creds));
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const data = await readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data) as Credentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await withCredentialsLock(async () => {
    await unlink(CREDENTIALS_FILE).catch(() => {});
  });
}

export async function getCurrentOrgId(): Promise<string | null> {
  // CI/CD headless path
  const envOrgId = process.env.MASTRA_ORG_ID;
  if (envOrgId) return envOrgId;

  const creds = await loadCredentials();
  if (!creds) return null;
  return creds.currentOrgId ?? creds.organizationId;
}

export async function setCurrentOrgId(orgId: string): Promise<void> {
  await withCredentialsLock(async () => {
    const creds = await loadCredentials();
    if (!creds) throw new Error('Not logged in');
    creds.currentOrgId = orgId;
    await saveCredentialsUnlocked(creds);
  });
}

function isWSL(): boolean {
  if (process.platform !== 'linux') return false;
  try {
    // WSL kernels contain "microsoft" or "WSL" in the version string
    return /microsoft|wsl/i.test(release()) || /microsoft|wsl/i.test(readFileSync('/proc/version', 'utf-8'));
  } catch {
    return false;
  }
}

export function openBrowser(url: string) {
  // Use execFileSync (shell: false) to avoid shell-injection via the URL.
  if (process.platform === 'darwin') {
    execFileSync('open', [url]);
  } else if (process.platform === 'win32') {
    execFileSync('cmd', ['/c', 'start', '', url]);
  } else if (isWSL()) {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url.replace(/'/g, "''")}'`]);
  } else {
    execFileSync('xdg-open', [url]);
  }
}

export async function verifyToken(token: string, signal?: AbortSignal): Promise<boolean> {
  // Use plain fetch — NOT authenticatedFetch — to avoid its 401 interceptor
  // triggering a redundant refresh cycle.
  try {
    const res = await fetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function tryRefreshToken(creds: Credentials, signal?: AbortSignal): Promise<string | null> {
  if (!creds.refreshToken) return null;

  try {
    return await withCredentialsLock(async () => {
      const storedCredentials = await loadCredentials();
      // Logged out while we waited for the lock: don't resurrect the session
      // from the caller's stale refresh token.
      if (!storedCredentials) return null;
      // A different account logged in while we waited: don't hand its token to
      // this caller or rotate its refresh token.
      if (storedCredentials.user?.id !== creds.user?.id) return null;
      if (storedCredentials.token !== creds.token || storedCredentials.refreshToken !== creds.refreshToken) {
        return storedCredentials.token;
      }

      if (!storedCredentials.refreshToken) return null;

      // Bound the request so a hung refresh releases the lock before waiting
      // processes time out.
      const timeoutSignal = AbortSignal.timeout(REFRESH_REQUEST_TIMEOUT_MS);
      // Use plain fetch — NOT createApiClient/authenticatedFetch — to avoid
      // a deadlock: authenticatedFetch intercepts 401s by calling tryRefreshToken,
      // so if this request also 401s we'd infinitely recurse.
      const res = await fetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedCredentials.refreshToken }),
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      const refreshedCredentials = {
        ...storedCredentials,
        token: data.accessToken,
        refreshToken: data.refreshToken,
      };
      Object.assign(creds, refreshedCredentials);
      await saveCredentialsUnlocked(refreshedCredentials);
      return data.accessToken;
    }, signal);
  } catch {
    return null;
  }
}

function callbackPage({ success }: { success: boolean }): string {
  const title = success ? 'Logged in!' : 'Login failed';
  const message = success
    ? 'You can close this tab and return to the terminal.'
    : 'Missing parameters. Close this tab and try again.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — Mastra</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0d0d0d;
        color: #ffffff;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .container {
        text-align: center;
      }
      .logo {
        margin-bottom: 1.5rem;
      }
      h1 {
        font-size: 1.75rem;
        font-weight: 600;
        margin: 0 0 0.75rem 0;
      }
      p {
        color: #9ca3af;
        font-size: 1rem;
        margin: 0;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

function listenForSkipInput(onSkip: () => void): () => void {
  const stdin = process.stdin;
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return () => {};

  const wasRaw = stdin.isRaw;
  const wasPaused = stdin.isPaused();
  let listening = true;

  const cleanup = () => {
    if (!listening) return;
    listening = false;
    stdin.removeListener('data', handleInput);
    if (!wasRaw) stdin.setRawMode(false);
    if (wasPaused) stdin.pause();
  };

  const handleInput = (input: Buffer | string) => {
    const data = typeof input === 'string' ? Buffer.from(input) : input;
    cleanup();
    if (data.includes(3)) {
      process.kill(process.pid, 'SIGINT');
      return;
    }
    onSkip();
  };

  stdin.setRawMode(true);
  stdin.resume();
  stdin.once('data', handleInput);
  return cleanup;
}

async function loginAttempt(signal?: AbortSignal, options: LoginOptions = {}): Promise<Credentials> {
  signal?.throwIfAborted();
  console.info('\n   Logging in to Mastra...\n');

  const server = createServer();
  const state = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(16))).toString('hex');

  const port = await new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        resolve(addr.port);
      }
    });
  });

  const loginUrl = `${MASTRA_PLATFORM_API_URL}/v1/auth/login?product=cli&cli_port=${port}&state=${state}`;
  console.info(`   Opening browser...\n`);
  console.info(
    options.skipOnInput
      ? `   Waiting for browser sign-in. Press any key to skip this step.\n`
      : `   Waiting for browser sign-in...\n`,
  );

  try {
    openBrowser(loginUrl);
  } catch {
    console.info(`   Could not open browser automatically.`);
    console.info(`   Open this URL manually: ${loginUrl}\n`);
    if (isWSL()) {
      console.info(`   Note: If login times out, ensure localhost forwarding is enabled in your .wslconfig.\n`);
    }
  }

  const result = await new Promise<{
    token: string;
    refreshToken: string | null;
    user: Credentials['user'];
    organizationId: string;
  }>((resolve, reject) => {
    let settled = false;
    let stopListeningForSkip = () => {};
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', handleAbort);
      stopListeningForSkip();
      server.close(callback);
      server.closeAllConnections();
    };
    const handleAbort = () => {
      finish(() => reject(signal?.reason instanceof Error ? signal.reason : new Error('Login cancelled')));
    };
    const timeout = setTimeout(
      () => {
        finish(() => reject(new LoginTimedOutError()));
      },
      options.timeoutMs ?? 5 * 60 * 1000,
    );

    signal?.addEventListener('abort', handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    if (options.skipOnInput) {
      stopListeningForSkip = listenForSkipInput(() => finish(() => reject(new LoginCancelledError())));
    }

    server.on('request', (req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const callbackState = url.searchParams.get('state');
        const token = url.searchParams.get('token');
        const refreshToken = url.searchParams.get('refresh_token');
        const userParam = url.searchParams.get('user');
        const orgId = url.searchParams.get('org');

        if (callbackState !== state || !token || !userParam || !orgId) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(callbackPage({ success: false }));
          return;
        }

        const user = JSON.parse(decodeURIComponent(userParam));

        res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
        res.end(callbackPage({ success: true }));

        finish(() => resolve({ token, refreshToken, user, organizationId: orgId }));
      }
    });
  });

  const creds: Credentials = {
    token: result.token,
    ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}),
    user: result.user,
    organizationId: result.organizationId,
  };

  await saveCredentials(creds);
  console.info(`   Logged in as ${creds.user.email}\n`);
  return creds;
}

export async function login(signal?: AbortSignal, options: LoginOptions = {}): Promise<Credentials> {
  while (true) {
    try {
      return await loginAttempt(signal, options);
    } catch (error) {
      if (!(error instanceof LoginTimedOutError)) throw error;
    }

    if (!isInteractive()) throw new LoginCancelledError();

    const cancelValue = options.skipOnInput ? 'skip' : 'cancel';
    const choice = await p.select({
      message: 'Browser sign-in timed out.',
      options: [
        { value: 'retry', label: 'Retry' },
        { value: cancelValue, label: options.skipOnInput ? 'Skip platform setup' : 'Cancel login' },
      ],
      initialValue: 'retry',
      showInstructions: false,
      signal,
    });
    if (p.isCancel(choice) || choice === cancelValue) throw new LoginCancelledError();
  }
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

export async function getToken(signal?: AbortSignal, options: LoginOptions = {}): Promise<string> {
  signal?.throwIfAborted();

  // CI/CD headless path
  const envToken = process.env.MASTRA_API_TOKEN;
  if (envToken) return envToken;

  const creds = await loadCredentials();
  signal?.throwIfAborted();
  if (!creds) {
    if (options.allowLogin === false || !isInteractive()) {
      throw new Error('Not logged in. Run `mastra auth login` interactively or set MASTRA_API_TOKEN.');
    }
    const newCreds = await login(signal, options);
    return newCreds.token;
  }

  // Try a quick verify to see if the token is still valid.
  if (await verifyToken(creds.token, signal)) return creds.token;
  signal?.throwIfAborted();

  // Token might be expired — attempt refresh
  const refreshed = await tryRefreshToken(creds, signal);
  if (refreshed) return refreshed;
  signal?.throwIfAborted();

  if (options.allowLogin === false || !isInteractive()) {
    throw new Error('Session expired. Run `mastra auth login` interactively or set MASTRA_API_TOKEN.');
  }
  const newCreds = await login(signal, options);
  return newCreds.token;
}

/**
 * Validate that the user has access to the specified organization.
 * Throws if the org is not in the user's org list.
 */
export async function validateOrgAccess(token: string, orgId: string): Promise<void> {
  const { fetchOrgs } = await import('./api.js');
  const orgs = await fetchOrgs(token);
  const hasAccess = orgs.some(o => o.id === orgId);
  if (!hasAccess) {
    throw new Error(`No access to organization ${orgId}. Run: mastra auth orgs`);
  }
}

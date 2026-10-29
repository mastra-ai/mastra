import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Mastra Platform client for Mastra Code.
 *
 * Shares `~/.mastra/credentials.json` with the `mastra` CLI so a single login
 * works for both. Unlike the CLI flow, nothing here writes to stdout or reads
 * stdin, so it is safe to drive from the TUI.
 */

export const MASTRA_PLATFORM_API_URL = process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';

const CREDENTIALS_DIR = join(homedir(), '.mastra');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

export interface PlatformCredentials {
  token: string;
  refreshToken?: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  organizationId: string;
  currentOrgId?: string;
}

export interface PlatformOrg {
  id: string;
  name: string;
  role?: string;
  isCurrent?: boolean;
}

export interface PlatformProject {
  id: string;
  name: string;
  slug: string | null;
  organizationId: string;
}

export interface PlatformEnvironment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  type: 'production' | 'staging' | 'preview';
  instanceUrl: string | null;
  customServerUrl: string | null;
}

export interface PlatformSession {
  token: string;
  orgId: string;
}

export async function loadPlatformCredentials(filePath = CREDENTIALS_FILE): Promise<PlatformCredentials | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as PlatformCredentials;
  } catch {
    return null;
  }
}

export async function savePlatformCredentials(creds: PlatformCredentials, filePath = CREDENTIALS_FILE): Promise<void> {
  const dir = join(filePath, '..');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(filePath, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await chmod(filePath, 0o600).catch(() => {});
}

async function verifyToken(token: string, signal?: AbortSignal): Promise<boolean> {
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

async function refreshToken(creds: PlatformCredentials, signal?: AbortSignal): Promise<string | null> {
  if (!creds.refreshToken) return null;
  try {
    const res = await fetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: creds.refreshToken }),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    creds.token = data.accessToken;
    creds.refreshToken = data.refreshToken;
    await savePlatformCredentials(creds);
    return data.accessToken;
  } catch {
    return null;
  }
}

/**
 * Returns a valid session from env (`MASTRA_API_TOKEN` + `MASTRA_ORG_ID`) or
 * stored credentials, refreshing the token if needed. Returns null when the
 * user must log in.
 */
export async function getPlatformSession(signal?: AbortSignal): Promise<PlatformSession | null> {
  const envToken = process.env.MASTRA_API_TOKEN;
  const envOrg = process.env.MASTRA_ORG_ID;
  if (envToken && envOrg) return { token: envToken, orgId: envOrg };

  const creds = await loadPlatformCredentials();
  if (!creds) return null;
  const orgId = envOrg ?? creds.currentOrgId ?? creds.organizationId;
  if (await verifyToken(creds.token, signal)) return { token: creds.token, orgId };
  const refreshed = await refreshToken(creds, signal);
  return refreshed ? { token: refreshed, orgId } : null;
}

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  execFile(cmd, args as string[], () => {});
}

export interface PlatformLoginOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Called with the login URL so the UI can display it in case the browser does not open. */
  onUrl?: (url: string) => void;
  /** Override for tests. */
  openUrl?: (url: string) => void;
  credentialsPath?: string;
}

const CALLBACK_HTML = (ok: boolean) =>
  `<!doctype html><html><body style="background:#0d0d0d;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center"><h1>${
    ok ? 'Logged in!' : 'Login failed'
  }</h1><p>${ok ? 'You can close this tab and return to Mastra Code.' : 'Close this tab and try again.'}</p></div></body></html>`;

/** Browser-based Mastra Platform login using the same callback protocol as `mastra auth login`. */
export async function loginToPlatform(options: PlatformLoginOptions = {}): Promise<PlatformCredentials> {
  const { signal } = options;
  signal?.throwIfAborted();

  const server = createServer();
  const state = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(16))).toString('hex');
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) resolve(addr.port);
    });
  });

  const loginUrl = `${MASTRA_PLATFORM_API_URL}/v1/auth/login?product=cli&cli_port=${port}&state=${state}`;
  options.onUrl?.(loginUrl);
  (options.openUrl ?? openBrowser)(loginUrl);

  const creds = await new Promise<PlatformCredentials>((resolve, reject) => {
    let settled = false;
    const finish = (cb: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      server.close(cb);
      server.closeAllConnections();
    };
    const onAbort = () => finish(() => reject(new Error('Login cancelled')));
    const timeout = setTimeout(
      () => finish(() => reject(new Error('Login timed out'))),
      options.timeoutMs ?? 5 * 60 * 1000,
    );
    signal?.addEventListener('abort', onAbort, { once: true });

    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname !== '/callback') return void res.writeHead(404).end();

      const token = url.searchParams.get('token');
      const userParam = url.searchParams.get('user');
      const orgId = url.searchParams.get('org');
      if (url.searchParams.get('state') !== state || !token || !userParam || !orgId) {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end(CALLBACK_HTML(false));
        return;
      }
      let user: PlatformCredentials['user'];
      try {
        user = JSON.parse(decodeURIComponent(userParam));
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end(CALLBACK_HTML(false));
        return;
      }
      const refresh = url.searchParams.get('refresh_token');
      res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' }).end(CALLBACK_HTML(true));
      finish(() =>
        resolve({
          token,
          ...(refresh ? { refreshToken: refresh } : {}),
          user,
          organizationId: orgId,
        }),
      );
    });
  });

  await savePlatformCredentials(creds, options.credentialsPath);
  return creds;
}

async function platformGet<T>(session: PlatformSession, path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${MASTRA_PLATFORM_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.token}`, 'x-organization-id': session.orgId },
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(`Mastra Platform request failed (${res.status}): ${body.message ?? body.error ?? path}`);
  }
  return (await res.json()) as T;
}

export async function fetchPlatformOrgs(session: PlatformSession, signal?: AbortSignal): Promise<PlatformOrg[]> {
  const data = await platformGet<{ organizations?: PlatformOrg[]; orgs?: PlatformOrg[] }>(
    session,
    '/v1/auth/orgs',
    signal,
  );
  return data.organizations ?? data.orgs ?? [];
}

export async function fetchPlatformProjects(
  session: PlatformSession,
  signal?: AbortSignal,
): Promise<PlatformProject[]> {
  return (await platformGet<{ projects: PlatformProject[] }>(session, '/v1/projects', signal)).projects;
}

export async function fetchPlatformEnvironments(
  session: PlatformSession,
  projectId: string,
  signal?: AbortSignal,
): Promise<PlatformEnvironment[]> {
  return (
    await platformGet<{ environments: PlatformEnvironment[] }>(
      session,
      `/v1/projects/${encodeURIComponent(projectId)}/environments`,
      signal,
    )
  ).environments;
}

export const FACTORY_DOMAIN = 'factory.mastra.cloud';

/**
 * The Factory server URL for a deployed environment: a custom server wins,
 * otherwise the managed `<env slug>.factory.mastra.cloud` domain.
 */
export function resolveFactoryUrl(env: PlatformEnvironment): string | null {
  if (env.customServerUrl) {
    // The Platform session token is sent to this URL, so only accept HTTPS.
    try {
      const url = new URL(
        /^[a-z][a-z\d+.-]*:\/\//i.test(env.customServerUrl) ? env.customServerUrl : `https://${env.customServerUrl}`,
      );
      if (url.protocol !== 'https:') return null;
      return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
    } catch {
      return null;
    }
  }
  if (!env.instanceUrl) return null;
  return `https://${env.slug}.${FACTORY_DOMAIN}`;
}

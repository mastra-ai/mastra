import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, release } from 'node:os';
import { join } from 'node:path';

import { MASTRA_PLATFORM_API_URL } from './client.js';

const CREDENTIALS_DIR = join(homedir(), '.mastra');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

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

export async function saveCredentials(creds: Credentials): Promise<void> {
  await mkdir(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await chmod(CREDENTIALS_DIR, 0o700).catch(() => {});
  await chmod(CREDENTIALS_FILE, 0o600).catch(() => {});
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
  try {
    await unlink(CREDENTIALS_FILE);
  } catch {
    // file doesn't exist, that's fine
  }
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
  const creds = await loadCredentials();
  if (!creds) throw new Error('Not logged in');
  creds.currentOrgId = orgId;
  await saveCredentials(creds);
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

function openBrowser(url: string) {
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

export async function tryRefreshToken(creds: Credentials): Promise<string | null> {
  if (!creds.refreshToken) return null;

  try {
    // Use plain fetch — NOT createApiClient/authenticatedFetch — to avoid
    // a deadlock: authenticatedFetch intercepts 401s by calling tryRefreshToken,
    // so if this request also 401s we'd infinitely recurse.
    const res = await fetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: creds.refreshToken }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    creds.token = data.accessToken;
    creds.refreshToken = data.refreshToken;
    await saveCredentials(creds);
    return data.accessToken;
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

export async function login(): Promise<Credentials> {
  console.info('\nLogging in to Mastra...\n');

  const server = createServer();
  const state = randomBytes(16).toString('hex');

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
    const timeout = setTimeout(() => {
      server.close(() => {
        reject(new Error('Login timed out (60s)'));
      });
      server.closeAllConnections();
    }, 60000);

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

        clearTimeout(timeout);
        server.close(() => {
          resolve({ token, refreshToken, user, organizationId: orgId });
        });
        server.closeAllConnections();
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

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

export async function getToken(): Promise<string> {
  // CI/CD headless path
  const envToken = process.env.MASTRA_API_TOKEN;
  if (envToken) return envToken;

  const creds = await loadCredentials();
  if (!creds) {
    if (!isInteractive()) {
      throw new Error('Not logged in. Run `mastra auth login` interactively or set MASTRA_API_TOKEN.');
    }
    const newCreds = await login();
    return newCreds.token;
  }

  // Try a quick verify to see if the token is still valid.
  // Use plain fetch to avoid authenticatedFetch's 401 interceptor
  // which would trigger a redundant refresh cycle.
  try {
    const res = await fetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/verify`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (res.ok) return creds.token;
  } catch {
    // Network error — try refresh
  }

  // Token might be expired — attempt refresh
  const refreshed = await tryRefreshToken(creds);
  if (refreshed) return refreshed;

  if (!isInteractive()) {
    throw new Error('Session expired. Run `mastra auth login` interactively or set MASTRA_API_TOKEN.');
  }
  const newCreds = await login();
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

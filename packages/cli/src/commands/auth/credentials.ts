import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createApiClient, MASTRA_PLATFORM_API_URL } from './client.js';

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
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
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

function openBrowser(url: string) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  execSync(`${cmd} "${url}"`);
}

async function tryRefreshToken(creds: Credentials): Promise<string | null> {
  if (!creds.refreshToken) return null;

  try {
    const client = createApiClient(creds.token);
    const { data, error } = await client.POST('/v1/auth/refresh-token', {
      body: { refreshToken: creds.refreshToken },
    });
    if (error) return null;

    creds.token = data.accessToken;
    creds.refreshToken = data.refreshToken;
    await saveCredentials(creds);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function login(): Promise<Credentials> {
  console.info('\nLogging in to Mastra...\n');

  const server = createServer();

  const port = await new Promise<number>(resolve => {
    server.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        resolve(addr.port);
      }
    });
  });

  const loginUrl = `${MASTRA_PLATFORM_API_URL}/v1/auth/login?product=cli&cli_port=${port}`;
  console.info(`   Opening browser...\n`);

  try {
    openBrowser(loginUrl);
  } catch {
    console.info(`   Could not open browser automatically.`);
    console.info(`   Open this URL manually: ${loginUrl}\n`);
  }

  const result = await new Promise<{
    token: string;
    refreshToken: string | null;
    user: Credentials['user'];
    organizationId: string;
  }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Login timed out (60s)'));
    }, 60000);

    server.on('request', (req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        const refreshToken = url.searchParams.get('refresh_token');
        const userParam = url.searchParams.get('user');
        const orgId = url.searchParams.get('org');

        if (!token || !userParam || !orgId) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Login failed</h1><p>Missing parameters. Close this tab and try again.</p>');
          return;
        }

        const user = JSON.parse(decodeURIComponent(userParam));

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          `<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="text-align:center">
              <h1>Logged in!</h1>
              <p>You can close this tab and return to the terminal.</p>
            </div>
          </body></html>`,
        );

        clearTimeout(timeout);
        server.close();
        resolve({ token, refreshToken, user, organizationId: orgId });
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

export async function getToken(): Promise<string> {
  // CI/CD headless path
  const envToken = process.env.MASTRA_API_TOKEN;
  if (envToken) return envToken;

  const creds = await loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run: mastra auth login');
  }

  // Try a quick verify to see if the token is still valid
  try {
    const client = createApiClient(creds.token);
    const { error } = await client.GET('/v1/auth/verify');
    if (!error) return creds.token;
  } catch {
    // Network error — try refresh
  }

  // Token might be expired — attempt refresh
  const refreshed = await tryRefreshToken(creds);
  if (refreshed) return refreshed;

  throw new Error('Session expired. Run: mastra auth login');
}

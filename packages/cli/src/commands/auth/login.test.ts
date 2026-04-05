import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Stub out side-effects so login() doesn't open a browser or write to disk.
vi.mock('./client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'http://localhost:0',
  createApiClient: vi.fn(),
}));

vi.mock('node:fs/promises', async importOriginal => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    chmod: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
});

// Prevent openBrowser from actually opening anything.
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const execFileSyncMock = vi.mocked(execFileSync);

/** Extract the URL that openBrowser passed to execFileSync. */
function extractUrl(): string {
  for (const call of execFileSyncMock.mock.calls) {
    const args = call[1] as string[] | undefined;
    if (args) {
      const url = args.find(a => a.includes('cli_port='));
      if (url) return url;
    }
  }
  throw new Error('Could not find login URL in execFileSync calls');
}

/** Extract the port from the openBrowser URL. */
function extractPort(): number {
  const url = extractUrl();
  const match = url.match(/cli_port=(\d+)/);
  if (match) return Number(match[1]);
  throw new Error('Could not find cli_port in URL');
}

/** Extract the state nonce from the openBrowser URL. */
function extractState(): string {
  const url = extractUrl();
  const match = url.match(/state=([a-f0-9]+)/);
  if (match) return match[1];
  throw new Error('Could not find state in URL');
}

/** Send a simulated OAuth callback to the login server. */
function sendCallback(port: number, params: Record<string, string>): Promise<{ status: number; body: string }> {
  const qs = new URLSearchParams(params).toString();
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/callback?${qs}`, res => {
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode!, body }));
      })
      .on('error', reject);
  });
}

const validParams = {
  token: 'test-token',
  refresh_token: 'test-refresh',
  user: encodeURIComponent(JSON.stringify({ id: 'u1', email: 'test@test.com', firstName: 'A', lastName: 'B' })),
  org: 'org-1',
};

beforeEach(() => {
  vi.restoreAllMocks();
  execFileSyncMock.mockReset();
});

describe('login() server lifecycle', () => {
  it('returns credentials after a valid callback', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { login } = await import('./credentials.js');

    const loginPromise = login();

    // Wait for the server to start and openBrowser to be called.
    await vi.waitFor(() => {
      extractPort();
    });
    const port = extractPort();
    const state = extractState();

    await sendCallback(port, { ...validParams, state });

    const creds = await loginPromise;
    expect(creds.token).toBe('test-token');
    expect(creds.user.email).toBe('test@test.com');
    expect(creds.organizationId).toBe('org-1');
  });

  it('closes all connections so the process can exit', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.resetModules();
    execFileSyncMock.mockReset();
    const { login } = await import('./credentials.js');

    const loginPromise = login();

    await vi.waitFor(() => {
      extractPort();
    });
    const port = extractPort();
    const state = extractState();

    const response = await sendCallback(port, { ...validParams, state });
    await loginPromise;

    expect(response.body).toContain('Logged in!');

    // The server should no longer be listening — new connections should fail.
    await expect(
      new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/`, resolve);
        req.on('error', reject);
      }),
    ).rejects.toThrow();
  });

  it('returns 400 when callback params are missing', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.resetModules();
    execFileSyncMock.mockReset();
    const { login } = await import('./credentials.js');

    const loginPromise = login();

    await vi.waitFor(() => {
      extractPort();
    });
    const port = extractPort();
    const state = extractState();

    // Send callback with missing params (no state = rejected too)
    const response = await sendCallback(port, { token: 'tok' });
    expect(response.status).toBe(400);
    expect(response.body).toContain('Login failed');

    // Server should still be listening (waiting for a valid callback).
    // Clean up by sending a valid callback.
    await sendCallback(port, { ...validParams, state });
    await loginPromise;
  });
});

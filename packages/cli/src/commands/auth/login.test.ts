import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { select } from '@clack/prompts';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Stub out side-effects so login() doesn't open a browser or write to disk.
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: () => false,
}));

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
const selectMock = vi.mocked(select);

/** Extract the URL that openBrowser passed to execFileSync. */
function extractUrl(index = 0): string {
  const urls = execFileSyncMock.mock.calls.flatMap(call => {
    const args = call[1];
    return args?.filter(arg => arg.includes('cli_port=')) ?? [];
  });
  const url = urls[index];
  if (url) return url;
  throw new Error('Could not find login URL in execFileSync calls');
}

/** Extract the port from the openBrowser URL. */
function extractPort(index = 0): number {
  const url = extractUrl(index);
  const match = url.match(/cli_port=(\d+)/);
  if (match) return Number(match[1]);
  throw new Error('Could not find cli_port in URL');
}

/** Extract the state nonce from the openBrowser URL. */
function extractState(index = 0): string {
  const url = extractUrl(index);
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

function mockTerminal(isTTY = true) {
  const isTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  const stdoutIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  const setRawModeDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'setRawMode');
  const setRawMode = vi.fn().mockReturnValue(process.stdin);
  Object.defineProperties(process.stdin, {
    isTTY: { configurable: true, value: isTTY },
    setRawMode: { configurable: true, value: setRawMode },
  });
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: isTTY });
  vi.spyOn(process.stdin, 'isPaused').mockReturnValue(true);
  vi.spyOn(process.stdin, 'resume').mockReturnValue(process.stdin);
  vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin);

  return {
    setRawMode,
    restore() {
      if (isTTYDescriptor) Object.defineProperty(process.stdin, 'isTTY', isTTYDescriptor);
      else Reflect.deleteProperty(process.stdin, 'isTTY');
      if (stdoutIsTTYDescriptor) Object.defineProperty(process.stdout, 'isTTY', stdoutIsTTYDescriptor);
      else Reflect.deleteProperty(process.stdout, 'isTTY');
      if (setRawModeDescriptor) Object.defineProperty(process.stdin, 'setRawMode', setRawModeDescriptor);
      else Reflect.deleteProperty(process.stdin, 'setRawMode');
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  // Reset the module cache so the dynamic import picks up vi.mock factories.
  // Without this, isolate:false lets a cached credentials.js bypass the mocks.
  vi.resetModules();
  execFileSyncMock.mockReset();
  selectMock.mockReset();
});

describe('login() server lifecycle', () => {
  it('returns credentials after a valid callback', async () => {
    const { login } = await import('./credentials.js');

    const loginPromise = login();

    // Wait for the server to start and openBrowser to be called.
    await vi.waitFor(
      () => {
        extractPort();
      },
      { timeout: 5000 },
    );
    const port = extractPort();
    const state = extractState();

    await sendCallback(port, { ...validParams, state });

    const creds = await loginPromise;
    expect(creds.token).toBe('test-token');
    expect(creds.user.email).toBe('test@test.com');
    expect(creds.organizationId).toBe('org-1');
  });

  it('closes all connections so the process can exit', async () => {
    const { login } = await import('./credentials.js');

    const loginPromise = login();

    await vi.waitFor(
      () => {
        extractPort();
      },
      { timeout: 5000 },
    );
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

  it('closes the callback server when login is aborted', async () => {
    const { login } = await import('./credentials.js');
    const controller = new AbortController();
    const loginPromise = login(controller.signal);

    await vi.waitFor(
      () => {
        extractPort();
      },
      { timeout: 5000 },
    );
    const port = extractPort();
    controller.abort();

    await expect(loginPromise).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/`, resolve);
        req.on('error', reject);
      }),
    ).rejects.toThrow();
  });

  it('skips login when any key is pressed', async () => {
    const stdin = mockTerminal();
    try {
      const { login, LoginCancelledError } = await import('./credentials.js');
      const loginPromise = login(undefined, { skipOnInput: true });

      await vi.waitFor(
        () => {
          extractPort();
        },
        { timeout: 5000 },
      );
      process.stdin.emit('data', Buffer.from('x'));

      await expect(loginPromise).rejects.toBeInstanceOf(LoginCancelledError);
      expect(stdin.setRawMode).toHaveBeenNthCalledWith(1, true);
      expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Waiting for browser sign-in. Press any key to skip this step.'),
      );
    } finally {
      stdin.restore();
    }
  });

  it('forwards Ctrl+C as SIGINT instead of treating it as a skip key', async () => {
    const stdin = mockTerminal();
    const controller = new AbortController();
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      controller.abort();
      return true;
    });
    try {
      const { login } = await import('./credentials.js');
      const loginPromise = login(controller.signal, { skipOnInput: true });

      await vi.waitFor(
        () => {
          extractPort();
        },
        { timeout: 5000 },
      );
      process.stdin.emit('data', Buffer.from([3]));

      await expect(loginPromise).rejects.toMatchObject({ name: 'AbortError' });
      expect(kill).toHaveBeenCalledWith(process.pid, 'SIGINT');
    } finally {
      stdin.restore();
    }
  });

  it('retries with a fresh callback server after login times out', async () => {
    const terminal = mockTerminal();
    try {
      selectMock.mockResolvedValueOnce('retry');
      const { login } = await import('./credentials.js');
      const loginPromise = login(undefined, { timeoutMs: 1000 });

      await vi.waitFor(() => expect(selectMock).toHaveBeenCalledOnce(), { timeout: 5000 });
      await vi.waitFor(() => expect(execFileSyncMock).toHaveBeenCalledTimes(2), { timeout: 5000 });

      await sendCallback(extractPort(1), { ...validParams, state: extractState(1) });

      await expect(loginPromise).resolves.toMatchObject({ token: 'test-token' });
    } finally {
      terminal.restore();
    }
  });

  it('offers to cancel a standalone login after it times out', async () => {
    const terminal = mockTerminal();
    try {
      selectMock.mockResolvedValueOnce('cancel');
      const { login, LoginCancelledError } = await import('./credentials.js');

      await expect(login(undefined, { timeoutMs: 10 })).rejects.toBeInstanceOf(LoginCancelledError);
      expect(selectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.arrayContaining([expect.objectContaining({ value: 'cancel', label: 'Cancel login' })]),
        }),
      );
    } finally {
      terminal.restore();
    }
  });

  it('offers to skip platform setup after it times out during project creation', async () => {
    const terminal = mockTerminal();
    try {
      selectMock.mockResolvedValueOnce('skip');
      const { login, LoginCancelledError } = await import('./credentials.js');

      await expect(login(undefined, { skipOnInput: true, timeoutMs: 10 })).rejects.toBeInstanceOf(LoginCancelledError);
      expect(selectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.arrayContaining([expect.objectContaining({ value: 'skip', label: 'Skip platform setup' })]),
        }),
      );
    } finally {
      terminal.restore();
    }
  });

  it('cancels a timed-out login without prompting in a non-interactive terminal', async () => {
    const terminal = mockTerminal(false);
    try {
      const { login, LoginCancelledError } = await import('./credentials.js');

      await expect(login(undefined, { timeoutMs: 10 })).rejects.toBeInstanceOf(LoginCancelledError);
      expect(selectMock).not.toHaveBeenCalled();
    } finally {
      terminal.restore();
    }
  });

  it('cancels a timed-out login without prompting in CI with TTY streams', async () => {
    const terminal = mockTerminal();
    vi.stubEnv('CI', 'true');
    try {
      const { login, LoginCancelledError } = await import('./credentials.js');

      await expect(login(undefined, { timeoutMs: 10 })).rejects.toBeInstanceOf(LoginCancelledError);
      expect(selectMock).not.toHaveBeenCalled();
    } finally {
      terminal.restore();
      vi.unstubAllEnvs();
    }
  });

  it('returns 400 when callback params are missing', async () => {
    const { login } = await import('./credentials.js');

    const loginPromise = login();

    await vi.waitFor(
      () => {
        extractPort();
      },
      { timeout: 5000 },
    );
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

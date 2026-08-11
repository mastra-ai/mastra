import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cliAuth = vi.hoisted(() => ({
  MASTRA_PLATFORM_API_URL: 'https://platform.example.test',
  authHeaders: vi.fn((token: string, orgId: string) => ({
    Authorization: `Bearer ${token}`,
    'x-mastra-org-id': orgId,
  })),
  extractApiErrorDetail: vi.fn((body: unknown) => {
    if (
      body &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof (body as { detail: unknown }).detail === 'string'
    ) {
      return (body as { detail: string }).detail;
    }
    return null;
  }),
  platformFetch: vi.fn(),
}));

vi.mock('mastra/internal/auth', () => cliAuth);

import { attachNeonDatabase, createServerProject, PlatformApiError, waitForDatabaseReady } from './platform.js';

/**
 * Build a fresh Response every time — a `Response` body is single-use, and
 * `mockResolvedValue` would hand the same instance to every poll.
 */
function jsonResponseFactory(status: number, body: unknown): () => Response {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

beforeEach(() => {
  cliAuth.platformFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createServerProject', () => {
  it('marks projects as factory-enabled', async () => {
    cliAuth.platformFetch.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ project: { id: 'proj_1', slug: 'my-factory', name: 'My Factory' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await createServerProject({ token: 'wos-token', orgId: 'org_123', name: 'My Factory', region: 'eu' });

    expect(cliAuth.platformFetch).toHaveBeenCalledWith(
      'https://platform.example.test/v1/server/projects',
      expect.objectContaining({
        body: JSON.stringify({ name: 'My Factory', region: 'eu', factoryEnabled: true }),
      }),
    );
  });
});

describe('attachNeonDatabase', () => {
  it('passes the selected Neon region to the database endpoint', async () => {
    cliAuth.platformFetch.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ database: { id: 'db_1', status: 'provisioning' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await attachNeonDatabase({
      token: 'wos-token',
      orgId: 'org_123',
      projectId: 'proj_1',
      name: 'my-factory',
      regionId: 'aws-eu-central-1',
    });

    expect(cliAuth.platformFetch).toHaveBeenCalledWith(
      'https://platform.example.test/v1/server/projects/proj_1/databases',
      expect.objectContaining({
        body: JSON.stringify({ kind: 'neon', name: 'my-factory', regionId: 'aws-eu-central-1' }),
      }),
    );
  });

  it('surfaces the admin-role hint when the platform returns 403', async () => {
    cliAuth.platformFetch.mockImplementationOnce(
      async () => new Response(JSON.stringify({ detail: 'forbidden' }), { status: 403 }),
    );

    await expect(
      attachNeonDatabase({
        token: 'wos-token',
        orgId: 'org_123',
        projectId: 'proj_1',
        name: 'my-factory',
        regionId: 'aws-us-west-2',
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('admin role'),
    });
  });
});

describe('waitForDatabaseReady', () => {
  it('resolves as soon as the database reports ready', async () => {
    const provisioning = jsonResponseFactory(200, { database: { id: 'db_1', status: 'provisioning', error: null } });
    const ready = jsonResponseFactory(200, { database: { id: 'db_1', status: 'ready', error: null } });
    cliAuth.platformFetch
      .mockImplementationOnce(async () => provisioning())
      .mockImplementationOnce(async () => ready());

    vi.useFakeTimers();
    const promise = waitForDatabaseReady({
      token: 'wos-token',
      orgId: 'org_123',
      projectId: 'proj_1',
      databaseId: 'db_1',
      intervalMs: 100,
      timeoutMs: 10_000,
    });

    // Advance past the sleep between the two polls.
    await vi.advanceTimersByTimeAsync(150);

    const result = await promise;
    expect(result.status).toBe('ready');
    expect(cliAuth.platformFetch).toHaveBeenCalledTimes(2);
  });

  it('bails after the timeout with a "still provisioning" error', async () => {
    const provisioning = jsonResponseFactory(200, { database: { id: 'db_1', status: 'provisioning', error: null } });
    cliAuth.platformFetch.mockImplementation(async () => provisioning());

    vi.useFakeTimers();
    const promise = waitForDatabaseReady({
      token: 'wos-token',
      orgId: 'org_123',
      projectId: 'proj_1',
      databaseId: 'db_1',
      intervalMs: 100,
      timeoutMs: 500,
    });

    // Attach a caught .catch immediately so vitest doesn't flag an unhandled
    // rejection while we're still ticking timers forward.
    const caught: Promise<unknown> = promise.catch((err: unknown) => err);

    // Loop: poll(0) → sleep(100) → poll(100) → sleep(100) → … → 500ms deadline.
    await vi.advanceTimersByTimeAsync(1_000);

    const err = await caught;
    expect(err).toBeInstanceOf(PlatformApiError);
    expect((err as PlatformApiError).status).toBe(504);
    expect((err as PlatformApiError).message).toMatch(/still provisioning after \d+s/);
    // Polled at least once (the initial call before any sleep).
    expect(cliAuth.platformFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('aborts a hung in-flight poll once the overall timeout is reached', async () => {
    // Fetch never resolves on its own — it only settles when its signal
    // aborts. This models a stalled platform request that would otherwise
    // exceed timeoutMs indefinitely without the per-request AbortSignal.
    cliAuth.platformFetch.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('test expected a signal on the first hung fetch'));
          return;
        }
        signal.addEventListener('abort', () => {
          const reason = signal.reason;
          // AbortSignal.timeout() rejects with a TimeoutError DOMException.
          reject(reason instanceof Error ? reason : new Error('aborted'));
        });
      });
    });

    vi.useFakeTimers();
    const promise = waitForDatabaseReady({
      token: 'wos-token',
      orgId: 'org_123',
      projectId: 'proj_1',
      databaseId: 'db_1',
      intervalMs: 100,
      timeoutMs: 500,
    });
    const caught: Promise<unknown> = promise.catch((err: unknown) => err);

    // The first poll starts at t=0 with a 500ms AbortSignal.timeout — no
    // subsequent poll ever runs because the fetch hangs. Advance past the
    // deadline to trip the per-request abort.
    await vi.advanceTimersByTimeAsync(600);

    const err = await caught;
    expect(err).toBeInstanceOf(PlatformApiError);
    expect((err as PlatformApiError).status).toBe(504);
    // Uses the same "still <status>" wording as the natural-deadline path;
    // status defaults to `provisioning` because the first poll never returned.
    expect((err as PlatformApiError).message).toMatch(/still provisioning after \d+s/);
    // Only one fetch was ever issued — proves we bounded the hung request
    // rather than waiting on the next sleep tick.
    expect(cliAuth.platformFetch).toHaveBeenCalledTimes(1);
  });

  it('fails fast when the platform reports status=failed', async () => {
    cliAuth.platformFetch.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ database: { id: 'db_1', status: 'failed', error: 'region unavailable' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(
      waitForDatabaseReady({
        token: 'wos-token',
        orgId: 'org_123',
        projectId: 'proj_1',
        databaseId: 'db_1',
        intervalMs: 100,
        timeoutMs: 10_000,
      }),
    ).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('region unavailable'),
    });
  });
});

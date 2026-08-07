import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPlatformFetch = vi.fn();

vi.mock('../auth/client.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    platformFetch: mockPlatformFetch,
  };
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const dbRow = {
  id: 'db-1',
  platformProjectId: 'proj-1',
  organizationId: 'org-1',
  environmentId: null,
  kind: 'turso' as const,
  name: 'my-app-db',
  status: 'provisioning' as const,
  region: 'iad',
  providerResourceId: null,
  error: null,
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
  deletedAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  process.env.MASTRA_PLATFORM_API_URL = 'http://localhost:9999';
});

afterEach(() => {
  delete process.env.MASTRA_PLATFORM_API_URL;
});

describe('fetchDatabases', () => {
  it('returns databases on success', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(200, { databases: [dbRow] }));

    const { fetchDatabases } = await import('./platform-api.js');
    await expect(fetchDatabases('tok', 'org-1', 'proj-1')).resolves.toEqual([dbRow]);
    expect(mockPlatformFetch).toHaveBeenCalledWith(
      'http://localhost:9999/v1/server/projects/proj-1/databases',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok', 'x-organization-id': 'org-1' }),
      }),
    );
  });

  it('throws session expired on 401', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(401, {}));

    const { fetchDatabases } = await import('./platform-api.js');
    await expect(fetchDatabases('tok', 'org-1', 'proj-1')).rejects.toThrow('Session expired. Run: mastra auth login');
  });
});

describe('attachDatabase', () => {
  it('posts the attach input and returns the database', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(201, { database: dbRow }));

    const { attachDatabase } = await import('./platform-api.js');
    await expect(
      attachDatabase('tok', 'org-1', 'proj-1', { kind: 'turso', name: 'my-app-db', environmentId: 'env-1' }),
    ).resolves.toEqual(dbRow);

    const [url, init] = mockPlatformFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:9999/v1/server/projects/proj-1/databases');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ kind: 'turso', name: 'my-app-db', environmentId: 'env-1' });
  });

  it('throws a clear admin-role message on 403', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(403, { detail: 'Forbidden' }));

    const { attachDatabase } = await import('./platform-api.js');
    await expect(attachDatabase('tok', 'org-1', 'proj-1', { kind: 'turso', name: 'db' })).rejects.toThrow(
      'You need the admin role in this organization to manage databases.',
    );
  });

  it('surfaces the server detail on 409 env var collision', async () => {
    mockPlatformFetch.mockResolvedValue(
      jsonResponse(409, { detail: 'TURSO_DATABASE_URL is already set on this project' }),
    );

    const { attachDatabase } = await import('./platform-api.js');
    await expect(attachDatabase('tok', 'org-1', 'proj-1', { kind: 'turso', name: 'db' })).rejects.toThrow(
      'TURSO_DATABASE_URL is already set on this project',
    );
  });

  it('surfaces field-level validation errors on 400 (e.g. bad --region)', async () => {
    mockPlatformFetch.mockResolvedValue(
      jsonResponse(400, {
        detail: 'The request body contains invalid fields',
        errors: [{ field: 'regionId', message: 'Invalid option: expected one of "ams"|"arn"|"fra"' }],
      }),
    );

    const { attachDatabase } = await import('./platform-api.js');
    await expect(
      attachDatabase('tok', 'org-1', 'proj-1', { kind: 'turso', name: 'db', regionId: 'eu' }),
    ).rejects.toThrow(
      'The request body contains invalid fields: regionId — Invalid option: expected one of "ams"|"arn"|"fra"',
    );
  });

  it('leaves plain-detail 400s unchanged', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(400, { detail: 'Provider is unavailable' }));

    const { attachDatabase } = await import('./platform-api.js');
    await expect(attachDatabase('tok', 'org-1', 'proj-1', { kind: 'turso', name: 'db' })).rejects.toThrow(
      /^Provider is unavailable$/,
    );
  });
});

describe('deleteDatabase', () => {
  it('resolves on 204', async () => {
    mockPlatformFetch.mockResolvedValue({ ok: true, status: 204 } as unknown as Response);

    const { deleteDatabase } = await import('./platform-api.js');
    await expect(deleteDatabase('tok', 'org-1', 'proj-1', 'db-1')).resolves.toBeUndefined();

    const [url, init] = mockPlatformFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:9999/v1/server/projects/proj-1/databases/db-1');
    expect(init.method).toBe('DELETE');
  });

  it('throws a clear admin-role message on 403', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(403, { detail: 'Forbidden' }));

    const { deleteDatabase } = await import('./platform-api.js');
    await expect(deleteDatabase('tok', 'org-1', 'proj-1', 'db-1')).rejects.toThrow(
      'You need the admin role in this organization to manage databases.',
    );
  });
});

describe('fetchDatabaseConnection', () => {
  it('returns connection instructions', async () => {
    const connection = {
      envVars: [{ name: 'TURSO_DATABASE_URL', value: 'libsql://x', secret: false }],
      snippets: [],
      docsUrl: 'https://mastra.ai/docs',
    };
    mockPlatformFetch.mockResolvedValue(jsonResponse(200, connection));

    const { fetchDatabaseConnection } = await import('./platform-api.js');
    await expect(fetchDatabaseConnection('tok', 'org-1', 'proj-1', 'db-1')).resolves.toEqual(connection);
  });

  it('surfaces not-ready detail on 400', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(400, { detail: 'Database is not ready (status=provisioning)' }));

    const { fetchDatabaseConnection } = await import('./platform-api.js');
    await expect(fetchDatabaseConnection('tok', 'org-1', 'proj-1', 'db-1')).rejects.toThrow(
      'Database is not ready (status=provisioning)',
    );
  });
});

describe('pollDatabaseUntilReady', () => {
  it('resolves once the database becomes ready and reports status changes', async () => {
    mockPlatformFetch
      .mockResolvedValueOnce(jsonResponse(200, { database: dbRow }))
      .mockResolvedValueOnce(jsonResponse(200, { database: { ...dbRow, status: 'ready' } }));

    const onStatus = vi.fn();
    const { pollDatabaseUntilReady } = await import('./platform-api.js');
    const result = await pollDatabaseUntilReady('tok', 'org-1', 'proj-1', 'db-1', { intervalMs: 0, onStatus });

    expect(result.status).toBe('ready');
    expect(onStatus).toHaveBeenCalledWith('provisioning');
    expect(onStatus).toHaveBeenCalledWith('ready');
  });

  it('throws the provider error when provisioning fails', async () => {
    mockPlatformFetch.mockResolvedValue(
      jsonResponse(200, { database: { ...dbRow, status: 'failed', error: 'quota exceeded' } }),
    );

    const { pollDatabaseUntilReady } = await import('./platform-api.js');
    await expect(pollDatabaseUntilReady('tok', 'org-1', 'proj-1', 'db-1', { intervalMs: 0 })).rejects.toThrow(
      'Database provisioning failed: quota exceeded',
    );
  });

  it('throws a generic message when the failed row has no error detail', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(200, { database: { ...dbRow, status: 'failed' } }));

    const { pollDatabaseUntilReady } = await import('./platform-api.js');
    await expect(pollDatabaseUntilReady('tok', 'org-1', 'proj-1', 'db-1', { intervalMs: 0 })).rejects.toThrow(
      'Database provisioning failed (no error detail from provider)',
    );
  });

  it('times out with a pointer to mastra env db show', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(200, { database: dbRow }));

    const { pollDatabaseUntilReady } = await import('./platform-api.js');
    await expect(
      pollDatabaseUntilReady('tok', 'org-1', 'proj-1', 'db-1', { intervalMs: 0, maxWaitMs: 0 }),
    ).rejects.toThrow(
      'Timed out waiting for database to become ready (last status: provisioning). Check again with: mastra env db show db-1',
    );
  });

  it('does not swallow polling request errors', async () => {
    mockPlatformFetch.mockResolvedValue(jsonResponse(500, { detail: 'internal error' }));

    const { pollDatabaseUntilReady } = await import('./platform-api.js');
    await expect(pollDatabaseUntilReady('tok', 'org-1', 'proj-1', 'db-1', { intervalMs: 0 })).rejects.toThrow(
      'internal error',
    );
  });
});

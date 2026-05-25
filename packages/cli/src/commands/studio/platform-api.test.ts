import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGET = vi.fn();
const mockPOST = vi.fn();

vi.mock('../auth/client.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    MASTRA_PLATFORM_API_URL: 'http://localhost:9999',
    createApiClient: vi.fn(() => ({
      GET: mockGET,
      POST: mockPOST,
    })),
    authHeaders: vi.fn((token: string, orgId?: string) => {
      const h: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (orgId) h['x-organization-id'] = orgId;
      return h;
    }),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchProjects', () => {
  it('returns project list on success', async () => {
    const projects = [
      {
        id: 'p1',
        name: 'App 1',
        organizationId: 'org-1',
        latestDeployId: null,
        latestDeployStatus: null,
        instanceUrl: null,
        createdAt: null,
        updatedAt: null,
      },
    ];
    mockGET.mockResolvedValue({ data: { projects }, response: { status: 200 } });

    const { fetchProjects } = await import('./platform-api.js');
    const result = await fetchProjects('tok', 'org-1');

    expect(result).toEqual(projects);
    expect(mockGET).toHaveBeenCalledWith('/v1/studio/projects');
  });

  it('throws on error response with detail message', async () => {
    mockGET.mockResolvedValue({
      data: undefined,
      error: { detail: 'Not a member of the specified organization' },
      response: { status: 403 },
    });

    const { fetchProjects } = await import('./platform-api.js');
    await expect(fetchProjects('tok', 'org-1')).rejects.toThrow('Not a member of the specified organization');
  });

  it('throws session expired message on 401', async () => {
    mockGET.mockResolvedValue({ data: undefined, error: { detail: 'Invalid token' }, response: { status: 401 } });

    const { fetchProjects } = await import('./platform-api.js');
    await expect(fetchProjects('tok', 'org-1')).rejects.toThrow('Session expired. Run: mastra auth login');
  });
});

describe('createProject', () => {
  it('creates and returns a project', async () => {
    const project = { id: 'p1', name: 'New App', organizationId: 'org-1' };
    mockPOST.mockResolvedValue({ data: { project }, response: { status: 201 } });

    const { createProject } = await import('./platform-api.js');
    const result = await createProject('tok', 'org-1', 'New App');

    expect(result).toEqual(project);
    expect(mockPOST).toHaveBeenCalledWith('/v1/studio/projects', { body: { name: 'New App' } });
  });

  it('throws on error response', async () => {
    mockPOST.mockResolvedValue({
      data: undefined,
      error: { detail: 'Project name already exists' },
      response: { status: 409 },
    });

    const { createProject } = await import('./platform-api.js');
    await expect(createProject('tok', 'org-1', 'Dup')).rejects.toThrow('Project name already exists');
  });
});

describe('fetchDeployStatus', () => {
  it('returns deploy info on success', async () => {
    const deploy = { id: 'd1', status: 'running', instanceUrl: 'https://x.com', error: null };
    mockGET.mockResolvedValue({ data: { deploy }, response: { status: 200 } });

    const { fetchDeployStatus } = await import('./platform-api.js');
    const result = await fetchDeployStatus('d1', 'tok', 'org-1');

    expect(result).toEqual(deploy);
    expect(mockGET).toHaveBeenCalledWith('/v1/studio/deploys/{id}', {
      params: { path: { id: 'd1' } },
    });
  });

  it('throws on error response', async () => {
    mockGET.mockResolvedValue({ data: undefined, error: { error: 'not found' }, response: { status: 404 } });

    const { fetchDeployStatus } = await import('./platform-api.js');
    await expect(fetchDeployStatus('d1', 'tok')).rejects.toThrow('Failed to fetch deploy status: 404');
  });
});

describe('uploadDeploy', () => {
  it('creates deploy, uploads zip via signed URL, and confirms', async () => {
    const mockFetch = vi.fn();

    // createApiClient().POST for create deploy
    mockPOST
      .mockResolvedValueOnce({
        data: { deploy: { id: 'dep-1', status: 'starting', uploadUrl: 'https://storage.example.com/signed-url' } },
        response: { status: 202 },
      })
      // POST upload-complete
      .mockResolvedValueOnce({
        data: { status: 'ok' },
        response: { status: 200 },
      });

    // PUT to signed URL via global fetch
    mockFetch.mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const { uploadDeploy } = await import('./platform-api.js');
    const result = await uploadDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip-data'), {
      gitBranch: 'main',
      projectName: 'my-app',
      envVars: { FOO: 'bar' },
      disablePlatformObservability: true,
    });

    expect(result).toMatchObject({ id: 'dep-1', status: 'starting' });

    // createApiClient().POST called twice: create + upload-complete
    expect(mockPOST).toHaveBeenCalledTimes(2);
    expect(mockPOST).toHaveBeenCalledWith(
      '/v1/studio/deploys',
      expect.objectContaining({
        body: { envVars: { FOO: 'bar' }, disablePlatformObservability: true },
      }),
    );
    expect(mockPOST).toHaveBeenCalledWith('/v1/studio/deploys/{id}/upload-complete', {
      params: { path: { id: 'dep-1' } },
    });

    // fetch called once: PUT to signed URL
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]![0]).toBe('https://storage.example.com/signed-url');
    expect(mockFetch.mock.calls[0]![1].method).toBe('PUT');
  });

  it('omits disablePlatformObservability from deploy body when not provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }));
    mockPOST
      .mockResolvedValueOnce({
        data: { deploy: { id: 'dep-1', status: 'starting', uploadUrl: 'https://storage.example.com/signed-url' } },
        response: { status: 202 },
      })
      .mockResolvedValueOnce({
        data: { status: 'ok' },
        response: { status: 200 },
      });

    const { uploadDeploy } = await import('./platform-api.js');
    await uploadDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip-data'));

    expect(mockPOST).toHaveBeenCalledWith(
      '/v1/studio/deploys',
      expect.objectContaining({
        body: { envVars: undefined },
      }),
    );
    expect(mockPOST.mock.calls[0]![1].body).not.toHaveProperty('disablePlatformObservability');
  });

  it('throws when deploy creation fails', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { detail: 'Internal server error' },
      response: { status: 500 },
    });

    const { uploadDeploy } = await import('./platform-api.js');
    await expect(uploadDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip'))).rejects.toThrow('Internal server error');
  });

  it('throws when artifact upload fails', async () => {
    // Create deploy succeeds
    mockPOST
      .mockResolvedValueOnce({
        data: { deploy: { id: 'dep-1', status: 'starting', uploadUrl: 'https://storage.example.com/signed-url' } },
        response: { status: 202 },
      })
      // Cancel deploy (best-effort cleanup)
      .mockResolvedValueOnce({
        data: { id: 'dep-1', status: 'cancelled' },
        response: { status: 200 },
      });

    // Artifact upload fails
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' }));

    const { uploadDeploy } = await import('./platform-api.js');
    await expect(uploadDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip'))).rejects.toThrow(
      'Artifact upload failed: 403',
    );
  });
});

describe('pollDeploy', () => {
  it('retries transient polling failures up to 3 times', async () => {
    vi.useFakeTimers();

    const deploy = { id: 'd1', status: 'running', instanceUrl: 'https://x.com', error: null };
    const networkError = new TypeError('network request failed');
    Object.assign(networkError, { cause: { code: 'ECONNRESET' } });
    mockGET
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ data: { deploy }, response: { status: 200 } });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const { pollDeploy } = await import('./platform-api.js');
    const resultPromise = pollDeploy('d1', 'tok', 'org-1', 10000);

    await vi.advanceTimersByTimeAsync(3500);

    await expect(resultPromise).resolves.toEqual(deploy);
    expect(mockGET).toHaveBeenCalledTimes(4);
  });

  it('throws after exhausting transient polling retries', async () => {
    vi.useFakeTimers();

    const networkError = new TypeError('network request failed');
    Object.assign(networkError, { cause: { code: 'ECONNRESET' } });
    mockGET.mockRejectedValue(networkError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const { pollDeploy } = await import('./platform-api.js');
    const resultPromise = pollDeploy('d1', 'tok', 'org-1', 10000);
    const rejection = expect(resultPromise).rejects.toThrow('network request failed');

    await vi.advanceTimersByTimeAsync(3500);

    await rejection;
    expect(mockGET).toHaveBeenCalledTimes(4);
  });

  it('does not retry non-transient polling failures', async () => {
    vi.useFakeTimers();

    mockGET.mockRejectedValue(new Error('Invalid deploy payload'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const { pollDeploy } = await import('./platform-api.js');
    const resultPromise = pollDeploy('d1', 'tok', 'org-1', 10000);
    const rejection = expect(resultPromise).rejects.toThrow('Invalid deploy payload');

    await vi.advanceTimersByTimeAsync(100);

    await rejection;
    expect(mockGET).toHaveBeenCalledTimes(1);
  });
});

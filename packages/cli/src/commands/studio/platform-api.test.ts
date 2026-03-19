import { describe, expect, it, vi, beforeEach } from 'vitest';

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

    // POST /v1/studio/deploys → returns deploy with uploadUrl
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            deploy: { id: 'dep-1', status: 'starting', uploadUrl: 'https://storage.example.com/signed-url' },
          }),
      })
      // PUT to signed URL
      .mockResolvedValueOnce({ ok: true })
      // POST upload-complete
      .mockResolvedValueOnce({ ok: true });

    vi.stubGlobal('fetch', mockFetch);

    const { uploadDeploy } = await import('./platform-api.js');
    const result = await uploadDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip-data'), {
      gitBranch: 'main',
      projectName: 'my-app',
      envVars: { FOO: 'bar' },
    });

    expect(result).toMatchObject({ id: 'dep-1', status: 'starting' });

    // 3 fetch calls: create, upload, confirm
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // First call: POST /v1/studio/deploys
    const createCall = mockFetch.mock.calls[0]!;
    expect(createCall[0]).toBe('http://localhost:9999/v1/studio/deploys');
    expect(createCall[1].method).toBe('POST');

    // Second call: PUT to signed URL
    const uploadCall = mockFetch.mock.calls[1]!;
    expect(uploadCall[0]).toBe('https://storage.example.com/signed-url');
    expect(uploadCall[1].method).toBe('PUT');

    // Third call: POST upload-complete
    const completeCall = mockFetch.mock.calls[2]!;
    expect(completeCall[0]).toBe('http://localhost:9999/v1/studio/deploys/dep-1/upload-complete');
    expect(completeCall[1].method).toBe('POST');
  });

  it('throws when deploy creation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ detail: 'Internal server error' }),
      }),
    );

    const { uploadDeploy } = await import('./platform-api.js');
    await expect(uploadDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip'))).rejects.toThrow('Internal server error');
  });

  it('throws when artifact upload fails', async () => {
    const mockFetch = vi.fn();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            deploy: { id: 'dep-1', status: 'starting', uploadUrl: 'https://storage.example.com/signed-url' },
          }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });

    vi.stubGlobal('fetch', mockFetch);

    const { uploadDeploy } = await import('./platform-api.js');
    await expect(uploadDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip'))).rejects.toThrow(
      'Artifact upload failed: 403',
    );
  });
});

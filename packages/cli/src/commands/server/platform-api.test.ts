import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGET = vi.fn();
const mockPOST = vi.fn();
const mockPUT = vi.fn();

vi.mock('../auth/client.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    MASTRA_PLATFORM_API_URL: 'http://localhost:9999',
    createApiClient: vi.fn(() => ({
      GET: mockGET,
      POST: mockPOST,
      PUT: mockPUT,
    })),
  };
});

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn().mockResolvedValue('refreshed-token'),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchServerProjects', () => {
  it('returns projects on success', async () => {
    const projects = [{ id: 'p1', name: 'S1', slug: 's1', organizationId: 'org-1' } as const];
    mockGET.mockResolvedValue({ data: { projects }, error: undefined, response: { status: 200 } });

    const { fetchServerProjects } = await import('./platform-api.js');
    await expect(fetchServerProjects('tok', 'org-1')).resolves.toEqual(projects);
    expect(mockGET).toHaveBeenCalledWith('/v1/server/projects');
  });

  it('throws session expired on 401', async () => {
    mockGET.mockResolvedValue({ data: undefined, error: { detail: 'nope' }, response: { status: 401 } });

    const { fetchServerProjects } = await import('./platform-api.js');
    await expect(fetchServerProjects('tok', 'org-1')).rejects.toThrow('Session expired. Run: mastra auth login');
  });
});

describe('createServerProject', () => {
  it('returns project on success', async () => {
    const project = { id: 'p1', name: 'New', slug: 'new', organizationId: 'org-1' };
    mockPOST.mockResolvedValue({ data: { project }, error: undefined, response: { status: 200 } });

    const { createServerProject } = await import('./platform-api.js');
    await expect(createServerProject('tok', 'org-1', 'New')).resolves.toEqual(project);
    expect(mockPOST).toHaveBeenCalledWith('/v1/server/projects', { body: { name: 'New' } });
  });
});

describe('fetchServerDeployStatus', () => {
  it('returns deploy data', async () => {
    const data = { id: 'd1', status: 'running', instanceUrl: 'https://x', error: null };
    mockGET.mockResolvedValue({ data, error: undefined, response: { status: 200 } });

    const { fetchServerDeployStatus } = await import('./platform-api.js');
    await expect(fetchServerDeployStatus('d1', 'tok', 'org-1')).resolves.toEqual(data);
    expect(mockGET).toHaveBeenCalledWith('/v1/server/deploys/{id}', { params: { path: { id: 'd1' } } });
  });
});

describe('getServerProjectEnv / updateServerProjectEnv', () => {
  it('getServerProjectEnv returns envVars', async () => {
    mockGET.mockResolvedValue({
      data: { envVars: { A: '1' } },
      error: undefined,
      response: { status: 200 },
    });

    const { getServerProjectEnv } = await import('./platform-api.js');
    await expect(getServerProjectEnv('tok', 'org-1', 'proj-1')).resolves.toEqual({ A: '1' });
    expect(mockGET).toHaveBeenCalledWith('/v1/server/projects/{id}/env', {
      params: { path: { id: 'proj-1' } },
    });
  });

  it('updateServerProjectEnv PUTs body', async () => {
    mockPUT.mockResolvedValue({ error: undefined, response: { status: 200 } });

    const { updateServerProjectEnv } = await import('./platform-api.js');
    await updateServerProjectEnv('tok', 'org-1', 'proj-1', { X: 'y' });
    expect(mockPUT).toHaveBeenCalledWith('/v1/server/projects/{id}/env', {
      params: { path: { id: 'proj-1' } },
      body: { envVars: { X: 'y' } },
    });
  });
});

describe('fetchServerProjectDetail', () => {
  it('returns project payload', async () => {
    const payload = {
      project: { latestDeployId: 'd1', id: 'proj-1', name: 'N', slug: 'n', organizationId: 'org-1' },
      deploys: [],
    };
    mockGET.mockResolvedValue({ data: payload, error: undefined, response: { status: 200 } });

    const { fetchServerProjectDetail } = await import('./platform-api.js');
    await expect(fetchServerProjectDetail('tok', 'org-1', 'proj-1')).resolves.toEqual(payload);
  });
});

describe('pauseServerProject', () => {
  it('resolves on success', async () => {
    mockPOST.mockResolvedValue({ error: undefined, response: { status: 200 } });

    const { pauseServerProject } = await import('./platform-api.js');
    await expect(pauseServerProject('tok', 'org-1', 'proj-1')).resolves.toBeUndefined();
    expect(mockPOST).toHaveBeenCalledWith('/v1/server/projects/{id}/pause', {
      params: { path: { id: 'proj-1' } },
    });
  });

  it('prefers API detail on 409 when present', async () => {
    mockPOST.mockResolvedValue({
      data: undefined,
      error: { detail: 'Instance is busy' },
      response: { status: 409 },
    });

    const { pauseServerProject } = await import('./platform-api.js');
    await expect(pauseServerProject('tok', 'org-1', 'proj-1')).rejects.toThrow('Instance is busy');
  });

  it('uses default pause message on 409 when API omits detail', async () => {
    mockPOST.mockResolvedValue({
      data: undefined,
      error: {},
      response: { status: 409 },
    });

    const { pauseServerProject } = await import('./platform-api.js');
    await expect(pauseServerProject('tok', 'org-1', 'proj-1')).rejects.toThrow(
      'Pause failed: the server is not running.',
    );
  });
});

describe('restartServerProject', () => {
  it('returns id from restart response body', async () => {
    mockGET.mockImplementation(async () => {
      return {
        data: {
          project: { latestDeployId: 'old', id: 'proj-1', name: 'N', slug: 'n', organizationId: 'org-1' },
          deploys: [],
        },
        error: undefined,
        response: { status: 200 },
      };
    });
    mockPOST.mockResolvedValue({
      data: { id: 'dep-from-body' },
      error: undefined,
      response: { status: 200 },
    });

    const { restartServerProject } = await import('./platform-api.js');
    await expect(restartServerProject('tok', 'org-1', 'proj-1')).resolves.toBe('dep-from-body');
  });

  it('polls project until latestDeployId changes when body has no id', async () => {
    let n = 0;
    mockGET.mockImplementation(async () => {
      n++;
      const latest = n >= 3 ? 'dep-new' : 'dep-old';
      return {
        data: {
          project: {
            latestDeployId: latest,
            id: 'proj-1',
            name: 'N',
            slug: 'n',
            organizationId: 'org-1',
          },
          deploys: [],
        },
        error: undefined,
        response: { status: 200 },
      };
    });
    mockPOST.mockResolvedValue({ data: {}, error: undefined, response: { status: 200 } });

    vi.useFakeTimers();
    const { restartServerProject } = await import('./platform-api.js');
    const p = restartServerProject('tok', 'org-1', 'proj-1');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe('dep-new');
    vi.useRealTimers();
  });

  it('prefers API detail on restart 409 when present', async () => {
    mockGET.mockResolvedValue({
      data: {
        project: { latestDeployId: null, id: 'p1', name: 'N', slug: 'n', organizationId: 'org-1' },
        deploys: [],
      },
      error: undefined,
      response: { status: 200 },
    });
    mockPOST.mockResolvedValue({
      data: undefined,
      error: { detail: 'Deploy already in progress' },
      response: { status: 409 },
    });

    const { restartServerProject } = await import('./platform-api.js');
    await expect(restartServerProject('tok', 'org-1', 'proj-1')).rejects.toThrow('Deploy already in progress');
  });

  it('uses default restart message on 409 when API omits detail', async () => {
    mockGET.mockResolvedValue({
      data: {
        project: { latestDeployId: null, id: 'p1', name: 'N', slug: 'n', organizationId: 'org-1' },
        deploys: [],
      },
      error: undefined,
      response: { status: 200 },
    });
    mockPOST.mockResolvedValue({
      data: undefined,
      error: {},
      response: { status: 409 },
    });

    const { restartServerProject } = await import('./platform-api.js');
    await expect(restartServerProject('tok', 'org-1', 'proj-1')).rejects.toThrow(
      'Restart failed: a deployment for this project is currently active. Run `mastra server pause` to pause the server before restarting.',
    );
  });

  it('returns existing latestDeployId when restart omits id but deploy status is active', async () => {
    mockGET.mockImplementation(async (path: string) => {
      const p = String(path);
      if (p.includes('/deploys/') && !p.includes('/logs')) {
        return {
          data: { id: 'dep-same', status: 'queued', instanceUrl: null, error: null },
          error: undefined,
          response: { status: 200 },
        };
      }
      return {
        data: {
          project: {
            latestDeployId: 'dep-same',
            id: 'proj-1',
            name: 'N',
            slug: 'n',
            organizationId: 'org-1',
          },
          deploys: [],
        },
        error: undefined,
        response: { status: 200 },
      };
    });
    mockPOST.mockResolvedValue({ data: {}, error: undefined, response: { status: 200 } });

    const { restartServerProject } = await import('./platform-api.js');
    await expect(restartServerProject('tok', 'org-1', 'proj-1')).resolves.toBe('dep-same');
  });

  it('returns same deploy id when API reports unknown status (in-progress family)', async () => {
    mockGET.mockImplementation(async (path: string) => {
      const p = String(path);
      if (p.includes('/deploys/') && !p.includes('/logs')) {
        return {
          data: { id: 'dep-same', status: 'unknown', instanceUrl: null, error: null },
          error: undefined,
          response: { status: 200 },
        };
      }
      return {
        data: {
          project: {
            latestDeployId: 'dep-same',
            id: 'proj-1',
            name: 'N',
            slug: 'n',
            organizationId: 'org-1',
          },
          deploys: [],
        },
        error: undefined,
        response: { status: 200 },
      };
    });
    mockPOST.mockResolvedValue({ data: {}, error: undefined, response: { status: 200 } });

    const { restartServerProject } = await import('./platform-api.js');
    await expect(restartServerProject('tok', 'org-1', 'proj-1')).resolves.toBe('dep-same');
  });

  it('tolerates 404 on deploy status until the record exists', async () => {
    let deployPolls = 0;
    mockGET.mockImplementation(async (path: string) => {
      const p = String(path);
      if (p.includes('/deploys/') && !p.includes('/logs')) {
        deployPolls++;
        if (deployPolls < 3) {
          return {
            data: undefined,
            error: { detail: 'Not found' },
            response: { status: 404 },
          };
        }
        return {
          data: { id: 'dep-same', status: 'queued', instanceUrl: null, error: null },
          error: undefined,
          response: { status: 200 },
        };
      }
      return {
        data: {
          project: {
            latestDeployId: 'dep-same',
            id: 'proj-1',
            name: 'N',
            slug: 'n',
            organizationId: 'org-1',
          },
          deploys: [],
        },
        error: undefined,
        response: { status: 200 },
      };
    });
    mockPOST.mockResolvedValue({ data: {}, error: undefined, response: { status: 200 } });

    vi.useFakeTimers();
    try {
      const { restartServerProject } = await import('./platform-api.js');
      const pr = restartServerProject('tok', 'org-1', 'proj-1');
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(pr).resolves.toBe('dep-same');
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates non-404 errors from deploy status polling', async () => {
    mockGET.mockImplementation(async (path: string) => {
      const p = String(path);
      if (p.includes('/deploys/') && !p.includes('/logs')) {
        return {
          data: undefined,
          error: { detail: 'Bad gateway' },
          response: { status: 502 },
        };
      }
      return {
        data: {
          project: {
            latestDeployId: 'dep-same',
            id: 'proj-1',
            name: 'N',
            slug: 'n',
            organizationId: 'org-1',
          },
          deploys: [],
        },
        error: undefined,
        response: { status: 200 },
      };
    });
    mockPOST.mockResolvedValue({ data: {}, error: undefined, response: { status: 200 } });

    const { restartServerProject } = await import('./platform-api.js');
    await expect(restartServerProject('tok', 'org-1', 'proj-1')).rejects.toThrow('Bad gateway');
  });

  it('keeps polling when same deploy id stays stopped until deadline', async () => {
    mockGET.mockImplementation(async (path: string) => {
      const p = String(path);
      if (p.includes('/deploys/') && !p.includes('/logs')) {
        return {
          data: { id: 'dep-same', status: 'stopped', instanceUrl: null, error: null },
          error: undefined,
          response: { status: 200 },
        };
      }
      return {
        data: {
          project: {
            latestDeployId: 'dep-same',
            id: 'proj-1',
            name: 'N',
            slug: 'n',
            organizationId: 'org-1',
          },
          deploys: [],
        },
        error: undefined,
        response: { status: 200 },
      };
    });
    mockPOST.mockResolvedValue({ data: {}, error: undefined, response: { status: 200 } });

    vi.useFakeTimers();
    try {
      const { restartServerProject } = await import('./platform-api.js');
      const p = restartServerProject('tok', 'org-1', 'proj-1');
      const rejection = expect(p).rejects.toThrow('no deploy ID could be resolved');
      await vi.advanceTimersByTimeAsync(50_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pollServerDeploy', () => {
  it('returns when status is running', async () => {
    let deployStatusCalls = 0;
    mockGET.mockImplementation(async (path: string) => {
      if (String(path).includes('/logs')) {
        return {
          data: { buildLogs: [], deployLogs: [] },
          error: undefined,
          response: { status: 200 },
        };
      }
      deployStatusCalls++;
      return {
        data: {
          id: 'd1',
          status: deployStatusCalls >= 2 ? 'running' : 'building',
          instanceUrl: 'https://app.example',
          error: null,
        },
        error: undefined,
        response: { status: 200 },
      };
    });

    vi.useFakeTimers();
    const { pollServerDeploy } = await import('./platform-api.js');
    const pollPromise = pollServerDeploy('d1', 'tok', 'org-1', 60_000);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await pollPromise;
    vi.useRealTimers();

    expect(result.status).toBe('running');
    expect(result.instanceUrl).toBe('https://app.example');
  });

  it('retries transient polling failures up to 3 times', async () => {
    vi.useFakeTimers();

    const deploy = { id: 'd1', status: 'running' };
    let deployFailuresRemaining = 3;
    const networkError = new TypeError('network request failed');
    Object.assign(networkError, { cause: { code: 'ECONNRESET' } });

    mockGET.mockImplementation((path: string) => {
      if (path === '/v1/server/deploys/{id}/logs') {
        return Promise.resolve({
          data: { buildLogs: [], deployLogs: [] },
          response: { status: 200 },
        });
      }

      if (path === '/v1/server/deploys/{id}') {
        if (deployFailuresRemaining > 0) {
          deployFailuresRemaining -= 1;
          return Promise.reject(networkError);
        }

        return Promise.resolve({
          data: deploy,
          response: { status: 200 },
        });
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const { pollServerDeploy } = await import('./platform-api.js');
    const resultPromise = pollServerDeploy('d1', 'tok', 'org-1', 10000);

    await vi.advanceTimersByTimeAsync(3500);

    await expect(resultPromise).resolves.toEqual(deploy);

    const statusCalls = mockGET.mock.calls.filter(([path]) => path === '/v1/server/deploys/{id}');
    expect(statusCalls).toHaveLength(4);
  });

  it('throws after exhausting transient polling retries', async () => {
    vi.useFakeTimers();

    const networkError = new TypeError('network request failed');
    Object.assign(networkError, { cause: { code: 'ECONNRESET' } });

    mockGET.mockImplementation((path: string) => {
      if (path === '/v1/server/deploys/{id}/logs') {
        return Promise.resolve({
          data: { buildLogs: [], deployLogs: [] },
          response: { status: 200 },
        });
      }

      if (path === '/v1/server/deploys/{id}') {
        return Promise.reject(networkError);
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const { pollServerDeploy } = await import('./platform-api.js');
    const resultPromise = pollServerDeploy('d1', 'tok', 'org-1', 10000);
    const rejection = expect(resultPromise).rejects.toThrow('network request failed');

    await vi.advanceTimersByTimeAsync(3500);

    await rejection;

    const statusCalls = mockGET.mock.calls.filter(([path]) => path === '/v1/server/deploys/{id}');
    expect(statusCalls).toHaveLength(4);
  });

  it('does not retry non-transient polling failures', async () => {
    vi.useFakeTimers();

    mockGET.mockImplementation((path: string) => {
      if (path === '/v1/server/deploys/{id}/logs') {
        return Promise.resolve({
          data: { buildLogs: [], deployLogs: [] },
          response: { status: 200 },
        });
      }

      if (path === '/v1/server/deploys/{id}') {
        return Promise.reject(new Error('Invalid deploy payload'));
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const { pollServerDeploy } = await import('./platform-api.js');
    const resultPromise = pollServerDeploy('d1', 'tok', 'org-1', 10000);
    const rejection = expect(resultPromise).rejects.toThrow('Invalid deploy payload');

    await vi.advanceTimersByTimeAsync(100);

    await rejection;

    const statusCalls = mockGET.mock.calls.filter(([path]) => path === '/v1/server/deploys/{id}');
    expect(statusCalls).toHaveLength(1);
  });
});

describe('uploadServerDeploy', () => {
  it('throws platform detail on 402 from deploy create', async () => {
    mockPOST.mockResolvedValue({
      data: undefined,
      error: { detail: 'Billing required to deploy servers', type: 'problem', title: 'Payment', status: 402 },
      response: { status: 402 },
    });

    const { uploadServerDeploy } = await import('./platform-api.js');
    await expect(uploadServerDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip'))).rejects.toThrow(
      'Billing required to deploy servers',
    );
  });

  it('uploads zip and confirms', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    mockPOST
      .mockResolvedValueOnce({
        data: { id: 'dep-1', uploadUrl: 'https://signed.example/put', status: 'queued' },
        error: undefined,
        response: { status: 202 },
      })
      .mockResolvedValueOnce({ error: undefined, response: { status: 200 } });

    const { uploadServerDeploy } = await import('./platform-api.js');
    const result = await uploadServerDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip'), {
      projectName: 'my-app',
      envVars: { FOO: 'bar' },
      disablePlatformObservability: true,
    });

    expect(result).toEqual({ id: 'dep-1', status: 'queued' });
    expect(mockPOST).toHaveBeenCalledWith('/v1/server/deploys', {
      body: {
        projectId: 'proj-1',
        projectName: 'my-app',
        envVars: { FOO: 'bar' },
        disablePlatformObservability: true,
      },
    });
    expect(mockFetch).toHaveBeenCalledWith('https://signed.example/put', expect.objectContaining({ method: 'PUT' }));
  });

  it('omits disablePlatformObservability from deploy body when not provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    mockPOST
      .mockResolvedValueOnce({
        data: { id: 'dep-1', uploadUrl: 'https://signed.example/put', status: 'queued' },
        error: undefined,
        response: { status: 202 },
      })
      .mockResolvedValueOnce({ error: undefined, response: { status: 200 } });

    const { uploadServerDeploy } = await import('./platform-api.js');
    await uploadServerDeploy('tok', 'org-1', 'proj-1', Buffer.from('zip'));

    expect(mockPOST).toHaveBeenCalledWith('/v1/server/deploys', {
      body: {
        projectId: 'proj-1',
        projectName: undefined,
        envVars: undefined,
      },
    });
    expect(mockPOST.mock.calls[0]![1].body).not.toHaveProperty('disablePlatformObservability');
  });
});

import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn(),
}));

vi.mock('../auth/orgs.js', () => ({
  resolveCurrentOrg: vi.fn(),
}));

vi.mock('../auth/client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'https://platform.test',
  platformFetch: vi.fn(),
  authHeaders: (token: string, orgId?: string) => ({
    Authorization: `Bearer ${token}`,
    ...(orgId ? { 'X-Mastra-Organization-Id': orgId } : {}),
  }),
}));

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
  isCancel: (v: unknown) => typeof v === 'symbol',
}));

const { provisionObserveProject } = await import('./observe-provision');
const { getToken } = await import('../auth/credentials.js');
const { resolveCurrentOrg } = await import('../auth/orgs.js');
const { platformFetch } = await import('../auth/client.js');
const prompts = await import('@clack/prompts');

const getTokenMock = vi.mocked(getToken);
const resolveCurrentOrgMock = vi.mocked(resolveCurrentOrg);
const platformFetchMock = vi.mocked(platformFetch);
const selectMock = vi.mocked(prompts.select);
const textMock = vi.mocked(prompts.text);

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('provisionObserveProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTokenMock.mockResolvedValue('test-token');
    resolveCurrentOrgMock.mockResolvedValue({ orgId: 'org_test', orgName: 'Test Org' });
  });

  test('creates a new project when the org has none, defaulting to package name', async () => {
    platformFetchMock
      .mockResolvedValueOnce(jsonResponse({ projects: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          project: { id: 'p1', slug: 'my-app', name: 'my-app', organizationId: 'org_test' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          token: { id: 'k1', name: 'mastra observe – my-app' },
          secret: 'sk_secret_value',
        }),
      );

    textMock.mockResolvedValueOnce('my-app' as never);

    const result = await provisionObserveProject({ defaultProjectName: 'my-app' });

    expect(result).toEqual({
      token: 'sk_secret_value',
      projectId: 'p1',
      projectSlug: 'my-app',
      projectName: 'my-app',
      orgName: 'Test Org',
      // Non-default platform URL → tracesEndpoint is derived.
      tracesEndpoint: 'https://platform.test/projects/p1/ai/spans/publish',
    });

    // No select prompt when project list is empty.
    expect(selectMock).not.toHaveBeenCalled();

    // Verify the 3 HTTP calls hit the new endpoints.
    expect(platformFetchMock).toHaveBeenNthCalledWith(
      1,
      'https://platform.test/v1/studio/projects',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
    expect(platformFetchMock).toHaveBeenNthCalledWith(
      2,
      'https://platform.test/v1/studio/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'my-app', studioEnabled: false, serverEnabled: false }),
      }),
    );
    expect(platformFetchMock).toHaveBeenNthCalledWith(
      3,
      'https://platform.test/v1/auth/tokens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'mastra observe – my-app' }),
      }),
    );
  });

  test('lets the user pick an existing project', async () => {
    platformFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          projects: [
            { id: 'p1', slug: 'alpha', name: 'Alpha', organizationId: 'org_test' },
            { id: 'p2', slug: 'beta', name: 'Beta', organizationId: 'org_test' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          token: { id: 'k1', name: 'mastra observe – Beta' },
          secret: 'sk_beta',
        }),
      );

    selectMock.mockResolvedValueOnce('p2' as never);

    const result = await provisionObserveProject();

    expect(result.projectSlug).toBe('beta');
    expect(result.projectName).toBe('Beta');
    expect(result.projectId).toBe('p2');
    expect(result.token).toBe('sk_beta');

    // No project creation call should have been made.
    expect(platformFetchMock).toHaveBeenCalledTimes(2);
    expect(platformFetchMock).toHaveBeenNthCalledWith(
      2,
      'https://platform.test/v1/auth/tokens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'mastra observe – Beta' }),
      }),
    );
  });

  test('creates a new project when the user picks "+ Create new project"', async () => {
    platformFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          projects: [{ id: 'p1', slug: 'alpha', name: 'Alpha', organizationId: 'org_test' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          project: { id: 'p2', slug: 'gamma', name: 'Gamma', organizationId: 'org_test' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          token: { id: 'k1', name: 'mastra observe – Gamma' },
          secret: 'sk_gamma',
        }),
      );

    selectMock.mockResolvedValueOnce('__new__' as never);
    textMock.mockResolvedValueOnce('Gamma' as never);

    const result = await provisionObserveProject();

    expect(result.projectSlug).toBe('gamma');
    expect(result.projectId).toBe('p2');
    expect(result.token).toBe('sk_gamma');
    expect(platformFetchMock).toHaveBeenCalledTimes(3);
  });

  test('throws when the list projects call fails', async () => {
    platformFetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, { status: 500 }));

    await expect(provisionObserveProject()).rejects.toThrow(/Failed to list projects \(500\)/);
  });

  test('throws when the access token mint fails', async () => {
    platformFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          projects: [{ id: 'p1', slug: 'alpha', name: 'Alpha', organizationId: 'org_test' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'nope' }, { status: 403 }));

    selectMock.mockResolvedValueOnce('p1' as never);

    await expect(provisionObserveProject()).rejects.toThrow(/Failed to create access token \(403\)/);
  });

  test('throws when the user cancels the project picker', async () => {
    platformFetchMock.mockResolvedValueOnce(
      jsonResponse({
        projects: [{ id: 'p1', slug: 'alpha', name: 'Alpha', organizationId: 'org_test' }],
      }),
    );

    selectMock.mockResolvedValueOnce(Symbol('cancel') as never);

    await expect(provisionObserveProject()).rejects.toThrow(/Cancelled/);
  });

  test('propagates errors from getToken (login gate)', async () => {
    getTokenMock.mockRejectedValueOnce(new Error('Not logged in'));

    await expect(provisionObserveProject()).rejects.toThrow(/Not logged in/);
    expect(platformFetchMock).not.toHaveBeenCalled();
  });

  test('observeProject matches an existing project by name and skips the picker', async () => {
    platformFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          projects: [
            { id: 'p1', slug: 'alpha', name: 'Alpha', organizationId: 'org_test' },
            { id: 'p2', slug: 'beta', name: 'Beta', organizationId: 'org_test' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          token: { id: 'k1', name: 'mastra observe – Beta' },
          secret: 'sk_beta',
        }),
      );

    const result = await provisionObserveProject({ observeProject: 'Beta' });

    expect(result.projectId).toBe('p2');
    expect(result.token).toBe('sk_beta');
    expect(selectMock).not.toHaveBeenCalled();
    expect(textMock).not.toHaveBeenCalled();
    expect(platformFetchMock).toHaveBeenCalledTimes(2);
  });

  test('observeProject matches an existing project by slug', async () => {
    platformFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          projects: [{ id: 'p1', slug: 'alpha', name: 'Alpha', organizationId: 'org_test' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ token: { id: 'k1', name: 'mastra observe – Alpha' }, secret: 'sk_a' }));

    const result = await provisionObserveProject({ observeProject: 'alpha' });

    expect(result.projectId).toBe('p1');
    expect(platformFetchMock).toHaveBeenCalledTimes(2);
  });

  test('observeProject creates a new project when name does not match', async () => {
    platformFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          projects: [{ id: 'p1', slug: 'alpha', name: 'Alpha', organizationId: 'org_test' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          project: { id: 'p9', slug: 'fresh-app', name: 'fresh-app', organizationId: 'org_test' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ token: { id: 'k1', name: 'mastra observe – fresh-app' }, secret: 'sk_f' }));

    const result = await provisionObserveProject({ observeProject: 'fresh-app' });

    expect(result.projectId).toBe('p9');
    expect(result.token).toBe('sk_f');
    expect(selectMock).not.toHaveBeenCalled();
    expect(textMock).not.toHaveBeenCalled();
    expect(platformFetchMock).toHaveBeenNthCalledWith(
      2,
      'https://platform.test/v1/studio/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'fresh-app', studioEnabled: false, serverEnabled: false }),
      }),
    );
  });

  test('mode "create" provisions a new project named after the local one without prompting', async () => {
    platformFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          project: { id: 'p1', slug: 'my-app', name: 'my-app', organizationId: 'org_test' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ token: { id: 'k1', name: 'mastra observe – my-app' }, secret: 'sk_my_app' }),
      );

    const result = await provisionObserveProject({ defaultProjectName: 'my-app', mode: 'create' });

    expect(result.projectId).toBe('p1');
    expect(result.projectName).toBe('my-app');
    expect(result.token).toBe('sk_my_app');

    // No picker, no name re-prompt, no list call.
    expect(selectMock).not.toHaveBeenCalled();
    expect(textMock).not.toHaveBeenCalled();
    expect(platformFetchMock).toHaveBeenCalledTimes(2);
    expect(platformFetchMock).toHaveBeenNthCalledWith(
      1,
      'https://platform.test/v1/studio/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'my-app', studioEnabled: false, serverEnabled: false }),
      }),
    );
  });

  test('mode "create" throws when defaultProjectName is missing', async () => {
    await expect(provisionObserveProject({ mode: 'create' })).rejects.toThrow(/defaultProjectName is required/);
    expect(platformFetchMock).not.toHaveBeenCalled();
  });
});

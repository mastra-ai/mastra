import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addConnectionToProject,
  createProjectConnectSession,
  fetchIntegrationCatalog,
  fetchOrgConnections,
  fetchProjectConnections,
  getIntegrationsApiUrl,
  removeProjectConnection,
  updateConnectionDisplayName,
} from './api.js';

describe('getIntegrationsApiUrl', () => {
  const originalEnv = process.env.MASTRA_INTEGRATIONS_API_URL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.MASTRA_INTEGRATIONS_API_URL;
    else process.env.MASTRA_INTEGRATIONS_API_URL = originalEnv;
  });

  it('defaults to the production integrations service', () => {
    delete process.env.MASTRA_INTEGRATIONS_API_URL;
    expect(getIntegrationsApiUrl()).toBe('https://integrations.mastra.ai');
  });

  it('honors MASTRA_INTEGRATIONS_API_URL and strips trailing slashes', () => {
    process.env.MASTRA_INTEGRATIONS_API_URL = 'http://localhost:8787///';
    expect(getIntegrationsApiUrl()).toBe('http://localhost:8787');
  });
});

describe('integrations API calls', () => {
  beforeEach(() => {
    process.env.MASTRA_INTEGRATIONS_API_URL = 'https://integrations.test';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    delete process.env.MASTRA_INTEGRATIONS_API_URL;
    vi.unstubAllGlobals();
  });

  it('fetches the catalog with bearer + org headers', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ integrations: [{ id: 'linear' }] })));
    const integrations = await fetchIntegrationCatalog('tok', 'org_1');
    expect(integrations).toEqual([{ id: 'linear' }]);
    expect(fetch).toHaveBeenCalledWith('https://integrations.test/v2/integrations', {
      headers: { Authorization: 'Bearer tok', 'x-organization-id': 'org_1' },
    });
  });

  it('fetches project connections', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ connections: [] })));
    await fetchProjectConnections('tok', 'org_1', 'proj_1');
    expect(fetch).toHaveBeenCalledWith(
      'https://integrations.test/v2/projects/proj_1/connections',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('creates a project-scoped connect session', async () => {
    const session = {
      connectionId: 'con_1',
      integrationId: 'linear',
      connectUrl: 'https://connect.nango.dev/x',
      sessionToken: 'st',
      expiresAt: new Date().toISOString(),
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(session), { status: 201 }));
    await expect(createProjectConnectSession('tok', 'org_1', 'proj_1', 'linear')).resolves.toEqual(session);
    expect(fetch).toHaveBeenCalledWith(
      'https://integrations.test/v2/projects/proj_1/integrations/linear/connect-sessions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches org connections filtered by provider', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ connections: [{ id: 'con_1' }] })));
    await expect(fetchOrgConnections('tok', 'org_1', 'linear')).resolves.toEqual([{ id: 'con_1' }]);
    expect(fetch).toHaveBeenCalledWith(
      'https://integrations.test/v2/connections?providerKey=linear',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-organization-id': 'org_1' }) }),
    );
  });

  it('attaches an existing connection to a project', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await addConnectionToProject('tok', 'org_1', 'proj_1', 'con_1');
    expect(fetch).toHaveBeenCalledWith(
      'https://integrations.test/v2/projects/proj_1/connections/con_1',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('renames a connection', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'con_1' })));
    await updateConnectionDisplayName('tok', 'org_1', 'con_1', 'Prod Linear');
    expect(fetch).toHaveBeenCalledWith(
      'https://integrations.test/v2/connections/con_1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ displayName: 'Prod Linear' }) }),
    );
  });

  it('removes a project connection', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await removeProjectConnection('tok', 'org_1', 'proj_1', 'con_1');
    expect(fetch).toHaveBeenCalledWith(
      'https://integrations.test/v2/projects/proj_1/connections/con_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('surfaces RFC 7807 detail from error responses', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: 'Project not found' }), { status: 404 }));
    await expect(fetchProjectConnections('tok', 'org_1', 'missing')).rejects.toThrow('Project not found');
  });
});

import { afterAll, expect, it, vi } from 'vitest';
import { tools } from '@mastra/connect';

vi.stubEnv('MASTRA_PROJECT_ID', 'project-1');
vi.stubEnv('MASTRA_ORG_ID', '');
const payload = Buffer.from('{"teamId":"org-1","projectId":"project-1"}').toString('base64url');
vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', `test.${payload}.signature`);
const { createListConnectionsTool } = await import('../src/mastra/tools/list-connections');
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('reads live setup, refreshes tools, and distinguishes unavailable state without exposing credentials', async () => {
  const provider = {
    id: 'new-mcp',
    displayName: 'New service',
    authType: 'API_KEY',
    authFields: [],
    surfaces: ['tools'],
    capabilities: { mcp: true, proxy: false, webhooks: false },
    comingSoon: true,
  };
  const connections = [{ id: 'hidden', integrationId: 'hidden', status: 'needs_reauth', credentials: 'private' }];
  const fetchMock = vi.fn(async (url: URL) =>
    Response.json(url.pathname === '/v2/integrations' ? { integrations: [provider] } : { connections }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const resolver = tools({ projectId: 'project-1', client: { accessToken: 'test', fetch: fetchMock } });
  const refresh = vi.spyOn(resolver, 'refresh');
  const tool = createListConnectionsTool(resolver, () => undefined);
  const result = await tool.execute?.({ refresh: true }, {});
  expect(result?.project.links?.connections).toBe(
    'https://projects.mastra.ai/orgs/org-1/projects/project-1/settings/connect',
  );
  expect(result?.catalog).toMatchObject({ data: [{ ...provider, supported: { tools: true, channels: false } }] });
  expect(result?.connections).toMatchObject({ data: [{ integrationId: 'hidden', status: 'needs_reauth' }] });
  expect(refresh).toHaveBeenCalledOnce();
  expect(JSON.stringify(result)).not.toMatch(/private|signature|Bearer/);
  fetchMock.mockResolvedValue(new Response('private response', { status: 403 }));
  expect((await tool.execute?.({ refresh: false }, {}))?.catalog).toMatchObject({ status: 'unavailable' });
  const unconfigured = createListConnectionsTool(undefined, () => undefined);
  expect(await unconfigured.execute?.({ refresh: false }, {})).toMatchObject({ configured: false });
  vi.stubEnv('MASTRA_PROJECT_ID', 'wrong-project');
  expect((await unconfigured.execute?.({ refresh: false }, {}))?.project.links).toBeNull();
  await resolver.disconnect();
});

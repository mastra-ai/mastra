import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { PROVIDERS } from '../index.js';
import { createPlatformProxy } from '../runtime/platform-proxy.js';

describe('Neon deletion HTTP contracts', () => {
  it.each([
    ['neon_delete_database', { project_id: 'project', branch_id: 'branch', database_name: 'db' }],
    ['neon_delete_endpoint', { project_id: 'project', endpoint_id: 'endpoint' }],
    ['neon_delete_role', { project_id: 'project', branch_id: 'branch', role_name: 'reader' }],
  ] as const)('%s accepts HTTP 204 without weakening HTTP 200 validation', async (name, input) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const provider = PROVIDERS.find(p => p.integrationId === 'neon')!;
    const tools = provider.createTools({
      connectionId: 'connection',
      client: { baseUrl: 'https://platform.example.test', accessToken: 'token', fetch: fetchMock },
    });
    await expect(tools[name]!.execute!(input, { requestContext: new RequestContext() })).resolves.toEqual({
      deleted: true,
      already_absent: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValue(Response.json(null));
    await expect(tools[name]!.execute!(input, { requestContext: new RequestContext() })).rejects.toThrow();
  });
  it('preserves successful status and response headers in the template adapter', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ operations: [] }, { status: 202, headers: { 'x-request-id': 'request' } }));
    const proxy = createPlatformProxy({
      connectionId: 'connection',
      client: { baseUrl: 'https://platform.example.test', accessToken: 'token', fetch: fetchMock },
    });
    await expect(proxy.post({ endpoint: '/v2/projects/project/snapshots' })).resolves.toMatchObject({
      status: 202,
      headers: { 'x-request-id': 'request' },
      data: { operations: [] },
    });
  });
});

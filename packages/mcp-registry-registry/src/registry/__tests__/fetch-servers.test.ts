import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serversTool } from '../../tools/servers';
import { getServersFromRegistry } from '../fetch-servers';
import { registryData } from '../registry';

// Registry endpoints are served by MSW with payloads trimmed from real responses, so the
// fetch -> post-processor -> filter pipeline runs for real without leaving the machine.
// Any request without a handler fails the test instead of reaching the internet.
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function serversUrl(registryId: string): string {
  const url = registryData.registries.find(registry => registry.id === registryId)?.servers_url;
  if (!url) throw new Error(`Registry ${registryId} has no servers_url`);
  return url;
}

function serve(registryId: string, body: JsonBodyType) {
  server.use(http.get(serversUrl(registryId), () => HttpResponse.json(body)));
}

describe('getServersFromRegistry', () => {
  it('lists Docker Hub MCP images, preferring the image description and last_updated', async () => {
    serve('docker-mcp-catalog', {
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          name: 'fetch',
          namespace: 'mcp',
          description: 'Fetches a URL from the internet and extracts its contents as markdown',
          last_updated: '2026-07-07T07:28:12.922484Z',
          date_registered: '2024-12-19T20:20:08.490561Z',
        },
        {
          name: 'git',
          namespace: 'mcp',
          description: 'Repository description',
          images: [{ description: 'A Model Context Protocol server for Git repository interaction' }],
          last_updated: '2025-04-16T15:05:48.044427Z',
        },
      ],
    });

    await expect(getServersFromRegistry('docker-mcp-catalog')).resolves.toEqual([
      {
        id: 'fetch',
        name: 'fetch',
        description: 'Fetches a URL from the internet and extracts its contents as markdown',
        createdAt: '',
        updatedAt: '2026-07-07T07:28:12.922484Z',
      },
      {
        id: 'git',
        name: 'git',
        description: 'A Model Context Protocol server for Git repository interaction',
        createdAt: '',
        updatedAt: '2025-04-16T15:05:48.044427Z',
      },
    ]);
  });

  it('lists Apify store actors using their title and last run time', async () => {
    serve('apify', {
      data: {
        total: 2,
        count: 2,
        offset: 0,
        limit: 1000,
        desc: false,
        items: [
          {
            title: 'TikTok Scraper',
            name: 'tiktok-scraper',
            username: 'clockworks',
            description: 'Extract data from TikTok videos, hashtags, and users.',
            stats: { lastRunStartedAt: '2026-11-16T10:20:36.259Z' },
          },
          { title: 'No stats actor', name: 'no-stats' },
        ],
      },
    });

    await expect(getServersFromRegistry('apify')).resolves.toEqual([
      {
        id: 'tiktok-scraper',
        name: 'TikTok Scraper',
        description: 'Extract data from TikTok videos, hashtags, and users.',
        createdAt: '',
        updatedAt: '2026-11-16T10:20:36.259Z',
      },
      { id: 'no-stats', name: 'No stats actor', description: 'No description available', createdAt: '', updatedAt: '' },
    ]);
  });

  it('lists Fleur apps keyed by appId', async () => {
    serve('fleur', [
      {
        appId: 'fetch',
        name: 'Fetch',
        description: 'This app enables Claude to retrieve and process content from web pages.',
        category: 'Utilities',
      },
      { name: 'Unkeyed', description: 'An app without an appId' },
    ]);

    await expect(getServersFromRegistry('fleur')).resolves.toEqual([
      {
        id: 'fetch',
        name: 'Fetch',
        description: 'This app enables Claude to retrieve and process content from web pages.',
        createdAt: '',
        updatedAt: '',
      },
      { id: 'Unkeyed', name: 'Unkeyed', description: 'An app without an appId', createdAt: '', updatedAt: '' },
    ]);
  });

  it('lists Pulse MCP servers using their short description', async () => {
    serve('pulse', {
      servers: [
        {
          name: 'Taskwarrior',
          short_description: 'Integrates with Taskwarrior to enable task management.',
          EXPERIMENTAL_ai_generated_description: 'mcp-taskwarrior facilitates task management.',
        },
      ],
    });

    await expect(getServersFromRegistry('pulse')).resolves.toEqual([
      {
        id: 'Taskwarrior',
        name: 'Taskwarrior',
        description: 'Integrates with Taskwarrior to enable task management.',
        createdAt: '',
        updatedAt: '',
      },
    ]);
  });

  it('lists APITracker servers from a servers array', async () => {
    serve('apitracker', {
      servers: [{ id: 'stripe', name: 'Stripe', description: 'Payments API', created_at: '2025-01-01' }],
    });

    await expect(getServersFromRegistry('apitracker')).resolves.toEqual([
      { id: 'stripe', name: 'Stripe', description: 'Payments API', createdAt: '2025-01-01', updatedAt: '' },
    ]);
  });

  it('searches MCP Run servlets by name or description, case-insensitively', async () => {
    serve('mcprun', [
      {
        slug: 'github-issues',
        meta: { description: 'Manage GitHub issues' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-02-01T00:00:00Z',
      },
      {
        slug: 'calendar',
        meta: { description: 'Schedule meetings on your calendar' },
        created_at: '2025-03-01T00:00:00Z',
        updated_at: '2025-04-01T00:00:00Z',
      },
      { meta: { description: 'Entries without a slug are dropped' } },
    ]);

    const byName = await getServersFromRegistry('mcprun', { search: 'GITHUB' });
    expect(byName.map((entry: { id: string }) => entry.id)).toEqual(['github-issues']);

    const byDescription = await getServersFromRegistry('mcprun', { search: 'meetings' });
    expect(byDescription).toEqual([
      {
        id: 'calendar',
        name: 'calendar',
        description: 'Schedule meetings on your calendar',
        createdAt: '2025-03-01T00:00:00Z',
        updatedAt: '2025-04-01T00:00:00Z',
      },
    ]);

    await expect(getServersFromRegistry('mcprun', { search: 'nothing-matches' })).resolves.toEqual([]);
  });

  it('reports the registry URL when the registry responds with an error status', async () => {
    server.use(http.get(serversUrl('pulse'), () => new HttpResponse(null, { status: 410, statusText: 'Gone' })));

    await expect(getServersFromRegistry('pulse')).rejects.toThrow(
      `Failed to fetch servers from ${serversUrl('pulse')}: Gone`,
    );
  });

  it('rejects unknown registries and registries without a servers endpoint without making requests', async () => {
    await expect(getServersFromRegistry('non-existent-registry-id')).rejects.toThrow(
      'Registry with ID "non-existent-registry-id" not found.',
    );
    await expect(getServersFromRegistry('cline')).rejects.toThrow('does not have a servers endpoint');
  });
});

describe('registryServers tool', () => {
  it('returns filtered servers as JSON text, and errors as an isError result', async () => {
    serve('mcprun', [
      { slug: 'github-issues', meta: { description: 'Manage GitHub issues' } },
      { slug: 'calendar', meta: { description: 'Schedule meetings' } },
    ]);

    const ok = await serversTool.execute({ registryId: 'mcprun', search: 'calendar' });
    expect(ok.isError).toBeUndefined();
    expect(JSON.parse(ok.content[0]!.text)).toEqual([
      { id: 'calendar', name: 'calendar', description: 'Schedule meetings' },
    ]);

    server.use(http.get(serversUrl('mcprun'), () => new HttpResponse(null, { status: 500, statusText: 'Down' })));
    const failed = await serversTool.execute({ registryId: 'mcprun' });
    expect(failed).toEqual({
      content: [
        { type: 'text', text: `Error fetching servers: Failed to fetch servers from ${serversUrl('mcprun')}: Down` },
      ],
      isError: true,
    });
  });
});

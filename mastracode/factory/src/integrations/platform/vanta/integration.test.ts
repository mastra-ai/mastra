import { describe, expect, it, vi } from 'vitest';

import { PlatformVantaIntegration } from './integration.js';

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

function vantaWith(pages: number) {
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/connections') {
      return json({ connections: [{ id: 'conn-1', integrationId: 'vanta', status: 'active', accountLabel: null }] });
    }
    const page = Number(url.searchParams.get('pageCursor') ?? 0);
    return json({
      results: {
        data: [{ id: `vuln-${page}`, name: `CVE-${page}` }],
        pageInfo: { hasNextPage: page + 1 < pages, endCursor: String(page + 1) },
      },
    });
  });
  return new PlatformVantaIntegration({
    clientConfig: { baseUrl: 'https://integrations.example.com', accessToken: 'platform-secret', fetchImpl },
  });
}

describe('PlatformVantaIntegration.listVulnerabilities', () => {
  it('lists every page', async () => {
    await expect(vantaWith(3).listVulnerabilities()).resolves.toHaveLength(3);
  });

  // A cut-off list would read as the rest being resolved, and close their cards.
  it('fails instead of returning a list cut off by the page limit', async () => {
    await expect(vantaWith(51).listVulnerabilities()).rejects.toThrow(/more than 50 pages/);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';

function mockFetch(body: unknown = {}) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Knowledge resource', () => {
  const client = new MastraClient({ baseUrl: 'http://localhost:4111', retries: 0 });

  it('lists instances', async () => {
    const fetchMock = mockFetch({ instances: [{ key: 'main', id: 'kb' }] });
    expect(await client.listKnowledge()).toEqual({ instances: [{ key: 'main', id: 'kb' }] });
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:4111/api/knowledge');
  });

  it('sends the scope tags as repeated params and encodes path segments', async () => {
    const fetchMock = mockFetch({ nodes: [] });
    await client.getKnowledge('my kb').graph(['org:a', 'project:b']);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'http://localhost:4111/api/knowledge/my%20kb/graph?scope=org%3Aa&scope=project%3Ab',
    );
    await client.getKnowledge('kb').node('n/1', ['org:a']);
    expect(fetchMock.mock.calls[1]![0]).toBe('http://localhost:4111/api/knowledge/kb/nodes/n%2F1?scope=org%3Aa');
  });

  it('passes the search query and activity paging', async () => {
    const fetchMock = mockFetch({ results: [], truncated: false });
    await client.getKnowledge('kb').search('pay', ['org:a']);
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:4111/api/knowledge/kb/search?scope=org%3Aa&q=pay');
    await client.getKnowledge('kb').activity(['org:a'], { cursor: 'c1', limit: 10 });
    expect(fetchMock.mock.calls[1]![0]).toBe(
      'http://localhost:4111/api/knowledge/kb/activity?scope=org%3Aa&cursor=c1&limit=10',
    );
  });
});

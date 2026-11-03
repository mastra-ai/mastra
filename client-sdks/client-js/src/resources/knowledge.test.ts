import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';

function mockFetch(body: unknown = {}) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Knowledge resource', () => {
  const client = new MastraClient({ baseUrl: 'http://localhost:4111', retries: 0 });
  const url = (fetchMock: ReturnType<typeof mockFetch>, call: number) => fetchMock.mock.calls[call]![0];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists instances', async () => {
    const fetchMock = mockFetch({ instances: [{ key: 'main', id: 'kb' }] });
    expect(await client.listKnowledge()).toEqual({ instances: [{ key: 'main', id: 'kb' }] });
    expect(url(fetchMock, 0)).toBe('http://localhost:4111/api/knowledge');
  });

  it('reads the tree, a page and the graph, encoding path segments', async () => {
    const fetchMock = mockFetch({ pages: [] });
    const kb = client.getKnowledge('my kb');
    await kb.tree();
    await kb.tree({ parentId: 'p1', cursor: 'c1', limit: 10 });
    await kb.page('p/1', { noteLimit: 5 });
    await kb.graph({ rootId: 'p1' });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://localhost:4111/api/knowledge/my%20kb/tree',
      'http://localhost:4111/api/knowledge/my%20kb/tree?parentId=p1&cursor=c1&limit=10',
      'http://localhost:4111/api/knowledge/my%20kb/pages/p%2F1?noteLimit=5',
      'http://localhost:4111/api/knowledge/my%20kb/graph?rootId=p1',
    ]);
  });

  it('sends scope ids as repeated params on search and pages activity', async () => {
    const fetchMock = mockFetch({ results: [] });
    await client.getKnowledge('kb').search('pay', { scopeIds: ['s1', 's2'] });
    expect(url(fetchMock, 0)).toBe('http://localhost:4111/api/knowledge/kb/search?q=pay&scopeId=s1&scopeId=s2');
    await client.getKnowledge('kb').activity({ pageId: 'p1', cursor: 'c1', limit: 10 });
    expect(url(fetchMock, 1)).toBe('http://localhost:4111/api/knowledge/kb/activity?pageId=p1&cursor=c1&limit=10');
  });

  it('streams change notices from the events route', async () => {
    const body = ': connected\n\ndata: {"kind":"page","op":"update","pageId":"p1","at":"t"}\n\ndata: [DONE]\n\n';
    const fetchMock = vi.fn(
      async (_url: string) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const stream = await client.getKnowledge('kb').events();
    const notices = [];
    for await (const notice of stream) notices.push(notice);
    expect(url(fetchMock, 0)).toBe('http://localhost:4111/api/knowledge/kb/events');
    expect(notices).toEqual([{ kind: 'page', op: 'update', pageId: 'p1', at: 't' }]);
  });

  it('rejects when the server cannot stream changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"nope"}', { status: 501 })),
    );
    await expect(client.getKnowledge('kb').events()).rejects.toMatchObject({ status: 501 });
  });
});

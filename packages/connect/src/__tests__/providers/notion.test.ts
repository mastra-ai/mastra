import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNotionTools } from '../../providers/notion.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = [
  'notion_search',
  'notion_get_page',
  'notion_create_page',
  'notion_update_page_properties',
  'notion_get_block_children',
  'notion_append_block_children',
  'notion_query_database',
  'notion_get_database',
  'notion_create_comment',
];

const pageObject = {
  id: 'page-uuid-1',
  object: 'page',
  url: 'https://www.notion.so/Roadmap-page-uuid-1',
  archived: false,
  properties: {
    Name: { id: 'title', type: 'title', title: [{ type: 'text', plain_text: 'Roadmap' }] },
    Status: { id: 'st', type: 'select', select: { name: 'Active' } },
  },
};

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createNotionTools>[0]) {
  return createNotionTools({
    connectionId: 'c_not1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createNotionTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createNotionTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createNotionTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createNotionTools({ allowTools: ['notion_search'] });
    expect(Object.keys(tools)).toEqual(['notion_search']);
    expect(() => createNotionTools({ allowTools: ['notion_nope'] })).toThrow(/notion_nope/);
  });

  it('POSTs search with the Notion-Version header and shapes titled results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          pageObject,
          {
            id: 'db-1',
            object: 'database',
            url: 'https://notion.so/db-1',
            title: [{ type: 'text', plain_text: 'Tasks DB' }],
          },
        ],
        next_cursor: 'cur1',
        has_more: true,
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'notion_search').execute({ query: 'roadmap', filter: 'page' }, {} as never);
    expect(result).toEqual({
      results: [
        { id: 'page-uuid-1', object: 'page', url: 'https://www.notion.so/Roadmap-page-uuid-1', title: 'Roadmap' },
        { id: 'db-1', object: 'database', url: 'https://notion.so/db-1', title: 'Tasks DB' },
      ],
      nextCursor: 'cur1',
      hasMore: true,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_not1/proxy/v1/search');
    expect(init.method).toBe('POST');
    expect(init.headers['Notion-Version']).toBe('2022-06-28');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      query: 'roadmap',
      filter: { property: 'object', value: 'page' },
      page_size: 25,
    });
  });

  it('GETs a page and extracts the title from the title property', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(pageObject));
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'notion_get_page').execute({ pageId: 'page-uuid-1' }, {} as never)) as {
      page: { title: string };
    };
    expect(result.page.title).toBe('Roadmap');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_not1/proxy/v1/pages/page-uuid-1');
    expect(init.method).toBe('GET');
  });

  it('creates a page under a parent page with plain-text content paragraphs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(pageObject));
    const tools = makeTools(fetchMock);
    await tool(tools, 'notion_create_page').execute(
      { parentPageId: 'parent-1', title: 'Roadmap', content: ['First paragraph'] },
      {} as never,
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.parent).toEqual({ page_id: 'parent-1' });
    expect(body.properties.title.title[0].text.content).toBe('Roadmap');
    expect(body.children).toEqual([
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: 'First paragraph' } }] },
      },
    ]);
  });

  it('creates a database page with caller-supplied properties and no synthesized title', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(pageObject));
    const tools = makeTools(fetchMock);
    await tool(tools, 'notion_create_page').execute(
      {
        parentDatabaseId: 'db-1',
        properties: { Name: { title: [{ type: 'text', text: { content: 'Row' } }] } },
      },
      {} as never,
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.parent).toEqual({ database_id: 'db-1' });
    expect(body.properties).toEqual({ Name: { title: [{ type: 'text', text: { content: 'Row' } }] } });
    expect(body.properties.title).toBeUndefined();
  });

  it('rejects create_page with both or neither parent, or missing required title/properties', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const neither = await tool(tools, 'notion_create_page').execute({ title: 'X' }, {} as never);
    const both = await tool(tools, 'notion_create_page').execute(
      { parentPageId: 'a', parentDatabaseId: 'b', title: 'X' },
      {} as never,
    );
    const pageParentNoTitle = await tool(tools, 'notion_create_page').execute({ parentPageId: 'a' }, {} as never);
    const dbParentNoProperties = await tool(tools, 'notion_create_page').execute(
      { parentDatabaseId: 'db-1' },
      {} as never,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(neither).toMatchObject({ error: true });
    expect(both).toMatchObject({ error: true });
    expect(pageParentNoTitle).toMatchObject({ error: true });
    expect(dbParentNoProperties).toMatchObject({ error: true });
  });

  it('PATCHes page properties and archived state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ...pageObject, archived: true }));
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'notion_update_page_properties').execute(
      { pageId: 'page-uuid-1', archived: true },
      {} as never,
    )) as { page: { archived: boolean } };
    expect(result.page.archived).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_not1/proxy/v1/pages/page-uuid-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ archived: true });
  });

  it('rejects an update_page_properties call with nothing to update', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'notion_update_page_properties').execute({ pageId: 'page-uuid-1' }, {} as never);
    expect(result).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists block children via query params and flattens rich text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          {
            id: 'b1',
            type: 'paragraph',
            has_children: false,
            paragraph: {
              rich_text: [
                { type: 'text', plain_text: 'Hello ' },
                { type: 'text', plain_text: 'world' },
              ],
            },
          },
        ],
        next_cursor: null,
        has_more: false,
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'notion_get_block_children').execute(
      { blockId: 'page-uuid-1', limit: 10 },
      {} as never,
    );
    expect(result).toEqual({
      blocks: [{ id: 'b1', type: 'paragraph', text: 'Hello world', hasChildren: false }],
      nextCursor: null,
      hasMore: false,
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_not1/proxy/v1/blocks/page-uuid-1/children?page_size=10');
  });

  it('appends plain-text paragraphs as blocks and requires content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ results: [] }));
    const tools = makeTools(fetchMock);
    await tool(tools, 'notion_append_block_children').execute({ blockId: 'b0', paragraphs: ['Note'] }, {} as never);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_not1/proxy/v1/blocks/b0/children');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body).children[0].paragraph.rich_text[0].text.content).toBe('Note');

    const empty = await tool(tools, 'notion_append_block_children').execute({ blockId: 'b0' }, {} as never);
    expect(empty).toMatchObject({ error: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('queries a database with a raw filter and shapes pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ results: [pageObject], next_cursor: null, has_more: false }));
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'notion_query_database').execute(
      { databaseId: 'db-1', filter: { property: 'Status', select: { equals: 'Active' } } },
      {} as never,
    )) as { pages: { title: string }[] };
    expect(result.pages[0]!.title).toBe('Roadmap');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_not1/proxy/v1/databases/db-1/query');
    expect(JSON.parse(init.body).filter).toEqual({ property: 'Status', select: { equals: 'Active' } });
  });

  it('gets a database and shapes column names/types', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: 'db-1',
        url: 'https://notion.so/db-1',
        title: [{ type: 'text', plain_text: 'Tasks DB' }],
        properties: { Name: { id: 'title', type: 'title' }, Status: { id: 'st', type: 'select' } },
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'notion_get_database').execute({ databaseId: 'db-1' }, {} as never);
    expect(result).toEqual({
      database: {
        id: 'db-1',
        url: 'https://notion.so/db-1',
        title: 'Tasks DB',
        properties: { Name: { type: 'title' }, Status: { type: 'select' } },
      },
    });
  });

  it('creates a comment on a page and enforces the pageId/discussionId invariant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'cm-1', discussion_id: 'd-1' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'notion_create_comment').execute(
      { pageId: 'page-uuid-1', body: 'Looks good' },
      {} as never,
    );
    expect(result).toEqual({ comment: { id: 'cm-1', discussionId: 'd-1' } });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.parent).toEqual({ page_id: 'page-uuid-1' });
    expect(body.rich_text[0].text.content).toBe('Looks good');

    const invalid = await tool(tools, 'notion_create_comment').execute({ body: 'orphan' }, {} as never);
    expect(invalid).toMatchObject({ error: true });
  });

  it('falls back to MASTRA_NOTION_CONNECTION_ID at execute time', async () => {
    vi.stubEnv('MASTRA_NOTION_CONNECTION_ID', 'c_env7');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ results: [], next_cursor: null, has_more: false }));
    const tools = createNotionTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'notion_search').execute({}, {} as never);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v2/connections/c_env7/proxy/v1/search');
  });

  it('throws missing_connection_id when unresolvable', async () => {
    vi.stubEnv('MASTRA_NOTION_CONNECTION_ID', '');
    const tools = createNotionTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(tool(tools, 'notion_search').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});

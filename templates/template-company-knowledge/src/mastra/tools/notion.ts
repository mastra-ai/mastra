import { createTool } from '@mastra/core/tools';
import { Client } from '@notionhq/client';
import { z } from 'zod';

function getNotionClient(): Client {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) throw new Error('NOTION_API_KEY is not set.');
  return new Client({ auth });
}

function extractTitle(page: any): string {
  const props = page?.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop?.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t: any) => t?.plain_text ?? '').join('').trim();
    }
  }
  return '(untitled)';
}

export const searchNotionPages = createTool({
  id: 'search-notion-pages',
  description: 'Search Notion pages and databases the integration has access to. Returns up to 20 results.',
  inputSchema: z.object({
    query: z.string().describe('Free-text query.'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        url: z.string(),
        object: z.string(),
      }),
    ),
  }),
  execute: async input => {
    const notion = getNotionClient();
    const res = await notion.search({ query: input.query, page_size: 20 });
    return {
      results: res.results.map((r: any) => ({
        id: r.id,
        title: extractTitle(r),
        url: r.url ?? '',
        object: r.object,
      })),
    };
  },
});

export const getNotionPage = createTool({
  id: 'get-notion-page',
  description: 'Fetch a Notion page including its top-level block content as plain text.',
  inputSchema: z.object({
    pageId: z.string().describe('Notion page UUID.'),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
    url: z.string(),
  }),
  execute: async input => {
    const notion = getNotionClient();
    const page: any = await notion.pages.retrieve({ page_id: input.pageId });
    const blocks = await notion.blocks.children.list({ block_id: input.pageId, page_size: 100 });
    const text = blocks.results
      .map((b: any) => {
        const type = b.type;
        const rich = b[type]?.rich_text;
        if (!Array.isArray(rich)) return '';
        return rich.map((t: any) => t.plain_text ?? '').join('');
      })
      .filter(Boolean)
      .join('\n\n');
    return {
      id: page.id,
      title: extractTitle(page),
      text,
      url: page.url ?? '',
    };
  },
});

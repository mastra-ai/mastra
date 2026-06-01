import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Minimal Notion page-creation tool. Uses the Notion REST API directly.
 * Gated by NOTION_API_KEY + NOTION_PARENT_PAGE_ID.
 */
export const createNotionPage = createTool({
  id: 'createNotionPage',
  description: "Create a Notion page under the configured parent with the meeting notes as the page body.",
  inputSchema: z.object({
    title: z.string(),
    markdown: z.string().describe('Page body as plain text / markdown-ish. Each paragraph becomes a Notion paragraph block.'),
  }),
  outputSchema: z.object({
    id: z.string(),
    url: z.string(),
  }),
  execute: async input => {
    const apiKey = process.env.NOTION_API_KEY;
    const parent = process.env.NOTION_PARENT_PAGE_ID;
    if (!apiKey) throw new Error('NOTION_API_KEY is not set.');
    if (!parent) throw new Error('NOTION_PARENT_PAGE_ID is not set.');

    const paragraphs = input.markdown
      .split(/\n\n+/)
      .map((text: string) => ({
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: {
          rich_text: [{ type: 'text' as const, text: { content: text.slice(0, 1900) } }],
        },
      }));

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: parent },
        properties: {
          title: { title: [{ type: 'text', text: { content: input.title } }] },
        },
        children: paragraphs,
      }),
    });
    if (!res.ok) throw new Error(`Notion API failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { id: string; url: string };
    return { id: data.id, url: data.url };
  },
});

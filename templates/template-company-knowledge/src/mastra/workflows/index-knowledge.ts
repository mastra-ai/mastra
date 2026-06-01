import { createWorkflow, createStep } from '@mastra/core/workflows';
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { LinearClient } from '@linear/sdk';
import { Client as NotionClient } from '@notionhq/client';
import { z } from 'zod';
import { KNOWLEDGE_INDEX } from '../tools/knowledge-search';

const EMBEDDING_DIM = 1536;

const fetchStep = createStep({
  id: 'fetch-sources',
  description: 'Pull recent Linear issues and Notion pages.',
  inputSchema: z.object({
    linearLimit: z.number().int().min(1).max(250).default(100).optional(),
    notionQuery: z.string().default('').optional(),
  }),
  outputSchema: z.object({
    docs: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        title: z.string(),
        url: z.string(),
        text: z.string(),
      }),
    ),
  }),
  execute: async ({ inputData }) => {
    const docs: Array<{ id: string; source: string; title: string; url: string; text: string }> = [];

    if (process.env.LINEAR_API_KEY) {
      const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
      const issues = await linear.issues({ first: inputData.linearLimit ?? 100 });
      for (const issue of issues.nodes) {
        docs.push({
          id: `linear:${issue.id}`,
          source: 'linear',
          title: `${issue.identifier} ${issue.title}`,
          url: issue.url,
          text: `${issue.title}\n\n${issue.description ?? ''}`.trim(),
        });
      }
    }

    if (process.env.NOTION_API_KEY) {
      const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
      const res = await notion.search({ query: inputData.notionQuery ?? '', page_size: 50 });
      for (const r of res.results as any[]) {
        if (r.object !== 'page') continue;
        let title = '(untitled)';
        const props = r.properties ?? {};
        for (const key of Object.keys(props)) {
          const prop = props[key];
          if (prop?.type === 'title' && Array.isArray(prop.title)) {
            title = prop.title.map((t: any) => t?.plain_text ?? '').join('').trim() || title;
            break;
          }
        }
        let text = title;
        try {
          const blocks = await notion.blocks.children.list({ block_id: r.id, page_size: 50 });
          text = blocks.results
            .map((b: any) => {
              const type = b.type;
              const rich = b[type]?.rich_text;
              if (!Array.isArray(rich)) return '';
              return rich.map((t: any) => t.plain_text ?? '').join('');
            })
            .filter(Boolean)
            .join('\n\n');
        } catch {
          // best-effort: keep title only
        }
        docs.push({
          id: `notion:${r.id}`,
          source: 'notion',
          title,
          url: r.url ?? '',
          text,
        });
      }
    }

    return { docs };
  },
});

const embedAndUpsertStep = createStep({
  id: 'embed-and-upsert',
  description: 'Embed documents with OpenAI text-embedding-3-small and upsert into pgvector.',
  inputSchema: z.object({
    docs: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        title: z.string(),
        url: z.string(),
        text: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({ indexed: z.number() }),
  execute: async ({ inputData, mastra }) => {
    const docs = inputData.docs.filter(d => d.text.trim().length > 0);
    if (docs.length === 0) return { indexed: 0 };

    const vector = mastra.getVector('default');
    await vector.createIndex({ indexName: KNOWLEDGE_INDEX, dimension: EMBEDDING_DIM }).catch(() => {});

    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: docs.map(d => d.text.slice(0, 8000)),
    });

    await vector.upsert({
      indexName: KNOWLEDGE_INDEX,
      vectors: embeddings,
      metadata: docs.map(d => ({
        source: d.source,
        title: d.title,
        url: d.url,
        text: d.text.slice(0, 2000),
      })),
      ids: docs.map(d => d.id),
    });

    return { indexed: docs.length };
  },
});

export const indexKnowledgeWorkflow = createWorkflow({
  id: 'index-knowledge',
  description: 'Pulls recent Linear issues and Notion pages, embeds them, and upserts into pgvector.',
  inputSchema: z.object({
    linearLimit: z.number().int().min(1).max(250).default(100).optional(),
    notionQuery: z.string().default('').optional(),
  }),
  outputSchema: z.object({ indexed: z.number() }),
})
  .then(fetchStep)
  .then(embedAndUpsertStep)
  .commit();

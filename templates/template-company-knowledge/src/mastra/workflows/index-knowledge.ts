import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { embedMany } from 'ai';
import { z } from 'zod';
import { GATEWAY_EMBEDDING_MODEL, KNOWLEDGE_INDEX } from '../tools/knowledge-search';

const EMBEDDING_DIM = 1536;

async function responseText(res: Response) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

const docSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  url: z.string(),
  text: z.string(),
});

/**
 * Fetch recent Linear issues and Notion pages via their REST/GraphQL APIs.
 * Uses plain fetch — no SDK deps needed.
 */
const fetchStep = createStep({
  id: 'fetch-sources',
  description: 'Pull recent Linear issues and Notion pages.',
  inputSchema: z.object({
    linearLimit: z.number().int().min(1).max(250).default(100).optional(),
    notionQuery: z.string().default('').optional(),
  }),
  outputSchema: z.object({ docs: z.array(docSchema) }),
  execute: async ({ inputData }) => {
    const docs: Array<z.infer<typeof docSchema>> = [];

    // --- Linear (GraphQL API) ---
    if (process.env.LINEAR_API_KEY) {
      const limit = inputData.linearLimit ?? 100;
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.LINEAR_API_KEY,
        },
        body: JSON.stringify({
          query: `query($first: Int!) {
            issues(first: $first, orderBy: updatedAt) {
              nodes { id identifier title description url }
            }
          }`,
          variables: { first: limit },
        }),
      });
      if (!res.ok) {
        const body = await responseText(res);
        console.warn(
          `Linear fetch failed while indexing company knowledge: ${res.status} ${res.statusText} ${body}`.trim(),
        );
      } else {
        const json = (await res.json()) as any;
        for (const issue of json?.data?.issues?.nodes ?? []) {
          docs.push({
            id: `linear:${issue.id}`,
            source: 'linear',
            title: `${issue.identifier} ${issue.title}`,
            url: issue.url,
            text: `${issue.title}\n\n${issue.description ?? ''}`.trim(),
          });
        }
      }
    }

    // --- Notion (REST API) ---
    if (process.env.NOTION_API_KEY) {
      const searchRes = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          query: inputData.notionQuery ?? '',
          page_size: 50,
          filter: { value: 'page', property: 'object' },
        }),
      });
      if (!searchRes.ok) {
        const body = await responseText(searchRes);
        console.warn(
          `Notion search failed while indexing company knowledge: ${searchRes.status} ${searchRes.statusText} ${body}`.trim(),
        );
      } else {
        const searchJson = (await searchRes.json()) as any;

        for (const page of searchJson?.results ?? []) {
          let title = '(untitled)';
          const props = page.properties ?? {};
          for (const key of Object.keys(props)) {
            const prop = props[key];
            if (prop?.type === 'title' && Array.isArray(prop.title)) {
              title =
                prop.title
                  .map((t: any) => t?.plain_text ?? '')
                  .join('')
                  .trim() || title;
              break;
            }
          }

          // Best-effort: fetch block children for page content
          let text = title;
          try {
            const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=50`, {
              headers: {
                Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28',
              },
            });
            const blocksJson = (await blocksRes.json()) as any;
            text =
              (blocksJson?.results ?? [])
                .map((b: any) => {
                  const rich = b[b.type]?.rich_text;
                  if (!Array.isArray(rich)) return '';
                  return rich.map((t: any) => t.plain_text ?? '').join('');
                })
                .filter(Boolean)
                .join('\n\n') || title;
          } catch {
            // keep title only
          }

          docs.push({
            id: `notion:${page.id}`,
            source: 'notion',
            title,
            url: page.url ?? '',
            text,
          });
        }
      }
    }

    return { docs };
  },
});

const embedAndUpsertStep = createStep({
  id: 'embed-and-upsert',
  description: 'Embed documents with text-embedding-3-small through Mastra Gateway and upsert into pgvector.',
  inputSchema: z.object({ docs: z.array(docSchema) }),
  outputSchema: z.object({ indexed: z.number() }),
  execute: async ({ inputData, mastra }) => {
    const docs = inputData.docs.filter(d => d.text.trim().length > 0);
    if (docs.length === 0) return { indexed: 0 };

    const vector = mastra.getVector('pgVector');
    await vector.createIndex({ indexName: KNOWLEDGE_INDEX, dimension: EMBEDDING_DIM }).catch(() => {});

    const { embeddings } = await embedMany({
      model: new ModelRouterEmbeddingModel(GATEWAY_EMBEDDING_MODEL),
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
  // Re-index every 6 hours. Run manually from Studio any time, or adjust the cron.
  schedule: {
    cron: '0 */6 * * *',
    inputData: { linearLimit: 100, notionQuery: '' },
  },
})
  .then(fetchStep)
  .then(embedAndUpsertStep)
  .commit();

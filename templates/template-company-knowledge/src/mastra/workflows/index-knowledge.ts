import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { embedMany } from 'ai';
import { z } from 'zod';
import { connectTools } from '../connect';
import { GATEWAY_EMBEDDING_MODEL, KNOWLEDGE_INDEX } from '../tools/knowledge-search';

const EMBEDDING_DIM = 1536;

const docSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  url: z.string(),
  text: z.string(),
});

type ConnectTool = { execute?: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown> };

async function callTool<T>(tools: Record<string, ConnectTool>, id: string, input: unknown): Promise<T | undefined> {
  const tool = tools[id];
  if (!tool?.execute) return undefined;
  try {
    const result = (await tool.execute(input, { requestContext: new RequestContext() })) as
      | (T & { error?: undefined })
      | { error: true; message?: string };
    if (result?.error === true) throw new Error(result.message ?? 'unknown error');
    return result as T;
  } catch (error) {
    console.warn(`${id} failed while indexing company knowledge`, error);
    return undefined;
  }
}

const fetchStep = createStep({
  id: 'fetch-sources',
  description: 'Pull recent Linear issues and Notion pages through Mastra Connect.',
  inputSchema: z.object({
    linearLimit: z.number().int().min(1).max(250).default(100).optional(),
    notionQuery: z.string().default('').optional(),
  }),
  outputSchema: z.object({ docs: z.array(docSchema) }),
  execute: async ({ inputData, mastra }) => {
    const docs: Array<z.infer<typeof docSchema>> = [];
    if (!connectTools) {
      console.warn(
        'Mastra Connect is not configured, so there is nothing to index. Set MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_PROJECT_ID.',
      );
      return { docs };
    }
    const tools = (await connectTools({ mastra })) as Record<string, ConnectTool>;

    let remaining = inputData.linearLimit ?? 100;
    let after: string | undefined;
    while (remaining > 0) {
      const page = await callTool<{
        issues: Array<{
          id: string;
          identifier: string;
          title: string;
          description?: string | null;
          url?: string | null;
        }>;
        nextCursor?: string;
      }>(tools, 'linear_list_issues', { first: Math.min(remaining, 100), after, orderBy: 'updatedAt' });
      if (!page) break;
      for (const issue of page.issues) {
        docs.push({
          id: `linear:${issue.id}`,
          source: 'linear',
          title: `${issue.identifier} ${issue.title}`,
          url: issue.url ?? '',
          text: `${issue.title}\n\n${issue.description ?? ''}`.trim(),
        });
      }
      remaining -= page.issues.length;
      after = page.nextCursor;
      if (!after || page.issues.length === 0) break;
    }

    const search = await callTool<{ results: Array<{ id: string; url?: string; properties?: Record<string, any> }> }>(
      tools,
      'notion_search_pages',
      { query: inputData.notionQuery || undefined, page_size: 50 },
    );
    for (const page of search?.results ?? []) {
      let title = '(untitled)';
      for (const prop of Object.values(page.properties ?? {})) {
        if (prop?.type === 'title' && Array.isArray(prop.title)) {
          title =
            prop.title
              .map((t: any) => t?.plain_text ?? '')
              .join('')
              .trim() || title;
          break;
        }
      }
      const content = await callTool<{ markdown: string }>(tools, 'notion_get_page_as_markdown', { page_id: page.id });
      docs.push({
        id: `notion:${page.id}`,
        source: 'notion',
        title,
        url: page.url ?? '',
        text: content?.markdown.trim() || title,
      });
    }

    return { docs };
  },
});

const embedAndUpsertStep = createStep({
  id: 'embed-and-upsert',
  description: 'Embed documents with text-embedding-3-small through the Gateway and upsert into pgvector.',
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

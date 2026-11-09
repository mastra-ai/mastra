import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  GET_KNOWLEDGE_ACTIVITY_ROUTE,
  GET_KNOWLEDGE_GRAPH_ROUTE,
  GET_KNOWLEDGE_PAGE_ROUTE,
  GET_KNOWLEDGE_TREE_ROUTE,
  LIST_KNOWLEDGE_ROUTE,
  SEARCH_KNOWLEDGE_ROUTE,
  STREAM_KNOWLEDGE_EVENTS_ROUTE,
} from './knowledge';

// @mastra/core 1.80.0, this package's peer floor, ships @mastra/core/knowledge without the page readers.
// On a real ESM namespace a missing export reads as undefined; vitest's mock would throw instead, so set it.
vi.mock('@mastra/core/knowledge', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/core/knowledge')>()),
  listKnowledgeTreeChildren: undefined,
  readKnowledgePage: undefined,
  readKnowledgePageActivity: undefined,
  readKnowledgePageGraph: undefined,
  searchKnowledgeExplorerPages: undefined,
}));

const call = (route: { handler: (args: any) => Promise<any> }, args: Record<string, unknown>) => route.handler(args);

describe('Knowledge read routes on a @mastra/core without the page readers', () => {
  const mastra = new Mastra({
    logger: false,
    knowledge: { main: new Knowledge({ id: 'kb', scopes: {}, storage: new InMemoryStore({ id: 'kb' }) }) },
  });

  it('still lists the registered instances', async () => {
    expect(await call(LIST_KNOWLEDGE_ROUTE, { mastra })).toEqual({ instances: [{ key: 'main', id: 'kb' }] });
  });

  it.each([
    ['tree', GET_KNOWLEDGE_TREE_ROUTE, {}],
    ['page', GET_KNOWLEDGE_PAGE_ROUTE, { pageId: 'p-1' }],
    ['graph', GET_KNOWLEDGE_GRAPH_ROUTE, {}],
    ['search', SEARCH_KNOWLEDGE_ROUTE, { q: 'refunds' }],
    ['activity', GET_KNOWLEDGE_ACTIVITY_ROUTE, {}],
    ['events', STREAM_KNOWLEDGE_EVENTS_ROUTE, { abortSignal: new AbortController().signal }],
  ])('answers the %s route with 501 naming the core version it needs', async (_name, route, extra) => {
    const error = await call(route, { mastra, knowledgeKey: 'main', ...extra }).catch(caught => caught);
    expect(error).toBeInstanceOf(HTTPException);
    expect(error).toMatchObject({ status: 501, message: 'Knowledge browsing needs @mastra/core 1.81.0 or later.' });
  });

  it('gives a caller FGA refuses, or an unknown instance, the same 404 as on a current core', async () => {
    const guarded = new Mastra({
      logger: false,
      knowledge: { main: new Knowledge({ id: 'kb', scopes: {}, storage: new InMemoryStore({ id: 'kb' }) }) },
    });
    (guarded as any).getServer = () => ({ fga: { check: async () => false } });
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'u1' });
    for (const knowledgeKey of ['main', 'missing']) {
      await expect(
        call(GET_KNOWLEDGE_TREE_ROUTE, { mastra: guarded, requestContext, knowledgeKey }),
      ).rejects.toMatchObject({ status: 404 });
    }
  });
});

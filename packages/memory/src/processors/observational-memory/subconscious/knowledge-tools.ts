import type {
  KnowledgeItem,
  KnowledgeNode,
  KnowledgeScope,
  KnowledgeStorage,
  SearchKnowledgeResult,
} from '@mastra/core/storage';
import { createKnowledgeNodeCursor, isKnowledgeScopeVisible } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { KnowledgeSemanticIndexCoordinator } from './semantic-index';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type KnowledgeToolsMemory = {
  storage: {
    getStore(name: 'knowledge'): Promise<KnowledgeStorage | undefined>;
  };
  getKnowledgeSemanticIndex(): Promise<KnowledgeSemanticIndexCoordinator>;
};

type KnowledgeToolContext = {
  agent?: { threadId?: string; resourceId?: string };
  requestContext?: { get(key: string): unknown };
};

function resolveScope(context: KnowledgeToolContext | undefined): KnowledgeScope {
  const organizationId = context?.requestContext?.get('organizationId');
  const resourceId = context?.agent?.resourceId;
  const threadId = context?.agent?.threadId;
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Knowledge tools require requestContext.organizationId.');
  }
  if (!resourceId) throw new Error('Knowledge tools require an active resourceId.');
  if (!threadId) throw new Error('Knowledge tools require an active threadId.');
  return [`org:${organizationId}`, `resource:${resourceId}`, `thread:${threadId}`];
}

async function getKnowledgeStore(memory: KnowledgeToolsMemory): Promise<KnowledgeStorage> {
  const store = await memory.storage.getStore('knowledge');
  if (!store) throw new Error('Knowledge tools require a configured knowledge storage domain.');
  return store;
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function serializeItem(item: KnowledgeItem) {
  return {
    id: item.id,
    text: item.text,
    scope: item.scope,
    sourceThreadId: item.sourceThreadId,
    capturedAt: item.capturedAt.toISOString(),
    when: item.when?.toISOString(),
  };
}

function serializeNode(node: KnowledgeNode) {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    kind: node.kind,
    content: node.content,
    scope: node.scope,
    version: node.version,
    updatedAt: node.updatedAt.toISOString(),
  };
}

async function loadSemanticResult(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  candidate: { id: string; score: number; metadata?: Record<string, unknown> },
): Promise<(SearchKnowledgeResult & { semanticScore: number }) | null> {
  const type = candidate.metadata?.document_type;
  if (type === 'node') {
    const node = await store.getNode(candidate.id.slice('knowledge:node:'.length));
    if (!node || node.mergedInto || !isKnowledgeScopeVisible(node.scope, scope)) return null;
    return {
      type: 'node',
      id: node.id,
      recordId: node.id,
      name: node.name,
      text: `${node.name}\n${node.content ?? ''}`,
      scope: node.scope,
      semanticScore: candidate.score,
    };
  }
  if (type === 'item') {
    const item = await store.getItem({ id: candidate.id.slice('knowledge:item:'.length) });
    if (!item || !isKnowledgeScopeVisible(item.scope, scope)) return null;
    const node = await store.getNode(item.parentNodeId);
    const parentVisible = Boolean(node && !node.mergedInto && isKnowledgeScopeVisible(node.scope, scope));
    return {
      type: 'item',
      id: item.id,
      recordId: parentVisible ? node!.id : item.id,
      name: parentVisible ? node!.name : '(private node)',
      text: item.text,
      scope: item.scope,
      semanticScore: candidate.score,
    };
  }
  return null;
}

function mergeHybridResults(
  lexical: SearchKnowledgeResult[],
  semantic: Array<SearchKnowledgeResult & { semanticScore: number }>,
  limit: number,
) {
  const ranked = new Map<
    string,
    SearchKnowledgeResult & { score: number; sources: string[]; semanticScore?: number }
  >();
  lexical.forEach((result, index) => {
    ranked.set(`${result.type}:${result.id}`, {
      ...result,
      score: 1 / (60 + index + 1),
      sources: ['lexical'],
    });
  });
  semantic.forEach((result, index) => {
    const key = `${result.type}:${result.id}`;
    const existing = ranked.get(key);
    const reciprocalRank = 1 / (60 + index + 1);
    ranked.set(key, {
      ...result,
      score: (existing?.score ?? 0) + reciprocalRank,
      sources: existing ? ['lexical', 'semantic'] : ['semantic'],
      semanticScore: result.semanticScore,
    });
  });
  return [...ranked.values()]
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}

export function createKnowledgeTools(
  memory: KnowledgeToolsMemory,
  fixedScope?: KnowledgeScope,
): Record<string, ToolAction<any, any, any>> {
  const knowledgeSearch = createTool({
    id: 'knowledge_search',
    description: 'Search durable scoped knowledge across nodes and knowledge items using lexical and semantic retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, description: 'The knowledge to search for.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: 'Maximum results. Defaults to 10.' },
      },
      required: ['query'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const { query, limit: requestedLimit } = input as { query: string; limit?: number };
      const scope = fixedScope ?? resolveScope(context as KnowledgeToolContext);
      const limit = normalizeLimit(requestedLimit);
      const store = await getKnowledgeStore(memory);
      const semanticCandidates = await memory
        .getKnowledgeSemanticIndex()
        .then(index => index.search(query, scope, limit * 2));
      const lexical = await store.search({ query, scope, limit: limit * 2 });
      const semantic = (
        await Promise.all(semanticCandidates.map(candidate => loadSemanticResult(store, scope, candidate)))
      ).filter((result): result is NonNullable<typeof result> => Boolean(result));
      return { query, results: mergeHybridResults(lexical, semantic, limit) };
    },
  });

  const knowledgeRead = createTool({
    id: 'knowledge_read',
    description: 'Read a knowledge node, its content, and knowledge items about or linked to it by name or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        items: { type: 'string', enum: ['about', 'touching'], description: 'Knowledge item view. Defaults to about.' },
        cursor: { type: 'string', minLength: 1, description: 'Return knowledge items after this item ULID.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const { id, name, items = 'about', cursor, limit: requestedLimit } = input as {
        id?: string;
        name?: string;
        items?: 'about' | 'touching';
        cursor?: string;
        limit?: number;
      };
      if (!id && !name) throw new Error('knowledge_read requires id or name.');
      const scope = fixedScope ?? resolveScope(context as KnowledgeToolContext);
      const store = await getKnowledgeStore(memory);
      const node = id ? await store.getNode(id) : await store.resolveNode({ name: name!, scope });
      if (!node || node.mergedInto || !isKnowledgeScopeVisible(node.scope, scope)) return { found: false };
      const result = await (items === 'touching' ? store.itemsTouching : store.itemsAbout).call(store, {
        nodeId: node.id,
        scope,
        after: cursor,
        limit: normalizeLimit(requestedLimit),
      });
      return {
        found: true,
        node: serializeNode(node),
        items: result.items.map(serializeItem),
        nextCursor: result.nextCursor,
      };
    },
  });

  const knowledgeBrowse = createTool({
    id: 'knowledge_browse',
    description: 'Browse visible knowledge nodes by scope and name prefix, or follow a node’s mentions and backlinks.',
    inputSchema: {
      type: 'object',
      properties: {
        namePrefix: { type: 'string' },
        kind: { type: 'string', description: 'Optional node kind filter.' },
        hasContent: { type: 'boolean', description: 'Filter nodes by whether they have long-form content.' },
        nodeId: { type: 'string', minLength: 1, description: 'When set, follow knowledge items touching this node.' },
        cursor: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const { namePrefix, kind, hasContent, nodeId, cursor, limit: requestedLimit } = input as {
        namePrefix?: string;
        kind?: string;
        hasContent?: boolean;
        nodeId?: string;
        cursor?: string;
        limit?: number;
      };
      const scope = fixedScope ?? resolveScope(context as KnowledgeToolContext);
      const limit = normalizeLimit(requestedLimit);
      const store = await getKnowledgeStore(memory);
      if (nodeId) {
        const node = await store.getNode(nodeId);
        if (!node || node.mergedInto || !isKnowledgeScopeVisible(node.scope, scope)) return { found: false };
        const result = await store.itemsTouching({ nodeId, scope, after: cursor, limit });
        return {
          found: true,
          node: serializeNode(node),
          items: result.items.map(serializeItem),
          nextCursor: result.nextCursor,
        };
      }
      const nodes = await store.listNodes({ scope, namePrefix, kind, hasContent, cursor, limit: limit + 1 });
      const hasMore = nodes.length > limit;
      const records = nodes.slice(0, limit);
      return {
        records: records.map(serializeNode),
        nextCursor: hasMore
          ? createKnowledgeNodeCursor(records.at(-1)!, { namePrefix, kind, hasContent })
          : undefined,
      };
    },
  });

  return {
    knowledge_search: knowledgeSearch,
    knowledge_read: knowledgeRead,
    knowledge_browse: knowledgeBrowse,
  };
}

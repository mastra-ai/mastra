import type {
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgePage,
  KnowledgeScope,
  KnowledgeStorage,
  SearchKnowledgeResult,
} from '@mastra/core/storage';
import { createKnowledgeRecordCursor, isKnowledgeScopeVisible } from '@mastra/core/storage';
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

function serializeFact(fact: KnowledgeFact) {
  return {
    id: fact.id,
    text: fact.text,
    scope: fact.scope,
    sourceThreadId: fact.sourceThreadId,
    capturedAt: fact.capturedAt.toISOString(),
    when: fact.when?.toISOString(),
  };
}

function serializeEntity(entity: KnowledgeEntity) {
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    kind: entity.kind,
    scope: entity.scope,
    version: entity.version,
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function serializePage(page: KnowledgePage) {
  return {
    id: page.id,
    type: page.type,
    name: page.name,
    body: page.body,
    scope: page.scope,
    version: page.version,
    updatedAt: page.updatedAt.toISOString(),
  };
}

async function loadSemanticResult(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  candidate: { id: string; score: number; metadata?: Record<string, unknown> },
): Promise<(SearchKnowledgeResult & { semanticScore: number }) | null> {
  const type = candidate.metadata?.document_type;
  if (type === 'entity') {
    const entity = await store.getEntity(candidate.id.slice('knowledge:entity:'.length));
    if (!entity || entity.mergedInto || !isKnowledgeScopeVisible(entity.scope, scope)) return null;
    return {
      type: 'entity',
      id: entity.id,
      recordId: entity.id,
      name: entity.name,
      text: `${entity.name}\n${entity.kind}`,
      scope: entity.scope,
      semanticScore: candidate.score,
    };
  }
  if (type === 'page') {
    const page = await store.getPage(candidate.id.slice('knowledge:page:'.length));
    if (!page || !isKnowledgeScopeVisible(page.scope, scope)) return null;
    return {
      type: 'page',
      id: page.id,
      recordId: page.id,
      name: page.name,
      text: `${page.name}\n${page.body}`,
      scope: page.scope,
      semanticScore: candidate.score,
    };
  }
  if (type === 'fact') {
    const fact = await store.getFact({ id: candidate.id.slice('knowledge:fact:'.length) });
    if (!fact || !isKnowledgeScopeVisible(fact.scope, scope)) return null;
    const entity = await store.getEntity(fact.parentEntityId);
    if (!entity) return null;
    const parentVisible = isKnowledgeScopeVisible(entity.scope, scope);
    return {
      type: 'fact',
      id: fact.id,
      recordId: parentVisible ? entity.id : fact.id,
      name: parentVisible ? entity.name : '(private entity)',
      text: fact.text,
      scope: fact.scope,
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
    description:
      'Search durable scoped knowledge across entities, facts, and curated pages using lexical and semantic retrieval.',
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
    description: 'Read an entity and its facts, facts that mention it, or a curated page by name or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['entity', 'page'] },
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        facts: { type: 'string', enum: ['about', 'touching'], description: 'Entity fact view. Defaults to about.' },
        cursor: { type: 'string', minLength: 1, description: 'Return facts after this fact ULID.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      required: ['type'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        type,
        id,
        name,
        facts = 'about',
        cursor,
        limit: requestedLimit,
      } = input as {
        type: 'entity' | 'page';
        id?: string;
        name?: string;
        facts?: 'about' | 'touching';
        cursor?: string;
        limit?: number;
      };
      if (!id && !name) throw new Error('knowledge_read requires id or name.');
      const scope = fixedScope ?? resolveScope(context as KnowledgeToolContext);
      const store = await getKnowledgeStore(memory);
      if (type === 'page') {
        const page = id ? await store.getPage(id) : await store.getPageByName({ name: name!, scope });
        if (!page || !isKnowledgeScopeVisible(page.scope, scope)) return { found: false };
        return { found: true, page: serializePage(page) };
      }
      const entity = id ? await store.getEntity(id) : await store.resolveEntity({ name: name!, scope });
      if (!entity || entity.mergedInto || !isKnowledgeScopeVisible(entity.scope, scope)) return { found: false };
      const result = await (facts === 'touching' ? store.factsTouching : store.factsAbout).call(store, {
        entityId: entity.id,
        scope,
        after: cursor,
        limit: normalizeLimit(requestedLimit),
      });
      return {
        found: true,
        entity: serializeEntity(entity),
        facts: result.facts.map(serializeFact),
        nextCursor: result.nextCursor,
      };
    },
  });

  const knowledgeBrowse = createTool({
    id: 'knowledge_browse',
    description:
      'Browse visible entities or pages by scope and name prefix, or follow an entity’s mentions and backlinks.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['entity', 'page'], description: 'Record type to list. Defaults to entity.' },
        namePrefix: { type: 'string' },
        kind: { type: 'string', description: 'Optional entity kind filter.' },
        entityId: { type: 'string', minLength: 1, description: 'When set, follow facts touching this entity.' },
        cursor: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        type = 'entity',
        namePrefix,
        kind,
        entityId,
        cursor,
        limit: requestedLimit,
      } = input as {
        type?: 'entity' | 'page';
        namePrefix?: string;
        kind?: string;
        entityId?: string;
        cursor?: string;
        limit?: number;
      };
      const scope = fixedScope ?? resolveScope(context as KnowledgeToolContext);
      const limit = normalizeLimit(requestedLimit);
      const store = await getKnowledgeStore(memory);
      if (entityId) {
        const entity = await store.getEntity(entityId);
        if (!entity || entity.mergedInto || !isKnowledgeScopeVisible(entity.scope, scope)) return { found: false };
        const result = await store.factsTouching({ entityId, scope, after: cursor, limit });
        return {
          found: true,
          entity: serializeEntity(entity),
          facts: result.facts.map(serializeFact),
          nextCursor: result.nextCursor,
        };
      }
      if (type === 'page') {
        const pages = await store.listPages({ scope, namePrefix, cursor, limit: limit + 1 });
        const hasMore = pages.length > limit;
        const records = pages.slice(0, limit);
        return {
          records: records.map(serializePage),
          nextCursor: hasMore ? createKnowledgeRecordCursor(records.at(-1)!, { namePrefix }) : undefined,
        };
      }
      const entities = await store.listEntities({ scope, namePrefix, kind, cursor, limit: limit + 1 });
      const hasMore = entities.length > limit;
      const records = entities.slice(0, limit);
      return {
        records: records.map(serializeEntity),
        nextCursor: hasMore ? createKnowledgeRecordCursor(records.at(-1)!, { namePrefix, kind }) : undefined,
      };
    },
  });

  return {
    knowledge_search: knowledgeSearch,
    knowledge_read: knowledgeRead,
    knowledge_browse: knowledgeBrowse,
  };
}

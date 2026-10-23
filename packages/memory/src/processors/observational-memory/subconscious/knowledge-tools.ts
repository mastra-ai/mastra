import { getRunAgentScopes } from '@mastra/core/agent';
import { materializeKnowledgeScopePlan, memoryScopeTypes, planKnowledgeRunScopes } from '@mastra/core/knowledge';
import type { Knowledge, KnowledgeRunScopePlan } from '@mastra/core/knowledge';
import type {
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScopeIds,
  KnowledgeStorage,
  SearchKnowledgeResult,
} from '@mastra/core/storage';
import { createKnowledgeNodeCursor, isKnowledgeScopeVisible } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { KnowledgeSemanticIndexCoordinator, KnowledgeSemanticSearchResult } from './semantic-index';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export type KnowledgeStoreMemory = {
  getKnowledgeStore?: () => Promise<KnowledgeStorage>;
  getKnowledgeInstance?: () => Knowledge | undefined;
  storage?: {
    getStore(name: 'knowledge'): Promise<KnowledgeStorage | undefined>;
  };
};

export type KnowledgeToolsMemory = KnowledgeStoreMemory & {
  getKnowledgeSemanticIndex(): Promise<KnowledgeSemanticIndexCoordinator | undefined>;
};

/** A fixed host, or one chosen per call from the tool context (a Knowledge key resolved through Mastra). */
export type KnowledgeToolsHost<T> = T | ((context: KnowledgeToolContext | undefined) => T);

export function resolveKnowledgeToolsHost<T extends object>(
  host: KnowledgeToolsHost<T>,
  context: KnowledgeToolContext | undefined,
): T {
  return typeof host === 'function' ? (host as (context: KnowledgeToolContext | undefined) => T)(context) : host;
}

/** Record writes go through Knowledge, which rejects placements no reader could see; bare storage has no Knowledge. */
export function knowledgeRecordWriter(
  memory: { getKnowledgeInstance?: () => Pick<KnowledgeStorage, 'createRecord' | 'setRecordScopes'> | undefined },
  store: KnowledgeStorage,
): Pick<KnowledgeStorage, 'createRecord' | 'setRecordScopes'> {
  return memory.getKnowledgeInstance?.() ?? store;
}

export type KnowledgeToolContext = {
  agent?: { agentId?: string; threadId?: string; resourceId?: string };
  requestContext?: { get(key: string): unknown };
  mastra?: { getKnowledge?: (key: string) => Knowledge };
};

export async function getKnowledgeStore(memory: KnowledgeStoreMemory): Promise<KnowledgeStorage> {
  if (memory.getKnowledgeStore) return memory.getKnowledgeStore();
  const store = await memory.storage?.getStore('knowledge');
  if (!store) throw new Error('Knowledge tools require a configured knowledge storage domain.');
  return store;
}

/** One level of the scope chain a run holds, root first. `type` is the scope type's leading segment (`org`, `project`). */
export interface KnowledgeRunScopeLevel {
  type: string;
  address: string;
  scopeId: string;
}

export interface KnowledgeRunScopes {
  /** Every scope the run holds: the chain, root first, then any other held scope. */
  scopeIds: KnowledgeScopeIds;
  /** The run's deepest chain of nested scopes, root first; write tiers are named by its types. */
  levels: KnowledgeRunScopeLevel[];
}

function trustedRunScopes(context: KnowledgeToolContext | undefined): string[] {
  const scopes = [...(getRunAgentScopes(context?.requestContext) ?? [])];
  if (context?.agent?.resourceId) scopes.push(`resource:${context.agent.resourceId}`);
  if (context?.agent?.threadId) scopes.push(`thread:${context.agent.threadId}`);
  return [...new Set(scopes)];
}

/**
 * The Knowledge scopes a run holds: its Core-trusted agent scopes plus its own Memory resource and
 * thread, matched against the host's configured scope types (bare storage, with no Knowledge
 * instance, uses Memory's {@link memoryScopeTypes}). Never trusts request-context strings.
 */
export async function resolveRunKnowledgeScopes(
  memory: KnowledgeStoreMemory,
  context: KnowledgeToolContext | undefined,
): Promise<KnowledgeRunScopes> {
  const scopes = trustedRunScopes(context);
  const knowledge = memory.getKnowledgeInstance?.();
  let held: Array<KnowledgeRunScopePlan & { scopeId: string }>;
  if (knowledge) {
    held = await knowledge.materializeRunScopes({ scopes });
  } else {
    const store = await getKnowledgeStore(memory);
    held = [];
    for (const plan of planKnowledgeRunScopes(memoryScopeTypes, scopes)) {
      const { pattern: _pattern, parentAddress: _parentAddress, ...input } = plan;
      const result = await store.reconcileStructure(materializeKnowledgeScopePlan(memoryScopeTypes, input));
      const scopeId = result.scopes[plan.address]!;
      if (plan.parentAddress) {
        const parentId = held.find(scope => scope.address === plan.parentAddress)!.scopeId;
        if (!(await store.getNodeScopeIds(scopeId)).includes(parentId)) {
          throw new Error(
            `Knowledge scope ${plan.address} already exists under a parent other than ${plan.parentAddress}`,
          );
        }
      }
      held.push({ ...plan, scopeId });
    }
  }
  if (held.length === 0) {
    throw new Error(
      'Knowledge tools found no scope for this run: configure Knowledge scope types (for example memoryScopeTypes) that match the run’s scopes.',
    );
  }

  const byAddress = new Map(held.map(scope => [scope.address, scope]));
  const chainOf = (scope: KnowledgeRunScopePlan & { scopeId: string }) => {
    const chain = [scope];
    for (let current = scope; current.parentAddress;) {
      current = byAddress.get(current.parentAddress)!;
      chain.unshift(current);
    }
    return chain;
  };
  const chains = held.map(chainOf);
  const depth = Math.max(...chains.map(chain => chain.length));
  const deepest = chains.filter(chain => chain.length === depth);
  if (deepest.length > 1) {
    throw new Error(
      `Knowledge run scopes form more than one chain of depth ${depth}: ${deepest.map(chain => chain.at(-1)!.address).join(', ')}`,
    );
  }
  const levels = deepest[0]!.map(scope => ({
    type: scope.address.split(':')[0]!,
    address: scope.address,
    scopeId: scope.scopeId,
  }));
  const chainIds = new Set(levels.map(level => level.scopeId));
  return {
    scopeIds: [
      ...levels.map(level => level.scopeId),
      ...held.filter(s => !chainIds.has(s.scopeId)).map(s => s.scopeId),
    ],
    levels,
  };
}

export async function resolveKnowledgeScopeIds(
  memory: KnowledgeStoreMemory,
  context: KnowledgeToolContext | undefined,
): Promise<KnowledgeScopeIds> {
  return (await resolveRunKnowledgeScopes(memory, context)).scopeIds;
}

async function effectiveScopeIds(
  memory: KnowledgeStoreMemory,
  fixedScopeIds: KnowledgeScopeIds | undefined,
  context: KnowledgeToolContext | undefined,
) {
  if (fixedScopeIds?.length) return fixedScopeIds;
  return resolveKnowledgeScopeIds(memory, context);
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

async function serializeRecord(store: KnowledgeStorage, record: KnowledgeRecord) {
  return {
    id: record.id,
    nodeId: record.nodeId,
    text: record.text,
    scopeIds: await store.getRecordScopeIds(record.id),
    source: record.source,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function serializeNode(store: KnowledgeStorage, node: KnowledgeNode) {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    isScope: node.isScope,
    metadata: node.metadata,
    scopeIds: await store.getNodeScopeIds(node.id),
    version: node.version,
    updatedAt: node.updatedAt.toISOString(),
  };
}

function mergeHybridResults(
  lexical: SearchKnowledgeResult[],
  semantic: KnowledgeSemanticSearchResult[],
  limit: number,
) {
  const ranked = new Map<
    string,
    SearchKnowledgeResult & { score: number; sources: string[]; semanticScore?: number }
  >();
  lexical.forEach((result, index) =>
    ranked.set(`${result.type}:${result.id}`, { ...result, score: 1 / (61 + index), sources: ['lexical'] }),
  );
  semantic.forEach(({ score: semanticScore, ...result }, index) => {
    const key = `${result.type}:${result.id}`;
    const existing = ranked.get(key);
    ranked.set(key, {
      ...result,
      score: (existing?.score ?? 0) + 1 / (61 + index),
      sources: existing ? ['lexical', 'semantic'] : ['semantic'],
      semanticScore,
    });
  });
  return [...ranked.values()]
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}

export function createKnowledgeReadTools(
  host: KnowledgeToolsHost<KnowledgeToolsMemory>,
  fixedScopeIds?: KnowledgeScopeIds,
): Record<string, ToolAction<any, any, any>> {
  const knowledgeSearch = createTool({
    id: 'knowledge_search',
    description:
      'Search durable scoped knowledge across nodes and knowledge records using lexical and semantic retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      required: ['query'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const { query, limit: requestedLimit } = input as { query: string; limit?: number };
      const memory = resolveKnowledgeToolsHost(host, context as KnowledgeToolContext);
      const scopeIds = await effectiveScopeIds(memory, fixedScopeIds, context as KnowledgeToolContext);
      const limit = normalizeLimit(requestedLimit);
      const store = await getKnowledgeStore(memory);
      const semanticIndex = await memory.getKnowledgeSemanticIndex();
      const semantic = semanticIndex ? await semanticIndex.search(query, scopeIds, limit * 2) : [];
      const lexical = await store.search({ query, scopeIds, limit: limit * 2 });
      return { query, results: mergeHybridResults(lexical, semantic, limit) };
    },
  });

  const knowledgeRead = createTool({
    id: 'knowledge_read',
    description: 'Read a knowledge node and knowledge records about or linked to it by name or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        relationship: { type: 'string', enum: ['about', 'mentioning', 'related'] },
        cursor: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        id,
        name,
        relationship = 'about',
        cursor,
        limit: requestedLimit,
      } = input as {
        id?: string;
        name?: string;
        relationship?: 'about' | 'mentioning' | 'related';
        cursor?: string;
        limit?: number;
      };
      if (!id && !name) throw new Error('knowledge_read requires id or name.');
      const memory = resolveKnowledgeToolsHost(host, context as KnowledgeToolContext);
      const scopeIds = await effectiveScopeIds(memory, fixedScopeIds, context as KnowledgeToolContext);
      const store = await getKnowledgeStore(memory);
      const node = id ? await store.getNode(id) : await store.resolveNode({ name: name!, scopeIds });
      if (!node || !isKnowledgeScopeVisible(await store.getNodeScopeIds(node.id), scopeIds)) return { found: false };
      const query =
        relationship === 'related'
          ? store.listRelatedRecords
          : relationship === 'mentioning'
            ? store.listMentioningRecords
            : store.listRecords;
      const result = await query.call(store, { node, scopeIds, after: cursor, limit: normalizeLimit(requestedLimit) });
      return {
        found: true,
        node: await serializeNode(store, node),
        records: await Promise.all(result.records.map(record => serializeRecord(store, record))),
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
        kind: { type: 'string' },
        hasContent: { type: 'boolean' },
        node: { type: 'string', minLength: 1 },
        cursor: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        namePrefix,
        kind,
        node: nodeReference,
        cursor,
        limit: requestedLimit,
      } = input as {
        namePrefix?: string;
        kind?: string;
        node?: string;
        cursor?: string;
        limit?: number;
      };
      const memory = resolveKnowledgeToolsHost(host, context as KnowledgeToolContext);
      const scopeIds = await effectiveScopeIds(memory, fixedScopeIds, context as KnowledgeToolContext);
      const limit = normalizeLimit(requestedLimit);
      const store = await getKnowledgeStore(memory);
      if (nodeReference) {
        const node = await store.getNode(nodeReference);
        if (!node || !isKnowledgeScopeVisible(await store.getNodeScopeIds(node.id), scopeIds)) return { found: false };
        const result = await store.listRelatedRecords({ node, scopeIds, after: cursor, limit });
        return {
          found: true,
          node: await serializeNode(store, node),
          records: await Promise.all(result.records.map(record => serializeRecord(store, record))),
          nextCursor: result.nextCursor,
        };
      }
      const nodes = await store.listNodes({ scopeIds, namePrefix, kind, cursor, limit: limit + 1 });
      const visibleNodes = nodes.slice(0, limit);
      return {
        nodes: await Promise.all(visibleNodes.map(node => serializeNode(store, node))),
        nextCursor:
          nodes.length > limit ? createKnowledgeNodeCursor(visibleNodes.at(-1)!, { namePrefix, kind }) : undefined,
      };
    },
  });
  return { knowledge_search: knowledgeSearch, knowledge_read: knowledgeRead, knowledge_browse: knowledgeBrowse };
}

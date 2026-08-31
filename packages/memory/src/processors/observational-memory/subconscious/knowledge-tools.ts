import { getKnowledgeReadableScopeIds, type Knowledge } from '@mastra/core/knowledge';
import type {
  KnowledgeNode,
  KnowledgeRecord,
  KnowledgeScopeIds,
  KnowledgeStorage,
  SearchKnowledgeResult,
} from '@mastra/core/storage';
import { createKnowledgeNodeCursor } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import { resolveKnowledgeResourceId } from './scope';
import type { KnowledgeSemanticIndexCoordinator } from './semantic-index';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export type KnowledgeStoreMemory = {
  getKnowledgeStore?: () => Promise<KnowledgeStorage>;
  getKnowledgeInstance?: () => Knowledge | undefined;
};

type KnowledgeToolsMemory = KnowledgeStoreMemory & {
  getKnowledgeSemanticIndex(): Promise<KnowledgeSemanticIndexCoordinator | undefined>;
};

type KnowledgeToolContext = {
  agent?: { threadId?: string; resourceId?: string };
  requestContext?: { get(key: string): unknown };
};

export function withCaptureCompanions(scopeIds: KnowledgeScopeIds): KnowledgeScopeIds {
  return scopeIds;
}

export async function getKnowledgeStore(memory: KnowledgeStoreMemory): Promise<KnowledgeStorage> {
  if (!memory.getKnowledgeStore) throw new Error('Knowledge tools require a configured Knowledge instance.');
  return memory.getKnowledgeStore();
}

export async function resolveKnowledgeScopeIds(
  memory: KnowledgeStoreMemory,
  context: KnowledgeToolContext | undefined,
): Promise<KnowledgeScopeIds> {
  const organizationId = context?.requestContext?.get('organizationId');
  const resourceId = resolveKnowledgeResourceId(context?.requestContext, context?.agent?.resourceId);
  const threadId = context?.agent?.threadId;
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Knowledge tools require requestContext.organizationId.');
  }
  if (!resourceId) throw new Error('Knowledge tools require an active resourceId.');
  if (!threadId) throw new Error('Knowledge tools require an active threadId.');
  const knowledge = memory.getKnowledgeInstance?.();
  if (!knowledge) throw new Error('Knowledge tools require a configured Knowledge instance.');

  const orgAddress = `org:${organizationId}`;
  const resourceAddress = `resource:${resourceId}`;
  const threadAddress = `resource:${resourceId}:thread:${threadId}`;
  const org = await knowledge.materializeScope({
    address: orgAddress,
    contextualScopeAddress: orgAddress,
    parameters: { orgId: organizationId },
  });
  const resource = await knowledge.materializeScope({
    address: resourceAddress,
    parentAddresses: [orgAddress],
    contextualScopeAddress: orgAddress,
    parameters: { orgId: organizationId, resourceId },
  });
  const thread = await knowledge.materializeScope({
    address: threadAddress,
    parentAddresses: [resourceAddress],
    contextualScopeAddress: resourceAddress,
    parameters: { orgId: organizationId, resourceId, threadId },
  });
  const scopeIds = [org.scopes[orgAddress]!, resource.scopes[resourceAddress]!, thread.scopes[threadAddress]!];
  for (const [level, parentAddress] of [
    ['resource', resourceAddress],
    ['thread', threadAddress],
  ] as const) {
    const address = `${parentAddress}:uncurated`;
    const companion = await knowledge.materializeScope({
      address,
      name: 'uncurated',
      parentAddresses: [parentAddress],
      contextualScopeAddress: parentAddress,
      parameters: { orgId: organizationId, resourceId, threadId },
    });
    scopeIds.push(companion.scopes[address]!);
  }
  return scopeIds;
}

async function effectiveScopeIds(
  memory: KnowledgeStoreMemory,
  fixedScopeIds: KnowledgeScopeIds | undefined,
  context: KnowledgeToolContext | undefined,
) {
  if (fixedScopeIds?.length) return fixedScopeIds;
  const [, ...resourceScopeIds] = await resolveKnowledgeScopeIds(memory, context);
  return resourceScopeIds;
}

async function readableScopeIdSet(knowledge: Knowledge, vouchedScopeIds: KnowledgeScopeIds): Promise<Set<string>> {
  return new Set(getKnowledgeReadableScopeIds(await knowledge.evaluateAccess(vouchedScopeIds)));
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

async function serializeRecord(store: KnowledgeStorage, record: KnowledgeRecord, readableScopeIds: Set<string>) {
  return {
    id: record.id,
    nodeId: record.nodeId,
    text: record.text,
    scopeIds: (await store.getRecordScopeIds(record.id)).filter(scopeId => readableScopeIds.has(scopeId)),
    source: record.source,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function serializeNode(store: KnowledgeStorage, node: KnowledgeNode, readableScopeIds: Set<string>) {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    isScope: node.isScope,
    metadata: node.metadata,
    scopeIds: (await store.getNodeScopeIds(node.id)).filter(scopeId => readableScopeIds.has(scopeId)),
    version: node.version,
    updatedAt: node.updatedAt.toISOString(),
  };
}

async function loadSemanticResult(
  knowledge: Knowledge,
  store: KnowledgeStorage,
  scopeIds: KnowledgeScopeIds,
  readableScopeIds: Set<string>,
  candidate: { id: string; score: number; metadata?: Record<string, unknown> },
): Promise<(SearchKnowledgeResult & { semanticScore: number }) | null> {
  const type = candidate.metadata?.document_type;
  if (type === 'node') {
    const node = await knowledge.getNode({ id: candidate.id.slice('knowledge:node:'.length), scopeIds });
    if (!node) return null;
    const nodeScopeIds = (await store.getNodeScopeIds(node.id)).filter(scopeId => readableScopeIds.has(scopeId));
    return {
      type: 'node',
      id: node.id,
      recordId: node.id,
      name: node.name,
      text: `${node.name}\n${String(node.metadata?.description ?? '')}`,
      scopeIds: nodeScopeIds,
      semanticScore: candidate.score,
    };
  }
  if (type === 'record') {
    const record = await knowledge.getRecord({ id: candidate.id.slice('knowledge:record:'.length), scopeIds });
    if (!record) return null;
    const node = await knowledge.getNode({ id: record.nodeId, scopeIds });
    if (!node) return null;
    return {
      type: 'record',
      id: record.id,
      recordId: node.id,
      name: node.name,
      text: record.text,
      scopeIds: (await store.getRecordScopeIds(record.id)).filter(scopeId => readableScopeIds.has(scopeId)),
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
  lexical.forEach((result, index) =>
    ranked.set(`${result.type}:${result.id}`, { ...result, score: 1 / (61 + index), sources: ['lexical'] }),
  );
  semantic.forEach((result, index) => {
    const key = `${result.type}:${result.id}`;
    const existing = ranked.get(key);
    ranked.set(key, {
      ...result,
      score: (existing?.score ?? 0) + 1 / (61 + index),
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
      const scopeIds = await effectiveScopeIds(memory, fixedScopeIds, context as KnowledgeToolContext);
      const limit = normalizeLimit(requestedLimit);
      const knowledge = memory.getKnowledgeInstance?.();
      if (!knowledge) throw new Error('Knowledge tools require a configured Knowledge instance.');
      const store = await getKnowledgeStore(memory);
      const readableScopeIds = await readableScopeIdSet(knowledge, scopeIds);
      const semanticIndex = await memory.getKnowledgeSemanticIndex();
      const semanticCandidates = semanticIndex ? await semanticIndex.search(query, scopeIds, limit * 2) : [];
      const lexical = (await knowledge.search({ query, scopeIds, limit: limit * 2 })).map(result => ({
        ...result,
        scopeIds: result.scopeIds.filter(scopeId => readableScopeIds.has(scopeId)),
      }));
      const semantic = (
        await Promise.all(
          semanticCandidates.map(candidate =>
            loadSemanticResult(knowledge, store, scopeIds, readableScopeIds, candidate),
          ),
        )
      ).filter((result): result is NonNullable<typeof result> => Boolean(result));
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
      const scopeIds = await effectiveScopeIds(memory, fixedScopeIds, context as KnowledgeToolContext);
      const knowledge = memory.getKnowledgeInstance?.();
      if (!knowledge) throw new Error('Knowledge tools require a configured Knowledge instance.');
      const store = await getKnowledgeStore(memory);
      const readableScopeIds = await readableScopeIdSet(knowledge, scopeIds);
      const node = id
        ? await knowledge.getNode({ id, scopeIds })
        : await knowledge.resolveNode({ name: name!, scopeIds });
      if (!node) return { found: false };
      const query =
        relationship === 'related'
          ? knowledge.listRelatedRecords.bind(knowledge)
          : relationship === 'mentioning'
            ? knowledge.listMentioningRecords.bind(knowledge)
            : knowledge.listRecords.bind(knowledge);
      const result = await query({ node, scopeIds, after: cursor, limit: normalizeLimit(requestedLimit) });
      return {
        found: true,
        node: await serializeNode(store, node, readableScopeIds),
        records: await Promise.all(result.records.map(record => serializeRecord(store, record, readableScopeIds))),
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
      const scopeIds = await effectiveScopeIds(memory, fixedScopeIds, context as KnowledgeToolContext);
      const limit = normalizeLimit(requestedLimit);
      const knowledge = memory.getKnowledgeInstance?.();
      if (!knowledge) throw new Error('Knowledge tools require a configured Knowledge instance.');
      const store = await getKnowledgeStore(memory);
      const readableScopeIds = await readableScopeIdSet(knowledge, scopeIds);
      if (nodeReference) {
        const node = await knowledge.getNode({ id: nodeReference, scopeIds });
        if (!node) return { found: false };
        const result = await knowledge.listRelatedRecords({ node, scopeIds, after: cursor, limit });
        return {
          found: true,
          node: await serializeNode(store, node, readableScopeIds),
          records: await Promise.all(result.records.map(record => serializeRecord(store, record, readableScopeIds))),
          nextCursor: result.nextCursor,
        };
      }
      const nodes = await knowledge.listNodes({ scopeIds, namePrefix, kind, cursor, limit: limit + 1 });
      const visibleNodes = nodes.slice(0, limit);
      return {
        nodes: await Promise.all(visibleNodes.map(node => serializeNode(store, node, readableScopeIds))),
        nextCursor:
          nodes.length > limit ? createKnowledgeNodeCursor(visibleNodes.at(-1)!, { namePrefix, kind }) : undefined,
      };
    },
  });
  return { knowledge_search: knowledgeSearch, knowledge_read: knowledgeRead, knowledge_browse: knowledgeBrowse };
}

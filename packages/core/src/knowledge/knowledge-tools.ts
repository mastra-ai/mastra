import type { JSONSchema7 } from 'json-schema';
import { getRunAgentScopes } from '../agent/scopes';
import type {
  KnowledgeConcreteRole,
  KnowledgeRecord,
  KnowledgeNode,
  KnowledgeScope,
  KnowledgeStorage,
  SearchKnowledgeResult,
} from '../storage';
import { canonicalizeKnowledgeScope, createKnowledgeNodeCursor, isKnowledgeScopeVisible } from '../storage';
import type { ToolAction } from '../tools';

import { createTool } from '../tools';
import { knowledgeRoleAllows } from './reconcile';
import type { KnowledgeSemanticIndexCoordinator } from './semantic-index';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export type KnowledgeStoreMemory = {
  getKnowledgeStore?: () => Promise<KnowledgeStorage>;
  storage?: {
    getStore(name: 'knowledge'): Promise<KnowledgeStorage | undefined>;
  };
};

type KnowledgeToolsMemory = KnowledgeStoreMemory & {
  getKnowledgeSemanticIndex(): Promise<KnowledgeSemanticIndexCoordinator | undefined>;
  getKnowledgeInstance?(): KnowledgeOwnershipSource | undefined;
};

export type KnowledgeToolContext = {
  agent?: { threadId?: string; resourceId?: string; agentId?: string };
  requestContext?: { get(key: string): unknown };
};

/** The role a run has on a scope it doesn't hold, through ownership, or undefined. */
export type KnowledgeOwnerLookup = (tag: string) => KnowledgeConcreteRole | undefined;

/** The run's Knowledge scope, the tags of it the run holds read-only, and what it owns. */
export interface KnowledgeRunAccess {
  scope: KnowledgeScope;
  readOnly: KnowledgeScope;
  owner?: KnowledgeOwnerLookup;
}

/** What a scope check needs: the run's tags, its read-only tags and its ownership lookup. */
export type KnowledgeScopeAccess = {
  scope: KnowledgeScope;
  readOnly?: KnowledgeScope;
  owner?: KnowledgeOwnerLookup;
};

/** A Knowledge instance that computes ownership from its structure. */
export type KnowledgeOwnershipSource = {
  __ownedScopeRole?(tag: string, heldTags: readonly string[]): KnowledgeConcreteRole | undefined;
};

/**
 * The run's Knowledge scope: the tags Core resolved for the run plus its Memory identity
 * (`resource:`/`thread:`), which Core strips from `mastra__scopes`. Nothing else is trusted.
 * Tags the run holds read-only count for reads but are listed in `readOnly`. With an
 * ownership source, `owner` reports what the run's writable tags own.
 */
export function resolveKnowledgeRunAccess(
  context: KnowledgeToolContext | undefined,
  ownership?: KnowledgeOwnershipSource,
): KnowledgeRunAccess {
  const entries = getRunAgentScopes(context?.requestContext);
  const tags = entries.map(entry => entry.tag);
  const readOnly = entries.filter(entry => entry.access === 'read').map(entry => entry.tag);
  const resourceId = context?.agent?.resourceId;
  const threadId = context?.agent?.threadId;
  if (resourceId) tags.push(`resource:${resourceId}`);
  if (threadId) tags.push(`thread:${threadId}`);
  if (tags.length === 0) {
    throw new Error(
      'Knowledge tools need run scopes: give the agent or the call `scopes`, or run it with a Memory resource or thread.',
    );
  }
  const scope = canonicalizeKnowledgeScope(tags);
  const writable = scope.filter(tag => !readOnly.includes(tag));
  const ownedScopeRole = ownership?.__ownedScopeRole?.bind(ownership);
  return {
    scope,
    readOnly,
    owner: ownedScopeRole ? tag => ownedScopeRole(tag, writable) : undefined,
  };
}

/** The run's full Knowledge scope, for reads. */
export function resolveKnowledgeRunScope(context: KnowledgeToolContext | undefined): KnowledgeScope {
  return resolveKnowledgeRunAccess(context).scope;
}

/** Refuses a write target carrying a tag the run holds read-only. */
export function requireWritableTags(tags: readonly string[], readOnly: readonly string[]): void {
  const blocked = tags.filter(tag => readOnly.includes(tag));
  if (blocked.length > 0) {
    throw new Error(
      `${blocked.map(tag => `"${tag}"`).join(', ')} ${blocked.length === 1 ? 'is' : 'are'} read-only for this run.`,
    );
  }
}

/**
 * Requires the run to reach every tag of `target` at `needed`: a held tag (writable unless
 * `needed` is `readonly`), or a scope the run owns with at least that role.
 */
export function requireScopeAccess(
  target: readonly string[],
  access: KnowledgeScopeAccess,
  needed: KnowledgeConcreteRole,
  label: string,
): void {
  const readOnly = access.readOnly ?? [];
  for (const tag of target) {
    if (access.scope.includes(tag)) {
      if (needed !== 'readonly') requireWritableTags([tag], readOnly);
      continue;
    }
    const role = access.owner?.(tag);
    if (!role) throw new Error(`${label} is outside this run's visible scope.`);
    if (!knowledgeRoleAllows(role, needed)) {
      throw new Error(`This run reaches "${tag}" with role ${role}; this needs ${needed}.`);
    }
  }
}

/**
 * Validates scope tags the model named: each must be held or owned at `needed`. Returns them
 * canonicalized; over the tag cap this throws a tool error naming the cap.
 */
export function resolveNamedScope(
  requested: readonly string[],
  access: KnowledgeScopeAccess,
  needed: KnowledgeConcreteRole,
): KnowledgeScope {
  const missing = requested.filter(tag => !access.scope.includes(tag) && !access.owner?.(tag));
  if (missing.length > 0) {
    throw new Error(`This run does not hold scope ${missing.map(tag => `"${tag}"`).join(', ')}.`);
  }
  requireScopeAccess(requested, access, needed, 'Scope');
  return canonicalizeKnowledgeScope([...requested]);
}

/** A read's query scope: the run's tags plus any owned scopes the model named. */
function resolveReadScope(access: KnowledgeRunAccess, requested: string[] | undefined): KnowledgeScope {
  if (!requested?.length) return access.scope;
  resolveNamedScope(requested, access, 'readonly');
  return canonicalizeKnowledgeScope([...access.scope, ...requested]);
}

const readScopeSchema = {
  type: 'array',
  items: { type: 'string', minLength: 3 },
  minItems: 1,
  description:
    'Extra scope tags to read, such as a team scope this run owns. Omitted, reads cover every tag the run holds.',
} satisfies JSONSchema7;

export async function getKnowledgeStore(memory: KnowledgeStoreMemory): Promise<KnowledgeStorage> {
  if (memory.getKnowledgeStore) return memory.getKnowledgeStore();
  const store = await memory.storage?.getStore('knowledge');
  if (!store) throw new Error('Knowledge tools require a configured knowledge storage domain.');
  return store;
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function serializeRecord(record: KnowledgeRecord) {
  return {
    id: record.id,
    text: record.text,
    scope: record.scope,
    sourceThreadId: record.sourceThreadId,
    capturedAt: record.capturedAt.toISOString(),
    when: record.when?.toISOString(),
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
  if (type === 'record') {
    const record = await store.getKnowledge({ id: candidate.id.slice('knowledge:record:'.length) });
    if (!record || !isKnowledgeScopeVisible(record.scope, scope)) return null;
    const node = await store.getNode(record.node);
    const parentVisible = Boolean(node && !node.mergedInto && isKnowledgeScopeVisible(node.scope, scope));
    return {
      type: 'record',
      id: record.id,
      recordId: parentVisible ? node!.id : record.id,
      name: parentVisible ? node!.name : '(private node)',
      text: record.text,
      scope: record.scope,
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
  const runAccess = (context: unknown) =>
    resolveKnowledgeRunAccess(context as KnowledgeToolContext, memory.getKnowledgeInstance?.());
  const knowledgeSearch = createTool({
    id: 'knowledge_search',
    description:
      'Search durable scoped knowledge across nodes and knowledge records using lexical and semantic retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, description: 'The knowledge to search for.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: 'Maximum results. Defaults to 10.' },
        scope: readScopeSchema,
      },
      required: ['query'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        query,
        limit: requestedLimit,
        scope: requestedScope,
      } = input as {
        query: string;
        limit?: number;
        scope?: string[];
      };
      const scope = fixedScope ?? resolveReadScope(runAccess(context), requestedScope);
      const limit = normalizeLimit(requestedLimit);
      const store = await getKnowledgeStore(memory);
      const semanticIndex = await memory.getKnowledgeSemanticIndex();
      const semanticCandidates = semanticIndex ? await semanticIndex.search(query, scope, limit * 2) : [];
      const lexical = await store.search({ query, scope, limit: limit * 2 });
      const semantic = (
        await Promise.all(semanticCandidates.map(candidate => loadSemanticResult(store, scope, candidate)))
      ).filter((result): result is NonNullable<typeof result> => Boolean(result));
      return { query, results: mergeHybridResults(lexical, semantic, limit) };
    },
  });

  const knowledgeRead = createTool({
    id: 'knowledge_read',
    description: 'Read a knowledge node, its content, and knowledge records about or linked to it by name or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
        name: { type: 'string', minLength: 1 },
        relationship: {
          type: 'string',
          enum: ['about', 'mentioning', 'related'],
          description: 'Knowledge relationship to query. Defaults to about.',
        },
        cursor: { type: 'string', minLength: 1, description: 'Return knowledge records after this record ULID.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
        scope: readScopeSchema,
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
        scope: requestedScope,
      } = input as {
        id?: string;
        name?: string;
        relationship?: 'about' | 'mentioning' | 'related';
        cursor?: string;
        limit?: number;
        scope?: string[];
      };
      if (!id && !name) throw new Error('knowledge_read requires id or name.');
      const scope = fixedScope ?? resolveReadScope(runAccess(context), requestedScope);
      const store = await getKnowledgeStore(memory);
      const node = id ? await store.getNode(id) : await store.resolveNode({ name: name!, scope });
      if (!node || node.mergedInto || !isKnowledgeScopeVisible(node.scope, scope)) return { found: false };
      const query =
        relationship === 'related'
          ? store.listKnowledgeRelatedTo
          : relationship === 'mentioning'
            ? store.listKnowledgeMentioning
            : store.listKnowledgeAbout;
      const result = await query.call(store, {
        node,
        scope,
        after: cursor,
        limit: normalizeLimit(requestedLimit),
      });
      return {
        found: true,
        node: serializeNode(node),
        records: result.records.map(serializeRecord),
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
        node: { type: 'string', minLength: 1, description: 'When set, return knowledge related to this node.' },
        cursor: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT },
        scope: readScopeSchema,
      },
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, context) => {
      const {
        namePrefix,
        kind,
        hasContent,
        node: nodeReference,
        cursor,
        limit: requestedLimit,
        scope: requestedScope,
      } = input as {
        namePrefix?: string;
        kind?: string;
        hasContent?: boolean;
        node?: string;
        cursor?: string;
        limit?: number;
        scope?: string[];
      };
      const scope = fixedScope ?? resolveReadScope(runAccess(context), requestedScope);
      const limit = normalizeLimit(requestedLimit);
      const store = await getKnowledgeStore(memory);
      if (nodeReference) {
        const node = await store.getNode(nodeReference);
        if (!node || node.mergedInto || !isKnowledgeScopeVisible(node.scope, scope)) return { found: false };
        const result = await store.listKnowledgeRelatedTo({ node, scope, after: cursor, limit });
        return {
          found: true,
          node: serializeNode(node),
          records: result.records.map(serializeRecord),
          nextCursor: result.nextCursor,
        };
      }
      const nodes = await store.listNodes({ scope, namePrefix, kind, hasContent, cursor, limit: limit + 1 });
      const hasMore = nodes.length > limit;
      const visibleNodes = nodes.slice(0, limit);
      return {
        nodes: visibleNodes.map(serializeNode),
        nextCursor: hasMore
          ? createKnowledgeNodeCursor(visibleNodes.at(-1)!, { namePrefix, kind, hasContent })
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

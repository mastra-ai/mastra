import type { Mastra } from '@mastra/core/mastra';
import type { KnowledgeNode, KnowledgeRecord, KnowledgeScopeNodeSummary, KnowledgeStorage } from '@mastra/core/storage';
import { createKnowledgeNodeCursor, KnowledgeUnsupportedError, parseKnowledgeWikilinks } from '@mastra/core/storage';
import { z } from 'zod/v4';
import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';

/**
 * Read-only routes for browsing a registered Knowledge instance in Studio.
 *
 * Studio reads as the operator: every scope node of the instance is visible, and a node or
 * record is shown when it belongs to ANY of the scopes being viewed (the storage's own
 * membership rule). Pins are not served.
 */

const MAX_NODES = 500;
const MAX_RECORDS = 2000;
const MAX_SCOPE_PAGES = 10;
const COUNT_CONCURRENCY = 8;
const SEARCH_SCAN_CAP = 1000;
const SEARCH_RESULT_LIMIT = 20;
const ACTIVITY_PAGE_SIZE = 25;
const NODE_RECORD_LIMIT = 200;
const PINNED_NODE_NAME = 'pinned';
const RUNG = 'org' as const;

const instancePathParams = z.object({ instanceKey: z.string().min(1) });
const nodePathParams = instancePathParams.extend({ nodeId: z.string().min(1) });
const scopeQuery = z.object({ scopeNodeId: z.string().min(1).optional() });
const searchQuery = z.object({ q: z.string().max(128).optional() });
const activityQuery = scopeQuery.extend({ cursor: z.string().max(128).optional() });

const rungSchema = z.literal(RUNG);
const metadataSchema = z.record(z.string(), z.unknown());
const listInstancesResponse = z.object({ instances: z.array(z.object({ key: z.string(), id: z.string() })) });
const listScopesResponse = z.object({
  scopes: z.array(
    z.object({
      id: z.string(),
      address: z.string(),
      name: z.string(),
      kind: z.string().optional(),
      description: z.string().optional(),
      parentIds: z.array(z.string()),
      memberCount: z.number(),
      memberCountTruncated: z.boolean(),
      contentNodeCount: z.number(),
      childScopeCount: z.number(),
    }),
  ),
  truncated: z.boolean(),
});
const graphResponse = z.object({
  view: z.literal('project'),
  nodes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      description: z.string().optional(),
      scope: z.array(z.string()),
      rung: rungSchema,
      isScope: z.boolean().optional(),
      pinned: z.boolean(),
      recordCount: z.number(),
      childScopeCount: z.number().optional(),
      contentNodeCount: z.number().optional(),
      memberCount: z.number().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    }),
  ),
  edges: z.array(
    z.object({ id: z.string(), source: z.string(), target: z.string(), type: z.enum(['contains', 'wikilink']) }),
  ),
  records: z.array(z.object({ id: z.string(), nodeIds: z.array(z.string()), pinned: z.boolean(), text: z.string() })),
  truncated: z.boolean(),
  outOfWindow: z.array(z.string()),
  unresolvedCapped: z.object({ count: z.number(), names: z.array(z.string()) }),
  pinCensus: z.object({ resource: z.number(), thread: z.number().nullable() }),
  version: z.string().nullable(),
});
const nodeResponse = z.object({
  node: z.object({
    id: z.string(),
    name: z.string(),
    kind: z.string(),
    content: z.string(),
    description: z.string().optional(),
    scope: z.array(z.string()),
    rung: rungSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  records: z.array(
    z.object({
      id: z.string(),
      node: z.string(),
      relation: z.enum(['owned', 'mentions']),
      text: z.string(),
      scope: z.array(z.string()),
      rung: rungSchema,
      sourceThreadId: z.string(),
      capturedAt: z.string(),
      when: z.string().optional(),
      pinned: z.boolean(),
      metadata: metadataSchema.optional(),
    }),
  ),
});
const searchResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      type: z.enum(['scope', 'node']),
      rung: rungSchema,
      address: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  truncated: z.boolean(),
});
const activityResponse = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      recordType: z.enum(['node', 'record']),
      recordId: z.string().optional(),
      scope: z.array(z.string()),
      node: z.object({ id: z.string(), name: z.string(), rung: rungSchema }),
      createdAt: z.string(),
    }),
  ),
  nextCursor: z.string().optional(),
});

interface InstanceView {
  store: KnowledgeStorage;
  scopes: KnowledgeScopeNodeSummary[];
  scopesById: Map<string, KnowledgeScopeNodeSummary>;
  allScopeIds: string[];
  scopesTruncated: boolean;
}

async function openInstance(mastra: Mastra, instanceKey: string): Promise<InstanceView> {
  let knowledge;
  try {
    knowledge = mastra.getKnowledge(instanceKey);
  } catch {
    throw new HTTPException(404, { message: 'Knowledge instance not found' });
  }
  const store: KnowledgeStorage = await knowledge.getStorage();
  const scopes: KnowledgeScopeNodeSummary[] = [];
  let scopesTruncated = true;
  try {
    let cursor: string | undefined;
    for (let page = 0; page < MAX_SCOPE_PAGES; page += 1) {
      const result = await store.listScopeNodes({ cursor });
      scopes.push(...result.scopes);
      if (!result.nextCursor) {
        scopesTruncated = false;
        break;
      }
      cursor = result.nextCursor;
    }
  } catch (error) {
    if (!(error instanceof KnowledgeUnsupportedError)) throw error;
    scopesTruncated = false;
  }
  return {
    store,
    scopes,
    scopesById: new Map(scopes.map(scope => [scope.id, scope])),
    allScopeIds: scopes.map(scope => scope.id),
    scopesTruncated,
  };
}

function selectedScopeIds(view: InstanceView, scopeNodeId: string | undefined): string[] {
  if (!scopeNodeId) return view.allScopeIds;
  if (!view.scopesById.has(scopeNodeId)) throw new HTTPException(404, { message: 'Knowledge scope not found' });
  return [scopeNodeId];
}

/** Scope addresses from the outermost ancestor down to each of `scopeIds`. */
function addressPath(scopeIds: string[], view: InstanceView): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const scope = view.scopesById.get(id);
    if (!scope) return;
    for (const parentId of scope.parentIds) visit(parentId);
    path.push(scope.address);
  };
  for (const id of scopeIds) visit(id);
  return path;
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function isPinnedNode(node: KnowledgeNode): boolean {
  return node.name === PINNED_NODE_NAME && node.kind === 'system';
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function listContentNodes(view: InstanceView, scopeIds: string[], limit: number) {
  if (scopeIds.length === 0) return { nodes: [] as KnowledgeNode[], truncated: false };
  const nodes: KnowledgeNode[] = [];
  let cursor: string | undefined;
  let truncated = false;
  while (nodes.length <= limit) {
    const pageSize = limit + 1 - nodes.length;
    const page = await view.store.listNodes({ scopeIds, isScope: false, cursor, limit: pageSize });
    nodes.push(...page.filter(node => !node.deletedAt && !isPinnedNode(node)));
    const last = page.at(-1);
    if (!last || page.length < pageSize) break;
    cursor = createKnowledgeNodeCursor(last, { isScope: false });
  }
  if (nodes.length > limit) {
    truncated = true;
    nodes.length = limit;
  }
  return { nodes, truncated };
}

const LIST_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge',
  responseType: 'json',
  responseSchema: listInstancesResponse,
  summary: 'List Knowledge instances',
  description: 'Lists the Knowledge instances registered on the Mastra instance.',
  tags: ['Knowledge'],
  handler: async ({ mastra }) => {
    return {
      instances: Object.entries(mastra.listKnowledge()).map(([key, knowledge]) => ({ key, id: knowledge.id })),
    };
  },
});

const LIST_KNOWLEDGE_SCOPES_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:instanceKey/scopes',
  responseType: 'json',
  responseSchema: listScopesResponse,
  pathParamSchema: instancePathParams,
  summary: 'List Knowledge scopes',
  description: 'Lists the scope nodes of a Knowledge instance with their direct member counts.',
  tags: ['Knowledge'],
  handler: async ({ mastra, instanceKey }) => {
    const view = await openInstance(mastra, instanceKey);
    const childCounts = new Map<string, number>();
    for (const scope of view.scopes) {
      for (const parentId of scope.parentIds) childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
    }
    const scopes = await mapLimited(view.scopes, COUNT_CONCURRENCY, async scope => {
      const { nodes, truncated } = await listContentNodes(view, [scope.id], MAX_NODES);
      const childScopeCount = childCounts.get(scope.id) ?? 0;
      return {
        id: scope.id,
        address: scope.address,
        name: scope.name,
        ...(scope.kind ? { kind: scope.kind } : {}),
        ...(scope.description ? { description: scope.description } : {}),
        parentIds: scope.parentIds,
        memberCount: nodes.length + childScopeCount,
        memberCountTruncated: truncated,
        contentNodeCount: nodes.length,
        childScopeCount,
      };
    });
    return { scopes, truncated: view.scopesTruncated };
  },
});

const GET_KNOWLEDGE_GRAPH_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:instanceKey/graph',
  responseType: 'json',
  responseSchema: graphResponse,
  pathParamSchema: instancePathParams,
  queryParamSchema: scopeQuery,
  summary: 'Get a Knowledge graph',
  description:
    'Returns the nodes, records and edges of one scope (or the whole instance when no scope is given), bounded.',
  tags: ['Knowledge'],
  handler: async ({ mastra, instanceKey, scopeNodeId }) => {
    const view = await openInstance(mastra, instanceKey);
    const membership = selectedScopeIds(view, scopeNodeId);
    const content = await listContentNodes(view, membership, MAX_NODES);
    let truncated = content.truncated || view.scopesTruncated;

    // Scope nodes shown: the whole hierarchy, or the selected scope and its direct child scopes.
    const shownScopes = scopeNodeId
      ? view.scopes.filter(scope => scope.id === scopeNodeId || scope.parentIds.includes(scopeNodeId))
      : view.scopes;
    const shownIds = new Set<string>([...shownScopes.map(scope => scope.id), ...content.nodes.map(node => node.id)]);

    const nodeScopeIds = new Map(
      await mapLimited(content.nodes, COUNT_CONCURRENCY, async node => {
        return [node.id, await view.store.getNodeScopeIds(node.id)] as const;
      }),
    );

    const edges: Array<{ id: string; source: string; target: string; type: 'contains' | 'wikilink' }> = [];
    for (const scope of shownScopes) {
      for (const parentId of scope.parentIds) {
        if (shownIds.has(parentId)) {
          edges.push({ id: `contains:${parentId}:${scope.id}`, source: parentId, target: scope.id, type: 'contains' });
        }
      }
    }
    for (const node of content.nodes) {
      for (const scopeId of nodeScopeIds.get(node.id) ?? []) {
        if (shownIds.has(scopeId)) {
          edges.push({ id: `contains:${scopeId}:${node.id}`, source: scopeId, target: node.id, type: 'contains' });
        }
      }
    }

    // Records, newest first, capped across the whole window; wikilinks resolve by name within it.
    const byName = new Map<string, string>();
    for (const node of content.nodes) byName.set(node.name.trim().toLocaleLowerCase(), node.id);
    const recordLists = await mapLimited(content.nodes, COUNT_CONCURRENCY, async node => {
      const { records } = await view.store.listRecords({ node, scopeIds: view.allScopeIds, limit: MAX_RECORDS + 1 });
      return records.filter(record => !record.deletedAt);
    });
    let records = recordLists.flat().sort((a, b) => b.id.localeCompare(a.id));
    if (records.length > MAX_RECORDS) {
      records = records.slice(0, MAX_RECORDS);
      truncated = true;
    }
    const recordCounts = new Map<string, number>();
    const graphRecords = records.map(record => {
      recordCounts.set(record.nodeId, (recordCounts.get(record.nodeId) ?? 0) + 1);
      const targets = parseKnowledgeWikilinks(record.text)
        .map(name => byName.get(name.trim().toLocaleLowerCase()))
        .filter((id): id is string => Boolean(id) && id !== record.nodeId);
      return { id: record.id, nodeIds: [record.nodeId, ...new Set(targets)], pinned: false, text: record.text };
    });

    const contentCounts = new Map<string, number>();
    const childCounts = new Map<string, number>();
    for (const scope of view.scopes) {
      for (const parentId of scope.parentIds) childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
    }
    for (const ids of nodeScopeIds.values()) {
      for (const id of ids) contentCounts.set(id, (contentCounts.get(id) ?? 0) + 1);
    }

    const nodes = [
      ...shownScopes.map(scope => ({
        id: scope.id,
        name: scope.name,
        kind: scope.kind || 'scope',
        ...(scope.description ? { description: scope.description } : {}),
        scope: addressPath(scope.parentIds, view),
        rung: RUNG,
        isScope: true,
        pinned: false,
        recordCount: 0,
        childScopeCount: childCounts.get(scope.id) ?? 0,
        contentNodeCount: contentCounts.get(scope.id) ?? 0,
        memberCount: (childCounts.get(scope.id) ?? 0) + (contentCounts.get(scope.id) ?? 0),
      })),
      ...content.nodes.map(node => ({
        id: node.id,
        name: node.name,
        kind: node.kind ?? 'concept',
        ...(metadataString(node.metadata, 'description')
          ? { description: metadataString(node.metadata, 'description') }
          : {}),
        scope: addressPath(nodeScopeIds.get(node.id) ?? [], view),
        rung: RUNG,
        pinned: false,
        recordCount: recordCounts.get(node.id) ?? 0,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      })),
    ];

    return {
      view: 'project' as const,
      nodes,
      edges,
      records: graphRecords,
      truncated,
      outOfWindow: [],
      unresolvedCapped: { count: 0, names: [] },
      pinCensus: { resource: 0, thread: null },
      version: null,
    };
  },
});

const GET_KNOWLEDGE_NODE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:instanceKey/nodes/:nodeId',
  responseType: 'json',
  responseSchema: nodeResponse,
  pathParamSchema: nodePathParams,
  summary: 'Get a Knowledge node',
  description: 'Returns one node with the records it owns and the records that mention it.',
  tags: ['Knowledge'],
  handler: async ({ mastra, instanceKey, nodeId }) => {
    const view = await openInstance(mastra, instanceKey);
    const node = await view.store.getNode(nodeId);
    if (!node || node.deletedAt || isPinnedNode(node))
      throw new HTTPException(404, { message: 'Knowledge node not found' });
    const nodeScopeIds = node.isScope ? [node.id] : await view.store.getNodeScopeIds(node.id);
    const [owned, mentioning] = await Promise.all([
      view.store.listRecords({ node, scopeIds: view.allScopeIds, limit: NODE_RECORD_LIMIT }),
      view.store.listMentioningRecords({ node, scopeIds: view.allScopeIds, limit: NODE_RECORD_LIMIT }),
    ]);
    const seen = new Set<string>();
    const owners = new Map<string, string>();
    const project = async (record: KnowledgeRecord, relation: 'owned' | 'mentions') => {
      if (record.deletedAt || seen.has(record.id)) return undefined;
      seen.add(record.id);
      let owner = owners.get(record.nodeId);
      if (!owner) {
        owner = record.nodeId === node.id ? node.name : ((await view.store.getNode(record.nodeId))?.name ?? '');
        owners.set(record.nodeId, owner);
      }
      if (relation === 'mentions' && owner === PINNED_NODE_NAME) return undefined;
      const when = metadataString(record.metadata, 'when');
      return {
        id: record.id,
        node: owner,
        relation,
        text: record.text,
        scope: addressPath(await view.store.getRecordScopeIds(record.id), view),
        rung: RUNG,
        sourceThreadId: metadataString(record.metadata, 'sourceThreadId') ?? '',
        capturedAt: record.createdAt.toISOString(),
        ...(when ? { when } : {}),
        pinned: false,
        ...(record.metadata ? { metadata: record.metadata } : {}),
      };
    };
    const records = [];
    for (const record of owned.records) records.push(await project(record, 'owned'));
    for (const record of mentioning.records) records.push(await project(record, 'mentions'));
    const description = metadataString(node.metadata, 'description');
    return {
      node: {
        id: node.id,
        name: node.name,
        kind: node.kind ?? (node.isScope ? 'scope' : 'concept'),
        content: metadataString(node.metadata, 'content') ?? description ?? '',
        ...(description ? { description } : {}),
        scope: addressPath(nodeScopeIds, view),
        rung: RUNG,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      },
      records: records.filter(record => record !== undefined),
    };
  },
});

const SEARCH_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:instanceKey/search',
  responseType: 'json',
  responseSchema: searchResponse,
  pathParamSchema: instancePathParams,
  queryParamSchema: searchQuery,
  summary: 'Search Knowledge',
  description: 'Finds scopes and nodes whose name contains the query, exact and prefix matches first.',
  tags: ['Knowledge'],
  handler: async ({ mastra, instanceKey, q }) => {
    const query = (q ?? '').trim().toLocaleLowerCase();
    if (query.length < 2) return { results: [], truncated: false };
    const view = await openInstance(mastra, instanceKey);
    const scan = await listContentNodes(view, view.allScopeIds, SEARCH_SCAN_CAP);
    const rank = (name: string) => {
      const normalized = name.toLocaleLowerCase();
      return normalized === query ? 0 : normalized.startsWith(query) ? 1 : 2;
    };
    const matches = [
      ...view.scopes
        .filter(scope => scope.name.toLocaleLowerCase().includes(query))
        .map(scope => ({
          id: scope.id,
          name: scope.name,
          kind: scope.kind || 'scope',
          type: 'scope' as const,
          rung: RUNG,
          address: scope.address,
          ...(scope.description ? { description: scope.description } : {}),
        })),
      ...scan.nodes
        .filter(node => node.name.toLocaleLowerCase().includes(query))
        .map(node => ({
          id: node.id,
          name: node.name,
          kind: node.kind ?? 'concept',
          type: 'node' as const,
          rung: RUNG,
        })),
    ].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return {
      results: matches.slice(0, SEARCH_RESULT_LIMIT),
      truncated: matches.length > SEARCH_RESULT_LIMIT || scan.truncated || view.scopesTruncated,
    };
  },
});

const GET_KNOWLEDGE_ACTIVITY_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:instanceKey/activity',
  responseType: 'json',
  responseSchema: activityResponse,
  pathParamSchema: instancePathParams,
  queryParamSchema: activityQuery,
  summary: 'List Knowledge activity',
  description: 'A newest-first page of activity in one scope, or in the whole instance when no scope is given.',
  tags: ['Knowledge'],
  handler: async ({ mastra, instanceKey, scopeNodeId, cursor }) => {
    const view = await openInstance(mastra, instanceKey);
    const scopeIds = selectedScopeIds(view, scopeNodeId);
    if (scopeIds.length === 0) return { events: [] };
    const batch = await view.store.listActivity({ scopeIds, after: cursor, limit: ACTIVITY_PAGE_SIZE + 1 });
    const page = batch.slice(0, ACTIVITY_PAGE_SIZE);
    const nodes = new Map<string, Promise<KnowledgeNode | null>>();
    const loadNode = (id: string) => {
      const cached = nodes.get(id) ?? view.store.getNode(id);
      nodes.set(id, cached);
      return cached;
    };
    const events = await Promise.all(
      page.map(async event => {
        const nodeId =
          event.targetType === 'node'
            ? event.targetId
            : (await view.store.getRecord({ id: event.targetId, includeDeleted: true }))?.nodeId;
        const node = nodeId ? await loadNode(nodeId) : null;
        if (!node || isPinnedNode(node)) return undefined;
        return {
          id: event.id,
          action: event.action,
          recordType: event.targetType,
          ...(event.targetType === 'record' ? { recordId: event.targetId } : {}),
          scope: addressPath(event.contextScopeId ? [event.contextScopeId] : scopeIds.slice(0, 1), view),
          node: { id: node.id, name: node.name, rung: RUNG },
          createdAt: event.createdAt.toISOString(),
        };
      }),
    );
    const last = page.at(-1);
    return {
      events: events.filter(event => event !== undefined),
      ...(batch.length > ACTIVITY_PAGE_SIZE && last ? { nextCursor: last.id } : {}),
    };
  },
});

export const KNOWLEDGE_READ_ROUTES = [
  LIST_KNOWLEDGE_ROUTE,
  LIST_KNOWLEDGE_SCOPES_ROUTE,
  GET_KNOWLEDGE_GRAPH_ROUTE,
  GET_KNOWLEDGE_NODE_ROUTE,
  SEARCH_KNOWLEDGE_ROUTE,
  GET_KNOWLEDGE_ACTIVITY_ROUTE,
] as const;

export {
  LIST_KNOWLEDGE_ROUTE,
  LIST_KNOWLEDGE_SCOPES_ROUTE,
  GET_KNOWLEDGE_GRAPH_ROUTE,
  GET_KNOWLEDGE_NODE_ROUTE,
  SEARCH_KNOWLEDGE_ROUTE,
  GET_KNOWLEDGE_ACTIVITY_ROUTE,
};

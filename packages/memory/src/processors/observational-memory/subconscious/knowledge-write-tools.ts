import type { KnowledgeNode, KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import {
  MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH,
  MAX_KNOWLEDGE_RECORD_TEXT_LENGTH,
  expandKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
} from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

const CURATOR_IDENTITY = 'subconscious:curate';
const SCOPE_RUNGS = ['org', 'resource', 'thread'] as const;
const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: [...SCOPE_RUNGS] };
const nodePlacementSchema: JSONSchema7 = {
  type: 'string',
  description:
    "Placement for the node: an identity rung ('org', 'resource', or 'thread'), or a structural scope address from the host-configured placement context (for example 'features:memory'). When omitted, the node uses the first record's scope. A structural node is visible at least as widely as its structural scope.",
};
const recordTextSchema: JSONSchema7 = {
  type: 'string',
  minLength: 1,
  maxLength: MAX_KNOWLEDGE_RECORD_TEXT_LENGTH,
  description: `One durable fact, or a few closely related facts, in your own words. Hard limit ${MAX_KNOWLEDGE_RECORD_TEXT_LENGTH} UTF-16 code units. Never paste files, command output, or logs.`,
};

/** Schema maxLength counts code points; this UTF-16 check matches the storage limit and runs before any write. */
function requireRecordTextWithinBound(text: string): void {
  if (text.length > MAX_KNOWLEDGE_RECORD_TEXT_LENGTH) {
    throw new Error(
      `Knowledge records are limited to ${MAX_KNOWLEDGE_RECORD_TEXT_LENGTH} UTF-16 code units. Split this into separate records, one fact each, or summarize it, then retry.`,
    );
  }
}

const dateTimeSchema: JSONSchema7 = {
  type: 'string',
  format: 'date-time',
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$',
  description: 'RFC 3339 date-time, e.g. 2026-09-15T00:00:00Z',
};

type KnowledgeWriteToolsMemory = {
  getKnowledgeStore?: () => Promise<KnowledgeStorage>;
  getKnowledgeInstance?: () =>
    | {
        __getVisibleStructureScopes(
          scope: KnowledgeScope,
        ): Promise<Array<{ address: string; name: string; description?: string; heldAncestors?: string[] }>>;
        materializeScope?(input: {
          address: string;
          contextualScopeAddress: string;
          parentAddresses?: string[];
        }): Promise<unknown>;
      }
    | undefined;
  storage?: {
    getStore(name: 'knowledge'): Promise<KnowledgeStorage | undefined>;
  };
};

export interface KnowledgeWriteToolsOptions {
  scope: KnowledgeScope;
  sourceThreadId: string;
  defaultScope: KnowledgeScopeLevel;
}

async function getStore(memory: KnowledgeWriteToolsMemory): Promise<KnowledgeStorage> {
  if (memory.getKnowledgeStore) return memory.getKnowledgeStore();
  const store = await memory.storage?.getStore('knowledge');
  if (!store) throw new Error('Knowledge write tools require a configured knowledge storage domain.');
  return store;
}

function resolveWriteScope(options: KnowledgeWriteToolsOptions, level?: KnowledgeScopeLevel): KnowledgeScope {
  return expandKnowledgeScope(options.scope, level ?? options.defaultScope);
}

function requireVisible(scope: KnowledgeScope, options: KnowledgeWriteToolsOptions, label: string): void {
  if (!isKnowledgeScopeVisible(scope, options.scope)) {
    throw new Error(`${label} is outside the curator's visible scope.`);
  }
}

/** Broadest of the given rungs (org is broader than resource, resource broader than thread). */
function broadestLevel(levels: KnowledgeScopeLevel[]): KnowledgeScopeLevel {
  return SCOPE_RUNGS.find(rung => levels.includes(rung)) ?? levels[0]!;
}

function rungOf(address: string): KnowledgeScopeLevel | undefined {
  const namespace = address.slice(0, address.indexOf(':'));
  return (SCOPE_RUNGS as readonly string[]).includes(namespace) ? (namespace as KnowledgeScopeLevel) : undefined;
}

/**
 * Resolve the node placement argument. A rung sets the node's identity scope, widened to the
 * first record's level when the rung is narrower. Without a rung the node takes the first record's level, so a node is never narrower than
 * the record created with it. A structural scope address must be inside the host-configured
 * frontier visible to the curator's held scope; the node is placed there and its identity
 * scope widens to the structural scope's held identity ancestor, so the node is readable
 * wherever the structural scope is.
 */
async function resolveNodePlacement(
  memory: KnowledgeWriteToolsMemory,
  options: KnowledgeWriteToolsOptions,
  placement: string | undefined,
  recordLevel: KnowledgeScopeLevel | undefined,
): Promise<{ nodeScope: KnowledgeScope; scopeAddresses?: string[] }> {
  const firstRecordLevel = recordLevel ?? options.defaultScope;
  if (placement !== undefined && (SCOPE_RUNGS as readonly string[]).includes(placement)) {
    return {
      nodeScope: expandKnowledgeScope(
        options.scope,
        broadestLevel([placement as KnowledgeScopeLevel, firstRecordLevel]),
      ),
    };
  }
  if (placement === undefined) {
    return { nodeScope: expandKnowledgeScope(options.scope, firstRecordLevel) };
  }
  const visible = (await memory.getKnowledgeInstance?.()?.__getVisibleStructureScopes(options.scope)) ?? [];
  const structural = visible.find(visibleScope => visibleScope.address === placement);
  if (!structural) {
    throw new Error(`Structural scope is outside the curator's visible scope: ${placement}`);
  }
  const ancestorLevels = (structural.heldAncestors ?? []).flatMap(address => rungOf(address) ?? []);
  return {
    nodeScope: expandKnowledgeScope(options.scope, broadestLevel([firstRecordLevel, ...ancestorLevels])),
    scopeAddresses: [placement],
  };
}

/**
 * Widen a node's identity scope to a record's scope when the node is narrower, so everyone who can
 * read a record can also read the node it belongs to.
 */
async function ensureNodeCoversRecord(
  store: KnowledgeStorage,
  node: KnowledgeNode,
  recordScope: KnowledgeScope,
): Promise<KnowledgeNode> {
  if (isKnowledgeScopeVisible(node.scope, recordScope)) return node;
  return store.updateNode({ id: node.id, version: node.version, scope: recordScope });
}

const ISO_DATE = /\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?)?/g;

/** Name words with dates and punctuation removed, so "Payments-Service (2026-10-08)" matches "payments service". */
function nameWords(name: string): string[] {
  return name
    .toLocaleLowerCase()
    .replace(ISO_DATE, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function namesOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const words = new Set(longer);
  return shorter.every(word => words.has(word));
}

/**
 * Visible nodes that likely describe the same thing as `name`: an exact canonical name match at any
 * visible scope (for example, the same entity first captured in another session), or names that
 * match once case, punctuation, and dates are ignored, or where one name's words all appear in the other.
 */
async function findSimilarNodes(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  name: string,
): Promise<{ exact?: KnowledgeNode; similar: Array<{ id: string; name: string }> }> {
  const words = nameWords(name);
  const probe = [...words].sort((a, b) => b.length - a.length)[0];
  if (!probe) return { similar: [] };
  const canonical = name.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  const similar: Array<{ id: string; name: string }> = [];
  for (const hit of await store.search({ query: probe, scope, limit: 50 })) {
    if (hit.type !== 'node' || seen.has(hit.id)) continue;
    seen.add(hit.id);
    if (hit.name.trim().toLocaleLowerCase() === canonical) {
      const exact = await store.getNode(hit.id);
      if (exact && !exact.mergedInto) return { exact, similar: [] };
    }
    if (namesOverlap(words, nameWords(hit.name))) similar.push({ id: hit.id, name: hit.name });
  }
  return { similar };
}

/**
 * Materialize the org → resource → thread scope chain for a thread-level write, so the session
 * exists as a scope node under its project as soon as it holds knowledge, not only after a viewer
 * asks for it. Materialization is create-only; existing scopes keep their names and parents.
 */
async function vouchThreadScopeChain(memory: KnowledgeWriteToolsMemory, scope: KnowledgeScope): Promise<void> {
  const knowledge = memory.getKnowledgeInstance?.();
  if (!knowledge?.materializeScope) return;
  const org = scope.find(address => address.startsWith('org:'));
  const resource = scope.find(address => address.startsWith('resource:'));
  const thread = scope.find(address => address.startsWith('thread:'))!;
  const chain: Array<{ address: string; contextualScopeAddress: string; parentAddresses?: string[] }> = [];
  if (org) chain.push({ address: org, contextualScopeAddress: org });
  if (resource) {
    chain.push({
      address: resource,
      contextualScopeAddress: org ?? resource,
      ...(org ? { parentAddresses: [org] } : {}),
    });
  }
  const threadParent = resource ?? org;
  chain.push({
    address: thread,
    contextualScopeAddress: threadParent ?? thread,
    ...(threadParent ? { parentAddresses: [threadParent] } : {}),
  });
  const store = await getStore(memory);
  const { scopes } = await store.listScopeNodes({ addresses: chain.map(link => link.address) });
  const existing = new Set(scopes.map(node => node.address));
  for (const link of chain) {
    if (!existing.has(link.address)) await knowledge.materializeScope(link);
  }
}

export function createKnowledgeWriteTools(
  memory: KnowledgeWriteToolsMemory,
  options: KnowledgeWriteToolsOptions,
): Record<string, ToolAction<any, any, any>> {
  let threadScopeVouch: Promise<void> | undefined;
  /** After a successful thread-level write; a vouch failure never fails the write and is retried on the next one. */
  async function vouchThreadScope(scope: KnowledgeScope): Promise<void> {
    if (!scope.some(address => address.startsWith('thread:'))) return;
    threadScopeVouch ??= vouchThreadScopeChain(memory, scope).catch(() => {
      threadScopeVouch = undefined;
    });
    await threadScopeVouch;
  }

  async function resolveWritableNode(id: string) {
    const store = await getStore(memory);
    const node = await store.getNode(id);
    if (!node || node.mergedInto) throw new Error(`Knowledge node not found: ${id}`);
    requireVisible(node.scope, options, 'Knowledge node');
    return node;
  }

  return {
    knowledge_create: createTool({
      id: 'knowledge_create',
      description:
        'Create a scoped knowledge node and its first record. Provenance and capture time are stamped by code.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          kind: { type: 'string', minLength: 1 },
          text: recordTextSchema,
          nodeScope: nodePlacementSchema,
          scope: scopeLevelSchema,
          when: dateTimeSchema,
          confirmDistinct: {
            type: 'boolean',
            description:
              'Set true only after a previous call reported similar existing nodes and this node is genuinely a different thing.',
          },
        },
        required: ['name', 'kind', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          name: string;
          kind: string;
          text: string;
          nodeScope?: string;
          scope?: KnowledgeScopeLevel;
          when?: string;
          confirmDistinct?: boolean;
        };
        requireRecordTextWithinBound(value.text);
        const store = await getStore(memory);
        let existing: KnowledgeNode | undefined;
        if (!value.confirmDistinct) {
          const { exact, similar } = await findSimilarNodes(store, options.scope, value.name);
          existing = exact;
          if (similar.length > 0) {
            throw new Error(
              `Similar nodes already exist: ${similar.map(node => `${node.id} "${node.name}"`).join(', ')}. Append to one of them with knowledge_append, or retry with confirmDistinct: true if this is a different thing.`,
            );
          }
        }
        const { nodeScope, scopeAddresses } = await resolveNodePlacement(memory, options, value.nodeScope, value.scope);
        const recordScope = resolveWriteScope(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        const node = await ensureNodeCoversRecord(
          store,
          await store.createNode({
            name: value.name,
            kind: value.kind,
            // An exact-name visible node is reused rather than duplicated at another scope.
            scope: existing?.scope ?? nodeScope,
            ...(scopeAddresses ? { scopeAddresses } : {}),
          }),
          recordScope,
        );
        const record = await store.appendKnowledge({
          node: node.id,
          text: value.text,
          scope: recordScope,
          sourceThreadId: options.sourceThreadId,
          when,
          resolutionScope: options.scope,
          defaultScope: nodeScope,
        });
        await vouchThreadScope(recordScope);
        return { node, record };
      },
    }),
    knowledge_append: createTool({
      id: 'knowledge_append',
      description: 'Append a scoped record to an existing node. Provenance and capture time are stamped by code.',
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          text: recordTextSchema,
          scope: scopeLevelSchema,
          when: dateTimeSchema,
        },
        required: ['node', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; text: string; scope?: KnowledgeScopeLevel; when?: string };
        requireRecordTextWithinBound(value.text);
        const store = await getStore(memory);
        const parent = await store.getNode(value.node);
        if (!parent || parent.mergedInto) throw new Error(`Knowledge node not found: ${value.node}`);
        requireVisible(parent.scope, options, 'Knowledge node');
        const scope = resolveWriteScope(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        await ensureNodeCoversRecord(store, parent, scope);
        const record = await store.appendKnowledge({
          node: parent.id,
          text: value.text,
          scope,
          sourceThreadId: options.sourceThreadId,
          when,
          resolutionScope: options.scope,
          defaultScope: expandKnowledgeScope(options.scope, options.defaultScope),
        });
        await vouchThreadScope(scope);
        return record;
      },
    }),
    knowledge_remove: createTool({
      id: 'knowledge_remove',
      description: 'Soft-delete a visible record. Curators cannot restore or physically erase knowledge records.',
      inputSchema: {
        type: 'object',
        properties: { recordId: { type: 'string', minLength: 1 } },
        required: ['recordId'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const store = await getStore(memory);
        const record = await store.getKnowledge({ id: (input as { recordId: string }).recordId, includeDeleted: true });
        if (!record) throw new Error(`KnowledgeRecord not found: ${(input as { recordId: string }).recordId}`);
        requireVisible(record.scope, options, 'KnowledgeRecord');
        return store.removeKnowledge({ id: record.id, deletedBy: CURATOR_IDENTITY });
      },
    }),
    // Single-field edits use dedicated tools rather than one tool with an optional pair, because
    // "change at least one of these" is not something a schema can say on this wire. Google
    // rejects `required` inside a branch that is not an OBJECT, so a root-level
    // `anyOf: [{ required: ['name'] }, { required: ['kind'] }]` fails the request before the
    // model runs; nesting that union under a typed object does not help either, because the
    // Google compat layer drops every sibling key of an `anyOf` (schema-compat
    // `provider-compats/google.ts`), which would hide the fields from the model entirely.
    // One required field per single-field tool makes an empty edit unrepresentable. The
    // combined tool keeps multi-field edits atomic under one expected version. Supplying a
    // field with its current value can still be a no-op, matching the previous runtime guard,
    // which rejected only calls that omitted both editable fields.
    knowledge_update_node: createTool({
      id: 'knowledge_update_node',
      description: 'Atomically rename and re-kind a visible node using optimistic concurrency.',
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
          kind: { type: 'string', minLength: 1 },
        },
        required: ['node', 'expectedVersion', 'name', 'kind'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; name: string; kind: string };
        const node = await resolveWritableNode(value.node);
        const store = await getStore(memory);
        return store.updateNode({
          id: node.id,
          version: value.expectedVersion,
          name: value.name,
          kind: value.kind,
        });
      },
    }),
    knowledge_rename_node: createTool({
      id: 'knowledge_rename_node',
      description: 'Rename a visible node using optimistic concurrency.',
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
        },
        required: ['node', 'expectedVersion', 'name'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; name: string };
        const node = await resolveWritableNode(value.node);
        const store = await getStore(memory);
        return store.updateNode({ id: node.id, version: value.expectedVersion, name: value.name });
      },
    }),
    knowledge_set_node_kind: createTool({
      id: 'knowledge_set_node_kind',
      description: 'Change a visible node kind using optimistic concurrency.',
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          kind: { type: 'string', minLength: 1 },
        },
        required: ['node', 'expectedVersion', 'kind'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; kind: string };
        const node = await resolveWritableNode(value.node);
        const store = await getStore(memory);
        return store.updateNode({ id: node.id, version: value.expectedVersion, kind: value.kind });
      },
    }),
    knowledge_merge_nodes: createTool({
      id: 'knowledge_merge_nodes',
      description: 'Merge a visible duplicate node into another visible node using source-version CAS.',
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', minLength: 1 },
          targetId: { type: 'string', minLength: 1 },
          sourceVersion: { type: 'integer', minimum: 1 },
        },
        required: ['sourceId', 'targetId', 'sourceVersion'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { sourceId: string; targetId: string; sourceVersion: number };
        const store = await getStore(memory);
        const [source, target] = await Promise.all([store.getNode(value.sourceId), store.getNode(value.targetId)]);
        if (!source || !target) throw new Error('Knowledge merge requires two existing nodes.');
        requireVisible(source.scope, options, 'Knowledge merge source');
        requireVisible(target.scope, options, 'Knowledge merge target');
        return store.mergeNodes(value);
      },
    }),
    knowledge_rescope: createTool({
      id: 'knowledge_rescope',
      description: 'Change a record visibility scope to any scope level visible in this conversation.',
      inputSchema: {
        type: 'object',
        properties: { recordId: { type: 'string', minLength: 1 }, scope: scopeLevelSchema },
        required: ['recordId', 'scope'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { recordId: string; scope: KnowledgeScopeLevel };
        const store = await getStore(memory);
        const record = await store.getKnowledge({ id: value.recordId });
        if (!record) throw new Error(`KnowledgeRecord not found: ${value.recordId}`);
        requireVisible(record.scope, options, 'KnowledgeRecord');
        const scope = resolveWriteScope(options, value.scope);
        const node = await store.getNode(record.node);
        if (node && !node.mergedInto) await ensureNodeCoversRecord(store, node, scope);
        const rescoped = await store.rescopeKnowledge({ id: record.id, scope });
        await vouchThreadScope(scope);
        return rescoped;
      },
    }),
    knowledge_write_node_description: createTool({
      id: 'knowledge_write_node_description',
      description: `Write the bounded synopsis (max ${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code units) on an existing visible node using optimistic concurrency. Pass an empty string to clear it. Does not create nodes.`,
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          description: {
            type: 'string',
            minLength: 0,
            maxLength: MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH,
            description: `One or two plain-text sentences describing the node, targeting 40-75 tokens. Hard limit ${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code units, enforced by storage on every write; the length check on execution is authoritative. Long-form detail belongs in node content, not here. An empty string clears the description.`,
          },
        },
        required: ['node', 'expectedVersion', 'description'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; description: string };
        // Schema maxLength counts code points; this UTF-16 check matches the storage-level limit.
        if (value.description.length > MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH) {
          throw new Error(
            `Node descriptions are limited to ${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code units. Shorten the description and retry.`,
          );
        }
        const store = await getStore(memory);
        const node = await store.getNode(value.node);
        if (!node || node.mergedInto) throw new Error(`Knowledge node not found: ${value.node}`);
        requireVisible(node.scope, options, 'Knowledge node');
        return store.updateNode({
          id: node.id,
          version: value.expectedVersion,
          description: value.description,
        });
      },
    }),
    knowledge_write_node_content: createTool({
      id: 'knowledge_write_node_content',
      description:
        'Create or replace long-form content on a scoped knowledge node. Existing nodes require expectedVersion.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          kind: { type: 'string', minLength: 1 },
          content: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          expectedVersion: { type: 'integer', minimum: 1 },
        },
        required: ['name', 'content'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          name: string;
          kind?: string;
          content: string;
          scope?: KnowledgeScopeLevel;
          expectedVersion?: number;
        };
        const name = value.name.trim();
        const store = await getStore(memory);
        const scope = resolveWriteScope(options, value.scope);
        const resolvedNode = await store.resolveNode({ name, scope });
        const existing =
          resolvedNode && knowledgeScopeKey(resolvedNode.scope) === knowledgeScopeKey(scope) ? resolvedNode : null;
        if (!existing) {
          if (value.expectedVersion !== undefined)
            throw new Error('expectedVersion is only valid for an existing node.');
          const node = await store.createNode({
            name,
            kind: value.kind ?? 'document',
            content: value.content,
            scope,
            resolutionScope: options.scope,
          });
          await vouchThreadScope(scope);
          return node;
        }
        if (value.expectedVersion === undefined) throw new Error('Updating node content requires expectedVersion.');
        return store.updateNode({
          id: existing.id,
          version: value.expectedVersion,
          kind: value.kind,
          content: value.content,
          resolutionScope: options.scope,
        });
      },
    }),
  };
}

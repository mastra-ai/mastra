import type { JSONSchema7 } from 'json-schema';
import { estimateTokenCount } from 'tokenx';
import type { KnowledgeNode, KnowledgeScope, KnowledgeStorage } from '../storage';
import {
  MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS,
  MAX_KNOWLEDGE_RECORD_TOKENS,
  canonicalizeKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
} from '../storage';
import type { ToolAction } from '../tools';
import { createTool } from '../tools';
import { requireWritableTags } from './knowledge-tools';

const CURATOR_IDENTITY = 'subconscious:curate';
const scopeTagsSchema: JSONSchema7 = {
  type: 'array',
  items: { type: 'string', minLength: 3 },
  minItems: 1,
  description:
    "Scope tags for this write, chosen from the run's scope tags (for example ['team:acme:support']). When omitted, the write uses every run tag, so it is private to this run's identity.",
};
const nodePlacementSchema: JSONSchema7 = {
  type: 'string',
  description:
    "A structural scope address from the host-configured placement context (for example 'features:memory'). When omitted, the node uses the first record's scope.",
};
const recordTextSchema: JSONSchema7 = {
  type: 'string',
  minLength: 1,
  description: `One durable fact, or a few closely related facts, in your own words. Hard limit about ${MAX_KNOWLEDGE_RECORD_TOKENS} tokens. Never paste files, command output, or logs.`,
};

/** A schema can't count tokens; this check matches the storage limit and runs before any write. */
function requireRecordTextWithinBound(text: string): void {
  if (estimateTokenCount(text) > MAX_KNOWLEDGE_RECORD_TOKENS) {
    throw new Error(
      `Knowledge records are limited to about ${MAX_KNOWLEDGE_RECORD_TOKENS} tokens. Split this into separate records, one fact each, or summarize it, then retry.`,
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
  /** The run's full Knowledge scope. */
  scope: KnowledgeScope;
  /** Tags of `scope` the run holds read-only: visible, never written. */
  readOnly?: KnowledgeScope;
  sourceThreadId: string;
}

async function getStore(memory: KnowledgeWriteToolsMemory): Promise<KnowledgeStorage> {
  if (memory.getKnowledgeStore) return memory.getKnowledgeStore();
  const store = await memory.storage?.getStore('knowledge');
  if (!store) throw new Error('Knowledge write tools require a configured knowledge storage domain.');
  return store;
}

/** The tags a write lands at: the requested subset of the run's tags, or all of them. */
function resolveWriteScope(options: KnowledgeWriteToolsOptions, requested?: string[]): KnowledgeScope {
  const readOnly = options.readOnly ?? [];
  if (!requested) {
    const writable = options.scope.filter(tag => !readOnly.includes(tag));
    if (writable.length === 0) throw new Error('This run holds no writable scope tags.');
    return writable;
  }
  requireWritableTags(requested, readOnly);
  const held = new Set(options.scope);
  const missing = requested.filter(tag => !held.has(tag));
  if (missing.length > 0) {
    throw new Error(`This run does not hold scope ${missing.map(tag => `"${tag}"`).join(', ')}.`);
  }
  return canonicalizeKnowledgeScope(requested);
}

/** Visible to the run, and carrying no tag the run holds read-only. */
function requireVisible(scope: KnowledgeScope, options: KnowledgeWriteToolsOptions, label: string): void {
  requireWritableTags(scope, options.readOnly ?? []);
  if (!isKnowledgeScopeVisible(scope, options.scope)) {
    throw new Error(`${label} is outside this run's visible scope.`);
  }
}

/**
 * Resolve the node placement argument. Without one the node takes the first record's scope, so a
 * node is never narrower than the record created with it. A structural scope address must be inside
 * the host-configured frontier visible to the run's scope.
 */
async function resolveNodePlacement(
  memory: KnowledgeWriteToolsMemory,
  options: KnowledgeWriteToolsOptions,
  placement: string | undefined,
  recordScope: KnowledgeScope,
): Promise<{ nodeScope: KnowledgeScope; scopeAddresses?: string[] }> {
  if (placement === undefined) return { nodeScope: recordScope };
  const visible = (await memory.getKnowledgeInstance?.()?.__getVisibleStructureScopes(options.scope)) ?? [];
  if (!visible.some(visibleScope => visibleScope.address === placement)) {
    throw new Error(`Structural scope is outside this run's visible scope: ${placement}`);
  }
  return { nodeScope: recordScope, scopeAddresses: [placement] };
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
          scope: scopeTagsSchema,
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
          scope?: string[];
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
        const recordScope = resolveWriteScope(options, value.scope);
        const { nodeScope, scopeAddresses } = await resolveNodePlacement(memory, options, value.nodeScope, recordScope);
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
          scope: scopeTagsSchema,
          when: dateTimeSchema,
        },
        required: ['node', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; text: string; scope?: string[]; when?: string };
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
          defaultScope: scope,
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
      description: "Change a record's scope to other tags this run holds.",
      inputSchema: {
        type: 'object',
        properties: { recordId: { type: 'string', minLength: 1 }, scope: scopeTagsSchema },
        required: ['recordId', 'scope'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { recordId: string; scope: string[] };
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
      description: `Write the bounded synopsis (about ${MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS} tokens at most) on an existing visible node using optimistic concurrency. Pass an empty string to clear it. Does not create nodes.`,
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          description: {
            type: 'string',
            minLength: 0,
            description: `One or two plain-text sentences describing the node, targeting 40-75 tokens. Hard limit about ${MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS} tokens, enforced by storage on every write. Long-form detail belongs in node content, not here. An empty string clears the description.`,
          },
        },
        required: ['node', 'expectedVersion', 'description'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; description: string };
        if (estimateTokenCount(value.description) > MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS) {
          throw new Error(
            `Node descriptions are limited to about ${MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS} tokens. Shorten the description and retry.`,
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
          scope: scopeTagsSchema,
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
          scope?: string[];
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

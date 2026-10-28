import type { JSONSchema7 } from 'json-schema';
import { estimateTokenCount } from 'tokenx';
import type { KnowledgeConcreteRole, KnowledgeNode, KnowledgeScope, KnowledgeStorage } from '../storage';
import {
  MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS,
  MAX_KNOWLEDGE_RECORD_TOKENS,
  canonicalizeKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
} from '../storage';
import type { ToolAction } from '../tools';
import { createTool } from '../tools';
import type { KnowledgeOwnerLookup } from './knowledge-tools';
import { requireScopeAccess, resolveNamedScope } from './knowledge-tools';

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
      `Knowledge records are limited to about ${MAX_KNOWLEDGE_RECORD_TOKENS} tokens. Split this into separate records, one fact each, or summarize it, then retry. Long-form text belongs in a node's content: knowledge_node op "write".`,
    );
  }
}

/** A field an op needs; the flat op schema can't require it per op. */
function requireField<T>(value: T | undefined, tool: string, op: string, field: string): T {
  if (value === undefined) throw new Error(`${tool} op "${op}" needs ${field}.`);
  return value;
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
  /** What the run reaches through ownership on scopes it doesn't hold. */
  owner?: KnowledgeOwnerLookup;
  sourceThreadId: string;
  /** Stamped as `metadata.source` on every record written and as `deletedBy` on removals, e.g. `agent:<id>`. */
  source?: string;
}

async function getStore(memory: KnowledgeWriteToolsMemory): Promise<KnowledgeStorage> {
  if (memory.getKnowledgeStore) return memory.getKnowledgeStore();
  const store = await memory.storage?.getStore('knowledge');
  if (!store) throw new Error('Knowledge write tools require a configured knowledge storage domain.');
  return store;
}

/**
 * The tags a write lands at: every writable run tag, or the named tags, each held writable or
 * owned with at least `append`.
 */
function resolveWriteScope(options: KnowledgeWriteToolsOptions, requested?: string[]): KnowledgeScope {
  if (!requested) {
    const readOnly = options.readOnly ?? [];
    const writable = options.scope.filter(tag => !readOnly.includes(tag));
    if (writable.length === 0) throw new Error('This run holds no writable scope tags.');
    return writable;
  }
  return resolveNamedScope(requested, options, 'append');
}

/** The run reaches every tag of `scope` with at least `needed`. */
function requireVisible(
  scope: KnowledgeScope,
  options: KnowledgeWriteToolsOptions,
  label: string,
  needed: KnowledgeConcreteRole,
): void {
  requireScopeAccess(scope, options, needed, label);
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
    requireVisible(node.scope, options, 'Knowledge node', 'edit');
    return node;
  }

  async function addRecord(value: {
    node: string;
    text: string;
    scope?: string[];
    when?: string;
    kind?: string;
    nodeScope?: string;
    confirmDistinct?: boolean;
  }) {
    requireRecordTextWithinBound(value.text);
    const when = value.when ? new Date(value.when) : undefined;
    if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
    const store = await getStore(memory);
    const byId = await store.getNode(value.node);
    if (byId?.mergedInto) {
      // A merged node's id names nothing writable; never let it fall through to create a node named by the id.
      throw new Error(`Knowledge node "${value.node}" was merged into ${byId.mergedInto}; add the record there.`);
    }
    if (byId) {
      requireVisible(byId.scope, options, 'Knowledge node', 'append');
      const scope = resolveWriteScope(options, value.scope);
      const node = await ensureNodeCoversRecord(store, byId, scope);
      const record = await store.appendKnowledge({
        node: node.id,
        text: value.text,
        scope,
        sourceThreadId: options.sourceThreadId,
        ...(options.source ? { metadata: { source: options.source } } : {}),
        when,
        resolutionScope: options.scope,
        defaultScope: scope,
      });
      await vouchThreadScope(scope);
      return { node, record };
    }
    const name = value.node;
    let existing: KnowledgeNode | undefined;
    if (!value.confirmDistinct) {
      const { exact, similar } = await findSimilarNodes(store, options.scope, name);
      existing = exact;
      if (similar.length > 0) {
        throw new Error(
          `Similar nodes already exist: ${similar.map(node => `${node.id} "${node.name}"`).join(', ')}. Add the record to one of them by passing its id as node, or retry with confirmDistinct: true if this is a different thing.`,
        );
      }
    }
    if (!existing && !value.kind) {
      throw new Error(`knowledge_record op "add" creates a new node "${name}"; it needs kind.`);
    }
    const recordScope = resolveWriteScope(options, value.scope);
    const { nodeScope, scopeAddresses } = await resolveNodePlacement(memory, options, value.nodeScope, recordScope);
    const node = await ensureNodeCoversRecord(
      store,
      await store.createNode({
        name,
        kind: existing?.kind ?? value.kind!,
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
      ...(options.source ? { metadata: { source: options.source } } : {}),
      when,
      resolutionScope: options.scope,
      defaultScope: nodeScope,
    });
    await vouchThreadScope(recordScope);
    return { node, record };
  }

  async function removeRecord(recordId: string) {
    const store = await getStore(memory);
    const record = await store.getKnowledge({ id: recordId, includeDeleted: true });
    if (!record) throw new Error(`KnowledgeRecord not found: ${recordId}`);
    requireVisible(record.scope, options, 'KnowledgeRecord', 'edit');
    return store.removeKnowledge({ id: record.id, deletedBy: options.source ?? 'agent' });
  }

  async function rescopeRecord(recordId: string, requested: string[]) {
    const store = await getStore(memory);
    const record = await store.getKnowledge({ id: recordId });
    if (!record) throw new Error(`KnowledgeRecord not found: ${recordId}`);
    requireVisible(record.scope, options, 'KnowledgeRecord', 'edit');
    const scope = resolveWriteScope(options, requested);
    const node = await store.getNode(record.node);
    if (node && !node.mergedInto) await ensureNodeCoversRecord(store, node, scope);
    const rescoped = await store.rescopeKnowledge({ id: record.id, scope });
    await vouchThreadScope(scope);
    return rescoped;
  }

  async function updateNode(value: {
    node: string;
    expectedVersion: number;
    name?: string;
    kind?: string;
    description?: string | null;
    content?: string;
  }) {
    const description = value.description === null ? '' : value.description;
    if (
      value.name === undefined &&
      value.kind === undefined &&
      description === undefined &&
      value.content === undefined
    ) {
      throw new Error('knowledge_node op "update" needs at least one of name, kind, description, content.');
    }
    if (description !== undefined && estimateTokenCount(description) > MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS) {
      throw new Error(
        `Node descriptions are limited to about ${MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS} tokens. Shorten the description and retry.`,
      );
    }
    const node = await resolveWritableNode(value.node);
    const store = await getStore(memory);
    return store.updateNode({
      id: node.id,
      version: value.expectedVersion,
      ...(value.name !== undefined ? { name: value.name } : {}),
      ...(value.kind !== undefined ? { kind: value.kind } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(value.content !== undefined ? { content: value.content, resolutionScope: options.scope } : {}),
    });
  }

  async function writeNode(value: { name: string; content: string; kind?: string; scope?: string[] }) {
    const name = value.name.trim();
    const store = await getStore(memory);
    const scope = resolveWriteScope(options, value.scope);
    const resolved = await store.resolveNode({ name, scope });
    if (resolved && knowledgeScopeKey(resolved.scope) === knowledgeScopeKey(scope)) {
      throw new Error(
        `Node "${name}" already exists here (id ${resolved.id}, version ${resolved.version}). Change its content with op "update".`,
      );
    }
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

  async function mergeNodes(value: { sourceId: string; targetId: string; sourceVersion: number }) {
    const store = await getStore(memory);
    const [source, target] = await Promise.all([store.getNode(value.sourceId), store.getNode(value.targetId)]);
    if (!source || !target) throw new Error('Knowledge merge requires two existing nodes.');
    requireVisible(source.scope, options, 'Knowledge merge source', 'edit');
    requireVisible(target.scope, options, 'Knowledge merge target', 'edit');
    return store.mergeNodes(value);
  }

  // Each tool takes a flat object with an `op` enum, checked per op when it runs. A per-op
  // `oneOf` can't go on this wire: some providers reject a root-level union, and the Google
  // compat layer drops every sibling key of an `anyOf` (schema-compat `provider-compats/google.ts`).
  return {
    knowledge_record: createTool({
      id: 'knowledge_record',
      description:
        'Write knowledge records, the facts themselves. op "add" adds a record about a node, creating the node when none by that name exists; "remove" soft-deletes a wrong record; "rescope" moves a record to other scope tags. Provenance and capture time are stamped by code.',
      inputSchema: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['add', 'remove', 'rescope'] },
          node: {
            type: 'string',
            minLength: 1,
            description: 'add: the id of an existing node, or the name of the node the record is about.',
          },
          text: recordTextSchema,
          when: dateTimeSchema,
          scope: scopeTagsSchema,
          kind: { type: 'string', minLength: 1, description: 'add, new node only: what kind of thing the node is.' },
          nodeScope: nodePlacementSchema,
          confirmDistinct: {
            type: 'boolean',
            description:
              'add, new node only: set true only after a previous call reported similar existing nodes and this node is genuinely a different thing.',
          },
          recordId: { type: 'string', minLength: 1, description: 'remove, rescope: the record to change.' },
        },
        required: ['op'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          op: 'add' | 'remove' | 'rescope';
          node?: string;
          text?: string;
          when?: string;
          scope?: string[];
          kind?: string;
          nodeScope?: string;
          confirmDistinct?: boolean;
          recordId?: string;
        };
        switch (value.op) {
          case 'add':
            return addRecord({
              ...value,
              node: requireField(value.node, 'knowledge_record', 'add', 'node'),
              text: requireField(value.text, 'knowledge_record', 'add', 'text'),
            });
          case 'remove':
            return removeRecord(requireField(value.recordId, 'knowledge_record', 'remove', 'recordId'));
          case 'rescope':
            return rescopeRecord(
              requireField(value.recordId, 'knowledge_record', 'rescope', 'recordId'),
              requireField(value.scope, 'knowledge_record', 'rescope', 'scope'),
            );
          default:
            throw new Error(`knowledge_record has no op "${String(value.op)}".`);
        }
      },
    }),
    knowledge_node: createTool({
      id: 'knowledge_node',
      description:
        'Change knowledge nodes, the things records are about. op "update" edits name, kind, description and content in one compare-and-swap; "write" creates a long-form node such as a spec or runbook; "merge" folds a duplicate node into another.',
      inputSchema: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['update', 'write', 'merge'] },
          node: { type: 'string', minLength: 1, description: 'update: the node id.' },
          expectedVersion: {
            type: 'integer',
            minimum: 1,
            description: 'update: the version you read; the edit fails if the node changed since.',
          },
          name: { type: 'string', minLength: 1, description: 'update: the new name. write: the node name.' },
          kind: { type: 'string', minLength: 1 },
          description: {
            type: ['string', 'null'],
            description: `update: one or two plain-text sentences describing the node, targeting 40-75 tokens. Hard limit about ${MAX_KNOWLEDGE_NODE_DESCRIPTION_TOKENS} tokens. Long-form detail belongs in content. null or an empty string clears it.`,
          },
          content: {
            type: 'string',
            minLength: 1,
            description: 'update, write: long-form content, replacing what the node had.',
          },
          scope: scopeTagsSchema,
          sourceId: { type: 'string', minLength: 1, description: 'merge: the duplicate node.' },
          sourceVersion: { type: 'integer', minimum: 1, description: 'merge: the version of the duplicate you read.' },
          targetId: { type: 'string', minLength: 1, description: 'merge: the node to keep.' },
        },
        required: ['op'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          op: 'update' | 'write' | 'merge';
          node?: string;
          expectedVersion?: number;
          name?: string;
          kind?: string;
          description?: string | null;
          content?: string;
          scope?: string[];
          sourceId?: string;
          sourceVersion?: number;
          targetId?: string;
        };
        switch (value.op) {
          case 'update':
            return updateNode({
              node: requireField(value.node, 'knowledge_node', 'update', 'node'),
              expectedVersion: requireField(value.expectedVersion, 'knowledge_node', 'update', 'expectedVersion'),
              name: value.name,
              kind: value.kind,
              description: value.description,
              content: value.content,
            });
          case 'write':
            return writeNode({
              name: requireField(value.name, 'knowledge_node', 'write', 'name'),
              content: requireField(value.content, 'knowledge_node', 'write', 'content'),
              kind: value.kind,
              scope: value.scope,
            });
          case 'merge':
            return mergeNodes({
              sourceId: requireField(value.sourceId, 'knowledge_node', 'merge', 'sourceId'),
              sourceVersion: requireField(value.sourceVersion, 'knowledge_node', 'merge', 'sourceVersion'),
              targetId: requireField(value.targetId, 'knowledge_node', 'merge', 'targetId'),
            });
          default:
            throw new Error(`knowledge_node has no op "${String(value.op)}".`);
        }
      },
    }),
  };
}

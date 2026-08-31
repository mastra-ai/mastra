import type { KnowledgeScopeIds, KnowledgeStorage } from '@mastra/core/storage';
import { isKnowledgeScopeVisible, KnowledgeConflictError } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

type SubconsciousScopeSelection = 'org' | 'resource' | 'thread';

const CURATOR_IDENTITY = 'subconscious:curate';
export const MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH = 400;
const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: ['resource', 'thread'] };
const dateTimeSchema: JSONSchema7 = {
  type: 'string',
  format: 'date-time',
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$',
  description: 'RFC 3339 date-time, e.g. 2026-09-15T00:00:00Z',
};

type KnowledgeWriteToolsMemory = {
  getKnowledgeStore?: () => Promise<KnowledgeStorage>;
  storage?: {
    getStore(name: 'knowledge'): Promise<KnowledgeStorage | undefined>;
  };
};

export interface KnowledgeWriteToolsOptions {
  scopeIds: KnowledgeScopeIds;
  sourceThreadId: string;
}

async function getStore(memory: KnowledgeWriteToolsMemory): Promise<KnowledgeStorage> {
  if (memory.getKnowledgeStore) return memory.getKnowledgeStore();
  const store = await memory.storage?.getStore('knowledge');
  if (!store) throw new Error('Knowledge write tools require a configured knowledge storage domain.');
  return store;
}

function resolveWriteScopeIds(
  options: KnowledgeWriteToolsOptions,
  scope: Exclude<SubconsciousScopeSelection, 'org'> = 'thread',
): KnowledgeScopeIds {
  return [options.scopeIds[scope === 'resource' ? 1 : 2]!];
}

async function requireVisible(
  store: KnowledgeStorage,
  type: 'node' | 'record',
  id: string,
  options: KnowledgeWriteToolsOptions,
): Promise<void> {
  const visibleScopeIds = options.scopeIds.slice(1);
  const visible =
    type === 'node'
      ? isKnowledgeScopeVisible(await store.getNodeScopeIds(id), visibleScopeIds)
      : Boolean(await store.getVisibleRecord({ id, scopeIds: visibleScopeIds, includeDeleted: true }));
  if (!visible) throw new Error(`${type === 'node' ? 'Knowledge node' : 'KnowledgeRecord'} not found: ${id}`);
}

export function createKnowledgeWriteTools(
  memory: KnowledgeWriteToolsMemory,
  options: KnowledgeWriteToolsOptions,
): Record<string, ToolAction<any, any, any>> {
  async function resolveWritableNode(id: string) {
    const store = await getStore(memory);
    const node = await store.getNode(id);
    if (!node) throw new Error(`Knowledge node not found: ${id}`);
    await requireVisible(store, 'node', node.id, options, 'Knowledge node');
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
          text: { type: 'string', minLength: 1 },
          nodeScope: scopeLevelSchema,
          scope: scopeLevelSchema,
          when: dateTimeSchema,
        },
        required: ['name', 'kind', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          name: string;
          kind: string;
          text: string;
          nodeScope?: SubconsciousScopeSelection;
          scope?: SubconsciousScopeSelection;
          when?: string;
        };
        const store = await getStore(memory);
        const nodeScope = resolveWriteScopeIds(options, value.nodeScope);
        const recordScope = resolveWriteScopeIds(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        return store.createNodeWithRecord({
          node: { name: value.name, kind: value.kind, scopeIds: nodeScope },
          record: {
            text: value.text,
            scopeIds: recordScope,
            source: CURATOR_IDENTITY,
            metadata: { sourceThreadId: options.sourceThreadId, ...(when ? { when: when.toISOString() } : {}) },
            resolutionScopeIds: options.scopeIds,
          },
        });
      },
    }),
    knowledge_append: createTool({
      id: 'knowledge_append',
      description: 'Append a scoped record to an existing node. Provenance and capture time are stamped by code.',
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          text: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          when: dateTimeSchema,
        },
        required: ['node', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          node: string;
          text: string;
          scope?: Exclude<SubconsciousScopeSelection, 'org'>;
          when?: string;
        };
        const store = await getStore(memory);
        const parent = await store.getNode(value.node);
        if (!parent) throw new Error(`Knowledge node not found: ${value.node}`);
        await requireVisible(store, 'node', parent.id, options);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        return store.createRecord({
          node: parent,
          text: value.text,
          scopeIds: resolveWriteScopeIds(options, value.scope),
          resolutionScopeIds: options.scopeIds,
          source: CURATOR_IDENTITY,
          metadata: { sourceThreadId: options.sourceThreadId, ...(when ? { when: when.toISOString() } : {}) },
        });
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
        const id = (input as { recordId: string }).recordId;
        const record = await store.getRecord({ id, includeDeleted: true });
        if (!record) throw new Error(`KnowledgeRecord not found: ${id}`);
        await requireVisible(store, 'record', record.id, options);
        return store.deleteRecord({ id: record.id, version: record.version, deletedBy: CURATOR_IDENTITY });
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
        const source = await store.getNode(value.sourceId);
        if (!source) throw new Error(`Knowledge node not found: ${value.sourceId}`);
        await requireVisible(store, 'node', source.id, options);
        const target = await store.getNode(value.targetId);
        if (!target) throw new Error(`Knowledge node not found: ${value.targetId}`);
        await requireVisible(store, 'node', target.id, options);
        return store.mergeNodes(value);
      },
    }),
    knowledge_rescope: createTool({
      id: 'knowledge_rescope',
      description: 'Change a record visibility scope using optimistic concurrency.',
      inputSchema: {
        type: 'object',
        properties: {
          recordId: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          scope: scopeLevelSchema,
        },
        required: ['recordId', 'expectedVersion', 'scope'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { recordId: string; expectedVersion: number; scope: Exclude<SubconsciousScopeSelection, 'org'> };
        const store = await getStore(memory);
        const record = await store.getRecord({ id: value.recordId });
        if (!record) throw new Error(`KnowledgeRecord not found: ${value.recordId}`);
        await requireVisible(store, 'record', record.id, options, 'KnowledgeRecord');
        if (record.version !== value.expectedVersion) throw new KnowledgeConflictError(record.id);
        return store.setRecordScopes({
          id: record.id,
          version: record.version,
          scopeIds: resolveWriteScopeIds(options, value.scope),
        });
      },
    }),
    knowledge_write_node_description: createTool({
      id: 'knowledge_write_node_description',
      description: `Write a bounded synopsis on an existing visible node using optimistic concurrency.`,
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          description: {
            type: 'string',
            minLength: 0,
            maxLength: MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH,
            description: `One or two plain-text sentences describing the node, targeting 40-75 tokens. Hard limit ${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code units; the length check on execution is authoritative. Long-form detail belongs in node content, not here. An empty string clears the description.`,
          },
        },
        required: ['node', 'expectedVersion', 'description'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; description: string };
        // Schema maxLength counts code points; enforce the tool's UTF-16 bound as well.
        if (value.description.length > MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH) {
          throw new Error(
            `Node descriptions are limited to ${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code units.`,
          );
        }
        const store = await getStore(memory);
        const node = await store.getNode(value.node);
        if (!node) throw new Error(`Knowledge node not found: ${value.node}`);
        await requireVisible(store, 'node', node.id, options);
        return store.updateNode({
          id: node.id,
          version: value.expectedVersion,
          metadata: { ...node.metadata, description: value.description },
        });
      },
    }),
    knowledge_write_node_content: createTool({
      id: 'knowledge_write_node_content',
      description: 'Create or replace a curator-owned long-form record on a scoped knowledge node.',
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
          scope?: Exclude<SubconsciousScopeSelection, 'org'>;
          expectedVersion?: number;
        };
        const name = value.name.trim();
        const store = await getStore(memory);
        const scopeIds = resolveWriteScopeIds(options, value.scope);
        const node = await store.resolveNode({ name, scopeIds: options.scopeIds });
        const record = {
          text: value.content,
          source: CURATOR_IDENTITY,
          scopeIds,
          resolutionScopeIds: options.scopeIds,
          metadata: { sourceThreadId: options.sourceThreadId, content: true },
        };
        if (!node) {
          if (value.expectedVersion !== undefined)
            throw new Error('expectedVersion is only valid for an existing node.');
          const created = await store.createNodeWithRecord({
            node: { name, kind: value.kind ?? 'document', scopeIds },
            record,
          });
          return created.record;
        }
        await requireVisible(store, 'node', node.id, options, 'Knowledge node');
        if (value.expectedVersion === undefined) throw new Error('Updating node content requires expectedVersion.');
        return store.replaceNodeRecords({
          node: { id: node.id, version: value.expectedVersion, kind: value.kind },
          record,
          visibilityScopeIds: options.scopeIds,
        });
      },
    }),
  };
}

import type { KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import {
  MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH,
  assertKnowledgeScopeWithinCeiling,
  expandKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
} from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

const CURATOR_IDENTITY = 'subconscious:curate';
const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: ['org', 'resource', 'thread'] };
const dateTimeSchema: JSONSchema7 = {
  type: 'string',
  format: 'date-time',
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$',
  description: 'RFC 3339 date-time, e.g. 2026-09-15T00:00:00Z',
};

type KnowledgeWriteToolsMemory = {
  storage: {
    getStore(name: 'knowledge'): Promise<KnowledgeStorage | undefined>;
  };
};

export interface KnowledgeWriteToolsOptions {
  scope: KnowledgeScope;
  sourceThreadId: string;
  defaultScope: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
}

async function getStore(memory: KnowledgeWriteToolsMemory): Promise<KnowledgeStorage> {
  const store = await memory.storage.getStore('knowledge');
  if (!store) throw new Error('Knowledge write tools require a configured knowledge storage domain.');
  return store;
}

function resolveWriteScope(options: KnowledgeWriteToolsOptions, level?: KnowledgeScopeLevel): KnowledgeScope {
  const scope = expandKnowledgeScope(options.scope, level ?? options.defaultScope);
  assertKnowledgeScopeWithinCeiling(scope, options.maxScope);
  return scope;
}

function requireVisible(scope: KnowledgeScope, options: KnowledgeWriteToolsOptions, label: string): void {
  if (!isKnowledgeScopeVisible(scope, options.scope)) {
    throw new Error(`${label} is outside the curator's visible scope.`);
  }
}

export function createKnowledgeWriteTools(
  memory: KnowledgeWriteToolsMemory,
  options: KnowledgeWriteToolsOptions,
): Record<string, ToolAction<any, any, any>> {
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
          nodeScope?: KnowledgeScopeLevel;
          scope?: KnowledgeScopeLevel;
          when?: string;
        };
        const store = await getStore(memory);
        const nodeScope = resolveWriteScope(options, value.nodeScope);
        const recordScope = resolveWriteScope(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        const node = await store.createNode({ name: value.name, kind: value.kind, scope: nodeScope });
        const record = await store.appendKnowledge({
          node: node.id,
          text: value.text,
          scope: recordScope,
          sourceThreadId: options.sourceThreadId,
          when,
          maxScope: options.maxScope,
          resolutionScope: options.scope,
          defaultScope: nodeScope,
        });
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
          text: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          when: dateTimeSchema,
        },
        required: ['node', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; text: string; scope?: KnowledgeScopeLevel; when?: string };
        const store = await getStore(memory);
        const parent = await store.getNode(value.node);
        if (!parent || parent.mergedInto) throw new Error(`Knowledge node not found: ${value.node}`);
        requireVisible(parent.scope, options, 'Knowledge node');
        const scope = resolveWriteScope(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        return store.appendKnowledge({
          node: parent.id,
          text: value.text,
          scope,
          sourceThreadId: options.sourceThreadId,
          when,
          maxScope: options.maxScope,
          resolutionScope: options.scope,
          defaultScope: expandKnowledgeScope(options.scope, options.defaultScope),
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
      description: 'Change a record visibility scope without exceeding its stamped ceiling.',
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
        assertKnowledgeScopeWithinCeiling(scope, record.maxScope);
        return store.rescopeKnowledge({ id: record.id, scope });
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
          return store.createNode({
            name,
            kind: value.kind ?? 'document',
            content: value.content,
            scope,
            resolutionScope: options.scope,
          });
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

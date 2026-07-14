import type { KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import {
  assertKnowledgeScopeWithinCeiling,
  expandKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
} from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

const CURATOR_IDENTITY = 'subconscious:curate';
const MAX_GUIDANCE_LENGTH = 8_000;
const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: ['org', 'resource', 'thread'] };

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
  return {
    knowledge_add_item: createTool({
      id: 'knowledge_add_item',
      description: 'Append a scoped item to an existing node. Provenance and capture time are stamped by code.',
      inputSchema: {
        type: 'object',
        properties: {
          parentNodeId: { type: 'string', minLength: 1 },
          text: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          when: { type: 'string' },
        },
        required: ['parentNodeId', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { parentNodeId: string; text: string; scope?: KnowledgeScopeLevel; when?: string };
        const store = await getStore(memory);
        const parent = await store.getNode(value.parentNodeId);
        if (!parent || parent.mergedInto) throw new Error(`Knowledge node not found: ${value.parentNodeId}`);
        requireVisible(parent.scope, options, 'Knowledge node');
        const scope = resolveWriteScope(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeItem when must be a valid date.');
        return store.appendItem({
          parentNodeId: parent.id,
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
    knowledge_remove_item: createTool({
      id: 'knowledge_remove_item',
      description: 'Soft-delete a visible item. Curators cannot restore or physically erase KnowledgeItems.',
      inputSchema: {
        type: 'object',
        properties: { itemId: { type: 'string', minLength: 1 } },
        required: ['itemId'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const store = await getStore(memory);
        const item = await store.getItem({ id: (input as { itemId: string }).itemId, includeDeleted: true });
        if (!item) throw new Error(`KnowledgeItem not found: ${(input as { itemId: string }).itemId}`);
        requireVisible(item.scope, options, 'KnowledgeItem');
        return store.removeItem({ id: item.id, deletedBy: CURATOR_IDENTITY });
      },
    }),
    knowledge_update_node: createTool({
      id: 'knowledge_update_node',
      description: 'Update a visible node name or kind using optimistic concurrency.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
          kind: { type: 'string', minLength: 1 },
        },
        required: ['nodeId', 'expectedVersion'],
        anyOf: [{ required: ['name'] }, { required: ['kind'] }],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { nodeId: string; expectedVersion: number; name?: string; kind?: string };
        const store = await getStore(memory);
        const node = await store.getNode(value.nodeId);
        if (!node || node.mergedInto) throw new Error(`Knowledge node not found: ${value.nodeId}`);
        requireVisible(node.scope, options, 'Knowledge node');
        return store.updateNode({
          id: node.id,
          version: value.expectedVersion,
          name: value.name,
          kind: value.kind,
        });
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
    knowledge_rescope_item: createTool({
      id: 'knowledge_rescope_item',
      description: 'Change a item visibility scope without exceeding its stamped ceiling.',
      inputSchema: {
        type: 'object',
        properties: { itemId: { type: 'string', minLength: 1 }, scope: scopeLevelSchema },
        required: ['itemId', 'scope'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { itemId: string; scope: KnowledgeScopeLevel };
        const store = await getStore(memory);
        const item = await store.getItem({ id: value.itemId });
        if (!item) throw new Error(`KnowledgeItem not found: ${value.itemId}`);
        requireVisible(item.scope, options, 'KnowledgeItem');
        const scope = resolveWriteScope(options, value.scope);
        assertKnowledgeScopeWithinCeiling(scope, item.maxScope);
        return store.rescopeItem({ id: item.id, scope });
      },
    }),
    knowledge_write_node_content: createTool({
      id: 'knowledge_write_node_content',
      description: 'Create or replace long-form content on a scoped knowledge node. Existing nodes require expectedVersion.',
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
        if (value.name.trim().toLowerCase() === 'capture-guidance' && value.content.length > MAX_GUIDANCE_LENGTH) {
          throw new Error(`capture-guidance is limited to ${MAX_GUIDANCE_LENGTH} characters.`);
        }
        const store = await getStore(memory);
        const scope = resolveWriteScope(options, value.scope);
        const resolvedNode = await store.resolveNode({ name: value.name, scope });
        const existing =
          resolvedNode && knowledgeScopeKey(resolvedNode.scope) === knowledgeScopeKey(scope) ? resolvedNode : null;
        if (!existing) {
          if (value.expectedVersion !== undefined)
            throw new Error('expectedVersion is only valid for an existing node.');
          return store.createNode({
            name: value.name,
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

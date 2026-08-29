import type { KnowledgeScopeIds, KnowledgeStorage } from '@mastra/core/storage';
import { isKnowledgeScopeVisible } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { SubconsciousScopeSelection } from './types';

const CURATOR_IDENTITY = 'subconscious:curate';
export const MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH = 1_000;
const MAX_GUIDANCE_LENGTH = 4_000;
const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: ['org', 'resource', 'thread'] };

type KnowledgeWriteToolsMemory = { getKnowledgeStore?: () => Promise<KnowledgeStorage> };

export interface KnowledgeWriteToolsOptions {
  scopeIds: KnowledgeScopeIds;
  sourceThreadId: string;
}

async function getStore(memory: KnowledgeWriteToolsMemory): Promise<KnowledgeStorage> {
  if (!memory.getKnowledgeStore) throw new Error('Knowledge write tools require a configured Knowledge instance.');
  return memory.getKnowledgeStore();
}

function resolveWriteScopeIds(
  options: KnowledgeWriteToolsOptions,
  scope: SubconsciousScopeSelection = 'thread',
): KnowledgeScopeIds {
  return [options.scopeIds[scope === 'org' ? 0 : scope === 'resource' ? 1 : 2]!];
}

async function requireVisible(
  store: KnowledgeStorage,
  type: 'node' | 'record',
  id: string,
  options: KnowledgeWriteToolsOptions,
  label: string,
): Promise<void> {
  const scopeIds = type === 'node' ? await store.getNodeScopeIds(id) : await store.getRecordScopeIds(id);
  if (!isKnowledgeScopeVisible(scopeIds, options.scopeIds))
    throw new Error(`${label} is outside the curator's visible scope.`);
}

export function createKnowledgeWriteTools(
  memory: KnowledgeWriteToolsMemory,
  options: KnowledgeWriteToolsOptions,
): Record<string, ToolAction<any, any, any>> {
  return {
    knowledge_append: createTool({
      id: 'knowledge_append',
      description: 'Append a scoped record to an existing node. Provenance and capture time are stamped by code.',
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          text: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          when: { type: 'string' },
        },
        required: ['node', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; text: string; scope?: SubconsciousScopeSelection; when?: string };
        const store = await getStore(memory);
        const parent = await store.getNode(value.node);
        if (!parent) throw new Error(`Knowledge node not found: ${value.node}`);
        await requireVisible(store, 'node', parent.id, options, 'Knowledge node');
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        return store.createRecord({
          node: parent,
          text: value.text,
          scopeIds: resolveWriteScopeIds(options, value.scope),
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
        await requireVisible(store, 'record', record.id, options, 'KnowledgeRecord');
        return store.deleteRecord({ id: record.id, deletedBy: CURATOR_IDENTITY });
      },
    }),
    knowledge_update_node: createTool({
      id: 'knowledge_update_node',
      description: 'Update a visible node name or kind using optimistic concurrency.',
      inputSchema: {
        type: 'object',
        properties: {
          node: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
          kind: { type: 'string', minLength: 1 },
        },
        required: ['node', 'expectedVersion'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; name?: string; kind?: string };
        if (value.name === undefined && value.kind === undefined)
          throw new Error('knowledge_update_node requires at least one of: name, kind.');
        const store = await getStore(memory);
        const node = await store.getNode(value.node);
        if (!node) throw new Error(`Knowledge node not found: ${value.node}`);
        await requireVisible(store, 'node', node.id, options, 'Knowledge node');
        return store.updateNode({ id: node.id, version: value.expectedVersion, name: value.name, kind: value.kind });
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
        await Promise.all([
          requireVisible(store, 'node', source.id, options, 'Knowledge merge source'),
          requireVisible(store, 'node', target.id, options, 'Knowledge merge target'),
        ]);
        return store.mergeNodes(value);
      },
    }),
    knowledge_rescope: createTool({
      id: 'knowledge_rescope',
      description: 'Change a record visibility scope.',
      inputSchema: {
        type: 'object',
        properties: { recordId: { type: 'string', minLength: 1 }, scope: scopeLevelSchema },
        required: ['recordId', 'scope'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { recordId: string; scope: SubconsciousScopeSelection };
        const store = await getStore(memory);
        const record = await store.getRecord({ id: value.recordId });
        if (!record) throw new Error(`KnowledgeRecord not found: ${value.recordId}`);
        await requireVisible(store, 'record', record.id, options, 'KnowledgeRecord');
        return store.setRecordScopes({ id: record.id, scopeIds: resolveWriteScopeIds(options, value.scope) });
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
          description: { type: 'string', minLength: 0, maxLength: MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH },
        },
        required: ['node', 'expectedVersion', 'description'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { node: string; expectedVersion: number; description: string };
        if (value.description.length > MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH)
          throw new Error(
            `Node descriptions are limited to ${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code units.`,
          );
        const store = await getStore(memory);
        const node = await store.getNode(value.node);
        if (!node) throw new Error(`Knowledge node not found: ${value.node}`);
        await requireVisible(store, 'node', node.id, options, 'Knowledge node');
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
          scope?: SubconsciousScopeSelection;
          expectedVersion?: number;
        };
        const name = value.name.trim().toLowerCase() === 'capture-guidance' ? 'capture-guidance' : value.name.trim();
        if (name === 'capture-guidance' && value.content.length > MAX_GUIDANCE_LENGTH)
          throw new Error(`capture-guidance is limited to ${MAX_GUIDANCE_LENGTH} characters.`);
        const store = await getStore(memory);
        const scopeIds = resolveWriteScopeIds(options, value.scope);
        let node = await store.resolveNode({ name, scopeIds: options.scopeIds });
        if (!node) {
          if (value.expectedVersion !== undefined)
            throw new Error('expectedVersion is only valid for an existing node.');
          node = await store.createNode({ name, kind: value.kind ?? 'document', scopeIds });
        } else {
          await requireVisible(store, 'node', node.id, options, 'Knowledge node');
          if (value.expectedVersion === undefined) throw new Error('Updating node content requires expectedVersion.');
          node = await store.updateNode({ id: node.id, version: value.expectedVersion, kind: value.kind });
          const prior = await store.listRecordsBySource({
            source: CURATOR_IDENTITY,
            scopeIds: options.scopeIds,
            limit: 100,
          });
          await Promise.all(
            prior.records
              .filter(record => record.nodeId === node!.id && !record.deletedAt)
              .map(record => store.deleteRecord({ id: record.id, deletedBy: CURATOR_IDENTITY })),
          );
        }
        return store.createRecord({
          node,
          text: value.content,
          source: CURATOR_IDENTITY,
          scopeIds,
          metadata: { sourceThreadId: options.sourceThreadId, content: true },
        });
      },
    }),
  };
}

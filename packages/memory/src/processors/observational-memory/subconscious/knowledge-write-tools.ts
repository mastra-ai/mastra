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
    knowledge_add_fact: createTool({
      id: 'knowledge_add_fact',
      description: 'Append a scoped fact to an existing entity. Provenance and capture time are stamped by code.',
      inputSchema: {
        type: 'object',
        properties: {
          parentEntityId: { type: 'string', minLength: 1 },
          text: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          when: { type: 'string' },
        },
        required: ['parentEntityId', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { parentEntityId: string; text: string; scope?: KnowledgeScopeLevel; when?: string };
        const store = await getStore(memory);
        const parent = await store.getEntity(value.parentEntityId);
        if (!parent || parent.mergedInto) throw new Error(`Knowledge entity not found: ${value.parentEntityId}`);
        requireVisible(parent.scope, options, 'Knowledge entity');
        const scope = resolveWriteScope(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('Knowledge fact when must be a valid date.');
        return store.appendFact({
          parentEntityId: parent.id,
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
    knowledge_remove_fact: createTool({
      id: 'knowledge_remove_fact',
      description: 'Soft-delete a visible fact. Curators cannot restore or physically erase facts.',
      inputSchema: {
        type: 'object',
        properties: { factId: { type: 'string', minLength: 1 } },
        required: ['factId'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const store = await getStore(memory);
        const fact = await store.getFact({ id: (input as { factId: string }).factId, includeDeleted: true });
        if (!fact) throw new Error(`Knowledge fact not found: ${(input as { factId: string }).factId}`);
        requireVisible(fact.scope, options, 'Knowledge fact');
        return store.removeFact({ id: fact.id, deletedBy: CURATOR_IDENTITY });
      },
    }),
    knowledge_update_entity: createTool({
      id: 'knowledge_update_entity',
      description: 'Update a visible entity name or kind using optimistic concurrency.',
      inputSchema: {
        type: 'object',
        properties: {
          entityId: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
          kind: { type: 'string', minLength: 1, not: { const: 'page' } },
        },
        required: ['entityId', 'expectedVersion'],
        anyOf: [{ required: ['name'] }, { required: ['kind'] }],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { entityId: string; expectedVersion: number; name?: string; kind?: string };
        const store = await getStore(memory);
        const entity = await store.getEntity(value.entityId);
        if (!entity || entity.mergedInto) throw new Error(`Knowledge entity not found: ${value.entityId}`);
        requireVisible(entity.scope, options, 'Knowledge entity');
        return store.updateEntity({
          id: entity.id,
          version: value.expectedVersion,
          name: value.name,
          kind: value.kind,
        });
      },
    }),
    knowledge_merge_entities: createTool({
      id: 'knowledge_merge_entities',
      description: 'Merge a visible duplicate entity into another visible entity using source-version CAS.',
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
        const [source, target] = await Promise.all([store.getEntity(value.sourceId), store.getEntity(value.targetId)]);
        if (!source || !target) throw new Error('Knowledge merge requires two existing entities.');
        requireVisible(source.scope, options, 'Knowledge merge source');
        requireVisible(target.scope, options, 'Knowledge merge target');
        return store.mergeEntities(value);
      },
    }),
    knowledge_rescope: createTool({
      id: 'knowledge_rescope',
      description: 'Change a fact visibility scope without exceeding its stamped ceiling.',
      inputSchema: {
        type: 'object',
        properties: { factId: { type: 'string', minLength: 1 }, scope: scopeLevelSchema },
        required: ['factId', 'scope'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { factId: string; scope: KnowledgeScopeLevel };
        const store = await getStore(memory);
        const fact = await store.getFact({ id: value.factId });
        if (!fact) throw new Error(`Knowledge fact not found: ${value.factId}`);
        requireVisible(fact.scope, options, 'Knowledge fact');
        const scope = resolveWriteScope(options, value.scope);
        assertKnowledgeScopeWithinCeiling(scope, fact.maxScope);
        return store.rescopeFact({ id: fact.id, scope });
      },
    }),
    knowledge_write_page: createTool({
      id: 'knowledge_write_page',
      description: 'Create or replace a scoped curated page. Existing pages require expectedVersion.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          body: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          expectedVersion: { type: 'integer', minimum: 1 },
        },
        required: ['name', 'body'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          name: string;
          body: string;
          scope?: KnowledgeScopeLevel;
          expectedVersion?: number;
        };
        if (value.name.trim().toLowerCase() === 'capture-guidance' && value.body.length > MAX_GUIDANCE_LENGTH) {
          throw new Error(`capture-guidance is limited to ${MAX_GUIDANCE_LENGTH} characters.`);
        }
        const store = await getStore(memory);
        const scope = resolveWriteScope(options, value.scope);
        const resolvedPage = await store.getPageByName({ name: value.name, scope });
        const existing =
          resolvedPage && knowledgeScopeKey(resolvedPage.scope) === knowledgeScopeKey(scope) ? resolvedPage : null;
        if (!existing) {
          if (value.expectedVersion !== undefined)
            throw new Error('expectedVersion is only valid for an existing page.');
          return store.createPage({ name: value.name, body: value.body, scope });
        }
        if (value.expectedVersion === undefined) throw new Error('Updating a page requires expectedVersion.');
        return store.updatePage({
          id: existing.id,
          version: value.expectedVersion,
          body: value.body,
          resolutionScope: options.scope,
        });
      },
    }),
  };
}

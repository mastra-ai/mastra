import type { Knowledge } from '@mastra/core/knowledge';
import type { KnowledgeScopeIds } from '@mastra/core/storage';
import { KnowledgeNotFoundError } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

type SubconsciousScopeSelection = 'org' | 'resource' | 'thread';

const CURATOR_IDENTITY = 'subconscious:curate';
export const MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH = 400;
const SCOPE_RUNGS = ['resource', 'thread'] as const;
const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: [...SCOPE_RUNGS] };
const nodePlacementSchema: JSONSchema7 = {
  type: 'string',
  description:
    "Placement for the node: an identity rung ('resource' or 'thread'), or a structural scope address from the host-configured placement context (for example 'features:memory').",
};
const dateTimeSchema: JSONSchema7 = {
  type: 'string',
  format: 'date-time',
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$',
  description: 'RFC 3339 date-time, e.g. 2026-09-15T00:00:00Z',
};

type KnowledgeWriteToolsMemory = {
  getKnowledgeInstance?: () => Knowledge | undefined;
};

export interface KnowledgeWriteToolsOptions {
  scopeIds: KnowledgeScopeIds;
  /** Host-vouched addresses of `scopeIds`, used to bound structural placement. */
  scopeAddresses?: string[];
  sourceThreadId: string;
}

function getKnowledge(memory: KnowledgeWriteToolsMemory): Knowledge {
  const knowledge = memory.getKnowledgeInstance?.();
  if (!knowledge) throw new Error('Knowledge write tools require a configured Knowledge instance.');
  return knowledge;
}

/**
 * Writes run with the parent session's ordinary authority: the resource and thread rungs are the
 * vouched principals (the org rung is never vouched, matching the read tools), and every mutation goes
 * through the Knowledge facade, which authorizes capabilities and fences the access epoch.
 */
function vouchedScopeIds(options: KnowledgeWriteToolsOptions): KnowledgeScopeIds {
  return options.scopeIds.slice(1);
}

function resolveWriteScopeIds(
  options: KnowledgeWriteToolsOptions,
  scope: Exclude<SubconsciousScopeSelection, 'org'> = 'thread',
): KnowledgeScopeIds {
  return [options.scopeIds[scope === 'resource' ? 1 : 2]!];
}

/**
 * Resolve the node placement argument: a rung keeps identity placement; anything else is a
 * structural scope address that must be inside the host-configured frontier reachable from
 * the writer's held scopes. Structural placement is additive to the default identity rung.
 */
async function resolveNodePlacement(
  knowledge: Knowledge,
  options: KnowledgeWriteToolsOptions,
  placement: string | undefined,
): Promise<KnowledgeScopeIds> {
  if (placement === undefined || (SCOPE_RUNGS as readonly string[]).includes(placement)) {
    return resolveWriteScopeIds(options, placement as Exclude<SubconsciousScopeSelection, 'org'> | undefined);
  }
  const frontier = knowledge.__getVisibleStructureScopes(options.scopeAddresses ?? []);
  const scope = frontier.some(visible => visible.address === placement)
    ? await (await knowledge.getStorageInternal()).getScopeAddress(placement)
    : null;
  if (!scope) throw new Error(`Structural scope is outside the curator's visible scope: ${placement}`);
  return [...resolveWriteScopeIds(options), scope.scopeNodeId];
}

export function createKnowledgeWriteTools(
  memory: KnowledgeWriteToolsMemory,
  options: KnowledgeWriteToolsOptions,
): Record<string, ToolAction<any, any, any>> {
  const vouched = vouchedScopeIds(options);

  async function getVisibleNode(knowledge: Knowledge, id: string) {
    const node = await knowledge.getNode({ id, scopeIds: vouched });
    if (!node) throw new KnowledgeNotFoundError('node', id);
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
          nodeScope: nodePlacementSchema,
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
          nodeScope?: string;
          scope?: Exclude<SubconsciousScopeSelection, 'org'>;
          when?: string;
        };
        const knowledge = getKnowledge(memory);
        const nodeScope = await resolveNodePlacement(knowledge, options, value.nodeScope);
        const recordScope = resolveWriteScopeIds(options, value.scope);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        return knowledge.createNodeWithRecord({
          vouchedScopeIds: vouched,
          node: { name: value.name, kind: value.kind, scopeIds: nodeScope },
          record: {
            text: value.text,
            scopeIds: recordScope,
            source: CURATOR_IDENTITY,
            metadata: { sourceThreadId: options.sourceThreadId, ...(when ? { when: when.toISOString() } : {}) },
            resolutionScopeIds: vouched,
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
        const knowledge = getKnowledge(memory);
        const parent = await getVisibleNode(knowledge, value.node);
        const when = value.when ? new Date(value.when) : undefined;
        if (when && Number.isNaN(when.getTime())) throw new Error('KnowledgeRecord when must be a valid date.');
        return knowledge.createRecord({
          vouchedScopeIds: vouched,
          node: parent,
          text: value.text,
          scopeIds: resolveWriteScopeIds(options, value.scope),
          resolutionScopeIds: vouched,
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
        const knowledge = getKnowledge(memory);
        const id = (input as { recordId: string }).recordId;
        const record = await knowledge.getRecord({ id, scopeIds: vouched, includeDeleted: true });
        if (!record) throw new KnowledgeNotFoundError('record', id);
        return knowledge.deleteRecord({
          id: record.id,
          version: record.version,
          deletedBy: CURATOR_IDENTITY,
          vouchedScopeIds: vouched,
        });
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
        const knowledge = getKnowledge(memory);
        const node = await getVisibleNode(knowledge, value.node);
        return knowledge.updateNode({
          id: node.id,
          version: value.expectedVersion,
          name: value.name,
          kind: value.kind,
          vouchedScopeIds: vouched,
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
        const knowledge = getKnowledge(memory);
        const node = await getVisibleNode(knowledge, value.node);
        return knowledge.updateNode({
          id: node.id,
          version: value.expectedVersion,
          name: value.name,
          vouchedScopeIds: vouched,
        });
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
        const knowledge = getKnowledge(memory);
        const node = await getVisibleNode(knowledge, value.node);
        return knowledge.updateNode({
          id: node.id,
          version: value.expectedVersion,
          kind: value.kind,
          vouchedScopeIds: vouched,
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
        const knowledge = getKnowledge(memory);
        const source = await getVisibleNode(knowledge, value.sourceId);
        const target = await getVisibleNode(knowledge, value.targetId);
        return knowledge.mergeNodes({
          sourceId: source.id,
          targetId: target.id,
          sourceVersion: value.sourceVersion,
          vouchedScopeIds: vouched,
        });
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
        const value = input as {
          recordId: string;
          expectedVersion: number;
          scope: Exclude<SubconsciousScopeSelection, 'org'>;
        };
        const knowledge = getKnowledge(memory);
        return knowledge.setRecordScopes({
          id: value.recordId,
          version: value.expectedVersion,
          scopeIds: resolveWriteScopeIds(options, value.scope),
          vouchedScopeIds: vouched,
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
        const knowledge = getKnowledge(memory);
        const node = await getVisibleNode(knowledge, value.node);
        return knowledge.updateNode({
          id: node.id,
          version: value.expectedVersion,
          metadata: { ...node.metadata, description: value.description },
          vouchedScopeIds: vouched,
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
        const knowledge = getKnowledge(memory);
        const scopeIds = resolveWriteScopeIds(options, value.scope);
        const node = await knowledge.resolveNode({ name, scopeIds: vouched });
        const record = {
          text: value.content,
          source: CURATOR_IDENTITY,
          scopeIds,
          resolutionScopeIds: vouched,
          metadata: { sourceThreadId: options.sourceThreadId, content: true },
        };
        if (!node) {
          if (value.expectedVersion !== undefined)
            throw new Error('expectedVersion is only valid for an existing node.');
          const created = await knowledge.createNodeWithRecord({
            vouchedScopeIds: vouched,
            node: { name, kind: value.kind ?? 'document', scopeIds },
            record,
          });
          return created.record;
        }
        if (value.expectedVersion === undefined) throw new Error('Updating node content requires expectedVersion.');
        return knowledge.replaceNodeRecords({
          node: { id: node.id, version: value.expectedVersion, kind: value.kind },
          record,
          vouchedScopeIds: vouched,
        });
      },
    }),
  };
}

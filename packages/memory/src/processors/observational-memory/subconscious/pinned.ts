import type { Knowledge } from '@mastra/core/knowledge';
import { KnowledgeNotFoundError } from '@mastra/core/storage';
import type { KnowledgeRecord, KnowledgeScopeIds } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

type PinnedScopeSelection = 'resource' | 'thread';

/** Processor id and state-signal id for the pinned-knowledge lane. */
export const SUBCONSCIOUS_PINS_STATE_ID = 'subconscious-pins';
/** Snapshot tag the model sees; the delta tag appends `-update`. */
export const PINNED_SNAPSHOT_TAG = 'pinned-knowledge';
export const PINNED_DELTA_TAG = 'pinned-knowledge-update';
/** Reserved node holding the resource's pin set. */
export const PINNED_NODE_NAME = 'pinned';
export const PINNED_NODE_KIND = 'system';
/** Budget defaults. A pin costs context every turn, so both bounds are enforced in the tool. */
export const DEFAULT_MAX_PINS = 20;
export const DEFAULT_PINNED_MAX_CHARACTERS = 2_000;
export const MAX_PINNED_MAX_CHARACTERS = 8_000;

const PIN_IDENTITY = 'subconscious:pin';

export interface PinnedKnowledgeSet {
  nodeId?: string;
  pins: KnowledgeRecord[];
}

type PinnedMemory = {
  getKnowledgeInstance?: () => Knowledge | undefined;
};

export interface PinnedToolsOptions {
  /** Full scope context for the conversation (org + resource + thread entries); the org entry is never vouched. */
  scopeIds: KnowledgeScopeIds;
  sourceThreadId: string;
  maxPins: number;
  maxCharacters: number;
}

/**
 * Pins run with the parent session's ordinary authority: the resource and thread rungs are the
 * vouched principals, so reads see only the readable frontier and writes need the matching
 * capability. The org rung is never vouched.
 */
function vouchedScopeIds(scopeIds: KnowledgeScopeIds): KnowledgeScopeIds {
  return scopeIds.slice(1);
}

function getKnowledge(memory: PinnedMemory): Knowledge {
  const knowledge = memory.getKnowledgeInstance?.();
  if (!knowledge) throw new Error('Pinned knowledge tools require a configured Knowledge instance.');
  return knowledge;
}

async function resolvePinnedNodeId(knowledge: Knowledge, scopeIds: KnowledgeScopeIds): Promise<string | undefined> {
  const node = await knowledge.resolveNode({ name: PINNED_NODE_NAME, scopeIds: vouchedScopeIds(scopeIds) });
  return node?.id;
}

/**
 * Assembles the current pin set from the session's readable frontier. Reads use the resource-bound
 * scope context, never a level-narrowed write scope, so pins written at narrower levels stay visible.
 */
export async function listPinnedKnowledge(input: {
  knowledge: Knowledge;
  scopeIds: KnowledgeScopeIds;
}): Promise<PinnedKnowledgeSet> {
  const nodeId = await resolvePinnedNodeId(input.knowledge, input.scopeIds);
  if (!nodeId) return { pins: [] };
  const pins: KnowledgeRecord[] = [];
  let after: string | undefined;
  do {
    const page = await input.knowledge.listRecords({
      node: nodeId,
      scopeIds: vouchedScopeIds(input.scopeIds),
      after,
      includeDeleted: false,
    });
    pins.push(...page.records);
    after = page.nextCursor;
  } while (after);
  return { nodeId, pins };
}

function totalCharacters(pins: KnowledgeRecord[]): number {
  return pins.reduce((sum, pin) => sum + pin.text.length, 0);
}

function assertBudget(
  options: PinnedToolsOptions,
  pins: KnowledgeRecord[],
  incomingText: string,
  replacing?: KnowledgeRecord,
): void {
  const kept = replacing ? pins.filter(pin => pin.id !== replacing.id) : pins;
  if (!replacing && kept.length >= options.maxPins) {
    throw new Error(`Pin limit reached: the set holds at most ${options.maxPins}. Unpin something first.`);
  }
  if (totalCharacters(kept) + incomingText.length > options.maxCharacters) {
    throw new Error(`Pin budget exceeded: the pin set is limited to ${options.maxCharacters} characters in total.`);
  }
}

function resolveWriteScope(scopeIds: KnowledgeScopeIds, scope: PinnedScopeSelection = 'resource'): KnowledgeScopeIds {
  return [scopeIds[scope === 'resource' ? 1 : 2]!];
}

const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: ['resource', 'thread'] };

async function writePinnedKnowledge(
  knowledge: Knowledge,
  options: PinnedToolsOptions,
  text: string,
  level?: PinnedScopeSelection,
  metadata?: Record<string, unknown>,
): Promise<KnowledgeRecord> {
  const { scopeIds } = options;
  const { nodeId, pins } = await listPinnedKnowledge({ knowledge, scopeIds });
  assertBudget(options, pins, text);
  const vouched = vouchedScopeIds(scopeIds);
  const record = {
    text,
    scopeIds: resolveWriteScope(scopeIds, level),
    metadata: { ...metadata, sourceThreadId: options.sourceThreadId },
    resolutionScopeIds: vouched,
  };
  if (nodeId) return knowledge.createRecord({ ...record, node: nodeId, vouchedScopeIds: vouched });
  const created = await knowledge.createNodeWithRecord({
    node: { name: PINNED_NODE_NAME, kind: PINNED_NODE_KIND, scopeIds: [scopeIds[1]!] },
    record,
    vouchedScopeIds: vouched,
  });
  return created.record;
}

async function requirePin(
  knowledge: Knowledge,
  recordId: string,
  scopeIds: KnowledgeScopeIds,
): Promise<KnowledgeRecord> {
  const record = await knowledge.getRecord({ id: recordId, scopeIds: vouchedScopeIds(scopeIds) });
  if (!record) throw new KnowledgeNotFoundError('record', recordId);
  const nodeId = await resolvePinnedNodeId(knowledge, scopeIds);
  if (!nodeId || record.nodeId !== nodeId) throw new KnowledgeNotFoundError('record', recordId);
  return record;
}

/**
 * Pin lifecycle tools. Pin appends a record on the reserved node; unpin soft-deletes it
 * (auditable, restorable); edit atomically retires the original and appends the replacement
 * (records are immutable, so an edited pin carries a new record id). Every write is authorized
 * through the Knowledge facade.
 */
export function createPinnedTools(
  memory: PinnedMemory,
  options: PinnedToolsOptions,
): Record<string, ToolAction<any, any, any>> {
  const vouched = vouchedScopeIds(options.scopeIds);
  return {
    knowledge_pin: createTool({
      id: 'knowledge_pin',
      description:
        'Pin knowledge that must stay in context every turn without being asked for. Pins cost context permanently; pin only what is unconditionally relevant.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1 },
          scope: scopeLevelSchema,
          reason: {
            type: 'string',
            minLength: 1,
            description: 'One short sentence: why this must stay in context permanently.',
          },
        },
        required: ['text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { text: string; scope?: PinnedScopeSelection; reason?: string };
        return writePinnedKnowledge(
          getKnowledge(memory),
          options,
          value.text,
          value.scope,
          value.reason ? { reason: value.reason } : undefined,
        );
      },
    }),
    knowledge_unpin: createTool({
      id: 'knowledge_unpin',
      description: 'Remove a pin. The underlying knowledge record is soft-deleted and drops out of the pinned context.',
      inputSchema: {
        type: 'object',
        properties: { recordId: { type: 'string', minLength: 1 } },
        required: ['recordId'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const knowledge = getKnowledge(memory);
        const record = await requirePin(knowledge, (input as { recordId: string }).recordId, options.scopeIds);
        return knowledge.deleteRecord({
          id: record.id,
          version: record.version,
          deletedBy: PIN_IDENTITY,
          vouchedScopeIds: vouched,
        });
      },
    }),
    knowledge_edit_pin: createTool({
      id: 'knowledge_edit_pin',
      description: 'Replace the text of an existing pin. The replacement carries a new knowledge record id.',
      inputSchema: {
        type: 'object',
        properties: {
          recordId: { type: 'string', minLength: 1 },
          text: { type: 'string', minLength: 1 },
          reason: {
            type: 'string',
            minLength: 1,
            description: 'One short sentence: why this must stay in context permanently.',
          },
        },
        required: ['recordId', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { recordId: string; text: string; reason?: string };
        const knowledge = getKnowledge(memory);
        const record = await requirePin(knowledge, value.recordId, options.scopeIds);
        const { pins } = await listPinnedKnowledge({ knowledge, scopeIds: options.scopeIds });
        assertBudget(options, pins, value.text, record);
        const recordScopeIds = await (await knowledge.getStorageInternal()).getRecordScopeIds(record.id);
        // One atomic, epoch-fenced mutation: the replacement exists only if the original is retired,
        // so a grant change mid-edit can neither duplicate nor lose the pin.
        return knowledge.replaceRecord({
          id: record.id,
          version: record.version,
          deletedBy: PIN_IDENTITY,
          record: {
            text: value.text,
            ...(record.source ? { source: record.source } : {}),
            scopeIds: recordScopeIds,
            resolutionScopeIds: vouched,
            metadata: {
              ...record.metadata,
              sourceThreadId: options.sourceThreadId,
              ...(value.reason ? { reason: value.reason } : {}),
            },
          },
          vouchedScopeIds: vouched,
        });
      },
    }),
  };
}

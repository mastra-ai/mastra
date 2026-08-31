import type { KnowledgeRecord, KnowledgeScopeIds, KnowledgeStorage } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import { getKnowledgeStore } from './knowledge-tools';
import type { KnowledgeStoreMemory } from './knowledge-tools';
import type { SubconsciousCaptureScope } from './types';

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

type PinnedMemory = KnowledgeStoreMemory;

export interface PinnedToolsOptions {
  /** Ordered scope context for the conversation; reads exclude the organization entry. */
  scopeIds: KnowledgeScopeIds;
  sourceThreadId: string;
  maxPins: number;
  maxCharacters: number;
}

function pinnedNodeScope(scopeIds: KnowledgeScopeIds): KnowledgeScopeIds {
  return [scopeIds[1]!];
}

// Resolution walks the resource-bound scope levels, so the node is found wherever it was
// created without granting the subconscious agent organization-wide visibility.
async function resolvePinnedNodeId(store: KnowledgeStorage, scopeIds: KnowledgeScopeIds): Promise<string | undefined> {
  const node = await store.resolveNode({ name: PINNED_NODE_NAME, scopeIds: scopeIds.slice(1) });
  return node?.id;
}

/** Reuse the node wherever it is visible; otherwise create it. `createNode` is an idempotent upsert on (name, scope). */
async function ensurePinnedNodeId(store: KnowledgeStorage, scopeIds: KnowledgeScopeIds): Promise<string> {
  const existing = await resolvePinnedNodeId(store, scopeIds);
  if (existing) return existing;
  const node = await store.createNode({
    name: PINNED_NODE_NAME,
    kind: PINNED_NODE_KIND,
    scopeIds: pinnedNodeScope(scopeIds),
  });
  return node.id;
}

/**
 * Assembles the current pin set.
 *
 * Reads use the resource-bound scope context, never a level-narrowed write scope, so querying
 * at the node's level does not drop pins written at narrower levels. Deleted records are
 * excluded explicitly.
 */
export async function listPinnedKnowledge(input: {
  store: KnowledgeStorage;
  scopeIds: KnowledgeScopeIds;
}): Promise<PinnedKnowledgeSet> {
  const nodeId = await resolvePinnedNodeId(input.store, input.scopeIds);
  if (!nodeId) return { pins: [] };
  const pins: KnowledgeRecord[] = [];
  let after: string | undefined;
  do {
    const page = await input.store.listRecords({
      node: nodeId,
      scopeIds: input.scopeIds.slice(1),
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

function resolveWriteScope(
  options: PinnedToolsOptions,
  scope: SubconsciousCaptureScope = 'resource',
): KnowledgeScopeIds {
  return [options.scopeIds[scope === 'resource' ? 1 : 2]!];
}

const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: ['resource', 'thread'] };

/** Shared pin write path used by the tool and capture-time pinning. */
export async function writePinnedKnowledge(
  store: KnowledgeStorage,
  options: PinnedToolsOptions,
  text: string,
  level?: SubconsciousCaptureScope,
  metadata?: Record<string, unknown>,
): Promise<KnowledgeRecord> {
  const { pins } = await listPinnedKnowledge({ store, scopeIds: options.scopeIds });
  assertBudget(options, pins, text);
  const nodeId = await ensurePinnedNodeId(store, options.scopeIds);
  return store.createRecord({
    node: nodeId,
    text,
    scopeIds: resolveWriteScope(options, level),
    metadata: { ...metadata, sourceThreadId: options.sourceThreadId },
  });
}

async function getStore(memory: PinnedMemory): Promise<KnowledgeStorage> {
  return getKnowledgeStore(memory);
}

async function requirePin(
  store: KnowledgeStorage,
  recordId: string,
  options: PinnedToolsOptions,
): Promise<KnowledgeRecord> {
  const record = await store.getVisibleRecord({ id: recordId, scopeIds: options.scopeIds.slice(1) });
  if (!record) throw new Error(`Pin not found: ${recordId}`);
  const nodeId = await resolvePinnedNodeId(store, options.scopeIds);
  if (!nodeId || record.nodeId !== nodeId) throw new Error(`Record is not a pin: ${recordId}`);
  return record;
}

/**
 * Pin lifecycle tools. Pin appends a record on the reserved node; unpin soft-deletes it
 * (auditable, restorable); edit is remove plus append because knowledge records are immutable,
 * so an edited pin carries a new record id.
 */
export function createPinnedTools(
  memory: PinnedMemory,
  options: PinnedToolsOptions,
): Record<string, ToolAction<any, any, any>> {
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
        const value = input as { text: string; scope?: SubconsciousCaptureScope; reason?: string };
        const store = await getStore(memory);
        return writePinnedKnowledge(
          store,
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
        const store = await getStore(memory);
        const record = await requirePin(store, (input as { recordId: string }).recordId, options);
        return store.deleteRecord({ id: record.id, deletedBy: PIN_IDENTITY });
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
        const store = await getStore(memory);
        const record = await requirePin(store, value.recordId, options);
        const { pins } = await listPinnedKnowledge({ store, scopeIds: options.scopeIds });
        assertBudget(options, pins, value.text, record);
        await store.deleteRecord({ id: record.id, deletedBy: PIN_IDENTITY });
        return store.createRecord({
          node: record.nodeId,
          text: value.text,
          scopeIds: await store.getRecordScopeIds(record.id),
          metadata: {
            ...record.metadata,
            sourceThreadId: options.sourceThreadId,
            ...(value.reason ? { reason: value.reason } : {}),
          },
        });
      },
    }),
  };
}

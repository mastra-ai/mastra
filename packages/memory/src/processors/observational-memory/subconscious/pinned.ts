import type { KnowledgeRecord, KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import { assertKnowledgeScopeWithinCeiling, expandKnowledgeScope, isKnowledgeScopeVisible } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

/** Processor id and state-signal id for the pinned-knowledge lane. */
export const SUBCONSCIOUS_PINS_STATE_ID = 'subconscious-pins';
/** Snapshot tag the model sees; the delta tag appends `-update`. */
export const PINNED_SNAPSHOT_TAG = 'pinned-knowledge';
export const PINNED_DELTA_TAG = 'pinned-knowledge-update';
/** Reserved node holding the pin set. One record, at one fixed scope level. */
export const PINNED_NODE_NAME = 'pinned';
export const PINNED_NODE_KIND = 'system';
export const PINNED_NODE_SCOPE_LEVEL: KnowledgeScopeLevel = 'resource';
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
  storage: {
    getStore(name: 'knowledge'): Promise<KnowledgeStorage | undefined>;
  };
};

export interface PinnedToolsOptions {
  /** Full visible scope context for the conversation (org + resource + thread entries). */
  scope: KnowledgeScope;
  sourceThreadId: string;
  defaultScope: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  maxPins: number;
  maxCharacters: number;
}

// The node sits at the resource level unless a `maxScope` ceiling narrows it
// to the thread; creating a resource-level record under a thread ceiling would
// bypass the ceiling.
function pinnedNodeScope(scope: KnowledgeScope, maxScope?: KnowledgeScopeLevel): KnowledgeScope {
  const level = maxScope === 'thread' ? 'thread' : PINNED_NODE_SCOPE_LEVEL;
  return expandKnowledgeScope(scope, level);
}

// Resolution walks every visible scope level (nearest first), so the node is
// found wherever it was created rather than only at one fixed level.
async function resolvePinnedNodeId(store: KnowledgeStorage, scope: KnowledgeScope): Promise<string | undefined> {
  const node = await store.resolveNode({ name: PINNED_NODE_NAME, scope });
  return node?.id;
}

/** Reuse the node wherever it is visible; otherwise create it. `createNode` is an idempotent upsert on (name, scope). */
async function ensurePinnedNodeId(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  maxScope?: KnowledgeScopeLevel,
): Promise<string> {
  const existing = await resolvePinnedNodeId(store, scope);
  if (existing) return existing;
  const node = await store.createNode({
    name: PINNED_NODE_NAME,
    kind: PINNED_NODE_KIND,
    scope: pinnedNodeScope(scope, maxScope),
  });
  return node.id;
}

/**
 * Assembles the current pin set.
 *
 * Reads use the FULL visible scope context, never a level-narrowed write scope: visibility is
 * subset containment, so querying at the node's level would drop pins written at narrower
 * levels. Deleted records are excluded explicitly.
 */
export async function listPinnedKnowledge(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
}): Promise<PinnedKnowledgeSet> {
  const nodeId = await resolvePinnedNodeId(input.store, input.scope);
  if (!nodeId) return { pins: [] };
  const pins: KnowledgeRecord[] = [];
  let after: string | undefined;
  do {
    const page = await input.store.listKnowledgeAbout({
      node: nodeId,
      scope: input.scope,
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

// Pins cannot be written broader than the resource level: the reserved node
// is anchored at (or below) the resource, and an org-scoped pin would only be
// resolvable from the resource that created it, which is a silent-loss trap.
function clampPinLevel(level: KnowledgeScopeLevel): KnowledgeScopeLevel {
  return level === 'org' ? 'resource' : level;
}

function resolveWriteScope(options: PinnedToolsOptions, level?: KnowledgeScopeLevel): KnowledgeScope {
  // An unscoped pin under a thread ceiling narrows to the ceiling instead of
  // failing the assert on every call: pins are model-driven, so a config that
  // makes the default request throw would be a tool error every turn.
  let effective = clampPinLevel(level ?? options.defaultScope);
  if (!level && options.maxScope === 'thread') effective = 'thread';
  const scope = expandKnowledgeScope(options.scope, effective);
  assertKnowledgeScopeWithinCeiling(scope, options.maxScope);
  return scope;
}

const scopeLevelSchema: JSONSchema7 = { type: 'string', enum: ['resource', 'thread'] };

async function writePinnedKnowledge(
  store: KnowledgeStorage,
  options: PinnedToolsOptions,
  text: string,
  level?: KnowledgeScopeLevel,
  metadata?: Record<string, unknown>,
): Promise<KnowledgeRecord> {
  const { pins } = await listPinnedKnowledge({ store, scope: options.scope });
  assertBudget(options, pins, text);
  const nodeId = await ensurePinnedNodeId(store, options.scope, options.maxScope);
  return store.appendKnowledge({
    node: nodeId,
    text,
    scope: resolveWriteScope(options, level),
    sourceThreadId: options.sourceThreadId,
    maxScope: options.maxScope,
    metadata,
    resolutionScope: options.scope,
    defaultScope: expandKnowledgeScope(options.scope, options.defaultScope),
  });
}

async function getStore(memory: PinnedMemory): Promise<KnowledgeStorage> {
  const store = await memory.storage.getStore('knowledge');
  if (!store) throw new Error('Pinned knowledge requires a configured knowledge storage domain.');
  return store;
}

async function requirePin(
  store: KnowledgeStorage,
  recordId: string,
  options: PinnedToolsOptions,
): Promise<KnowledgeRecord> {
  const record = await store.getKnowledge({ id: recordId, includeDeleted: false });
  if (!record) throw new Error(`Pin not found: ${recordId}`);
  const nodeId = await resolvePinnedNodeId(store, options.scope);
  if (!nodeId || record.node !== nodeId) throw new Error(`Record is not a pin: ${recordId}`);
  if (!isKnowledgeScopeVisible(record.scope, options.scope)) throw new Error('Pin is outside the visible scope.');
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
        const value = input as { text: string; scope?: KnowledgeScopeLevel; reason?: string };
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
        return store.removeKnowledge({ id: record.id, deletedBy: PIN_IDENTITY });
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
        const { pins } = await listPinnedKnowledge({ store, scope: options.scope });
        assertBudget(options, pins, value.text, record);
        await store.removeKnowledge({ id: record.id, deletedBy: PIN_IDENTITY });
        return store.appendKnowledge({
          node: record.node,
          text: value.text,
          scope: record.scope,
          sourceThreadId: options.sourceThreadId,
          maxScope: record.maxScope,
          metadata: value.reason ? { ...record.metadata, reason: value.reason } : record.metadata,
          resolutionScope: options.scope,
          defaultScope: expandKnowledgeScope(options.scope, options.defaultScope),
        });
      },
    }),
  };
}

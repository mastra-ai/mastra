import type { JSONSchema7 } from 'json-schema';
import { estimateTokenCount } from 'tokenx';
import type { KnowledgeRecord, KnowledgeScope, KnowledgeStorage } from '../storage';
import { canonicalizeKnowledgeScope, createKnowledgeNodeCursor, isKnowledgeScopeVisible } from '../storage';
import type { ToolAction } from '../tools';
import { createTool } from '../tools';

import { getKnowledgeStore, requireWritableTags } from './knowledge-tools';
import type { KnowledgeStoreMemory } from './knowledge-tools';

/** Processor id and state-signal id for Knowledge's pinned context. */
export const PINNED_KNOWLEDGE_STATE_ID = 'knowledge';
/** Snapshot tag the model sees; the delta tag appends `-update`. */
export const PINNED_SNAPSHOT_TAG = 'pinned-knowledge';
export const PINNED_DELTA_TAG = 'pinned-knowledge-update';
/** Reserved node holding the pin set. One record, at one fixed scope level. */
export const PINNED_NODE_NAME = 'pinned';
export const PINNED_NODE_KIND = 'system';
/** Budget defaults. A pin costs context every turn, so both bounds are enforced in the tool. */
export const DEFAULT_MAX_PINS = 20;
export const DEFAULT_PINNED_MAX_TOKENS = 500;
export const MAX_PINNED_MAX_TOKENS = 2_000;

export interface PinnedKnowledgeSet {
  /** Every visible `pinned` node the set was read from. */
  nodeIds: string[];
  pins: KnowledgeRecord[];
}

type PinnedMemory = KnowledgeStoreMemory;

export interface PinnedToolsOptions {
  /** The run's full Knowledge scope. */
  scope: KnowledgeScope;
  /** Tags of `scope` the run holds read-only: pins there are delivered, never changed. */
  readOnly?: KnowledgeScope;
  sourceThreadId: string;
  /** Stamped as `metadata.source` on every pin written and as `deletedBy` on removals, e.g. `agent:<id>`. */
  source?: string;
  maxPins: number;
  /** Estimated-token budget for the whole pin set. */
  maxTokens: number;
}

// Resolution walks every visible scope level (nearest first), so the node is
// found wherever it was created rather than only at one fixed level.
/**
 * Every `pinned` node the scope can see. Pins live on one node per pin scope, so a run holding
 * `org:self` and `team:self:x` sees the org's pins and the team's pins together.
 */
async function listPinnedNodeIds(store: KnowledgeStorage, scope: KnowledgeScope): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const nodes = await store.listNodes({
      scope,
      namePrefix: PINNED_NODE_NAME,
      kind: PINNED_NODE_KIND,
      cursor,
      limit: 100,
    });
    for (const node of nodes) if (node.name === PINNED_NODE_NAME && !node.mergedInto) ids.push(node.id);
    cursor =
      nodes.length === 100
        ? createKnowledgeNodeCursor(nodes.at(-1)!, { namePrefix: PINNED_NODE_NAME, kind: PINNED_NODE_KIND })
        : undefined;
  } while (cursor);
  return ids;
}

/** The `pinned` node at exactly the pin's scope, created when missing (`createNode` upserts on name+scope). */
async function ensurePinnedNodeId(
  store: KnowledgeStorage,
  pinScope: KnowledgeScope,
  runScope: KnowledgeScope,
): Promise<string> {
  const node = await store.createNode({
    name: PINNED_NODE_NAME,
    kind: PINNED_NODE_KIND,
    scope: pinScope,
    resolutionScope: runScope,
  });
  return node.id;
}

/**
 * Assembles the current pin set from every visible `pinned` node.
 *
 * Reads use the FULL visible scope, never a narrowed write scope: visibility is subset
 * containment, so a narrower query would drop pins. Deleted records are excluded.
 */
export async function listPinnedKnowledge(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
}): Promise<PinnedKnowledgeSet> {
  const nodeIds = await listPinnedNodeIds(input.store, input.scope);
  const pins: KnowledgeRecord[] = [];
  for (const nodeId of nodeIds) {
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
  }
  pins.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return { nodeIds, pins };
}

function totalTokens(pins: KnowledgeRecord[]): number {
  return pins.reduce((sum, pin) => sum + estimateTokenCount(pin.text), 0);
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
  if (totalTokens(kept) + estimateTokenCount(incomingText) > options.maxTokens) {
    throw new Error(`Pin budget exceeded: the pin set is limited to about ${options.maxTokens} tokens in total.`);
  }
}

/**
 * Pins land at the run's tags without its thread, so they follow the run across threads. A run
 * that holds only a thread pins at the thread.
 */
export function defaultPinScope(scope: KnowledgeScope): KnowledgeScope {
  const withoutThread = scope.filter(tag => !tag.startsWith('thread:'));
  return withoutThread.length > 0 ? withoutThread : scope;
}

function resolveWriteScope(options: PinnedToolsOptions, requested?: string[]): KnowledgeScope {
  const readOnly = options.readOnly ?? [];
  if (!requested) {
    const writable = defaultPinScope(options.scope.filter(tag => !readOnly.includes(tag)));
    if (writable.length === 0) throw new Error('This run holds no writable scope tags.');
    return writable;
  }
  requireWritableTags(requested, readOnly);
  const held = new Set(options.scope);
  const missing = requested.filter(tag => !held.has(tag));
  if (missing.length > 0) {
    throw new Error(`This run does not hold scope ${missing.map(tag => `"${tag}"`).join(', ')}.`);
  }
  return canonicalizeKnowledgeScope(requested);
}

const scopeTagsSchema: JSONSchema7 = {
  type: 'array',
  items: { type: 'string', minLength: 3 },
  minItems: 1,
  description: "Scope tags for the pin, chosen from the run's scope tags. Defaults to every run tag except the thread.",
};

async function writePinnedKnowledge(
  store: KnowledgeStorage,
  options: PinnedToolsOptions,
  text: string,
  requested?: string[],
  metadata?: Record<string, unknown>,
): Promise<KnowledgeRecord> {
  const { pins } = await listPinnedKnowledge({ store, scope: options.scope });
  assertBudget(options, pins, text);
  const scope = resolveWriteScope(options, requested);
  const nodeId = await ensurePinnedNodeId(store, scope, options.scope);
  return store.appendKnowledge({
    node: nodeId,
    text,
    scope,
    sourceThreadId: options.sourceThreadId,
    metadata: options.source ? { ...metadata, source: options.source } : metadata,
    resolutionScope: options.scope,
    defaultScope: defaultPinScope(options.scope),
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
  const record = await store.getKnowledge({ id: recordId, includeDeleted: false });
  if (!record) throw new Error(`Pin not found: ${recordId}`);
  const nodeIds = await listPinnedNodeIds(store, options.scope);
  if (!nodeIds.includes(record.node)) throw new Error(`Record is not a pin: ${recordId}`);
  if (!isKnowledgeScopeVisible(record.scope, options.scope)) throw new Error('Pin is outside the visible scope.');
  requireWritableTags(record.scope, options.readOnly ?? []);
  return record;
}

function requirePinField<T>(value: T | undefined, op: string, field: string): T {
  if (value === undefined) throw new Error(`knowledge_pin op "${op}" needs ${field}.`);
  return value;
}

/**
 * The pin tool. op "pin" appends a record on the reserved node; "unpin" soft-deletes it
 * (auditable, restorable); "edit" is remove plus append because knowledge records are immutable,
 * so an edited pin carries a new record id.
 */
export function createPinnedTools(
  memory: PinnedMemory,
  options: PinnedToolsOptions,
): Record<string, ToolAction<any, any, any>> {
  async function unpin(recordId: string) {
    const store = await getStore(memory);
    const record = await requirePin(store, recordId, options);
    return store.removeKnowledge({ id: record.id, deletedBy: options.source ?? 'agent' });
  }

  async function editPin(recordId: string, text: string, reason?: string) {
    const store = await getStore(memory);
    const record = await requirePin(store, recordId, options);
    const { pins } = await listPinnedKnowledge({ store, scope: options.scope });
    assertBudget(options, pins, text, record);
    await store.removeKnowledge({ id: record.id, deletedBy: options.source ?? 'agent' });
    return store.appendKnowledge({
      node: record.node,
      text,
      scope: record.scope,
      sourceThreadId: options.sourceThreadId,
      metadata: {
        ...record.metadata,
        ...(reason ? { reason } : {}),
        ...(options.source ? { source: options.source } : {}),
      },
      resolutionScope: options.scope,
      defaultScope: defaultPinScope(options.scope),
    });
  }

  return {
    knowledge_pin: createTool({
      id: 'knowledge_pin',
      description:
        'Maintain the pinned context, knowledge that stays in context every turn without being asked for. op "pin" adds a pin; "edit" replaces a pin\'s text (the replacement gets a new record id); "unpin" removes one. Pins cost context permanently; pin only what is unconditionally relevant.',
      inputSchema: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['pin', 'edit', 'unpin'] },
          text: { type: 'string', minLength: 1, description: 'pin, edit: the pin text.' },
          scope: scopeTagsSchema,
          reason: {
            type: 'string',
            minLength: 1,
            description: 'pin, edit: one short sentence on why this must stay in context permanently.',
          },
          recordId: { type: 'string', minLength: 1, description: 'edit, unpin: the pin to change.' },
        },
        required: ['op'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as {
          op: 'pin' | 'edit' | 'unpin';
          text?: string;
          scope?: string[];
          reason?: string;
          recordId?: string;
        };
        switch (value.op) {
          case 'pin': {
            const store = await getStore(memory);
            return writePinnedKnowledge(
              store,
              options,
              requirePinField(value.text, 'pin', 'text'),
              value.scope,
              value.reason ? { reason: value.reason } : undefined,
            );
          }
          case 'edit':
            return editPin(
              requirePinField(value.recordId, 'edit', 'recordId'),
              requirePinField(value.text, 'edit', 'text'),
              value.reason,
            );
          case 'unpin':
            return unpin(requirePinField(value.recordId, 'unpin', 'recordId'));
          default:
            throw new Error(`knowledge_pin has no op "${String(value.op)}".`);
        }
      },
    }),
  };
}

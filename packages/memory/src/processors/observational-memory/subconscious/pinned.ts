import type { KnowledgeFact, KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import { assertKnowledgeScopeWithinCeiling, expandKnowledgeScope, isKnowledgeScopeVisible } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

/** Processor id and state-signal id for the pinned-knowledge lane. */
export const SUBCONSCIOUS_PINS_STATE_ID = 'subconscious-pins';
/** Snapshot tag the model sees; the delta tag appends `-update`. */
export const PINNED_SNAPSHOT_TAG = 'pinned-knowledge';
export const PINNED_DELTA_TAG = 'pinned-knowledge-update';
/** Reserved entity holding the pin set. One record, at one fixed scope level. */
export const PINNED_ENTITY_NAME = 'pinned';
export const PINNED_ENTITY_KIND = 'system';
export const PINNED_ENTITY_SCOPE_LEVEL: KnowledgeScopeLevel = 'resource';
/** Budget defaults. A pin costs context every turn, so both bounds are enforced in the tool. */
export const DEFAULT_MAX_PINS = 20;
export const DEFAULT_PINNED_MAX_CHARACTERS = 2_000;
export const MAX_PINNED_MAX_CHARACTERS = 8_000;

const PIN_IDENTITY = 'subconscious:pin';

export interface PinnedKnowledgeSet {
  entityId?: string;
  pins: KnowledgeFact[];
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

// The entity sits at the resource level unless a `maxScope` ceiling narrows it
// to the thread; creating a resource-level record under a thread ceiling would
// bypass the ceiling.
function pinnedEntityScope(scope: KnowledgeScope, maxScope?: KnowledgeScopeLevel): KnowledgeScope {
  const level = maxScope === 'thread' ? 'thread' : PINNED_ENTITY_SCOPE_LEVEL;
  return expandKnowledgeScope(scope, level);
}

// Resolution walks every visible scope level (nearest first), so the entity is
// found wherever it was created rather than only at one fixed level.
async function resolvePinnedEntityId(store: KnowledgeStorage, scope: KnowledgeScope): Promise<string | undefined> {
  const entity = await store.resolveEntity({ name: PINNED_ENTITY_NAME, scope });
  return entity?.id;
}

/** Reuse the entity wherever it is visible; otherwise create it. `createEntity` is an idempotent upsert on (name, scope). */
async function ensurePinnedEntityId(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  maxScope?: KnowledgeScopeLevel,
): Promise<string> {
  const existing = await resolvePinnedEntityId(store, scope);
  if (existing) return existing;
  const entity = await store.createEntity({
    name: PINNED_ENTITY_NAME,
    kind: PINNED_ENTITY_KIND,
    scope: pinnedEntityScope(scope, maxScope),
  });
  return entity.id;
}

/**
 * Assembles the current pin set.
 *
 * Reads use the FULL visible scope context, never a level-narrowed write scope: visibility is
 * subset containment, so querying at the entity's level would drop pins written at narrower
 * levels. Deleted facts are excluded explicitly.
 */
export async function listPinnedKnowledge(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
}): Promise<PinnedKnowledgeSet> {
  const entityId = await resolvePinnedEntityId(input.store, input.scope);
  if (!entityId) return { pins: [] };
  const pins: KnowledgeFact[] = [];
  let after: string | undefined;
  do {
    const page = await input.store.factsAbout({
      entityId,
      scope: input.scope,
      after,
      includeDeleted: false,
    });
    pins.push(...page.facts);
    after = page.nextCursor;
  } while (after);
  return { entityId, pins };
}

function totalCharacters(pins: KnowledgeFact[]): number {
  return pins.reduce((sum, pin) => sum + pin.text.length, 0);
}

function assertBudget(
  options: PinnedToolsOptions,
  pins: KnowledgeFact[],
  incomingText: string,
  replacing?: KnowledgeFact,
): void {
  const kept = replacing ? pins.filter(pin => pin.id !== replacing.id) : pins;
  if (!replacing && kept.length >= options.maxPins) {
    throw new Error(`Pin limit reached: the set holds at most ${options.maxPins}. Unpin something first.`);
  }
  if (totalCharacters(kept) + incomingText.length > options.maxCharacters) {
    throw new Error(`Pin budget exceeded: the pin set is limited to ${options.maxCharacters} characters in total.`);
  }
}

// Pins cannot be written broader than the resource level: the reserved entity
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

/**
 * Shared pinned-fact write path: budget check, reserved-entity upsert, scoped append.
 * Used by the knowledge_pin tool and by capture-time pinning so the budget is enforced
 * in exactly one place. Module-internal; not part of the subconscious barrel surface.
 */
export async function writePinnedFact(
  store: KnowledgeStorage,
  options: PinnedToolsOptions,
  text: string,
  level?: KnowledgeScopeLevel,
): Promise<KnowledgeFact> {
  const { pins } = await listPinnedKnowledge({ store, scope: options.scope });
  assertBudget(options, pins, text);
  const entityId = await ensurePinnedEntityId(store, options.scope, options.maxScope);
  return store.appendFact({
    parentEntityId: entityId,
    text,
    scope: resolveWriteScope(options, level),
    sourceThreadId: options.sourceThreadId,
    maxScope: options.maxScope,
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
  factId: string,
  options: PinnedToolsOptions,
): Promise<KnowledgeFact> {
  const fact = await store.getFact({ id: factId, includeDeleted: false });
  if (!fact) throw new Error(`Pin not found: ${factId}`);
  const entityId = await resolvePinnedEntityId(store, options.scope);
  if (!entityId || fact.parentEntityId !== entityId) throw new Error(`Fact is not a pin: ${factId}`);
  if (!isKnowledgeScopeVisible(fact.scope, options.scope)) throw new Error('Pin is outside the visible scope.');
  return fact;
}

/**
 * Pin lifecycle tools. Pin appends a fact on the reserved entity; unpin soft-deletes it
 * (auditable, restorable); edit is remove plus append because the knowledge domain has no
 * updateFact, so an edited pin carries a new fact id.
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
        },
        required: ['text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { text: string; scope?: KnowledgeScopeLevel };
        const store = await getStore(memory);
        return writePinnedFact(store, options, value.text, value.scope);
      },
    }),
    knowledge_unpin: createTool({
      id: 'knowledge_unpin',
      description: 'Remove a pin. The underlying fact is soft-deleted and drops out of the pinned context.',
      inputSchema: {
        type: 'object',
        properties: { factId: { type: 'string', minLength: 1 } },
        required: ['factId'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const store = await getStore(memory);
        const fact = await requirePin(store, (input as { factId: string }).factId, options);
        return store.removeFact({ id: fact.id, deletedBy: PIN_IDENTITY });
      },
    }),
    knowledge_edit_pin: createTool({
      id: 'knowledge_edit_pin',
      description: 'Replace the text of an existing pin. The replacement carries a new fact id.',
      inputSchema: {
        type: 'object',
        properties: {
          factId: { type: 'string', minLength: 1 },
          text: { type: 'string', minLength: 1 },
        },
        required: ['factId', 'text'],
        additionalProperties: false,
      } satisfies JSONSchema7,
      execute: async input => {
        const value = input as { factId: string; text: string };
        const store = await getStore(memory);
        const fact = await requirePin(store, value.factId, options);
        const { pins } = await listPinnedKnowledge({ store, scope: options.scope });
        assertBudget(options, pins, value.text, fact);
        await store.removeFact({ id: fact.id, deletedBy: PIN_IDENTITY });
        return store.appendFact({
          parentEntityId: fact.parentEntityId,
          text: value.text,
          scope: fact.scope,
          sourceThreadId: options.sourceThreadId,
          maxScope: fact.maxScope,
          resolutionScope: options.scope,
          defaultScope: expandKnowledgeScope(options.scope, options.defaultScope),
        });
      },
    }),
  };
}

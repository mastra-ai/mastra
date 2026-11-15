/**
 * Subconscious was removed. These stubs keep code written against older `@mastra/memory`
 * releases compiling and loading, and fail with a clear message when used.
 */

export const SUBCONSCIOUS_REMOVED_MESSAGE =
  'Subconscious was removed from @mastra/memory; attach Knowledge to the agent instead: new Agent({ knowledge: new Knowledge({ storage, tools: true, pinnedContext: true }), scopes }).';

const SEMANTIC_INDEX_REMOVED_MESSAGE =
  'KnowledgeSemanticIndexCoordinator moved into Knowledge: pass vector and embedder to new Knowledge({ ... }) instead.';

/** @deprecated Subconscious was removed; attach `Knowledge` to the agent instead. Throws when constructed. */
export class Subconscious {
  constructor(_config?: unknown) {
    throw new Error(SUBCONSCIOUS_REMOVED_MESSAGE);
  }
}

/** @deprecated Knowledge manages its semantic index; pass `vector` and `embedder` to `new Knowledge()`. Throws when constructed. */
export class KnowledgeSemanticIndexCoordinator {
  constructor(_config?: unknown) {
    throw new Error(SEMANTIC_INDEX_REMOVED_MESSAGE);
  }
}

/** @deprecated Knowledge manages its semantic index; nothing throws this any more. */
export class StaleKnowledgeSemanticIndexError extends Error {}

/** @deprecated */
export type KnowledgeSemanticIndexCoordinatorConfig = Record<string, unknown>;
/** @deprecated Subconscious was removed. */
export type SubconsciousConfig = Record<string, unknown>;
/** @deprecated Subconscious was removed. */
export type ResolvedSubconsciousConfig = Record<string, unknown>;
/** @deprecated Subconscious was removed. */
export type ResolvedSubconsciousAgent = Record<string, unknown>;
/** @deprecated Subconscious was removed. */
export type SubconsciousBuiltInObservationAgent = Record<string, unknown>;
/** @deprecated Subconscious was removed. */
export type SubconsciousBuiltInObservationConfig = Record<string, unknown>;
/** @deprecated Subconscious was removed. */
export type SubconsciousCustomObservationConfig = Record<string, unknown>;
/** @deprecated Subconscious was removed. */
export type SubconsciousObservationEntry = Record<string, unknown>;

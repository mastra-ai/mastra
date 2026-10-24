import type { MastraCompositeStore } from '../storage';
import type { KnowledgeStructurePlan } from '../storage/domains/knowledge';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../vector';
import type { KnowledgeInstructionsOption } from './instructions';
import type { KnowledgeScopeTypesConfig } from './reconcile';

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeConfig {
  id?: string;
  name?: string;
  /** Prose context for agents. Automatic description compilation lands in Knowledge v2 Wave 4. */
  description?: string;
  /** Hand-authored startup structure applied additively by `knowledge.reconcile()`. */
  structure?: KnowledgeStructurePlan;
  /** Lazy scope creation templates keyed by opaque address pattern. */
  scopes?: KnowledgeScopeTypesConfig;
  storage?: MastraCompositeStore;
  /** Vector store for semantic search. Without it (or `embedder`) search is keyword-only. */
  vector?: MastraVector;
  embedder?: MastraEmbeddingModel<string>;
  embedderOptions?: MastraEmbeddingOptions;
  /** Tools an attached agent gets. Defaults to read only. */
  tools?: { read?: boolean; write?: boolean };
  /** Pins delivered to an attached agent every turn, plus pin tools. Off by default. */
  /** Pins delivered every turn: `maxPins` defaults to 20, `maxTokens` (estimated, whole set) to 500, at most 2000. */
  pins?: boolean | { maxPins?: number; maxTokens?: number };
  /** Usage instructions added whenever Knowledge attaches tools. */
  instructions?: KnowledgeInstructionsOption;
}

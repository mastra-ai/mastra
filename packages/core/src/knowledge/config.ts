import type { MastraCompositeStore } from '../storage';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../vector';
import type { KnowledgeScopeDeclarations } from './declarations';
import type { KnowledgeInstructionsOption } from './instructions';

/** @experimental Knowledge APIs are experimental and may change without notice. */
export interface KnowledgeConfig {
  id?: string;
  name?: string;
  /** Prose context for agents. */
  description?: string;
  /**
   * The scope types and concrete scopes this Knowledge knows, who gets which role on them, and the
   * child scopes, pages and pins that come with them. Required: every run scope of an attached agent
   * must match a declaration. Spread `knowledgeMemoryScopes()` to declare Memory's `thread:` and
   * `resource:` scopes and an `org:` tenant; `{}` declares nothing.
   */
  scopes: KnowledgeScopeDeclarations;
  storage?: MastraCompositeStore;
  /**
   * Vector store and embedder for semantic search. With both, `knowledge_search` blends keyword and
   * semantic results, and page and note writes made through the tools are embedded. Without them,
   * search is keyword only. Content written straight to the store is embedded by `reindex()`.
   */
  vector?: MastraVector;
  embedder?: MastraEmbeddingModel<string>;
  embedderOptions?: MastraEmbeddingOptions;
  /**
   * Tools an attached agent gets: `true` for read and write (`knowledge_search`, `knowledge_read`,
   * `knowledge_page`, `knowledge_note`), `{ read: true }` for `knowledge_search` and `knowledge_read`,
   * `{ write: true }` for `knowledge_page` and `knowledge_note`. Off by default.
   */
  tools?: boolean | { read?: boolean; write?: boolean };
  /**
   * Pinned pages delivered to an attached agent every turn, plus the `knowledge_pin` tool. Needs
   * Memory. Off by default. `maxPins` defaults to 20, `maxTokens` (estimated, whole set) to 500, at
   * most 2000.
   */
  pinnedContext?: boolean | { maxPins?: number; maxTokens?: number };
  /** Usage instructions added whenever Knowledge attaches tools. */
  instructions?: KnowledgeInstructionsOption;
}

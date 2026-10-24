import type { MastraCompositeStore } from '../storage';
import type { KnowledgeStructurePlan } from '../storage/domains/knowledge';
import type { KnowledgeImportersInput } from './imports';
import type { KnowledgeScopeTypesConfig } from './reconcile';

/** Which Knowledge tools Memory gives every agent that uses this instance. Both default to off. */
export interface KnowledgeToolsConfig {
  /** `knowledge_search`, `knowledge_read` and `knowledge_browse`, scoped to the run. */
  read?: boolean;
  /** Record and node write tools, scoped to the run. Does not imply `read`. */
  write?: boolean;
}

export interface KnowledgeConfig {
  id?: string;
  name?: string;
  /** Prose context for agents. */
  description?: string;
  /** Hand-authored startup structure applied additively by `knowledge.reconcile()`. */
  structure?: KnowledgeStructurePlan;
  /** Lazy scope creation templates keyed by opaque address pattern. */
  scopes?: KnowledgeScopeTypesConfig;
  /** Registered Knowledge importers, or a resolver re-evaluated on each importer scheduling tick. */
  importers?: KnowledgeImportersInput;
  /** Knowledge tools for every agent whose Memory uses this instance. */
  tools?: KnowledgeToolsConfig;
  storage?: MastraCompositeStore;
}

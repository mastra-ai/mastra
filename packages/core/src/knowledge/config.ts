import type { MastraCompositeStore } from '../storage';
import type { KnowledgeStructurePlan } from '../storage/domains/knowledge';
import type { KnowledgeImporterDefinition } from './imports';
import type { KnowledgeScopeTypesConfig } from './reconcile';

export interface KnowledgeConfig {
  id?: string;
  name?: string;
  /** Prose context for agents. */
  description?: string;
  /** Hand-authored startup structure applied additively by `knowledge.reconcile()`. */
  structure?: KnowledgeStructurePlan;
  /** Lazy scope creation templates keyed by opaque address pattern. */
  scopes?: KnowledgeScopeTypesConfig;
  /** Registered static or agentic importers. */
  importers?: readonly KnowledgeImporterDefinition[];
  storage?: MastraCompositeStore;
}

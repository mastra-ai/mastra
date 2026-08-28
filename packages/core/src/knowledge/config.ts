import type { MastraCompositeStore } from '../storage';
import type { KnowledgeStructurePlan } from '../storage/domains/knowledge';
import type { KnowledgeImporterDefinition } from './imports';
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
  /** Registered static or agentic importers. Execution/state lands in later Knowledge v2 Wave 2 segments. */
  importers?: readonly KnowledgeImporterDefinition[];
  storage?: MastraCompositeStore;
}

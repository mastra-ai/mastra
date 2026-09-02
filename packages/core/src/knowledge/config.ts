import type { MastraCompositeStore } from '../storage';
import type { KnowledgeStructurePlan } from '../storage/domains/knowledge';
import type { KnowledgeCurationConfig } from './curation/types';
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
  /** Registered Knowledge importers. */
  importers?: readonly KnowledgeImporterDefinition[];
  /** Governed curation instructions. Authority is supplied separately by the host for each run. */
  curation?: KnowledgeCurationConfig;
  storage?: MastraCompositeStore;
}

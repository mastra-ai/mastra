import type { MastraCompositeStore } from '../storage';
import type { KnowledgeStructurePlan } from '../storage/domains/knowledge';
import type { KnowledgeImportersInput } from './imports';
import type { KnowledgeScopeTypesConfig, KnowledgeScopeVouchHook } from './reconcile';

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
  storage?: MastraCompositeStore;
  /**
   * Supplies a scope-template parameter the run did not provide (e.g. `$orgId`) from
   * host-trusted state. Receives only the scope address and parameter name, never the
   * request context, and may return a promise. A vouched scope anchors the run; it never grants
   * ownership.
   */
  vouch?: KnowledgeScopeVouchHook;
}

import type {
  KnowledgeGrantRole,
  KnowledgeNode,
  KnowledgeProposal,
  KnowledgeRecord,
  KnowledgeScopeIds,
} from '../../storage/domains/knowledge';
import type { MaterializeKnowledgeScopeInput } from '../reconcile';

export interface KnowledgeCurationConfig {
  /** Additional host-authored guidance appended after the built-in adversarial-safety instructions. */
  instructions?: string;
}

export interface RegisterKnowledgeCuratorProfileInput {
  id: string;
  identityScope: MaterializeKnowledgeScopeInput;
  grants: Array<{
    scopeAddress: string;
    role: KnowledgeGrantRole;
    canSuggest?: boolean;
  }>;
}

export interface CreateKnowledgeCuratorInput {
  /** A host-registered system-actor profile. Captured text must never select or populate it. */
  profileId: string;
  /** The ordinary uncurated companion scope used as this curator's worklist. */
  companionScopeId: string;
  /** Attribution scope for mutations and proposals. */
  contextScopeId: string;
}

export interface ResolvedKnowledgeCuratorInput {
  vouchedScopeIds: KnowledgeScopeIds;
  companionScopeId: string;
  contextScopeId: string;
}

export interface KnowledgeCuratorWorklistInput {
  cursor?: string;
  limit?: number;
}

export interface KnowledgeCuratorWorklistItem {
  node: KnowledgeNode;
  records: KnowledgeRecord[];
  recordsNextCursor?: string;
}

export interface KnowledgeCuratorRecordPageInput {
  nodeId: string;
  cursor?: string;
  limit?: number;
}

export interface KnowledgeCuratorRecordPage {
  records: KnowledgeRecord[];
  nextCursor?: string;
}

export interface KnowledgeCuratorWorklist {
  nodes: KnowledgeNode[];
  items: KnowledgeCuratorWorklistItem[];
  nextCursor?: string;
}

export interface KnowledgeCuratorMergeTargetsInput {
  namePrefix: string;
  excludeNodeId?: string;
  limit?: number;
}

export type KnowledgeCuratorMutationResult =
  | { mode: 'applied'; node: KnowledgeNode }
  | { mode: 'proposed'; proposal: KnowledgeProposal };

export interface KnowledgeCuratorRefineInput {
  nodeId: string;
  version: number;
  name?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
}

export interface KnowledgeCuratorPromoteInput {
  nodeId: string;
  version: number;
  destinationScopeId: string;
  reason?: string;
}

export interface KnowledgeCuratorMergeInput {
  sourceId: string;
  targetId: string;
  sourceVersion: number;
  targetVersion: number;
}

export interface KnowledgeCuratorDiscardInput {
  nodeId: string;
  version: number;
}

export interface KnowledgeCuratorRetainedItem {
  outcome: 'retained';
  node: KnowledgeNode;
  records: KnowledgeRecord[];
  recordsNextCursor?: string;
}

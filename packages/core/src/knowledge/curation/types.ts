import type {
  KnowledgeNode,
  KnowledgeProposal,
  KnowledgeRecord,
  KnowledgeScopeIds,
} from '../../storage/domains/knowledge';

export interface KnowledgeCurationConfig {
  /** Additional host-authored guidance appended after the built-in adversarial-safety instructions. */
  instructions?: string;
}

export interface CreateKnowledgeCuratorInput {
  /** Host-vouched principal scopes. Captured text must never populate this field. */
  vouchedScopeIds: KnowledgeScopeIds;
  /** The ordinary uncurated companion scope used as this curator's worklist. */
  companionScopeId: string;
  /** Attribution scope for mutations and proposals. */
  contextScopeId: string;
}

export interface KnowledgeCuratorWorklistInput {
  cursor?: string;
  limit?: number;
}

export interface KnowledgeCuratorWorklist {
  nodes: KnowledgeNode[];
  nextCursor?: string;
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
}

export interface KnowledgeCuratorMergeInput {
  sourceId: string;
  targetId: string;
  sourceVersion: number;
}

export interface KnowledgeCuratorDiscardInput {
  nodeId: string;
  version: number;
}

export interface KnowledgeCuratorRetainedItem {
  outcome: 'retained';
  node: KnowledgeNode;
  records: KnowledgeRecord[];
}

import {
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  type KnowledgeProposal,
  type KnowledgeProposalApprovalCapability,
  type KnowledgeProposalTarget,
  type KnowledgeScopeIds,
  type KnowledgeStorage,
  type ListKnowledgeProposalsOutput,
  type UpdateKnowledgeNodeInput,
} from '../../storage/domains/knowledge';
import { assertKnowledgeScopeCapabilities, assertKnowledgeTargetCapability } from '../access/mutations';
import { getKnowledgeReadableScopeIds } from '../access/read-filter';
import type { KnowledgeAccessFrontier } from '../access/types';

export interface ProposeKnowledgeNodeUpdateInput {
  mutation: UpdateKnowledgeNodeInput;
  proposerContextScopeId: string;
  vouchedScopeIds: KnowledgeScopeIds;
  reason?: string;
}

export interface ReviewKnowledgeProposalDecisionInput {
  id: string;
  reviewerContextScopeId: string;
  vouchedScopeIds: KnowledgeScopeIds;
  reason?: string;
}

interface NodeUpdateProposalPayload {
  kind: 'update-node';
  mutation: UpdateKnowledgeNodeInput;
  originalScopeIds: KnowledgeScopeIds;
}

function proposalNodeUpdateMutation(input: UpdateKnowledgeNodeInput): UpdateKnowledgeNodeInput {
  return {
    id: input.id,
    version: input.version,
    name: input.name,
    kind: input.kind,
    isScope: input.isScope,
    metadata: input.metadata ? structuredClone(input.metadata) : undefined,
    scopeIds: input.scopeIds ? structuredClone(input.scopeIds) : undefined,
  };
}

function decodeNodeUpdatePayload(proposal: KnowledgeProposal): NodeUpdateProposalPayload {
  const payload = proposal.payload as Partial<NodeUpdateProposalPayload>;
  if (
    payload.kind !== 'update-node' ||
    !payload.mutation ||
    typeof payload.mutation !== 'object' ||
    !Array.isArray(payload.originalScopeIds)
  ) {
    throw new Error(`Invalid immutable payload for knowledge proposal ${proposal.id}`);
  }
  return structuredClone(payload as NodeUpdateProposalPayload);
}

export class KnowledgeProposalLifecycle {
  constructor(
    private readonly storage: KnowledgeStorage,
    private readonly evaluateAccess: (vouchedScopeIds: KnowledgeScopeIds) => Promise<KnowledgeAccessFrontier>,
  ) {}

  async proposeNodeUpdate(input: ProposeKnowledgeNodeUpdateInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.proposerContextScopeId);

    const node = await this.storage.getNode(input.mutation.id);
    if (!node || node.deletedAt) throw new KnowledgeNotFoundError('node', input.mutation.id);
    const originalScopeIds = await this.storage.getNodeScopeIds(node.id);
    assertKnowledgeTargetCapability({
      frontier,
      scopeIds: originalScopeIds,
      capability: 'suggest',
      targetType: 'node',
      targetId: node.id,
    });
    if (node.version !== input.mutation.version) throw new KnowledgeConflictError(node.id);

    const targets: KnowledgeProposalTarget[] = [
      {
        type: 'node',
        id: node.id,
        expectedVersion: node.version,
        scopeIds: originalScopeIds,
        approvalCapability: input.mutation.scopeIds ? 'manageAccess' : 'edit',
      },
    ];
    if (input.mutation.scopeIds) {
      const structuralScopeIds = [...new Set([...originalScopeIds, ...input.mutation.scopeIds])].sort();
      assertKnowledgeScopeCapabilities({
        frontier,
        scopeIds: structuralScopeIds,
        capability: 'suggest',
        targetType: 'scope',
      });
      for (const scopeId of structuralScopeIds) {
        const scope = await this.storage.getNode(scopeId);
        if (!scope?.isScope || scope.deletedAt) throw new KnowledgeNotFoundError('scope', scopeId);
        targets.push({
          type: 'node',
          id: scopeId,
          expectedVersion: scope.version,
          scopeIds: [scopeId],
          approvalCapability: 'manageAccess',
        });
      }
    }

    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: 'update-node',
        payload: {
          kind: 'update-node',
          mutation: proposalNodeUpdateMutation(input.mutation),
          originalScopeIds: structuredClone(originalScopeIds),
        },
        reason: input.reason,
        proposerContextScopeId: input.proposerContextScopeId,
        expectedAccessEpoch: frontier.accessEpoch,
      }),
      frontier,
    );
  }

  async list(input: {
    vouchedScopeIds: KnowledgeScopeIds;
    status?: KnowledgeProposal['status'];
    limit?: number;
    cursor?: string;
  }): Promise<ListKnowledgeProposalsOutput> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    const result = await this.storage.listProposals({
      scopeIds: getKnowledgeReadableScopeIds(frontier),
      status: input.status,
      limit: input.limit,
      cursor: input.cursor,
    });
    return {
      ...result,
      proposals: result.proposals.map(proposal => this.#redactAttribution(proposal, frontier)),
    };
  }

  async approve(input: ReviewKnowledgeProposalDecisionInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.reviewerContextScopeId);
    const proposal = await this.#getVisiblePendingProposal(input.id, frontier);
    decodeNodeUpdatePayload(proposal);
    const staleTarget = await this.#authorizeAndFindStaleTarget(proposal, frontier);
    if (staleTarget) {
      await this.storage.reviewProposal({
        id: proposal.id,
        status: 'conflicted',
        reviewerContextScopeId: input.reviewerContextScopeId,
        reviewReason: `Expected ${staleTarget.type} ${staleTarget.id} version ${staleTarget.expectedVersion}`,
        expectedAccessEpoch: frontier.accessEpoch,
      });
      throw new KnowledgeConflictError(proposal.id);
    }
    const applied = await this.storage.applyProposal({
      id: proposal.id,
      reviewerContextScopeId: input.reviewerContextScopeId,
      expectedAccessEpoch: frontier.accessEpoch,
    });
    if (applied.status === 'conflicted') throw new KnowledgeConflictError(proposal.id);
    return this.#redactAttribution(applied, frontier);
  }

  async reject(input: ReviewKnowledgeProposalDecisionInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.reviewerContextScopeId);
    const proposal = await this.#getVisiblePendingProposal(input.id, frontier);
    decodeNodeUpdatePayload(proposal);
    await this.#authorizeAndFindStaleTarget(proposal, frontier);
    return this.#redactAttribution(
      await this.storage.reviewProposal({
        id: proposal.id,
        status: 'rejected',
        reviewerContextScopeId: input.reviewerContextScopeId,
        reviewReason: input.reason,
        expectedAccessEpoch: frontier.accessEpoch,
      }),
      frontier,
    );
  }

  async reReview(input: ReviewKnowledgeProposalDecisionInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.reviewerContextScopeId);
    const proposal = await this.storage.getVisibleProposal({
      id: input.id,
      scopeIds: getKnowledgeReadableScopeIds(frontier),
    });
    if (!proposal || proposal.status !== 'conflicted') throw new KnowledgeNotFoundError('proposal', input.id);
    const payload = decodeNodeUpdatePayload(proposal);
    await this.#authorizeAndFindStaleTarget(proposal, frontier);
    const current = await this.storage.getNode(payload.mutation.id);
    if (!current || current.deletedAt) throw new KnowledgeNotFoundError('node', payload.mutation.id);
    const targets = await Promise.all(
      proposal.targets.map(async target => {
        const entity =
          target.type === 'node'
            ? await this.storage.getNode(target.id)
            : await this.storage.getRecord({ id: target.id, includeDeleted: true });
        if (!entity || entity.deletedAt) throw new KnowledgeNotFoundError(target.type, target.id);
        return { ...target, expectedVersion: entity.version };
      }),
    );
    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: proposal.operation,
        payload: {
          ...payload,
          mutation: { ...payload.mutation, version: current.version },
        },
        reason: input.reason ?? proposal.reason,
        proposerContextScopeId: input.reviewerContextScopeId,
        expectedAccessEpoch: frontier.accessEpoch,
      }),
      frontier,
    );
  }

  async #getVisiblePendingProposal(id: string, frontier: KnowledgeAccessFrontier): Promise<KnowledgeProposal> {
    const proposal = await this.storage.getVisibleProposal({ id, scopeIds: getKnowledgeReadableScopeIds(frontier) });
    if (!proposal || proposal.status !== 'pending') throw new KnowledgeNotFoundError('proposal', id);
    return proposal;
  }

  async #authorizeAndFindStaleTarget(
    proposal: KnowledgeProposal,
    frontier: KnowledgeAccessFrontier,
  ): Promise<KnowledgeProposalTarget | undefined> {
    for (const target of proposal.targets) {
      this.#assertApprovalCapability(frontier, target.scopeIds, target.approvalCapability, target.type, target.id);
    }
    for (const target of proposal.targets) {
      const entity =
        target.type === 'node'
          ? await this.storage.getNode(target.id)
          : await this.storage.getRecord({ id: target.id, includeDeleted: true });
      if (!entity || entity.deletedAt || entity.version !== target.expectedVersion) return target;
    }
    return undefined;
  }

  #redactAttribution(proposal: KnowledgeProposal, frontier: KnowledgeAccessFrontier): KnowledgeProposal {
    const visible = structuredClone(proposal);
    if (visible.proposerContextScopeId && !frontier.scopes[visible.proposerContextScopeId]?.read) {
      delete visible.proposerContextScopeId;
    }
    if (visible.reviewerContextScopeId && !frontier.scopes[visible.reviewerContextScopeId]?.read) {
      delete visible.reviewerContextScopeId;
    }
    return visible;
  }

  #assertApprovalCapability(
    frontier: KnowledgeAccessFrontier,
    scopeIds: KnowledgeScopeIds,
    capability: KnowledgeProposalApprovalCapability,
    targetType: string,
    targetId: string,
  ): void {
    assertKnowledgeTargetCapability({ frontier, scopeIds, capability, targetType, targetId });
  }

  #assertContextScope(frontier: KnowledgeAccessFrontier, scopeId: string): void {
    if (!frontier.scopes[scopeId]?.read) throw new KnowledgeNotFoundError('scope', scopeId);
  }
}

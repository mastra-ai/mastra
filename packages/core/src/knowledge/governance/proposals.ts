import {
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  type KnowledgeNode,
  type KnowledgeProposal,
  type KnowledgeProposalApprovalCapability,
  type KnowledgeRecord,
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

function sameScopeIds(left: KnowledgeScopeIds, right: KnowledgeScopeIds): boolean {
  return left.length === right.length && left.every((scopeId, index) => scopeId === right[index]);
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
    private readonly resolveNode: (input: { id: string; scopeIds: KnowledgeScopeIds }) => Promise<KnowledgeNode | null>,
    private readonly resolveRecord: (input: {
      id: string;
      scopeIds: KnowledgeScopeIds;
    }) => Promise<KnowledgeRecord | null>,
    private readonly resolveScope: (input: {
      id: string;
      scopeIds: KnowledgeScopeIds;
    }) => Promise<KnowledgeNode | null>,
  ) {}

  async proposeNodeUpdate(input: ProposeKnowledgeNodeUpdateInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.proposerContextScopeId);

    const node = await this.resolveNode({ id: input.mutation.id, scopeIds: input.vouchedScopeIds });
    if (!node) throw new KnowledgeNotFoundError('node', input.mutation.id);
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
        const scope = await this.resolveScope({ id: scopeId, scopeIds: input.vouchedScopeIds });
        if (!scope) throw new KnowledgeNotFoundError('scope', scopeId);
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

  async get(input: { id: string; vouchedScopeIds: KnowledgeScopeIds }): Promise<KnowledgeProposal | null> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    const proposal = await this.storage.getVisibleProposal({
      id: input.id,
      scopeIds: getKnowledgeReadableScopeIds(frontier),
    });
    return proposal ? this.#redactAttribution(proposal, frontier) : null;
  }

  async approve(input: ReviewKnowledgeProposalDecisionInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.reviewerContextScopeId);
    const proposal = await this.#getVisiblePendingProposal(input.id, frontier);
    decodeNodeUpdatePayload(proposal);
    const staleTarget = await this.#authorizeAndFindStaleTarget(proposal, frontier, input.vouchedScopeIds);
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
    await this.#authorizeAndFindStaleTarget(proposal, frontier, input.vouchedScopeIds);
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
    const current = await this.resolveNode({ id: payload.mutation.id, scopeIds: input.vouchedScopeIds });
    if (!current) throw new KnowledgeNotFoundError('node', payload.mutation.id);
    const currentScopeIds = await this.storage.getNodeScopeIds(current.id);
    const approvalCapability = payload.mutation.scopeIds ? 'manageAccess' : 'edit';
    this.#assertApprovalCapability(frontier, currentScopeIds, approvalCapability, 'node', current.id);
    const targets: KnowledgeProposalTarget[] = [
      {
        type: 'node',
        id: current.id,
        expectedVersion: current.version,
        scopeIds: currentScopeIds,
        approvalCapability,
      },
    ];
    if (payload.mutation.scopeIds) {
      const structuralScopeIds = [...new Set([...currentScopeIds, ...payload.mutation.scopeIds])].sort();
      assertKnowledgeScopeCapabilities({
        frontier,
        scopeIds: structuralScopeIds,
        capability: 'manageAccess',
        targetType: 'scope',
      });
      for (const scopeId of structuralScopeIds) {
        const scope = await this.resolveScope({ id: scopeId, scopeIds: input.vouchedScopeIds });
        if (!scope) throw new KnowledgeNotFoundError('scope', scopeId);
        targets.push({
          type: 'node',
          id: scope.id,
          expectedVersion: scope.version,
          scopeIds: [scope.id],
          approvalCapability: 'manageAccess',
        });
      }
    }
    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: proposal.operation,
        payload: {
          ...payload,
          mutation: { ...payload.mutation, version: current.version },
          originalScopeIds: currentScopeIds,
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
    vouchedScopeIds: KnowledgeScopeIds,
  ): Promise<KnowledgeProposalTarget | undefined> {
    for (const target of proposal.targets) {
      let entity =
        target.type === 'node'
          ? await this.resolveNode({ id: target.id, scopeIds: vouchedScopeIds })
          : await this.resolveRecord({ id: target.id, scopeIds: vouchedScopeIds });
      if (!entity && target.type === 'node') {
        entity = await this.resolveScope({ id: target.id, scopeIds: vouchedScopeIds });
      }
      if (!entity) throw new KnowledgeNotFoundError(target.type, target.id);
      const currentScopeIds =
        target.type === 'node'
          ? entity && 'isScope' in entity && entity.isScope
            ? [entity.id]
            : await this.storage.getNodeScopeIds(target.id)
          : await this.storage.getRecordScopeIds(target.id);
      this.#assertApprovalCapability(frontier, currentScopeIds, target.approvalCapability, target.type, target.id);
      if (
        entity.deletedAt ||
        entity.version !== target.expectedVersion ||
        !sameScopeIds(currentScopeIds, target.scopeIds)
      ) {
        return target;
      }
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

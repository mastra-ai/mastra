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
  type PromoteKnowledgeNodeInput,
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

export interface ProposeKnowledgeNodePromotionInput {
  mutation: Omit<PromoteKnowledgeNodeInput, 'contextScopeId' | 'expectedAccessEpoch'>;
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

interface NodePromotionProposalPayload {
  kind: 'promote-node';
  mutation: Omit<PromoteKnowledgeNodeInput, 'contextScopeId' | 'expectedAccessEpoch'>;
}

type KnowledgeProposalPayload = NodeUpdateProposalPayload | NodePromotionProposalPayload;

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

function decodeProposalPayload(proposal: KnowledgeProposal): KnowledgeProposalPayload {
  const payload = proposal.payload as Partial<KnowledgeProposalPayload>;
  if (!payload.mutation || typeof payload.mutation !== 'object') {
    throw new Error(`Invalid immutable payload for knowledge proposal ${proposal.id}`);
  }
  if (
    payload.kind === 'update-node' &&
    Array.isArray((payload as Partial<NodeUpdateProposalPayload>).originalScopeIds)
  ) {
    return structuredClone(payload as NodeUpdateProposalPayload);
  }
  if (payload.kind === 'promote-node') {
    const mutation = payload.mutation as Partial<NodePromotionProposalPayload['mutation']>;
    if (
      typeof mutation.id === 'string' &&
      typeof mutation.version === 'number' &&
      typeof mutation.sourceScopeId === 'string' &&
      typeof mutation.destinationScopeId === 'string'
    ) {
      return structuredClone(payload as NodePromotionProposalPayload);
    }
  }
  throw new Error(`Invalid immutable payload for knowledge proposal ${proposal.id}`);
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

  async proposeNodePromotion(input: ProposeKnowledgeNodePromotionInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.proposerContextScopeId);
    const node = await this.resolveNode({ id: input.mutation.id, scopeIds: input.vouchedScopeIds });
    if (!node) throw new KnowledgeNotFoundError('node', input.mutation.id);
    if (node.version !== input.mutation.version) throw new KnowledgeConflictError(node.id);

    const targets = await this.#promotionTargets({
      node,
      sourceScopeId: input.mutation.sourceScopeId,
      destinationScopeId: input.mutation.destinationScopeId,
      vouchedScopeIds: input.vouchedScopeIds,
      frontier,
      capability: 'suggest',
    });
    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: 'promote-node',
        payload: { kind: 'promote-node', mutation: structuredClone(input.mutation) },
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
    decodeProposalPayload(proposal);
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
    decodeProposalPayload(proposal);
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
    const payload = decodeProposalPayload(proposal);
    const current = await this.resolveNode({ id: payload.mutation.id, scopeIds: input.vouchedScopeIds });
    if (!current) throw new KnowledgeNotFoundError('node', payload.mutation.id);
    let targets: KnowledgeProposalTarget[];
    if (payload.kind === 'promote-node') {
      targets = await this.#promotionTargets({
        node: current,
        sourceScopeId: payload.mutation.sourceScopeId,
        destinationScopeId: payload.mutation.destinationScopeId,
        vouchedScopeIds: input.vouchedScopeIds,
        frontier,
        capability: 'manageAccess',
      });
    } else {
      const currentScopeIds = await this.storage.getNodeScopeIds(current.id);
      const approvalCapability = payload.mutation.scopeIds ? 'manageAccess' : 'edit';
      this.#assertApprovalCapability(frontier, currentScopeIds, approvalCapability, 'node', current.id);
      targets = [
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
    }
    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: proposal.operation,
        payload:
          payload.kind === 'update-node'
            ? {
                ...payload,
                mutation: { ...payload.mutation, version: current.version },
                originalScopeIds: await this.storage.getNodeScopeIds(current.id),
              }
            : { ...payload, mutation: { ...payload.mutation, version: current.version } },
        reason: input.reason ?? proposal.reason,
        proposerContextScopeId: input.reviewerContextScopeId,
        expectedAccessEpoch: frontier.accessEpoch,
      }),
      frontier,
    );
  }

  async #promotionTargets(input: {
    node: KnowledgeNode;
    sourceScopeId: string;
    destinationScopeId: string;
    vouchedScopeIds: KnowledgeScopeIds;
    frontier: KnowledgeAccessFrontier;
    capability: 'suggest' | 'manageAccess';
  }): Promise<KnowledgeProposalTarget[]> {
    const nodeScopeIds = await this.storage.getNodeScopeIds(input.node.id);
    if (!nodeScopeIds.includes(input.sourceScopeId)) throw new KnowledgeNotFoundError('node', input.node.id);
    const structuralScopeIds = [input.sourceScopeId, input.destinationScopeId].sort();
    assertKnowledgeScopeCapabilities({
      frontier: input.frontier,
      scopeIds: structuralScopeIds,
      capability: input.capability,
      targetType: 'scope',
    });
    const targets: KnowledgeProposalTarget[] = [
      {
        type: 'node',
        id: input.node.id,
        expectedVersion: input.node.version,
        scopeIds: nodeScopeIds,
        approvalCapability: 'manageAccess',
      },
    ];
    let after: string | undefined;
    do {
      const page = await this.storage.listRecords({
        node: input.node.id,
        scopeIds: getKnowledgeReadableScopeIds(input.frontier),
        membershipScopeIds: [input.sourceScopeId],
        after,
        limit: 100,
        includeDeleted: false,
      });
      for (const record of page.records) {
        const scopeIds = await this.storage.getRecordScopeIds(record.id);
        assertKnowledgeTargetCapability({
          frontier: input.frontier,
          scopeIds,
          capability: input.capability === 'suggest' ? 'suggest' : 'edit',
          targetType: 'record',
          targetId: record.id,
        });
        targets.push({
          type: 'record',
          id: record.id,
          expectedVersion: record.version,
          scopeIds,
          approvalCapability: 'edit',
        });
      }
      after = page.nextCursor;
    } while (after);
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
    return targets;
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

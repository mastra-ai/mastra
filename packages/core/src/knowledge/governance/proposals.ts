import {
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  assertKnowledgeProposalMutationSemantics,
  createKnowledgeUlid,
  type KnowledgeNode,
  type KnowledgeProposal,
  type KnowledgeProposalApprovalCapability,
  type KnowledgeProposalApprovalScopeIds,
  type KnowledgeProposalMutation,
  type KnowledgeProposalTarget,
  type KnowledgeRecord,
  type KnowledgeScopeIds,
  type KnowledgeStorage,
  type ListKnowledgeProposalsOutput,
  type PromoteKnowledgeNodeInput,
  type UpdateKnowledgeNodeInput,
} from '../../storage/domains/knowledge';
import { resolveKnowledgeGrantCapabilities } from '../access/grants';
import {
  assertKnowledgeScopeCapabilities,
  assertKnowledgeTargetCapability,
  getKnowledgeMutationCapabilities,
} from '../access/mutations';
import { getKnowledgeReadableScopeIds } from '../access/read-filter';
import type { KnowledgeAccessFrontier } from '../access/types';

const APPROVAL_CAPABILITIES = [
  'append',
  'edit',
  'delete',
  'createChildren',
  'manageAccess',
] as const satisfies readonly KnowledgeProposalApprovalCapability[];

export interface ProposeKnowledgeMutationInput {
  mutation: KnowledgeProposalMutation;
  proposerContextScopeId: string;
  vouchedScopeIds: KnowledgeScopeIds;
  reason?: string;
}

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

function decodeMutation(proposal: KnowledgeProposal): KnowledgeProposalMutation {
  const payload = proposal.payload as Partial<KnowledgeProposalMutation>;
  if (!payload.kind || !payload.mutation || typeof payload.mutation !== 'object') {
    throw new Error(`Invalid immutable payload for knowledge proposal ${proposal.id}`);
  }
  return structuredClone(payload as KnowledgeProposalMutation);
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
    return this.propose({
      ...input,
      mutation: {
        kind: input.mutation.isScope === true ? 'promote-node' : input.mutation.scopeIds ? 'move-node' : 'update-node',
        mutation: proposalNodeUpdateMutation(input.mutation),
      } as KnowledgeProposalMutation,
    });
  }

  async propose(input: ProposeKnowledgeMutationInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.proposerContextScopeId);
    const mutation = structuredClone(input.mutation);
    const targets = await this.#proposalTargets(mutation);
    assertKnowledgeProposalMutationSemantics(mutation, targets);

    for (const target of targets) {
      if (mutation.kind === 'restore-scope') continue;
      assertKnowledgeTargetCapability({
        frontier,
        scopeIds: target.scopeIds,
        capability: 'suggest',
        targetType: target.type,
        targetId: target.id,
      });
    }
    await this.#assertRestoreScopeAuthority(mutation, frontier, 'suggest');
    this.#assertSubmittedVersions(mutation, targets);

    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: mutation.kind,
        payload: mutation,
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
      allowSuggestion: true,
    });
    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: 'promote-node',
        payload: { kind: 'curate-node', mutation: structuredClone(input.mutation) } satisfies KnowledgeProposalMutation,
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
      ...(await this.#proposalVisibility(frontier)),
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
      ...(await this.#proposalVisibility(frontier)),
    });
    return proposal ? this.#redactAttribution(proposal, frontier) : null;
  }

  async approve(input: ReviewKnowledgeProposalDecisionInput): Promise<KnowledgeProposal> {
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    this.#assertContextScope(frontier, input.reviewerContextScopeId);
    const proposal = await this.#getVisiblePendingProposal(input.id, frontier);
    const mutation = decodeMutation(proposal);
    await this.#assertRestoreScopeAuthority(mutation, frontier, 'manageAccess');
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
    const mutation = decodeMutation(proposal);
    await this.#assertRestoreScopeAuthority(mutation, frontier, 'manageAccess');
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
      ...(await this.#proposalVisibility(frontier)),
    });
    if (!proposal || proposal.status !== 'conflicted') throw new KnowledgeNotFoundError('proposal', input.id);
    const mutation = await this.#refreshMutation(decodeMutation(proposal));
    const targets =
      mutation.kind === 'curate-node'
        ? await this.#promotionTargets({
            node: await this.#liveNode(mutation.mutation.id),
            sourceScopeId: mutation.mutation.sourceScopeId,
            destinationScopeId: mutation.mutation.destinationScopeId,
            vouchedScopeIds: input.vouchedScopeIds,
            frontier,
            allowSuggestion: false,
          })
        : await this.#proposalTargets(mutation);
    for (const target of targets) {
      if (mutation.kind === 'restore-scope') continue;
      assertKnowledgeTargetCapability({
        frontier,
        scopeIds: target.scopeIds,
        capability: target.approvalCapability,
        targetType: target.type,
        targetId: target.id,
      });
    }
    await this.#assertRestoreScopeAuthority(mutation, frontier, 'manageAccess');
    return this.#redactAttribution(
      await this.storage.createProposal({
        targets,
        operation: mutation.kind,
        payload: mutation,
        reason: input.reason ?? proposal.reason,
        proposerContextScopeId: input.reviewerContextScopeId,
        expectedAccessEpoch: frontier.accessEpoch,
      }),
      frontier,
    );
  }

  async #proposalTargets(mutation: KnowledgeProposalMutation): Promise<KnowledgeProposalTarget[]> {
    switch (mutation.kind) {
      case 'create-node':
        return this.#scopeTargets(mutation.mutation.scopeIds, 'append');
      case 'create-scope': {
        if (await this.storage.getScopeAddress(mutation.address)) throw new KnowledgeConflictError(mutation.address);
        return this.#scopeTargets(mutation.mutation.scopeIds, 'createChildren');
      }
      case 'update-node': {
        const node = await this.#liveNode(mutation.mutation.id);
        return [await this.#nodeTarget(node, 'edit')];
      }
      case 'move-node': {
        const node = await this.#liveNode(mutation.mutation.id);
        const originalScopeIds = await this.storage.getNodeScopeIds(node.id);
        return [
          { ...(await this.#nodeTarget(node, 'manageAccess')), scopeIds: originalScopeIds },
          ...(await this.#scopeTargets(
            [...new Set([...originalScopeIds, ...mutation.mutation.scopeIds])],
            'manageAccess',
          )),
        ];
      }
      case 'promote-node': {
        const node = await this.#liveNode(mutation.mutation.id);
        return [await this.#nodeTarget(node, 'manageAccess')];
      }
      case 'curate-node':
        throw new Error('Curated node promotions must use proposeNodePromotion');
      case 'merge-nodes': {
        const source = await this.#liveNode(mutation.mutation.sourceId);
        const target = await this.#liveNode(mutation.mutation.targetId);
        return [await this.#nodeTarget(source, 'manageAccess'), await this.#nodeTarget(target, 'edit')];
      }
      case 'delete-node': {
        const node = await this.#liveNode(mutation.mutation.id);
        if (node.isScope) throw new KnowledgeConflictError('Use delete-scope for scope nodes');
        return [await this.#nodeTarget(node, 'manageAccess')];
      }
      case 'delete-scope': {
        const node = await this.#liveNode(mutation.mutation.id);
        if (!node.isScope) throw new KnowledgeConflictError('Use delete-node for non-scope nodes');
        return [{ ...(await this.#nodeTarget(node, 'manageAccess')), scopeIds: [node.id] }];
      }
      case 'restore-node':
      case 'restore-scope': {
        const node = await this.#deletedNode(mutation.mutation.id);
        if (node.isScope !== (mutation.kind === 'restore-scope'))
          throw new KnowledgeConflictError(mutation.mutation.id);
        const retainedScopeIds = await this.storage.getNodeScopeIds(node.id);
        if (mutation.kind === 'restore-scope') {
          const target = { ...(await this.#nodeTarget(node, 'manageAccess')), expectedDeleted: true };
          return [
            { ...target, scopeIds: [node.id] },
            { ...target, scopeIds: retainedScopeIds },
          ];
        }
        return [
          { ...(await this.#nodeTarget(node, 'manageAccess')), scopeIds: retainedScopeIds, expectedDeleted: true },
        ];
      }
      case 'restore-record': {
        const record = await this.#record(mutation.mutation.id, true);
        return [{ ...(await this.#recordTarget(record, 'manageAccess')), expectedDeleted: true }];
      }
      case 'add-record-scope':
      case 'remove-record-scope': {
        const record = await this.#record(mutation.mutation.id, false);
        const currentScopeIds = await this.storage.getRecordScopeIds(record.id);
        const targets: KnowledgeProposalTarget[] = [
          { ...(await this.#recordTarget(record, 'edit')), scopeIds: currentScopeIds },
        ];
        if (mutation.kind === 'add-record-scope') {
          const added = mutation.mutation.scopeIds.filter(scopeId => !currentScopeIds.includes(scopeId));
          targets.push(...(await this.#scopeTargets(added, 'append')));
        }
        return targets;
      }
    }
  }

  async #scopeTargets(scopeIds: KnowledgeScopeIds, capability: KnowledgeProposalApprovalCapability) {
    return Promise.all(
      [...new Set(scopeIds)].map(async scopeId => {
        const scope = await this.#liveNode(scopeId);
        if (!scope.isScope) throw new KnowledgeNotFoundError('scope', scopeId);
        return {
          type: 'node' as const,
          id: scope.id,
          expectedVersion: scope.version,
          scopeIds: [scope.id],
          approvalCapability: capability,
        };
      }),
    );
  }

  async #nodeTarget(node: KnowledgeNode, capability: KnowledgeProposalApprovalCapability) {
    return {
      type: 'node' as const,
      id: node.id,
      expectedVersion: node.version,
      scopeIds: await this.storage.getNodeScopeIds(node.id),
      approvalCapability: capability,
    };
  }

  async #recordTarget(record: KnowledgeRecord, capability: KnowledgeProposalApprovalCapability) {
    return {
      type: 'record' as const,
      id: record.id,
      expectedVersion: record.version,
      scopeIds: await this.storage.getRecordScopeIds(record.id),
      approvalCapability: capability,
    };
  }

  async #liveNode(id: string): Promise<KnowledgeNode> {
    const node = await this.storage.getNode(id);
    if (!node || node.deletedAt) throw new KnowledgeNotFoundError('node', id);
    return node;
  }

  async #deletedNode(id: string): Promise<KnowledgeNode> {
    const node = await this.storage.getNodeIncludingDeleted(id);
    if (!node?.deletedAt) throw new KnowledgeNotFoundError('node', id);
    return node;
  }

  async #record(id: string, deleted: boolean): Promise<KnowledgeRecord> {
    const record = await this.storage.getRecord({ id, includeDeleted: true });
    if (!record || Boolean(record.deletedAt) !== deleted) throw new KnowledgeNotFoundError('record', id);
    return record;
  }

  #assertSubmittedVersions(mutation: KnowledgeProposalMutation, targets: KnowledgeProposalTarget[]): void {
    let submitted: Array<[string, number]>;
    if (mutation.kind === 'create-node' || mutation.kind === 'create-scope') return;
    if (mutation.kind === 'merge-nodes') {
      submitted = [
        [mutation.mutation.sourceId, mutation.mutation.sourceVersion],
        [mutation.mutation.targetId, mutation.mutation.targetVersion],
      ];
    } else submitted = [[mutation.mutation.id, mutation.mutation.version]];
    for (const [id, version] of submitted) {
      const target = targets.find(candidate => candidate.id === id);
      if (!target || target.expectedVersion !== version) throw new KnowledgeConflictError(id);
    }
  }

  async #refreshMutation(mutation: KnowledgeProposalMutation): Promise<KnowledgeProposalMutation> {
    if (mutation.kind === 'create-node' || mutation.kind === 'create-scope') {
      mutation.mutation.id = createKnowledgeUlid();
      return mutation;
    }
    if (mutation.kind === 'merge-nodes') {
      mutation.mutation.sourceVersion = (await this.#liveNode(mutation.mutation.sourceId)).version;
      mutation.mutation.targetVersion = (await this.#liveNode(mutation.mutation.targetId)).version;
      return mutation;
    }
    const entity =
      mutation.kind === 'restore-record'
        ? await this.storage.getRecord({ id: mutation.mutation.id, includeDeleted: true })
        : await this.storage.getNodeIncludingDeleted(mutation.mutation.id);
    if (!entity)
      throw new KnowledgeNotFoundError(mutation.kind === 'restore-record' ? 'record' : 'node', mutation.mutation.id);
    mutation.mutation.version = entity.version;
    return mutation;
  }

  async #promotionTargets(input: {
    node: KnowledgeNode;
    sourceScopeId: string;
    destinationScopeId: string;
    vouchedScopeIds: KnowledgeScopeIds;
    frontier: KnowledgeAccessFrontier;
    allowSuggestion: boolean;
  }): Promise<KnowledgeProposalTarget[]> {
    const nodeScopeIds = await this.storage.getNodeScopeIds(input.node.id);
    if (!nodeScopeIds.includes(input.sourceScopeId)) throw new KnowledgeNotFoundError('node', input.node.id);
    const structuralScopeIds = [input.sourceScopeId, input.destinationScopeId].sort();
    if (input.allowSuggestion) {
      for (const scopeId of structuralScopeIds) {
        const capabilities = getKnowledgeMutationCapabilities(input.frontier, [scopeId]);
        if (!capabilities.manageAccess && !capabilities.suggest) throw new KnowledgeNotFoundError('scope', scopeId);
      }
    } else {
      assertKnowledgeScopeCapabilities({
        frontier: input.frontier,
        scopeIds: structuralScopeIds,
        capability: 'manageAccess',
        targetType: 'scope',
      });
    }
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
        if (input.allowSuggestion) {
          const capabilities = getKnowledgeMutationCapabilities(input.frontier, scopeIds);
          if (!capabilities.edit && !capabilities.suggest) throw new KnowledgeNotFoundError('record', record.id);
        } else {
          assertKnowledgeTargetCapability({
            frontier: input.frontier,
            scopeIds,
            capability: 'edit',
            targetType: 'record',
            targetId: record.id,
          });
        }
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

  async #proposalVisibility(frontier: KnowledgeAccessFrontier): Promise<{
    scopeIds: KnowledgeScopeIds;
    approvalScopeIds: KnowledgeProposalApprovalScopeIds;
  }> {
    const approvalScopeIds: KnowledgeProposalApprovalScopeIds = {};
    const retainedGrants = await this.storage.listScopeGrants({ includeDeleted: true });
    for (const capability of APPROVAL_CAPABILITIES) {
      const scopeIds = Object.entries(frontier.scopes)
        .filter(([, scope]) => scope[capability])
        .map(([scopeId]) => scopeId);
      for (const grant of retainedGrants) {
        const referenceCapabilities = frontier.scopes[grant.scopeRefId];
        if (referenceCapabilities && resolveKnowledgeGrantCapabilities(grant, referenceCapabilities)[capability]) {
          scopeIds.push(grant.scopeNodeId);
        }
      }
      approvalScopeIds[capability] = [...new Set(scopeIds)];
    }
    return { scopeIds: getKnowledgeReadableScopeIds(frontier), approvalScopeIds };
  }

  async #getVisiblePendingProposal(id: string, frontier: KnowledgeAccessFrontier): Promise<KnowledgeProposal> {
    const proposal = await this.storage.getVisibleProposal({ id, ...(await this.#proposalVisibility(frontier)) });
    if (!proposal || proposal.status !== 'pending') throw new KnowledgeNotFoundError('proposal', id);
    return proposal;
  }

  async #authorizeAndFindStaleTarget(
    proposal: KnowledgeProposal,
    frontier: KnowledgeAccessFrontier,
    vouchedScopeIds: KnowledgeScopeIds,
  ): Promise<KnowledgeProposalTarget | undefined> {
    const mutation = decodeMutation(proposal);
    for (const target of proposal.targets) {
      const isPrimaryTarget = target.id === proposal.targetId;
      let entity =
        isPrimaryTarget && !target.expectedDeleted
          ? target.type === 'node'
            ? await this.resolveNode({ id: target.id, scopeIds: vouchedScopeIds })
            : await this.resolveRecord({ id: target.id, scopeIds: vouchedScopeIds })
          : target.type === 'node'
            ? await this.storage.getNodeIncludingDeleted(target.id)
            : await this.storage.getRecord({ id: target.id, includeDeleted: true });
      if (!entity && target.type === 'node' && !target.expectedDeleted) {
        entity = await this.resolveScope({ id: target.id, scopeIds: vouchedScopeIds });
      }
      if (!entity) throw new KnowledgeNotFoundError(target.type, target.id);
      const currentScopeIds =
        target.type === 'node'
          ? 'isScope' in entity && entity.isScope
            ? [entity.id]
            : await this.storage.getNodeScopeIds(entity.id)
          : await this.storage.getRecordScopeIds(entity.id);
      if (mutation.kind !== 'restore-scope') {
        assertKnowledgeTargetCapability({
          frontier,
          scopeIds: currentScopeIds,
          capability: target.approvalCapability,
          targetType: target.type,
          targetId: target.id,
        });
      }
      if (Boolean(entity.deletedAt) !== Boolean(target.expectedDeleted) || entity.version !== target.expectedVersion) {
        return target;
      }
    }
    return undefined;
  }

  async #assertRestoreScopeAuthority(
    mutation: KnowledgeProposalMutation,
    frontier: KnowledgeAccessFrontier,
    capability: 'suggest' | 'manageAccess',
  ): Promise<void> {
    if (mutation.kind !== 'restore-scope') return;
    const scopeId = mutation.mutation.id;
    const grants = await this.storage.listScopeGrants({ scopeNodeId: scopeId, includeDeleted: true });
    const hasRetainedAuthority = grants.some(grant => {
      const referenceCapabilities = frontier.scopes[grant.scopeRefId];
      return Boolean(
        referenceCapabilities && resolveKnowledgeGrantCapabilities(grant, referenceCapabilities)[capability],
      );
    });
    const parentScopeIds = await this.storage.getNodeScopeIds(scopeId);
    const hasParentAuthority = parentScopeIds.some(parentScopeId => frontier.scopes[parentScopeId]?.[capability]);
    if (!hasRetainedAuthority || !hasParentAuthority) {
      throw new KnowledgeNotFoundError('scope', scopeId);
    }
  }

  #redactAttribution(proposal: KnowledgeProposal, frontier: KnowledgeAccessFrontier): KnowledgeProposal {
    const redacted = structuredClone(proposal);
    const readable = new Set(getKnowledgeReadableScopeIds(frontier));
    if (redacted.proposerContextScopeId && !readable.has(redacted.proposerContextScopeId)) {
      delete redacted.proposerContextScopeId;
    }
    if (redacted.reviewerContextScopeId && !readable.has(redacted.reviewerContextScopeId)) {
      delete redacted.reviewerContextScopeId;
    }
    return redacted;
  }

  #assertContextScope(frontier: KnowledgeAccessFrontier, contextScopeId: string): void {
    if (!frontier.scopes[contextScopeId]?.read) throw new KnowledgeNotFoundError('scope', contextScopeId);
  }
}

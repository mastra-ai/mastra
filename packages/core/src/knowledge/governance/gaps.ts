import {
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  assertKnowledgeProposalMutationSemantics,
  type KnowledgeProposal,
  type KnowledgeProposalApprovalScopeIds,
  type KnowledgeProposalMutation,
  type KnowledgeProposalTarget,
  type KnowledgeScopeIds,
  type KnowledgeStorage,
} from '../../storage/domains/knowledge';
import { assertKnowledgeScopeCapabilities } from '../access/mutations';
import { getKnowledgeReadableScopeIds } from '../access/read-filter';
import type { KnowledgeAccessFrontier } from '../access/types';

export interface KnowledgeGapFlagTarget {
  type: 'node' | 'record';
  id: string;
}

export interface FileKnowledgeGapFlagInput {
  claim: string;
  evidence: readonly string[];
  targets: readonly KnowledgeGapFlagTarget[];
  proposerContextScopeId: string;
  vouchedScopeIds: KnowledgeScopeIds;
}

export interface KnowledgeGapFlagPayload {
  kind: 'gap-flag';
  claim: string;
  evidence: string[];
}

export type KnowledgeGapVerificationResult =
  | { outcome: 'verified'; mutation: KnowledgeProposalMutation; evidence: readonly string[] }
  | { outcome: 'rejected'; evidence: readonly string[] }
  | { outcome: 'needs-judgment'; evidence: readonly string[] };

export interface KnowledgeGapQueueWorkerConfig {
  vouchedScopeIds: KnowledgeScopeIds;
  reviewerContextScopeId: string;
  protectedScopeIds?: KnowledgeScopeIds;
  verify: (input: {
    claim: string;
    targets: readonly KnowledgeGapFlagTarget[];
    signal: AbortSignal;
  }) => Promise<KnowledgeGapVerificationResult>;
  notifyEscalation?: (proposal: KnowledgeProposal) => Promise<void> | void;
}

function decodeGapFlag(proposal: KnowledgeProposal): KnowledgeGapFlagPayload | null {
  const payload = proposal.payload as Partial<KnowledgeGapFlagPayload>;
  if (payload.kind !== 'gap-flag' || typeof payload.claim !== 'string' || !Array.isArray(payload.evidence)) return null;
  return {
    kind: 'gap-flag',
    claim: payload.claim,
    evidence: payload.evidence.filter(value => typeof value === 'string'),
  };
}

export class KnowledgeGapFlags {
  constructor(
    private readonly storage: KnowledgeStorage,
    private readonly evaluateAccess: (vouchedScopeIds: KnowledgeScopeIds) => Promise<KnowledgeAccessFrontier>,
  ) {}

  async file(input: FileKnowledgeGapFlagInput): Promise<KnowledgeProposal> {
    if (!input.claim.trim()) throw new Error('A Knowledge gap flag requires a claim');
    if (!input.targets.length) throw new Error('A Knowledge gap flag requires at least one target');
    const frontier = await this.evaluateAccess(input.vouchedScopeIds);
    if (!frontier.scopes[input.proposerContextScopeId]?.read) {
      throw new KnowledgeNotFoundError('scope', input.proposerContextScopeId);
    }
    const targets = await Promise.all(input.targets.map(target => this.#target(target)));
    assertKnowledgeScopeCapabilities({
      frontier,
      scopeIds: [...new Set(targets.flatMap(target => target.scopeIds))],
      capability: 'suggest',
      targetType: 'gap flag',
    });
    return this.storage.createProposal({
      targets,
      operation: 'gap-flag',
      payload: {
        kind: 'gap-flag',
        claim: input.claim.trim(),
        evidence: input.evidence.map(value => value.trim()).filter(Boolean),
      },
      proposerContextScopeId: input.proposerContextScopeId,
      expectedAccessEpoch: frontier.accessEpoch,
    });
  }

  createWorker(config: KnowledgeGapQueueWorkerConfig): KnowledgeGapQueueWorker {
    return new KnowledgeGapQueueWorker(this.storage, this.evaluateAccess, config);
  }

  async #target(target: KnowledgeGapFlagTarget): Promise<KnowledgeProposalTarget> {
    if (target.type === 'node') {
      const node = await this.storage.getNode(target.id);
      if (!node || node.deletedAt) throw new KnowledgeNotFoundError('node', target.id);
      return {
        ...target,
        expectedVersion: node.version,
        scopeIds: await this.storage.getNodeScopeIds(target.id),
        approvalCapability: node.isScope ? ('manageAccess' as const) : ('edit' as const),
      };
    }
    const record = await this.storage.getRecord({ id: target.id, includeDeleted: false });
    if (!record || record.deletedAt) throw new KnowledgeNotFoundError('record', target.id);
    return {
      ...target,
      expectedVersion: record.version,
      scopeIds: await this.storage.getRecordScopeIds(target.id),
      approvalCapability: 'edit' as const,
    };
  }
}

export class KnowledgeGapQueueWorker {
  readonly #abortController = new AbortController();
  #timer?: ReturnType<typeof setInterval>;
  #running?: Promise<KnowledgeProposal | null>;

  constructor(
    private readonly storage: KnowledgeStorage,
    private readonly evaluateAccess: (vouchedScopeIds: KnowledgeScopeIds) => Promise<KnowledgeAccessFrontier>,
    private readonly config: KnowledgeGapQueueWorkerConfig,
  ) {}

  start(intervalMs: number): void {
    if (this.#timer) return;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0)
      throw new Error('Knowledge gap queue interval must be positive');
    this.#timer = setInterval(() => void this.runOnce(), intervalMs);
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    this.#abortController.abort();
  }

  runOnce(): Promise<KnowledgeProposal | null> {
    this.#running ??= this.#processOne().finally(() => {
      this.#running = undefined;
    });
    return this.#running;
  }

  async #processOne(): Promise<KnowledgeProposal | null> {
    const frontier = await this.evaluateAccess(this.config.vouchedScopeIds);
    if (!frontier.scopes[this.config.reviewerContextScopeId]?.read) {
      throw new KnowledgeNotFoundError('scope', this.config.reviewerContextScopeId);
    }
    let cursor: string | undefined;
    let proposal: KnowledgeProposal | undefined;
    do {
      const page = await this.storage.listProposals({
        ...this.#visibility(frontier),
        status: 'pending',
        cursor,
        limit: 100,
      });
      proposal = page.proposals.find(candidate => decodeGapFlag(candidate));
      cursor = page.nextCursor;
    } while (!proposal && cursor);
    if (!proposal) return null;
    const stale = await this.#authorizeAndFindStaleTarget(proposal, frontier);
    if (stale) {
      return this.storage.reviewProposal({
        id: proposal.id,
        status: 'conflicted',
        reviewerContextScopeId: this.config.reviewerContextScopeId,
        reviewReason: `Expected ${stale.type} ${stale.id} version ${stale.expectedVersion}`,
        expectedAccessEpoch: frontier.accessEpoch,
      });
    }
    if (proposal.targets.some(target => this.config.protectedScopeIds?.some(id => target.scopeIds.includes(id)))) {
      return this.#escalate(proposal, frontier.accessEpoch, ['Protected scope requires human judgment']);
    }

    const payload = decodeGapFlag(proposal)!;
    const result = await this.config.verify({
      claim: payload.claim,
      targets: proposal.targets.map(({ type, id }) => ({ type, id })),
      signal: this.#abortController.signal,
    });
    const evidence = result.evidence.map(value => value.trim()).filter(Boolean);
    if (result.outcome === 'needs-judgment') return this.#escalate(proposal, frontier.accessEpoch, evidence);
    if (result.outcome === 'rejected') {
      return this.storage.reviewProposal({
        id: proposal.id,
        status: 'rejected',
        reviewerContextScopeId: this.config.reviewerContextScopeId,
        reviewReason: JSON.stringify({ contradictingEvidence: evidence }),
        expectedAccessEpoch: frontier.accessEpoch,
      });
    }

    const targets = await this.#authorizeVerifiedMutation(proposal, result.mutation, frontier);
    return this.storage.resolveGapProposal({
      id: proposal.id,
      reviewerContextScopeId: this.config.reviewerContextScopeId,
      reviewReason: JSON.stringify({ verifiedEvidence: evidence, appliedMutation: result.mutation.kind }),
      mutation: result.mutation,
      targets,
      expectedAccessEpoch: frontier.accessEpoch,
    });
  }

  async #authorizeVerifiedMutation(
    proposal: KnowledgeProposal,
    mutation: KnowledgeProposalMutation,
    frontier: KnowledgeAccessFrontier,
  ): Promise<KnowledgeProposalTarget[]> {
    const targets = new Map<string, KnowledgeProposalTarget>();
    const proposedTarget = (type: 'node' | 'record', id: string, version: number) => {
      const target = proposal.targets.find(candidate => candidate.type === type && candidate.id === id);
      if (!target || target.expectedVersion !== version) {
        throw new KnowledgeConflictError(`Verified mutation target ${type} ${id} was not bound to the gap flag`);
      }
      targets.set(`${type}:${id}`, target);
    };
    const assertScopes = (
      scopeIds: KnowledgeScopeIds,
      capability: 'append' | 'edit' | 'createChildren' | 'manageAccess',
    ) => assertKnowledgeScopeCapabilities({ frontier, scopeIds, capability, targetType: 'verified gap mutation' });
    const assertNode = async (id: string, version: number, capability: 'edit' | 'manageAccess') => {
      proposedTarget('node', id, version);
      const node = await this.storage.getNodeIncludingDeleted(id);
      if (!node || node.deletedAt || node.version !== version) throw new KnowledgeConflictError(id);
      const scopeIds = node.isScope ? [node.id] : await this.storage.getNodeScopeIds(id);
      assertScopes(scopeIds, capability);
      return scopeIds;
    };
    const assertRecord = async (id: string, version: number) => {
      proposedTarget('record', id, version);
      const record = await this.storage.getRecord({ id, includeDeleted: true });
      if (!record || record.deletedAt || record.version !== version) throw new KnowledgeConflictError(id);
      assertScopes(await this.storage.getRecordScopeIds(id), 'edit');
    };
    const assertScopeTarget = async (scopeId: string, capability: 'append' | 'createChildren' | 'manageAccess') => {
      const scope = await this.storage.getNodeIncludingDeleted(scopeId);
      if (!scope || scope.deletedAt || !scope.isScope) throw new KnowledgeConflictError(scopeId);
      proposedTarget('node', scope.id, scope.version);
      assertScopes([scope.id], capability);
    };
    const assertCreatedInBoundScopes = async (scopeIds: KnowledgeScopeIds, capability: 'append' | 'createChildren') => {
      for (const scopeId of scopeIds) await assertScopeTarget(scopeId, capability);
    };

    assertKnowledgeProposalMutationSemantics(mutation, proposal.targets);
    switch (mutation.kind) {
      case 'create-node':
        await assertCreatedInBoundScopes(mutation.mutation.scopeIds, 'append');
        return [...targets.values()];
      case 'create-scope':
        await assertCreatedInBoundScopes(mutation.mutation.scopeIds, 'createChildren');
        return [...targets.values()];
      case 'update-node':
      case 'promote-node':
        await assertNode(
          mutation.mutation.id,
          mutation.mutation.version,
          mutation.kind === 'update-node' ? 'edit' : 'manageAccess',
        );
        return [...targets.values()];
      case 'move-node': {
        const retainedScopeIds = await assertNode(mutation.mutation.id, mutation.mutation.version, 'manageAccess');
        for (const scopeId of [...retainedScopeIds, ...mutation.mutation.scopeIds]) {
          await assertScopeTarget(scopeId, 'manageAccess');
        }
        return [...targets.values()];
      }
      case 'merge-nodes':
        await assertNode(mutation.mutation.sourceId, mutation.mutation.sourceVersion, 'manageAccess');
        await assertNode(mutation.mutation.targetId, mutation.mutation.targetVersion, 'edit');
        return [...targets.values()];
      case 'delete-node':
      case 'delete-scope':
        await assertNode(mutation.mutation.id, mutation.mutation.version, 'manageAccess');
        return [...targets.values()];
      case 'curate-node': {
        const node = await this.storage.getNodeIncludingDeleted(mutation.mutation.id);
        await assertNode(mutation.mutation.id, mutation.mutation.version, 'manageAccess');
        if (!node || node.deletedAt) throw new KnowledgeConflictError(mutation.mutation.id);
        await assertScopeTarget(mutation.mutation.sourceScopeId, 'manageAccess');
        await assertScopeTarget(mutation.mutation.destinationScopeId, 'manageAccess');
        let cursor: string | undefined;
        do {
          const page = await this.storage.listRecords({
            node,
            scopeIds: getKnowledgeReadableScopeIds(frontier),
            membershipScopeIds: [mutation.mutation.sourceScopeId],
            after: cursor,
            limit: 100,
          });
          for (const record of page.records) await assertRecord(record.id, record.version);
          cursor = page.nextCursor;
        } while (cursor);
        return [...targets.values()];
      }
      case 'restore-node':
      case 'restore-scope':
      case 'restore-record':
        throw new KnowledgeConflictError('Verified gap mutations cannot restore deleted targets');
      case 'add-record-scope':
        await assertRecord(mutation.mutation.id, mutation.mutation.version);
        await assertCreatedInBoundScopes(mutation.mutation.scopeIds, 'append');
        return [...targets.values()];
      case 'remove-record-scope':
        await assertRecord(mutation.mutation.id, mutation.mutation.version);
        return [...targets.values()];
    }
  }

  async #escalate(proposal: KnowledgeProposal, expectedAccessEpoch: number, evidence: readonly string[]) {
    const escalated = await this.storage.reviewProposal({
      id: proposal.id,
      status: 'escalated',
      reviewerContextScopeId: this.config.reviewerContextScopeId,
      reviewReason: JSON.stringify({ verificationEvidence: evidence }),
      expectedAccessEpoch,
    });
    await this.config.notifyEscalation?.(escalated);
    return escalated;
  }

  async #authorizeAndFindStaleTarget(
    proposal: KnowledgeProposal,
    frontier: KnowledgeAccessFrontier,
  ): Promise<KnowledgeProposalTarget | undefined> {
    for (const target of proposal.targets) {
      assertKnowledgeScopeCapabilities({
        frontier,
        scopeIds: target.scopeIds,
        capability: target.approvalCapability,
        targetType: `${target.type} ${target.id}`,
      });
      const entity =
        target.type === 'node'
          ? await this.storage.getNodeIncludingDeleted(target.id)
          : await this.storage.getRecord({ id: target.id, includeDeleted: true });
      if (!entity || entity.deletedAt || entity.version !== target.expectedVersion) return target;
    }
    return undefined;
  }

  #visibility(frontier: KnowledgeAccessFrontier): {
    scopeIds: KnowledgeScopeIds;
    approvalScopeIds: KnowledgeProposalApprovalScopeIds;
  } {
    const approvalScopeIds: KnowledgeProposalApprovalScopeIds = {};
    for (const capability of ['append', 'edit', 'delete', 'createChildren', 'manageAccess'] as const) {
      approvalScopeIds[capability] = Object.entries(frontier.scopes)
        .filter(([, scope]) => scope[capability])
        .map(([scopeId]) => scopeId);
    }
    return { scopeIds: getKnowledgeReadableScopeIds(frontier), approvalScopeIds };
  }
}

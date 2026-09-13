import {
  KnowledgeConflictError,
  KnowledgeNotFoundError,
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
  apply: (mutation: KnowledgeProposalMutation) => Promise<void>;
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
    const proposals = await this.storage.listProposals({
      ...this.#visibility(frontier),
      status: 'pending',
      limit: 100,
    });
    const proposal = proposals.proposals.find(candidate => decodeGapFlag(candidate));
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

    await this.config.apply(result.mutation);
    return this.storage.reviewProposal({
      id: proposal.id,
      status: 'approved',
      reviewerContextScopeId: this.config.reviewerContextScopeId,
      reviewReason: JSON.stringify({ verifiedEvidence: evidence, appliedMutation: result.mutation.kind }),
      expectedAccessEpoch: frontier.accessEpoch,
    });
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

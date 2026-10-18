import { randomUUID } from 'node:crypto';
import type { LeadEventStore } from '../persistence/lead-event-store';
import type { OutputProvider } from '../providers/output';
import { ownedState } from '../providers/output';
import { scoreCompany } from '../tools/score-company';
import type { Assessment } from '../research/contracts';
import {
  authorizationSchema,
  decisionInputSchema,
  digestValue,
  ownedPatchSchema,
  reviewPacketSchema,
} from './contracts';
import type { Authorization, DecisionInput, OwnedPatch } from './contracts';
import type { ReviewConfig } from '../config/review';

export class ReviewConflictError extends Error {}
const stage = {
  qualified: 'Qualified',
  nurture: 'Nurture',
  disqualified: 'Disqualified',
  needs_review: 'Needs review',
} as const;
const terminal = new Set(['applied', 'rejected', 'changes_requested', 'expired', 'failed']);

/** All writes reload durable facts and permissions; workflow payloads carry no authority. */
export class ReviewService {
  private readonly jobs = new Map<string, Promise<unknown>>();
  constructor(
    private readonly store: LeadEventStore,
    private readonly providers: Map<string, OutputProvider>,
    private readonly config: ReviewConfig,
  ) {}
  private serial<T>(runId: string, work: () => Promise<T>): Promise<T> {
    const job = (this.jobs.get(runId) ?? Promise.resolve()).catch(() => undefined).then(work);
    this.jobs.set(runId, job);
    void job
      .finally(() => {
        if (this.jobs.get(runId) === job) this.jobs.delete(runId);
      })
      .catch(() => undefined);
    return job;
  }
  async read(runId: string) {
    return this.store.reviews.get(runId);
  }
  advance(runId: string) {
    return this.serial(runId, () => this.route(runId));
  }
  private async assessment(runId: string) {
    const record = await this.store.qualifications.get(runId);
    const assessment = record?.assessment;
    if (
      !assessment ||
      assessment.processingStatus !== 'completed' ||
      assessment.runId !== runId ||
      assessment.snapshot.digest !== record.snapshot.digest ||
      digestValue(assessment.snapshot) !== digestValue(record.snapshot)
    )
      throw new ReviewConflictError('A completed immutable assessment is required');
    const result = scoreCompany({
      identity: assessment.identity,
      facts: assessment.facts,
      policy: record.snapshot.config.policy,
      routing: record.snapshot.config.routing,
      assessmentTime: record.snapshot.assessmentTime,
    });
    if (digestValue(result) !== digestValue(assessment.result))
      throw new ReviewConflictError('Assessment does not match deterministic policy');
    return assessment;
  }
  private patch(assessment: Assessment, reviewId: string | null): OwnedPatch {
    const reviewReasons: OwnedPatch['reviewReasons'] = assessment.result.contributions
      .filter(rule => rule.state === 'unknown')
      .map(rule => ({
        code: 'fact_unresolved',
        attribute: rule.rule,
        explanation: rule.reason,
        action: `Confirm ${rule.rule} and submit corrected evidence for requalification.`,
        evidenceIds: assessment.facts[rule.rule].evidenceIds,
      }));
    if (assessment.identity.status !== 'resolved')
      reviewReasons.unshift({
        code: 'identity_unresolved',
        attribute: 'identity',
        explanation: assessment.identity.reason,
        action: 'Confirm the company domain and request requalification.',
        evidenceIds: [],
      });
    if (reviewId && !reviewReasons.length)
      reviewReasons.push({
        code: 'policy_review',
        attribute: 'policy',
        explanation: 'The captured routing policy requires human review of this outcome.',
        action: 'Review the sourced assessment and confirm or override its disposition.',
        evidenceIds: [],
      });
    return ownedPatchSchema.parse({
      assessmentId: assessment.id,
      cycleId: assessment.runId,
      classification: assessment.result.classification,
      stage: reviewId ? 'Needs review' : stage[assessment.result.classification],
      score: assessment.result.score,
      summary: assessment.summary,
      evidenceLinks: [...new Set(assessment.evidence.map(source => source.source))],
      gaps: assessment.result.reviewReasons,
      reviewReasons,
      nextAction: assessment.result.nextAction,
      reviewId,
      reviewRevision: reviewId ? 1 : null,
      reviewStatus: reviewId ? 'Awaiting review' : 'Not required',
      decisionSource: reviewId ? null : 'Automatic',
      overrideClassification: null,
      overrideReason: null,
    });
  }
  decide(payload: DecisionInput) {
    const input = decisionInputSchema.parse(payload);
    return this.serial(input.runId, async () => {
      const cycle = await this.store.reviews.get(input.runId);
      const packet = cycle?.packet;
      if (
        !cycle ||
        !packet ||
        packet.id !== input.reviewId ||
        packet.revision !== input.revision ||
        packet.digest !== input.digest
      )
        throw new ReviewConflictError('Review does not match the current packet');
      if (cycle.decision) {
        if (digestValue(cycle.decision.input) === digestValue(input)) return cycle.decision;
        throw new ReviewConflictError('Review already has a different decision');
      }
      if (
        !cycle.publishedAt ||
        cycle.state !== 'awaiting_review' ||
        !cycle.active ||
        Date.now() >= Date.parse(packet.expiresAt)
      )
        throw new ReviewConflictError('Review is unpublished, expired or closed');
      const assessment = await this.assessment(input.runId);
      const run = (await this.store.get(input.runId))!;
      if (packet.digest !== digestValue({ event: run.event, assessment, patch: packet.proposedPatch, revision: 1 }))
        throw new ReviewConflictError('Review packet changed');
      if (
        input.decision === 'approved' &&
        (assessment.identity.status !== 'resolved' ||
          (assessment.result.classification === 'needs_review' && !input.override))
      )
        throw new ReviewConflictError(
          'Approval requires resolved identity and a reasoned disposition for an uncertain assessment',
        );
      const destination = await this.providers.get(run.event.destination.providerId)?.read(run.event.destination);
      if (!destination || digestValue(ownedState(destination.fields)) !== digestValue(cycle.expected))
        throw new ReviewConflictError('Published review fields changed or destination is unavailable');
      const decision = {
        id: randomUUID(),
        input,
        reviewer: 'local-operator' as const,
        decidedAt: new Date().toISOString(),
      };
      if (!(await this.store.reviews.decide(input.runId, decision)))
        throw new ReviewConflictError('Review was decided or expired concurrently');
      return decision;
    });
  }
  private async route(runId: string) {
    let cycle = await this.store.reviews.get(runId);
    if (!cycle || !cycle.active) return cycle;
    if (cycle.state === 'conflict') return cycle;
    const run = (await this.store.get(runId))!;
    const assessment = await this.assessment(runId);
    const provider = this.providers.get(run.event.destination.providerId);
    if (!provider) throw new ReviewConflictError('Destination provider is unavailable');
    if (!cycle.assessmentId) {
      const needsReview = assessment.result.requiresReview || assessment.identity.status !== 'resolved';
      const reviewId = needsReview ? randomUUID() : null;
      const patch = this.patch(assessment, reviewId);
      const packet = reviewId
        ? reviewPacketSchema.parse({
            id: reviewId,
            revision: 1,
            assessmentId: assessment.id,
            cycleId: runId,
            destination: run.event.destination,
            proposedPatch: patch,
            expiresAt: new Date(Date.now() + this.config.expiryDays * 86_400_000).toISOString(),
            digest: digestValue({ event: run.event, assessment, patch, revision: 1 }),
          })
        : null;
      const authorization = packet
        ? null
        : authorizationSchema.parse({
            kind: 'policy',
            assessmentId: assessment.id,
            cycleId: runId,
            destination: run.event.destination,
            configurationDigest: assessment.snapshot.digest,
            outcome: assessment.result.classification,
            patchDigest: digestValue(patch),
          });
      await this.store.reviews.prepare(runId, assessment.id, packet, authorization);
      cycle = (await this.store.reviews.get(runId))!;
    }
    if (cycle.assessmentId !== assessment.id) throw new ReviewConflictError('Cycle assessment changed');
    if (
      cycle.packet &&
      cycle.packet.digest !==
        digestValue({ event: run.event, assessment, patch: cycle.packet.proposedPatch, revision: 1 })
    )
      throw new ReviewConflictError('Review packet changed');
    if (cycle.state === 'publishing_review') {
      const packet = cycle.packet!;
      const expected =
        (await this.store.reviews.operation(runId, 'review'))?.expected ??
        (await this.initialState(provider, run.event.destination, run.event.supersedesAssessmentId));
      if (expected === null) await this.store.reviews.state(runId, 'conflict');
      if (
        !expected ||
        !(await this.write(runId, 'review', provider, run.event.destination, packet.proposedPatch, expected))
      )
        return this.read(runId);
      await this.store.reviews.published(runId, ownedState(packet.proposedPatch));
      cycle = (await this.store.reviews.get(runId))!;
    }
    if (cycle.packet && !cycle.decision && Date.now() >= Date.parse(cycle.packet.expiresAt)) {
      await this.store.reviews.state(runId, 'expired');
      cycle = (await this.store.reviews.get(runId))!;
    }
    if (cycle.packet && cycle.decision?.input.decision !== 'approved') {
      const negative = cycle.decision?.input.decision;
      const status =
        negative === 'rejected'
          ? 'Rejected'
          : negative === 'changes_requested'
            ? 'Changes requested'
            : cycle.state === 'expired'
              ? 'Expired'
              : null;
      if (status) {
        const patch = { ...cycle.packet.proposedPatch, reviewStatus: status } as OwnedPatch;
        if (await this.write(runId, 'closure', provider, run.event.destination, patch, cycle.expected!))
          await this.store.reviews.state(runId, negative ?? 'expired', true);
      }
      return this.read(runId);
    }
    let patch = cycle.packet?.proposedPatch ?? this.patch(assessment, null);
    if (cycle.packet) {
      const input = cycle.decision!.input;
      if (assessment.identity.status !== 'resolved')
        throw new ReviewConflictError('Unresolved identity cannot authorize output');
      const classification = input.override?.classification ?? assessment.result.classification;
      if (classification === 'needs_review') throw new ReviewConflictError('Choose a final disposition');
      patch = {
        ...cycle.packet.proposedPatch,
        classification,
        stage: stage[classification],
        reviewStatus: 'Approved',
        decisionSource: 'SDR',
        overrideClassification: input.override?.classification ?? null,
        overrideReason: input.override?.reason ?? null,
      };
      const authorization: Authorization = {
        kind: 'human',
        assessmentId: assessment.id,
        cycleId: runId,
        destination: run.event.destination,
        patchDigest: digestValue(patch),
        reviewId: cycle.packet.id,
        revision: 1,
        reviewDigest: cycle.packet.digest,
        decisionId: cycle.decision!.id,
      };
      await this.store.reviews.authorize(runId, authorization);
      cycle = (await this.store.reviews.get(runId))!;
    }
    const auth = cycle.authorization;
    if (
      !auth ||
      auth.assessmentId !== assessment.id ||
      auth.cycleId !== runId ||
      auth.patchDigest !== digestValue(patch) ||
      digestValue(auth.destination) !== digestValue(run.event.destination) ||
      (auth.kind === 'policy' &&
        (assessment.result.requiresReview ||
          assessment.identity.status !== 'resolved' ||
          auth.configurationDigest !== assessment.snapshot.digest ||
          auth.outcome !== assessment.result.classification)) ||
      (auth.kind === 'human' &&
        (!cycle.publishedAt || auth.decisionId !== cycle.decision?.id || auth.reviewDigest !== cycle.packet?.digest))
    )
      throw new ReviewConflictError('No current authorization for the exact patch');
    const expected =
      (await this.store.reviews.operation(runId, 'final'))?.expected ??
      cycle.expected ??
      (await this.initialState(provider, run.event.destination, run.event.supersedesAssessmentId));
    if (expected === null) await this.store.reviews.state(runId, 'conflict');
    if (expected && (await this.write(runId, 'final', provider, run.event.destination, patch, expected)))
      await this.store.reviews.state(runId, 'applied', true);
    return this.read(runId);
  }
  private async initialState(
    provider: OutputProvider,
    destination: Parameters<OutputProvider['read']>[0],
    predecessor?: string,
  ) {
    let current;
    try {
      current = await provider.read(destination);
    } catch {
      // No expected state is known yet. Keep the prepared cycle suspended for retry.
      return undefined;
    }
    if (
      !current ||
      current.fields.stage !== 'Triage' ||
      (current.fields.assessmentId !== undefined && current.fields.assessmentId !== predecessor)
    )
      return null;
    return ownedState(current.fields);
  }
  private async write(
    runId: string,
    kind: 'review' | 'final' | 'closure',
    provider: OutputProvider,
    destination: Parameters<OutputProvider['read']>[0],
    patch: OwnedPatch,
    expected: Record<string, unknown>,
  ) {
    const operation = (await this.store.reviews.operation(runId, kind, patch, expected))!;
    if (digestValue(operation.patch) !== digestValue(patch)) throw new ReviewConflictError('Journaled patch differs');
    if (operation.state === 'conflict') return false;
    try {
      let current = await provider.read(destination);
      if (current?.marker === operation.id && digestValue(ownedState(current.fields)) === digestValue(patch)) {
        await this.store.reviews.operationState(operation.id, 'applied');
        return true;
      }
      if (!current || digestValue(ownedState(current.fields)) !== digestValue(operation.expected)) {
        await this.store.reviews.operationState(operation.id, 'conflict');
        await this.store.reviews.state(runId, 'conflict');
        return false;
      }
      await this.store.reviews.operationState(operation.id, 'uncertain');
      await provider.apply(destination, operation.id, operation.patch, operation.expected);
      current = await provider.read(destination);
      if (current?.marker !== operation.id || digestValue(ownedState(current.fields)) !== digestValue(patch))
        return false;
      await this.store.reviews.operationState(operation.id, 'applied');
      return true;
    } catch {
      // An interrupted write remains journaled. The next attempt starts with read-back.
      return false;
    }
  }
  isTerminal(cycle: Awaited<ReturnType<ReviewService['read']>>) {
    return !cycle || (!cycle.active && terminal.has(cycle.state));
  }
}

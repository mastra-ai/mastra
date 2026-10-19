import { randomUUID } from 'node:crypto';
import type { NormalizedEvent } from '../contracts';
import type { LeadEventStore } from '../persistence/lead-event-store';
import type { OutputProvider } from '../providers/output';
import { destinationFields, projectedPatch, OutputError, revisionMatches } from '../providers/output';
import { scoreCompany } from '../tools/score-company';
import type { Assessment } from '../research/contracts';
import {
  authorizationSchema,
  persistedDecisionInputSchema,
  stageDisposition,
  qualificationStages,
  digestValue,
  ownedPatchSchema,
  reviewPacketSchema,
} from './contracts';
import type { Authorization, Decision, DecisionInput, OwnedPatch, StageDecisionInput, ReviewPacket } from './contracts';
import type { ReviewConfig } from '../config/review';

export class ReviewConflictError extends Error {}
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
    const cycle = await this.store.reviews.get(runId);
    return cycle ? { ...cycle, history: await this.store.reviews.history(runId) } : null;
  }
  advance(runId: string) {
    return this.serial(runId, async () => {
      const cycle = await this.store.reviews.get(runId);
      const run = await this.store.get(runId);
      const policy = run && this.providers.get(run.event.destination.providerId)?.retryPolicy;
      if (
        !policy ||
        !cycle ||
        !cycle.active ||
        ['conflict', 'failed'].includes(cycle.state) ||
        (cycle.state === 'awaiting_review' && !cycle.decision && Date.now() < Date.parse(cycle.packet!.expiresAt))
      )
        return this.route(runId);
      if (cycle.nextRetryAt > Date.now()) return cycle;
      if (cycle.attempts >= policy.maxAttempts) {
        await this.store.reviews.retry(runId, 0, 'output_attempts_exhausted', true);
        return this.read(runId);
      }
      await this.store.reviews.reserveAttempt(runId);
      try {
        return await this.route(runId);
      } catch (error) {
        const failure = error instanceof OutputError ? error : new OutputError('output_processing_failed', false);
        if (failure.code.includes('conflict')) {
          await this.store.reviews.state(runId, 'conflict');
          return this.read(runId);
        }
        await this.store.reviews.retry(
          runId,
          Math.min(policy.maxRetryDelayMs, Math.max(policy.retryDelayMs, failure.retryAfterMs)),
          failure.code,
          !failure.retryable ||
            cycle.attempts + 1 >= policy.maxAttempts ||
            failure.retryAfterMs > policy.maxRetryDelayMs,
        );
        return this.read(runId);
      }
    });
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
  private patch(assessment: Assessment, reviewId: string | null, provider?: OutputProvider): OwnedPatch {
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
    const patch = ownedPatchSchema.parse({
      assessmentId: assessment.id,
      cycleId: assessment.runId,
      classification: assessment.result.classification,
      stage: reviewId ? 'Needs review' : qualificationStages[assessment.result.classification],
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
    return ownedPatchSchema.parse(provider?.present?.(assessment, patch) ?? patch);
  }
  decide(payload: DecisionInput) {
    return this.recordDecision(payload, 'local-operator', new Date().toISOString());
  }
  /** Called only by trusted drivers after authenticating their command actor and observed state. */
  decideFromProvider(
    providerId: string,
    payload: StageDecisionInput,
    reviewer: Exclude<Decision['reviewer'], string>,
    decidedAt: string,
    observed: Record<string, unknown>,
    observedRevision: string,
  ) {
    if (reviewer.provider !== providerId) throw new ReviewConflictError('Reviewer does not belong to this provider');
    return this.recordDecision(payload, reviewer, decidedAt, observed, observedRevision, providerId);
  }
  private recordDecision(
    payload: DecisionInput | StageDecisionInput,
    reviewer: Decision['reviewer'],
    decidedAt: string,
    observed?: Record<string, unknown>,
    observedRevision?: string,
    providerId?: string,
  ) {
    const input = persistedDecisionInputSchema.parse(payload);
    return this.serial(input.runId, async () => {
      const cycle = await this.store.reviews.get(input.runId);
      const packet = cycle?.packet;
      const run = await this.store.get(input.runId);
      const destinationProvider = run && this.providers.get(run.event.destination.providerId);
      if (
        !run ||
        !destinationProvider ||
        (providerId ? destinationProvider.id !== providerId : destinationProvider.reviewMode === 'external')
      )
        throw new ReviewConflictError('Review provider does not own this destination');
      if (
        !cycle ||
        !packet ||
        packet.id !== input.reviewId ||
        packet.revision !== input.revision ||
        packet.digest !== input.digest
      )
        throw new ReviewConflictError('Review does not match the current packet');
      if (cycle.decision) {
        if (
          digestValue(cycle.decision.input) === digestValue(input) &&
          digestValue(cycle.decision.reviewer) === digestValue(reviewer)
        )
          return cycle.decision;
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

      if (packet.digest !== this.packetDigest(run.event, assessment, packet))
        throw new ReviewConflictError('Review packet changed');
      if ('kind' in input && assessment.identity.status !== 'resolved')
        throw new OutputError('identity_unresolved', false);
      if (
        input.decision === 'approved' &&
        (assessment.identity.status !== 'resolved' ||
          (assessment.result.classification === 'needs_review' && !('kind' in input) && !input.override))
      )
        throw new ReviewConflictError(
          'Approval requires resolved identity and a reasoned disposition for an uncertain assessment',
        );
      const provider = this.providers.get(run.event.destination.providerId)!;
      const destination = await provider.read(run.event.destination);
      const expected = observed ?? cycle.expected!;
      const binding = observed
        ? { ...observed, ...Object.fromEntries((provider.reviewFields ?? []).map(key => [key, cycle.expected?.[key]])) }
        : expected;
      if (
        !destination ||
        digestValue(destinationFields(provider, destination.fields)) !== digestValue(expected) ||
        digestValue(destinationFields(provider, binding)) !== digestValue(cycle.expected) ||
        !revisionMatches(provider, destination, observedRevision)
      )
        throw new ReviewConflictError('Published review fields changed or destination is unavailable');
      const decision = {
        id: randomUUID(),
        input,
        reviewer,
        decidedAt,
      };
      if (!(await this.store.reviews.decide(input.runId, decision, expected, cycle.expected!, observedRevision)))
        throw new ReviewConflictError('Review was decided or expired concurrently');
      return decision;
    });
  }
  private async route(runId: string) {
    let cycle = await this.store.reviews.get(runId);
    if (!cycle || !cycle.active) return cycle;
    if (cycle.state === 'conflict' || cycle.state === 'failed') return cycle;
    const run = (await this.store.get(runId))!;
    const assessment = await this.assessment(runId);
    const provider = this.providers.get(run.event.destination.providerId);
    if (!provider) throw new ReviewConflictError('Destination provider is unavailable');
    if (!cycle.assessmentId) {
      const needsReview = assessment.result.requiresReview || assessment.identity.status !== 'resolved';
      const reviewId = needsReview ? randomUUID() : null;
      const patch = this.patch(assessment, reviewId, provider);
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
    if (cycle.packet && cycle.packet.digest !== this.packetDigest(run.event, assessment, cycle.packet))
      throw new ReviewConflictError('Review packet changed');
    if (cycle.state === 'publishing_review') {
      const packet = cycle.packet!;
      const expected =
        (await this.store.reviews.operation(runId, 'review', cycle.revision))?.expected ??
        cycle.expected ??
        (await this.initialState(provider, run.event.destination, run.event.supersedesAssessmentId));
      if (expected === null) await this.store.reviews.state(runId, 'conflict');
      if (
        !expected ||
        !(await this.write(
          runId,
          'review',
          provider,
          run.event.destination,
          packet.proposedPatch,
          expected,
          cycle.expectedRevision,
        ))
      )
        return this.read(runId);
      const reviewOperation = (await this.store.reviews.operation(runId, 'review', cycle.revision))!;
      await this.store.reviews.published(
        runId,
        projectedPatch(provider, packet.proposedPatch, reviewOperation.id, reviewOperation.expected),
      );
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
        if (
          await this.write(
            runId,
            'closure',
            provider,
            run.event.destination,
            patch,
            cycle.expected!,
            cycle.expectedRevision,
          )
        )
          await this.store.reviews.state(runId, negative ?? 'expired', true);
      }
      return this.read(runId);
    }
    let patch = cycle.packet?.proposedPatch ?? this.patch(assessment, null, provider);
    // Older policy authorizations capture the original projection, including a crash before journaling.
    if (
      !cycle.packet &&
      cycle.authorization?.kind === 'policy' &&
      cycle.authorization.patchDigest !== digestValue(patch)
    ) {
      const legacy = this.patch(assessment, null);
      if (digestValue(legacy) === cycle.authorization.patchDigest) patch = legacy;
    }
    if (cycle.packet) {
      const input = cycle.decision!.input;
      if (assessment.identity.status !== 'resolved')
        throw new ReviewConflictError('Unresolved identity cannot authorize output');
      const classification =
        'kind' in input
          ? stageDisposition[input.stage]
          : (input.override?.classification ?? assessment.result.classification);
      if (classification === 'needs_review') throw new ReviewConflictError('Choose a final disposition');
      patch = {
        ...cycle.packet.proposedPatch,
        classification,
        stage: qualificationStages[classification],
        reviewStatus: 'Approved',
        decisionSource: 'SDR',
        overrideClassification: 'kind' in input ? classification : (input.override?.classification ?? null),
        overrideReason: 'kind' in input ? input.justification : (input.override?.reason ?? null),
      };
      const presented = provider.finalize?.(patch) ?? patch;
      if (!cycle.authorization || cycle.authorization.patchDigest === digestValue(presented)) patch = presented;
      const authorization: Authorization = {
        kind: 'human',
        assessmentId: assessment.id,
        cycleId: runId,
        destination: run.event.destination,
        patchDigest: digestValue(patch),
        reviewId: cycle.packet.id,
        revision: cycle.packet.revision,
        reviewDigest: cycle.packet.digest,
        decisionId: cycle.decision!.id,
      };
      if (!cycle.authorization) await this.store.reviews.authorize(runId, authorization);
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
      (await this.store.reviews.operation(runId, 'final', cycle.revision))?.expected ??
      cycle.expected ??
      (await this.initialState(provider, run.event.destination, run.event.supersedesAssessmentId));
    if (expected === null) await this.store.reviews.state(runId, 'conflict');
    if (
      expected &&
      (await this.write(runId, 'final', provider, run.event.destination, patch, expected, cycle.expectedRevision))
    )
      await this.store.reviews.state(runId, 'applied', true);
    return this.read(runId);
  }
  private packetDigest(event: NormalizedEvent, assessment: Assessment, packet: ReviewPacket) {
    return digestValue({
      event,
      assessment,
      patch: packet.proposedPatch,
      revision: packet.revision,
      ...(packet.reopenedBy ? { reopenedBy: packet.reopenedBy } : {}),
    });
  }
  /** Reopen a reconciled destination only through its trusted command adapter. */
  reopenFromProvider(
    providerId: string,
    runId: string,
    expected: Record<string, unknown>,
    expectedRevision: string,
    reopenedBy: NonNullable<ReviewPacket['reopenedBy']>,
  ) {
    return this.serial(runId, async () => {
      const cycle = await this.store.reviews.get(runId);
      const run = await this.store.get(runId);
      if (
        !cycle ||
        cycle.active ||
        !run ||
        run.event.destination.providerId !== providerId ||
        !this.isTerminal(cycle) ||
        ['failed'].includes(cycle.state)
      )
        throw new ReviewConflictError('Only a reconciled closed cycle owned by this provider can reopen');
      const assessment = await this.assessment(runId);
      const provider = this.providers.get(providerId)!;
      const reviewId = randomUUID();
      const revision = cycle.revision + 1;
      const base = this.patch(assessment, reviewId);
      const raw: OwnedPatch = {
        ...base,
        classification: 'needs_review',
        reviewRevision: revision,
        reviewReasons: [
          {
            code: 'manual_review',
            attribute: 'policy',
            explanation: 'An SDR reopened this lead for manual review.',
            action: 'Review the existing findings and move Stage to a final outcome.',
            evidenceIds: [],
          },
          ...base.reviewReasons,
        ],
      };
      const patch = ownedPatchSchema.parse(provider.present?.(assessment, raw) ?? raw);
      const packet = reviewPacketSchema.parse({
        id: reviewId,
        revision,
        assessmentId: assessment.id,
        cycleId: runId,
        destination: run.event.destination,
        proposedPatch: patch,
        reopenedBy,
        expiresAt: new Date(Date.now() + this.config.expiryDays * 86_400_000).toISOString(),
        digest: '0'.repeat(64),
      });
      packet.digest = this.packetDigest(run.event, assessment, packet);
      const destination = await provider.read(run.event.destination);
      if (
        !destination ||
        digestValue(destinationFields(provider, destination.fields)) !== digestValue(expected) ||
        !revisionMatches(provider, destination, expectedRevision)
      )
        throw new ReviewConflictError('Reopen command changed before persistence');
      if (!(await this.store.reviews.reopen(runId, cycle, packet, expected, expectedRevision)))
        throw new ReviewConflictError('Cycle changed while reopening');
      return this.read(runId);
    });
  }
  private async initialState(
    provider: OutputProvider,
    destination: Parameters<OutputProvider['read']>[0],
    predecessor?: string,
  ) {
    let current;
    try {
      current = await provider.read(destination);
    } catch (error) {
      if (provider.retryPolicy) throw error;
      // No expected state is known yet. Keep the prepared cycle suspended for retry.
      return undefined;
    }
    if (
      !current ||
      current.fields.stage !== 'Triage' ||
      (current.fields.assessmentId !== undefined && current.fields.assessmentId !== predecessor)
    )
      return null;
    return destinationFields(provider, current.fields);
  }
  private async write(
    runId: string,
    kind: 'review' | 'final' | 'closure',
    provider: OutputProvider,
    destination: Parameters<OutputProvider['read']>[0],
    patch: OwnedPatch,
    expected: Record<string, unknown>,
    expectedRevision?: string,
  ) {
    const operation = await this.store.reviews.journal(runId, kind, patch, expected, expectedRevision);
    if (digestValue(operation.patch) !== digestValue(patch)) throw new ReviewConflictError('Journaled patch differs');
    if (operation.state === 'conflict') return false;
    try {
      let current = await provider.read(destination);
      if (
        current?.marker === operation.id &&
        digestValue(destinationFields(provider, current.fields)) ===
          digestValue(projectedPatch(provider, patch, operation.id, operation.expected))
      ) {
        await this.store.reviews.operationState(operation.id, 'applied');
        return true;
      }
      if (
        !current ||
        digestValue(destinationFields(provider, current.fields)) !== digestValue(operation.expected) ||
        !revisionMatches(provider, current, operation.expectedRevision)
      ) {
        await this.store.reviews.operationState(operation.id, 'conflict');
        await this.store.reviews.state(runId, 'conflict');
        return false;
      }
      await this.store.reviews.operationState(operation.id, 'uncertain');
      await provider.apply(destination, operation.id, operation.patch, operation.expected, operation.expectedRevision);
      current = await provider.read(destination);
      if (
        current?.marker !== operation.id ||
        digestValue(destinationFields(provider, current.fields)) !==
          digestValue(projectedPatch(provider, patch, operation.id, operation.expected))
      ) {
        if (provider.retryPolicy) throw new OutputError('output_uncertain_write', true);
        return false;
      }
      await this.store.reviews.operationState(operation.id, 'applied');
      return true;
    } catch (error) {
      if (provider.retryPolicy) throw error;
      // An interrupted write remains journaled. The next attempt starts with read-back.
      return false;
    }
  }
  isTerminal(cycle: { active: boolean; state: string } | null) {
    return !cycle || (!cycle.active && terminal.has(cycle.state));
  }
}

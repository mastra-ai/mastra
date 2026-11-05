import { z } from 'zod';
import {
  bindingSchema,
  ControlPlaneError,
  idSchema,
  parse,
  type Policy,
  type Profile,
  type Target,
} from '../core/contracts.js';
import type { ControlPlane, MutationScope } from '../core/control-plane.js';
import type { ScanService } from '../discovery/service.js';
import { observedBolaCandidates, selectedBolaCandidate } from './bola-contracts.js';
import { scanPrincipalComparison } from '../discovery/principals.js';
import { reconciledBolaBinding } from './bola-bindings.js';
import { BolaGatewayDriver } from './bola-driver.js';
import type { BolaBudget, BolaModels } from './bola-models.js';
import { BolaStore, type BolaAssessment } from './bola-store.js';

const admissionSchema = z
  .object({
    targetRevision: z.number().int().positive().safe(),
    policyRevision: z.number().int().positive().safe(),
    profiles: z.array(bindingSchema).length(2),
    idempotencyKey: z
      .string()
      .min(16)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict()
  .refine(
    value => new Set(value.profiles.map(item => item.profileId)).size === 2,
    'Use two distinct API-key profiles.',
  );

export class BolaAssessmentService {
  readonly store: BolaStore;
  private readonly active = new Map<
    string,
    { targetId: string; profileIds: string[]; controller: AbortController; finished: Promise<void> }
  >();
  private readonly closing = new AbortController();
  private readonly admissions = new Set<Promise<BolaAssessment>>();
  private admissionQueue: Promise<unknown> = Promise.resolve();
  private closePromise?: Promise<void>;
  private admissionCloseFailure = false;
  private retentionTimer?: NodeJS.Timeout;
  private mutations: Promise<unknown> = Promise.resolve();
  private barrier?: Promise<void>;
  constructor(
    discovery: ScanService['store'],
    private readonly control: ControlPlane,
    private readonly scans: ScanService,
    private readonly driver: BolaGatewayDriver,
    private readonly models?: BolaModels,
  ) {
    this.store = new BolaStore(discovery);
  }
  /** Report whether both BOLA models and discovery execution are available. */
  get enabled() {
    return Boolean(this.models && this.scans.enabled);
  }
  /** Reconcile an interrupted BOLA verification job against its durable assessment state. */
  private async reconcileVerificationJob(owner: string, id: string) {
    const assessment = await this.store.get(id, owner);
    if (!assessment.verificationJobId) return true;
    const complete = await this.driver.cleanupJob(assessment.verificationJobId).catch(() => false);
    await this.store.update(id, owner, current => {
      if (current.verificationJobId !== assessment.verificationJobId)
        throw new ControlPlaneError('BOLA_JOB_CHANGED', 409);
      return {
        ...current,
        verificationCleanup: complete ? 'COMPLETE' : 'DEBT',
        reason: complete
          ? current.reason === 'BOLA_CLEANUP_DEBT'
            ? 'BOLA_CLEANUP_RECOVERED'
            : current.reason
          : 'BOLA_CLEANUP_DEBT',
      };
    });
    return complete;
  }
  /** Initialize BOLA persistence and recover interrupted owned verification work. */
  async initialize(owner: string) {
    await this.store.initialize();
    await this.store.purgeExpired();
    this.retentionTimer = setInterval(() => void this.store.purgeExpired().catch(() => undefined), 60_000);
    this.retentionTimer.unref();
    for (const item of await this.store.cleanupJobs(owner)) await this.reconcileVerificationJob(owner, item.id);
    // A model call may have been sent before a crash. Never replay it implicitly.
    for (const item of await this.store.pending(owner))
      await this.store.update(item.id, owner, current => ({
        ...current,
        state: 'BLOCKED',
        reason: current.verificationCleanup === 'DEBT' ? 'BOLA_CLEANUP_DEBT' : 'PROCESS_INTERRUPTED',
      }));
    for (const item of await this.store.cancelRequested(owner)) {
      const stopped = await this.scans.cancel(owner, item.scanId).catch(() => null);
      const verified = await this.reconcileVerificationJob(owner, item.id);
      await this.store.update(item.id, owner, current => ({
        ...current,
        state: stopped?.cleanup === 'COMPLETE' && verified ? 'CANCELLED' : 'CANCEL_REQUESTED',
        reason: stopped?.cleanup === 'COMPLETE' && verified ? 'BOLA_CANCELLED' : 'BOLA_CLEANUP_DEBT',
      }));
    }
  }
  /** Fence BOLA admissions and drain active work before closing its runtime state. */
  close() {
    if (this.closePromise) return this.closePromise;
    if (this.retentionTimer) clearInterval(this.retentionTimer);
    this.closing.abort();
    for (const entry of this.active.values()) entry.controller.abort();
    this.closePromise = (async () => {
      await Promise.allSettled([...this.admissions]);
      for (const entry of this.active.values()) entry.controller.abort();
      await Promise.allSettled([...this.active.values()].map(entry => entry.finished));
      await this.mutations;
      await this.store.close();
      if (this.admissionCloseFailure) throw new ControlPlaneError('BOLA_ADMISSION_CLEANUP_FAILED', 503);
    })();
    return this.closePromise;
  }
  /** Cancel an owned BOLA assessment and await active verification settlement. */
  async cancel(owner: string, id: string, revision: number) {
    const assessmentId = parse(idSchema, id);
    const requested = await this.store.requestCancel(assessmentId, owner, revision);
    const running = this.active.get(assessmentId);
    running?.controller.abort();
    const stopped = await this.scans.cancel(owner, requested.scanId).catch(() => null);
    if (requested.state === 'CANCEL_REQUESTED' && running) await running.finished.catch(() => undefined);
    const verified = await this.reconcileVerificationJob(owner, assessmentId);
    if (stopped?.cleanup !== 'COMPLETE' || !verified) {
      await this.store.update(assessmentId, owner, current => ({
        ...current,
        state: 'CANCEL_REQUESTED',
        reason: 'BOLA_CLEANUP_DEBT',
      }));
      throw new ControlPlaneError('BOLA_CANCEL_CLEANUP_DEBT', 503);
    }
    const current = await this.store.get(assessmentId, owner);
    if (current.state === 'CANCELLED') return current;
    return this.store.update(assessmentId, owner, current => {
      if (current.state !== 'CANCEL_REQUESTED') throw new ControlPlaneError('BOLA_CANCEL_RACE', 409);
      return { ...current, state: 'CANCELLED', reason: 'BOLA_CANCELLED' };
    });
  }
  /** Fence and drain affected BOLA work while the supplied domain mutation executes. */
  async coordinateMutation<T>(
    scope: MutationScope,
    validate: () => Promise<void>,
    commit: () => Promise<T>,
  ): Promise<T> {
    if (this.closing.signal.aborted) throw new ControlPlaneError('SERVER_CLOSING', 503);
    const operation = this.mutations.then(async () => {
      let release: () => void = () => {};
      this.barrier = new Promise(resolve => {
        release = resolve;
      });
      try {
        await validate();
        const affected = [...this.active.values()].filter(entry =>
          scope.kind === 'target'
            ? entry.targetId === scope.id
            : scope.kind === 'profile'
              ? entry.profileIds.includes(scope.id)
              : true,
        );
        for (const entry of affected) entry.controller.abort();
        await Promise.all(affected.map(entry => entry.finished));
        return await commit();
      } finally {
        this.barrier = undefined;
        release();
      }
    });
    this.mutations = operation.catch(() => undefined);
    return operation;
  }
  /** Serialize assessment admission so shutdown and mutations cannot race new work. */
  admit(owner: string, targetId: string, input: unknown): Promise<BolaAssessment> {
    if (this.closing.signal.aborted) return Promise.reject(new ControlPlaneError('SERVER_CLOSING', 503));
    const operation = this.admissionQueue.then(() => this.admitOpen(owner, targetId, input));
    this.admissionQueue = operation.catch(() => undefined);
    this.admissions.add(operation);
    void operation.then(
      () => this.admissions.delete(operation),
      () => this.admissions.delete(operation),
    );
    return operation;
  }
  /** Reject new BOLA work once service shutdown has fenced admissions. */
  private async rejectClosingAdmission(
    owner: string,
    scanId: string,
    scanCreated: boolean,
    assessmentId?: string,
  ): Promise<never> {
    try {
      if (scanCreated) {
        const stopped = await this.scans.cancel(owner, scanId, 'SERVER_STOPPED');
        if (stopped.cleanup !== 'COMPLETE') throw new ControlPlaneError('BOLA_ADMISSION_CLEANUP_FAILED', 503);
      }
      if (assessmentId)
        await this.store.update(assessmentId, owner, current =>
          current.state === 'DISCOVERING' ? { ...current, state: 'BLOCKED', reason: 'SERVER_STOPPED' } : current,
        );
    } catch {
      this.admissionCloseFailure = true;
      throw new ControlPlaneError('BOLA_ADMISSION_CLEANUP_FAILED', 503);
    }
    throw new ControlPlaneError('SERVER_CLOSING', 503);
  }
  /** Settle the assessment when its associated discovery scan could not be admitted. */
  private async cleanupFailedScanAdmission(owner: string, scanId: string) {
    const deadline = Date.now() + 15000;
    for (let attempt = 0; ; attempt++) {
      try {
        const stopped = await this.scans.cancel(owner, scanId, 'RUNTIME_UNAVAILABLE');
        if (stopped.cleanup !== 'COMPLETE') throw new ControlPlaneError('BOLA_ADMISSION_CLEANUP_FAILED', 503);
        return;
      } catch (error) {
        if ((error as { code?: string }).code !== 'SQLITE_BUSY' || Date.now() >= deadline)
          throw new ControlPlaneError('BOLA_ADMISSION_CLEANUP_FAILED', 503);
        await new Promise(resolve => setTimeout(resolve, Math.min(50 * 2 ** Math.min(attempt, 3), 400)));
      }
    }
  }
  /** Validate and persist a new assessment while its admission fence remains open. */
  private async admitOpen(owner: string, targetId: string, input: unknown) {
    if (this.closing.signal.aborted) throw new ControlPlaneError('SERVER_CLOSING', 503);
    if (!this.enabled) throw new ControlPlaneError('BOLA_ASSESSMENT_DISABLED', 503);
    const request = parse(admissionSchema, input);
    const previous = await this.store.byKey(owner, targetId, request.idempotencyKey);
    if (previous) {
      if (
        previous.targetRevision !== request.targetRevision ||
        previous.policyRevision !== request.policyRevision ||
        JSON.stringify(previous.profiles) !==
          JSON.stringify(
            request.profiles.map(item => ({
              profileId: item.profileId,
              profileRevision: item.profileRevision,
              credentialRevision: item.credentialRevision,
            })),
          )
      )
        throw new ControlPlaneError('IDEMPOTENCY_CONFLICT', 409);
      return previous;
    }
    const target = await this.control.store.get<Target>('target', targetId, owner);
    if (
      target.application?.kind !== 'rest_api' ||
      !target.authorizationConfirmed ||
      !target.permittedMethods.includes('GET') ||
      target.revision !== request.targetRevision ||
      target.policyRevision !== request.policyRevision ||
      !target.routeAccessRules?.some(
        rule =>
          rule.source === 'operator' &&
          rule.audience === 'user' &&
          rule.objectPolicy === 'owner' &&
          rule.method === 'GET',
      )
    )
      throw new ControlPlaneError('BOLA_TARGET_NOT_READY', 409);
    const policy = await this.control.store.get<Policy>('policy', target.policyId, owner);
    if (policy.revision !== target.policyRevision || !policy.retention?.evidenceDays)
      throw new ControlPlaneError('BOLA_RETENTION_NOT_READY', 409);
    const profiles = await Promise.all(
      request.profiles.map(binding => this.control.store.get<Profile>('profile', binding.profileId, owner)),
    );
    if (
      profiles.some(
        profile =>
          profile.targetId !== targetId ||
          profile.kind !== 'api_key_header' ||
          profile.revision !== request.profiles.find(item => item.profileId === profile.id)?.profileRevision ||
          profile.credentialRevision !==
            request.profiles.find(item => item.profileId === profile.id)?.credentialRevision ||
          profile.identityResult?.status !== 'READY' ||
          profile.identityResult.targetRevision !== target.revision ||
          profile.identityResult.policyRevision !== target.policyRevision ||
          profile.identityResult.profileRevision !== profile.revision ||
          profile.identityResult.credentialRevision !== profile.credentialRevision,
      )
    )
      throw new ControlPlaneError('BOLA_PROFILES_NOT_READY', 409);
    if (this.barrier) await this.barrier;
    if (this.closing.signal.aborted) throw new ControlPlaneError('SERVER_CLOSING', 503);
    let admitted;
    try {
      admitted = await this.scans.admitWithReceipt(
        owner,
        targetId,
        { ...request, mode: 'http', operation: 'discovery' },
        { deferStart: true },
      );
    } catch (error) {
      if (error instanceof ControlPlaneError) throw error;
      throw new ControlPlaneError('BOLA_SCAN_ADMISSION_FAILED', 503);
    }
    const { scan, created: scanCreated } = admitted;
    if (this.closing.signal.aborted) return this.rejectClosingAdmission(owner, scan.id, scanCreated);
    const { assessment, created } = await this.store
      .create({
        owner,
        targetId,
        scanId: scan.id,
        idempotencyKey: request.idempotencyKey,
        state: 'DISCOVERING',
        targetRevision: request.targetRevision,
        policyRevision: request.policyRevision,
        profiles: request.profiles.map(item => ({
          profileId: item.profileId,
          profileRevision: item.profileRevision,
          credentialRevision: item.credentialRevision,
        })),
        maxTokens: 16384,
        usedTokens: 0,
        maxRequests: 2,
        usedRequests: 0,
        candidates: [],
        selected: null,
        selection: null,
        proof: null,
        verificationJobId: null,
        verificationCleanup: 'NOT_STARTED',
        expiresAt: new Date(Date.now() + policy.retention.evidenceDays * 86400000).toISOString(),
        evidenceAvailability: 'available',
        outcome: null,
        findingId: null,
        reason: null,
        modelEvents: [],
      })
      .catch(async error => {
        if (scanCreated) await this.cleanupFailedScanAdmission(owner, scan.id);
        if (error instanceof ControlPlaneError) throw error;
        throw new ControlPlaneError('BOLA_STORE_ADMISSION_FAILED', 503);
      });
    if (this.closing.signal.aborted)
      return this.rejectClosingAdmission(owner, scan.id, scanCreated, created ? assessment.id : undefined);
    if (created) {
      const controller = new AbortController();
      const finished = Promise.resolve()
        .then(() => this.run(owner, assessment.id, controller.signal))
        .then(() => undefined);
      this.active.set(assessment.id, { targetId, profileIds: profiles.map(item => item.id), controller, finished });
      void finished.finally(() => this.active.delete(assessment.id));
    }
    admitted.start();
    return assessment;
  }
  /** Rebuild the assessment's current revision-bound execution context. */
  private async current(owner: string, assessment: BolaAssessment) {
    const scan = await this.scans.store.get(assessment.scanId, owner);
    if (scan.state !== 'COMPLETED' || scan.partial || scan.cleanup !== 'COMPLETE')
      throw new ControlPlaneError('BOLA_DISCOVERY_INCOMPLETE', 409);
    const { context, request } = await this.control.store.write(async tx => {
      const target = await this.control.store.get<Target>('target', assessment.targetId, owner, tx);
      if (target.revision !== assessment.targetRevision || target.policyRevision !== assessment.policyRevision)
        throw new ControlPlaneError('BOLA_REVISION_CHANGED', 409);
      const bindings = [];
      for (const bound of assessment.profiles) {
        const profile = await this.control.store.get<Profile>('profile', bound.profileId, owner, tx);
        bindings.push(reconciledBolaBinding(assessment, scan, target, profile, bound));
      }
      const request = { ...scan.request, profiles: bindings };
      return { context: await this.control.scanContext(owner, assessment.targetId, request, tx), request };
    });
    if (context.target.revision !== assessment.targetRevision || context.policy.revision !== assessment.policyRevision)
      throw new ControlPlaneError('BOLA_REVISION_CHANGED', 409);
    for (const headers of context.headers) for (const name of Object.keys(headers)) delete headers[name];
    for (const item of context.guardHeaders) for (const name of Object.keys(item.headers)) delete item.headers[name];
    return { scan: { ...scan, request }, context };
  }
  private budget(id: string, owner: string, signal: AbortSignal): BolaBudget {
    return {
      /** Reserve BOLA model allowance after cancellation and serialized-input bound checks. */
      reserve: async (_role, inputBytes, outputTokens) => {
        signal.throwIfAborted();
        if (!Number.isSafeInteger(inputBytes) || inputBytes < 0 || inputBytes > 65536)
          throw new ControlPlaneError('BOLA_MODEL_INPUT_BOUND', 403);
        await this.store.reserve(id, owner, 'usedTokens', inputBytes + outputTokens + 2048);
      },
    };
  }
  private async modelEvent(
    id: string,
    owner: string,
    role: 'sherlock' | 'dupin' | 'watson',
    modelId: string,
    usageTokens: number | null,
  ) {
    await this.store.update(id, owner, value => ({
      ...this.requireActive(value),
      modelEvents: [...value.modelEvents, { role, modelId, usageTokens }],
    }));
  }
  /** Reject verification when the assessment is cancelled or no longer active. */
  private requireActive(value: BolaAssessment): BolaAssessment {
    if (value.state === 'CANCEL_REQUESTED' || value.state === 'CANCELLED')
      throw new ControlPlaneError('BOLA_CANCELLED', 409);
    return value;
  }
  /** Execute admitted BOLA discovery and verification through persisted terminal settlement. */
  private async run(owner: string, id: string, signal: AbortSignal) {
    const workSignal = AbortSignal.any([signal, this.closing.signal, AbortSignal.timeout(180000)]);
    try {
      workSignal.throwIfAborted();
      let assessment = await this.store.get(id, owner);
      const scan = await this.scans.waitForCompletion(owner, assessment.scanId, workSignal);
      workSignal.throwIfAborted();
      const current = await this.current(owner, assessment);
      const principalComparison = scanPrincipalComparison(
        scan,
        assessment.profiles.map(item => item.profileId),
      );
      if (principalComparison !== 'DISTINCT') {
        await this.store.update(id, owner, value => ({
          ...this.requireActive(value),
          state: 'COMPLETED',
          outcome: 'INCONCLUSIVE',
          reason: principalComparison === 'SAME' ? 'BOLA_PRINCIPALS_SAME' : 'BOLA_PRINCIPALS_UNVERIFIED',
        }));
        return;
      }
      const evidence = await this.scans.store.evidence(scan.id, owner, 512, 0);
      const candidates = observedBolaCandidates(evidence, current.context.target.routeAccessRules ?? [], [
        assessment.profiles[0]!.profileId,
        assessment.profiles[1]!.profileId,
      ]);
      if (!candidates.length) throw new ControlPlaneError('BOLA_CANDIDATES_INCOMPLETE', 409);
      assessment = await this.store.update(id, owner, value => ({
        ...this.requireActive(value),
        state: 'PLANNING',
        candidates,
      }));
      const budget = this.budget(id, owner, workSignal);
      const selected = await this.models!.select(candidates, budget, workSignal);
      await this.modelEvent(id, owner, 'sherlock', selected.modelId, selected.usageTokens);
      const candidate = selectedBolaCandidate(selected.value, candidates);
      await this.current(owner, assessment);
      const stillAvailable = new Set((await this.scans.store.evidence(scan.id, owner, 512, 0)).map(item => item.id));
      if (candidate.evidenceIds.some(evidenceId => !stillAvailable.has(evidenceId)))
        throw new ControlPlaneError('BOLA_EVIDENCE_UNAVAILABLE', 409);
      workSignal.throwIfAborted();
      const verificationJobId = crypto.randomUUID();
      await this.store.update(id, owner, value => ({
        ...this.requireActive(value),
        state: 'VERIFYING',
        selected: candidate,
        selection: selected.value,
        verificationJobId,
        verificationCleanup: 'PENDING',
      }));
      await this.store.reserve(id, owner, 'usedRequests', 2);
      const proof = {
        ...(await this.driver.verify(current.scan, candidate, verificationJobId, workSignal)),
        principalComparison,
      };
      if (!(await this.reconcileVerificationJob(owner, id))) throw new ControlPlaneError('BOLA_CLEANUP_DEBT', 503);
      workSignal.throwIfAborted();
      await this.current(owner, assessment);
      const policy = {
        objectPolicy: 'owner' as const,
        expectedUnauthorizedStatus: [...candidate.expectedUnauthorizedStatus],
      };
      const interpreted = await this.models!.interpret(proof, policy, budget, workSignal);
      await this.modelEvent(id, owner, 'dupin', interpreted.modelId, interpreted.usageTokens);
      const deterministic = !proof.completed
        ? 'INCONCLUSIVE'
        : candidate.expectedUnauthorizedStatus.includes(proof.alternateStatus ?? 0)
          ? 'NOT_REPRODUCED'
          : proof.alternateStatus === 200 && proof.ownerStatus === 200 && proof.bodyMatches === true
            ? 'CONFIRMED'
            : 'INCONCLUSIVE';
      let reviewed: Awaited<ReturnType<BolaModels['review']>> | null = null;
      if (deterministic === 'CONFIRMED') {
        reviewed = await this.models!.review(proof, policy, budget, workSignal);
        await this.modelEvent(id, owner, 'watson', reviewed.modelId, reviewed.usageTokens);
      }
      await this.current(owner, assessment);
      const outcome =
        deterministic === 'CONFIRMED' && (interpreted.value.outcome !== 'CONFIRMED' || reviewed?.value.vote !== 'agree')
          ? 'INCONCLUSIVE'
          : deterministic;
      const interpretationDisagrees = deterministic === 'CONFIRMED' && interpreted.value.outcome !== 'CONFIRMED';
      const reviewDisagrees = deterministic === 'CONFIRMED' && reviewed?.value.vote !== 'agree';
      const reason =
        interpretationDisagrees && reviewDisagrees
          ? 'BOTH_DISAGREE'
          : interpretationDisagrees
            ? 'INTERPRETATION_DISAGREEMENT'
            : reviewDisagrees
              ? 'REVIEW_DISAGREEMENT'
              : 'DETERMINISTIC_BOLA_COMPARISON';
      await this.store.complete(id, owner, proof, outcome, reason);
    } catch (error) {
      const assessment = await this.store.get(id, owner).catch(() => null);
      const cleanupComplete = assessment?.verificationJobId
        ? await this.reconcileVerificationJob(owner, id).catch(() => false)
        : true;
      const reason = this.closing.signal.aborted
        ? 'SERVER_STOPPED'
        : signal.aborted
          ? 'BOLA_CANCELLED'
          : !cleanupComplete
            ? 'BOLA_CLEANUP_DEBT'
            : workSignal.aborted
              ? 'BOLA_DURATION_EXCEEDED'
              : error instanceof ControlPlaneError
                ? error.code
                : error instanceof Error && error.message === 'BOLA_SELECTION_NOT_GROUNDED'
                  ? error.message
                  : 'BOLA_ASSESSMENT_FAILED';
      await this.store
        .update(id, owner, value => {
          if (value.state === 'CANCEL_REQUESTED') throw new ControlPlaneError('BOLA_CANCEL_PENDING', 409);
          if (['COMPLETED', 'CANCELLED'].includes(value.state))
            throw new ControlPlaneError('BOLA_ALREADY_TERMINAL', 409);
          return { ...value, state: 'BLOCKED', reason };
        })
        .catch(() => undefined);
    }
  }
  async get(owner: string, id: string) {
    await this.store.purgeExpired();
    return this.store.get(parse(idSchema, id), owner);
  }
}

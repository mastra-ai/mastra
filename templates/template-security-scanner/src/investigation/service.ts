import { classifyModelFailure } from './model-failure.js';
import { randomUUID } from 'node:crypto';
import { ControlPlaneError, parse, pathAllowed, type Profile, type Target } from '../core/contracts.js';
import type { ControlPlane, MutationScope } from '../core/control-plane.js';
import type { ScanService } from '../discovery/service.js';
import { terminal, type Evidence, type Scan } from '../discovery/contracts.js';
import type { PlaybookRegistry } from '../knowledge/playbooks.js';
import type { Playbook } from '../knowledge/playbooks.js';
import type { AdvisoryStore } from '../advisory/store.js';
import type { OwnedLabBoundary } from '../discovery/driver.js';
import { ownedApprovalCallback } from '../discovery/lab.js';
import {
  approvalDecisionSchema,
  hypothesisSchema,
  investigationAdmissionSchema,
  ownedResourceSchema,
  scheduleSchema,
  type HypothesisInput,
} from './contracts.js';
import {
  InvestigationStore,
  type Approval,
  type Hypothesis,
  type Investigation,
  type Lineage,
  type OwnedResource,
} from './store.js';
import type { InvestigationModels, ModelBudget, PlanningResources } from './models.js';
import { deterministicOutcome, verificationProofSchema, type VerificationProof } from './verification.js';
import { forbiddenCredentialValues, SecretGuard } from '../discovery/parser.js';

/** Trusted allowlisted verification boundary; models cannot dispatch this driver. */
export interface VerificationDriver {
  /** Execute one bounded capability and return only sanitized deterministic facts. */
  verify(input: {
    /** Persisted fenced job whose requests were reserved before execution. */
    jobId: string;
    /** Complete discovery scan providing the immutable source lineage. */
    scan: Scan;
    /** Grounded proposal fixing the category, capability, evidence, and limits. */
    hypothesis: Hypothesis;
    /** Current consumed approval for active verification, or null for passive work. */
    approval: Approval | null;
    /** Exact registered owned-resource snapshot, or null when prerequisites are absent. */
    resource: OwnedResource | null;
    /** Cancellation, shutdown, and absolute-deadline signal. */
    signal: AbortSignal;
  }): Promise<VerificationProof>;
  /** Reconcile recorded owned resources for these jobs after interruption. */
  recover?(jobIds: string[]): Promise<void>;
}

export class InvestigationService {
  readonly store: InvestigationStore;
  /** Return the owned-lab approval callback URL, or null when no owned lab is configured. */
  approvalCallback() {
    return this.ownedLab?.callback ?? null;
  }
  /** Report whether model-backed investigation is enabled with usable configuration. */
  modelConfigured() {
    return this.enabled && !!this.models;
  }
  private workerTimer?: NodeJS.Timeout;
  private readonly workers = new Set<Promise<unknown>>();
  private readonly active = new Map<string, Set<AbortController>>();
  private readonly activeScopes = new Map<AbortController, { lineage: Lineage; finished: Promise<void> }>();
  private mutations: Promise<unknown> = Promise.resolve();
  private mutationBarrier?: Promise<void>;
  private readonly closing = new AbortController();
  constructor(
    databaseUrl: string,
    private readonly control: ControlPlane,
    private readonly scans: ScanService,
    private readonly playbooks: PlaybookRegistry,
    private readonly advisories: AdvisoryStore,
    private readonly ownedLab?: OwnedLabBoundary,
    private readonly models?: InvestigationModels,
    private readonly verifier?: VerificationDriver,
    private readonly enabled = false,
  ) {
    this.store = new InvestigationStore(databaseUrl);
  }
  initialize() {
    return (async () => {
      await this.store.initialize();
      await this.store.recoverInterruptedPlanning('local-operator');
      while ((await this.store.expireApprovals('local-operator')) >= 100) {
        // Continue in bounded write transactions until every expired approval is terminal.
      }
      if (this.verifier?.recover) {
        for (let offset = 0; ; offset += 100) {
          const jobs = await this.store.list<{ id: string }>(
            'scanner_verification_jobs',
            'local-operator',
            100,
            offset,
          );
          if (!jobs.length) break;
          await this.verifier.recover(jobs.map(job => job.id));
        }
      }
    })();
  }
  /** Fence new investigation work and drain workers through terminal storage settlement. */
  async close() {
    if (this.workerTimer) clearInterval(this.workerTimer);
    this.closing.abort();
    for (const controllers of this.active.values()) for (const controller of controllers) controller.abort();
    await Promise.allSettled([...this.workers]);
    await this.mutations;
    await this.store.close();
  }
  /** Start bounded verification and schedule workers while preventing duplicate active loops. */
  startWorkers(owner: string) {
    if (this.workerTimer) return;
    /** Start at most the configured worker capacity while the investigation service remains open. */
    const tick = () => {
      if (this.closing.signal.aborted || this.workers.size >= 6) return;
      void this.executeOne(owner, this.closing.signal).catch(() => undefined);
    };
    this.workerTimer = setInterval(tick, 1000);
    this.workerTimer.unref();
    tick();
  }
  /** Fence affected admissions and drain active work before applying a domain mutation. */
  async coordinateMutation<T>(
    scope: MutationScope,
    validate: () => Promise<void>,
    commit: () => Promise<T>,
  ): Promise<T> {
    if (this.closing.signal.aborted) throw new ControlPlaneError('SERVER_CLOSING', 503);
    const operation = this.mutations.then(async () => {
      let release: () => void = () => {};
      this.mutationBarrier = new Promise<void>(resolve => {
        release = resolve;
      });
      try {
        await validate();
        const affected = [...this.activeScopes.entries()].filter(([, entry]) =>
          scope.kind === 'target'
            ? entry.lineage.targetId === scope.id
            : scope.kind === 'policy'
              ? entry.lineage.policyId === scope.id
              : entry.lineage.profiles.some(profile => profile.profileId === scope.id),
        );
        for (const [controller] of affected) controller.abort();
        await Promise.all(affected.map(([, entry]) => entry.finished));
        return await commit();
      } finally {
        this.mutationBarrier = undefined;
        release();
      }
    });
    this.mutations = operation.catch(() => undefined);
    return operation;
  }
  /** Rebuild current lineage from a completed scan and reject stale profile or authorization bindings. */
  private async current(owner: string, scan: Scan): Promise<Lineage> {
    if (!terminal(scan.state) || scan.state !== 'COMPLETED' || scan.partial || scan.cleanup !== 'COMPLETE')
      throw new ControlPlaneError('SCAN_NOT_READY', 409);
    const profiles = await Promise.all(
      scan.request.profiles.map(binding => this.control.store.get<Profile>('profile', binding.profileId, owner)),
    );
    const updatedBindings = scan.request.profiles.map((binding, index) => {
      const profile = profiles[index]!;
      const role = scan.roles.find(item => item.profileId === profile.id);
      if (
        profile.credentialRevision !== binding.credentialRevision ||
        profile.revision > binding.profileRevision + 1 ||
        (profile.revision !== binding.profileRevision &&
          (profile.revision !== binding.profileRevision + 1 ||
            profile.identityResult?.checkedAt === undefined ||
            Date.parse(profile.identityResult.checkedAt) < Date.parse(scan.createdAt))) ||
        role?.role !== profile.role ||
        role?.identity !== 'READY'
      )
        throw new ControlPlaneError('REVISION_CONFLICT', 409);
      return { ...binding, profileRevision: profile.revision };
    });
    const context = await this.control.store.write(tx =>
      this.control.scanContext(owner, scan.targetId, { ...scan.request, profiles: updatedBindings }, tx),
    );
    try {
      return {
        targetId: context.target.id,
        targetRevision: context.target.revision,
        policyId: context.policy.id,
        policyRevision: context.policy.revision,
        profiles: context.profiles.map(profile => ({
          profileId: profile.id,
          profileRevision: profile.revision,
          credentialRevision: profile.credentialRevision,
        })),
        scanId: scan.id,
      };
    } finally {
      for (const header of context.headers) for (const name of Object.keys(header)) delete header[name];
      for (const item of context.guardHeaders) for (const name of Object.keys(item.headers)) delete item.headers[name];
    }
  }
  /** Check target, policy, profile and scan revisions against the admitted investigation lineage. */
  private async validateLineage(owner: string, investigation: Investigation) {
    const scan = await this.scans.store.get(investigation.lineage.scanId, owner);
    const current = await this.current(owner, scan);
    if (JSON.stringify(current) !== JSON.stringify(investigation.lineage))
      throw new ControlPlaneError('REVISION_CONFLICT', 409);
    return scan;
  }
  /** Resolve a verified playbook matching the hypothesis's recorded version and digest. */
  private async reviewedPlaybook(hypothesis: Hypothesis): Promise<Playbook> {
    const binding = hypothesis.ruleBinding;
    if (!binding) throw new ControlPlaneError('PLAYBOOK_BINDING_STALE', 409);
    const current = await this.playbooks.binding(hypothesis.category);
    if (JSON.stringify(binding) !== JSON.stringify(current)) throw new ControlPlaneError('PLAYBOOK_BINDING_STALE', 409);
    const playbook = (await this.playbooks.list()).find(item => item.category === hypothesis.category);
    if (!playbook || playbook.toolId !== hypothesis.toolId) throw new ControlPlaneError('PLAYBOOK_BINDING_STALE', 409);
    return playbook;
  }
  async admit(owner: string, input: unknown, scheduleEventId?: string, advisoryEventId?: string) {
    const request = parse(investigationAdmissionSchema, input);
    const scan = await this.scans.store.get(request.scanId, owner);
    const lineage = await this.current(owner, scan);
    return this.store.admit(owner, request, lineage, scheduleEventId, advisoryEventId);
  }
  /** Validate and persist a revision-bound owned resource for bounded verification. */
  async bindOwnedResource(owner: string, targetId: string, input: unknown) {
    const request = parse(ownedResourceSchema, input);
    const target = await this.control.store.get<Target>('target', targetId, owner);
    if (target.environment !== 'lab' || !target.authorizationConfirmed || !pathAllowed(request.path, target))
      throw new ControlPlaneError('OWNED_RESOURCE_REQUIRED', 403);
    const selectedIds =
      request.category === 'idor'
        ? [request.ownerProfileId, request.alternateProfileId]
        : request.category === 'authentication_bypass'
          ? [request.authenticatedProfileId, request.publicProfileId]
          : request.category === 'bfla'
            ? [request.adminProfileId, request.lowProfileId]
            : [request.publicProfileId];
    if (new Set(selectedIds).size !== selectedIds.length) throw new ControlPlaneError('RESOURCE_PROFILES_INVALID', 400);
    const profiles = await Promise.all(selectedIds.map(id => this.control.store.get<Profile>('profile', id, owner)));
    if (profiles.some(profile => profile.targetId !== targetId))
      throw new ControlPlaneError('RESOURCE_PROFILES_INVALID', 403);
    if (
      request.category === 'authentication_bypass' &&
      (profiles[0]!.kind === 'public' || profiles[1]!.kind !== 'public')
    )
      throw new ControlPlaneError('RESOURCE_PROFILES_INVALID', 403);
    if (
      (request.category === 'idor' || request.category === 'bfla') &&
      profiles.some(profile => profile.kind === 'public')
    )
      throw new ControlPlaneError('RESOURCE_PROFILES_INVALID', 403);
    if (
      !['idor', 'authentication_bypass', 'bfla'].includes(request.category) &&
      profiles.some(profile => profile.kind !== 'public')
    )
      throw new ControlPlaneError('RESOURCE_PROFILES_INVALID', 403);
    const binding: OwnedResource = {
      ...request,
      id: randomUUID(),
      owner,
      targetId,
      targetRevision: target.revision,
      policyRevision: target.policyRevision,
      profileRevisions: profiles.map(profile => ({
        profileId: profile.id,
        profileRevision: profile.revision,
        credentialRevision: profile.credentialRevision,
      })),
      createdAt: new Date().toISOString(),
    };
    return this.store.bindOwnedResource(
      binding,
      async tx => {
        const safeContext = await this.control.scanContext(
          owner,
          targetId,
          {
            targetRevision: binding.targetRevision,
            policyRevision: binding.policyRevision,
            operation: 'identity',
            profiles: binding.profileRevisions.map(profile => ({
              ...profile,
              targetRevision: binding.targetRevision,
              policyRevision: binding.policyRevision,
            })),
          },
          tx,
        );
        try {
          const guard = new SecretGuard(forbiddenCredentialValues(safeContext.guardHeaders.map(item => item.headers)));
          if (guard.unsafe(JSON.stringify(request))) throw new ControlPlaneError('CREDENTIAL_METADATA_CONFLICT', 403);
        } finally {
          for (const header of [...safeContext.headers, ...safeContext.guardHeaders.map(item => item.headers)])
            for (const name of Object.keys(header)) delete header[name];
        }
      },
      this.control.store.write.bind(this.control.store),
    );
  }
  /** Admit operator-supplied hypotheses after checking their evidence, scope and budget constraints. */
  async propose(owner: string, investigationId: string, input: unknown) {
    const investigation = await this.store.getInvestigation(investigationId, owner);
    const scan = await this.validateLineage(owner, investigation);
    const proposal: HypothesisInput = parse(hypothesisSchema, input);
    if (proposal.scanId !== scan.id) throw new ControlPlaneError('HYPOTHESIS_SCAN_MISMATCH', 409);
    const playbook = (await this.playbooks.list()).find(item => item.category === proposal.category);
    if (!playbook || playbook.toolId !== proposal.toolId) throw new ControlPlaneError('CAPABILITY_NOT_REGISTERED', 403);
    if (
      proposal.maxRequests > playbook.limits.maxRequests ||
      proposal.maxDurationSeconds > playbook.limits.maxDurationSeconds
    )
      throw new ControlPlaneError('BUDGET_EXCEEDED', 403);
    if (
      proposal.maxRequests > investigation.limits.maxRequests ||
      proposal.maxTokens > investigation.limits.maxTokens ||
      proposal.maxDurationSeconds > investigation.limits.maxDurationSeconds
    )
      throw new ControlPlaneError('BUDGET_EXCEEDED', 403);
    if (proposal.referenceIds.some(id => !playbook.references.includes(id)))
      throw new ControlPlaneError('REFERENCE_NOT_GROUNDED', 403);
    if (proposal.advisoryId) {
      const advisory = await this.advisories.get(proposal.advisoryId);
      if (advisory.revision !== proposal.advisoryRevision || advisory.upstreamStatus !== 'published')
        throw new ControlPlaneError('ADVISORY_NOT_CURRENT', 409);
    }
    const evidence = await this.scans.store.evidence(scan.id, owner, 512, 0);
    const available = new Set(evidence.map(item => item.id));
    if (proposal.evidenceIds.some(id => !available.has(id))) throw new ControlPlaneError('EVIDENCE_NOT_GROUNDED', 403);
    const surface = evidence.find(
      item => proposal.evidenceIds.includes(item.id) && item.observation.kind === 'endpoint',
    );
    const resource = surface
      ? await this.store.ownedResource(owner, scan.targetId, proposal.category, surface.observation.path)
      : null;
    if (resource && !this.resourceCurrent(resource, investigation.lineage))
      throw new ControlPlaneError('RESOURCE_BINDING_STALE', 409);
    const hypothesis: Hypothesis = {
      ...proposal,
      ruleBinding: await this.playbooks.binding(proposal.category),
      id: randomUUID(),
      investigationId,
      owner,
      lineage: investigation.lineage,
      resourceBindingId: resource?.id ?? null,
      state: proposal.risk === 'active' ? 'AWAITING_APPROVAL' : 'QUEUED',
      reason: null,
      createdAt: new Date().toISOString(),
    };
    return this.store.enqueue(hypothesis, 'dupin');
  }
  /** Check an owned resource against the current target, policy and profile revisions. */
  private resourceCurrent(resource: OwnedResource, lineage: Lineage) {
    return (
      resource.targetRevision === lineage.targetRevision &&
      resource.policyRevision === lineage.policyRevision &&
      resource.profileRevisions.every(binding =>
        lineage.profiles.some(
          profile =>
            profile.profileId === binding.profileId &&
            profile.profileRevision === binding.profileRevision &&
            profile.credentialRevision === binding.credentialRevision,
        ),
      )
    );
  }
  /** Project only current owned resources and roles represented in the sanitized planning evidence. */
  private async planningResources(
    owner: string,
    investigation: Investigation,
    scan: Scan,
    evidence: Evidence[],
    playbooks: Playbook[],
  ): Promise<PlanningResources> {
    const supplied = evidence.slice(0, 32).filter(item => item.observation.kind === 'endpoint');
    const paths = [...new Set(supplied.map(item => item.observation.path))];
    const bindings: PlanningResources['bindings'] = [];
    for (const path of paths)
      for (const book of playbooks) {
        const resource = await this.store.ownedResource(owner, scan.targetId, book.category, path);
        if (!resource) continue;
        /** Expose only a role represented by the exact evidence slice supplied for planning. */
        const role = (id: string) => supplied.find(item => item.observation.profileId === id)?.observation.role ?? null;
        const roles: Record<string, string | null> =
          resource.category === 'idor'
            ? { owner: role(resource.ownerProfileId), alternate: role(resource.alternateProfileId) }
            : resource.category === 'authentication_bypass'
              ? { authenticated: role(resource.authenticatedProfileId), public: role(resource.publicProfileId) }
              : resource.category === 'bfla'
                ? { admin: role(resource.adminProfileId), low: role(resource.lowProfileId) }
                : { public: role(resource.publicProfileId) };
        bindings.push({
          category: resource.category,
          evidenceIndexes: evidence
            .slice(0, 32)
            .flatMap((item, index) =>
              item.observation.kind === 'endpoint' && item.observation.path === path ? [index] : [],
            ),
          state: this.resourceCurrent(resource, investigation.lineage) ? 'CURRENT' : 'STALE',
          roles,
        });
      }
    return {
      targetRevision: investigation.lineage.targetRevision,
      policyRevision: investigation.lineage.policyRevision,
      coverage: 'SUPPLIED_FIRST_32_EVIDENCE',
      complete: true,
      bindings,
    };
  }
  /** Generate bounded model proposals and persist only schema-validated evidence-grounded hypotheses. */
  async proposeWithModels(owner: string, investigationId: string) {
    if (!this.models) throw new ControlPlaneError('MODEL_UNAVAILABLE', 503);
    const controller = new AbortController();
    const controllers = this.active.get(investigationId) ?? new Set<AbortController>();
    controllers.add(controller);
    this.active.set(investigationId, controllers);
    let deadlineSignal: AbortSignal | null = null;
    let deadlineAt = 0;
    try {
      const investigation = await this.store.getInvestigation(investigationId, owner);
      deadlineAt = Date.parse(investigation.createdAt) + investigation.limits.maxDurationSeconds * 1000;
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) throw new ControlPlaneError('INVESTIGATION_DURATION_EXCEEDED', 409);
      deadlineSignal = AbortSignal.timeout(remainingMs);
      const signal = AbortSignal.any([controller.signal, this.closing.signal, deadlineSignal]);
      const scan = await this.validateLineage(owner, investigation);
      signal.throwIfAborted();
      await this.store.beginPlanning(investigationId, owner);
      const evidence = await this.scans.store.evidence(scan.id, owner, 512, 0);
      const advisoryEvent = await this.store.advisoryEventForInvestigation(owner, investigation.idempotencyKey);
      const advisoryCandidates = advisoryEvent
        ? [
            await this.advisories.planningCandidate(advisoryEvent.id, advisoryEvent.revision),
            ...(await this.advisories.planningCandidates(7)).filter(candidate => candidate.id !== advisoryEvent.id),
          ].slice(0, 8)
        : await this.advisories.planningCandidates(8);
      signal.throwIfAborted();
      const playbooks = await this.playbooks.list();
      const availableResources = await this.planningResources(owner, investigation, scan, evidence, playbooks);
      const generated = await this.models.propose(
        scan.id,
        evidence,
        playbooks,
        advisoryCandidates,
        investigation.limits,
        4,
        Math.min(15000, Math.max(1, deadlineAt - Date.now())),
        this.modelBudget(investigationId, owner, signal),
        signal,
        availableResources,
      );
      signal.throwIfAborted();
      await this.store.recordModelUse(investigationId, owner, 'sherlock', generated.modelId, generated.usageTokens);
      const admitted = [];
      for (const proposal of generated.value) {
        signal.throwIfAborted();
        if (
          proposal.advisoryId &&
          !advisoryCandidates.some(
            candidate => candidate.id === proposal.advisoryId && candidate.revision === proposal.advisoryRevision,
          )
        )
          throw new ControlPlaneError('ADVISORY_NOT_GROUNDED', 403);
        admitted.push(await this.propose(owner, investigationId, proposal));
      }
      signal.throwIfAborted();
      if (admitted.length) await this.store.finishPlanning(investigationId, owner);
      else await this.store.blockInvestigation(investigationId, owner, 'NO_GROUNDED_HYPOTHESIS');
      return { modelId: generated.modelId, usageTokens: generated.usageTokens, admitted };
    } catch (error) {
      const reason =
        deadlineSignal?.aborted || (deadlineAt > 0 && Date.now() >= deadlineAt)
          ? 'INVESTIGATION_DURATION_EXCEEDED'
          : error instanceof ControlPlaneError
            ? error.code
            : classifyModelFailure(error).code;
      if (reason !== 'INVESTIGATION_ALREADY_PLANNED' && reason !== 'NOT_FOUND')
        await this.store.blockInvestigation(investigationId, owner, reason);
      if (reason === 'INVESTIGATION_DURATION_EXCEEDED') throw new ControlPlaneError(reason, 409);
      if (!(error instanceof ControlPlaneError)) throw new ControlPlaneError(classifyModelFailure(error).code, 503);
      throw error;
    } finally {
      controllers.delete(controller);
      if (!controllers.size) this.active.delete(investigationId);
    }
  }
  private modelBudget(investigationId: string, owner: string, signal: AbortSignal): ModelBudget {
    return {
      /** Reserve model allowance after enforcing bounded input bytes, output tokens and cancellation. */
      reserve: async (_role, inputBytes, outputTokens) => {
        signal.throwIfAborted();
        if (
          !Number.isSafeInteger(inputBytes) ||
          inputBytes < 0 ||
          inputBytes > 8192 ||
          !Number.isSafeInteger(outputTokens) ||
          outputTokens < 1 ||
          outputTokens > 2048
        )
          throw new ControlPlaneError('MODEL_INPUT_BOUND_EXCEEDED', 403);
        // Byte count upper-bounds ordinary UTF-8 prompt tokens; the fixed margin
        // covers instructions, structured-output schema and transport framing.
        await this.store.reserveModelTokens(investigationId, owner, inputBytes + outputTokens + 2048);
        signal.throwIfAborted();
      },
    };
  }
  executeOne(owner: string, signal = AbortSignal.timeout(60000)) {
    const task = this.executeClaimed(owner, signal);
    this.workers.add(task);
    void task.finally(() => this.workers.delete(task)).catch(() => undefined);
    return task;
  }
  /** Admit work into the service's mutation and shutdown lifecycle fence. */
  private async enterScope(
    controller: AbortController,
    lineage: Lineage,
    finished: Promise<void>,
    signal: AbortSignal,
  ) {
    // Recheck after every barrier: another queued mutation can install a new one
    // before this entrant resumes. Registration and the final check are atomic.
    while (this.mutationBarrier) {
      signal.throwIfAborted();
      const barrier = this.mutationBarrier;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          cleanup();
          reject(signal.reason);
        };
        const cleanup = () => signal.removeEventListener('abort', abort);
        signal.addEventListener('abort', abort, { once: true });
        void barrier.then(() => {
          cleanup();
          resolve();
        });
        if (signal.aborted) abort();
      });
    }
    signal.throwIfAborted();
    this.activeScopes.set(controller, { lineage, finished });
  }
  /** Execute a claimed job through budget reservation, verification, review and durable terminal settlement. */
  private async executeClaimed(owner: string, signal: AbortSignal) {
    if (this.closing.signal.aborted || signal.aborted) return null;
    if (!this.models || !this.verifier) throw new ControlPlaneError('VERIFICATION_DISABLED', 503);
    const job = await this.store.claim(owner, 60000, 6, 3);
    if (!job) return null;
    const controller = new AbortController();
    const workerSignal = AbortSignal.any([signal, this.closing.signal, controller.signal, AbortSignal.timeout(60000)]);
    let deadlineSignal: AbortSignal | null = null;
    let joined = workerSignal;
    const controllers = this.active.get(job.investigationId) ?? new Set<AbortController>();
    controllers.add(controller);
    this.active.set(job.investigationId, controllers);
    let finish: () => void = () => {};
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    let publishing = false;
    try {
      const investigation = await this.store.getInvestigation(job.investigationId, owner);
      const remainingMs =
        Date.parse(investigation.createdAt) + investigation.limits.maxDurationSeconds * 1000 - Date.now();
      if (remainingMs <= 0) throw new ControlPlaneError('INVESTIGATION_DURATION_EXCEEDED', 409);
      deadlineSignal = AbortSignal.timeout(remainingMs);
      joined = AbortSignal.any([workerSignal, deadlineSignal]);
      await this.enterScope(controller, investigation.lineage, finished, joined);
      joined.throwIfAborted();
      const scan = await this.validateLineage(owner, investigation);
      const hypothesis = await this.store.getHypothesis(job.hypothesisId, owner);
      await this.reviewedPlaybook(hypothesis);
      const approval = hypothesis.risk === 'active' ? await this.store.approvalForJob(job.id, owner) : null;
      const resource = hypothesis.resourceBindingId
        ? await this.store.getOwnedResource(hypothesis.resourceBindingId, owner)
        : null;
      if (
        hypothesis.risk === 'active' &&
        (!approval ||
          approval.decision !== 'approved' ||
          !approval.consumed ||
          approval.expiresAt <= new Date().toISOString() ||
          JSON.stringify(approval.lineage) !== JSON.stringify(investigation.lineage) ||
          approval.toolId !== hypothesis.toolId ||
          approval.maxRequests !== hypothesis.maxRequests ||
          !this.ownedLab ||
          approval.callback !== ownedApprovalCallback(this.ownedLab, approval.id))
      )
        throw new ControlPlaneError('APPROVAL_CONFLICT', 409);
      joined.throwIfAborted();
      const proof = verificationProofSchema.parse(
        await this.verifier.verify({ jobId: job.id, scan, hypothesis, approval, resource, signal: joined }),
      );
      joined.throwIfAborted();
      if (proof.category !== hypothesis.category || proof.requestCount > hypothesis.maxRequests)
        throw new ControlPlaneError('VERIFICATION_BOUNDARY_FAILED', 409);
      await this.validateLineage(owner, investigation);
      const playbook = await this.reviewedPlaybook(hypothesis);
      const assessed = await this.playbooks.assess(
        hypothesis.category,
        {
          surfacePresent: proof.surfacePresent,
          prerequisitesReady: proof.prerequisitesReady,
          scopeApproved: proof.scopeApproved,
          completed: proof.completed,
          identityValid: proof.identityValid,
        },
        proof.observation,
      );
      joined.throwIfAborted();
      const budget = this.modelBudget(investigation.id, owner, joined);
      /** Reject verification when any hypothesis evidence source is no longer retained for this scan. */
      const requireSources = async () => {
        const available = new Set((await this.scans.store.evidence(scan.id, owner, 512, 0)).map(item => item.id));
        if (hypothesis.evidenceIds.some(id => !available.has(id)))
          throw new ControlPlaneError('EVIDENCE_UNAVAILABLE', 409);
      };
      await requireSources();
      const interpreted = await this.models.interpret(proof, playbook, 10000, budget, joined);
      await this.store.recordModelUse(investigation.id, owner, 'dupin', interpreted.modelId, interpreted.usageTokens);
      joined.throwIfAborted();
      await requireSources();
      const reviewed =
        assessed.outcome === 'CONFIRMED' ? await this.models.review(proof, playbook, 10000, budget, joined) : null;
      if (reviewed)
        await this.store.recordModelUse(investigation.id, owner, 'watson', reviewed.modelId, reviewed.usageTokens);
      joined.throwIfAborted();
      const outcome =
        interpreted.value.outcome !== assessed.outcome && assessed.outcome === 'CONFIRMED'
          ? 'INCONCLUSIVE'
          : deterministicOutcome(playbook, proof, assessed.outcome, reviewed?.value.vote ?? 'uncertain');
      const result = {
        outcome,
        evidenceIds: proof.evidence.map(item => item.id),
        reason: outcome === assessed.outcome ? 'DETERMINISTIC_ASSESSMENT' : 'EVIDENCE_REVIEW_INCOMPLETE',
        modelId: reviewed?.modelId ?? interpreted.modelId,
        usageTokens: reviewed?.usageTokens ?? interpreted.usageTokens,
      };
      await this.reviewedPlaybook(hypothesis);
      joined.throwIfAborted();
      publishing = true;
      return await this.store.publish(job.id, owner, job.fence, result, outcome === 'CONFIRMED', proof);
    } catch (error) {
      if (publishing) throw error;
      if (controller.signal.aborted || signal.aborted) return null;
      if (
        deadlineSignal?.aborted ||
        (error instanceof ControlPlaneError && error.code === 'INVESTIGATION_DURATION_EXCEEDED')
      )
        return await this.store.fail(job.id, owner, job.fence, 'INVESTIGATION_DURATION_EXCEEDED', false);
      if (joined.aborted) return null;
      if (
        error instanceof ControlPlaneError &&
        [
          'REVISION_CONFLICT',
          'AUTH_REQUIRED',
          'APPROVAL_CONFLICT',
          'VERIFICATION_BOUNDARY_FAILED',
          'CAPABILITY_NOT_REGISTERED',
          'CATALOG_INTEGRITY_FAILED',
          'PLAYBOOK_NOT_FOUND',
          'PLAYBOOK_BINDING_STALE',
          'TOKEN_BUDGET_EXCEEDED',
          'MODEL_INPUT_BOUND_EXCEEDED',
          'EVIDENCE_UNAVAILABLE',
        ].includes(error.code)
      )
        return await this.store.publish(
          job.id,
          owner,
          job.fence,
          {
            outcome: error.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'BLOCKED',
            evidenceIds: [],
            reason: error.code,
            modelId: null,
            usageTokens: null,
          },
          false,
        );
      await this.store.fail(job.id, owner, job.fence, 'VERIFICATION_RUNTIME_FAILURE', true);
      throw error;
    } finally {
      this.activeScopes.delete(controller);
      controllers.delete(controller);
      if (!controllers.size) this.active.delete(job.investigationId);
      finish();
    }
  }
  /** Create an approval request bound to the current verification job and execution lineage. */
  async requestApproval(owner: string, hypothesisId: string, callback: string, expiresAt: string) {
    const hypothesis = await this.store.getHypothesis(hypothesisId, owner);
    await this.reviewedPlaybook(hypothesis);
    if (hypothesis.category !== 'ssrf' || hypothesis.risk !== 'active')
      throw new ControlPlaneError('APPROVAL_NOT_REQUIRED', 409);
    const investigation = await this.store.getInvestigation(hypothesis.investigationId, owner);
    const scan = await this.validateLineage(owner, investigation);
    const target = await this.control.store.get('target', scan.targetId, owner);
    if (!this.ownedLab || (target as { environment?: string }).environment !== 'lab')
      throw new ControlPlaneError('OWNED_LAB_REQUIRED', 403);
    if (callback !== this.ownedLab.callback) throw new ControlPlaneError('OWNED_CALLBACK_REQUIRED', 403);
    const expiry = Date.parse(expiresAt);
    if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 3600000)
      throw new ControlPlaneError('APPROVAL_EXPIRY_INVALID', 400);
    const jobs = await this.store.list<{ id: string; hypothesisId: string }>(
      'scanner_verification_jobs',
      owner,
      1000,
      0,
      investigation.id,
    );
    const job = jobs.find(item => item.hypothesisId === hypothesisId);
    if (!job) throw new ControlPlaneError('NOT_FOUND', 404);
    const approvalId = randomUUID();
    const approval: Approval = {
      id: approvalId,
      owner,
      investigationId: investigation.id,
      hypothesisId,
      jobId: job.id,
      lineage: investigation.lineage,
      toolId: hypothesis.toolId,
      callback: ownedApprovalCallback(this.ownedLab, approvalId),
      maxRequests: hypothesis.maxRequests,
      expiresAt: new Date(expiry).toISOString(),
      decision: 'pending',
      revision: 1,
      consumed: false,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    return this.store.requestApproval(approval);
  }
  /** Persist an operator approval decision only while its revision and lineage remain current. */
  async decide(owner: string, id: string, input: unknown) {
    const decision = parse(approvalDecisionSchema, input);
    const approval = await this.store.getApproval(id, owner);
    await this.reviewedPlaybook(await this.store.getHypothesis(approval.hypothesisId, owner));
    const investigation = await this.store.getInvestigation(approval.investigationId, owner);
    await this.validateLineage(owner, investigation);
    if (!this.ownedLab || approval.callback !== ownedApprovalCallback(this.ownedLab, approval.id))
      throw new ControlPlaneError('OWNED_CALLBACK_REQUIRED', 403);
    return this.store.decide(id, owner, decision.revision, decision.decision);
  }
  /** Cancel an owner-bound investigation and drain its active verification work. */
  async cancel(owner: string, id: string, revision: number) {
    const cancelled = await this.store.cancel(id, owner, revision);
    for (const controller of this.active.get(id) ?? []) controller.abort();
    return cancelled;
  }
  /** Persist a supported target recurrence with current policy and revision bindings. */
  async schedule(owner: string, input: unknown, revision?: number) {
    const parsed = parse(scheduleSchema, input);
    const target = await this.control.store.get('target', parsed.targetId, owner);
    if ((target as { authorizationConfirmed?: boolean }).authorizationConfirmed !== true)
      throw new ControlPlaneError('TARGET_AUTHORIZATION_REQUIRED', 403);
    return this.store.schedule(owner, parsed, revision);
  }
  /** Consume due persisted schedule events without admitting duplicate investigation work. */
  async processSchedules(owner: string) {
    if (!this.enabled || !this.models || this.closing.signal.aborted) return;
    for (const investigation of await this.store.unplannedAdvisoryInvestigations(owner, 100))
      await this.planScheduled(owner, investigation.id);
    await this.store.materializeAdvisoryEvents(owner, 100);
    for (const event of await this.store.pendingAdvisoryEvents(owner, 100)) {
      try {
        await this.advisories.planningCandidate(event.advisoryId, event.advisoryRevision);
        const target = await this.control.store.get<Target>('target', event.targetId, owner);
        if (!target.authorizationConfirmed) {
          await this.store.finishAdvisoryEvent(event.id, owner, 'CANCELLED');
          continue;
        }
        const scan = await this.scans.store.latestUsable(owner, event.targetId);
        const precedent = await this.store.latestInvestigationForTarget(owner, event.targetId);
        if (!scan || !precedent) {
          await this.store.finishAdvisoryEvent(event.id, owner, 'CANCELLED');
          continue;
        }
        const admitted = await this.admit(
          owner,
          { scanId: scan.id, idempotencyKey: event.id, ...precedent.limits },
          undefined,
          event.id,
        );
        await this.planScheduled(owner, admitted.investigation.id);
      } catch (error) {
        if (
          error instanceof ControlPlaneError &&
          [
            'NOT_FOUND',
            'REVISION_CONFLICT',
            'AUTH_REQUIRED',
            'RETENTION_REQUIRED',
            'SCAN_NOT_READY',
            'ADVISORY_NOT_CURRENT',
            'ADVISORY_EVENT_CANCELLED',
          ].includes(error.code)
        )
          await this.store.finishAdvisoryEvent(event.id, owner, 'CANCELLED');
        else throw error;
      }
    }
    for (const pending of await this.store.unplannedScheduledInvestigations(owner, 100)) {
      if (!pending.enabled) {
        await this.store.blockInvestigation(pending.investigation.id, owner, 'SCHEDULE_PAUSED');
        continue;
      }
      await this.planScheduled(owner, pending.investigation.id);
    }
    await this.store.tickSchedules(owner);
    for (const event of await this.store.pendingScheduleEvents(owner, 100)) {
      try {
        const target = await this.control.store.get('target', event.targetId, owner);
        if ((target as { authorizationConfirmed?: boolean }).authorizationConfirmed !== true) {
          await this.store.finishScheduleEvent(event.id, owner, 'CANCELLED');
          continue;
        }
        const scan = await this.scans.store.latestUsable(owner, event.targetId);
        const precedent = await this.store.latestInvestigationForTarget(owner, event.targetId);
        if (!scan || !precedent) {
          await this.store.finishScheduleEvent(event.id, owner, 'CANCELLED');
          continue;
        }
        const admitted = await this.admit(
          owner,
          { scanId: scan.id, idempotencyKey: event.id, ...precedent.limits },
          event.id,
        );
        await this.planScheduled(owner, admitted.investigation.id);
      } catch (error) {
        if (
          error instanceof ControlPlaneError &&
          [
            'NOT_FOUND',
            'REVISION_CONFLICT',
            'AUTH_REQUIRED',
            'RETENTION_REQUIRED',
            'SCHEDULE_EVENT_CANCELLED',
          ].includes(error.code)
        )
          await this.store.finishScheduleEvent(event.id, owner, 'CANCELLED');
        else throw error;
      }
    }
  }
  /** Admit scheduled planning only when the event retains usable scan evidence and current lineage. */
  private async planScheduled(owner: string, investigationId: string) {
    try {
      await this.proposeWithModels(owner, investigationId);
    } catch (error) {
      if (error instanceof ControlPlaneError && error.code === 'INVESTIGATION_ALREADY_PLANNED') return;
      const investigation = await this.store.getInvestigation(investigationId, owner);
      if (investigation.state === 'QUEUED' || investigation.state === 'PLANNING')
        await this.store.blockInvestigation(investigationId, owner, 'SCHEDULE_PLANNING_FAILED');
    }
  }
}

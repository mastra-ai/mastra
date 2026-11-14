import { createHash, randomUUID } from 'node:crypto';
import type { Settings } from '../config/settings.js';
import { ControlPlaneError, parse, bindingSchema } from '../core/contracts.js';
import { ControlPlane, type ScanContext, type MutationScope } from '../core/control-plane.js';
import { scanAdmissionSchema, terminal, type Scan, type ScanReason } from './contracts.js';
import { DiscoveryStore } from './store.js';
import { KatanaDiscoveryDriver, type OwnedLabBoundary } from './driver.js';
import { requireDiscoveryCapability } from './capability.js';
import { forbiddenCredentialValues, SecretGuard } from './parser.js';
import { reconcileScans, ScanResources } from './resources.js';
import { ownedLabBoundary } from './lab.js';
import { dockerClient } from '../runtime/docker.js';

type Running = {
  owner: string;
  controller: AbortController;
  promise: Promise<void>;
  targetId: string;
  policyId: string;
  profileIds: string[];
  startPending: boolean;
  start: () => void;
  stopReason?: ScanReason;
};
export class ScanService {
  readonly store: DiscoveryStore;
  private readonly active = new Map<string, Running>();
  private admissions: Promise<unknown> = Promise.resolve();
  private closed = false;
  private closing?: Promise<void>;
  private retentionTimer?: NodeJS.Timeout;
  constructor(
    private readonly settings: Settings,
    private readonly control: ControlPlane,
    private readonly lab?: OwnedLabBoundary,
  ) {
    this.store = new DiscoveryStore(settings.databaseUrl);
  }
  get enabled() {
    return this.settings.SCANNER_DISCOVERY_ENABLED;
  }
  async initialize() {
    await this.store.initialize();
    await reconcileScans(this.settings, this.store);
    this.retentionTimer = setInterval(() => void this.store.purgeExpired().catch(() => undefined), 60000);
    this.retentionTimer.unref();
  }
  async admit(owner: string, targetId: string, input: unknown) {
    return (await this.admitWithReceipt(owner, targetId, input)).scan;
  }
  async admitWithReceipt(owner: string, targetId: string, input: unknown, options: { deferStart?: boolean } = {}) {
    const request = parse(scanAdmissionSchema, input);
    const operation = this.admissions.then(async () => {
      if (this.closed) throw new ControlPlaneError('DISCOVERY_UNAVAILABLE', 503);
      await this.store.purgeExpired();
      await requireDiscoveryCapability(this.settings, request.mode);
      const now = new Date().toISOString();
      const scan: Scan = {
        id: randomUUID(),
        jobId: randomUUID(),
        targetId,
        owner,
        request,
        state: 'QUEUED',
        reason: 'ADMITTED',
        createdAt: now,
        updatedAt: now,
        partial: false,
        evidenceRetention: { expiredCount: 0, lastExpiredAt: null },
        cleanup: 'PENDING',
        roles: [],
        diagnostic: null,
        networkCounters: {},
        budget: { remainingRequests: 0, remainingBytes: 0, exhausted: false, reason: null },
      };
      let context: ScanContext | undefined;
      const result = await this.store.admit(
        scan,
        createHash('sha256').update(JSON.stringify(request)).digest('hex'),
        async transaction => {
          if (this.active.size) throw new ControlPlaneError('DISCOVERY_BUSY', 409);
          context = await this.control.scanContext(owner, targetId, request, transaction);
          if (
            context.target.application?.kind === 'rest_api' &&
            context.profiles.some(profile => profile.kind === 'api_key_header') &&
            new URL(context.target.entryUrl).protocol === 'http:'
          ) {
            if (!this.lab || context.target.environment !== 'lab')
              throw new ControlPlaneError('INSECURE_AUTH_TRANSPORT', 403);
            let verified;
            try {
              verified = await ownedLabBoundary(
                dockerClient(this.settings),
                this.lab.fixtureId,
                this.lab.networkId,
                this.lab.token,
                this.lab.upstreamCa,
              );
            } catch {
              throw new ControlPlaneError('OWNED_LAB_REQUIRED', 403);
            }
            if (
              verified.address !== this.lab.address ||
              new URL(context.target.entryUrl).origin !== `http://${verified.address}:18080`
            )
              throw new ControlPlaneError('OWNED_LAB_REQUIRED', 403);
          }
          const guard = new SecretGuard(forbiddenCredentialValues(context.guardHeaders.map(item => item.headers)));
          try {
            if (
              guard.unsafe(
                JSON.stringify({
                  targetId,
                  request,
                  target: context.target,
                  policy: context.policy,
                  profiles: context.profiles,
                }),
              )
            )
              throw new ControlPlaneError('CREDENTIAL_METADATA_CONFLICT', 403);
          } finally {
            guard.clear();
          }
          scan.budget = {
            remainingRequests: context.target.scanLimits.maxRequests,
            remainingBytes: context.target.scanLimits.maxResponseBytes,
            exhausted: false,
            reason: null,
          };
          scan.budgetInitial = {
            requests: context.target.scanLimits.maxRequests,
            bytes: context.target.scanLimits.maxResponseBytes,
          };
        },
      );
      let start = () => {};
      if (result.created) {
        const ready = context!;
        let releaseStart: () => void = () => {};
        const gate = new Promise<void>(resolve => {
          releaseStart = resolve;
        });
        const entry: Running = {
          owner,
          controller: new AbortController(),
          promise: Promise.resolve(),
          targetId,
          policyId: ready.policy.id,
          profileIds: ready.target.authProfileIds,
          startPending: true,
          start: () => {},
        };
        entry.start = () => {
          if (!entry.startPending) return;
          entry.startPending = false;
          releaseStart();
        };
        start = entry.start;
        this.active.set(scan.id, entry);
        entry.promise = gate.then(() => this.run(scan, ready, entry));
        if (!options.deferStart) start();
      }
      return { ...result, start };
    });
    this.admissions = operation.catch(() => undefined);
    return operation;
  }
  /** Wait for the admitted scan to settle or reject when the bounded wait expires. */
  async waitForCompletion(owner: string, scanId: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const running = this.active.get(scanId);
    if (running) {
      let abort: () => void = () => {};
      const cancelled = new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason ?? new Error('SCAN_WAIT_ABORTED'));
        signal.addEventListener('abort', abort, { once: true });
      });
      try {
        await Promise.race([running.promise, cancelled]);
      } finally {
        signal.removeEventListener('abort', abort);
      }
    }
    signal.throwIfAborted();
    return this.store.get(scanId, owner);
  }
  /** Revalidate scan revisions, authorization and identity state before discovery execution. */
  private async validate(scan: Scan) {
    const current = await this.store.get(scan.id, scan.owner);
    if (current.state === 'CANCEL_REQUESTED' || terminal(current.state))
      throw new ControlPlaneError('SCAN_STOPPED', 409);
    await this.control.store.write(transaction =>
      this.control.scanContext(scan.owner, scan.targetId, scan.request, transaction),
    );
  }
  /** Execute an admitted scan and persist its terminal state after lifecycle settlement. */
  private async run(scan: Scan, context: ScanContext, entry: Running) {
    try {
      if (entry.controller.signal.aborted) {
        await this.store.update(scan.id, scan.owner, current => ({
          ...current,
          state: 'CANCELLED',
          reason: entry.stopReason ?? 'CANCELLED_BY_OPERATOR',
          cleanup: 'COMPLETE',
          partial: true,
        }));
        return;
      }
      await this.store.update(scan.id, scan.owner, current => ({ ...current, state: 'RUNNING' }));
      const driver = new KatanaDiscoveryDriver(
        this.settings,
        this.store,
        context.target.application?.kind === 'rest_api' && new URL(context.target.entryUrl).protocol === 'https:'
          ? undefined
          : this.lab,
      );
      const outcome = await driver.discover(
        scan,
        context,
        entry.controller.signal,
        async (observations, role) => {
          // Cancellation may preserve an already observed public prefix. A scope
          // mutation waits for quiescence, so its old binding is still checked.
          await this.control.store.write(transaction =>
            this.control.scanContext(scan.owner, scan.targetId, scan.request, transaction),
          );
          await this.store.publish(scan, observations, context.policy.retention?.evidenceDays);
          await this.store.update(scan.id, scan.owner, current => ({
            ...current,
            roles: [...current.roles, role],
            partial: current.partial || role.partial,
          }));
        },
        () => this.validate(scan),
      );
      if (outcome.cleanupComplete && entry.stopReason !== 'SCOPE_CHANGED') {
        const observed = await this.store.get(scan.id, scan.owner);
        for (const role of observed.roles) {
          if (entry.controller.signal.aborted && role.identity === 'UNAVAILABLE') continue;
          const binding = scan.request.profiles.find(profile => profile.profileId === role.profileId);
          if (binding)
            await this.control
              .recordDiscoveryIdentity(scan.owner, scan.targetId, binding, role.identity)
              .catch(() => undefined);
        }
      }
      await this.store.update(scan.id, scan.owner, current => {
        const cancelling = current.state === 'CANCEL_REQUESTED';
        const reason = outcome.cleanupComplete ? (entry.stopReason ?? outcome.reason) : 'CLEANUP_FAILED';
        const state: Scan['state'] = !outcome.cleanupComplete
          ? cancelling
            ? 'CANCEL_REQUESTED'
            : 'FAILED'
          : cancelling
            ? 'CANCELLED'
            : outcome.reason === 'AUTH_REQUIRED'
              ? 'AUTH_REQUIRED'
              : ['RUNTIME_UNAVAILABLE', 'IDENTITY_UNAVAILABLE', 'CLEANUP_FAILED'].includes(outcome.reason)
                ? 'FAILED'
                : outcome.partial
                  ? 'COMPLETED_WITH_ERRORS'
                  : 'COMPLETED';
        return {
          ...current,
          state,
          reason,
          diagnostic: outcome.diagnostic,
          networkCounters: outcome.networkCounters,
          partial: current.partial || outcome.partial || cancelling,
          cleanup: outcome.cleanupComplete ? 'COMPLETE' : 'DEBT',
          budget: outcome.budget,
        };
      });
    } catch {
      await this.store
        .update(scan.id, scan.owner, current => ({
          ...current,
          state: 'FAILED',
          reason: 'RUNTIME_UNAVAILABLE',
          partial: true,
          cleanup: 'DEBT',
          budget: { remainingRequests: null, remainingBytes: null, exhausted: true, reason: 'unknown' },
        }))
        .catch(() => undefined);
    } finally {
      for (const header of context.headers) for (const name of Object.keys(header)) delete header[name];
      for (const guard of context.guardHeaders)
        for (const name of Object.keys(guard.headers)) delete guard.headers[name];
      this.active.delete(scan.id);
    }
  }
  /** Cancel an operator-owned scan and await its runtime cleanup. */
  async cancel(owner: string, id: string, reason: ScanReason = 'CANCELLED_BY_OPERATOR') {
    const existing = await this.store.get(id, owner);
    if (terminal(existing.state)) return existing;
    const running = this.active.get(id);
    if (running?.startPending) {
      running.stopReason = reason;
      running.controller.abort();
      running.start();
      await running.promise;
      return this.store.get(id, owner);
    }
    await this.store.update(id, owner, current =>
      terminal(current.state) ? current : { ...current, state: 'CANCEL_REQUESTED', reason, partial: true },
    );
    if (running) {
      running.stopReason = reason;
      running.controller.abort();
      await running.promise;
    } else {
      const complete = await new ScanResources(this.settings, this.store, id).cleanup();
      await this.store.update(id, owner, current =>
        terminal(current.state)
          ? current
          : {
              ...current,
              state: complete ? 'CANCELLED' : 'CANCEL_REQUESTED',
              cleanup: complete ? 'COMPLETE' : 'DEBT',
              reason: complete ? reason : 'CLEANUP_FAILED',
              partial: true,
            },
      );
    }
    return this.store.get(id, owner);
  }
  /** Run a confined profile identity check and apply only a current revision-bound result. */
  async checkIdentity(owner: string, targetId: string, profileId: string, input: unknown) {
    const binding = parse(bindingSchema, input);
    if (binding.profileId !== profileId) throw new ControlPlaneError('REVISION_CONFLICT', 409);
    const scan = await this.admit(owner, targetId, {
      targetRevision: binding.targetRevision,
      policyRevision: binding.policyRevision,
      profiles: [binding],
      mode: 'http',
      operation: 'identity',
      idempotencyKey: randomUUID(),
    });
    const running = this.active.get(scan.id);
    if (running) await running.promise;
    const completed = await this.store.get(scan.id, owner);
    if (completed.state === 'CANCELLED' || completed.state === 'CANCEL_REQUESTED')
      throw new ControlPlaneError('IDENTITY_CHECK_CANCELLED', 409);
    const observed = completed.roles.find(role => role.profileId === profileId);
    if (
      completed.cleanup !== 'COMPLETE' ||
      completed.state === 'FAILED' ||
      !observed ||
      observed.identity === 'UNAVAILABLE'
    )
      throw new ControlPlaneError('IDENTITY_UNAVAILABLE', 503);
    const profile = await this.control.profile(owner, targetId, profileId);
    if (
      profile.kind !== 'public' &&
      (profile.revision !== binding.profileRevision + 1 ||
        profile.identity.status !== observed.identity ||
        !profile.identity.checkedAt)
    )
      throw new ControlPlaneError('REVISION_CONFLICT', 409);
    return profile;
  }
  /** Prevent new scan activity and drain existing admissions and executions. */
  private async quiesce({ owner, kind, id }: MutationScope) {
    const affected = [...this.active.entries()].filter(([, entry]) =>
      kind === 'target'
        ? entry.targetId === id
        : kind === 'policy'
          ? entry.policyId === id
          : entry.profileIds.includes(id),
    );
    for (const [scanId] of affected) {
      const stopped = await this.cancel(owner, scanId, 'SCOPE_CHANGED');
      if (stopped.cleanup !== 'COMPLETE') throw new ControlPlaneError('SCAN_CLEANUP_REQUIRED', 503);
    }
  }
  async coordinateMutation<T>(
    scope: MutationScope,
    validate: () => Promise<void>,
    commit: () => Promise<T>,
  ): Promise<T> {
    const operation = this.admissions.then(async () => {
      if (this.closed) throw new ControlPlaneError('DISCOVERY_UNAVAILABLE', 503);
      await validate();
      await this.quiesce(scope);
      return commit();
    });
    this.admissions = operation.catch(() => undefined);
    return operation;
  }
  close() {
    return (this.closing ??= this.shutdown());
  }
  /** Fence admissions before cancelling active scans and draining their cleanup. */
  private async shutdown() {
    this.closed = true;
    if (this.retentionTimer) clearInterval(this.retentionTimer);
    let running: [string, Running][] = [];
    let complete = true;
    try {
      await this.admissions;
      running = [...this.active.entries()];
      const stopped = await Promise.allSettled(
        running.map(async ([id, entry]) => {
          const scan = await this.cancel(entry.owner, id, 'SERVER_STOPPED');
          if (scan.cleanup !== 'COMPLETE') throw new ControlPlaneError('SCAN_CLEANUP_REQUIRED', 503);
        }),
      );
      complete = stopped.every(result => result.status === 'fulfilled');
    } catch {
      complete = false;
    } finally {
      // Even a failed requested-state write must not leave network work alive.
      for (const [, entry] of running) {
        entry.controller.abort();
        entry.start();
      }
      const exited = await Promise.allSettled(running.map(([, entry]) => entry.promise));
      complete &&= exited.every(result => result.status === 'fulfilled');
      const closed = await Promise.allSettled([this.store.close()]);
      complete &&= closed.every(result => result.status === 'fulfilled');
    }
    if (!complete) throw new ControlPlaneError('SCAN_CLEANUP_REQUIRED', 503);
  }
}

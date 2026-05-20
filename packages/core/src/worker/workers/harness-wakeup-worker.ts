import { randomUUID } from 'node:crypto';

import type { HarnessStorage, HarnessWakeupItem, HarnessRowErrorCode } from '../../storage/domains/harness';
import { MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_CLAIM_TTL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

type WakeupSession = {
  id?: string;
  resourceId?: string;
  threadId?: string;
  _admitWakeupQueue?: (
    item: HarnessWakeupItem,
  ) => Promise<{ accepted: true; queuedItemId: string; duplicate: boolean }>;
};

type WakeupHarness = {
  session(opts: { sessionId?: string; resourceId?: string; threadId?: string }): Promise<WakeupSession>;
  _internalGetSessionStorage?: () => HarnessStorage | undefined;
};

type WakeupMastra = {
  getHarnesses?: () => Record<string, WakeupHarness>;
};

export interface HarnessWakeupWorkerConfig {
  maxAttempts?: number;
  claimTtlMs?: number;
  claimRenewMs?: number;
  batchSize?: number;
  pollIntervalMs?: number;
  retryBackoffMs?: (attempt: number) => number;
  harnesses?: readonly string[];
}

export class HarnessWakeupWorker extends MastraWorker {
  readonly name = 'harnessWakeups';

  #config: Required<Omit<HarnessWakeupWorkerConfig, 'retryBackoffMs' | 'harnesses'>> & {
    retryBackoffMs: (attempt: number) => number;
    harnesses?: readonly string[];
  };
  #running = false;
  #timer?: ReturnType<typeof setTimeout>;
  #tickInFlight = false;
  #pollGeneration = 0;
  #warnedNoHarnesses = false;
  #warnedNoStorage = false;

  constructor(config: HarnessWakeupWorkerConfig = {}) {
    super();
    const maxAttempts = positiveIntegerConfig('maxAttempts', config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    const claimTtlMs = positiveIntegerConfig('claimTtlMs', config.claimTtlMs ?? DEFAULT_CLAIM_TTL_MS);
    const claimRenewMs = positiveIntegerConfig(
      'claimRenewMs',
      config.claimRenewMs ?? Math.max(1, Math.floor(claimTtlMs / 3)),
    );
    if (claimRenewMs >= claimTtlMs) {
      throw new Error('HarnessWakeupWorker: claimRenewMs must be less than claimTtlMs');
    }
    const batchSize = positiveIntegerConfig('batchSize', config.batchSize ?? DEFAULT_BATCH_SIZE);
    const pollIntervalMs = positiveIntegerConfig('pollIntervalMs', config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    const retryBackoffMs = config.retryBackoffMs ?? defaultRetryBackoffMs;
    this.#config = {
      maxAttempts,
      claimTtlMs,
      claimRenewMs,
      batchSize,
      pollIntervalMs,
      retryBackoffMs: attempt => positiveIntegerConfig('retryBackoffMs result', retryBackoffMs(attempt)),
      ...(config.harnesses ? { harnesses: config.harnesses } : {}),
    };
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('HarnessWakeupWorker: call init() before start()');
    this.#running = true;
    this.#pollGeneration += 1;
    this.#scheduleNextTick(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    this.#pollGeneration += 1;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  async runOnce(): Promise<number> {
    if (this.#tickInFlight) return 0;
    this.#tickInFlight = true;
    try {
      return await this.#claimAndProcess();
    } finally {
      this.#tickInFlight = false;
    }
  }

  #scheduleNextTick(delayMs: number, generation = this.#pollGeneration): void {
    if (!this.#running || generation !== this.#pollGeneration) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.runOnce()
        .catch(error => this.deps?.logger?.error?.('HarnessWakeupWorker: tick failed', error))
        .finally(() => this.#scheduleNextTick(this.#config.pollIntervalMs, generation));
    }, delayMs);
    this.#timer.unref?.();
  }

  async #claimAndProcess(): Promise<number> {
    const deps = this.deps;
    const mastra = deps?.mastra as WakeupMastra | undefined;
    const harnesses = mastra?.getHarnesses?.() ?? {};
    const entries = Object.entries(harnesses).filter(([name]) => this.#config.harnesses?.includes(name) ?? true);
    if (entries.length === 0) {
      if (!this.#warnedNoHarnesses) {
        deps?.logger?.warn?.('HarnessWakeupWorker: no Harness instances registered, worker will not claim wakeups');
        this.#warnedNoHarnesses = true;
      }
      return 0;
    }

    let processed = 0;
    for (const [harnessName, harness] of entries) {
      try {
        const storage = await this.#storageForHarness(harness);
        if (!storage) continue;
        const claimId = `harness-wakeup-${randomUUID()}`;
        const claimed = await storage.claimHarnessWakeupItems({
          harnessName,
          statuses: ['due', 'failed', 'claimed'],
          claimId,
          limit: this.#config.batchSize,
          now: Date.now(),
          claimTtlMs: this.#config.claimTtlMs,
        });
        const batchRenewal = claimed.length > 1 ? this.#startBatchClaimRenewal(storage, claimed) : undefined;
        try {
          for (const item of claimed) {
            processed += 1;
            await this.#processClaimedWakeup({ harnessName, harness, storage, item });
            batchRenewal?.complete(item.id);
          }
        } finally {
          batchRenewal?.stop();
        }
      } catch (error) {
        this.deps?.logger?.error?.('HarnessWakeupWorker: failed to process harness wakeups', { harnessName, error });
      }
    }
    return processed;
  }

  async #storageForHarness(harness: WakeupHarness): Promise<HarnessStorage | undefined> {
    const storage =
      harness._internalGetSessionStorage?.() ??
      ((await this.deps?.storage?.getStore?.('harness')) as HarnessStorage | undefined);
    if (!storage && !this.#warnedNoStorage) {
      this.deps?.logger?.warn?.('HarnessWakeupWorker: no harness storage store available, worker will not run');
      this.#warnedNoStorage = true;
    }
    return storage;
  }

  #startBatchClaimRenewal(
    storage: HarnessStorage,
    items: HarnessWakeupItem[],
  ): { complete: (wakeupItemId: string) => void; stop: () => void } {
    const pending = new Map(items.map(item => [item.id, item]));
    let renewalInFlight = false;
    const renewPending = async () => {
      if (renewalInFlight || pending.size === 0) return;
      renewalInFlight = true;
      try {
        for (const item of pending.values()) {
          if (!item.claimId) continue;
          try {
            await storage.renewHarnessWakeupClaim({
              wakeupItemId: item.id,
              claimId: item.claimId,
              now: Date.now(),
              claimTtlMs: this.#config.claimTtlMs,
            });
          } catch (error) {
            this.deps?.logger?.warn?.('HarnessWakeupWorker: failed to renew pending batch wakeup claim', {
              wakeupItemId: item.id,
              error,
            });
          }
        }
      } finally {
        renewalInFlight = false;
      }
    };
    const interval = setInterval(() => {
      void renewPending();
    }, this.#config.claimRenewMs);
    interval.unref?.();
    return {
      complete: wakeupItemId => pending.delete(wakeupItemId),
      stop: () => clearInterval(interval),
    };
  }

  async #processClaimedWakeup({
    harness,
    storage,
    item,
  }: {
    harnessName: string;
    harness: WakeupHarness;
    storage: HarnessStorage;
    item: HarnessWakeupItem;
  }): Promise<void> {
    const claimId = item.claimId;
    if (!claimId) {
      this.deps?.logger?.warn?.('HarnessWakeupWorker: claimed wakeup missing claim id', { wakeupItemId: item.id });
      return;
    }

    try {
      if (await this.#reconcileExistingAdmission(storage, item, claimId)) return;
    } catch (error) {
      await this.#markWakeupFailedOrDead(storage, item, claimId, error);
      return;
    }

    let result: { queuedItemId: string };
    let renewalErrorAfterAdmission: unknown;
    try {
      const admitted = await withWakeupClaimRenewal({
        storage,
        item,
        claimId,
        claimTtlMs: this.#config.claimTtlMs,
        claimRenewMs: this.#config.claimRenewMs,
        operation: async () => {
          const session = await this.#resolveSession(harness, storage, item);
          if (session._admitWakeupQueue) return session._admitWakeupQueue(item);
          throw Object.assign(new Error('Harness session does not expose wakeup queue admission'), {
            code: 'harness.storage.wakeup_session_unavailable',
            retryable: false,
          });
        },
      });
      result = admitted.result;
      renewalErrorAfterAdmission = admitted.renewalError;
    } catch (error) {
      await this.#markWakeupFailedOrDead(storage, item, claimId, error);
      return;
    }

    if (renewalErrorAfterAdmission !== undefined) {
      this.deps?.logger?.warn?.('HarnessWakeupWorker: wakeup claim renewal failed after queue admission', {
        wakeupItemId: item.id,
        queuedItemId: result.queuedItemId,
        error: renewalErrorAfterAdmission,
      });
    }

    await this.#markWakeupQueued(storage, item, claimId, result.queuedItemId);
  }

  async #markWakeupQueued(
    storage: HarnessStorage,
    item: HarnessWakeupItem,
    claimId: string,
    queuedItemId: string,
  ): Promise<void> {
    const now = Date.now();
    try {
      await storage.updateHarnessWakeupItem(
        {
          ...item,
          status: 'queued',
          queuedItemId,
          queuedAt: now,
          updatedAt: now,
          failedAt: undefined,
          deadAt: undefined,
          nextAttemptAt: undefined,
          lastError: undefined,
          claimId: undefined,
          claimExpiresAt: undefined,
          claimedAt: undefined,
        },
        { claimId },
      );
    } catch (error) {
      this.deps?.logger?.error?.('HarnessWakeupWorker: failed to mark admitted wakeup queued', {
        wakeupItemId: item.id,
        queuedItemId,
        error,
      });
    }
  }

  async #reconcileExistingAdmission(
    storage: HarnessStorage,
    item: HarnessWakeupItem,
    claimId: string,
  ): Promise<boolean> {
    if (!item.admissionHash || !item.sessionId || !item.resourceId || !item.threadId) return false;
    const resolved = await storage.resolveOperationAdmissionEvidence({
      harnessName: item.harnessName,
      sessionId: item.sessionId,
      resourceId: item.resourceId,
      threadId: item.threadId,
      kind: 'queue',
      admissionId: item.admissionId,
      attemptedAdmissionHash: item.admissionHash,
    });
    if (resolved.status === 'none') return false;
    if (resolved.status === 'conflict') {
      throw Object.assign(new Error('Harness wakeup admission evidence conflicts with the wakeup payload'), {
        name: 'HarnessAdmissionConflictError',
        retryable: false,
      });
    }
    const queuedItemId =
      resolved.evidence && 'queuedItemId' in resolved.evidence ? resolved.evidence.queuedItemId : undefined;
    if (!queuedItemId) {
      throw Object.assign(new Error('Duplicate wakeup queue admission evidence has expired'), {
        name: 'HarnessValidationError',
        retryable: false,
      });
    }
    await this.#markWakeupQueued(storage, item, claimId, queuedItemId);
    return true;
  }

  async #resolveSession(
    harness: WakeupHarness,
    storage: HarnessStorage,
    item: HarnessWakeupItem,
  ): Promise<WakeupSession> {
    if (item.sessionId) {
      const active =
        item.threadId && item.resourceId
          ? await storage.loadSessionByThread({
              harnessName: item.harnessName,
              threadId: item.threadId,
              resourceId: item.resourceId,
            })
          : undefined;
      if (item.threadId && item.resourceId && !active) {
        throw Object.assign(new Error('Harness wakeup item does not identify an active recoverable session'), {
          code: 'harness.storage.wakeup_session_unavailable',
          retryable: false,
        });
      }
      const session = await harness.session({
        sessionId: active?.id ?? item.sessionId,
        ...(item.resourceId ? { resourceId: item.resourceId } : {}),
      });
      if (item.threadId && session.threadId !== item.threadId) {
        throw Object.assign(new Error('Harness wakeup session thread identity does not match the wakeup item'), {
          code: 'harness.storage.wakeup_session_unavailable',
          retryable: false,
        });
      }
      if (item.resourceId && session.resourceId !== item.resourceId) {
        throw Object.assign(new Error('Harness wakeup session resource identity does not match the wakeup item'), {
          code: 'harness.storage.wakeup_session_unavailable',
          retryable: false,
        });
      }
      return session;
    }
    throw Object.assign(new Error('Harness wakeup item does not identify a recoverable session'), {
      code: 'harness.storage.wakeup_session_unavailable',
      retryable: false,
    });
  }

  async #markWakeupFailedOrDead(
    storage: HarnessStorage,
    item: HarnessWakeupItem,
    claimId: string,
    error: unknown,
  ): Promise<void> {
    const now = Date.now();
    let projected = projectWakeupError(error);
    let exhausted = item.attempts >= this.#config.maxAttempts || projected.retryable === false;
    let nextAttemptAt: number | undefined;
    if (!exhausted) {
      try {
        nextAttemptAt = now + this.#config.retryBackoffMs(item.attempts);
      } catch (backoffError) {
        projected = projectWakeupError(backoffError);
        exhausted = true;
      }
    }
    const lastError = {
      code: projected.code,
      message: projected.message,
      retryable: !exhausted,
    };
    const next: HarnessWakeupItem = exhausted
      ? {
          ...item,
          status: 'dead',
          deadAt: now,
          updatedAt: now,
          lastError,
          claimId: undefined,
          claimExpiresAt: undefined,
          claimedAt: undefined,
          failedAt: undefined,
          nextAttemptAt: undefined,
        }
      : {
          ...item,
          status: 'failed',
          failedAt: now,
          updatedAt: now,
          nextAttemptAt,
          lastError,
          claimId: undefined,
          claimExpiresAt: undefined,
          claimedAt: undefined,
        };
    try {
      await storage.updateHarnessWakeupItem(next, { claimId });
    } catch (updateError) {
      this.deps?.logger?.error?.('HarnessWakeupWorker: failed to update claimed wakeup', {
        wakeupItemId: item.id,
        error: updateError,
      });
    }
  }
}

async function withWakeupClaimRenewal<T>({
  storage,
  item,
  claimId,
  claimTtlMs,
  claimRenewMs,
  operation,
}: {
  storage: HarnessStorage;
  item: HarnessWakeupItem;
  claimId: string;
  claimTtlMs: number;
  claimRenewMs: number;
  operation: () => Promise<T>;
}): Promise<{ result: T; renewalError: unknown }> {
  let renewalError: unknown;
  let interval: ReturnType<typeof setInterval> | undefined;
  const renew = async () => {
    try {
      await storage.renewHarnessWakeupClaim({
        wakeupItemId: item.id,
        claimId,
        now: Date.now(),
        claimTtlMs,
      });
      renewalError = undefined;
    } catch (error) {
      renewalError = error;
      if (interval) clearInterval(interval);
    }
  };
  interval = setInterval(() => {
    void renew();
  }, claimRenewMs);
  interval.unref?.();
  try {
    await renew();
    if (renewalError) throw renewalError;
    const result = await operation();
    return { result, renewalError };
  } finally {
    if (interval) clearInterval(interval);
  }
}

function defaultRetryBackoffMs(attempt: number): number {
  const exponent = Math.min(Math.max(attempt, 1), 8);
  return Math.min(60_000, 1_000 * 2 ** (exponent - 1));
}

function positiveIntegerConfig(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`HarnessWakeupWorker: ${name} must be a positive integer`);
  }
  return value;
}

function projectWakeupError(error: unknown): { code: HarnessRowErrorCode; message: string; retryable?: boolean } {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined;
  const name = typeof record?.name === 'string' ? record.name : undefined;
  const rawCode = typeof record?.code === 'string' ? record.code : undefined;
  const message = error instanceof Error ? error.message : 'Harness wakeup worker failed';
  const retryable = typeof record?.retryable === 'boolean' ? record.retryable : undefined;

  if (name === 'HarnessSessionClosedError') return { code: 'session_closed', message, retryable: false };
  if (name === 'HarnessSessionClosingError') return { code: 'session_closing', message, retryable: false };
  if (name === 'HarnessSessionDeletedError') return { code: 'session_deleted', message, retryable: false };
  if (name === 'HarnessSessionNotFoundError') return { code: 'worker_unavailable', message, retryable: false };
  if (name === 'HarnessSessionLockedError') return { code: 'session_locked', message, retryable: true };
  if (name === 'HarnessQueueFullError') return { code: 'queue_full', message, retryable: true };
  if (name === 'HarnessValidationError') return { code: 'provider_payload_invalid', message, retryable: false };
  if (name === 'HarnessAttachmentUnavailableError') {
    return { code: 'provider_payload_invalid', message, retryable: false };
  }
  if (name === 'HarnessAdmissionConflictError') {
    return { code: 'channel_payload_conflict', message, retryable: false };
  }
  if (rawCode === 'harness.storage.wakeup_session_unavailable') {
    return { code: 'worker_unavailable', message, retryable: false };
  }
  return { code: 'unknown', message, retryable };
}

/**
 * Execution fence for DurableAgent runs (#23734).
 *
 * Every execution that drives a durable run (`stream()`, `generate()`,
 * `resume()`, `recover()`) claims the run under a fresh execution id.
 * `recover()` takes the claim over immediately, so a still-running original
 * execution is superseded without waiting for a TTL. The original checks its
 * claim at every step boundary and before its terminal writes, and stops
 * instead of overwriting the recovered answer.
 *
 * Ownership lives in one of two places:
 *
 * - Storage, when the workflows store supports run fencing. The store keeps a
 *   per-run owner record whose generation goes up on every claim. The memory
 *   store is raised to the same generation. Writes that carry the claim's
 *   fence are rejected by storage once a newer claim exists, which closes the
 *   gap between a check and the write it guards.
 * - A pubsub lease otherwise. This gives liveness only: a window of
 *   milliseconds remains between a successful check and the write it guards.
 *   With `NoopLeaseProvider` every check passes, which preserves the previous
 *   single-process behavior.
 */
import { ErrorCategory, ErrorDomain, MastraError, MastraNonRetryableError } from '../../error';
import { isLeaseProvider, NoopLeaseProvider } from '../../events/pubsub';
import type { LeaseProvider, PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage/domains/memory/base';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import { isRunFenceConflictError, matchesRunFence, runOutsideRunFenceScope } from '../../storage/run-fencing';
import type { RunFence, RunFenceScope } from '../../storage/run-fencing';
import { runInRunFenceScope } from './run-fence-scope';

export const EXECUTION_LEASE_TTL_MS = 30_000;
export const EXECUTION_LEASE_RENEW_INTERVAL_MS = 10_000;
const VERIFY_RETRY_DELAY_MS = 250;
const TAKEOVER_ATTEMPTS = 3;
const EXECUTION_CLAIM_WAIT_MS = 5_000;
const CLAIM_POLL_INTERVAL_MS = 100;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, Math.max(0, ms)));

/**
 * Reserved request-context key carrying `Record<runId, DurableExecutionClaim>`.
 * Keyed by runId so a delegated durable sub-agent sharing the parent's
 * RequestContext cannot overwrite the parent's claim.
 */
export const MASTRA_DURABLE_EXECUTIONS_KEY = 'mastra__durableExecutions';

export const EXECUTION_SUPERSEDED_ERROR_ID = 'DURABLE_AGENT_EXECUTION_SUPERSEDED';
export const EXECUTION_UNVERIFIED_ERROR_ID = 'DURABLE_AGENT_EXECUTION_UNVERIFIED';
export const EXECUTION_CONFLICT_ERROR_ID = 'DURABLE_AGENT_EXECUTION_CONFLICT';
export const RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID = 'DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY';

type ExecutionLossErrorId = typeof EXECUTION_SUPERSEDED_ERROR_ID | typeof EXECUTION_UNVERIFIED_ERROR_ID;
type ExecutionDetails = { agentId: string; runId: string; executionId: string };

/**
 * Thrown when an execution can no longer prove it owns its run. Extends
 * `MastraNonRetryableError` so the workflow engine fails the step instead of
 * retrying it.
 */
export class DurableExecutionFenceError extends MastraNonRetryableError {
  readonly id: ExecutionLossErrorId;
  readonly domain = ErrorDomain.AGENT;
  readonly category = ErrorCategory.SYSTEM;
  readonly details: ExecutionDetails;

  constructor(id: ExecutionLossErrorId, details: ExecutionDetails, cause?: unknown) {
    super(
      id === EXECUTION_SUPERSEDED_ERROR_ID
        ? `Durable run ${details.runId} lost its execution lease (taken over by another execution, or expired); this execution stopped without writing.`
        : `Durable run ${details.runId}: could not verify that this execution still owns the run; stopping without writing.`,
      cause === undefined ? undefined : { cause },
    );
    this.name = 'DurableExecutionFenceError';
    this.id = id;
    this.details = details;
  }
}

/**
 * Whether `error` (or anything in its cause chain) reports that an execution
 * lost ownership, including storage rejecting one of its writes. Matches on
 * `id` so serialized errors from the evented engine and wrappers such as the
 * nested-workflow `MastraNonRetryableError` match too.
 */
export function isExecutionFenceError(error: unknown): boolean {
  if (isRunFenceConflictError(error)) return true;
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === 'object'; depth++) {
    const id = (current as { id?: unknown }).id;
    if (id === EXECUTION_SUPERSEDED_ERROR_ID || id === EXECUTION_UNVERIFIED_ERROR_ID) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function executionLeaseKey(agentId: string, runId: string): string {
  return `mastra:durable-agent-execution:v1:${JSON.stringify([agentId, runId])}`;
}

/**
 * Resolve the lease backend behind a pubsub. `CachingPubSub` exposes its
 * inner's capability through `getLeaseProvider()`; backends without leasing
 * fall back to the always-win {@link NoopLeaseProvider}.
 */
export function resolveLeaseProvider(pubsub: PubSub | undefined): LeaseProvider {
  if (!pubsub) return NoopLeaseProvider;
  const unwrap = (pubsub as { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
  if (typeof unwrap === 'function') return unwrap.call(pubsub) ?? NoopLeaseProvider;
  return isLeaseProvider(pubsub) ? pubsub : NoopLeaseProvider;
}

/** Whether a store implements run fencing. Tolerates stores built against an older contract. */
export function supportsRunFencing(store: WorkflowsStorage | MemoryStorage | undefined): boolean {
  return typeof store?.supportsRunFencing === 'function' && store.supportsRunFencing();
}

/** The claim an execution holds on a run, as carried on its RequestContext. */
export interface DurableExecutionClaim {
  executionId: string;
  /** Storage claim generation. Absent when ownership is a pubsub lease. */
  generation?: number;
  /** Whether the memory store was raised to this claim's generation. */
  memoryFenced?: boolean;
}

export function getExecutionClaim(
  requestContext: RequestContext | undefined,
  runId: string,
): DurableExecutionClaim | undefined {
  const executions = requestContext?.getRaw?.(MASTRA_DURABLE_EXECUTIONS_KEY);
  if (!executions || typeof executions !== 'object') return undefined;
  const claim = (executions as Record<string, unknown>)[runId];
  if (!claim || typeof claim !== 'object') return undefined;
  const { executionId, generation, memoryFenced } = claim as Partial<DurableExecutionClaim>;
  if (typeof executionId !== 'string') return undefined;
  return {
    executionId,
    ...(typeof generation === 'number' ? { generation } : {}),
    ...(memoryFenced === true ? { memoryFenced } : {}),
  };
}

export function setExecutionClaim(requestContext: RequestContext, runId: string, claim: DurableExecutionClaim): void {
  const current = requestContext.getRaw(MASTRA_DURABLE_EXECUTIONS_KEY);
  requestContext.setRaw(MASTRA_DURABLE_EXECUTIONS_KEY, {
    ...(current && typeof current === 'object' ? current : {}),
    [runId]: { ...claim },
  });
}

/**
 * The storage fence for writes `runId` makes to `domain`, or `undefined` when
 * that domain's writes are not fenced for this run.
 */
export function getRunFence(
  requestContext: RequestContext | undefined,
  runId: string,
  domain: 'workflows' | 'memory',
): RunFence | undefined {
  const claim = getExecutionClaim(requestContext, runId);
  if (claim?.generation === undefined) return undefined;
  if (domain === 'memory' && !claim.memoryFenced) return undefined;
  return { runId, generation: claim.generation, ownerId: claim.executionId };
}

/** Run `operation`, retrying a backend error once before treating ownership as unverified. */
async function retryOnce<T>(operation: () => Promise<T>, details: ExecutionDetails): Promise<T> {
  try {
    return await operation();
  } catch {
    await sleep(VERIFY_RETRY_DELAY_MS);
    try {
      return await operation();
    } catch (cause) {
      throw new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, details, cause);
    }
  }
}

type ClaimAttempt = { claimed: boolean; generation?: number; holder?: string };

/** Where a run's ownership lives. One instance per run. */
interface OwnershipBackend {
  /** Whether a claim lapses unless renewed. */
  readonly expires: boolean;
  /** How many times a takeover may retry after the holder changed under it. */
  readonly takeoverAttempts: number;
  tryAcquire(executionId: string): Promise<ClaimAttempt>;
  tryTakeover(executionId: string): Promise<ClaimAttempt>;
  /** Throws a {@link DurableExecutionFenceError} unless `claim` still owns the run. */
  verify(claim: DurableExecutionClaim, details: ExecutionDetails): Promise<void>;
  /** Extend `claim`. `false` once another execution owns the run; throws on backend errors. */
  renew(claim: DurableExecutionClaim): Promise<boolean>;
  /** Whether another execution claimed the run after `claim`. Throws on backend errors. */
  isSuperseded(claim: DurableExecutionClaim): Promise<boolean>;
  release(claim: DurableExecutionClaim): Promise<void>;
}

function leaseBackend(provider: LeaseProvider, agentId: string, runId: string): OwnershipBackend {
  const key = executionLeaseKey(agentId, runId);
  return {
    expires: provider !== NoopLeaseProvider,
    // The holder may release between the read and the transfer; retrying acquires it.
    takeoverAttempts: TAKEOVER_ATTEMPTS,
    async tryAcquire(executionId) {
      const result = await provider.acquireLease(key, executionId, EXECUTION_LEASE_TTL_MS);
      return { claimed: result.acquired, holder: result.owner };
    },
    async tryTakeover(executionId) {
      const holder = await provider.getLeaseOwner(key);
      const claimed = holder
        ? await provider.transferLease(key, holder, executionId, EXECUTION_LEASE_TTL_MS)
        : (await provider.acquireLease(key, executionId, EXECUTION_LEASE_TTL_MS)).acquired;
      return { claimed, holder };
    },
    async verify(claim, details) {
      const renewed = await retryOnce(
        () => provider.renewLease(key, claim.executionId, EXECUTION_LEASE_TTL_MS),
        details,
      );
      if (!renewed) throw new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, details);
    },
    renew: claim => provider.renewLease(key, claim.executionId, EXECUTION_LEASE_TTL_MS),
    async isSuperseded(claim) {
      const owner = await provider.getLeaseOwner(key);
      return owner !== undefined && owner !== claim.executionId;
    },
    async release(claim) {
      await provider.releaseLease(key, claim.executionId);
    },
  };
}

function storageBackend(store: WorkflowsStorage, runId: string): OwnershipBackend {
  const fence = (claim: DurableExecutionClaim): RunFence => ({
    runId,
    generation: claim.generation!,
    ownerId: claim.executionId,
  });
  const attempt = ({ acquired, record }: Awaited<ReturnType<WorkflowsStorage['claimRunOwnership']>>) => ({
    claimed: acquired,
    generation: acquired ? record.generation : undefined,
    holder: record?.ownerId ?? undefined,
  });
  return {
    expires: true,
    // A release keeps the generation, so a pinned claim only misses when another
    // execution claimed the run in between. That claimant wins; don't supersede it.
    takeoverAttempts: 1,
    async tryAcquire(executionId) {
      return attempt(await store.claimRunOwnership({ runId, ownerId: executionId, leaseMs: EXECUTION_LEASE_TTL_MS }));
    },
    async tryTakeover(executionId) {
      const current = await store.getRunOwnership({ runId });
      return attempt(
        await store.claimRunOwnership({
          runId,
          ownerId: executionId,
          leaseMs: EXECUTION_LEASE_TTL_MS,
          force: true,
          expectedGeneration: current?.generation ?? 0,
        }),
      );
    },
    // A read, not a renewal: the heartbeat extends the claim, and the fence on
    // every write rejects a claim that was superseded after this check. Like a
    // renewal, it fails once the claim was released: storage still accepts the
    // released claim's late writes, but the execution no longer drives the run.
    async verify(claim, details) {
      const record = await retryOnce(() => store.getRunOwnership({ runId }), details);
      if (!record?.leaseExpiresAt || !matchesRunFence(record, fence(claim))) {
        throw new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, details);
      }
    },
    async renew(claim) {
      return (await store.renewRunOwnership({ ...fence(claim), leaseMs: EXECUTION_LEASE_TTL_MS })).renewed;
    },
    // Release keeps the record, so a missing one means the store lost it:
    // the holder is unknown.
    async isSuperseded(claim) {
      const record = await store.getRunOwnership({ runId });
      return !record || record.generation !== claim.generation;
    },
    async release(claim) {
      await store.releaseRunOwnership(fence(claim));
    },
  };
}

export type ExecutionSettlement = 'owned' | 'orphaned' | 'superseded';

const fencesByExecutionId = new Map<string, ExecutionFence>();
const activeFenceByRunId = new Map<string, ExecutionFence>();

/**
 * One execution's claim on a durable run. Inside {@link ExecutionFence.run},
 * it is the {@link RunFenceScope} that fences every write the execution makes
 * to the run's workflows and memory stores.
 */
export class ExecutionFence implements RunFenceScope {
  readonly executionId: string;
  readonly agentId: string;
  readonly runId: string;
  /** Storage claim generation. Absent when ownership is a pubsub lease. */
  readonly generation?: number;
  readonly #backend: OwnershipBackend;
  readonly #logger?: IMastraLogger;
  /** The workflows store holding the claim, when ownership lives in storage. */
  readonly #workflowsStore?: WorkflowsStorage;
  #memoryStore?: MemoryStorage;
  /**
   * Whether {@link fenceFor} hands out the fence. An owned settlement disarms
   * it so the execution's late background writes stay unfenced, as before
   * fencing existed. A lost execution stays armed: its late writes are rejected.
   */
  #armed = true;
  #lossListeners: Array<(error: DurableExecutionFenceError) => void> = [];
  #lossError?: DurableExecutionFenceError;
  /** Another execution was seen claiming the run after this one lost it. */
  #takenOver = false;
  #leaseExpiresAt: number;
  #heartbeat?: ReturnType<typeof setInterval>;
  #renewalInFlight = false;
  #settlement?: Promise<ExecutionSettlement>;
  #settledAs?: ExecutionSettlement;
  #resolveSettled!: () => void;
  /** Resolves once {@link settle} has finished and the claim is released or left to its new holder. */
  readonly whenSettled: Promise<void>;

  private constructor(args: {
    backend: OwnershipBackend;
    workflowsStore?: WorkflowsStorage;
    agentId: string;
    runId: string;
    executionId: string;
    generation?: number;
    leaseExpiresAt: number;
    logger?: IMastraLogger;
  }) {
    this.#backend = args.backend;
    this.#workflowsStore = args.workflowsStore;
    this.agentId = args.agentId;
    this.runId = args.runId;
    this.executionId = args.executionId;
    this.generation = args.generation;
    this.#leaseExpiresAt = args.leaseExpiresAt;
    this.#logger = args.logger;
    this.whenSettled = new Promise(resolve => {
      this.#resolveSettled = resolve;
    });
  }

  /**
   * Claim the run.
   *
   * - `acquire` (stream/generate/resume) fails with
   *   `DURABLE_AGENT_EXECUTION_CONFLICT` while another execution holds it.
   * - `takeover` (recover) moves the claim from its current holder to this
   *   execution immediately, superseding it.
   *
   * Ownership lives in `workflowsStore` when it supports run fencing, and in
   * `leaseProvider` otherwise.
   */
  static async claim(args: {
    leaseProvider: LeaseProvider;
    workflowsStore?: WorkflowsStorage;
    agentId: string;
    runId: string;
    mode: 'acquire' | 'takeover';
    logger?: IMastraLogger;
  }): Promise<ExecutionFence> {
    const { agentId, runId, mode } = args;
    const workflowsStore = supportsRunFencing(args.workflowsStore) ? args.workflowsStore : undefined;
    const backend = workflowsStore
      ? storageBackend(workflowsStore, runId)
      : leaseBackend(args.leaseProvider, agentId, runId);
    const executionId = crypto.randomUUID();

    let attempt: ClaimAttempt = { claimed: false };
    let attemptStartedAt = Date.now();
    if (mode === 'acquire') {
      // The previous execution of this run may still be settling after its
      // caller already saw it suspend or finish (the evented engine resolves
      // before its background settle; another process releases a moment
      // after publishing). Give it a short grace period before conflicting.
      const deadline = Date.now() + EXECUTION_CLAIM_WAIT_MS;
      for (;;) {
        attemptStartedAt = Date.now();
        attempt = await backend.tryAcquire(executionId);
        if (attempt.claimed || Date.now() >= deadline) break;
        const local = activeFenceByRunId.get(runId);
        const wait = Math.min(CLAIM_POLL_INTERVAL_MS, deadline - Date.now());
        await (local ? Promise.race([local.whenSettled, sleep(wait)]) : sleep(wait));
      }
    } else {
      for (let tries = 0; tries < backend.takeoverAttempts && !attempt.claimed; tries++) {
        attemptStartedAt = Date.now();
        attempt = await backend.tryTakeover(executionId);
      }
    }

    if (!attempt.claimed) {
      throw new MastraError({
        id: EXECUTION_CONFLICT_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          mode === 'acquire'
            ? `Durable run ${runId} is already being executed. Wait for it to finish, or call recover(runId) to take it over.`
            : `Durable run ${runId}: another execution claimed it while this one was taking it over.`,
        details: { agentId, runId, ...(attempt.holder ? { holder: attempt.holder } : {}) },
      });
    }

    const fence = new ExecutionFence({
      backend,
      workflowsStore,
      agentId,
      runId,
      executionId,
      generation: attempt.generation,
      leaseExpiresAt: attemptStartedAt + EXECUTION_LEASE_TTL_MS,
      logger: args.logger,
    });
    fencesByExecutionId.set(executionId, fence);
    activeFenceByRunId.set(runId, fence);
    if (backend.expires) fence.#startHeartbeat();
    return fence;
  }

  /**
   * The unsettled execution this process is running for `runId`, if any.
   */
  static getLocalActive(runId: string): ExecutionFence | undefined {
    return activeFenceByRunId.get(runId);
  }

  /** The claim to carry on the run's RequestContext. */
  get claim(): DurableExecutionClaim {
    return {
      executionId: this.executionId,
      ...(this.generation !== undefined ? { generation: this.generation } : {}),
      ...(this.#memoryStore ? { memoryFenced: true } : {}),
    };
  }

  isLost(): boolean {
    return this.#lossError !== undefined;
  }

  /**
   * Call `listener` once when this execution loses the run: a check or
   * renewal failed, or storage rejected one of its writes. Called right away
   * when the run is already lost.
   */
  onLost(listener: (error: DurableExecutionFenceError) => void): void {
    if (this.#lossError) listener(this.#lossError);
    else this.#lossListeners.push(listener);
  }

  /**
   * Run `fn` with this fence carried by every write it makes to the run's
   * workflows and memory stores, including writes from processors, tools and
   * memory that never see the fence.
   */
  run<T>(fn: () => T): T {
    return runInRunFenceScope(this, fn);
  }

  /** {@link RunFenceScope.fenceFor}: covers this run's workflows rows and the memory store raised to the claim. */
  fenceFor(store: object, runId?: string): RunFence | undefined {
    if (!this.#armed || this.generation === undefined) return undefined;
    const covered = store === this.#workflowsStore ? runId === this.runId : store === this.#memoryStore;
    return covered ? { runId: this.runId, generation: this.generation, ownerId: this.executionId } : undefined;
  }

  /**
   * {@link RunFenceScope.onConflict}: storage rejected one of this execution's
   * writes, even if the writer swallowed the error. Settlement still asks the
   * workflows record whether another execution took the run.
   */
  onConflict(fence: RunFence): void {
    if (fence.runId !== this.runId || fence.generation !== this.generation || fence.ownerId !== this.executionId) {
      return;
    }
    this.#markLost(new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, this.#details()));
  }

  /**
   * Raise the run's memory store to this claim's generation, so memory writes
   * carrying the claim are rejected once a newer claim raises it further.
   * Call before the execution writes to memory. A no-op for lease-backed
   * claims and for memory stores without run fencing.
   */
  async coverMemory(store: MemoryStorage | undefined): Promise<void> {
    if (this.generation === undefined || !supportsRunFencing(store)) return;
    if (this.#lossError) throw this.#lossError;
    const fence: RunFence = { runId: this.runId, generation: this.generation, ownerId: this.executionId };
    const raised = await retryOnce(() => store!.raiseRunFence(fence), this.#details());
    if (!raised) {
      // A newer claim already raised memory past this one. Settlement checks
      // the workflows record to tell a takeover from diverged stores.
      const error = new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, this.#details());
      this.#markLost(error);
      throw error;
    }
    this.#memoryStore = store;
  }

  /**
   * Prove this execution still owns the run before a write. Throws a
   * {@link DurableExecutionFenceError} once ownership is lost; a lost fence
   * never recovers.
   */
  async verify(): Promise<void> {
    if (this.#lossError) throw this.#lossError;
    const startedAt = Date.now();
    try {
      await this.#backend.verify(this.claim, this.#details());
    } catch (error) {
      this.#markLost(error as DurableExecutionFenceError);
      if ((error as DurableExecutionFenceError).id === EXECUTION_SUPERSEDED_ERROR_ID) await this.#noteTakeover();
      throw error;
    }
    // A lease backend renews on verify; a storage read leaves expiry to the heartbeat.
    if (this.generation === undefined) this.#leaseExpiresAt = startedAt + EXECUTION_LEASE_TTL_MS;
  }

  stopHeartbeat(): void {
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = undefined;
  }

  /**
   * End this execution exactly once and release the claim unless another
   * execution holds it. `whileOwned` (the terminal writes) runs only when the
   * execution still owns the run. Later calls resolve to the first settlement
   * without running their `whileOwned`.
   *
   * Release keeps the owner record, so a write the execution makes after
   * settling is still rejected once a newer claim exists. An owned execution
   * stops fencing its writes after settling, leaving late background work to
   * land as it did before fencing.
   *
   * - `owned`: ownership verified; `whileOwned` ran.
   * - `orphaned`: ownership could not be verified, but nobody else claimed
   *   the run, so the failure can still be reported to this execution's caller.
   * - `superseded`: another execution holds the run (or its holder is
   *   unknown); nothing may be written on its topic or rows.
   */
  settle(whileOwned: () => Promise<void>): Promise<ExecutionSettlement> {
    if (this.#settlement) return this.#settlement.catch(() => this.#settledAs!);
    this.#settlement = this.#settle(whileOwned);
    return this.#settlement;
  }

  async #settle(whileOwned: () => Promise<void>): Promise<ExecutionSettlement> {
    this.stopHeartbeat();
    this.#settledAs = await this.#classifySettlement();
    try {
      if (this.#settledAs === 'owned') await this.run(whileOwned);
    } finally {
      if (this.#settledAs !== 'superseded') await this.#release();
      if (this.#settledAs === 'owned') this.#armed = false;
      if (fencesByExecutionId.get(this.executionId) === this) fencesByExecutionId.delete(this.executionId);
      if (activeFenceByRunId.get(this.runId) === this) activeFenceByRunId.delete(this.runId);
      this.#resolveSettled();
    }
    return this.#settledAs;
  }

  async #release(): Promise<void> {
    try {
      await this.#backend.release(this.claim);
    } catch (error) {
      this.#logger?.warn?.(`[DurableAgent] run ${this.runId}: failed to release the execution claim: ${error}`);
    }
  }

  async #classifySettlement(): Promise<ExecutionSettlement> {
    try {
      await this.verify();
      return 'owned';
    } catch {
      // Fall through: find out whether someone else took the run.
    }
    // The new owner may already have finished and released the run; a
    // takeover seen earlier still means this execution must stay silent.
    if (this.#takenOver) return 'superseded';
    try {
      return (await this.#backend.isSuperseded(this.claim)) ? 'superseded' : 'orphaned';
    } catch {
      return 'superseded';
    }
  }

  #details(): ExecutionDetails {
    return { agentId: this.agentId, runId: this.runId, executionId: this.executionId };
  }

  #markLost(error: DurableExecutionFenceError): void {
    if (this.#lossError) return;
    this.#lossError = error;
    this.stopHeartbeat();
    this.#logger?.warn?.(`[DurableAgent] run ${this.runId}: ${error.message}`);
    const listeners = this.#lossListeners;
    this.#lossListeners = [];
    for (const listener of listeners) {
      try {
        listener(error);
      } catch (listenerError) {
        this.#logger?.warn?.(`[DurableAgent] run ${this.runId}: loss listener failed: ${listenerError}`);
      }
    }
  }

  async #noteTakeover(): Promise<void> {
    try {
      if (await this.#backend.isSuperseded(this.claim)) this.#takenOver = true;
    } catch {
      // Unknown holder: settlement asks again.
    }
  }

  /**
   * Keep the claim alive between write checks. A `false` renewal marks the
   * fence lost, which notifies {@link onLost} listeners. Backend errors are
   * tolerated until the local lease deadline.
   */
  #startHeartbeat(): void {
    this.#heartbeat = setInterval(() => {
      if (this.#settlement || this.#lossError) return;
      if (Date.now() >= this.#leaseExpiresAt) {
        this.#markLost(new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, this.#details()));
        return;
      }
      if (this.#renewalInFlight) return;
      this.#renewalInFlight = true;
      const startedAt = Date.now();
      void this.#backend
        .renew(this.claim)
        .then(renewed => {
          if (renewed) {
            this.#leaseExpiresAt = startedAt + EXECUTION_LEASE_TTL_MS;
            return;
          }
          this.#markLost(new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, this.#details()));
          return this.#noteTakeover();
        })
        .catch(cause => {
          if (Date.now() >= this.#leaseExpiresAt) {
            this.#markLost(new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, this.#details(), cause));
            return;
          }
          this.#logger?.warn?.(`[DurableAgent] run ${this.runId}: execution lease renewal failed, retrying: ${cause}`);
        })
        .finally(() => {
          this.#renewalInFlight = false;
        });
    }, EXECUTION_LEASE_RENEW_INTERVAL_MS);
    this.#heartbeat.unref?.();
  }
}

/**
 * `pubsub` as seen by the execution holding `fence`. Once the execution
 * loses the run, its publishes are dropped: the run's topics are shared with
 * the new owner's consumers. Every call runs outside the run's fence scope,
 * so connections and subscriptions opened lazily here never carry the run's
 * fence into deliveries for other runs.
 */
export function fencePubSub(pubsub: PubSub, fence: ExecutionFence): PubSub {
  return new Proxy(pubsub, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (property === 'publish') {
        return (...args: unknown[]) =>
          fence.isLost() ? Promise.resolve() : runOutsideRunFenceScope(() => value.apply(target, args));
      }
      return (...args: unknown[]) => runOutsideRunFenceScope(() => value.apply(target, args));
    },
  });
}

/**
 * Test-only: forget every local execution, as a process restart would.
 * Executions still running keep their fence objects but no longer count as
 * local, so `recover()` in the same process treats their runs as orphaned.
 */
export function __resetExecutionFencesForTests(): void {
  for (const fence of fencesByExecutionId.values()) fence.stopHeartbeat();
  fencesByExecutionId.clear();
  activeFenceByRunId.clear();
}

/**
 * Resolve where a remote worker checks the driver's claim: the shared
 * workflows store for a storage claim, otherwise the lease backend of the
 * registered agent's pubsub, falling back to Mastra's.
 */
async function resolveRemoteBackend(
  mastra: Mastra | undefined,
  agentId: string,
  runId: string,
  claim: DurableExecutionClaim,
): Promise<OwnershipBackend | undefined> {
  if (!mastra) return undefined;
  if (claim.generation !== undefined) {
    const store = await mastra.getStorage()?.getStore('workflows');
    return supportsRunFencing(store) ? storageBackend(store!, runId) : undefined;
  }
  let agentPubsub: PubSub | undefined;
  try {
    agentPubsub = (mastra.getAgentById(agentId) as { pubsub?: PubSub } | undefined)?.pubsub;
  } catch {
    agentPubsub = undefined;
  }
  const pubsub = agentPubsub ?? mastra.pubsub;
  return pubsub ? leaseBackend(resolveLeaseProvider(pubsub), agentId, runId) : undefined;
}

/**
 * Assert that the execution recorded in `requestContext` for `runId` still
 * owns the run. No-op for runs without a claim (started by code without
 * fencing). Uses the local fence when this process drives the run; otherwise
 * (a remote evented worker) checks the claim where it lives.
 */
export async function assertExecutionOwned(args: {
  runId: string;
  agentId: string;
  requestContext: RequestContext | undefined;
  mastra: Mastra | undefined;
}): Promise<void> {
  const claim = getExecutionClaim(args.requestContext, args.runId);
  if (!claim) return;

  const local = fencesByExecutionId.get(claim.executionId);
  if (local) return local.verify();

  const backend = await resolveRemoteBackend(args.mastra, args.agentId, args.runId, claim);
  if (!backend) return;
  await backend.verify(claim, { agentId: args.agentId, runId: args.runId, executionId: claim.executionId });
}

type FenceableStep = { execute: (params: any) => Promise<any> };

/**
 * Check ownership before a step starts (skipping duplicate model, tool, or
 * scorer work after a takeover) and again after it returns. The post-check
 * throws inside `execute`, so the engine records the step as failed instead
 * of persisting a `running` snapshot over the new owner's state.
 */
export function withExecutionFence<TStep extends FenceableStep>(step: TStep): TStep {
  const execute = step.execute;
  return {
    ...step,
    execute: async (params: any) => {
      // The iteration workflow's init data carries the durable run's ids;
      // `params.runId` belongs to the nested workflow run and may differ.
      const initData = params.getInitData?.() as { runId?: string; agentId?: string } | undefined;
      const runId = initData?.runId;
      const agentId = initData?.agentId;
      const assertOwned = () =>
        runId && agentId
          ? assertExecutionOwned({ runId, agentId, requestContext: params.requestContext, mastra: params.mastra })
          : Promise.resolve();
      await assertOwned();
      const output = await execute(params);
      await assertOwned();
      return output;
    },
  };
}

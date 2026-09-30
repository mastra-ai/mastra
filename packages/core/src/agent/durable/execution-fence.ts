/**
 * Execution fence for DurableAgent runs (#23734).
 *
 * Every execution that drives a durable run (`stream()`, `generate()`,
 * `resume()`, `recover()`) claims a per-run lease under a fresh execution id.
 * `recover()` takes the lease over immediately, so a still-running original
 * execution is superseded without waiting for a TTL. Every write the original
 * can still make (step boundaries, the finalize memory writes, snapshot
 * deletion, terminal error emission) verifies the lease first and fails
 * instead of overwriting the recovered answer.
 *
 * Fencing needs a lease-capable pubsub shared by every process that can drive
 * the run. With `NoopLeaseProvider` every check passes, which preserves the
 * previous single-process behavior.
 *
 * Verification is check-then-write: a window of milliseconds remains between
 * a successful check and the write it guards.
 */
import { ErrorCategory, ErrorDomain, MastraError, MastraNonRetryableError } from '../../error';
import { isLeaseProvider, NoopLeaseProvider } from '../../events/pubsub';
import type { LeaseProvider, PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';

export const EXECUTION_LEASE_TTL_MS = 30_000;
export const EXECUTION_LEASE_RENEW_INTERVAL_MS = 10_000;
const VERIFY_RETRY_DELAY_MS = 250;
const TAKEOVER_ATTEMPTS = 3;
const EXECUTION_CLAIM_WAIT_MS = 5_000;
const CLAIM_POLL_INTERVAL_MS = 100;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, Math.max(0, ms)));

/**
 * Reserved request-context key carrying `Record<runId, executionId>`. Keyed by
 * runId so a delegated durable sub-agent sharing the parent's RequestContext
 * cannot overwrite the parent's execution id.
 */
export const MASTRA_DURABLE_EXECUTIONS_KEY = 'mastra__durableExecutions';

export const EXECUTION_SUPERSEDED_ERROR_ID = 'DURABLE_AGENT_EXECUTION_SUPERSEDED';
export const EXECUTION_UNVERIFIED_ERROR_ID = 'DURABLE_AGENT_EXECUTION_UNVERIFIED';
export const EXECUTION_CONFLICT_ERROR_ID = 'DURABLE_AGENT_EXECUTION_CONFLICT';
export const RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID = 'DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY';

type ExecutionLossErrorId = typeof EXECUTION_SUPERSEDED_ERROR_ID | typeof EXECUTION_UNVERIFIED_ERROR_ID;

/**
 * Thrown when an execution can no longer prove it owns its run. Extends
 * `MastraNonRetryableError` so the workflow engine fails the step instead of
 * retrying it.
 */
export class DurableExecutionFenceError extends MastraNonRetryableError {
  readonly id: ExecutionLossErrorId;
  readonly domain = ErrorDomain.AGENT;
  readonly category = ErrorCategory.SYSTEM;
  readonly details: { agentId: string; runId: string; executionId: string };

  constructor(
    id: ExecutionLossErrorId,
    details: { agentId: string; runId: string; executionId: string },
    cause?: unknown,
  ) {
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
 * lost ownership. Matches on `id` so serialized errors from the evented engine
 * and wrappers such as the nested-workflow `MastraNonRetryableError` match too.
 */
export function isExecutionFenceError(error: unknown): boolean {
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

export function getExecutionId(requestContext: RequestContext | undefined, runId: string): string | undefined {
  const executions = requestContext?.getRaw?.(MASTRA_DURABLE_EXECUTIONS_KEY);
  if (!executions || typeof executions !== 'object') return undefined;
  const executionId = (executions as Record<string, unknown>)[runId];
  return typeof executionId === 'string' ? executionId : undefined;
}

export function setExecutionId(requestContext: RequestContext, runId: string, executionId: string): void {
  const current = requestContext.getRaw(MASTRA_DURABLE_EXECUTIONS_KEY);
  requestContext.setRaw(MASTRA_DURABLE_EXECUTIONS_KEY, {
    ...(current && typeof current === 'object' ? current : {}),
    [runId]: executionId,
  });
}

/**
 * Renew `executionId`'s lease, failing closed: `false` means another execution
 * owns the run (or the lease expired), and a backend error is retried once
 * before the execution is treated as unverified.
 */
async function renewOrThrow(
  provider: LeaseProvider,
  details: { agentId: string; runId: string; executionId: string },
): Promise<void> {
  const key = executionLeaseKey(details.agentId, details.runId);
  let renewed: boolean;
  try {
    renewed = await provider.renewLease(key, details.executionId, EXECUTION_LEASE_TTL_MS);
  } catch {
    await new Promise(resolve => setTimeout(resolve, VERIFY_RETRY_DELAY_MS));
    try {
      renewed = await provider.renewLease(key, details.executionId, EXECUTION_LEASE_TTL_MS);
    } catch (cause) {
      throw new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, details, cause);
    }
  }
  if (!renewed) throw new DurableExecutionFenceError(EXECUTION_SUPERSEDED_ERROR_ID, details);
}

export type ExecutionSettlement = 'owned' | 'orphaned' | 'superseded';

const fencesByExecutionId = new Map<string, ExecutionFence>();
const activeFenceByRunId = new Map<string, ExecutionFence>();

export class ExecutionFence {
  readonly executionId: string;
  readonly agentId: string;
  readonly runId: string;
  readonly #provider: LeaseProvider;
  readonly #key: string;
  readonly #logger?: IMastraLogger;
  #lossError?: DurableExecutionFenceError;
  /** Another execution was seen holding the lease after this one lost it. */
  #takenOver = false;
  #leaseExpiresAt: number;
  #heartbeat?: ReturnType<typeof setInterval>;
  #renewalInFlight = false;
  #settlement?: Promise<ExecutionSettlement>;
  #settledAs?: ExecutionSettlement;
  #resolveSettled!: () => void;
  /** Resolves once {@link settle} has finished and the lease is released or left to its new holder. */
  readonly whenSettled: Promise<void>;

  private constructor(args: {
    provider: LeaseProvider;
    agentId: string;
    runId: string;
    executionId: string;
    leaseExpiresAt: number;
    logger?: IMastraLogger;
  }) {
    this.#provider = args.provider;
    this.agentId = args.agentId;
    this.runId = args.runId;
    this.executionId = args.executionId;
    this.#key = executionLeaseKey(args.agentId, args.runId);
    this.#leaseExpiresAt = args.leaseExpiresAt;
    this.#logger = args.logger;
    this.whenSettled = new Promise(resolve => {
      this.#resolveSettled = resolve;
    });
  }

  /**
   * Claim the run's execution lease.
   *
   * - `acquire` (stream/generate/resume) fails with
   *   `DURABLE_AGENT_EXECUTION_CONFLICT` while another execution holds it.
   * - `takeover` (recover) moves the lease from its current holder to this
   *   execution immediately, superseding it.
   */
  static async claim(args: {
    leaseProvider: LeaseProvider;
    agentId: string;
    runId: string;
    mode: 'acquire' | 'takeover';
    logger?: IMastraLogger;
  }): Promise<ExecutionFence> {
    const { leaseProvider: provider, agentId, runId, mode } = args;
    const key = executionLeaseKey(agentId, runId);
    const executionId = crypto.randomUUID();

    let claimed = false;
    let holder: string | undefined;
    let attemptStartedAt = Date.now();
    if (mode === 'acquire') {
      // The previous execution of this run may still be settling after its
      // caller already saw it suspend or finish (the evented engine resolves
      // before its background settle; another process releases a moment
      // after publishing). Give it a short grace period before conflicting.
      const deadline = Date.now() + EXECUTION_CLAIM_WAIT_MS;
      for (;;) {
        attemptStartedAt = Date.now();
        const result = await provider.acquireLease(key, executionId, EXECUTION_LEASE_TTL_MS);
        claimed = result.acquired;
        holder = result.owner;
        if (claimed || Date.now() >= deadline) break;
        const local = activeFenceByRunId.get(runId);
        const wait = Math.min(CLAIM_POLL_INTERVAL_MS, deadline - Date.now());
        await (local ? Promise.race([local.whenSettled, sleep(wait)]) : sleep(wait));
      }
    } else {
      for (let attempt = 0; attempt < TAKEOVER_ATTEMPTS && !claimed; attempt++) {
        attemptStartedAt = Date.now();
        holder = await provider.getLeaseOwner(key);
        claimed = holder
          ? await provider.transferLease(key, holder, executionId, EXECUTION_LEASE_TTL_MS)
          : (await provider.acquireLease(key, executionId, EXECUTION_LEASE_TTL_MS)).acquired;
      }
    }

    if (!claimed) {
      throw new MastraError({
        id: EXECUTION_CONFLICT_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          mode === 'acquire'
            ? `Durable run ${runId} is already being executed. Wait for it to finish, or call recover(runId) to take it over.`
            : `Durable run ${runId}: could not take over the execution lease from its current holder.`,
        details: { agentId, runId, ...(holder ? { holder } : {}) },
      });
    }

    const fence = new ExecutionFence({
      provider,
      agentId,
      runId,
      executionId,
      leaseExpiresAt: attemptStartedAt + EXECUTION_LEASE_TTL_MS,
      logger: args.logger,
    });
    fencesByExecutionId.set(executionId, fence);
    activeFenceByRunId.set(runId, fence);
    if (provider !== NoopLeaseProvider) fence.#startHeartbeat();
    return fence;
  }

  /**
   * The unsettled execution this process is running for `runId`, if any.
   */
  static getLocalActive(runId: string): ExecutionFence | undefined {
    return activeFenceByRunId.get(runId);
  }

  isLost(): boolean {
    return this.#lossError !== undefined;
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
      await renewOrThrow(this.#provider, this.#details());
    } catch (error) {
      this.#markLost(error as DurableExecutionFenceError);
      if ((error as DurableExecutionFenceError).id === EXECUTION_SUPERSEDED_ERROR_ID) await this.#noteTakeover();
      throw error;
    }
    this.#leaseExpiresAt = startedAt + EXECUTION_LEASE_TTL_MS;
  }

  /** Read the lease's current holder; `undefined` when nobody holds it. */
  currentOwner(): Promise<string | undefined> {
    return this.#provider.getLeaseOwner(this.#key);
  }

  stopHeartbeat(): void {
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = undefined;
  }

  /**
   * End this execution exactly once and release the lease unless another
   * execution holds it. `whileOwned` (the terminal writes) runs only when the
   * execution still owns the run. Later calls resolve to the first settlement
   * without running their `whileOwned`.
   *
   * - `owned`: ownership verified; `whileOwned` ran.
   * - `orphaned`: ownership could not be verified, but nobody else holds the
   *   lease, so the failure can still be reported to this execution's caller.
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
      if (this.#settledAs === 'owned') await whileOwned();
    } finally {
      if (this.#settledAs !== 'superseded') {
        try {
          await this.#provider.releaseLease(this.#key, this.executionId);
        } catch (error) {
          this.#logger?.warn?.(`[DurableAgent] run ${this.runId}: failed to release the execution lease: ${error}`);
        }
      }
      if (fencesByExecutionId.get(this.executionId) === this) fencesByExecutionId.delete(this.executionId);
      if (activeFenceByRunId.get(this.runId) === this) activeFenceByRunId.delete(this.runId);
      this.#resolveSettled();
    }
    return this.#settledAs;
  }

  async #classifySettlement(): Promise<ExecutionSettlement> {
    try {
      await this.verify();
      return 'owned';
    } catch {
      // Fall through: find out whether someone else took the run.
    }
    // The new owner may already have finished and released the lease; a
    // takeover seen earlier still means this execution must stay silent.
    if (this.#takenOver) return 'superseded';
    try {
      const owner = await this.currentOwner();
      return owner === undefined || owner === this.executionId ? 'orphaned' : 'superseded';
    } catch {
      return 'superseded';
    }
  }

  #details() {
    return { agentId: this.agentId, runId: this.runId, executionId: this.executionId };
  }

  #markLost(error: DurableExecutionFenceError): void {
    if (this.#lossError) return;
    this.#lossError = error;
    this.stopHeartbeat();
    this.#logger?.warn?.(`[DurableAgent] run ${this.runId}: ${error.message}`);
  }

  async #noteTakeover(): Promise<void> {
    try {
      const owner = await this.currentOwner();
      if (owner !== undefined && owner !== this.executionId) this.#takenOver = true;
    } catch {
      // Unknown holder: settlement asks again.
    }
  }

  /**
   * Keep the lease alive between write checks. A `false` renewal marks the
   * fence lost without aborting the run: aborting would publish on the run's
   * shared topic, which the new owner's consumers read. The next check
   * surfaces the loss instead. Backend errors are tolerated until the local
   * lease deadline.
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
      void this.#provider
        .renewLease(this.#key, this.executionId, EXECUTION_LEASE_TTL_MS)
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
 * Resolve the lease backend a remote worker shares with the driver: the
 * registered agent's pubsub, falling back to Mastra's.
 */
function resolveRemoteLeaseProvider(mastra: Mastra | undefined, agentId: string): LeaseProvider | undefined {
  if (!mastra) return undefined;
  let agentPubsub: PubSub | undefined;
  try {
    agentPubsub = (mastra.getAgentById(agentId) as { pubsub?: PubSub } | undefined)?.pubsub;
  } catch {
    agentPubsub = undefined;
  }
  const pubsub = agentPubsub ?? mastra.pubsub;
  return pubsub ? resolveLeaseProvider(pubsub) : undefined;
}

/**
 * Assert that the execution recorded in `requestContext` for `runId` still
 * owns the run. No-op for runs without an execution id (started by code
 * without fencing). Uses the local fence when this process drives the run;
 * otherwise (a remote evented worker) renews the lease on the owner's behalf,
 * which only succeeds while that execution still holds it.
 */
export async function assertExecutionOwned(args: {
  runId: string;
  agentId: string;
  requestContext: RequestContext | undefined;
  mastra: Mastra | undefined;
}): Promise<void> {
  const executionId = getExecutionId(args.requestContext, args.runId);
  if (!executionId) return;

  const local = fencesByExecutionId.get(executionId);
  if (local) return local.verify();

  const provider = resolveRemoteLeaseProvider(args.mastra, args.agentId);
  if (!provider) return;
  await renewOrThrow(provider, { agentId: args.agentId, runId: args.runId, executionId });
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

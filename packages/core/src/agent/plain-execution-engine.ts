import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { IMastraLogger } from '../logger';
import { AGENTIC_LOOP_WORKFLOW_ID } from '../loop/loop-builder';
import type { AgentLoopResumeClaim } from '../loop/types';
import type { Mastra } from '../mastra';
import { mastraCtorHolder } from '../mastra/mastra-ctor-holder';
import { InMemoryStore } from '../storage';
import type { WorkflowsStorage } from '../storage';
import type { RunFence } from '../storage/run-fencing';
import { matchesRunFence } from '../storage/run-fencing';
import type { WorkflowRunState, WorkflowRunStatus } from '../workflows/types';
import { waitForSuspendedSnapshot } from '../workflows/utils';
import { AgentExecutionEngine } from './execution-engine';
import type { AgentRunLog, AgentRunOwner, SuspendedRequestContextLookup } from './execution-engine';
import type { AgentStreamBus } from './streams/bus';
import type { AgentStreamPublisher } from './streams/publisher';
import { createAgentStreamPublisher } from './streams/publisher';
import type { AgentRunRecord } from './streams/run-records';
import { readAgentRunRecord } from './streams/run-records';
import { agentThreadStreamRuntime } from './thread-stream-runtime';

/**
 * Agentic-loop runs currently being resumed in this process, for stores that
 * cannot claim a run atomically. Keyed by runId.
 */
const inFlightUnclaimedResumes = new Set<string>();

/**
 * How long a resume claim may go without a sign of life before a later resume treats it as
 * abandoned by a process that died, and takes the suspension over: a `pending` claim (claimed but
 * not started) since it was claimed, a `running` claim (on stores with run fencing) since its
 * lease was last renewed.
 */
export const AGENT_RESUME_CLAIM_STALE_MS = 60_000;

/** How often a running resume renews its claim lease. Several renewals fit in one stale window. */
const AGENT_RESUME_CLAIM_RENEW_MS = AGENT_RESUME_CLAIM_STALE_MS / 4;

function runIdAlreadyClaimedError({ agentName, runId }: { agentName: string; runId: string }): MastraError {
  return new MastraError({
    id: 'AGENT_RUN_ID_ALREADY_CLAIMED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${agentName}" cannot start a run with id "${runId}" because another run already owns it.`,
    details: { agentName, runId },
  });
}

function alreadyClaimedResumeError({
  agentName,
  method,
  runId,
  toolCallId,
}: {
  agentName: string;
  method: string;
  runId: string;
  toolCallId?: string;
}): MastraError {
  return new MastraError({
    id: 'AGENT_RESUME_ALREADY_CLAIMED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${agentName}" ${method}() cannot resume run "${runId}" because another resume of it already claimed it.`,
    details: { agentName, method, runId, ...(toolCallId !== undefined ? { toolCallId } : {}) },
  });
}

/** Runs an agent in this process, with no checkpointed workflow engine behind it. */
export class PlainAgentExecutionEngine extends AgentExecutionEngine {
  #publishedRuns = new Map<string, { publisher: AgentStreamPublisher; resourceId?: string; threadId?: string }>();

  get durable(): false {
    return false;
  }

  /** Plain runs publish their own frames from the process that runs them. */
  usesSharedRunLog(): false {
    return false;
  }

  /** Plain runs execute where their stream is, so aborting the stream stops them. */
  get abortsRemoteExecutors(): false {
    return false;
  }

  /** Plain runs hold no execution controller apart from their stream. */
  abortLocalExecution(): false {
    return false;
  }

  confirmsLocalAbort(): false {
    return false;
  }

  getRunOwner(runId: string): AgentRunOwner | undefined {
    return this.getPublishedRunOwner(runId);
  }

  /** Plain runs keep no replay history beyond their run record. */
  async getReplayOwner(): Promise<undefined> {
    return undefined;
  }

  /** A run published from this process reads as running; others come from the run record cache. */
  async getRunRecord(agentId: string, runId: string, { bus }: AgentRunLog): Promise<AgentRunRecord | undefined> {
    const local = this.#publishedRuns.get(runId);
    if (local) {
      const { resourceId, threadId } = local;
      return { agentId, runId, resourceId, threadId, status: 'running', updatedAt: Date.now() };
    }
    if (!bus) return undefined;
    return readAgentRunRecord(bus.runRecordCache, agentId, runId);
  }

  /**
   * A published run's id identifies exactly one run: its stream topic and its
   * ownership record are both keyed by it. A caller-supplied `runId` is only a
   * claim, so this refuses one that another run already holds — otherwise a
   * second caller would take over that run's topic and record, and be treated
   * as its owner by `observe()` and the server's run routes.
   *
   * A `running` record means another process is executing that run and listening
   * for its abort requests, so it is refused even to the same owner: two
   * publishers on one topic would cross their chunks and abort requests. A
   * `suspended` or `finished` record keeps the id until it expires, so the same
   * owner can still reuse it (a resume, or a retry after the run finished).
   * Runs without a resourceId own nothing to protect.
   *
   * A resume is the one caller that may continue a `running` record, because it
   * already validated and claimed the suspended run (`resumeContext.claim`).
   * The record can still say `running` there: the suspension is written to the
   * record after the snapshot, so a slow snapshot write leaves the previous
   * `running` record in place for the whole resume handoff.
   *
   * Reading the record and writing our own is not atomic, so two processes
   * starting the same id within one cache round-trip of each other can still
   * overlap. The cache has no compare-and-set to close that.
   *
   * Returns the record it accepted, so the caller can tell a fresh id from a
   * reused one.
   */
  async assertRunIdAvailable(
    bus: AgentStreamBus | undefined,
    {
      agentId,
      agentName,
      runId,
      resourceId,
      resuming,
    }: { agentId: string; agentName: string; runId: string; resourceId: string | undefined; resuming: boolean },
  ): Promise<AgentRunRecord | undefined> {
    if (!bus) return undefined;

    // A resume may still find its own finishing publisher here: the suspension is
    // persisted before the publisher ends, so the entry outlives the handoff.
    if (!resuming && this.#publishedRuns.has(runId)) {
      throw runIdAlreadyClaimedError({ agentName, runId });
    }

    const record = await readAgentRunRecord(bus.runRecordCache, agentId, runId);
    if (!record) return undefined;
    if (record.resourceId && record.resourceId !== resourceId) {
      throw runIdAlreadyClaimedError({ agentName, runId });
    }
    if (record.status === 'running' && !resuming) {
      throw runIdAlreadyClaimedError({ agentName, runId });
    }
    return record;
  }

  /** Publishes a run on the stream bus and tracks it until its publisher ends. */
  createStreamPublisher(
    bus: AgentStreamBus | undefined,
    {
      agentId,
      runId,
      logger,
      resourceId,
      threadId,
      abortSignal,
    }: {
      agentId: string;
      runId: string;
      logger: IMastraLogger;
      resourceId?: string;
      threadId?: string;
      abortSignal?: AbortSignal;
    },
  ): AgentStreamPublisher | undefined {
    if (!bus) return undefined;
    const publisher = createAgentStreamPublisher({
      pubsub: bus.pubsub,
      runId,
      cleanupTimeoutMs: bus.cleanupTimeoutMs,
      logger,
      abortSignal,
      onEnd: () => {
        if (this.#publishedRuns.get(runId)?.publisher === publisher) this.#publishedRuns.delete(runId);
      },
      record: { cache: bus.runRecordCache, agentId, resourceId, threadId },
    });
    this.#publishedRuns.set(runId, { publisher, resourceId, threadId });
    return publisher;
  }

  /** Owner of a run published from this process and still running, or undefined. */
  getPublishedRunOwner(runId: string): AgentRunOwner | undefined {
    const run = this.#publishedRuns.get(runId);
    return run ? { resourceId: run.resourceId, threadId: run.threadId } : undefined;
  }

  /** In-memory Mastra a standalone agent falls back to for storage, built on first use. */
  #ephemeralMastra?: Mastra;

  override registerMastra(mastra: Mastra): void {
    super.registerMastra(mastra);
    // A real Mastra replaces the storage fallback.
    this.#ephemeralMastra = undefined;
  }

  /** The fallback Mastra, if one was built. */
  get ephemeralMastra(): Mastra | undefined {
    return this.#ephemeralMastra;
  }

  /**
   * The workflows store of `mastra`, else of an in-memory Mastra: an agent that isn't registered
   * on a Mastra still needs some storage for its suspended snapshots (agentic-loop resume,
   * suspended-run discovery). The fallback is reused until a real Mastra is registered.
   */
  async workflowsStore(mastra: Mastra | undefined): Promise<WorkflowsStorage | undefined> {
    const host = mastra ?? (await this.#getOrCreateEphemeralMastra());
    return host.getStorage()?.getStore('workflows');
  }

  async #getOrCreateEphemeralMastra(): Promise<Mastra> {
    if (this.#ephemeralMastra) {
      return this.#ephemeralMastra;
    }
    // Resolve the Mastra constructor without a static runtime import of the Mastra module, which
    // would create an ESM init cycle (agent → mastra → agent/durable → agent). In any app that
    // constructed a Mastra, the holder is already populated and no dynamic import runs; the
    // `await import` is a fallback for standalone agents that never loaded the Mastra module.
    const MastraClass = mastraCtorHolder.ctor ?? (await import('../mastra')).Mastra;
    const ephemeral = new MastraClass({
      logger: false,
      storage: new InMemoryStore(),
      pubsub: new EventEmitterPubSub(),
      // Skip module-level scorer-hook registration: the hook can never resolve
      // a scorer on this registry-less instance, and it would pin the whole
      // ephemeral graph against GC for the process lifetime (#19404).
      __ephemeral: true,
    });
    this.#ephemeralMastra = ephemeral;
    return ephemeral;
  }

  /** Throws when the run was aborted: an aborted run can never be resumed. */
  assertNotAborted(pubsub: PubSub | undefined, { agentName, runId }: { agentName: string; runId: string }): void {
    if (agentThreadStreamRuntime.isResumeFenced(runId, pubsub)) {
      throw new MastraError({
        id: 'AGENT_RESUME_ABORTED_RUN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent "${agentName}" cannot resume aborted run "${runId}".`,
        details: { agentName, runId },
      });
    }
  }

  async getSuspendedRequestContextValue({
    mastra,
    pubsub,
    agent,
    runId,
    key,
  }: SuspendedRequestContextLookup): Promise<unknown> {
    try {
      this.assertNotAborted(pubsub, { agentName: agent.name, runId });
      const snapshot = await this.loadSuspendedSnapshot(await this.workflowsStore(mastra), {
        agentName: agent.name,
        runId,
        method: '__getSuspendedRunRequestContextValue',
      });
      return snapshot.requestContext?.[key];
    } catch (error) {
      if (error instanceof MastraError && error.id === 'AGENT_RESUME_NO_SNAPSHOT_FOUND') return undefined;
      throw error;
    }
  }

  /**
   * Waits for the agentic-loop snapshot of a suspended run, or throws an actionable error:
   * `AGENT_RESUME_ALREADY_CLAIMED` when another resume took and finished it meanwhile,
   * `AGENT_RESUME_NO_SNAPSHOT_FOUND` when there is none.
   */
  async loadSuspendedSnapshot(
    workflowsStore: WorkflowsStorage | undefined,
    { agentName, runId, method }: { agentName: string; runId: string; method: string },
  ) {
    let claimedThenFinished = false;
    const existingSnapshot = await waitForSuspendedSnapshot(workflowsStore, 'agentic-loop', runId, {
      missingSnapshotGraceReads: 3,
      onClaimedRunFinished: () => {
        claimedThenFinished = true;
      },
    });

    // The run was claimed by another resume while we waited, then finished and was cleaned up.
    if (claimedThenFinished) throw alreadyClaimedResumeError({ agentName, method, runId });

    if (!existingSnapshot) {
      const hasStorage = !!workflowsStore;
      throw new MastraError({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${agentName}" ${method}() could not find a suspended run for runId "${runId}". ` +
          (hasStorage
            ? `The run has already finished (for example, an earlier approval or resume already handled it), never suspended, or the runId is invalid. `
            : `No storage is configured on this Mastra instance, so workflow snapshots can't be persisted. Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL). See https://mastra.ai/docs/storage. `) +
          `Ensure you are calling ${method}() only with a runId from a currently-suspended run.`,
        details: {
          runId,
          agentName,
          hasStorage,
        },
      });
    }

    return existingSnapshot;
  }

  /**
   * Claims a suspended agentic-loop run for one resume before the resumed loop starts, so
   * concurrent approvals/resumes of the same run (double clicks, client retries, two tabs)
   * cannot both execute the suspended tool. Losers throw `AGENT_RESUME_ALREADY_CLAIMED`.
   *
   * Stores that support atomic updates get compare-and-set transitions that hold across
   * processes, and the resumed run starts from the claimed snapshot. Other stores only get an
   * in-process guard. The `agentic-loop` row moves:
   *
   * - `suspended -> pending` when claimed, stamped with `resumeClaimedAt`.
   * - `pending -> running` in `claim.start()`, right before the resumed run executes. Only one
   *   caller can make this move, so only one resume executes the tool.
   * - back to `suspended` in `claim.release()` when the resume fails before the run executes.
   *
   * A `pending` claim (claimed, never started or released) is abandoned once it was claimed
   * `AGENT_RESUME_CLAIM_STALE_MS` ago. A later resume takes it over and claims the suspension
   * again; a live claimant that loses it this way fails in `start()`.
   *
   * On stores with run fencing, the claim is also held as a run-ownership lease, renewed every
   * `AGENT_RESUME_CLAIM_RENEW_MS` while the resumed run executes. A `running` claim whose lease
   * lapsed (its process died mid-run) is abandoned too, and a later resume takes it over and
   * resumes from the suspended snapshot, so the tool that was in flight runs again. A takeover is
   * one ownership claim on the generation the taker read, so only one taker wins, and the row never
   * goes back to `suspended` while someone may still run it. Without run fencing a `running` claim
   * is never taken over: nothing can tell a dead claimant from a slow one.
   *
   * Every claim write also persists what the resume resumes the run with (`resumeClaimIntent`), so
   * `recoverResume()` can finish a resume whose process died. A recovery passes the `claimedAt` of
   * the intent it replays as `recoverClaimedAt`, and only takes over that exact claim.
   *
   * `claim.release()` is idempotent. The loop calls it when the resumed run ends; resume methods
   * also call it on any failure before or after handing the claim to the loop. It hands the
   * suspension back to later callers only if the resumed run never started executing.
   */
  async claimSuspendedRun(
    workflowsStore: WorkflowsStorage | undefined,
    {
      agentName,
      logger,
      snapshot,
      runId,
      toolCallId,
      resumeData,
      recoverClaimedAt,
      method,
    }: {
      agentName: string;
      logger: IMastraLogger;
      snapshot: WorkflowRunState;
      runId: string;
      toolCallId: string | undefined;
      resumeData: unknown;
      recoverClaimedAt?: number;
      method: string;
    },
  ): Promise<AgentLoopResumeClaim> {
    const throwAlreadyClaimed = (): never => {
      throw alreadyClaimedResumeError({ agentName, method, runId, toolCallId });
    };

    if (!workflowsStore?.supportsConcurrentUpdates()) {
      if (workflowsStore) {
        logger.warn(
          `[Agent:${agentName}] - The configured workflow storage does not support concurrent updates, so concurrent ${method}() calls for run ${runId} are only de-duplicated within this process. Resumes arriving at other processes may execute the suspended tool more than once.`,
        );
      }
      if (inFlightUnclaimedResumes.has(runId)) throwAlreadyClaimed();
      inFlightUnclaimedResumes.add(runId);
      return {
        release: async () => {
          inFlightUnclaimedResumes.delete(runId);
        },
      };
    }

    const claimFrom = (expectedStatus: WorkflowRunStatus | undefined) => {
      const claimedAt = Date.now();
      return workflowsStore.updateWorkflowState({
        workflowName: AGENTIC_LOOP_WORKFLOW_ID,
        runId,
        opts: {
          status: 'pending',
          expectedStatus,
          resumeClaimedAt: claimedAt,
          resumeClaimIntent: { claimedAt, toolCallId, resumeData },
        },
      });
    };
    const claim = () => claimFrom('suspended');
    // A recovery replays one dead claim's intent, so it must not take over any other claim.
    const throwIfNotRecoveredClaim = (current: WorkflowRunState | null | undefined) => {
      if (recoverClaimedAt !== undefined && current?.resumeClaimedAt !== recoverClaimedAt) throwAlreadyClaimed();
    };

    // A probe that fails leaves the claim unleased, which is how a store without fencing behaves.
    const leased = await Promise.resolve()
      .then(() => workflowsStore.supportsRunFencing())
      .catch(() => false);
    // Keyed apart from the run's own id, which workflow and durable-agent executions may fence.
    const ownershipRunId = `${AGENTIC_LOOP_WORKFLOW_ID}:resume-claim:${runId}`;
    let fence: RunFence | undefined;
    const acquireLease = async (opts: { force?: boolean; expectedGeneration?: number }) => {
      const ownerId = globalThis.crypto.randomUUID();
      const result = await workflowsStore.claimRunOwnership({
        runId: ownershipRunId,
        ownerId,
        leaseMs: AGENT_RESUME_CLAIM_STALE_MS,
        ...opts,
      });
      if (result.acquired) fence = { runId: ownershipRunId, generation: result.record.generation, ownerId };
      return result.acquired;
    };
    const renewLease = async () =>
      !!fence && (await workflowsStore.renewRunOwnership({ ...fence, leaseMs: AGENT_RESUME_CLAIM_STALE_MS })).renewed;
    let leaseReleased = false;
    const releaseLease = async () => {
      if (!fence || leaseReleased) return;
      leaseReleased = true;
      try {
        await workflowsStore.releaseRunOwnership(fence);
      } catch (error) {
        logger.warn(`[Agent ${agentName}] Failed to release resume claim lease for run ${runId}`, { error });
      }
    };

    let claimed = await claim();
    if (claimed && leased) {
      // Only this caller moved the row out of `suspended`, so the claim is ours: replace whatever
      // lease an earlier resume of this run left behind.
      await acquireLease({ force: true });
    } else if (!claimed && leased) {
      const current = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
      const claimStatus = current?.status;
      const abandoned =
        current?.timestamp === snapshot.timestamp &&
        typeof current.resumeClaimedAt === 'number' &&
        (claimStatus === 'running'
          ? current.resumeLeasedClaimAt === current.resumeClaimedAt
          : claimStatus === 'pending' && Date.now() - current.resumeClaimedAt >= AGENT_RESUME_CLAIM_STALE_MS);
      if (!abandoned) throwAlreadyClaimed();
      throwIfNotRecoveredClaim(current);
      const owner = await workflowsStore.getRunOwnership({ runId: ownershipRunId });
      if (owner?.live) throwAlreadyClaimed();
      // Racing takers read the same generation, so only one of them gets the lease.
      if (!(await acquireLease({ expectedGeneration: owner?.generation ?? 0 }))) throwAlreadyClaimed();
      if (recoverClaimedAt !== undefined) {
        // Another resume may have claimed the run between the read above and taking the lease. Holding
        // the lease, no other resume can claim it now, so this read settles which claim is recovered.
        const held = await workflowsStore
          .loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId })
          .catch(async error => {
            await releaseLease();
            throw error;
          });
        if (held?.status !== claimStatus || held?.resumeClaimedAt !== recoverClaimedAt) {
          await releaseLease();
          throwAlreadyClaimed();
        }
      }

      logger.warn(
        claimStatus === 'running'
          ? `[Agent:${agentName}] - Taking over resume claim for run ${runId} whose lease lapsed; the suspended tool call runs again.`
          : `[Agent:${agentName}] - Taking over resume claim for run ${runId} that was not started within ${AGENT_RESUME_CLAIM_STALE_MS}ms.`,
      );
      claimed = await claimFrom(claimStatus);
      if (!claimed) {
        await releaseLease();
        throwAlreadyClaimed();
      }
    } else if (!claimed) {
      const current = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
      const abandoned =
        current?.status === 'pending' &&
        current.timestamp === snapshot.timestamp &&
        typeof current.resumeClaimedAt === 'number' &&
        Date.now() - current.resumeClaimedAt >= AGENT_RESUME_CLAIM_STALE_MS;
      if (!abandoned) throwAlreadyClaimed();
      throwIfNotRecoveredClaim(current);

      // Hand the abandoned suspension back, then claim it like any other. If a concurrent caller
      // re-claimed it in between, this hand-back can only make that caller's `start()` fail; the
      // single `pending -> running` move still lets at most one resume execute.
      logger.warn(
        `[Agent:${agentName}] - Taking over resume claim for run ${runId} that was not started within ${AGENT_RESUME_CLAIM_STALE_MS}ms.`,
      );
      await workflowsStore.updateWorkflowState({
        workflowName: AGENTIC_LOOP_WORKFLOW_ID,
        runId,
        opts: { status: 'suspended', expectedStatus: 'pending' },
      });
      if (recoverClaimedAt !== undefined) {
        // The hand-back cannot tell claims apart, so it may have knocked back a newer claim taken
        // since the read above. Recover only if the run still carries the claim that was read.
        const handedBack = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
        throwIfNotRecoveredClaim(handedBack);
      }
      claimed = await claim();
      if (!claimed) throwAlreadyClaimed();
    }

    const claimedAt = claimed!.resumeClaimedAt;
    let claimStatus: 'pending' | 'running' = 'pending';
    let started = false;
    let released = false;

    // Renew the lease while the resumed run executes, so later resumes can tell this live claimant
    // from one whose process died. Stops once the lease is no longer this claim's.
    let renewTimer: ReturnType<typeof setInterval> | undefined;
    let renewing = false;
    const stopRenewing = () => {
      if (renewTimer) clearInterval(renewTimer);
      renewTimer = undefined;
    };
    const renew = async () => {
      if (renewing) return;
      renewing = true;
      try {
        if (!(await renewLease())) stopRenewing();
      } catch (error) {
        logger.warn(`[Agent ${agentName}] Failed to renew resume claim lease for run ${runId}`, { error });
      } finally {
        renewing = false;
      }
    };

    const release = async () => {
      stopRenewing();
      if (started || released) {
        await releaseLease();
        return;
      }
      released = true;
      try {
        // Skip when a later resume took this claim over: the suspension is no longer ours.
        const current = await workflowsStore.loadWorkflowSnapshot({ workflowName: AGENTIC_LOOP_WORKFLOW_ID, runId });
        if (current?.resumeClaimedAt !== claimedAt) return;
        if (fence && !matchesRunFence(await workflowsStore.getRunOwnership({ runId: ownershipRunId }), fence)) return;
        await workflowsStore.updateWorkflowState({
          workflowName: AGENTIC_LOOP_WORKFLOW_ID,
          runId,
          opts: { status: 'suspended', expectedStatus: claimStatus },
        });
      } catch (error) {
        logger.warn(`[Agent ${agentName}] Failed to release resume claim for run ${runId}`, { error });
      } finally {
        await releaseLease();
      }
    };

    // Another resume can claim, run, and re-suspend the run between the validation read and this
    // claim. Every suspend persist rewrites the snapshot timestamp, so a different timestamp means
    // this caller claimed a newer suspension than the one it validated.
    if (claimed!.timestamp !== snapshot.timestamp) {
      await release();
      throwAlreadyClaimed();
    }

    return {
      snapshot,
      start: async () => {
        // A claim whose lease lapsed before it started may have been taken over already.
        if (fence && !(await renewLease())) {
          released = true;
          throwAlreadyClaimed();
        }
        const running = await workflowsStore.updateWorkflowState({
          workflowName: AGENTIC_LOOP_WORKFLOW_ID,
          runId,
          opts: fence
            ? { status: 'running', expectedStatus: 'pending', resumeLeasedClaimAt: claimedAt }
            : { status: 'running', expectedStatus: 'pending' },
        });
        if (!running) {
          // A later resume took this claim over as abandoned; it owns the suspension now.
          released = true;
          await releaseLease();
          throwAlreadyClaimed();
        }
        claimStatus = 'running';
        if (fence && !released) {
          renewTimer = setInterval(() => void renew(), AGENT_RESUME_CLAIM_RENEW_MS);
          renewTimer.unref?.();
        }
      },
      onExecutionStarted: () => {
        started = true;
      },
      release,
    };
  }
}

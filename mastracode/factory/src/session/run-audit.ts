import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { z } from 'zod';

import type { AuditActorType } from '../storage/domains/audit/base.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import { factoryOpenRunSchema } from '../storage/domains/open-runs/base.js';
import type { FactoryOpenRun, OpenRunsStorage } from '../storage/domains/open-runs/base.js';

/**
 * The thread setting that held the open-run ledger before it moved to Factory storage. Runs still
 * in it are copied to storage on first read and then dropped from it.
 */
export const FACTORY_OPEN_RUNS_SETTING = 'factoryOpenRuns';

export type { FactoryOpenRun };

/**
 * Where runs are kept; every write touches only its own run. A run can end in a process other
 * than the one waiting on it (a durable run that moved workers), where the waiter never sees the
 * in-memory `agent_end`; the end recorded on the run's row is what it reads instead. It lives in
 * Factory storage, never in thread metadata a client can write.
 */
export type OpenRunLedger = Pick<
  OpenRunsStorage,
  'listByThread' | 'get' | 'open' | 'heartbeat' | 'end' | 'close' | 'takeOver' | 'importLegacy' | 'known'
>;

/** A heartbeat older than this means the owner is gone; nothing renews it once the run's dispatcher dies. */
export const FACTORY_OPEN_RUN_STALE_MS = 30_000;

export function isOpenRunLiveElsewhere(run: FactoryOpenRun, ownerId: string, now = Date.now()): boolean {
  return (
    run.ownerId !== undefined &&
    run.ownerId !== ownerId &&
    run.heartbeatAt !== undefined &&
    now - run.heartbeatAt < FACTORY_OPEN_RUN_STALE_MS
  );
}

export interface RunEndCaptureSession {
  readonly thread: {
    getId(): string | null;
    getSetting(args: { key: string }): Promise<unknown>;
    setSetting(args: { key: string; value: unknown }): Promise<void>;
  };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

type RunEndReason = Extract<AgentControllerEvent, { type: 'agent_end' }>['reason'];
type StepUsage = Extract<AgentControllerEvent, { type: 'usage_update' }>['usage'];
const pendingWrites = new WeakMap<object, Promise<void>>();

/**
 * JSON budget for the per-step entries on a run's audit record. Audit metadata
 * is capped at 4 KB as a whole and an oversized record loses all of it, so
 * later steps are dropped (and counted) instead; totals always cover every step.
 */
export const FACTORY_RUN_USAGE_STEPS_JSON_BUDGET = 2400;

const USAGE_FIELDS = [
  'promptTokens',
  'completionTokens',
  'totalTokens',
  'reasoningTokens',
  'cachedInputTokens',
  'cacheCreationInputTokens',
  'cacheCreationInputTokens5m',
  'cacheCreationInputTokens1h',
] as const;

type UsageCounts = Partial<Record<(typeof USAGE_FIELDS)[number], number>>;

/**
 * Token usage attached to a run's `factory.run.ended` audit record.
 * `unreported` means this process saw no usage for the run (it ran elsewhere,
 * the process restarted, or the model reported none). It is never zero spend.
 */
export type FactoryRunUsage =
  | {
      status: 'recorded';
      stepCount: number;
      totals: UsageCounts;
      steps: UsageCounts[];
      stepsTruncated?: number;
      /** Other runs that ended in the same agent turn; the turn's usage can't be split between them. */
      sharedWithKickoffIds?: string[];
    }
  | { status: 'unreported' };

function usageCounts(usage: StepUsage): UsageCounts {
  const counts: UsageCounts = {};
  for (const field of USAGE_FIELDS) {
    const value = usage[field];
    if (typeof value === 'number') counts[field] = value;
  }
  return counts;
}

function runUsage(steps: UsageCounts[]): FactoryRunUsage {
  if (steps.length === 0) return { status: 'unreported' };
  const totals: UsageCounts = {};
  for (const step of steps) {
    for (const field of USAGE_FIELDS) {
      if (step[field] !== undefined) totals[field] = (totals[field] ?? 0) + step[field];
    }
  }
  const kept: UsageCounts[] = [];
  let length = 2;
  for (const step of steps) {
    length += JSON.stringify(step).length + 1;
    if (length > FACTORY_RUN_USAGE_STEPS_JSON_BUDGET) break;
    kept.push(step);
  }
  return {
    status: 'recorded',
    stepCount: steps.length,
    totals,
    steps: kept,
    ...(steps.length > kept.length ? { stepsTruncated: steps.length - kept.length } : {}),
  };
}

interface EndedTurn {
  steps: UsageCounts[];
  claimed: boolean;
}

interface SessionUsage {
  /** Steps of the turn in progress; a suspended turn keeps accumulating into its resume. */
  current: UsageCounts[];
  /** The most recently ended turn, which a run whose ledger entry lands after that end may still claim. */
  lastTurn?: EndedTurn;
  /** Usage of runs whose end record failed to persist, kept for the retry. */
  held: Map<string, FactoryRunUsage>;
}

const sessionUsage = new WeakMap<RunEndCaptureSession, SessionUsage>();

function usageFor(session: RunEndCaptureSession): SessionUsage {
  let usage = sessionUsage.get(session);
  if (!usage) {
    usage = { current: [], held: new Map() };
    sessionUsage.set(session, usage);
  }
  return usage;
}

function serializeRunAudit(session: RunEndCaptureSession, write: () => Promise<void>): Promise<void> {
  const pending = (pendingWrites.get(session) ?? Promise.resolve())
    .then(write)
    .catch(error => console.warn('[Factory run audit] Unable to record run lifecycle.', error));
  pendingWrites.set(session, pending);
  return pending;
}

const legacyOpenRunsSchema = z.array(factoryOpenRunSchema);

/** The most legacy entries one read of a thread's `factoryOpenRuns` setting considers. */
export const FACTORY_LEGACY_OPEN_RUNS_READ = 10;

/**
 * Runs that a release before the storage ledger keeps in `threadId`'s `factoryOpenRuns` setting.
 * During a rolling deploy that release still owns, heartbeats and ends them there, so a live entry
 * is read in place (never copied or removed: its owner would lose track of it). An entry whose
 * owner is gone is copied to the ledger once, and from then on only the ledger counts for it. The
 * setting is client-writable: only entries naming this thread count, a heartbeat further in the
 * future than clock skew explains is ignored, and a nearer one reads as now.
 */
async function legacyOpenRunsOn(
  openRuns: OpenRunLedger,
  threadId: string,
  read: () => Promise<unknown>,
): Promise<FactoryOpenRun[]> {
  const stored = await read();
  if (!Array.isArray(stored)) return [];
  // An earlier release holds a thread's few runs here; the setting is client-writable, so a longer
  // list is read only up to its latest entries, bounding the work (and copies) one read can cause.
  const parsed = legacyOpenRunsSchema.safeParse(stored.slice(-FACTORY_LEGACY_OPEN_RUNS_READ));
  if (!parsed.success) return [];
  const now = Date.now();
  const entries = parsed.data
    // Clocks differ a little between replicas; a heartbeat further ahead than that is forged.
    .filter(run => run.threadId === threadId && (run.heartbeatAt ?? 0) <= now + FACTORY_OPEN_RUN_STALE_MS)
    .map(run => (run.heartbeatAt !== undefined && run.heartbeatAt > now ? { ...run, heartbeatAt: now } : run));
  const isLive = (run: FactoryOpenRun) =>
    run.heartbeatAt !== undefined && now - run.heartbeatAt < FACTORY_OPEN_RUN_STALE_MS;
  await openRuns.importLegacy(
    threadId,
    entries.filter(run => !isLive(run)),
    now,
  );
  // Once a kickoff is on the ledger, the ledger alone says whether it runs: a heartbeat written into
  // the setting after that (by a client, or an owner already taken for gone) cannot reopen it.
  const live = entries.filter(isLive);
  const known = await openRuns.known(live.map(run => run.kickoffId));
  return live.filter(run => !known.has(run.kickoffId));
}

/** The runs on `threadId`'s ledger, after copying legacy runs whose owner is gone. */
async function ledgerRunsOn(
  openRuns: OpenRunLedger,
  threadId: string,
  readLegacy: () => Promise<unknown>,
): Promise<FactoryOpenRun[]> {
  await legacyOpenRunsOn(openRuns, threadId, readLegacy);
  return openRuns.listByThread(threadId);
}

/** The ledger's runs on `threadId`, plus live runs a release before the ledger still tracks. */
async function openRunsOn(
  openRuns: OpenRunLedger,
  threadId: string,
  readLegacy: () => Promise<unknown>,
): Promise<FactoryOpenRun[]> {
  const live = await legacyOpenRunsOn(openRuns, threadId, readLegacy);
  const ledger = await openRuns.listByThread(threadId);
  // A copy committed by another reader between the two reads is already on the ledger.
  const listed = new Set(ledger.map(run => run.kickoffId));
  return [...ledger, ...live.filter(run => !listed.has(run.kickoffId))];
}

/** The open runs of the thread the session is on. */
export function listSessionOpenRuns(
  session: Pick<RunEndCaptureSession, 'thread'>,
  openRuns: OpenRunLedger,
): Promise<FactoryOpenRun[]> {
  const threadId = session.thread.getId();
  if (!threadId) return Promise.resolve([]);
  return openRunsOn(openRuns, threadId, () => session.thread.getSetting({ key: FACTORY_OPEN_RUNS_SETTING }));
}

/** The open runs of `threadId`, whichever thread the session is on now. */
export function listThreadOpenRuns(
  session: { readonly thread: { getSettingOn(args: { threadId: string; key: string }): Promise<unknown> } },
  openRuns: OpenRunLedger,
  threadId: string,
): Promise<FactoryOpenRun[]> {
  return openRunsOn(openRuns, threadId, () =>
    session.thread.getSettingOn({ threadId, key: FACTORY_OPEN_RUNS_SETTING }),
  );
}

export async function waitForSessionRunAudit(session: object): Promise<void> {
  await (pendingWrites.get(session) ?? Promise.resolve());
}

function runAuditInput(run: FactoryOpenRun) {
  // Ownership fields are dispatcher bookkeeping, not part of the run's audit record.
  const { orgId, factoryProjectId, workItemId, workItemName, ownerId, heartbeatAt, ...metadata } = run;
  void ownerId;
  void heartbeatAt;
  return {
    orgId,
    factoryProjectId,
    idempotencyKey: run.kickoffId,
    targets: [{ type: 'work_item', id: workItemId, ...(workItemName ? { name: workItemName } : {}) }],
    metadata,
  };
}

async function recordRunEnds(
  session: RunEndCaptureSession,
  audit: AuditRecorder,
  openRuns: OpenRunLedger,
  reason: RunEndReason,
  kickoffId?: string,
  endedTurn?: EndedTurn,
): Promise<void> {
  if (!reason || reason === 'suspended') return;
  const usage = usageFor(session);
  const threadId = session.thread.getId();
  if (!threadId) return;
  // Only the ledger's own runs: a live run a release before the ledger tracks is its owner's to end.
  const runs = await ledgerRunsOn(openRuns, threadId, () =>
    session.thread.getSetting({ key: FACTORY_OPEN_RUNS_SETTING }),
  );
  if (runs.length === 0) return;
  const ending = runs.filter(run => !kickoffId || run.kickoffId === kickoffId);
  // A run whose end an earlier worker recorded, and whose usage this session never held, ended in
  // that worker (it took the run over as lost, or died before the audit record): its usage is not
  // this session's turn, so it bills nothing here.
  for (const run of ending) {
    if (!usage.held.has(run.kickoffId) && (await openRuns.get(run.kickoffId))?.end) {
      usage.held.set(run.kickoffId, { status: 'unreported' });
    }
  }
  const billing = ending.filter(run => !usage.held.has(run.kickoffId));
  // An end event bills the turn it closed. A run whose ledger entry lands after its turn ended
  // bills the latest ended turn, unless an open run already claimed it.
  const turn = endedTurn ?? usage.lastTurn;
  const steps = turn && !turn.claimed ? turn.steps : [];
  if (turn && billing.length > 0) turn.claimed = true;
  const turnUsage = runUsage(steps);
  // Held before any write that can fail, so a retry bills the turn this end claimed.
  for (const run of billing) {
    const shared = billing.filter(other => other !== run).map(other => other.kickoffId);
    usage.held.set(
      run.kickoffId,
      turnUsage.status === 'recorded' && shared.length > 0 ? { ...turnUsage, sharedWithKickoffIds: shared } : turnUsage,
    );
  }
  // The end is recorded before the audit write, so a waiter elsewhere settles even while the audit
  // store is down; the run stays on the ledger until its end record lands. The first end recorded
  // is the run's end, on its row and in its audit record alike.
  const endedAt = Date.now();
  const reasons = new Map<string, RunEndReason>();
  for (const run of ending) {
    const recorded = (await openRuns.end(run.kickoffId, { reason, endedAt }))
      ? undefined
      : (await openRuns.get(run.kickoffId))?.end?.reason;
    reasons.set(run.kickoffId, recorded ?? reason);
  }
  for (const run of ending) {
    const runUsageRecord = usage.held.get(run.kickoffId)!;
    const runReason = reasons.get(run.kickoffId)!;
    const input = runAuditInput(run);
    const recorded = await audit.record({
      ...input,
      actorId: `agent:${run.threadId}`,
      actorType: 'agent',
      action: 'factory.run.ended',
      metadata: { ...input.metadata, reason: runReason, usage: runUsageRecord },
    });
    if (recorded) {
      usage.held.delete(run.kickoffId);
      await openRuns.close(run, Date.now());
    } else {
      console.warn(
        `[Factory run audit] Token usage for run ${run.kickoffId} (${run.role}) was not persisted; keeping it for the next attempt.`,
        runUsageRecord,
      );
    }
  }
}

export function recordSessionRunStart(
  session: RunEndCaptureSession,
  {
    audit,
    openRuns,
    run,
    actorType,
    observedEnd,
  }: {
    audit: AuditRecorder;
    openRuns: OpenRunLedger;
    run: FactoryOpenRun;
    actorType: AuditActorType;
    observedEnd: () => RunEndReason;
  },
): Promise<void> {
  return serializeRunAudit(session, async () => {
    await openRuns.open({ startedAt: Date.now(), ...run });
    await audit.record({
      ...runAuditInput(run),
      actorId: run.startedBy,
      actorType,
      action: 'factory.run.started',
    });
    await recordRunEnds(session, audit, openRuns, observedEnd(), run.kickoffId);
  });
}

/**
 * Hands the runs that died with their worker to the run resuming them. In one transaction, each
 * lost run is ended as aborted on its row and a single entry for the resumed run, owned by this
 * worker, is added. The ledger never loses the evidence: if this worker dies too before the
 * resumed run lands, that entry goes stale and the next worker resumes again.
 *
 * `lost` are the entries as the caller read them when it judged them stale. Resolves `false`,
 * leaving the ledger and the audit log untouched, when any lost entry changed or left since:
 * another worker took the run over, or its run came back. Only a takeover that won records the
 * lost runs as aborted in the audit log. It resolves `true` once the takeover commits, even when
 * that record fails: the lost run then stays on the ledger, ended, until a later run end on the
 * thread records it, so a caller must not retry the takeover.
 */
export async function takeOverInterruptedSessionRuns(
  session: RunEndCaptureSession,
  {
    audit,
    openRuns,
    lost,
    resumeKickoffId,
    ownerId,
  }: {
    audit: AuditRecorder | undefined;
    openRuns: OpenRunLedger;
    lost: FactoryOpenRun[];
    resumeKickoffId: string;
    ownerId: string;
  },
): Promise<boolean> {
  if (lost.length === 0) return false;
  let tookOver = false;
  await serializeRunAudit(session, async () => {
    const now = Date.now();
    tookOver = await openRuns.takeOver(lost, {
      ...lost[0]!,
      kickoffId: resumeKickoffId,
      ownerId,
      heartbeatAt: now,
      startedAt: now,
    });
    // Only a takeover that won records the lost runs' ends: a refused one leaves a run that came
    // back, or that another worker took over, to the worker that has it.
    if (!tookOver) return;
    const usage = usageFor(session);
    for (const run of lost) {
      const input = runAuditInput(run);
      const recorded = audit
        ? await audit
            .record({
              ...input,
              actorId: `agent:${run.threadId}`,
              actorType: 'agent',
              action: 'factory.run.ended',
              metadata: { ...input.metadata, reason: 'aborted', usage: { status: 'unreported' } },
            })
            .catch(() => null)
        : null;
      if (recorded || !audit) {
        await openRuns.close(run, Date.now());
      } else {
        // Its aborted end is on its row and it stays on the ledger, so the session's next run end
        // records it; its usage ran in the lost process.
        usage.held.set(run.kickoffId, { status: 'unreported' });
        console.warn(
          `[Factory run audit] The end of lost run ${run.kickoffId} was not recorded; keeping it for the next attempt.`,
        );
      }
    }
  });
  return tookOver;
}

/** Renew `ownerId`'s claim on an open run so other replicas keep treating it as live. */
export async function heartbeatSessionOpenRun(
  openRuns: OpenRunLedger,
  { kickoffId, ownerId, at = Date.now() }: { kickoffId: string; ownerId: string; at?: number },
): Promise<void> {
  try {
    await openRuns.heartbeat(kickoffId, ownerId, at);
  } catch (error) {
    console.warn('[Factory run audit] Unable to renew an open run.', error);
  }
}

export function observeSessionRunEnd(
  session: RunEndCaptureSession,
  { audit, openRuns }: { audit: AuditRecorder; openRuns: OpenRunLedger },
): () => void {
  const usage = usageFor(session);
  return session.subscribe(event => {
    if (event.type === 'usage_update') {
      usage.current.push(usageCounts(event.usage));
      return;
    }
    if (event.type !== 'agent_end' || !event.reason || event.reason === 'suspended') return;
    // Close the turn now so a following turn's steps never land in this run.
    const turn: EndedTurn = { steps: usage.current, claimed: false };
    usage.current = [];
    usage.lastTurn = turn;
    void serializeRunAudit(session, () => recordRunEnds(session, audit, openRuns, event.reason, undefined, turn));
  });
}

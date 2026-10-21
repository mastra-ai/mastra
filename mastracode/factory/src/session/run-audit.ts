import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { z } from 'zod';

import type { AuditActorType } from '../storage/domains/audit/base.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';

export const FACTORY_OPEN_RUNS_SETTING = 'factoryOpenRuns';

const factoryOpenRunSchema = z.object({
  kickoffId: z.string(),
  bindingId: z.string(),
  role: z.string(),
  startedBy: z.string(),
  orgId: z.string(),
  factoryProjectId: z.string(),
  workItemId: z.string(),
  workItemName: z.string().optional(),
  sessionId: z.string(),
  threadId: z.string(),
  branch: z.string(),
  /**
   * Which dispatcher process is watching this run, and when it last said so
   * (epoch ms). The ledger is a thread setting shared by every replica, so a
   * remote reader needs these to tell a run that is live elsewhere from one
   * that died with its process. Absent on entries written before ownership
   * was recorded; those read as stale.
   */
  ownerId: z.string().optional(),
  heartbeatAt: z.number().optional(),
});

export type FactoryOpenRun = z.infer<typeof factoryOpenRunSchema>;

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
    getSetting(args: { key: string }): Promise<unknown>;
    setSetting(args: { key: string; value: unknown }): Promise<void>;
  };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

type RunEndReason = Extract<AgentControllerEvent, { type: 'agent_end' }>['reason'];
type StepUsage = Extract<AgentControllerEvent, { type: 'usage_update' }>['usage'];
const pendingWrites = new WeakMap<RunEndCaptureSession, Promise<void>>();

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

export async function listSessionOpenRuns(session: RunEndCaptureSession): Promise<FactoryOpenRun[]> {
  const stored = await session.thread.getSetting({ key: FACTORY_OPEN_RUNS_SETTING });
  return z.array(factoryOpenRunSchema).parse(stored ?? []);
}

export async function waitForSessionRunAudit(session: RunEndCaptureSession): Promise<void> {
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
  reason: RunEndReason,
  kickoffId?: string,
  endedTurn?: EndedTurn,
): Promise<void> {
  if (!reason || reason === 'suspended') return;
  const usage = usageFor(session);
  const runs = await listSessionOpenRuns(session);
  if (runs.length === 0) return;
  const ending = runs.filter(run => !kickoffId || run.kickoffId === kickoffId);
  // An end event bills the turn it closed. A run whose ledger entry lands after its turn ended
  // bills the latest ended turn, unless an open run already claimed it.
  const turn = endedTurn ?? usage.lastTurn;
  const steps = turn && !turn.claimed ? turn.steps : [];
  if (turn && ending.length > 0) turn.claimed = true;
  const turnUsage = runUsage(steps);
  const remaining = [];
  for (const run of runs) {
    if (!ending.includes(run)) {
      remaining.push(run);
      continue;
    }
    let runUsageRecord = usage.held.get(run.kickoffId);
    if (!runUsageRecord) {
      const shared = ending.filter(other => other !== run).map(other => other.kickoffId);
      runUsageRecord =
        turnUsage.status === 'recorded' && shared.length > 0
          ? { ...turnUsage, sharedWithKickoffIds: shared }
          : turnUsage;
      usage.held.set(run.kickoffId, runUsageRecord);
    }
    const input = runAuditInput(run);
    const recorded = await audit.record({
      ...input,
      actorId: `agent:${run.threadId}`,
      actorType: 'agent',
      action: 'factory.run.ended',
      metadata: { ...input.metadata, reason, usage: runUsageRecord },
    });
    if (recorded) {
      usage.held.delete(run.kickoffId);
    } else {
      console.warn(
        `[Factory run audit] Token usage for run ${run.kickoffId} (${run.role}) was not persisted; keeping it for the next attempt.`,
        runUsageRecord,
      );
      remaining.push(run);
    }
  }
  await session.thread.setSetting({ key: FACTORY_OPEN_RUNS_SETTING, value: remaining });
}

export function recordSessionRunStart(
  session: RunEndCaptureSession,
  {
    audit,
    run,
    actorType,
    observedEnd,
    startedAt,
  }: {
    audit: AuditRecorder;
    run: FactoryOpenRun;
    actorType: AuditActorType;
    observedEnd: () => RunEndReason;
    /** When the run's kickoff landed or was sent; recording can lag it by the whole run. */
    startedAt: Date;
  },
): Promise<void> {
  return serializeRunAudit(session, async () => {
    const runs = await listSessionOpenRuns(session);
    if (!runs.some(existing => existing.kickoffId === run.kickoffId)) {
      await session.thread.setSetting({ key: FACTORY_OPEN_RUNS_SETTING, value: [...runs, run] });
    }
    await audit.record({
      ...runAuditInput(run),
      actorId: run.startedBy,
      actorType,
      action: 'factory.run.started',
      occurredAt: startedAt,
    });
    await recordRunEnds(session, audit, observedEnd(), run.kickoffId);
  });
}

/** Renew this process's claim on an open run so other replicas keep treating it as live. */
export function heartbeatSessionOpenRun(
  session: RunEndCaptureSession,
  kickoffId: string,
  at = Date.now(),
): Promise<void> {
  return serializeRunAudit(session, async () => {
    const runs = await listSessionOpenRuns(session);
    if (!runs.some(run => run.kickoffId === kickoffId)) return;
    await session.thread.setSetting({
      key: FACTORY_OPEN_RUNS_SETTING,
      value: runs.map(run => (run.kickoffId === kickoffId ? { ...run, heartbeatAt: at } : run)),
    });
  });
}

export function observeSessionRunEnd(session: RunEndCaptureSession, { audit }: { audit: AuditRecorder }): () => void {
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
    void serializeRunAudit(session, () => recordRunEnds(session, audit, event.reason, undefined, turn));
  });
}

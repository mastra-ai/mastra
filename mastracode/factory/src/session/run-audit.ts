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

/** Where open runs are kept; every write touches only its own run. */
export type OpenRunLedger = Pick<OpenRunsStorage, 'listByThread' | 'open' | 'heartbeat' | 'close' | 'importLegacy'>;

/**
 * How each recent run on a thread ended, keyed by kickoff id. A run can end in a process other
 * than the one waiting on it (a durable run that moved workers), where the waiter never sees the
 * in-memory `agent_end`; this record is what it reads instead.
 */
export const FACTORY_RUN_ENDS_SETTING = 'factoryRunEnds';
/** Only a waiter still in flight reads an end, so a short tail of recent ends is enough. */
const FACTORY_RUN_ENDS_KEPT = 20;

const factoryRunEndSchema = z.object({
  kickoffId: z.string(),
  reason: z.enum(['complete', 'aborted', 'error']),
  endedAt: z.number(),
});

export type FactoryRunEnd = z.infer<typeof factoryRunEndSchema>;

/** How the run of `kickoffId` on `threadId` ended, when its end was recorded. */
export async function readThreadRunEnd(
  session: { readonly thread: { getSettingOn(args: { threadId: string; key: string }): Promise<unknown> } },
  threadId: string,
  kickoffId: string,
): Promise<FactoryRunEnd | undefined> {
  const stored = await session.thread.getSettingOn({ threadId, key: FACTORY_RUN_ENDS_SETTING });
  const ends = z.array(factoryRunEndSchema).safeParse(stored ?? []);
  return ends.success ? ends.data.find(end => end.kickoffId === kickoffId) : undefined;
}

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

/**
 * The open runs of `threadId`, after copying any a release before the storage ledger left in the
 * thread's setting. Copied runs are dropped from the setting; a copy is never repeated, so a run
 * that ended after its copy stays ended even if dropping it from the setting failed.
 */
async function openRunsOn(
  openRuns: OpenRunLedger,
  threadId: string,
  legacy: { read(): Promise<unknown>; write(value: FactoryOpenRun[]): Promise<void> },
): Promise<FactoryOpenRun[]> {
  const stored = legacyOpenRunsSchema.parse((await legacy.read()) ?? []);
  if (stored.length > 0) {
    const copied = new Set(await openRuns.importLegacy(stored));
    const remaining = legacyOpenRunsSchema.parse((await legacy.read()) ?? []);
    await legacy.write(remaining.filter(run => !copied.has(run.kickoffId)));
  }
  return openRuns.listByThread(threadId);
}

/** The open runs of the thread the session is on. */
export function listSessionOpenRuns(
  session: Pick<RunEndCaptureSession, 'thread'>,
  openRuns: OpenRunLedger,
): Promise<FactoryOpenRun[]> {
  const threadId = session.thread.getId();
  if (!threadId) return Promise.resolve([]);
  return openRunsOn(openRuns, threadId, {
    read: () => session.thread.getSetting({ key: FACTORY_OPEN_RUNS_SETTING }),
    write: value => session.thread.setSetting({ key: FACTORY_OPEN_RUNS_SETTING, value }),
  });
}

/** The open runs of `threadId`, whichever thread the session is on now. */
export function listThreadOpenRuns(
  session: {
    readonly thread: {
      getSettingOn(args: { threadId: string; key: string }): Promise<unknown>;
      setSettingOn(args: { threadId: string; key: string; value: unknown }): Promise<void>;
    };
  },
  openRuns: OpenRunLedger,
  threadId: string,
): Promise<FactoryOpenRun[]> {
  return openRunsOn(openRuns, threadId, {
    read: () => session.thread.getSettingOn({ threadId, key: FACTORY_OPEN_RUNS_SETTING }),
    write: value => session.thread.setSettingOn({ threadId, key: FACTORY_OPEN_RUNS_SETTING, value }),
  });
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
  const runs = await listSessionOpenRuns(session, openRuns);
  if (runs.length === 0) return;
  const ending = runs.filter(run => !kickoffId || run.kickoffId === kickoffId);
  // An end event bills the turn it closed. A run whose ledger entry lands after its turn ended
  // bills the latest ended turn, unless an open run already claimed it.
  const turn = endedTurn ?? usage.lastTurn;
  const steps = turn && !turn.claimed ? turn.steps : [];
  if (turn && ending.length > 0) turn.claimed = true;
  const turnUsage = runUsage(steps);
  // The end is recorded before the run leaves the ledger: a reader that finds neither would take
  // the run for lost.
  if (ending.length > 0) {
    const stored = z
      .array(factoryRunEndSchema)
      .safeParse((await session.thread.getSetting({ key: FACTORY_RUN_ENDS_SETTING })) ?? []);
    const endedAt = Date.now();
    const ended = new Set(ending.map(run => run.kickoffId));
    await session.thread.setSetting({
      key: FACTORY_RUN_ENDS_SETTING,
      value: [
        ...(stored.success ? stored.data : []).filter(end => !ended.has(end.kickoffId)),
        ...ending.map(run => ({ kickoffId: run.kickoffId, reason, endedAt })),
      ].slice(-FACTORY_RUN_ENDS_KEPT),
    });
  }
  for (const run of ending) {
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
      await openRuns.close(run.kickoffId);
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

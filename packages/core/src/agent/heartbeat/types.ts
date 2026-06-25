import { z } from 'zod/v4';
import type { AgentSignalAttributes, AgentSignalType } from '../signals';
import type { AgentSignalActiveBehavior, AgentSignalIdleBehavior } from '../types';

export const HeartbeatBroadcastModeSchema = z.enum(['live', 'on-complete', 'never']);

/**
 * Advisory per-heartbeat broadcast policy. Stamped onto the heartbeat
 * signal's `providerOptions.mastra.heartbeat` (and on the threadless
 * `agent.generate` run options) so consumers — channel renderers, Studio
 * UI, observability surfaces — can decide independently whether to honor
 * it.
 *
 * - `live`         consumers should render chunks as they arrive (default)
 * - `on-complete`  consumers should buffer intermediate text deltas and
 *                  only render once the run finishes
 * - `never`        consumers should suppress all rendering for the run
 *
 * Filtering is NEVER applied inside the agent loop or an output processor
 * — it would gate the agent loop itself (tool-calls/results never reach
 * the loop's reducers and tools never execute). All policy lives in
 * consumers; see {@link AgentChannels} for the channel renderer
 * implementation.
 */
export type HeartbeatBroadcastMode = 'live' | 'on-complete' | 'never';

/**
 * Action to take when the target thread is actively streaming. Threaded only.
 * Reuses the signal runtime's active behavior so heartbeats accept whatever
 * `agent.sendSignal` allows.
 */
export type HeartbeatIfActive = AgentSignalActiveBehavior;

/**
 * Action to take when the target thread is idle. Threaded only. Reuses the
 * signal runtime's idle behavior so heartbeats accept whatever
 * `agent.sendSignal` allows.
 */
export type HeartbeatIfIdle = AgentSignalIdleBehavior;

/** Stable schedule id prefix for heartbeats. */
export const HEARTBEAT_SCHEDULE_PREFIX = 'hb_';

/**
 * Status reported by a single heartbeat run. The {@link HeartbeatWorker}
 * derives the scheduler trigger row's `outcome` (`succeeded`, `delivered`,
 * `persisted`, `discarded`, `skipped`, `aborted`, or `failed`) from this;
 * the status is also surfaced on the trigger row's metadata.
 *
 * Distinct from `ScheduleTriggerOutcome` (which describes scheduler-level
 * dispatch results); this describes what the heartbeat tick itself did.
 */
export type HeartbeatRunStatus =
  | 'fired'
  | 'signal-accepted'
  | 'skipped-thread-blocked'
  | 'thread-missing'
  | 'agent-missing'
  | 'invalid-input';

/**
 * Input payload persisted in `Schedule.target.inputData` for the built-in
 * heartbeat workflow. The scheduler tick rehydrates this on every fire.
 */
export const HeartbeatInputSchema = z.object({
  scheduleId: z.string(),
  agentId: z.string(),
  prompt: z.string(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  signalType: z.enum(['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder']).optional(),
  ifActive: z.enum(['deliver', 'persist', 'discard']).optional(),
  ifIdle: z.enum(['wake', 'persist', 'discard']).optional(),
  /**
   * Broadcast mode for the chunks produced by this heartbeat-driven run.
   * - `live` (default) — pass every chunk through
   * - `on-complete` — drop intermediate chunks; replay full text on finish
   * - `never` — drop every chunk (the run still happens server-side)
   */
  broadcast: HeartbeatBroadcastModeSchema.optional(),
});

export type HeartbeatInput = z.infer<typeof HeartbeatInputSchema>;

export const HeartbeatOutputSchema = z.object({
  status: z.enum([
    'fired',
    'signal-accepted',
    'skipped-thread-blocked',
    'thread-missing',
    'agent-missing',
    'invalid-input',
  ]),
  reason: z.string().optional(),
});

export type HeartbeatOutput = z.infer<typeof HeartbeatOutputSchema>;

// ---------------------------------------------------------------------------
// Lifecycle hooks
//
// User-defined callbacks configured via `new Mastra({ heartbeat: { ... } })`.
// A single hook bundle runs for every heartbeat fire; each context carries
// `agentId` so a hook can branch per agent. Mirror the
// `agent.stream` `onFinish`/`onError`/`onAbort` conventions so users learn one
// mental model. `prepare` lets users compute fire-time parameters (e.g. create
// a Slack thread per fire) or skip the fire entirely by returning null.
// ---------------------------------------------------------------------------

/** Effective parameters the heartbeat worker uses on a single fire. */
export type HeartbeatEffective = {
  threadId?: string;
  resourceId?: string;
  prompt: string;
  broadcast?: HeartbeatBroadcastMode;
  signalType?: AgentSignalType;
  ifActive?: HeartbeatIfActive;
  ifIdle?: HeartbeatIfIdle;
  attributes?: AgentSignalAttributes;
  providerOptions?: Record<string, unknown>;
};

/** Trigger context passed to every hook. */
export type HeartbeatTriggerInfo = {
  kind: 'cron' | 'manual';
  firedAt: Date;
};

/** Limited terminal-state snapshot for a heartbeat-driven agent run. */
export type HeartbeatRunResultSnapshot = {
  text?: string;
  usage?: Record<string, unknown>;
  finishReason?: string;
};

/** Forward-declared so this file does not import from `./heartbeats`. */
interface HeartbeatRef {
  id: string;
  agentId: string;
  name?: string;
  [key: string]: unknown;
}

/** Argument passed to `heartbeat.prepare`. */
export type HeartbeatPrepareContext<TMastra = unknown> = {
  mastra: TMastra;
  /** The agent this heartbeat fires. Convenience alias for `heartbeat.agentId`. */
  agentId: string;
  heartbeat: HeartbeatRef;
  trigger: HeartbeatTriggerInfo;
};

/**
 * Return value from `heartbeat.prepare`.
 *
 * - object    → merged into the row defaults; missing fields fall back to the row
 * - `null`    → skip this fire (outcome: 'skipped'); the worker records the trigger
 *               row and fires `onFinish({ outcome: 'skipped' })`
 * - `undefined` → use row defaults verbatim
 */
export type HeartbeatPrepareResult = Partial<HeartbeatEffective>;

/** Argument passed to `heartbeat.onFinish` for any non-error, non-abort outcome. */
export type HeartbeatFinishContext<TMastra = unknown> = {
  mastra: TMastra;
  /** The agent this heartbeat fires. Convenience alias for `heartbeat.agentId`. */
  agentId: string;
  heartbeat: HeartbeatRef;
  trigger: HeartbeatTriggerInfo;
  outcome: 'succeeded' | 'delivered' | 'persisted' | 'discarded' | 'skipped';
  /** Present for `succeeded` and `delivered` outcomes. */
  runId?: string;
  /** True when `outcome === 'delivered'` and the signal joined an active run. */
  joinedExistingRun?: boolean;
  /** Best-effort terminal snapshot; populated for `succeeded` runs. */
  result?: HeartbeatRunResultSnapshot;
  effective: HeartbeatEffective;
};

/** Argument passed to `heartbeat.onError` whenever `prepare`, `sendSignal`, or the agent run threw. */
export type HeartbeatErrorContext<TMastra = unknown> = {
  mastra: TMastra;
  /** The agent this heartbeat fires. Convenience alias for `heartbeat.agentId`. */
  agentId: string;
  heartbeat: HeartbeatRef;
  trigger: HeartbeatTriggerInfo;
  phase: 'prepare' | 'run';
  error: Error;
  runId?: string;
  /** Best-effort effective view; may be partial if `prepare` threw before merging. */
  effective?: HeartbeatEffective;
};

/** Argument passed to `heartbeat.onAbort` when the run was aborted mid-stream. */
export type HeartbeatAbortContext<TMastra = unknown> = {
  mastra: TMastra;
  /** The agent this heartbeat fires. Convenience alias for `heartbeat.agentId`. */
  agentId: string;
  heartbeat: HeartbeatRef;
  trigger: HeartbeatTriggerInfo;
  runId: string;
  effective: HeartbeatEffective;
};

/**
 * Bundle of lifecycle hooks. A single bundle runs for every heartbeat fire;
 * each context carries `agentId` so a hook can branch per agent.
 *
 * `onFinish` fires once per heartbeat trigger when the trigger reached a
 * non-error, non-abort terminal state. `onError` fires when `prepare`,
 * `sendSignal`, or the agent run threw. `onAbort` fires when the run was
 * aborted mid-stream. `prepare` can return overrides, `null` to skip, or
 * `undefined` to use row defaults.
 *
 * Hook exceptions are caught and logged; they never re-route the worker or
 * recurse into another hook.
 */
export type HeartbeatHooks<TMastra = unknown> = {
  prepare?: (
    ctx: HeartbeatPrepareContext<TMastra>,
  ) => Promise<HeartbeatPrepareResult | null | undefined> | HeartbeatPrepareResult | null | undefined;
  onFinish?: (ctx: HeartbeatFinishContext<TMastra>) => Promise<void> | void;
  onError?: (ctx: HeartbeatErrorContext<TMastra>) => Promise<void> | void;
  onAbort?: (ctx: HeartbeatAbortContext<TMastra>) => Promise<void> | void;
};

/**
 * Heartbeat runtime configuration passed to the Mastra constructor via
 * `heartbeat`. Holds a single lifecycle hook bundle that runs for every
 * heartbeat fire. Hooks live at the Mastra level so they apply to both
 * code-defined and stored agents (stored agents cannot define functions in
 * their serialized config). Each hook context carries `agentId`, so branch
 * on it when a hook should behave differently per agent.
 *
 * @example
 * ```typescript
 * new Mastra({
 *   heartbeat: {
 *     prepare: async ({ agentId, heartbeat }) => ({ threadId: '...' }),
 *     onFinish: async ({ agentId, trigger }) => { ... },
 *   },
 * });
 * ```
 */
export type HeartbeatConfig<TMastra = unknown> = HeartbeatHooks<TMastra>;

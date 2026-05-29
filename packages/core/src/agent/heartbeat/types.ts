import { z } from 'zod/v4';
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

/** Action to take when the target thread is actively streaming. Threaded only. */
export type HeartbeatIfActive = 'deliver' | 'persist' | 'discard';

/** Action to take when the target thread is idle. Threaded only. */
export type HeartbeatIfIdle = 'wake' | 'persist' | 'discard';

/**
 * Daily active-hours window. Outside the window heartbeat fires are
 * skipped (`status: 'skipped-outside-hours'`). Times are HH:mm in the
 * provided IANA `timezone` (defaults to UTC). When `start > end` the
 * window wraps midnight.
 */
export type HeartbeatActiveHours = {
  start: string;
  end: string;
  timezone?: string;
};

/** Stable schedule id prefix for heartbeats. */
export const HEARTBEAT_SCHEDULE_PREFIX = 'hb_';

/**
 * Status reported by a single heartbeat run. The {@link HeartbeatWorker}
 * derives the scheduler trigger row's `outcome` (`published`/`failed`)
 * from this; the status is also surfaced on the trigger row's metadata.
 *
 * Distinct from `ScheduleTriggerOutcome` (which describes scheduler-level
 * dispatch results); this describes what the heartbeat tick itself did.
 */
export type HeartbeatRunStatus =
  | 'fired'
  | 'signal-accepted'
  | 'skipped-outside-hours'
  | 'skipped-idle-threshold'
  | 'thread-missing'
  | 'agent-missing'
  | 'invalid-input';

/**
 * Active hours window — heartbeats only fire when `now` (in `timezone`) is
 * between `start` and `end` (24-hour `HH:mm` strings). When `start > end`
 * the window wraps midnight (e.g. 22:00-06:00 covers 22-23:59 and 0-6).
 */
export const ActiveHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm'),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm'),
  timezone: z.string().optional(),
});

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
  signalType: z.string().optional(),
  ifActive: z.enum(['deliver', 'persist', 'discard']).optional(),
  ifIdle: z.enum(['wake', 'persist', 'discard']).optional(),
  activeHours: ActiveHoursSchema.optional(),
  idleThresholdMs: z.number().int().positive().optional(),
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
    'skipped-outside-hours',
    'skipped-idle-threshold',
    'thread-missing',
    'agent-missing',
    'invalid-input',
  ]),
  reason: z.string().optional(),
});

export type HeartbeatOutput = z.infer<typeof HeartbeatOutputSchema>;

/**
 * @experimental Agent heartbeats are experimental and may change in a future release.
 *
 * Options accepted by {@link Agent.setHeartbeat}.
 */
export interface SetHeartbeatOptions {
  /** Cron expression (5-, 6-, or 7-part — croner syntax). Required. */
  cron: string;
  /** IANA timezone for the cron expression. Defaults to UTC. */
  timezone?: string;
  /**
   * Override the deterministic schedule id. Defaults to
   * `hb_<agentId>` (threadless) or `hb_<agentId>_<threadId>` (threaded).
   */
  id?: string;
  metadata?: Record<string, unknown>;

  /** When provided, runs the heartbeat against this thread via `agent.sendSignal`. */
  threadId?: string;
  /** Required when `threadId` is provided. Passed to `sendSignal`. */
  resourceId?: string;
  /** Prompt sent to the agent on each fire. */
  prompt: string;

  /**
   * Type of signal sent in threaded mode. Defaults to `'system-reminder'`,
   * so heartbeat-driven turns are surfaced as a system reminder rather than
   * appearing in the thread as a user message. Set to `'user-message'` if
   * you want the heartbeat to look like the user said something.
   * Ignored when `threadId` is not provided.
   */
  signalType?: string;
  /**
   * Behavior when the target thread already has an active run.
   * Defaults to `'discard'`. Ignored when `threadId` is not provided.
   */
  ifActive?: AgentSignalActiveBehavior;
  /**
   * Behavior when the target thread is idle.
   * Defaults to `'wake'`. Ignored when `threadId` is not provided.
   */
  ifIdle?: AgentSignalIdleBehavior;

  /** Only fire during this daily window. */
  activeHours?: { start: string; end: string; timezone?: string };
  /**
   * Skip the fire if the thread's `updatedAt` is within this many milliseconds.
   * Only meaningful in threaded mode; rejected otherwise.
   */
  idleThresholdMs?: number;
  /**
   * Broadcast policy for the chunks produced by this heartbeat-driven run.
   * Defaults to `'live'`.
   */
  broadcast?: HeartbeatBroadcastMode;
  /**
   * Schedule status. On create, omitting defaults to `'active'`. On update
   * of an existing heartbeat, omitting preserves the current status; pass
   * `'paused'` or `'active'` to flip it.
   */
  status?: 'active' | 'paused';
}

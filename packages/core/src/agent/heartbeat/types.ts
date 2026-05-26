import { z } from 'zod/v4';
import type { AgentSignalActiveBehavior, AgentSignalIdleBehavior } from '../types';

/**
 * Workflow id used for the built-in heartbeat workflow that fires per
 * scheduled tick for any heartbeat registered via {@link Agent.setHeartbeat}.
 *
 * Intentionally distinct from the `wf_` prefix used by declarative
 * `createWorkflow({ schedule })` rows so the declarative reconciler ignores it.
 */
export const HEARTBEAT_WORKFLOW_ID = '__mastra_heartbeat__';

/** Stable schedule id prefix for heartbeats. */
export const HEARTBEAT_SCHEDULE_PREFIX = 'hb_';

/**
 * Status reported by a single heartbeat run. Persisted via `recordTrigger`'s
 * `metadata.heartbeatStatus` field by the workflow step.
 *
 * Distinct from `ScheduleTriggerOutcome` (which describes scheduler-level
 * dispatch results like `published`/`failed`); this describes what the
 * heartbeat tick itself did.
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
   * Type of signal sent in threaded mode. Defaults to `'user-message'`.
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
}

import { z } from 'zod/v4';
import type { AgentSignalAttributes, AgentSignalType } from '../signals';
import type { AgentSignalActiveBehavior, AgentSignalIdleBehavior } from '../types';

/**
 * Serializable subset of `AgentExecutionOptions` that a heartbeat persists and
 * applies to the woken run. Heartbeat config is JSON-persisted to schedule
 * storage, so only JSON-safe fields are accepted here — non-serializable run
 * options (callbacks, abort signals, live handles) are excluded by design.
 *
 * `requestContext` is stored as a plain object and rehydrated into a
 * `RequestContext` by the worker before the wake signal runs. This is how a
 * heartbeat-woken run receives request context (e.g. channel render context).
 */
export type HeartbeatStreamOptions = {
  /** Request context applied to the woken run, stored as a plain object. */
  requestContext?: Record<string, unknown>;
};

/**
 * Options applied when the target thread is actively streaming. Threaded only.
 * Mirrors the signal runtime's `ifActive` options so heartbeats accept the same
 * shape `agent.sendSignal` allows.
 */
export type HeartbeatIfActive = {
  behavior?: AgentSignalActiveBehavior;
  attributes?: AgentSignalAttributes;
};

/**
 * Options applied when the target thread is idle. Threaded only. Mirrors the
 * signal runtime's `ifIdle` options, but `streamOptions` is restricted to the
 * serializable {@link HeartbeatStreamOptions} subset so the config can be
 * persisted to schedule storage.
 */
export type HeartbeatIfIdle = {
  behavior?: AgentSignalIdleBehavior;
  attributes?: AgentSignalAttributes;
  streamOptions?: HeartbeatStreamOptions;
};

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

/** Shared zod for {@link AgentSignalAttributes} (XML tag attribute values). */
const HeartbeatAttributesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

/** Serializable stream options applied to a woken run. See {@link HeartbeatStreamOptions}. */
const HeartbeatStreamOptionsSchema = z.object({
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

/** Options applied when the target thread is actively streaming. */
const HeartbeatIfActiveSchema = z.object({
  behavior: z.enum(['deliver', 'persist', 'discard']).optional(),
  attributes: HeartbeatAttributesSchema.optional(),
});

/** Options applied when the target thread is idle. */
const HeartbeatIfIdleSchema = z.object({
  behavior: z.enum(['wake', 'persist', 'discard']).optional(),
  attributes: HeartbeatAttributesSchema.optional(),
  streamOptions: HeartbeatStreamOptionsSchema.optional(),
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
  signalType: z.enum(['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder']).optional(),
  /**
   * XML tag name the signal renders as. Defaults to `heartbeat`, so a fire
   * surfaces to the agent as `<heartbeat>…</heartbeat>`. Override to render a
   * different tag.
   */
  tagName: z.string().optional(),
  /** Attributes rendered onto the signal's XML tag. */
  attributes: HeartbeatAttributesSchema.optional(),
  /**
   * Provider options merged into the heartbeat signal payload on every fire.
   * Stored as a plain JSON object (`MastraProviderMetadata` is JSON-safe) and
   * applied regardless of `ifActive` / `ifIdle`.
   */
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  ifActive: HeartbeatIfActiveSchema.optional(),
  ifIdle: HeartbeatIfIdleSchema.optional(),
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
  signalType?: AgentSignalType;
  tagName?: string;
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

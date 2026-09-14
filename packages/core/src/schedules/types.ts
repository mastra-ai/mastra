import { z } from 'zod/v4';
import type { AgentSignalAttributes, AgentSignalType } from '../agent/signals';
import type { AgentSignalActiveBehavior, AgentSignalIdleBehavior } from '../agent/types';

/**
 * Serializable subset of `AgentExecutionOptions` that an agent schedule persists and
 * applies to the woken run. Schedule config is JSON-persisted to schedule
 * storage, so only JSON-safe fields are accepted here — non-serializable run
 * options (callbacks, abort signals, live handles) are excluded by design.
 *
 * `requestContext` is stored as a plain object and rehydrated into a
 * `RequestContext` by the worker before the wake signal runs. This is how a
 * schedule-woken run receives request context (e.g. channel render context).
 */
export type ScheduleStreamOptions = {
  /** Request context applied to the woken run, stored as a plain object. */
  requestContext?: Record<string, unknown>;
};

/**
 * Options applied when the target thread is actively streaming. Threaded only.
 * Mirrors the signal runtime's `ifActive` options so agent schedules accept the same
 * shape `agent.sendSignal` allows.
 */
export type ScheduleIfActive = {
  /** Whether to deliver, persist or discard the signal when the target thread is active. */
  behavior?: AgentSignalActiveBehavior;
  /** Attributes merged into the signal when the active-thread branch applies. */
  attributes?: AgentSignalAttributes;
};

/**
 * Options applied when the target thread is idle. Threaded only. Mirrors the
 * signal runtime's `ifIdle` options, but `streamOptions` is restricted to the
 * serializable {@link ScheduleStreamOptions} subset so the config can be
 * persisted to schedule storage.
 */
export type ScheduleIfIdle = {
  /** Whether to wake the agent, persist the signal or discard it when the thread is idle. */
  behavior?: AgentSignalIdleBehavior;
  /** Attributes merged into the signal when the idle-thread branch applies. */
  attributes?: AgentSignalAttributes;
  /** Serializable execution options used when this branch wakes an agent run. */
  streamOptions?: ScheduleStreamOptions;
};

/** Stable schedule id prefix for agent schedules. */
export const AGENT_SCHEDULE_PREFIX = 'agent_';

/**
 * Stable schedule id prefix for imperative workflow schedules created via
 * `mastra.schedules.create({ workflowId, ... })`. Intentionally distinct from
 * the `wf_` prefix used by declarative `createWorkflow({ schedule })` rows —
 * the boot-time declarative sync sweeps `wf_` rows against the in-code
 * config and must never delete imperative rows.
 */
export const WORKFLOW_SCHEDULE_PREFIX = 'schedule_';

/**
 * Status reported by a single agent-schedule run. The {@link AgentScheduleWorker}
 * derives the scheduler trigger row's `outcome` (`succeeded`, `delivered`,
 * `persisted`, `discarded`, `skipped`, `aborted`, or `failed`) from this;
 * the status is also surfaced on the trigger row's metadata.
 *
 * Distinct from `ScheduleTriggerOutcome` (which describes scheduler-level
 * dispatch results); this describes what the agent-schedule tick itself did.
 */
export type ScheduleRunStatus =
  | 'fired'
  | 'signal-accepted'
  | 'skipped-thread-blocked'
  | 'thread-missing'
  | 'agent-missing'
  | 'invalid-input';

/**
 * Signal categories a schedule fire may use. Single runtime source for the zod
 * enum below and for schedule-definition validation, so the two can't drift.
 */
export const SCHEDULE_SIGNAL_TYPES = [
  'user',
  'state',
  'reactive',
  'notification',
  'user-message',
  'system-reminder',
] as const satisfies readonly AgentSignalType[];

/** Lifecycle statuses a schedule row may be created with. */
export const SCHEDULE_STATUSES = ['active', 'paused'] as const;

/** Shared zod for {@link AgentSignalAttributes} (XML tag attribute values). */
const ScheduleAttributesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

/** Serializable stream options applied to a woken run. See {@link ScheduleStreamOptions}. */
const ScheduleStreamOptionsSchema = z.object({
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

/** Options applied when the target thread is actively streaming. */
const ScheduleIfActiveSchema = z.object({
  behavior: z.enum(['deliver', 'persist', 'discard']).optional(),
  attributes: ScheduleAttributesSchema.optional(),
});

/** Options applied when the target thread is idle. */
const ScheduleIfIdleSchema = z.object({
  behavior: z.enum(['wake', 'persist', 'discard']).optional(),
  attributes: ScheduleAttributesSchema.optional(),
  streamOptions: ScheduleStreamOptionsSchema.optional(),
});

/**
 * Input payload persisted in `Schedule.target.inputData` for the built-in
 * agent-schedule fire. The scheduler tick rehydrates this on every fire.
 */
export const ScheduleInputSchema = z.object({
  scheduleId: z.string(),
  agentId: z.string(),
  prompt: z.string(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  signalType: z.enum(SCHEDULE_SIGNAL_TYPES).optional(),
  /**
   * XML tag name the signal renders as. Defaults to `schedule`, so a fire
   * surfaces to the agent as `<schedule>…</schedule>`. Override to render a
   * different tag.
   */
  tagName: z.string().optional(),
  /** Attributes rendered onto the signal's XML tag. */
  attributes: ScheduleAttributesSchema.optional(),
  /**
   * Provider options merged into the schedule signal payload on every fire.
   * Stored as a plain JSON object (`MastraProviderMetadata` is JSON-safe) and
   * applied regardless of `ifActive` / `ifIdle`.
   */
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  ifActive: ScheduleIfActiveSchema.optional(),
  ifIdle: ScheduleIfIdleSchema.optional(),
});

export type ScheduleInput = z.infer<typeof ScheduleInputSchema>;

export const ScheduleOutputSchema = z.object({
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

export type ScheduleOutput = z.infer<typeof ScheduleOutputSchema>;

// ---------------------------------------------------------------------------
// Lifecycle hooks
//
// User-defined callbacks configured via `new Mastra({ schedules: { ... } })`.
// A single hook bundle runs for every schedule fire; each context carries
// `agentId` so a hook can branch per agent. Mirror the
// `agent.stream` `onFinish`/`onError`/`onAbort` conventions so users learn one
// mental model. `prepare` lets users compute fire-time parameters (e.g. create
// a Slack thread per fire) or skip the fire entirely by returning null.
// ---------------------------------------------------------------------------

/** Effective parameters the agent-schedule worker uses on a single fire. */
export type ScheduleEffective = {
  /** Target thread for signal delivery. Omitted for an unthreaded run. */
  threadId?: string;
  /** Resource associated with the target thread or run. */
  resourceId?: string;
  /** Prompt content submitted for this fire. */
  prompt: string;
  /** Signal category or legacy alias used for threaded delivery. */
  signalType?: AgentSignalType;
  /** XML tag name used for the schedule signal. */
  tagName?: string;
  /** Delivery policy applied when the target thread is active. */
  ifActive?: ScheduleIfActive;
  /** Delivery policy and wake options applied when the target thread is idle. */
  ifIdle?: ScheduleIfIdle;
  /** XML attributes attached to the schedule signal. */
  attributes?: AgentSignalAttributes;
  /** Provider options attached to the schedule signal. */
  providerOptions?: Record<string, unknown>;
};

/** Trigger context passed to every hook. */
export type ScheduleTriggerInfo = {
  /** Whether this fire was scheduled or manually requested. */
  kind: 'cron' | 'manual';
  /** Actual fire time supplied by the worker, or the execution time when omitted. */
  firedAt: Date;
};

/** Limited terminal-state snapshot for a schedule-driven agent run. */
export type ScheduleRunResultSnapshot = {
  /** Generated text, when present on the completed result. */
  text?: string;
  /** Usage object retained from the completed result. */
  usage?: Record<string, unknown>;
  /** Finish reason reported by the completed result. */
  finishReason?: string;
};

/** Forward-declared so this file does not import from `./schedules`. */
interface ScheduleRef {
  /** Schedule identifier for this fire. */
  id: string;
  /** Agent targeted by the schedule. */
  agentId: string;
  /** Schedule display name, when available. */
  name?: string;
  /**
   * Additional fields from the stored schedule, when loading succeeds.
   * @param key - Name of an additional schedule field.
   */
  [key: string]: unknown;
}

/** Argument passed to `schedules.prepare`. */
export type SchedulePrepareContext<TMastra = unknown> = {
  /** Mastra instance executing the schedule. */
  mastra: TMastra;
  /** The agent this schedule fires. Convenience alias for `schedule.agentId`. */
  agentId: string;
  /** Stored schedule or a minimal fallback containing its identity. */
  schedule: ScheduleRef;
  /** Trigger kind and actual fire time. */
  trigger: ScheduleTriggerInfo;
};

/**
 * Return value from `schedules.prepare`.
 *
 * - object    → merged into the row defaults; missing fields fall back to the row
 * - `null`    → skip this fire (outcome: 'skipped'); the worker records the trigger
 *               row and fires `onFinish({ outcome: 'skipped' })`
 * - `undefined` → use row defaults verbatim
 */
export type SchedulePrepareResult = Partial<ScheduleEffective>;

/** Argument passed to `schedules.onFinish` for any non-error, non-abort outcome. */
export type ScheduleFinishContext<TMastra = unknown> = {
  /** Mastra instance executing the schedule. */
  mastra: TMastra;
  /** The agent this schedule fires. Convenience alias for `schedule.agentId`. */
  agentId: string;
  /** Stored schedule or a minimal fallback containing its identity. */
  schedule: ScheduleRef;
  /** Trigger kind and actual fire time. */
  trigger: ScheduleTriggerInfo;
  /** Dispatch outcome. A threaded `succeeded` wake does not wait for the agent run to finish. */
  outcome: 'succeeded' | 'delivered' | 'persisted' | 'discarded' | 'skipped';
  /** Run identifier when available, including a blocked run for a skipped wake. */
  runId?: string;
  /** True when `outcome === 'delivered'` and the signal joined an active run. */
  joinedExistingRun?: boolean;
  /** Best-effort terminal snapshot from a completed unthreaded run. Threaded wakes do not wait for a result. */
  result?: ScheduleRunResultSnapshot;
  /** Parameters used for this fire after merging preparation overrides. */
  effective: ScheduleEffective;
};

/** Argument passed to `schedules.onError` whenever `prepare`, `sendSignal`, or the agent run threw. */
export type ScheduleErrorContext<TMastra = unknown> = {
  /** Mastra instance executing the schedule. */
  mastra: TMastra;
  /** The agent this schedule fires. Convenience alias for `schedule.agentId`. */
  agentId: string;
  /** Stored schedule or a minimal fallback containing its identity. */
  schedule: ScheduleRef;
  /** Trigger kind and actual fire time. */
  trigger: ScheduleTriggerInfo;
  /** Whether preparation or dispatch/execution failed. */
  phase: 'prepare' | 'run';
  /** Error reported by the failed phase. */
  error: Error;
  /** Associated run identifier, when available. */
  runId?: string;
  /** Best-effort effective view; may be partial if `prepare` threw before merging. */
  effective?: ScheduleEffective;
};

/** Argument passed to `schedules.onAbort` when the run was aborted mid-stream. */
export type ScheduleAbortContext<TMastra = unknown> = {
  /** Mastra instance executing the schedule. */
  mastra: TMastra;
  /** The agent this schedule fires. Convenience alias for `schedule.agentId`. */
  agentId: string;
  /** Stored schedule or a minimal fallback containing its identity. */
  schedule: ScheduleRef;
  /** Trigger kind and actual fire time. */
  trigger: ScheduleTriggerInfo;
  /** Aborted run's identifier, falling back to the schedule ID when the error has none. */
  runId: string;
  /** Parameters used for this fire after merging preparation overrides. */
  effective: ScheduleEffective;
};

/**
 * Bundle of lifecycle hooks. A single bundle runs for every schedule fire;
 * each context carries `agentId` so a hook can branch per agent.
 *
 * `onFinish` fires once per schedule trigger when the trigger reached a
 * non-error, non-abort terminal state. `onError` fires when `prepare`,
 * `sendSignal`, or the agent run threw. `onAbort` fires when the run was
 * aborted mid-stream. `prepare` can return overrides, `null` to skip, or
 * `undefined` to use row defaults.
 *
 * Hook exceptions are caught and logged; they never re-route the worker or
 * recurse into another hook.
 */
export type ScheduleHooks<TMastra = unknown> = {
  /** Computes per-fire overrides, returns null to skip, or undefined to retain defaults. */
  prepare?: (
    /** Schedule identity, trigger and Mastra instance for this fire. */
    ctx: SchedulePrepareContext<TMastra>,
  ) => Promise<SchedulePrepareResult | null | undefined> | SchedulePrepareResult | null | undefined;
  /** Runs after threaded signal dispatch or unthreaded generation completes, including skipped fires. */
  onFinish?: (
    /** Dispatch outcome and effective parameters, with a result only when available. */
    ctx: ScheduleFinishContext<TMastra>,
  ) => Promise<void> | void;
  /** Handles preparation, validation or execution failures. */
  onError?: (
    /** Failure phase, error and available execution context. */
    ctx: ScheduleErrorContext<TMastra>,
  ) => Promise<void> | void;
  /** Handles abort errors thrown by unthreaded generation. */
  onAbort?: (
    /** Aborted run identity and effective fire parameters. */
    ctx: ScheduleAbortContext<TMastra>,
  ) => Promise<void> | void;
};

/**
 * Schedules runtime configuration passed to the Mastra constructor via
 * `schedules`. Holds a single lifecycle hook bundle that runs for every
 * schedule fire. Hooks live at the Mastra level so they apply to both
 * code-defined and stored agents (stored agents cannot define functions in
 * their serialized config). Each hook context carries `agentId`, so branch
 * on it when a hook should behave differently per agent.
 *
 * @example
 * ```typescript
 * new Mastra({
 *   schedules: {
 *     prepare: async ({ agentId, schedule }) => ({ threadId: '...' }),
 *     onFinish: async ({ agentId, trigger }) => { ... },
 *   },
 * });
 * ```
 */
export type SchedulesConfig<TMastra = unknown> = ScheduleHooks<TMastra>;

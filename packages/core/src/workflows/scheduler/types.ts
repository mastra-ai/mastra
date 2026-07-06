import type { ScheduleTarget } from '../../storage/domains/schedules/base';

/**
 * Declarative schedule configuration for a workflow. When set on a workflow,
 * the scheduler will publish a `workflow.start` event on the cron schedule.
 *
 * Only supported on the evented engine.
 *
 * A workflow may declare a single schedule (the `id` is optional and defaults
 * to a stable internal value), or an array of schedules where every entry
 * MUST provide a unique `id`. The id is combined with the workflow id to form
 * the storage key, so it must be stable across deploys — renaming an id is
 * treated as removing the old schedule and creating a new one (the fire
 * history of the old id is lost).
 */
export type WorkflowScheduleConfig<TInput = unknown, TState = unknown, TRequestContext = unknown> = {
  /**
   * Stable identifier for this schedule, scoped to its workflow. Required
   * when the workflow declares an array of schedules; optional (and defaults
   * to a single internal id) when the workflow declares a single schedule.
   */
  id?: string;
  /**
   * Cron expression (5-, 6-, or 7-part). Validated at workflow construction time.
   */
  cron: string;
  /**
   * Optional IANA timezone (e.g. 'America/New_York'). Defaults to the host timezone.
   */
  timezone?: string;
  /**
   * Static input data passed to each scheduled run. Type-checked against the
   * workflow's `inputSchema` when the schedule is declared inline on
   * `createWorkflow`.
   */
  inputData?: TInput;
  /**
   * Static initial state for each scheduled run. Type-checked against the
   * workflow's `stateSchema` when the schedule is declared inline on
   * `createWorkflow`.
   */
  initialState?: TState;
  /**
   * Optional request context applied to each scheduled run. Type-checked
   * against the workflow's `requestContextSchema` when the schedule is
   * declared inline on `createWorkflow`. Falls back to a generic record
   * when the workflow does not declare a `requestContextSchema`.
   */
  requestContext?: unknown extends TRequestContext ? Record<string, unknown> : TRequestContext;
  /**
   * Optional metadata persisted alongside the schedule row.
   */
  metadata?: Record<string, unknown>;
};

/**
 * Accepts either a single schedule config or an array of schedule configs.
 * When using the array form, every entry must specify a unique `id`.
 */
export type WorkflowScheduleInput<TInput = unknown, TState = unknown, TRequestContext = unknown> =
  | WorkflowScheduleConfig<TInput, TState, TRequestContext>
  | WorkflowScheduleConfig<TInput, TState, TRequestContext>[];

/**
 * Configuration for the `Scheduler` component owned by Mastra.
 */
export type SchedulerConfig = {
  /**
   * Explicitly enable the scheduler even when no declarative schedules
   * are present. Useful when schedules are managed imperatively.
   */
  enabled?: boolean;
  /**
   * Tick interval in ms. Defaults to 10_000 (10s).
   */
  tickIntervalMs?: number;
  /**
   * Maximum number of due schedules processed per tick. Defaults to 100.
   */
  batchSize?: number;
  /**
   * Optional callback invoked when a tick fails to publish a schedule.
   */
  onError?: (err: unknown, context: { scheduleId: string }) => void;
  /**
   * Predicate used to check whether a schedule's target is currently
   * registered with the host Mastra instance. For workflow targets the
   * predicate should resolve the workflow id; for agent targets it
   * should resolve the agent id. When provided, the scheduler refuses to
   * fire schedules whose target is unknown and deletes the row after a
   * small number of consecutive misses (see `missesBeforeDelete`).
   *
   * Wired up by `SchedulerWorker` from `mastra.getWorkflowById(...)` and
   * `mastra.getAgentById(...)`.
   */
  isTargetReady?: (target: ScheduleTarget) => boolean;
  /**
   * Number of consecutive ticks a schedule's target workflow may be missing
   * before the scheduler deletes the row. Defaults to 3 (≈30s with the
   * default tick interval). Provides a grace window for deploy/startup
   * ordering races where the scheduler ticks before workflows finish
   * registering.
   */
  missesBeforeDelete?: number;
};

/**
 * @deprecated Renamed to {@link SchedulerConfig}. The scheduler now drives both
 * workflow and agent schedules, so the `Workflow`-prefixed name is no longer
 * accurate. This alias will be removed in a future major release.
 */
export type WorkflowSchedulerConfig = SchedulerConfig;

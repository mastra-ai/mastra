/**
 * Declarative schedule configuration for a workflow. When set on a workflow,
 * the scheduler will publish a `workflow.start` event on the cron schedule.
 *
 * Only supported on the evented engine.
 */
export type WorkflowScheduleConfig = {
  /**
   * Cron expression (5-, 6-, or 7-part). Validated at workflow construction time.
   */
  cron: string;
  /**
   * Optional IANA timezone (e.g. 'America/New_York'). Defaults to the host timezone.
   */
  timezone?: string;
  /**
   * Static input data passed to each scheduled run.
   */
  inputData?: unknown;
  /**
   * Static initial state for each scheduled run.
   */
  initialState?: unknown;
  /**
   * Optional request context applied to each scheduled run.
   */
  requestContext?: Record<string, unknown>;
  /**
   * Optional metadata persisted alongside the schedule row.
   */
  metadata?: Record<string, unknown>;
};

/**
 * Configuration for the `WorkflowScheduler` component owned by Mastra.
 */
export type WorkflowSchedulerConfig = {
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
};

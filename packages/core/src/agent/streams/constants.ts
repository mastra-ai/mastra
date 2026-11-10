/**
 * Topics and event types of an agent's resumable run stream.
 */

/**
 * Generate the pubsub topic name for agent streaming events
 * @param runId - The unique run identifier
 * @returns The topic name for subscribing/publishing agent stream events
 */
export const AGENT_STREAM_TOPIC = (runId: string): string => `agent.stream.${runId}`;

/**
 * Generate the pubsub topic name for agent control messages.
 *
 * Separate from {@link AGENT_STREAM_TOPIC} because control messages travel the
 * opposite direction: stream events flow worker -> consumer, control messages
 * flow caller -> worker. Keeping them apart means stream consumers never see
 * control traffic and vice versa.
 *
 * @param runId - The unique run identifier
 * @returns The topic name for publishing/subscribing agent control events
 */
export const AGENT_CONTROL_TOPIC = (runId: string): string => `agent.control.${runId}`;

/**
 * Event type constants for agent control events
 */
export const AgentControlEventTypes = {
  /**
   * Request that a run abort itself. Published by `abort()` in whichever
   * process the caller lives in; handled by whichever process is actually
   * executing the run's steps.
   */
  ABORT_REQUEST: 'abort-request',
} as const;

/**
 * Event type constants for agent stream events
 */
export const AgentStreamEventTypes = {
  /** Chunk of streaming data (text, tool call, etc.) */
  CHUNK: 'chunk',
  /** Start of a new step in the agentic loop */
  STEP_START: 'step-start',
  /** End of a step in the agentic loop */
  STEP_FINISH: 'step-finish',
  /** Agent execution completed successfully */
  FINISH: 'finish',
  /** Error occurred during execution */
  ERROR: 'error',
  /** Workflow suspended (e.g., for tool approval) */
  SUSPENDED: 'suspended',
  /** Execution aborted by abortSignal */
  ABORT: 'abort',
  /** Single agentic-loop iteration completed (observability hook) */
  ITERATION_COMPLETE: 'iteration-complete',
  /**
   * A new execution claimed the run. Carries no chunk: consumers only raise
   * their generation so events the superseded execution still publishes are
   * dropped.
   */
  OWNERSHIP_CLAIMED: 'ownership-claimed',
} as const;

/** How long a finished run's stream stays replayable before it is cleaned up. */
export const DEFAULT_STREAM_CLEANUP_TIMEOUT_MS = 30_000;

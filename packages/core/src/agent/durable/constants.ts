/**
 * Constants for DurableAgent pubsub channels and event types
 */

/**
 * Symbol for passing run registry to workflow steps
 * This allows steps to access the actual model/tool instances
 */
export const RUN_REGISTRY_SYMBOL = Symbol('run_registry');

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
} as const;

/**
 * Default values for durable agent execution
 */
export const DurableAgentDefaults = {
  /** Default maximum number of agentic loop iterations */
  MAX_STEPS: 5,
  /**
   * Default tool call concurrency.
   * Applied by `resolveDurableToolCallConcurrency` when a run doesn't
   * configure `toolCallConcurrency`. Approval / suspend-capable tool sets
   * always run sequentially (concurrency: 1) regardless of this value.
   */
  TOOL_CALL_CONCURRENCY: 10,
} as const;

/**
 * Step IDs used in the durable agentic workflow
 */
export const DurableStepIds = {
  /** LLM execution step */
  LLM_EXECUTION: 'durable-llm-execution',
  /** Tool call step */
  TOOL_CALL: 'durable-tool-call',
  /** LLM mapping step (combines results) */
  LLM_MAPPING: 'durable-llm-mapping',
  /** Agentic execution workflow (one iteration) */
  AGENTIC_EXECUTION: 'durable-agentic-execution',
  /** Full agentic loop workflow */
  AGENTIC_LOOP: 'durable-agentic-loop',
  /** Scorer execution step */
  SCORER_EXECUTION: 'durable-scorer-execution',
  /** isTaskComplete evaluation step */
  IS_TASK_COMPLETE: 'durable-is-task-complete',
} as const;

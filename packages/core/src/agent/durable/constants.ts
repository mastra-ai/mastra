/**
 * Constants for DurableAgent pubsub channels and event types
 */

/**
 * Generate the pubsub topic name for agent streaming events
 * @param runId - The unique run identifier
 * @returns The topic name for subscribing/publishing agent stream events
 */
export const AGENT_STREAM_TOPIC = (runId: string): string => `agent.stream.${runId}`;

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
} as const;

/**
 * Default values for durable agent execution
 */
export const DurableAgentDefaults = {
  /** Default maximum number of agentic loop iterations */
  MAX_STEPS: 5,
  /** Default tool call concurrency */
  TOOL_CALL_CONCURRENCY: 10,
  /** Default temperature for LLM sampling */
  TEMPERATURE: 0,
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
} as const;

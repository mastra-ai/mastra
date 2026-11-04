/**
 * Constants for DurableAgent pubsub channels and event types
 */

/**
 * Symbol for passing run registry to workflow steps
 * This allows steps to access the actual model/tool instances
 */
export const RUN_REGISTRY_SYMBOL = Symbol('run_registry');

export {
  AGENT_STREAM_TOPIC,
  AGENT_CONTROL_TOPIC,
  AgentControlEventTypes,
  AgentStreamEventTypes,
} from '../streams/constants';

export const DURABLE_STOP_WHEN_ERROR_ID = 'DURABLE_AGENT_STOP_WHEN_FAILED';

const REJECT_STREAM_ERROR = Symbol('mastra.durable.rejectStreamError');

type RejectStreamError = Error & { [REJECT_STREAM_ERROR]?: true };

export function markErrorForStreamRejection(error: Error): Error {
  (error as RejectStreamError)[REJECT_STREAM_ERROR] = true;
  return error;
}

export function shouldRejectStream(error: Error): boolean {
  return (error as RejectStreamError)[REJECT_STREAM_ERROR] === true;
}

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

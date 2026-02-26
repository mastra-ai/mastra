import type { PubSub } from '../../../events/pubsub';
import type { RequestContext } from '../../../request-context';
import type { DurableAgenticWorkflowInput } from '../types';

/**
 * Result from workflow execution
 */
export interface WorkflowExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Error if execution failed */
  error?: Error;
  /** Status from the workflow result */
  status?: string;
}

/**
 * Interface for workflow executors.
 *
 * This abstraction allows different execution strategies:
 * - LocalWorkflowExecutor: Direct execution using run.start() (current behavior)
 * - EventedWorkflowExecutor: Fire-and-forget using EventedExecutionEngine
 * - (Future: InngestExecutor, CloudflareExecutor, etc.)
 */
export interface WorkflowExecutor {
  /**
   * Execute the workflow with the given input.
   *
   * @param workflow - The durable agentic workflow instance
   * @param input - Serialized workflow input
   * @param pubsub - PubSub instance for streaming events
   * @param runId - Unique identifier for this execution
   * @returns Promise that resolves when execution completes (or starts for async executors)
   */
  execute(
    workflow: any, // DurableAgenticWorkflow type - using any to avoid circular deps
    input: DurableAgenticWorkflowInput,
    pubsub: PubSub,
    runId: string,
    requestContext?: RequestContext,
  ): Promise<WorkflowExecutionResult>;

  /**
   * Resume a suspended workflow.
   *
   * @param workflow - The durable agentic workflow instance
   * @param pubsub - PubSub instance for streaming events
   * @param runId - Run ID of the suspended workflow
   * @param resumeData - Data to provide on resume
   * @param requestContext - Optional request context for tool execution
   * @returns Promise that resolves when resume completes (or starts for async executors)
   */
  resume(
    workflow: any, // DurableAgenticWorkflow type
    pubsub: PubSub,
    runId: string,
    resumeData: unknown,
    requestContext?: RequestContext,
  ): Promise<WorkflowExecutionResult>;
}

import type { PubSub } from '../../../events/pubsub';
import type { RequestContext } from '../../../request-context';
import type { DurableAgenticWorkflowInput } from '../types';
import type { WorkflowExecutor, WorkflowExecutionResult } from './types';

/**
 * Local workflow executor.
 *
 * Executes workflows directly using run.start(), which runs the workflow
 * in the current process. This is the default executor for DurableAgent.
 *
 * Use this when:
 * - You want immediate, synchronous execution
 * - You don't need external process management
 * - State persistence is handled by the workflow engine itself
 */
export class LocalWorkflowExecutor implements WorkflowExecutor {
  /**
   * Execute the workflow locally using run.start().
   */
  async execute(
    workflow: any,
    input: DurableAgenticWorkflowInput,
    pubsub: PubSub,
    runId: string,
    requestContext?: RequestContext,
  ): Promise<WorkflowExecutionResult> {
    try {
      // Create a run and start it, passing pubsub for streaming
      const run = await workflow.createRun({ runId, pubsub });
      const result = await run.start({ inputData: input, requestContext });

      // Check for errors in result
      if (result?.status === 'failed') {
        return {
          success: false,
          status: 'failed',
          error: new Error((result as any).error?.message || 'Workflow execution failed'),
        };
      }

      return {
        success: true,
        status: result?.status || 'completed',
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Resume a suspended workflow locally.
   */
  async resume(
    workflow: any,
    pubsub: PubSub,
    runId: string,
    resumeData: unknown,
    requestContext?: RequestContext,
  ): Promise<WorkflowExecutionResult> {
    try {
      const run = await workflow.createRun({ runId, pubsub });
      const result = await run.resume({ resumeData, requestContext });

      if (result?.status === 'failed') {
        return {
          success: false,
          status: 'failed',
          error: new Error((result as any).error?.message || 'Workflow resume failed'),
        };
      }

      return {
        success: true,
        status: result?.status || 'completed',
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * Singleton instance of LocalWorkflowExecutor.
 * Can be used directly without instantiation.
 */
export const localExecutor = new LocalWorkflowExecutor();

import type { PubSub } from '../../../events/pubsub';
import type { DurableAgenticWorkflowInput } from '../types';
import type { WorkflowExecutor, WorkflowExecutionResult } from './types';

/**
 * Evented workflow executor.
 *
 * Executes workflows asynchronously using run.startAsync(), which fires
 * the workflow execution in the background and returns immediately.
 * This is useful for:
 * - Fire-and-forget execution patterns
 * - Decoupling the caller from workflow completion
 * - Background processing with pubsub-based streaming
 *
 * Note: This executor returns success immediately when the workflow starts.
 * The actual workflow completion/failure is communicated via pubsub events.
 *
 * Use this when:
 * - You want to start a workflow and return immediately
 * - Results should be streamed via pubsub
 * - You don't need to wait for the workflow to complete
 */
export class EventedWorkflowExecutor implements WorkflowExecutor {
  /**
   * Execute the workflow asynchronously using run.startAsync().
   *
   * This fires the workflow in the background and returns immediately.
   * The caller should subscribe to pubsub to receive streaming events
   * and completion notifications.
   */
  async execute(
    workflow: any,
    input: DurableAgenticWorkflowInput,
    pubsub: PubSub,
    runId: string,
  ): Promise<WorkflowExecutionResult> {
    try {
      // Create a run and start it asynchronously (fire-and-forget)
      const run = await workflow.createRun({ runId, pubsub });
      await run.startAsync({ inputData: input });

      // startAsync returns immediately, so we report success for the initiation
      // Actual workflow completion is communicated via pubsub events
      return {
        success: true,
        status: 'started',
      };
    } catch (error) {
      // If we fail to even start the workflow, report the error
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Resume a suspended workflow asynchronously.
   *
   * Similar to execute, this fires the resume in the background
   * and returns immediately.
   */
  async resume(workflow: any, pubsub: PubSub, runId: string, resumeData: unknown): Promise<WorkflowExecutionResult> {
    try {
      const run = await workflow.createRun({ runId, pubsub });

      // startAsync with resume data - fire-and-forget
      // Note: The standard Run doesn't have resumeAsync, so we use the
      // resume method but don't await its completion via a wrapped promise
      this.resumeInBackground(run, resumeData);

      return {
        success: true,
        status: 'started',
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
   * Fire resume in background without awaiting completion.
   */
  private resumeInBackground(run: any, resumeData: unknown): void {
    // Fire and forget - errors are handled via pubsub
    run.resume({ resumeData }).catch(() => {
      // Errors are communicated via pubsub events
    });
  }
}

/**
 * Singleton instance of EventedWorkflowExecutor.
 * Can be used directly without instantiation.
 */
export const eventedExecutor = new EventedWorkflowExecutor();

import type { Mastra } from '@mastra/core/mastra';
import { DefaultExecutionEngine } from '@mastra/core/workflows';
import type {
  ExecutionEngineOptions,
  Step,
  StepResult,
  ExecutionContext,
  Emitter,
  TimeTravelExecutionParams,
} from '@mastra/core/workflows';
import type { RequestContext } from '@mastra/core/di';
import type { Span, SpanType, TracingContext } from '@mastra/core/observability';
import type { ChunkType } from '@mastra/core/stream';
import type { WritableStream } from 'node:stream/web';
import { getRuntime } from './runtime.workflow';
import type { VercelWorkflow } from './workflow';
import type { VercelRun } from './run';

/**
 * Vercel Execution Engine
 *
 * Extends DefaultExecutionEngine to provide durable execution using
 * Vercel's Workflow SDK. Overrides wrapDurableOperation to route
 * operations through the module-level runStep function which has
 * the "use step" directive.
 */
export class VercelExecutionEngine extends DefaultExecutionEngine {
  private _runId: string = '';
  private _workflowId: string = '';

  constructor(mastra: Mastra, options: ExecutionEngineOptions) {
    super({ mastra, options });
  }

  /**
   * Set the current run context. Called at the start of execute().
   */
  setRunContext(runId: string, workflowId: string): void {
    this._runId = runId;
    this._workflowId = workflowId;
  }

  /**
   * Wrap durable operations using Vercel's "use step" directive.
   *
   * Stores the operationFn closure on the VercelRun instance,
   * then calls runStep which executes with durability.
   * On replay, Vercel returns the cached result without executing.
   */
  async wrapDurableOperation<T>(
    operationId: string,
    operationFn: () => Promise<T>,
    _retryConfig?: { delay: number },
  ): Promise<T> {
    const workflow = this.mastra?.getWorkflowById(this._workflowId) as VercelWorkflow | undefined;
    const run = workflow?.runs?.get(this._runId) as VercelRun | undefined;

    if (!run) {
      // No run context - just run directly (shouldn't happen in normal flow)
      return operationFn();
    }

    run.pendingOperations.set(operationId, operationFn);
    try {
      // Call the user's registered runStep function (with "use step" directive)
      return (await getRuntime().runStep(operationId, this._runId, this._workflowId)) as T;
    } finally {
      run.pendingOperations.delete(operationId);
    }
  }

  // =============================================================================
  // Sleep Handling
  // =============================================================================

  /**
   * Sleep for a duration.
   * TODO: Investigate Vercel scheduling primitives for durable sleep.
   */
  async executeSleepDuration(duration: number, _sleepId: string, _workflowId: string): Promise<void> {
    // Fallback to setTimeout for now
    // In a production implementation, this should use Vercel's scheduling
    await new Promise(resolve => setTimeout(resolve, duration < 0 ? 0 : duration));
  }

  /**
   * Sleep until a specific date.
   * TODO: Investigate Vercel scheduling primitives for durable sleep.
   */
  async executeSleepUntilDate(date: Date, _sleepUntilId: string, _workflowId: string): Promise<void> {
    const duration = date.getTime() - Date.now();
    await new Promise(resolve => setTimeout(resolve, duration < 0 ? 0 : duration));
  }

  // =============================================================================
  // Nested Workflow Support
  // =============================================================================

  /**
   * Detect nested VercelWorkflow instances.
   */
  isNestedWorkflowStep(step: Step<any, any, any>): boolean {
    // Check if the step is a VercelWorkflow instance
    // We do a duck-type check to avoid circular imports
    return (step as any).engineType === 'vercel' && typeof (step as any).executionGraph !== 'undefined';
  }

  /**
   * Execute a nested VercelWorkflow.
   * TODO: Implement nested workflow execution.
   */
  async executeWorkflowStep(_params: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    executionContext: ExecutionContext;
    resume?: { steps: string[]; resumePayload: any; runId?: string };
    timeTravel?: TimeTravelExecutionParams;
    prevOutput: any;
    inputData: any;
    emitter: Emitter;
    startedAt: number;
    abortController: AbortController;
    requestContext: RequestContext;
    tracingContext: TracingContext;
    writableStream?: WritableStream<ChunkType>;
    stepSpan?: Span<SpanType>;
  }): Promise<StepResult<any, any, any, any> | null> {
    // For now, return null to use standard execution
    // TODO: Implement nested workflow support similar to InngestExecutionEngine
    return null;
  }

  /**
   * Provide Vercel-specific engine context to steps.
   */
  getEngineContext(): Record<string, any> {
    return { engineType: 'vercel' };
  }
}

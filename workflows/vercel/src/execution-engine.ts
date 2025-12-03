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
import { runStep } from './runtime.workflow';
import { serializeStepContext } from './context';
import type { VercelWorkflow } from './workflow';

/**
 * Vercel Execution Engine
 *
 * Extends DefaultExecutionEngine to provide durable execution using
 * Vercel's Workflow SDK. Routes step execution through the module-level
 * runStep function which has the "use step" directive.
 */
export class VercelExecutionEngine extends DefaultExecutionEngine {
  constructor(mastra: Mastra, options: ExecutionEngineOptions) {
    super({ mastra, options });
  }

  /**
   * Vercel requires context serialization for durable step execution.
   * When steps are replayed, context modifications must be captured
   * and restored from the memoized result.
   */
  requiresDurableContextSerialization(): boolean {
    return true;
  }

  /**
   * Execute a step with retry logic using Vercel's durable execution.
   *
   * Instead of executing the step directly, we route through the
   * module-level runStep function which has "use step" directive.
   * This enables Vercel's memoization and retry mechanisms.
   */
  async executeStepWithRetry<T>(
    stepId: string,
    _runStepFn: () => Promise<T>,
    params: {
      retries: number;
      delay: number;
      stepSpan?: Span<SpanType>;
      workflowId: string;
      runId: string;
    },
  ): Promise<{ ok: true; result: T } | { ok: false; error: { status: 'failed'; error: string; endedAt: number } }> {
    // Parse the operation ID to extract workflow and step IDs
    // Format: `workflow.${workflowId}.step.${stepId}`
    const parsed = this.parseStepOperationId(stepId);

    if (!parsed) {
      // If we can't parse the ID, fall back to default behavior
      return super.executeStepWithRetry(stepId, _runStepFn, params);
    }

    const { workflowId, actualStepId } = parsed;

    try {
      // Get the current execution state to serialize
      const serializedContext = serializeStepContext({
        runId: params.runId,
        workflowId: params.workflowId,
        state: this.getCurrentState(),
        stepResults: this.getCurrentStepResults(),
        executionPath: this.getCurrentExecutionPath(),
        retryCount: this.getOrGenerateRetryCount(actualStepId),
        requestContext: this.getCurrentRequestContext(),
        resumeData: this.getCurrentResumeData(),
        suspendData: this.getCurrentSuspendData(),
        format: this.getCurrentFormat(),
      });

      // Get the current input for the step
      const input = this.getCurrentInput();

      // Call the durable runStep function
      const stepOutput = await runStep(workflowId, actualStepId, input, serializedContext);

      // The result type depends on what the step returns
      return { ok: true, result: stepOutput as T };
    } catch (e) {
      // Handle errors
      const errorMessage = e instanceof Error ? e.message : String(e);

      params.stepSpan?.error({
        error: e instanceof Error ? e : new Error(String(e)),
        attributes: { status: 'failed' },
      });

      return {
        ok: false,
        error: {
          status: 'failed',
          error: `Error: ${errorMessage}`,
          endedAt: Date.now(),
        },
      };
    }
  }

  /**
   * Parse a step operation ID to extract workflow and step IDs.
   * Returns null if the ID doesn't match the expected format.
   */
  private parseStepOperationId(operationId: string): { workflowId: string; actualStepId: string } | null {
    // operationId format: `workflow.${workflowId}.step.${stepId}`
    const match = operationId.match(/^workflow\.(.+)\.step\.(.+)$/);
    if (!match) {
      return null;
    }
    return { workflowId: match[1]!, actualStepId: match[2]! };
  }

  // =============================================================================
  // State Tracking
  // These methods track current execution state for serialization.
  // They need to be set by the execution handlers before calling executeStepWithRetry.
  // =============================================================================

  private _currentState: Record<string, any> = {};
  private _currentStepResults: Record<string, StepResult<any, any, any, any>> = {};
  private _currentExecutionPath: number[] = [];
  private _currentRequestContext: RequestContext = new Map() as unknown as RequestContext;
  private _currentInput: unknown = undefined;
  private _currentResumeData: unknown = undefined;
  private _currentSuspendData: unknown = undefined;
  private _currentFormat: 'legacy' | 'vnext' | undefined = undefined;

  getCurrentState(): Record<string, any> {
    return this._currentState;
  }

  setCurrentState(state: Record<string, any>): void {
    this._currentState = state;
  }

  getCurrentStepResults(): Record<string, StepResult<any, any, any, any>> {
    return this._currentStepResults;
  }

  setCurrentStepResults(results: Record<string, StepResult<any, any, any, any>>): void {
    this._currentStepResults = results;
  }

  getCurrentExecutionPath(): number[] {
    return this._currentExecutionPath;
  }

  setCurrentExecutionPath(path: number[]): void {
    this._currentExecutionPath = path;
  }

  getCurrentRequestContext(): RequestContext {
    return this._currentRequestContext;
  }

  setCurrentRequestContext(ctx: RequestContext): void {
    this._currentRequestContext = ctx;
  }

  getCurrentInput(): unknown {
    return this._currentInput;
  }

  setCurrentInput(input: unknown): void {
    this._currentInput = input;
  }

  getCurrentResumeData(): unknown {
    return this._currentResumeData;
  }

  setCurrentResumeData(data: unknown): void {
    this._currentResumeData = data;
  }

  getCurrentSuspendData(): unknown {
    return this._currentSuspendData;
  }

  setCurrentSuspendData(data: unknown): void {
    this._currentSuspendData = data;
  }

  getCurrentFormat(): 'legacy' | 'vnext' | undefined {
    return this._currentFormat;
  }

  setCurrentFormat(format: 'legacy' | 'vnext' | undefined): void {
    this._currentFormat = format;
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
  async executeWorkflowStep(params: {
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

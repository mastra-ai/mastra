import { TripWire } from '../agent/trip-wire';
import type { RequestContext } from '../di';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { SerializedError } from '../error';
import { getErrorFromUnknown } from '../error/utils.js';
import type { PubSub } from '../events/pubsub';
import type { ObservabilityContext, Span, SpanType, TracingPolicy } from '../observability';
import { createObservabilityContext } from '../observability';
import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type {
  ExecuteConditionalParams,
  ExecuteForeachParams,
  ExecuteLoopParams,
  ExecuteParallelParams,
} from './handlers/control-flow';
import {
  executeConditional as executeConditionalHandler,
  executeForeach as executeForeachHandler,
  executeLoop as executeLoopHandler,
  executeParallel as executeParallelHandler,
} from './handlers/control-flow';
import type { ExecuteEntryParams, PersistStepUpdateParams } from './handlers/entry';
import { executeEntry as executeEntryHandler, persistStepUpdate as persistStepUpdateHandler } from './handlers/entry';
import type { ExecuteSleepParams, ExecuteSleepUntilParams } from './handlers/sleep';
import { executeSleep as executeSleepHandler, executeSleepUntil as executeSleepUntilHandler } from './handlers/sleep';
import type { ExecuteStepParams } from './handlers/step';
import { executeStep as executeStepHandler } from './handlers/step';
import type { ConditionFunction, ConditionFunctionParams, Step } from './step';
import type {
  FormattedWorkflowResult,
  DefaultEngineType,
  EntryExecutionResult,
  ExecutionContext,
  MutableContext,
  OutputWriter,
  RestartExecutionParams,
  SerializedStepFlowEntry,
  StepExecutionResult,
  StepFailure,
  StepFlowEntry,
  StepResult,
  StepTripwireInfo,
  TimeTravelExecutionParams,
} from './types';

// Re-export ExecutionContext for backwards compatibility
export type { ExecutionContext } from './types';

/**
 * Default implementation of the ExecutionEngine
 */
export class DefaultExecutionEngine extends ExecutionEngine {
  /**
   * The retryCounts map is used to keep track of the retry count for each step.
   * The step id is used as the key and the retry count is the value.
   */
  protected retryCounts = new Map<string, number>();

  /**
   * Get or generate the retry count for a step.
   * If the step id is not in the map, it will be added and the retry count will be 0.
   * If the step id is in the map, it will return the retry count.
   *
   * @param stepId - The id of the step.
   * @returns The retry count for the step.
   */
  getOrGenerateRetryCount(stepId: Step['id']) {
    if (this.retryCounts.has(stepId)) {
      const currentRetryCount = this.retryCounts.get(stepId) as number;
      const nextRetryCount = currentRetryCount + 1;

      this.retryCounts.set(stepId, nextRetryCount);

      return nextRetryCount;
    }

    const retryCount = 0;

    this.retryCounts.set(stepId, retryCount);

    return retryCount;
  }

  // =============================================================================
  // Execution Engine Hooks
  // These methods can be overridden by subclasses to customize execution behavior
  // =============================================================================

  /**
   * Check if a step is a nested workflow that requires special handling.
   * Override this in subclasses to detect platform-specific workflow types.
   *
   * @param _step - The step to check
   * @returns true if the step is a nested workflow, false otherwise
   */
  isNestedWorkflowStep(_step: Step<any, any, any>): boolean {
    return false;
  }

  /**
   * Execute the sleep duration. Override to use platform-specific sleep primitives.
   *
   * @param duration - The duration to sleep in milliseconds
   * @param _sleepId - Unique identifier for this sleep operation
   * @param _workflowId - The workflow ID (for constructing platform-specific IDs)
   */
  async executeSleepDuration(duration: number, _sleepId: string, _workflowId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration < 0 ? 0 : duration));
  }

  /**
   * Execute sleep until a specific date. Override to use platform-specific sleep primitives.
   *
   * @param date - The date to sleep until
   * @param _sleepUntilId - Unique identifier for this sleep operation
   * @param _workflowId - The workflow ID (for constructing platform-specific IDs)
   */
  async executeSleepUntilDate(date: Date, _sleepUntilId: string, _workflowId: string): Promise<void> {
    const time = date.getTime() - Date.now();
    await new Promise(resolve => setTimeout(resolve, time < 0 ? 0 : time));
  }

  /**
   * Wrap a durable operation (like dynamic sleep function evaluation).
   * Override to add platform-specific durability.
   *
   * @param _operationId - Unique identifier for this operation
   * @param operationFn - The function to execute
   * @returns The result of the operation
   */
  async wrapDurableOperation<T>(_operationId: string, operationFn: () => Promise<T>): Promise<T> {
    return operationFn();
  }

  /**
   * Get the engine context to pass to step execution functions.
   * Override to provide platform-specific engine primitives (e.g., Inngest step).
   *
   * @returns An object containing engine-specific context
   */
  getEngineContext(): Record<string, any> {
    return {};
  }

  /**
   * Evaluate a single condition for conditional execution.
   * Override to add platform-specific durability (e.g., Inngest step.run wrapper).
   *
   * @param conditionFn - The condition function to evaluate
   * @param index - The index of this condition
   * @param context - The execution context for the condition
   * @param operationId - Unique identifier for this operation
   * @returns The index if condition is truthy, null otherwise
   */
  async evaluateCondition(
    conditionFn: ConditionFunction<any, any, any, any, any, DefaultEngineType>,
    index: number,
    context: ConditionFunctionParams<any, any, any, any, any, DefaultEngineType>,
    operationId: string,
  ): Promise<number | null> {
    return this.wrapDurableOperation(operationId, async () => {
      const result = await conditionFn(context);
      return result ? index : null;
    });
  }

  /**
   * Handle step execution start - emit events and return start timestamp.
   * Override to add platform-specific durability (e.g., Inngest step.run wrapper).
   *
   * @param params - Parameters for step start
   * @returns The start timestamp (used by some engines like Inngest)
   */
  async onStepExecutionStart(params: {
    step: Step<string, any, any>;
    inputData: any;
    pubsub: PubSub;
    executionContext: ExecutionContext;
    stepCallId: string;
    stepInfo: Record<string, any>;
    operationId: string;
    skipEmits?: boolean;
  }): Promise<number> {
    return this.wrapDurableOperation(params.operationId, async () => {
      const startedAt = Date.now();
      if (!params.skipEmits) {
        await params.pubsub.publish(`workflow.events.v2.${params.executionContext.runId}`, {
          type: 'watch',
          runId: params.executionContext.runId,
          data: {
            type: 'workflow-step-start',
            payload: {
              id: params.step.id,
              stepCallId: params.stepCallId,
              ...params.stepInfo,
            },
          },
        });
      }
      return startedAt;
    });
  }

  /**
   * Execute a nested workflow step. Override to use platform-specific workflow invocation.
   * This hook is called when isNestedWorkflowStep returns true.
   *
   * Default behavior: returns null to indicate the base executeStep should handle it normally.
   * Inngest overrides this to use inngestStep.invoke() for nested workflows.
   *
   * @param params - Parameters for nested workflow execution
   * @returns StepResult if handled, null if should use default execution
   */
  async executeWorkflowStep(
    _params: ObservabilityContext & {
      step: Step<string, any, any>;
      stepResults: Record<string, StepResult<any, any, any, any>>;
      executionContext: ExecutionContext;
      resume?: {
        steps: string[];
        resumePayload: any;
        runId?: string;
      };
      timeTravel?: TimeTravelExecutionParams;
      prevOutput: any;
      inputData: any;
      pubsub: PubSub;
      startedAt: number;
      abortController: AbortController;
      requestContext: RequestContext;
      outputWriter?: OutputWriter;
      stepSpan?: Span<SpanType.WORKFLOW_STEP>;
      perStep?: boolean;
    },
  ): Promise<StepResult<any, any, any, any> | null> {
    // Default: return null to use standard execution
    // Subclasses (like Inngest) override to use platform-specific invocation
    return null;
  }

  // =============================================================================
  // Span Lifecycle Hooks
  // These methods can be overridden by subclasses (e.g., Inngest) to make span
  // creation/end durable across workflow replays.
  // =============================================================================

  /**
   * Create a child span for a workflow step.
   * Override to add durability (e.g., Inngest memoization).
   *
   * Default: creates span directly via parent span's createChildSpan.
   *
   * @param params - Parameters for span creation
   * @returns The created span, or undefined if no parent span or tracing disabled
   */
  async createStepSpan(params: {
    parentSpan: Span<SpanType> | undefined;
    stepId: string;
    operationId: string;
    options: {
      name: string;
      type: SpanType;
      input?: unknown;
      entityType?: string;
      entityId?: string;
      tracingPolicy?: TracingPolicy;
    };
    executionContext: ExecutionContext;
  }): Promise<Span<SpanType> | undefined> {
    // Default: create span directly (no durability)
    return params.parentSpan?.createChildSpan(params.options as any);
  }

  /**
   * End a workflow step span.
   * Override to add durability (e.g., Inngest memoization).
   *
   * Default: calls span.end() directly.
   *
   * @param params - Parameters for ending the span
   */
  async endStepSpan(params: {
    span: Span<SpanType> | undefined;
    operationId: string;
    endOptions: {
      output?: unknown;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    // Default: end span directly (no durability)
    params.span?.end(params.endOptions as any);
  }

  /**
   * Record an error on a workflow step span.
   * Override to add durability (e.g., Inngest memoization).
   *
   * Default: calls span.error() directly.
   *
   * @param params - Parameters for recording the error
   */
  async errorStepSpan(params: {
    span: Span<SpanType> | undefined;
    operationId: string;
    errorOptions: {
      error: Error;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    // Default: error span directly (no durability)
    params.span?.error(params.errorOptions as any);
  }

  /**
   * Create a generic child span (for control-flow operations like parallel, conditional, loop).
   * Override to add durability (e.g., Inngest memoization).
   *
   * Default: creates span directly via parent span's createChildSpan.
   *
   * @param params - Parameters for span creation
   * @returns The created span, or undefined if no parent span or tracing disabled
   */
  async createChildSpan(params: {
    parentSpan: Span<SpanType> | undefined;
    operationId: string;
    options: {
      name: string;
      type: SpanType;
      input?: unknown;
      attributes?: Record<string, unknown>;
      tracingPolicy?: TracingPolicy;
    };
    executionContext: ExecutionContext;
  }): Promise<Span<SpanType> | undefined> {
    // Default: create span directly (no durability)
    return params.parentSpan?.createChildSpan(params.options as any);
  }

  /**
   * End a generic child span (for control-flow operations).
   * Override to add durability (e.g., Inngest memoization).
   *
   * Default: calls span.end() directly.
   *
   * @param params - Parameters for ending the span
   */
  async endChildSpan(params: {
    span: Span<SpanType> | undefined;
    operationId: string;
    endOptions?: {
      output?: unknown;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    // Default: end span directly (no durability)
    params.span?.end(params.endOptions as any);
  }

  /**
   * Record an error on a generic child span (for control-flow operations).
   * Override to add durability (e.g., Inngest memoization).
   *
   * Default: calls span.error() directly.
   *
   * @param params - Parameters for recording the error
   */
  async errorChildSpan(params: {
    span: Span<SpanType> | undefined;
    operationId: string;
    errorOptions: {
      error: Error;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    // Default: error span directly (no durability)
    params.span?.error(params.errorOptions as any);
  }

  /**
   * Execute a step with retry logic.
   * Default engine: handles retries internally with a loop.
   * Inngest engine: overrides to throw RetryAfterError for external retry handling.
   *
   * @param stepId - Unique identifier for the step (used for durability)
   * @param runStep - The step execution function to run
   * @param params - Retry parameters and context
   * @returns Discriminated union: { ok: true, result: T } or { ok: false, error: ... }
   */
  async executeStepWithRetry<T>(
    stepId: string,
    runStep: () => Promise<T>,
    params: {
      retries: number;
      delay: number;
      stepSpan?: Span<SpanType>;
      workflowId: string;
      runId: string;
    },
  ): Promise<
    | {
        ok: true;
        result: T;
      }
    | {
        ok: false;
        error: {
          status: 'failed';
          error: Error;
          endedAt: number;
          tripwire?: StepTripwireInfo;
        };
      }
  > {
    for (let i = 0; i < params.retries + 1; i++) {
      if (i > 0 && params.delay) {
        await new Promise(resolve => setTimeout(resolve, params.delay));
      }
      try {
        const result = await this.wrapDurableOperation(stepId, runStep);
        return { ok: true, result };
      } catch (e) {
        if (i === params.retries) {
          // Retries exhausted - return failed result
          // Use getErrorFromUnknown directly on the original error to preserve custom properties
          const errorInstance = getErrorFromUnknown(e, {
            serializeStack: false,
            fallbackMessage: 'Unknown step execution error',
          });

          // Log the error for observability
          const mastraError = new MastraError(
            {
              id: 'WORKFLOW_STEP_INVOKE_FAILED',
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.USER,
              details: { workflowId: params.workflowId, runId: params.runId, stepId },
            },
            errorInstance,
          );
          this.logger?.trackException(mastraError);
          this.logger?.error(`Error executing step ${stepId}: ` + errorInstance?.stack);

          params.stepSpan?.error({
            error: mastraError,
            attributes: { status: 'failed' },
          });

          return {
            ok: false,
            error: {
              status: 'failed',
              error: errorInstance,
              endedAt: Date.now(),
              // Preserve TripWire data as plain object for proper serialization
              tripwire:
                e instanceof TripWire
                  ? {
                      reason: e.message,
                      retry: e.options?.retry,
                      metadata: e.options?.metadata,
                      processorId: e.processorId,
                    }
                  : undefined,
            },
          };
        }
        // Continue to next retry
      }
    }
    // Should never reach here, but TypeScript needs it
    return { ok: false, error: { status: 'failed', error: new Error('Unknown error'), endedAt: Date.now() } };
  }

  /**
   * Format an error for the workflow result.
   * Override to customize error formatting (e.g., include stack traces).
   */
  protected formatResultError(error: Error | unknown, lastOutput: StepResult<any, any, any, any>): SerializedError {
    const outputError = (lastOutput as StepFailure<any, any, any, any>)?.error;
    const errorSource = error || outputError;
    const errorInstance = getErrorFromUnknown(errorSource, {
      serializeStack: false,
      fallbackMessage: 'Unknown workflow error',
    });
    return errorInstance.toJSON();
  }

  protected async fmtReturnValue<TOutput>(
    _pubsub: PubSub,
    stepResults: Record<string, StepResult<any, any, any, any>>,
    lastOutput: StepResult<any, any, any, any>,
    error?: Error | unknown,
  ): Promise<TOutput> {
    // Strip nestedRunId from metadata (internal tracking for nested workflow retrieval)
    const cleanStepResults: Record<string, StepResult<any, any, any, any>> = {};
    for (const [stepId, stepResult] of Object.entries(stepResults)) {
      if (stepResult && typeof stepResult === 'object' && !Array.isArray(stepResult) && 'metadata' in stepResult) {
        const { metadata, ...rest } = stepResult as any;
        if (metadata) {
          const { nestedRunId: _nestedRunId, ...userMetadata } = metadata;
          if (Object.keys(userMetadata).length > 0) {
            cleanStepResults[stepId] = { ...rest, metadata: userMetadata };
          } else {
            cleanStepResults[stepId] = rest;
          }
        } else {
          cleanStepResults[stepId] = stepResult;
        }
      } else {
        cleanStepResults[stepId] = stepResult;
      }
    }

    const base: FormattedWorkflowResult = {
      status: lastOutput.status,
      steps: cleanStepResults,
      input: cleanStepResults.input,
    };

    if (lastOutput.status === 'success') {
      base.result = lastOutput.output;
    } else if (lastOutput.status === 'failed') {
      // Check if the failure was due to a TripWire
      const tripwireData = lastOutput?.tripwire;
      if (tripwireData instanceof TripWire) {
        // Use 'tripwire' status instead of 'failed' for tripwire errors (TripWire instance)
        base.status = 'tripwire';
        base.tripwire = {
          reason: tripwireData.message,
          retry: tripwireData.options?.retry,
          metadata: tripwireData.options?.metadata,
          processorId: tripwireData.processorId,
        };
      } else if (tripwireData && typeof tripwireData === 'object' && 'reason' in tripwireData) {
        // Use 'tripwire' status for plain tripwire data objects (already serialized)
        base.status = 'tripwire';
        base.tripwire = tripwireData;
      } else {
        base.error = this.formatResultError(error, lastOutput);
      }
    } else if (lastOutput.status === 'suspended') {
      const suspendPayload: Record<string, any> = {};
      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const { __workflow_meta, ...rest } = stepResult?.suspendPayload ?? {};
          suspendPayload[stepId] = rest;
          const nestedPath = __workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      });
      base.suspended = suspendedStepIds;
      base.suspendPayload = suspendPayload;
    }

    return base as TOutput;
  }

  // =============================================================================
  // Context Serialization Helpers
  // =============================================================================

  /**
   * Serialize a RequestContext Map to a plain object for JSON serialization.
   * Used by durable execution engines to persist context across step replays.
   */
  serializeRequestContext(requestContext: RequestContext): Record<string, any> {
    const obj: Record<string, any> = {};
    requestContext.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Deserialize a plain object back to a RequestContext Map.
   * Used to restore context after durable execution replay.
   */
  protected deserializeRequestContext(obj: Record<string, any>): RequestContext {
    return new Map(Object.entries(obj)) as unknown as RequestContext;
  }

  /**
   * Whether this engine requires requestContext to be serialized for durable operations.
   * Default engine passes by reference (no serialization needed).
   * Inngest engine overrides to return true (serialization required for memoization).
   */
  requiresDurableContextSerialization(): boolean {
    return false;
  }

  /**
   * Build MutableContext from current execution state.
   * This extracts only the fields that can change during step execution.
   */
  buildMutableContext(executionContext: ExecutionContext): MutableContext {
    return {
      state: executionContext.state,
      suspendedPaths: executionContext.suspendedPaths,
      resumeLabels: executionContext.resumeLabels,
    };
  }

  /**
   * Apply mutable context changes back to the execution context.
   */
  applyMutableContext(executionContext: ExecutionContext, mutableContext: MutableContext): void {
    Object.assign(executionContext.state, mutableContext.state);
    Object.assign(executionContext.suspendedPaths, mutableContext.suspendedPaths);
    Object.assign(executionContext.resumeLabels, mutableContext.resumeLabels);
  }

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    disableScorers?: boolean;
    graph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    input?: TInput;
    initialState?: TState;
    restart?: RestartExecutionParams;
    timeTravel?: TimeTravelExecutionParams;
    resume?: {
      // TODO: add execute path
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
      label?: string;
      forEachIndex?: number;
    };
    pubsub: PubSub;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    requestContext: RequestContext;
    workflowSpan?: Span<SpanType.WORKFLOW_RUN>;
    abortController: AbortController;
    outputWriter?: OutputWriter;
    format?: 'legacy' | 'vnext' | undefined;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
    /** Trace IDs for creating child spans in durable execution */
    tracingIds?: {
      traceId: string;
      workflowSpanId: string;
    };
  }): Promise<TOutput> {
    const {
      workflowId,
      runId,
      resourceId,
      graph,
      input,
      initialState,
      resume,
      retryConfig,
      workflowSpan,
      disableScorers,
      restart,
      timeTravel,
      perStep,
    } = params;
    const { attempts = 0, delay = 0 } = retryConfig ?? {};
    const steps = graph.steps;

    //clear retryCounts
    this.retryCounts.clear();

    if (steps.length === 0) {
      const empty_graph_error = new MastraError({
        id: 'WORKFLOW_EXECUTE_EMPTY_GRAPH',
        text: 'Workflow must have at least one step',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
      });

      workflowSpan?.error({ error: empty_graph_error });
      throw empty_graph_error;
    }

    let startIdx = 0;
    if (timeTravel) {
      startIdx = timeTravel.executionPath[0]!;
      timeTravel.executionPath.shift();
    } else if (restart) {
      startIdx = restart.activePaths[0]!;
      restart.activePaths.shift();
    } else if (resume?.resumePath) {
      startIdx = resume.resumePath[0]!;
      resume.resumePath.shift();
    }

    const stepResults: Record<string, any> = timeTravel?.stepResults ||
      restart?.stepResults ||
      resume?.stepResults || { input };
    let lastOutput: any;
    let lastState: Record<string, any> = timeTravel?.state ?? restart?.state ?? initialState ?? {};
    let lastExecutionContext: ExecutionContext | undefined;
    let currentRequestContext = params.requestContext;
    for (let i = startIdx; i < steps.length; i++) {
      const entry = steps[i]!;

      const executionContext: ExecutionContext = {
        workflowId,
        runId,
        executionPath: [i],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        retryConfig: { attempts, delay },
        format: params.format,
        state: lastState ?? initialState,
        // Tracing IDs for durable span operations (Inngest)
        tracingIds: params.tracingIds,
      };
      lastExecutionContext = executionContext;

      lastOutput = await this.executeEntry({
        workflowId,
        runId,
        resourceId,
        entry,
        executionContext,
        serializedStepGraph: params.serializedStepGraph,
        prevStep: steps[i - 1]!,
        stepResults,
        resume,
        timeTravel,
        restart,
        ...createObservabilityContext({ currentSpan: workflowSpan }),
        abortController: params.abortController,
        pubsub: params.pubsub,
        requestContext: currentRequestContext,
        outputWriter: params.outputWriter,
        disableScorers,
        perStep,
      });

      // Apply mutable context changes from entry execution
      this.applyMutableContext(executionContext, lastOutput.mutableContext);
      lastState = lastOutput.mutableContext.state;
      // Update requestContext from step result (only for engines that serialize context)
      // Default engine keeps the original reference, Inngest deserializes from memoized result
      if (this.requiresDurableContextSerialization() && lastOutput.requestContext) {
        currentRequestContext = this.deserializeRequestContext(lastOutput.requestContext);
      }

      // if step result is not success, stop and return
      if (lastOutput.result.status !== 'success') {
        if (lastOutput.result.status === 'bailed') {
          lastOutput.result.status = 'success';
        }

        const result = (await this.fmtReturnValue(params.pubsub, stepResults, lastOutput.result)) as any;
        await this.persistStepUpdate({
          workflowId,
          runId,
          resourceId,
          stepResults: lastOutput.stepResults,
          serializedStepGraph: params.serializedStepGraph,
          executionContext,
          workflowStatus: result.status,
          result: result.result,
          error: result.error,
          requestContext: currentRequestContext,
        });

        if (result.error) {
          workflowSpan?.error({
            error: result.error,
            attributes: {
              status: result.status,
            },
          });
        } else {
          workflowSpan?.end({
            output: result.result,
            attributes: {
              status: result.status,
            },
          });
        }

        if (lastOutput.result.status !== 'paused') {
          // Invoke lifecycle callbacks before returning
          await this.invokeLifecycleCallbacks({
            status: result.status,
            result: result.result,
            error: result.error,
            steps: result.steps,
            tripwire: result.tripwire,
            runId,
            workflowId,
            resourceId,
            input,
            requestContext: currentRequestContext,
            state: lastState,
          });
        }

        if (lastOutput.result.status === 'paused') {
          await params.pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: { type: 'workflow-paused', payload: {} },
          });
        }

        return {
          ...result,
          ...(lastOutput.result.status === 'suspended' && params.outputOptions?.includeResumeLabels
            ? { resumeLabels: lastOutput.mutableContext.resumeLabels }
            : {}),
          ...(params.outputOptions?.includeState ? { state: lastState } : {}),
        };
      }

      if (perStep) {
        const result = (await this.fmtReturnValue(params.pubsub, stepResults, lastOutput.result)) as any;
        await this.persistStepUpdate({
          workflowId,
          runId,
          resourceId,
          stepResults: lastOutput.stepResults,
          serializedStepGraph: params.serializedStepGraph,
          executionContext: lastExecutionContext!,
          workflowStatus: 'paused',
          requestContext: currentRequestContext,
        });

        await params.pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'workflow-paused', payload: {} },
        });

        workflowSpan?.end({
          attributes: {
            status: 'paused',
          },
        });

        delete result.result;

        return { ...result, status: 'paused', ...(params.outputOptions?.includeState ? { state: lastState } : {}) };
      }
    }

    // after all steps are successful, return result
    const result = (await this.fmtReturnValue(params.pubsub, stepResults, lastOutput.result)) as any;
    await this.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      stepResults: lastOutput.stepResults,
      serializedStepGraph: params.serializedStepGraph,
      executionContext: lastExecutionContext!,
      workflowStatus: result.status,
      result: result.result,
      error: result.error,
      requestContext: currentRequestContext,
    });

    workflowSpan?.end({
      output: result.result,
      attributes: {
        status: result.status,
      },
    });

    await this.invokeLifecycleCallbacks({
      status: result.status,
      result: result.result,
      error: result.error,
      steps: result.steps,
      tripwire: result.tripwire,
      runId,
      workflowId,
      resourceId,
      input,
      requestContext: currentRequestContext,
      state: lastState,
    });

    if (params.outputOptions?.includeState) {
      return { ...result, state: lastState };
    }
    return result;
  }

  getStepOutput(stepResults: Record<string, any>, step?: StepFlowEntry): any {
    if (!step) {
      return stepResults.input;
    } else if (step.type === 'step') {
      return stepResults[step.step.id]?.output;
    } else if (step.type === 'sleep' || step.type === 'sleepUntil') {
      return stepResults[step.id]?.output;
    } else if (step.type === 'parallel' || step.type === 'conditional') {
      return step.steps.reduce(
        (acc, entry) => {
          acc[entry.step.id] = stepResults[entry.step.id]?.output;
          return acc;
        },
        {} as Record<string, any>,
      );
    } else if (step.type === 'loop') {
      return stepResults[step.step.id]?.output;
    } else if (step.type === 'foreach') {
      return stepResults[step.step.id]?.output;
    }
  }

  async executeSleep(params: ExecuteSleepParams): Promise<void> {
    return executeSleepHandler(this, params);
  }

  async executeSleepUntil(params: ExecuteSleepUntilParams): Promise<void> {
    return executeSleepUntilHandler(this, params);
  }

  async executeStep(params: ExecuteStepParams): Promise<StepExecutionResult> {
    return executeStepHandler(this, params);
  }

  async executeParallel(params: ExecuteParallelParams): Promise<StepResult<any, any, any, any>> {
    return executeParallelHandler(this, params);
  }

  async executeConditional(params: ExecuteConditionalParams): Promise<StepResult<any, any, any, any>> {
    return executeConditionalHandler(this, params);
  }

  async executeLoop(params: ExecuteLoopParams): Promise<StepResult<any, any, any, any>> {
    return executeLoopHandler(this, params);
  }

  async executeForeach(params: ExecuteForeachParams): Promise<StepResult<any, any, any, any>> {
    return executeForeachHandler(this, params);
  }

  async persistStepUpdate(params: PersistStepUpdateParams): Promise<void> {
    return persistStepUpdateHandler(this, params);
  }

  async executeEntry(params: ExecuteEntryParams): Promise<EntryExecutionResult> {
    return executeEntryHandler(this, params);
  }
}

import { MastraBase } from '../base';
import type { RequestContext } from '../di';
import type { PubSub } from '../events/pubsub';
import { RegisteredLogger } from '../logger';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { Span, SpanType, TracingPolicy } from '../observability';
import type {
  OutputWriter,
  SerializedStepFlowEntry,
  StepResult,
  WorkflowRunStatus,
  WorkflowFinishCallbackResult,
  WorkflowErrorCallbackInfo,
} from './types';
import type { RestartExecutionParams, StepFlowEntry, TimeTravelExecutionParams } from '.';

/**
 * Represents an execution graph for a workflow
 */
export interface ExecutionGraph<TEngineType = any> {
  id: string;
  steps: StepFlowEntry<TEngineType>[];
  // Additional properties will be added in future implementations
}

export interface ExecutionEngineOptions {
  tracingPolicy?: TracingPolicy;
  validateInputs: boolean;
  shouldPersistSnapshot: (params: {
    stepResults: Record<string, StepResult<any, any, any, any>>;
    workflowStatus: WorkflowRunStatus;
  }) => boolean;

  /**
   * Called when workflow execution completes (success, failed, suspended, or tripwire).
   * Errors thrown in this callback are caught and logged, not propagated.
   */
  onFinish?: (result: WorkflowFinishCallbackResult) => Promise<void> | void;

  /**
   * Called only when workflow execution fails (failed or tripwire status).
   * Errors thrown in this callback are caught and logged, not propagated.
   */
  onError?: (errorInfo: WorkflowErrorCallbackInfo) => Promise<void> | void;
}
/**
 * Execution engine abstract class for building and executing workflow graphs
 * Providers will implement this class to provide their own execution logic
 */
export abstract class ExecutionEngine extends MastraBase {
  public mastra?: Mastra;
  public options: ExecutionEngineOptions;
  constructor({ mastra, options }: { mastra?: Mastra; options: ExecutionEngineOptions }) {
    super({ name: 'ExecutionEngine', component: RegisteredLogger.WORKFLOW });
    this.mastra = mastra;
    this.options = options;
  }

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
  }

  public getLogger(): IMastraLogger {
    return this.logger;
  }

  /**
   * Invokes the onFinish and onError lifecycle callbacks if they are defined.
   * Errors in callbacks are caught and logged, not propagated.
   * @param result The workflow result containing status, result, error, steps, tripwire info, and context
   */
  public async invokeLifecycleCallbacks(result: {
    status: WorkflowRunStatus;
    result?: any;
    error?: any;
    steps: Record<string, StepResult<any, any, any, any>>;
    tripwire?: any;
    runId: string;
    workflowId: string;
    resourceId?: string;
    input?: any;
    requestContext: RequestContext;
    state: Record<string, any>;
  }): Promise<void> {
    const { onFinish, onError } = this.options;

    // Build common context for callbacks
    const commonContext = {
      runId: result.runId,
      workflowId: result.workflowId,
      resourceId: result.resourceId,
      getInitData: () => result.input,
      mastra: this.mastra,
      requestContext: result.requestContext,
      logger: this.logger,
      state: result.state,
    };

    // Always call onFinish if defined (for any terminal status)
    if (onFinish) {
      try {
        await Promise.resolve(
          onFinish({
            status: result.status,
            result: result.result,
            error: result.error,
            steps: result.steps,
            tripwire: result.tripwire,
            ...commonContext,
          }),
        );
      } catch (err) {
        this.logger.error('Error in onFinish callback', { error: err });
      }
    }

    // Call onError only for failure states (failed or tripwire)
    if (onError && (result.status === 'failed' || result.status === 'tripwire')) {
      try {
        await Promise.resolve(
          onError({
            status: result.status as 'failed' | 'tripwire',
            error: result.error,
            steps: result.steps,
            tripwire: result.tripwire,
            ...commonContext,
          }),
        );
      } catch (err) {
        this.logger.error('Error in onError callback', { error: err });
      }
    }
  }

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  abstract execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    disableScorers?: boolean;
    graph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    input?: TInput;
    initialState?: TState;
    timeTravel?: TimeTravelExecutionParams;
    restart?: RestartExecutionParams;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
      forEachIndex?: number;
      label?: string;
    };
    pubsub: PubSub;
    requestContext: RequestContext;
    workflowSpan?: Span<SpanType.WORKFLOW_RUN>;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    abortController: AbortController;
    outputWriter?: OutputWriter;
    format?: 'legacy' | 'vnext' | undefined;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
    tracingIds?: {
      traceId: string;
      workflowSpanId: string;
    };
  }): Promise<TOutput>;
}

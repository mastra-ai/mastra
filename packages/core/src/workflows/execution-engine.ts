import type { ActorSignal } from '../auth/ee';
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
  WorkflowRunState,
  WorkflowFinishCallbackResult,
  WorkflowErrorCallbackInfo,
  WorkflowStartCallbackInfo,
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
  emitStepEvents?: boolean;
  shouldPersistSnapshot: (params: {
    stepResults: Record<string, StepResult<any, any, any, any>>;
    workflowStatus: WorkflowRunStatus;
  }) => boolean;

  /**
   * Transforms the run snapshot immediately before it is persisted.
   * Must be pure and return JSON-safe data. Defaults to identity.
   */
  pruneSnapshot?: (params: { snapshot: WorkflowRunState; workflowStatus: WorkflowRunStatus }) => WorkflowRunState;

  /**
   * Called and awaited before a run starts executing. Errors are propagated, which
   * aborts the run before any step executes.
   */
  onStart?: (info: WorkflowStartCallbackInfo) => Promise<void> | void;

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

  /**
   * Per-run overrides of `options.shouldPersistSnapshot`, keyed by runId.
   *
   * `options` is shared by every run of a workflow, so persistence is otherwise a
   * per-workflow decision. Some callers need it per run: an agent output processor
   * executes its workflow once per streamed chunk, and those runs must never write
   * snapshots even when the same workflow instance persists normally when the user
   * starts it directly (#19605).
   */
  private runPersistenceOverrides = new Map<string, ExecutionEngineOptions['shouldPersistSnapshot']>();

  constructor({ mastra, options }: { mastra?: Mastra; options: ExecutionEngineOptions }) {
    super({ name: 'ExecutionEngine', component: RegisteredLogger.WORKFLOW });
    this.mastra = mastra;
    this.options = options;
  }

  /** Registers a run-scoped `shouldPersistSnapshot` predicate. */
  setRunPersistenceOverride(
    runId: string,
    shouldPersistSnapshot: ExecutionEngineOptions['shouldPersistSnapshot'],
  ): void {
    this.runPersistenceOverrides.set(runId, shouldPersistSnapshot);
  }

  /** Returns the run-scoped `shouldPersistSnapshot` predicate, if one was registered. */
  getRunPersistenceOverride(runId: string): ExecutionEngineOptions['shouldPersistSnapshot'] | undefined {
    return this.runPersistenceOverrides.get(runId);
  }

  /** Clears the run-scoped predicate (called on run cleanup). */
  clearRunPersistenceOverride(runId: string): void {
    this.runPersistenceOverrides.delete(runId);
  }

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
    const logger = mastra?.getLogger();
    if (logger) {
      this.__setLogger(logger);
    }
  }

  public getLogger(): IMastraLogger {
    return this.logger;
  }

  /**
   * Invokes the onStart lifecycle callback if it is defined, before any step runs.
   * Errors are intentionally propagated so the hook can gate the run (for example a
   * quota check): the caller rejects and the run never executes.
   */
  public async invokeStartCallback(info: Omit<WorkflowStartCallbackInfo, 'mastra' | 'logger'>): Promise<void> {
    const { onStart } = this.options;
    if (!onStart) {
      return;
    }

    await onStart({ ...info, mastra: this.mastra, logger: this.logger });
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
    stepExecutionPath?: string[];
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
      stepExecutionPath: result.stepExecutionPath,
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
      stepExecutionPath?: string[];
      forEachIndex?: number;
      label?: string;
    };
    pubsub: PubSub;
    requestContext: RequestContext;
    actor?: ActorSignal;
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
  }): Promise<TOutput>;
}

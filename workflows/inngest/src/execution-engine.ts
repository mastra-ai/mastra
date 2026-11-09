import { AsyncLocalStorage } from 'node:async_hooks';
import { emitSuspendedEvent } from '@mastra/core/agent/durable';
import type { ActorSignal } from '@mastra/core/auth/ee';
import type { RequestContext } from '@mastra/core/di';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { SerializedError } from '@mastra/core/error';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { EntityType, SpanOutcomeFields } from '@mastra/core/observability';
import { applyStatePatch } from '@mastra/core/storage';
import { DefaultExecutionEngine, createTimeTravelExecutionParams } from '@mastra/core/workflows';
import type {
  ExecutionContext,
  Step,
  StepResult,
  StepFailure,
  ExecutionEngineOptions,
  TimeTravelExecutionParams,
  StepFlowEntry,
  WorkflowRunState,
} from '@mastra/core/workflows';
import type { Inngest, BaseContext } from 'inngest';
import { NonRetriableError } from 'inngest';
import { serializeRequestContext } from './durable-event-payload';
import type { LeafCandidate, LeafInvokeData, LeafRequest, LeafReturn } from './leaf/contracts';
import {
  injectLeafFault,
  isLeafInfrastructureError,
  LeafInfrastructureError,
  NOT_CANCELED_STATUSES,
} from './leaf/contracts';
import { findGraphStep } from './leaf/execute-leaf';
import type { InngestRunWriter } from './leaf/run-writer';
import type { NestedWorkflowResult } from './nested-workflow-output';
import { NESTED_WORKFLOW_OUTPUT_MODE } from './nested-workflow-output';
import { workflowTermination } from './observability-compat';
import { isNonRetryableStepFailure } from './step-failure';
import { InngestWorkflow } from './workflow';

const retryCountStorage = new AsyncLocalStorage<number>();

type ExecuteStepParams = Parameters<DefaultExecutionEngine['executeStep']>[0];
type PersistStepUpdateParams = Parameters<DefaultExecutionEngine['persistStepUpdate']>[0];

/** The step whose `executeStepWithRetry` runs as a leaf, set around that step's `executeStep`. */
const leafStepStorage = new AsyncLocalStorage<{ params: ExecuteStepParams; used: boolean } | undefined>();

/** How a storage v2 run's engine runs its steps as leaves and writes the run. */
export interface LeafExecutionConfig {
  writer: InngestRunWriter;
  /** The Inngest run driving this execution; a resume is a new drive. */
  driveId: string;
  leafFunction: ReturnType<Inngest['createFunction']>;
  graph: StepFlowEntry[];
  actor?: unknown;
}

const BUILTIN_ERROR_TYPES = [TypeError, RangeError, ReferenceError, SyntaxError, EvalError, URIError, AggregateError];

export class InngestExecutionEngine extends DefaultExecutionEngine {
  private inngestStep: BaseContext<Inngest>['step'];
  private inngestAttempts: number;

  constructor(
    mastra: Mastra,
    inngestStep: BaseContext<Inngest>['step'],
    inngestAttempts: number = 0,
    options: ExecutionEngineOptions,
    private parentStream?: { workflowId: string; runId: string },
  ) {
    super({ mastra, options });
    this.inngestStep = inngestStep;
    this.inngestAttempts = inngestAttempts;
  }

  #leaf?: LeafExecutionConfig;
  readonly #occurrences = new Map<string, number>();

  /** Runs this execution's plain steps as leaves and writes the run as storage v2. */
  enableLeafExecution(config: LeafExecutionConfig): void {
    this.#leaf = config;
  }

  get leafExecution(): LeafExecutionConfig | undefined {
    return this.#leaf;
  }

  override getOrGenerateRetryCount(_stepId: string): number {
    return retryCountStorage.getStore() ?? 0;
  }

  // =============================================================================
  // Hook Overrides
  // =============================================================================

  /**
   * Format errors while preserving Error instances and their custom properties.
   * Uses getErrorFromUnknown to ensure all error properties are preserved.
   */
  protected formatResultError(
    error: Error | string | undefined,
    lastOutput: StepResult<any, any, any, any>,
  ): SerializedError {
    const outputError = (lastOutput as StepFailure<any, any, any, any>)?.error;
    const errorSource = error || outputError;
    const errorInstance = getErrorFromUnknown(errorSource, {
      serializeStack: true, // Include stack in JSON for better debugging in Inngest
      fallbackMessage: 'Unknown workflow error',
    });
    return errorInstance.toJSON();
  }

  /**
   * Detect InngestWorkflow instances for special nested workflow handling
   */
  isNestedWorkflowStep(step: Step<any, any, any>): boolean {
    return step instanceof InngestWorkflow;
  }

  /**
   * Inngest requires requestContext serialization for memoization.
   * When steps are replayed, the original function doesn't re-execute,
   * so requestContext modifications must be captured and restored.
   */
  requiresDurableContextSerialization(): boolean {
    return true;
  }

  /**
   * Execute a step with retry logic for Inngest.
   * Each attempt is its own step.run() that fails as NonRetriableError, so Inngest never
   * retries step code; this loop owns the retries. After retries are exhausted we return
   * a failed result instead of rethrowing.
   */
  async executeStepWithRetry<T>(
    stepId: string,
    runStep: () => Promise<T>,
    params: {
      retries: number;
      delay: number;
      stepSpan?: any;
      workflowId: string;
      runId: string;
    },
  ): Promise<
    | { ok: true; result: T }
    | { ok: false; error: { status: 'failed'; error: Error; endedAt: number; nonRetryable?: true } }
  > {
    const leafStep = leafStepStorage.getStore();
    if (leafStep && !leafStep.used && stepId === `workflow.${params.workflowId}.step.${leafStep.params.step.id}`) {
      leafStep.used = true;
      return this.#runLeaf(leafStep.params, params) as Promise<any>;
    }
    for (let i = 0; i < params.retries + 1; i++) {
      if (i > 0 && params.delay) {
        await new Promise(resolve => setTimeout(resolve, params.delay));
      }
      try {
        const result = await retryCountStorage.run(i, () => this.runDurably(stepId, runStep, NonRetriableError));
        return { ok: true, result };
      } catch (e) {
        // Decide from the serialized failure in the cause, not the thrown error: the
        // transport error is always NonRetriableError (a StepError named
        // "NonRetriableError" under a real Inngest server), whatever the step threw.
        const cause = (e as any)?.cause;
        const isNonRetryable = isNonRetryableStepFailure(cause?.status === 'failed' ? cause : e);

        if (isNonRetryable || i === params.retries) {
          if (cause?.status === 'failed') {
            await this.errorStepSpan({
              span: params.stepSpan,
              operationId: `workflow.${params.workflowId}.run.${params.runId}.step.${stepId}.span.error`,
              errorOptions: {
                ...workflowTermination({
                  status: 'failed',
                  error: cause.error,
                }),
                error: getErrorFromUnknown(e),
                attributes: { status: 'failed' },
              },
            });
            // Ensure cause.error is an Error instance
            if (cause.error && !(cause.error instanceof Error)) {
              cause.error = getErrorFromUnknown(cause.error, { serializeStack: false });
            }
            return {
              ok: false,
              error: {
                ...cause,
                ...(isNonRetryable && { nonRetryable: true as const }),
              },
            };
          }

          // Fallback for other errors - preserve the original error instance
          const errorInstance = getErrorFromUnknown(e, {
            serializeStack: false,
            fallbackMessage: 'Unknown step execution error',
          });
          await this.errorStepSpan({
            span: params.stepSpan,
            operationId: `workflow.${params.workflowId}.run.${params.runId}.step.${stepId}.span.error`,
            errorOptions: {
              ...workflowTermination({ status: 'failed', error: errorInstance }),
              error: errorInstance,
              attributes: { status: 'failed' },
            },
          });
          return {
            ok: false,
            error: {
              status: 'failed',
              error: errorInstance,
              endedAt: Date.now(),
              ...(isNonRetryable && { nonRetryable: true as const }),
            },
          };
        }
      }
    }
    // Should never reach here, but TypeScript needs it
    return { ok: false, error: { status: 'failed', error: new Error('Unknown error'), endedAt: Date.now() } };
  }

  /** Runs an eligible plain step's attempts as leaves (see `#runLeaf`). */
  override async executeStep(params: ExecuteStepParams) {
    const leafStep = this.#isLeafStep(params) ? { params, used: false } : undefined;
    return leafStepStorage.run(leafStep, () => super.executeStep(params));
  }

  /**
   * Storage v2 runs write through the run writer: each write sends only what changed, and is the run's
   * commit, so it doesn't depend on `shouldPersistSnapshot`. Bookkeeping happens outside the durable
   * operation so a replayed request tracks the same writes.
   */
  override async persistStepUpdate(params: PersistStepUpdateParams): Promise<void> {
    const writer = this.#leaf?.writer;
    if (!writer) return super.persistStepUpdate(params);
    const { workflowId, runId, executionContext, workflowStatus, phase, recordResumedStepStart, stepIds } = params;

    // Never overwrite a suspended/paused run with a later `running` update from the same drive.
    if (workflowStatus === 'running' && !recordResumedStepStart && this.#holdsSuspension(runId)) return;

    const plan = writer.plan(this.#snapshot(params), stepIds);
    const operationId = `workflow.${workflowId}.run.${runId}.path.${JSON.stringify(executionContext.executionPath)}.stepUpdate${phase ? `.${phase}` : ''}`;
    const written = await this.wrapDurableOperation(operationId, () => writer.send(plan));
    if (!written) {
      this.setLastPersistedStatus(runId, 'canceled');
      return;
    }
    writer.commit(plan, written);
    this.setLastPersistedStatus(runId, workflowStatus);
  }

  #holdsSuspension(runId: string): boolean {
    const last = this.getLastPersistedStatus(runId);
    return last === 'suspended' || last === 'paused';
  }

  #snapshot(params: {
    runId: string;
    stepResults: Record<string, any>;
    serializedStepGraph: WorkflowRunState['serializedStepGraph'];
    executionContext: ExecutionContext;
    workflowStatus: WorkflowRunState['status'];
    result?: any;
    error?: any;
    requestContext: RequestContext;
    tracingContext?: WorkflowRunState['tracingContext'];
  }): WorkflowRunState {
    const { executionContext } = params;
    return {
      runId: params.runId,
      parentWorkflow: executionContext.parentWorkflow,
      status: params.workflowStatus,
      value: executionContext.state,
      context: params.stepResults as WorkflowRunState['context'],
      activePaths: executionContext.executionPath,
      stepExecutionPath: executionContext.stepExecutionPath,
      activeStepsPath: executionContext.activeStepsPath,
      serializedStepGraph: params.serializedStepGraph,
      suspendedPaths: executionContext.suspendedPaths,
      waitingPaths: {},
      resumeLabels: executionContext.resumeLabels,
      result: params.result,
      error: params.error,
      requestContext: this.serializeRequestContext(params.requestContext),
      timestamp: Date.now(),
      tracingContext: params.tracingContext,
    };
  }

  /** Plain steps of the graph run as leaves; nested workflows, agents, tools, restarts and time travel don't. */
  #isLeafStep(params: ExecuteStepParams): boolean {
    if (!this.#leaf || params.restart || params.timeTravel) return false;
    if (this.isNestedWorkflowStep(params.step)) return false;
    return findGraphStep(this.#leaf.graph, params.step.id) === params.step;
  }

  /** Unique per step occurrence across drives, and the same on every replay of a drive. */
  #occurrenceKey(params: ExecuteStepParams): string {
    const { executionContext } = params;
    const at = [
      this.#leaf!.driveId,
      params.step.id,
      executionContext.executionPath.join('.'),
      executionContext.foreachIndex ?? '',
    ].join(':');
    const n = this.#occurrences.get(at) ?? 0;
    this.#occurrences.set(at, n + 1);
    return `${at}:${n}`;
  }

  /**
   * One step occurrence as leaves. Per Mastra attempt: a durable `prepare` writes the run's pending
   * changes and the leaf request pinned to the resulting state version, `step.invoke` runs the leaf
   * function, and its candidate is read back. User failures are retried with a new attempt from the
   * same pinned state; the final outcome is adopted atomically with its state patch. Failures of the
   * machinery itself throw `LeafInfrastructureError`, which fails the Inngest function.
   */
  async #runLeaf(
    stepParams: ExecuteStepParams,
    params: { retries: number; delay: number; stepSpan?: any; workflowId: string; runId: string },
  ): Promise<{ ok: true; result: unknown } | { ok: false; error: any }> {
    const leaf = this.#leaf!;
    const { writer } = leaf;
    const store = writer.store;
    const { workflowId, runId, executionContext, step } = stepParams;
    const occurrenceKey = this.#occurrenceKey(stepParams);
    const { state: _state, ...requestExecutionContext } = executionContext;
    const canceled = () => {
      this.setLastPersistedStatus(runId, 'canceled');
      return {
        ok: false as const,
        error: { status: 'failed', error: new Error(`Workflow run ${runId} was canceled`), endedAt: Date.now() },
      };
    };

    let candidate: LeafCandidate | undefined;
    for (let attempt = 0; attempt <= params.retries; attempt++) {
      if (attempt > 0 && params.delay) {
        await this.inngestStep.sleep(`leaf.${occurrenceKey}.retry.${attempt}`, params.delay);
      }
      const leafRunId = `${occurrenceKey}#${attempt}`;

      const plan = writer.plan(
        this.#snapshot({
          runId,
          stepResults: stepParams.stepResults,
          serializedStepGraph: stepParams.serializedStepGraph,
          executionContext,
          workflowStatus: 'running',
          requestContext: stepParams.requestContext,
          tracingContext: writer.header?.tracingContext,
        }),
      );
      if (this.#holdsSuspension(runId) && writer.header) plan.header = writer.header;
      const request: Omit<LeafRequest, 'baseSeq'> = {
        v: 1,
        workflowId,
        runId,
        resourceId: stepParams.resourceId,
        stepId: step.id,
        attempt,
        executionContext: JSON.parse(JSON.stringify(requestExecutionContext)),
        prevOutput: stepParams.prevOutput,
        resume: stepParams.resume,
        requestContext: serializeRequestContext(stepParams.requestContext),
        iterationCount: stepParams.iterationCount,
        perStep: stepParams.perStep,
      };
      const prepared = await this.#durableLeafOp(`leaf.${leafRunId}.prepare`, async () => {
        const written = await writer.send(plan);
        if (!written) return null;
        await store.putWorkflowLeafRecord<LeafRequest>({
          workflowName: workflowId,
          runId,
          kind: 'request',
          key: leafRunId,
          payload: { ...request, baseSeq: written.lastSeq },
        });
        return written;
      });
      if (!prepared) return canceled();
      writer.commit(plan, prepared);

      let returned: LeafReturn;
      try {
        returned = (await this.inngestStep.invoke(`leaf.${leafRunId}`, {
          function: leaf.leafFunction as any,
          data: { v: 1, workflowId, runId, leafRunId, actor: leaf.actor } satisfies LeafInvokeData,
        })) as LeafReturn;
      } catch (e) {
        throw new LeafInfrastructureError(`Leaf ${leafRunId} failed`, { cause: e });
      }

      // Candidates are immutable, so reading one outside a step is replay-safe.
      candidate =
        (await store.loadWorkflowLeafRecord<LeafCandidate>({
          workflowName: workflowId,
          runId,
          kind: 'candidate',
          key: returned.candidateId,
        })) ?? undefined;
      if (!candidate) {
        throw new LeafInfrastructureError(
          `Leaf ${leafRunId} returned candidate ${returned.candidateId}, which isn't stored`,
        );
      }
      const { outcome } = candidate;
      if (outcome.status === 'completed' || outcome.nonRetryable || attempt === params.retries) break;
    }

    const selected = candidate!;
    const receipt = await this.#durableLeafOp(`leaf.${occurrenceKey}.adopt`, async () => {
      const adopted = await store.adoptWorkflowLeaf({
        workflowName: workflowId,
        runId,
        occurrenceKey,
        candidateId: selected.candidateId,
        statePatch: selected.statePatch,
        expectedStatus: NOT_CANCELED_STATUSES,
      });
      if (adopted) injectLeafFault('adoption-written', { occurrenceKey });
      return adopted?.receipt ?? null;
    });
    if (!receipt) return canceled();
    // Apply the adopted patch to the run's state in place, in the same tick as the writer's view, so
    // parallel siblings writing next diff against a state that already has it.
    writer.commitState(selected.statePatch, receipt.seq);
    if (selected.statePatch.length) applyStatePatch(executionContext.state, selected.statePatch);

    const { outcome } = selected;
    if (outcome.status === 'completed') {
      return {
        ok: true,
        result: { ...outcome.result, contextMutations: { ...outcome.result.contextMutations, stateUpdate: null } },
      };
    }
    const error = getErrorFromUnknown(outcome.error, { serializeStack: false });
    await this.errorStepSpan({
      span: params.stepSpan,
      operationId: `workflow.${workflowId}.run.${runId}.step.${step.id}.span.error`,
      errorOptions: {
        ...workflowTermination({ status: 'failed', error }),
        error,
        attributes: { status: 'failed' },
      },
    });
    return {
      ok: false,
      error: {
        status: 'failed',
        error,
        endedAt: outcome.endedAt,
        ...(outcome.nonRetryable && { nonRetryable: true as const }),
        ...(outcome.tripwire && { tripwire: outcome.tripwire }),
      },
    };
  }

  /** A durable operation of the leaf machinery: its failure fails the run's Inngest function. */
  async #durableLeafOp<T>(operationId: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await this.wrapDurableOperation(operationId, fn);
    } catch (e) {
      if (isLeafInfrastructureError(e)) throw e;
      throw new LeafInfrastructureError(`Leaf operation ${operationId} failed`, { cause: e });
    }
  }

  /**
   * Use Inngest's sleep primitive for durability
   */
  async executeSleepDuration(duration: number, sleepId: string, workflowId: string): Promise<void> {
    await this.inngestStep.sleep(`workflow.${workflowId}.sleep.${sleepId}`, duration < 0 ? 0 : duration);
  }

  /**
   * Use Inngest's sleepUntil primitive for durability
   */
  async executeSleepUntilDate(date: Date, sleepUntilId: string, workflowId: string): Promise<void> {
    await this.inngestStep.sleepUntil(`workflow.${workflowId}.sleepUntil.${sleepUntilId}`, date);
  }

  /**
   * Wrap durable operations in Inngest step.run() for durability.
   *
   * IMPORTANT: Errors are wrapped with a cause structure before throwing.
   * This is necessary because Inngest's error serialization (serialize-error-cjs)
   * only captures standard Error properties (message, name, stack, code, cause).
   * Custom properties like statusCode, responseHeaders from AI SDK errors would
   * be lost. By putting our serialized error (via getErrorFromUnknown with toJSON())
   * in the cause property, we ensure custom properties survive serialization.
   * The cause property is in serialize-error-cjs's allowlist, and when the cause
   * object is finally JSON.stringify'd, our error's toJSON() is called.
   *
   * Failures here stay retriable, so a non-zero function-level `retries` covers
   * transient errors in these operations (spans, event publishing, conditions).
   */
  async wrapDurableOperation<T>(operationId: string, operationFn: () => Promise<T>): Promise<T> {
    return this.runDurably(operationId, operationFn, Error);
  }

  /**
   * Runs `operationFn` in step.run() and throws failures as `ErrorType` with the
   * serialized failure in the cause. Step code passes NonRetriableError because Inngest
   * applies the function-level `retries` to every step.run() that throws, and step
   * retries are already handled by executeStepWithRetry.
   */
  private async runDurably<T>(
    operationId: string,
    operationFn: () => Promise<T>,
    ErrorType: new (message: string, options: { cause: unknown }) => Error,
  ): Promise<T> {
    const result = await this.inngestStep.run(operationId, async () => {
      try {
        const fnResult = await operationFn();
        return fnResult;
      } catch (e) {
        const errorInstance = getErrorFromUnknown(e, {
          serializeStack: true,
          fallbackMessage: 'Unknown step execution error',
        });
        const isNonRetryable = isNonRetryableStepFailure(e);
        const wrapped = new ErrorType(errorInstance.message, {
          cause: {
            status: 'failed',
            error: errorInstance,
            endedAt: Date.now(),
            ...(isNonRetryable && { nonRetryable: true as const }),
          },
        });
        // Report the original failure site to Inngest instead of this wrapper frame.
        if (errorInstance.stack) {
          wrapped.stack = errorInstance.stack;
        }
        // Inngest derives the reported `name` from the prototype, so keep built-in error types (e.g. TypeError).
        const builtinErrorType =
          e instanceof Error
            ? BUILTIN_ERROR_TYPES.find(BuiltinType => Object.getPrototypeOf(e) === BuiltinType.prototype)
            : undefined;
        // A NonRetriableError keeps its own `name`, which Inngest also checks, so it stays non-retriable.
        // Newer SDKs report that `name` instead of the prototype's; the stack still shows the original type.
        if (builtinErrorType) {
          Object.setPrototypeOf(wrapped, builtinErrorType.prototype);
        }
        throw wrapped;
      }
    });
    return result as T;
  }

  /**
   * Provide Inngest step primitive in engine context
   */
  getEngineContext(): Record<string, any> {
    return { step: this.inngestStep };
  }

  /**
   * For Inngest, lifecycle callbacks are invoked in the workflow's finalize step
   * (wrapped in step.run for durability), not in execute(). Override to skip.
   */
  public async invokeLifecycleCallbacks(_result: {
    status: any;
    result?: any;
    error?: any;
    steps: Record<string, any>;
    tripwire?: any;
    runId: string;
    workflowId: string;
    resourceId?: string;
    input?: any;
    requestContext: RequestContext;
    state: Record<string, any>;
  }): Promise<void> {
    // No-op: Inngest handles callbacks in workflow.ts finalize step
  }

  /**
   * Actually invoke the lifecycle callbacks. Called from workflow.ts finalize step.
   */
  public async invokeLifecycleCallbacksInternal(result: {
    status: any;
    result?: any;
    error?: any;
    steps: Record<string, any>;
    tripwire?: any;
    runId: string;
    workflowId: string;
    resourceId?: string;
    input?: any;
    requestContext: RequestContext;
    state: Record<string, any>;
  }): Promise<void> {
    return super.invokeLifecycleCallbacks(result);
  }

  // =============================================================================
  // Durable Span Lifecycle Hooks
  // =============================================================================

  /**
   * Create a step span durably - on first execution, creates and exports span.
   * On replay, returns cached span data without re-creating.
   */
  async createStepSpan(params: {
    parentSpan: any;
    stepId: string;
    operationId: string;
    options: SpanOutcomeFields & {
      name: string;
      type: any;
      input?: unknown;
      entityType?: string;
      entityId?: string;
      attributes?: Record<string, unknown>;
      tracingPolicy?: any;
    };
    executionContext: ExecutionContext;
  }): Promise<any> {
    const { executionContext, operationId, options, parentSpan } = params;

    // Use the actual parent span's ID if provided (e.g., for steps inside control-flow),
    // otherwise fall back to workflow span
    const parentSpanId = parentSpan?.id ?? executionContext.tracingIds?.workflowSpanId;

    // Without observability there is no span to memoize; skip the durable operation.
    if (!this.mastra?.observability?.getSelectedInstance({})) return undefined;

    // Use wrapDurableOperation to memoize span creation
    const exportedSpan = await this.wrapDurableOperation(operationId, async () => {
      const observability = this.mastra?.observability?.getSelectedInstance({});
      if (!observability) return undefined;

      // Create span using tracingIds for traceId, and actual parent span for parentSpanId
      const span = observability.startSpan({
        ...options,
        entityType: options.entityType as EntityType | undefined,
        traceId: parentSpan?.traceId ?? executionContext.tracingIds?.traceId,
        parentSpanId,
      });

      // Return serializable form
      return span?.snapshot?.() ?? span?.exportSpan();
    });

    // Return a rebuilt span that can have .end()/.error() called later
    if (exportedSpan) {
      const observability = this.mastra?.observability?.getSelectedInstance({});
      return observability?.rebuildSpan(exportedSpan);
    }

    return undefined;
  }

  /**
   * End a step span durably.
   */
  async endStepSpan(params: {
    span: any;
    operationId: string;
    endOptions: SpanOutcomeFields & {
      output?: unknown;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    const { span, operationId, endOptions } = params;
    if (!span) return;

    await this.wrapDurableOperation(operationId, async () => {
      span.end(endOptions);
    });
  }

  /**
   * Record error on step span durably.
   */
  async errorStepSpan(params: {
    span: any;
    operationId: string;
    errorOptions: SpanOutcomeFields & {
      error: Error;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    const { span, operationId, errorOptions } = params;
    if (!span) return;

    await this.wrapDurableOperation(operationId, async () => {
      span.error(errorOptions);
    });
  }

  /**
   * Create a generic child span durably (for control-flow operations).
   * On first execution, creates and exports span. On replay, returns cached span data.
   */
  async createChildSpan(params: {
    parentSpan: any;
    operationId: string;
    options: SpanOutcomeFields & {
      name: string;
      type: any;
      input?: unknown;
      attributes?: Record<string, unknown>;
    };
    executionContext: ExecutionContext;
  }): Promise<any> {
    const { executionContext, operationId, options, parentSpan } = params;

    // Use the actual parent span's ID if provided, otherwise fall back to workflow span
    const parentSpanId = parentSpan?.id ?? executionContext.tracingIds?.workflowSpanId;

    // Without observability there is no span to memoize; skip the durable operation.
    if (!this.mastra?.observability?.getSelectedInstance({})) return undefined;

    // Use wrapDurableOperation to memoize span creation
    const exportedSpan = await this.wrapDurableOperation(operationId, async () => {
      const observability = this.mastra?.observability?.getSelectedInstance({});
      if (!observability) return undefined;

      // Create span using tracingIds for traceId, and actual parent span for parentSpanId
      const span = observability.startSpan({
        ...options,
        traceId: parentSpan?.traceId ?? executionContext.tracingIds?.traceId,
        parentSpanId,
        tracingPolicy: this.options?.tracingPolicy,
      });

      // Return serializable form
      return span?.snapshot?.() ?? span?.exportSpan();
    });

    // Return a rebuilt span that can have .end()/.error() called later
    if (exportedSpan) {
      const observability = this.mastra?.observability?.getSelectedInstance({});
      return observability?.rebuildSpan(exportedSpan);
    }

    return undefined;
  }

  /**
   * End a generic child span durably (for control-flow operations).
   */
  async endChildSpan(params: {
    span: any;
    operationId: string;
    endOptions?: SpanOutcomeFields & {
      output?: unknown;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    const { span, operationId, endOptions } = params;
    if (!span) return;

    await this.wrapDurableOperation(operationId, async () => {
      span.end(endOptions);
    });
  }

  /**
   * Record error on a generic child span durably (for control-flow operations).
   */
  async errorChildSpan(params: {
    span: any;
    operationId: string;
    errorOptions: SpanOutcomeFields & {
      error: Error;
      attributes?: Record<string, unknown>;
    };
  }): Promise<void> {
    const { span, operationId, errorOptions } = params;
    if (!span) return;

    await this.wrapDurableOperation(operationId, async () => {
      span.error(errorOptions);
    });
  }

  /**
   * Execute nested InngestWorkflow using inngestStep.invoke() for durability.
   * This MUST be called directly (not inside step.run()) due to Inngest constraints.
   *
   * @param params - The nested workflow step and its current execution state.
   * @returns The nested workflow step result, or null when the step is not an Inngest workflow.
   */
  async executeWorkflowStep(params: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    executionContext: ExecutionContext;
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
      label?: string;
    };
    timeTravel?: TimeTravelExecutionParams;
    prevOutput: any;
    inputData: any;
    pubsub: PubSub;
    startedAt: number;
    perStep?: boolean;
    stepSpan?: any;
    actor?: ActorSignal;
    requestContext?: RequestContext;
  }): Promise<StepResult<any, any, any, any> | null> {
    // Only handle InngestWorkflow instances
    if (!(params.step instanceof InngestWorkflow)) {
      return null;
    }

    const {
      step,
      stepResults,
      executionContext,
      resume,
      timeTravel,
      prevOutput,
      inputData,
      pubsub,
      startedAt,
      perStep,
      stepSpan,
      actor,
      requestContext: parentRequestContext,
    } = params;
    const forwardedRequestContext = parentRequestContext
      ? this.serializeRequestContext(parentRequestContext)
      : (inputData?.requestContextEntries ?? {});

    // Build trace context to propagate to nested workflow
    const nestedTracingContext = executionContext.tracingIds?.traceId
      ? {
          traceId: executionContext.tracingIds.traceId,
          parentSpanId: stepSpan?.id,
        }
      : undefined;

    const parentStream = this.parentStream ?? {
      workflowId: executionContext.workflowId,
      runId: executionContext.runId,
    };
    const isResume = !!resume?.steps?.length;
    // New invocations return compact output; legacy memoized WorkflowResult
    // envelopes are structural supersets of this parent-facing contract.
    let result: NestedWorkflowResult;
    let runId: string;

    const isTimeTravel = !!(timeTravel && timeTravel.steps?.length > 1 && timeTravel.steps[0] === step.id);

    // The nested run id must be derivable on every replay pass: core strips
    // `suspendPayload` (omitPriorCompletionFields) and persists the stripped step
    // result before this branch runs, so nothing stored on it survives Inngest's
    // re-execution from the snapshot. The default engine runs nested workflows
    // under the parent's run id (Workflow.execute → createRun({ runId })), so
    // derive the same way here; foreach iterations get a per-index suffix so
    // concurrent iterations don't share a snapshot row (executionContext.foreachIndex
    // is set per iteration by the foreach handler and is stable across replays).
    const derivedNestedRunId =
      executionContext.foreachIndex !== undefined
        ? `${executionContext.runId}-foreach-${executionContext.foreachIndex}`
        : executionContext.runId;

    try {
      if (isResume) {
        runId = stepResults[resume?.steps?.[0] ?? '']?.suspendPayload?.__workflow_meta?.runId ?? derivedNestedRunId;
        const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
        const snapshot: any = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: step.id,
          runId: runId,
        });

        const nestedResumeSteps = resume.steps.slice(1);
        let replayOnly = false;
        if (nestedResumeSteps.length === 0) {
          const suspendedStepIds = Object.keys(snapshot?.suspendedPaths ?? {});
          if (suspendedStepIds.length === 0) {
            // The child is no longer suspended: step.invoke parks the parent until the
            // child finishes, so Inngest re-executes this block to deliver the memoized
            // result. Replay the invoke (same durable id) instead of throwing, which
            // would discard a child run that already completed.
            replayOnly = true;
          } else if (suspendedStepIds.length > 1) {
            const pathStrings = suspendedStepIds.map(stepId => `[${stepId}]`);
            throw new Error(
              `Multiple suspended steps found: ${pathStrings.join(', ')}. ` +
                'Please specify which step to resume using the "step" parameter.',
            );
          } else {
            nestedResumeSteps.push(suspendedStepIds[0]!);
          }
        }
        const nestedResumeStepId = nestedResumeSteps[0];

        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData,
            requestContext: forwardedRequestContext,
            parentStream,
            runId: runId,
            ...(replayOnly
              ? { initialState: executionContext.state ?? {} }
              : {
                  resume: {
                    runId: runId,
                    steps: nestedResumeSteps,
                    resumePayload: resume.resumePayload,
                    resumePath: nestedResumeStepId
                      ? (snapshot?.suspendedPaths?.[nestedResumeStepId] as any)
                      : undefined,
                    // Resumes only the labelled foreach iteration, as core `Run.resume` does (#27925).
                    label: resume.label,
                    forEachIndex: resume.label ? snapshot?.resumeLabels?.[resume.label]?.foreachIndex : undefined,
                  },
                }),
            outputOptions: { includeState: true, includeResumeLabels: true },
            nestedWorkflowOutputMode: NESTED_WORKFLOW_OUTPUT_MODE.COMPACT,
            perStep,
            tracingOptions: nestedTracingContext,
            actor,
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
        executionContext.state = invokeResp.result.state;
      } else if (isTimeTravel) {
        const workflowsStoreForTimeTravel = await this.mastra?.getStorage()?.getStore('workflows');
        const snapshot: any = (await workflowsStoreForTimeTravel?.loadWorkflowSnapshot({
          workflowName: step.id,
          runId: executionContext.runId,
        })) ?? { context: {} };
        const timeTravelParams = createTimeTravelExecutionParams({
          steps: timeTravel.steps.slice(1),
          inputData: timeTravel.inputData,
          resumeData: timeTravel.resumeData,
          context: (timeTravel.nestedStepResults?.[step.id] ?? {}) as any,
          nestedStepsContext: (timeTravel.nestedStepResults ?? {}) as any,
          snapshot,
          graph: step.buildExecutionGraph(),
        });
        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            timeTravel: timeTravelParams,
            initialState: executionContext.state ?? {},
            requestContext: forwardedRequestContext,
            parentStream,
            runId: executionContext.runId,
            outputOptions: { includeState: true, includeResumeLabels: true },
            nestedWorkflowOutputMode: NESTED_WORKFLOW_OUTPUT_MODE.COMPACT,
            perStep,
            tracingOptions: nestedTracingContext,
            actor,
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
        executionContext.state = invokeResp.result.state;
      } else {
        // Name the child run on its trigger event. `cancelOn` matches a cancel
        // event against `data.runId` on the trigger, so a nested run invoked
        // without one cannot be cancelled by id — and it would take the
        // unnamed-run branch, warning about advice the caller cannot act on.
        // Derived (not random) so every replay pass addresses the same child
        // snapshot — see `derivedNestedRunId` above.
        const nestedRunId = derivedNestedRunId;
        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData,
            initialState: executionContext.state ?? {},
            requestContext: forwardedRequestContext,
            parentStream,
            runId: nestedRunId,
            outputOptions: { includeState: true, includeResumeLabels: true },
            nestedWorkflowOutputMode: NESTED_WORKFLOW_OUTPUT_MODE.COMPACT,
            perStep,
            tracingOptions: nestedTracingContext,
            actor,
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
        executionContext.state = invokeResp.result.state;
      }
    } catch (e) {
      // Nested workflow threw an error (likely from finalization step).
      // Compact nested failures carry the workflow result and runId in the cause.
      const errorCause = e && typeof e === 'object' && 'cause' in e ? e.cause : undefined;

      // Try to extract runId from error cause or generate new one
      if (errorCause && typeof errorCause === 'object' && 'status' in errorCause && errorCause.status === 'failed') {
        result = errorCause as Extract<NestedWorkflowResult, { status: 'failed' }>;
        runId =
          'runId' in errorCause && typeof errorCause.runId === 'string'
            ? errorCause.runId
            : globalThis.crypto.randomUUID();
      } else {
        // Log before flattening: Error objects don't survive snapshot
        // serialization (JSON.stringify(new Error('x')) is `{}`), so without
        // this the real cause never surfaces past "Workflow failed".
        this.logger?.error(
          `Nested workflow step ${step.id} failed: ` + (e instanceof Error ? (e.stack ?? e.message) : String(e)),
        );
        // Fallback: if we can't get the result from error, construct a basic failed result.
        // The error is returned from the memoized step.run() below, so it must serialize
        // with its message (a raw StepError would keep only `stepId` and `name`).
        runId = globalThis.crypto.randomUUID();
        result = {
          status: 'failed',
          error: getErrorFromUnknown(e, { serializeStack: true, fallbackMessage: 'Nested workflow failed' }),
        };
      }
    }

    const res = await this.inngestStep.run(
      `workflow.${executionContext.workflowId}.step.${step.id}.nestedwf-results`,
      async () => {
        if (result.status === 'failed') {
          await pubsub.publish(`workflow.events.v2.${executionContext.runId}`, {
            type: 'watch',
            runId: executionContext.runId,
            data: {
              type: 'workflow-step-result',
              payload: {
                id: step.id,
                status: 'failed',
                error: result?.error,
                payload: prevOutput,
              },
            },
          });

          return { executionContext, result: { status: 'failed', error: result?.error, endedAt: Date.now() } };
        } else if (result.status === 'suspended') {
          const suspendedSteps = Object.entries(result.steps).filter(([_stepName, stepResult]) => {
            const stepRes: StepResult<any, any, any, any> = stepResult as StepResult<any, any, any, any>;
            return stepRes?.status === 'suspended';
          });

          // A labelled resume whose tool call finished while another stays parked suspends the run
          // without any tool publishing a suspension, so the resumed stream would never end (#27925).
          // Published here, before the parent persists the suspension and the next resume can claim it.
          const agentInput: { __workflowKind?: string; runId?: string } | undefined = stepResults.input as any;
          const resumedCallFinished = isResume && !!resume?.label && !(result as any).resumeLabels?.[resume.label];
          const parked = (suspendedSteps[0]?.[1] as any)?.suspendPayload;
          // An approval requested during execution (e.g. by a sub-agent) nests the call here.
          const approval = parked?.requireToolApproval;
          const parkedToolCallId = parked?.toolCallId ?? approval?.toolCallId;
          // A call that first parked in this segment (approval tools run one at a time) published its
          // own suspension. The parent still holds the labels it parked on until it persists this one.
          let parkedBefore = false;
          if (resumedCallFinished && agentInput?.__workflowKind === 'durable-agent' && parkedToolCallId) {
            const store = await this.mastra?.getStorage()?.getStore('workflows');
            const parent = await store?.loadWorkflowSnapshot({
              workflowName: executionContext.workflowId,
              runId: executionContext.runId,
            });
            parkedBefore = !!parent?.resumeLabels?.[parkedToolCallId];
          }
          if (parkedBefore && agentInput?.runId) {
            // A tool's own suspension keeps no args; its call input is in the foreach output.
            const meta = parked?.__workflow_meta;
            await emitSuspendedEvent(pubsub, agentInput.runId, {
              toolCallId: parkedToolCallId,
              toolName: approval?.toolName ?? parked?.toolName,
              args: approval?.args ?? parked?.args ?? meta?.foreachOutput?.[meta.foreachIndex]?.payload?.args,
              suspendPayload: parked?.toolCallSuspended,
              type: parked?.type === 'approval' ? 'approval' : 'suspension',
            });
          }

          for (const [stepName, stepResult] of suspendedSteps) {
            const suspendPath: string[] = [stepName, ...(stepResult?.suspendPayload?.__workflow_meta?.path ?? [])];
            executionContext.suspendedPaths[step.id] = executionContext.executionPath;

            // Re-register the nested run's resume labels on the parent so the outer snapshot is
            // self-describing about every parked leaf (e.g. `resumeLabels[toolCallId]`). Without
            // this a caller can only target the outer step, and concurrent suspensions inside the
            // nested workflow become impossible to disambiguate. Mirrors `Workflow.execute()` in
            // packages/core/src/workflows/workflow.ts.
            for (const label of Object.keys((result as any)?.resumeLabels ?? {})) {
              executionContext.resumeLabels[label] = { stepId: step.id };
            }

            // Keep the nested workflow metadata (foreachIndex, foreachOutput, resumeLabels) when
            // propagating a suspension to the parent — only runId and path change as we move up.
            // Per-iteration `__streamState` blobs are stripped from the propagated copies: they can
            // be large and resume reads them from the nested run's own snapshot, so the parent only
            // needs the identifying fields.
            const nestedMeta = (stepResult as any)?.suspendPayload?.__workflow_meta ?? {};
            const propagatedForeachOutput = Array.isArray(nestedMeta.foreachOutput)
              ? nestedMeta.foreachOutput.map((entry: any) => {
                  if (entry?.status !== 'suspended' || !entry.suspendPayload) return entry;
                  const { __streamState: _streamState, ...suspendPayload } = entry.suspendPayload;
                  return { ...entry, suspendPayload };
                })
              : undefined;

            await pubsub.publish(`workflow.events.v2.${executionContext.runId}`, {
              type: 'watch',
              runId: executionContext.runId,
              data: {
                type: 'workflow-step-suspended',
                payload: {
                  id: step.id,
                  status: 'suspended',
                },
              },
            });

            return {
              executionContext,
              result: {
                status: 'suspended',
                suspendedAt: Date.now(),
                payload: stepResult.payload,
                suspendPayload: {
                  ...(stepResult as any)?.suspendPayload,
                  __workflow_meta: {
                    ...nestedMeta,
                    ...(propagatedForeachOutput ? { foreachOutput: propagatedForeachOutput } : {}),
                    runId: runId,
                    path: suspendPath,
                  },
                },
              },
            };
          }

          return {
            executionContext,
            result: {
              status: 'suspended',
              suspendedAt: Date.now(),
              payload: {},
            },
          };
        } else if (result.status === 'tripwire') {
          await pubsub.publish(`workflow.events.v2.${executionContext.runId}`, {
            type: 'watch',
            runId: executionContext.runId,
            data: {
              type: 'workflow-step-result',
              payload: {
                id: step.id,
                status: 'tripwire',
                error: result?.tripwire?.reason,
                payload: prevOutput,
              },
            },
          });

          return {
            executionContext,
            result: {
              status: 'tripwire',
              tripwire: result?.tripwire,
              endedAt: Date.now(),
            },
          };
        } else if (perStep || result.status === 'paused') {
          await pubsub.publish(`workflow.events.v2.${executionContext.runId}`, {
            type: 'watch',
            runId: executionContext.runId,
            data: {
              type: 'workflow-step-result',
              payload: {
                id: step.id,
                status: 'paused',
              },
            },
          });

          await pubsub.publish(`workflow.events.v2.${executionContext.runId}`, {
            type: 'watch',
            runId: executionContext.runId,
            data: {
              type: 'workflow-step-finish',
              payload: {
                id: step.id,
                metadata: {},
              },
            },
          });
          return { executionContext, result: { status: 'paused' } };
        }

        await pubsub.publish(`workflow.events.v2.${executionContext.runId}`, {
          type: 'watch',
          runId: executionContext.runId,
          data: {
            type: 'workflow-step-result',
            payload: {
              id: step.id,
              status: 'success',
              output: result?.result,
            },
          },
        });

        await pubsub.publish(`workflow.events.v2.${executionContext.runId}`, {
          type: 'watch',
          runId: executionContext.runId,
          data: {
            type: 'workflow-step-finish',
            payload: {
              id: step.id,
              metadata: {},
            },
          },
        });

        return { executionContext, result: { status: 'success', output: result?.result, endedAt: Date.now() } };
      },
    );

    Object.assign(executionContext, res.executionContext);
    return {
      ...res.result,
      startedAt,
      payload: inputData,
      resumedAt: resume?.steps[0] === step.id ? startedAt : undefined,
      resumePayload: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
    } as StepResult<any, any, any, any>;
  }
}

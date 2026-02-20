import { randomUUID } from 'node:crypto';
import type { RequestContext } from '@mastra/core/di';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { SerializedError } from '@mastra/core/error';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { EntityType } from '@mastra/core/observability';
import { DefaultExecutionEngine, createTimeTravelExecutionParams } from '@mastra/core/workflows';
import type {
  ExecutionContext,
  Step,
  StepResult,
  StepFailure,
  ExecutionEngineOptions,
  TimeTravelExecutionParams,
  WorkflowResult,
} from '@mastra/core/workflows';
import type { Inngest, BaseContext } from 'inngest';
import { InngestWorkflow } from './workflow';

export class InngestExecutionEngine extends DefaultExecutionEngine {
  private inngestStep: BaseContext<Inngest>['step'];
  private inngestAttempts: number;

  constructor(
    mastra: Mastra,
    inngestStep: BaseContext<Inngest>['step'],
    inngestAttempts: number = 0,
    options: ExecutionEngineOptions,
  ) {
    super({ mastra, options });
    this.inngestStep = inngestStep;
    this.inngestAttempts = inngestAttempts;
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
   * Retries are handled via step-level retry (RetryAfterError thrown INSIDE step.run()).
   * After retries exhausted, error propagates here and we return a failed result.
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
  ): Promise<{ ok: true; result: T } | { ok: false; error: { status: 'failed'; error: Error; endedAt: number } }> {
    for (let i = 0; i < params.retries + 1; i++) {
      if (i > 0 && params.delay) {
        await new Promise(resolve => setTimeout(resolve, params.delay));
      }
      try {
        //removed retry config with RetryAfterError from wrapDurableOperation, since we're manually handling retries here
        const result = await this.wrapDurableOperation(stepId, runStep);
        return { ok: true, result };
      } catch (e) {
        if (i === params.retries) {
          // After step-level retries exhausted, extract failure from error cause
          const cause = (e as any)?.cause;
          if (cause?.status === 'failed') {
            params.stepSpan?.error({
              error: e,
              attributes: { status: 'failed' },
            });
            // Ensure cause.error is an Error instance
            if (cause.error && !(cause.error instanceof Error)) {
              cause.error = getErrorFromUnknown(cause.error, { serializeStack: false });
            }
            return { ok: false, error: cause };
          }

          // Fallback for other errors - preserve the original error instance
          const errorInstance = getErrorFromUnknown(e, {
            serializeStack: false,
            fallbackMessage: 'Unknown step execution error',
          });
          params.stepSpan?.error({
            error: errorInstance,
            attributes: { status: 'failed' },
          });
          return {
            ok: false,
            error: {
              status: 'failed',
              error: errorInstance,
              endedAt: Date.now(),
            },
          };
        }
      }
    }
    // Should never reach here, but TypeScript needs it
    return { ok: false, error: { status: 'failed', error: new Error('Unknown error'), endedAt: Date.now() } };
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
   */
  async wrapDurableOperation<T>(operationId: string, operationFn: () => Promise<T>): Promise<T> {
    const result = await this.inngestStep.run(operationId, async () => {
      try {
        const fnResult = await operationFn();
        return fnResult;
      } catch (e) {
        const errorInstance = getErrorFromUnknown(e, {
          serializeStack: false,
          fallbackMessage: 'Unknown step execution error',
        });
        throw new Error(errorInstance.message, {
          cause: {
            status: 'failed',
            error: errorInstance,
            endedAt: Date.now(),
          },
        });
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
    options: {
      name: string;
      type: any;
      input?: unknown;
      entityType?: string;
      entityId?: string;
      tracingPolicy?: any;
    };
    executionContext: ExecutionContext;
  }): Promise<any> {
    const { executionContext, operationId, options, parentSpan } = params;

    // Use the actual parent span's ID if provided (e.g., for steps inside control-flow),
    // otherwise fall back to workflow span
    const parentSpanId = parentSpan?.id ?? executionContext.tracingIds?.workflowSpanId;

    // Use wrapDurableOperation to memoize span creation
    const exportedSpan = await this.wrapDurableOperation(operationId, async () => {
      const observability = this.mastra?.observability?.getSelectedInstance({});
      if (!observability) return undefined;

      // Create span using tracingIds for traceId, and actual parent span for parentSpanId
      const span = observability.startSpan({
        ...options,
        entityType: options.entityType as EntityType | undefined,
        traceId: executionContext.tracingIds?.traceId,
        parentSpanId,
      });

      // Return serializable form
      return span?.exportSpan();
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
    endOptions: {
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
    errorOptions: {
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
    options: {
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

    // Use wrapDurableOperation to memoize span creation
    const exportedSpan = await this.wrapDurableOperation(operationId, async () => {
      const observability = this.mastra?.observability?.getSelectedInstance({});
      if (!observability) return undefined;

      // Create span using tracingIds for traceId, and actual parent span for parentSpanId
      const span = observability.startSpan({
        ...options,
        traceId: executionContext.tracingIds?.traceId,
        parentSpanId,
      });

      // Return serializable form
      return span?.exportSpan();
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
    endOptions?: {
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
    errorOptions: {
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
   */
  async executeWorkflowStep(params: {
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
    perStep?: boolean;
    stepSpan?: any;
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
    } = params;

    // Build trace context to propagate to nested workflow
    const nestedTracingContext = executionContext.tracingIds?.traceId
      ? {
          traceId: executionContext.tracingIds.traceId,
          parentSpanId: stepSpan?.id,
        }
      : undefined;

    const isResume = !!resume?.steps?.length;
    let result: WorkflowResult<any, any, any, any>;
    let runId: string;

    const isTimeTravel = !!(timeTravel && timeTravel.steps?.length > 1 && timeTravel.steps[0] === step.id);

    try {
      if (isResume) {
        runId = stepResults[resume?.steps?.[0] ?? '']?.suspendPayload?.__workflow_meta?.runId ?? randomUUID();
        const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
        const snapshot: any = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: step.id,
          runId: runId,
        });

        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData,
            initialState: executionContext.state ?? snapshot?.value ?? {},
            runId: runId,
            resume: {
              runId: runId,
              steps: resume.steps.slice(1),
              stepResults: snapshot?.context as any,
              resumePayload: resume.resumePayload,
              resumePath: resume.steps?.[1] ? (snapshot?.suspendedPaths?.[resume.steps?.[1]] as any) : undefined,
            },
            outputOptions: { includeState: true },
            perStep,
            tracingOptions: nestedTracingContext,
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
            runId: executionContext.runId,
            outputOptions: { includeState: true },
            perStep,
            tracingOptions: nestedTracingContext,
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
        executionContext.state = invokeResp.result.state;
      } else {
        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData,
            initialState: executionContext.state ?? {},
            outputOptions: { includeState: true },
            perStep,
            tracingOptions: nestedTracingContext,
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
        executionContext.state = invokeResp.result.state;
      }
    } catch (e) {
      // Nested workflow threw an error (likely from finalization step)
      // The error cause should contain the workflow result with runId
      const errorCause = (e as any)?.cause;

      // Try to extract runId from error cause or generate new one
      if (errorCause && typeof errorCause === 'object') {
        result = errorCause as WorkflowResult<any, any, any, any>;
        // The runId might be in the result's steps metadata
        runId = errorCause.runId || randomUUID();
      } else {
        // Fallback: if we can't get the result from error, construct a basic failed result
        runId = randomUUID();
        result = {
          status: 'failed',
          error: e instanceof Error ? e : new Error(String(e)),
          steps: {},
          input: inputData,
        } as WorkflowResult<any, any, any, any>;
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

          for (const [stepName, stepResult] of suspendedSteps) {
            const suspendPath: string[] = [stepName, ...(stepResult?.suspendPayload?.__workflow_meta?.path ?? [])];
            executionContext.suspendedPaths[step.id] = executionContext.executionPath;

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
                  __workflow_meta: { runId: runId, path: suspendPath },
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

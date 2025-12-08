import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { DefaultExecutionEngine, createTimeTravelExecutionParams } from '@mastra/core/workflows';
import type {
  ExecutionContext,
  Step,
  StepResult,
  StepFailure,
  Emitter,
  ExecutionEngineOptions,
  TimeTravelExecutionParams,
  WorkflowResult,
} from '@mastra/core/workflows';
import { RetryAfterError } from 'inngest';
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
   * Format errors with stack traces for better debugging in Inngest
   */
  protected formatResultError(error: Error | string | undefined, lastOutput: StepResult<any, any, any, any>): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }
    const outputError = (lastOutput as StepFailure<any, any, any, any>)?.error;
    if (outputError instanceof Error) {
      return outputError.message;
    }
    return outputError ?? (error as string) ?? 'Unknown error';
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
  ): Promise<{ ok: true; result: T } | { ok: false; error: { status: 'failed'; error: string; endedAt: number } }> {
    try {
      // Pass retry config to wrapDurableOperation so RetryAfterError is thrown INSIDE step.run()
      const result = await this.wrapDurableOperation(stepId, runStep, { delay: params.delay });
      return { ok: true, result };
    } catch (e) {
      // After step-level retries exhausted, extract failure from error cause
      const cause = (e as any)?.cause;
      if (cause?.status === 'failed') {
        params.stepSpan?.error({
          error: e,
          attributes: { status: 'failed' },
        });
        return { ok: false, error: cause };
      }

      // Fallback for other errors
      const errorMessage = e instanceof Error ? e.message : String(e);
      params.stepSpan?.error({
        error: e,
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
   * If retryConfig is provided, throws RetryAfterError INSIDE step.run() to trigger
   * Inngest's step-level retry mechanism (not function-level retry).
   */
  async wrapDurableOperation<T>(
    operationId: string,
    operationFn: () => Promise<T>,
    retryConfig?: { delay: number },
  ): Promise<T> {
    return this.inngestStep.run(operationId, async () => {
      try {
        return await operationFn();
      } catch (e) {
        if (retryConfig) {
          // Throw RetryAfterError INSIDE step.run() to trigger step-level retry
          const errorMessage = e instanceof Error ? e.message : String(e);
          throw new RetryAfterError(errorMessage, retryConfig.delay, {
            cause: {
              status: 'failed',
              error: `Error: ${errorMessage}`,
              endedAt: Date.now(),
            },
          });
        }
        throw e; // Re-throw if no retry config
      }
    }) as Promise<T>;
  }

  /**
   * Provide Inngest step primitive in engine context
   */
  getEngineContext(): Record<string, any> {
    return { step: this.inngestStep };
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
    emitter: Emitter;
    startedAt: number;
  }): Promise<StepResult<any, any, any, any> | null> {
    // Only handle InngestWorkflow instances
    if (!(params.step instanceof InngestWorkflow)) {
      return null;
    }

    const { step, stepResults, executionContext, resume, timeTravel, prevOutput, inputData, emitter, startedAt } =
      params;

    const isResume = !!resume?.steps?.length;
    let result: WorkflowResult<any, any, any, any>;
    let runId: string;

    const isTimeTravel = !!(timeTravel && timeTravel.steps?.length > 1 && timeTravel.steps[0] === step.id);

    try {
      if (isResume) {
        runId = stepResults[resume?.steps?.[0] ?? '']?.suspendPayload?.__workflow_meta?.runId ?? randomUUID();
        const snapshot: any = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
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
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
        executionContext.state = invokeResp.result.state;
      } else if (isTimeTravel) {
        const snapshot: any = (await this.mastra?.getStorage()?.loadWorkflowSnapshot({
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
          await emitter.emit('watch', {
            type: 'workflow-step-result',
            payload: {
              id: step.id,
              status: 'failed',
              error: result?.error,
              payload: prevOutput,
            },
          });

          return { executionContext, result: { status: 'failed', error: result?.error } };
        } else if (result.status === 'suspended') {
          const suspendedSteps = Object.entries(result.steps).filter(([_stepName, stepResult]) => {
            const stepRes: StepResult<any, any, any, any> = stepResult as StepResult<any, any, any, any>;
            return stepRes?.status === 'suspended';
          });

          for (const [stepName, stepResult] of suspendedSteps) {
            const suspendPath: string[] = [stepName, ...(stepResult?.suspendPayload?.__workflow_meta?.path ?? [])];
            executionContext.suspendedPaths[step.id] = executionContext.executionPath;

            await emitter.emit('watch', {
              type: 'workflow-step-suspended',
              payload: {
                id: step.id,
                status: 'suspended',
              },
            });

            return {
              executionContext,
              result: {
                status: 'suspended',
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
              payload: {},
            },
          };
        } else if (result.status === 'tripwire') {
          await emitter.emit('watch', {
            type: 'workflow-step-result',
            payload: {
              id: step.id,
              status: 'tripwire',
              error: result?.tripwire?.reason,
              payload: prevOutput,
            },
          });

          return {
            executionContext,
            result: {
              status: 'tripwire',
              tripwire: result?.tripwire,
            },
          };
        }

        // Status is 'success'
        await emitter.emit('watch', {
          type: 'workflow-step-result',
          payload: {
            id: step.id,
            status: 'success',
            output: (result as any)?.result,
          },
        });

        await emitter.emit('watch', {
          type: 'workflow-step-finish',
          payload: {
            id: step.id,
            metadata: {},
          },
        });

        return { executionContext, result: { status: 'success', output: (result as any)?.result } };
      },
    );

    Object.assign(executionContext, res.executionContext);
    return {
      ...res.result,
      startedAt,
      endedAt: Date.now(),
      payload: inputData,
      resumedAt: resume?.steps[0] === step.id ? startedAt : undefined,
      resumePayload: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
    } as StepResult<any, any, any, any>;
  }
}

import { randomUUID } from 'crypto';
import type { WritableStream } from 'node:stream/web';
import type { RequestContext } from '@mastra/core/di';
import type { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { TracingContext } from '@mastra/core/observability';
import { ToolStream } from '@mastra/core/tools';
import {
  getStepResult,
  DefaultExecutionEngine,
  validateStepResumeData,
  validateStepSuspendData,
  validateStepInput,
  createTimeTravelExecutionParams,
} from '@mastra/core/workflows';
import type {
  ExecutionContext,
  Step,
  StepResult,
  StepFailure,
  Emitter,
  ChunkType,
  ExecutionEngineOptions,
  TimeTravelExecutionParams,
  SuspendOptions,
  WorkflowResult,
} from '@mastra/core/workflows';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
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
   * Exclude input from result in Inngest workflows
   */
  protected get includeInputInResult(): boolean {
    return false;
  }

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
  protected isNestedWorkflowStep(step: Step<any, any, any>): boolean {
    return step instanceof InngestWorkflow;
  }

  /**
   * Use Inngest's sleep primitive for durability
   */
  protected async executeSleepDuration(duration: number, sleepId: string, workflowId: string): Promise<void> {
    await this.inngestStep.sleep(`workflow.${workflowId}.sleep.${sleepId}`, duration < 0 ? 0 : duration);
  }

  /**
   * Use Inngest's sleepUntil primitive for durability
   */
  protected async executeSleepUntilDate(date: Date, sleepUntilId: string, workflowId: string): Promise<void> {
    await this.inngestStep.sleepUntil(`workflow.${workflowId}.sleepUntil.${sleepUntilId}`, date);
  }

  /**
   * Wrap persistence operations in Inngest step.run() for durability
   */
  protected async wrapPersistence(operationId: string, persistFn: () => Promise<void>): Promise<void> {
    await this.inngestStep.run(operationId, persistFn);
  }

  /**
   * Wrap durable operations in Inngest step.run() for durability
   */
  protected async wrapDurableOperation<T>(operationId: string, operationFn: () => Promise<T>): Promise<T> {
    return this.inngestStep.run(operationId, operationFn) as Promise<T>;
  }

  /**
   * Provide Inngest step primitive in engine context
   */
  protected getEngineContext(): Record<string, any> {
    return { step: this.inngestStep };
  }

  /**
   * Wrap condition evaluation in Inngest step.run() for durability
   */
  protected async evaluateCondition(
    conditionFn: (context: any) => Promise<boolean>,
    index: number,
    context: any,
    operationId: string,
  ): Promise<number | null> {
    return this.inngestStep.run(operationId, async () => {
      const result = await conditionFn(context);
      return result ? index : null;
    });
  }

  /**
   * Wrap step execution start in Inngest step.run() for durability and return startedAt
   */
  protected async onStepExecutionStart(params: {
    step: Step<string, any, any>;
    inputData: any;
    emitter: Emitter;
    executionContext: ExecutionContext;
    stepCallId: string;
    stepInfo: Record<string, any>;
    operationId: string;
    skipEmits?: boolean;
  }): Promise<number> {
    return this.inngestStep.run(params.operationId, async () => {
      const startedAt = Date.now();
      await params.emitter.emit('watch', {
        type: 'workflow-step-start',
        payload: {
          id: params.step.id,
          status: 'running',
          payload: params.inputData,
          startedAt,
        },
      });
      return startedAt;
    });
  }

  /**
   * Execute nested InngestWorkflow using inngestStep.invoke() for durability.
   * This MUST be called directly (not inside step.run()) due to Inngest constraints.
   */
  protected async executeWorkflowStep(params: {
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
        }

        await emitter.emit('watch', {
          type: 'workflow-step-result',
          payload: {
            id: step.id,
            status: 'success',
            output: result?.result,
          },
        });

        await emitter.emit('watch', {
          type: 'workflow-step-finish',
          payload: {
            id: step.id,
            metadata: {},
          },
        });

        return { executionContext, result: { status: 'success', output: result?.result } };
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

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    timeTravel,
    prevOutput,
    emitter,
    abortController,
    requestContext,
    tracingContext,
    writableStream,
    disableScorers,
  }: {
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
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
  }): Promise<StepResult<any, any, any, any>> {
    const stepSpan = tracingContext?.currentSpan?.createChildSpan({
      name: `workflow step: '${step.id}'`,
      type: SpanType.WORKFLOW_STEP,
      input: prevOutput,
      attributes: {
        stepId: step.id,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    const { inputData, validationError } = await validateStepInput({
      prevOutput,
      step,
      validateInputs: this.options?.validateInputs ?? true,
    });

    const stepCallId = randomUUID();
    const stepInfo = {
      status: 'running' as const,
      payload: inputData,
    };

    // Use inherited onStepExecutionStart hook (which wraps in inngestStep.run)
    const startedAt = await this.onStepExecutionStart({
      step,
      inputData,
      emitter,
      executionContext,
      stepCallId,
      stepInfo,
      operationId: `workflow.${executionContext.workflowId}.run.${executionContext.runId}.step.${step.id}.running_ev`,
    });

    // Check if this is a nested workflow that requires special handling (uses inherited routing)
    if (this.isNestedWorkflowStep(step)) {
      const workflowResult = await this.executeWorkflowStep({
        step,
        stepResults,
        executionContext,
        resume,
        timeTravel,
        prevOutput,
        inputData,
        emitter,
        startedAt,
      });

      // If executeWorkflowStep returns a result, use it
      if (workflowResult !== null) {
        return workflowResult;
      }
    }
    let stepRes: {
      result: {
        status: 'success' | 'failed' | 'suspended' | 'bailed';
        output?: any;
        startedAt: number;
        endedAt?: number;
        payload: any;
        error?: string;
        resumedAt?: number;
        resumePayload?: any;
        suspendPayload?: any;
        suspendedAt?: number;
      };
      stepResults: Record<
        string,
        StepResult<any, any, any, any> | (Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string })
      >;
      executionContext: ExecutionContext;
    };

    try {
      stepRes = await this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}`, async () => {
        let execResults: {
          status: 'success' | 'failed' | 'suspended' | 'bailed';
          output?: any;
          startedAt: number;
          endedAt?: number;
          payload: any;
          error?: string;
          resumedAt?: number;
          resumePayload?: any;
          suspendPayload?: any;
          suspendedAt?: number;
        };
        let suspended: { payload: any } | undefined;
        let bailed: { payload: any } | undefined;

        const { resumeData: timeTravelResumeData, validationError: timeTravelResumeValidationError } =
          await validateStepResumeData({
            resumeData: timeTravel?.stepResults[step.id]?.status === 'suspended' ? timeTravel?.resumeData : undefined,
            step,
          });

        let resumeDataToUse;
        if (timeTravelResumeData && !timeTravelResumeValidationError) {
          resumeDataToUse = timeTravelResumeData;
        } else if (timeTravelResumeData && timeTravelResumeValidationError) {
          this.logger.warn('Time travel resume data validation failed', {
            stepId: step.id,
            error: timeTravelResumeValidationError.message,
          });
        } else if (resume?.steps[0] === step.id) {
          resumeDataToUse = resume?.resumePayload;
        }

        try {
          if (validationError) {
            throw validationError;
          }

          const retryCount = this.getOrGenerateRetryCount(step.id);

          const result = await step.execute({
            runId: executionContext.runId,
            workflowId: executionContext.workflowId,
            mastra: this.mastra!,
            requestContext,
            retryCount,
            writer: new ToolStream(
              {
                prefix: 'workflow-step',
                callId: stepCallId,
                name: step.id,
                runId: executionContext.runId,
              },
              writableStream,
            ),
            state: executionContext?.state ?? {},
            setState: (state: any) => {
              executionContext.state = state;
            },
            inputData,
            resumeData: resumeDataToUse,
            tracingContext: {
              currentSpan: stepSpan,
            },
            getInitData: () => stepResults?.input as any,
            getStepResult: getStepResult.bind(this, stepResults),
            suspend: async (suspendPayload: any, suspendOptions?: SuspendOptions) => {
              const { suspendData, validationError } = await validateStepSuspendData({
                suspendData: suspendPayload,
                step,
              });
              if (validationError) {
                throw validationError;
              }
              executionContext.suspendedPaths[step.id] = executionContext.executionPath;
              if (suspendOptions?.resumeLabel) {
                const resumeLabel = Array.isArray(suspendOptions.resumeLabel)
                  ? suspendOptions.resumeLabel
                  : [suspendOptions.resumeLabel];
                for (const label of resumeLabel) {
                  executionContext.resumeLabels[label] = {
                    stepId: step.id,
                    foreachIndex: executionContext.foreachIndex,
                  };
                }
              }
              suspended = { payload: suspendData };
            },
            bail: (result: any) => {
              bailed = { payload: result };
            },
            abort: () => {
              abortController?.abort();
            },
            [EMITTER_SYMBOL]: emitter,
            [STREAM_FORMAT_SYMBOL]: executionContext.format,
            engine: {
              step: this.inngestStep,
            },
            abortSignal: abortController.signal,
          });
          const endedAt = Date.now();

          execResults = {
            status: 'success',
            output: result,
            startedAt,
            endedAt,
            payload: inputData,
            resumedAt: resumeDataToUse ? startedAt : undefined,
            resumePayload: resumeDataToUse,
          };
        } catch (e) {
          const stepFailure: Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string } = {
            status: 'failed',
            payload: inputData,
            error: e instanceof Error ? e.message : String(e),
            endedAt: Date.now(),
            startedAt,
            resumedAt: resumeDataToUse ? startedAt : undefined,
            resumePayload: resumeDataToUse,
          };

          execResults = stepFailure;

          const fallbackErrorMessage = `Step ${step.id} failed`;
          stepSpan?.error({ error: new Error(execResults.error ?? fallbackErrorMessage) });
          throw new RetryAfterError(execResults.error ?? fallbackErrorMessage, executionContext.retryConfig.delay, {
            cause: execResults,
          });
        }

        if (suspended) {
          execResults = {
            status: 'suspended',
            suspendPayload: suspended.payload,
            ...(execResults.output ? { suspendOutput: execResults.output } : {}),
            payload: inputData,
            suspendedAt: Date.now(),
            startedAt,
            resumedAt: resumeDataToUse ? startedAt : undefined,
            resumePayload: resumeDataToUse,
          };
        } else if (bailed) {
          execResults = {
            status: 'bailed',
            output: bailed.payload,
            payload: inputData,
            endedAt: Date.now(),
            startedAt,
          };
        }

        if (execResults.status === 'suspended') {
          await emitter.emit('watch', {
            type: 'workflow-step-suspended',
            payload: {
              id: step.id,
              ...execResults,
            },
          });
        } else {
          await emitter.emit('watch', {
            type: 'workflow-step-result',
            payload: {
              id: step.id,
              ...execResults,
            },
          });

          await emitter.emit('watch', {
            type: 'workflow-step-finish',
            payload: {
              id: step.id,
              metadata: {},
            },
          });
        }

        stepSpan?.end({ output: execResults });

        return { result: execResults, executionContext, stepResults };
      });
    } catch (e) {
      const stepFailure: Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string } =
        e instanceof Error
          ? (e?.cause as unknown as Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string })
          : {
              status: 'failed' as const,
              error: e instanceof Error ? e.message : String(e),
              payload: inputData,
              startedAt,
              endedAt: Date.now(),
            };

      stepRes = {
        result: stepFailure,
        executionContext,
        stepResults: {
          ...stepResults,
          [step.id]: stepFailure,
        },
      };
    }

    if (disableScorers !== false && stepRes.result.status === 'success') {
      await this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}.score`, async () => {
        if (step.scorers) {
          await this.runScorers({
            scorers: step.scorers,
            runId: executionContext.runId,
            input: inputData,
            output: stepRes.result,
            workflowId: executionContext.workflowId,
            stepId: step.id,
            requestContext,
            disableScorers,
            tracingContext: { currentSpan: stepSpan },
          });
        }
      });
    }

    Object.assign(executionContext.suspendedPaths, stepRes.executionContext.suspendedPaths);
    executionContext.state = stepRes.executionContext.state;

    return stepRes.result as StepResult<any, any, any, any>;
  }
}

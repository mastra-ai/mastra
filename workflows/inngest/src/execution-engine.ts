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
  createDeprecationProxy,
  runCountDeprecationMessage,
  validateStepResumeData,
  validateStepSuspendData,
  validateStepInput,
  createTimeTravelExecutionParams,
} from '@mastra/core/workflows';
import type {
  ExecuteFunction,
  ExecutionContext,
  Step,
  StepFlowEntry,
  StepResult,
  SerializedStepFlowEntry,
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
import type { InngestEngineType } from './types';
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

  protected async fmtReturnValue<TOutput>(
    emitter: Emitter,
    stepResults: Record<string, StepResult<any, any, any, any>>,
    lastOutput: StepResult<any, any, any, any>,
    error?: Error | string,
  ): Promise<TOutput> {
    const base: any = {
      status: lastOutput.status,
      steps: stepResults,
    };
    if (lastOutput.status === 'success') {
      base.result = lastOutput.output;
    } else if (lastOutput.status === 'failed') {
      base.error =
        error instanceof Error
          ? (error?.stack ?? error.message)
          : lastOutput?.error instanceof Error
            ? lastOutput.error.message
            : (lastOutput.error ?? error ?? 'Unknown error');
    } else if (lastOutput.status === 'suspended') {
      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      });
      base.suspended = suspendedStepIds;
    }

    return base as TOutput;
  }

  // async executeSleep({ id, duration }: { id: string; duration: number }): Promise<void> {
  //   await this.inngestStep.sleep(id, duration);
  // }

  async executeSleep({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    emitter,
    abortController,
    requestContext,
    executionContext,
    writableStream,
    tracingContext,
  }: {
    workflowId: string;
    runId: string;
    serializedStepGraph: SerializedStepFlowEntry[];
    entry: {
      type: 'sleep';
      id: string;
      duration?: number;
      fn?: ExecuteFunction<any, any, any, any, any, InngestEngineType>;
    };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
  }): Promise<void> {
    let { duration, fn } = entry;

    const sleepSpan = tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.WORKFLOW_SLEEP,
      name: `sleep: ${duration ? `${duration}ms` : 'dynamic'}`,
      attributes: {
        durationMs: duration,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    if (fn) {
      const stepCallId = randomUUID();
      duration = await this.inngestStep.run(`workflow.${workflowId}.sleep.${entry.id}`, async () => {
        return await fn(
          createDeprecationProxy(
            {
              runId,
              workflowId,
              mastra: this.mastra!,
              requestContext,
              inputData: prevOutput,
              state: executionContext.state,
              setState: (state: any) => {
                executionContext.state = state;
              },
              retryCount: -1,
              tracingContext: {
                currentSpan: sleepSpan,
              },
              getInitData: () => stepResults?.input as any,
              getStepResult: getStepResult.bind(this, stepResults),
              // TODO: this function shouldn't have suspend probably?
              suspend: async (_suspendPayload: any): Promise<any> => {},
              bail: () => {},
              abort: () => {
                abortController?.abort();
              },
              [EMITTER_SYMBOL]: emitter,
              [STREAM_FORMAT_SYMBOL]: executionContext.format,
              engine: { step: this.inngestStep },
              abortSignal: abortController?.signal,
              writer: new ToolStream(
                {
                  prefix: 'workflow-step',
                  callId: stepCallId,
                  name: 'sleep',
                  runId,
                },
                writableStream,
              ),
            },
            {
              paramName: 'runCount',
              deprecationMessage: runCountDeprecationMessage,
              logger: this.logger,
            },
          ),
        );
      });

      // Update sleep span with dynamic duration
      sleepSpan?.update({
        attributes: {
          durationMs: duration,
        },
      });
    }

    try {
      await this.inngestStep.sleep(entry.id, !duration || duration < 0 ? 0 : duration);
      sleepSpan?.end();
    } catch (e) {
      sleepSpan?.error({ error: e as Error });
      throw e;
    }
  }

  async executeSleepUntil({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    emitter,
    abortController,
    requestContext,
    executionContext,
    writableStream,
    tracingContext,
  }: {
    workflowId: string;
    runId: string;
    serializedStepGraph: SerializedStepFlowEntry[];
    entry: {
      type: 'sleepUntil';
      id: string;
      date?: Date;
      fn?: ExecuteFunction<any, any, any, any, any, InngestEngineType>;
    };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
  }): Promise<void> {
    let { date, fn } = entry;

    const sleepUntilSpan = tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.WORKFLOW_SLEEP,
      name: `sleepUntil: ${date ? date.toISOString() : 'dynamic'}`,
      attributes: {
        untilDate: date,
        durationMs: date ? Math.max(0, date.getTime() - Date.now()) : undefined,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    if (fn) {
      date = await this.inngestStep.run(`workflow.${workflowId}.sleepUntil.${entry.id}`, async () => {
        const stepCallId = randomUUID();
        return await fn(
          createDeprecationProxy(
            {
              runId,
              workflowId,
              mastra: this.mastra!,
              requestContext,
              inputData: prevOutput,
              state: executionContext.state,
              setState: (state: any) => {
                executionContext.state = state;
              },
              retryCount: -1,
              tracingContext: {
                currentSpan: sleepUntilSpan,
              },
              getInitData: () => stepResults?.input as any,
              getStepResult: getStepResult.bind(this, stepResults),
              // TODO: this function shouldn't have suspend probably?
              suspend: async (_suspendPayload: any): Promise<any> => {},
              bail: () => {},
              abort: () => {
                abortController?.abort();
              },
              [EMITTER_SYMBOL]: emitter,
              [STREAM_FORMAT_SYMBOL]: executionContext.format,
              engine: { step: this.inngestStep },
              abortSignal: abortController?.signal,
              writer: new ToolStream(
                {
                  prefix: 'workflow-step',
                  callId: stepCallId,
                  name: 'sleep',
                  runId,
                },
                writableStream,
              ),
            },
            {
              paramName: 'runCount',
              deprecationMessage: runCountDeprecationMessage,
              logger: this.logger,
            },
          ),
        );
      });

      // Update sleep until span with dynamic duration
      // Ensure date is a Date object before calling getTime()
      if (date && !(date instanceof Date)) {
        date = new Date(date);
      }
      const time = !date ? 0 : date.getTime() - Date.now();
      sleepUntilSpan?.update({
        attributes: {
          durationMs: Math.max(0, time),
        },
      });
    }

    if (!(date instanceof Date)) {
      sleepUntilSpan?.end();
      return;
    }

    try {
      await this.inngestStep.sleepUntil(entry.id, date);
      sleepUntilSpan?.end();
    } catch (e) {
      sleepUntilSpan?.error({ error: e as Error });
      throw e;
    }
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

    const startedAt = await this.inngestStep.run(
      `workflow.${executionContext.workflowId}.run.${executionContext.runId}.step.${step.id}.running_ev`,
      async () => {
        const startedAt = Date.now();
        await emitter.emit('watch', {
          type: 'workflow-step-start',
          payload: {
            id: step.id,
            status: 'running',
            payload: inputData,
            startedAt,
          },
        });

        return startedAt;
      },
    );

    if (step instanceof InngestWorkflow) {
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

    const stepCallId = randomUUID();
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

  async persistStepUpdate({
    workflowId,
    runId,
    stepResults,
    resourceId,
    executionContext,
    serializedStepGraph,
    workflowStatus,
    result,
    error,
  }: {
    workflowId: string;
    runId: string;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    serializedStepGraph: SerializedStepFlowEntry[];
    resourceId?: string;
    executionContext: ExecutionContext;
    workflowStatus: 'success' | 'failed' | 'suspended' | 'running';
    result?: Record<string, any>;
    error?: string | Error;
    requestContext: RequestContext;
  }) {
    await this.inngestStep.run(
      `workflow.${workflowId}.run.${runId}.path.${JSON.stringify(executionContext.executionPath)}.stepUpdate`,
      async () => {
        const shouldPersistSnapshot = this.options.shouldPersistSnapshot({ stepResults, workflowStatus });

        if (!shouldPersistSnapshot) {
          return;
        }

        await this.mastra?.getStorage()?.persistWorkflowSnapshot({
          workflowName: workflowId,
          runId,
          resourceId,
          snapshot: {
            runId,
            status: workflowStatus,
            value: executionContext.state,
            context: stepResults as any,
            activePaths: executionContext.executionPath,
            activeStepsPath: executionContext.activeStepsPath,
            suspendedPaths: executionContext.suspendedPaths,
            resumeLabels: executionContext.resumeLabels,
            waitingPaths: {},
            serializedStepGraph,
            result,
            error,
            timestamp: Date.now(),
          },
        });
      },
    );
  }

  async executeConditional({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    timeTravel,
    resume,
    executionContext,
    emitter,
    abortController,
    requestContext,
    writableStream,
    disableScorers,
    tracingContext,
  }: {
    workflowId: string;
    runId: string;
    entry: {
      type: 'conditional';
      steps: { type: 'step'; step: Step<string, any, any> }[];
      conditions: ExecuteFunction<any, any, any, any, any, InngestEngineType>[];
    };
    serializedStepGraph: SerializedStepFlowEntry[];
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    timeTravel?: TimeTravelExecutionParams;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
    tracingContext?: TracingContext;
  }): Promise<StepResult<any, any, any, any>> {
    const conditionalSpan = tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.WORKFLOW_CONDITIONAL,
      name: `conditional: '${entry.conditions.length} conditions'`,
      input: prevOutput,
      attributes: {
        conditionCount: entry.conditions.length,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    let execResults: any;
    const truthyIndexes = (
      await Promise.all(
        entry.conditions.map((cond, index) =>
          this.inngestStep.run(`workflow.${workflowId}.conditional.${index}`, async () => {
            const evalSpan = conditionalSpan?.createChildSpan({
              type: SpanType.WORKFLOW_CONDITIONAL_EVAL,
              name: `condition: '${index}'`,
              input: prevOutput,
              attributes: {
                conditionIndex: index,
              },
              tracingPolicy: this.options?.tracingPolicy,
            });

            try {
              const result = await cond(
                createDeprecationProxy(
                  {
                    runId,
                    workflowId,
                    mastra: this.mastra!,
                    requestContext,
                    retryCount: -1,
                    inputData: prevOutput,
                    state: executionContext.state,
                    setState: (state: any) => {
                      executionContext.state = state;
                    },
                    tracingContext: {
                      currentSpan: evalSpan,
                    },
                    getInitData: () => stepResults?.input as any,
                    getStepResult: getStepResult.bind(this, stepResults),
                    // TODO: this function shouldn't have suspend probably?
                    suspend: async (_suspendPayload: any) => {},
                    bail: () => {},
                    abort: () => {
                      abortController.abort();
                    },
                    [EMITTER_SYMBOL]: emitter,
                    [STREAM_FORMAT_SYMBOL]: executionContext.format,
                    engine: {
                      step: this.inngestStep,
                    },
                    abortSignal: abortController.signal,
                    writer: new ToolStream(
                      {
                        prefix: 'workflow-step',
                        callId: randomUUID(),
                        name: 'conditional',
                        runId,
                      },
                      writableStream,
                    ),
                  },
                  {
                    paramName: 'runCount',
                    deprecationMessage: runCountDeprecationMessage,
                    logger: this.logger,
                  },
                ),
              );

              evalSpan?.end({
                output: result,
                attributes: {
                  result: !!result,
                },
              });

              return result ? index : null;
            } catch (e: unknown) {
              evalSpan?.error({
                error: e instanceof Error ? e : new Error(String(e)),
                attributes: {
                  result: false,
                },
              });

              return null;
            }
          }),
        ),
      )
    ).filter((index: any): index is number => index !== null);

    const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));

    // Update conditional span with evaluation results
    conditionalSpan?.update({
      attributes: {
        truthyIndexes,
        selectedSteps: stepsToRun.map(s => (s.type === 'step' ? s.step.id : `control-${s.type}`)),
      },
    });

    const results: StepResult<any, any, any, any>[] = await Promise.all(
      stepsToRun.map(async (step, index) => {
        const currStepResult = stepResults[step.step.id];
        if (currStepResult && currStepResult.status === 'success') {
          return currStepResult;
        }
        const result = await this.executeStep({
          step: step.step,
          prevOutput,
          stepResults,
          resume,
          timeTravel,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, index],
            activeStepsPath: executionContext.activeStepsPath,
            suspendedPaths: executionContext.suspendedPaths,
            resumeLabels: executionContext.resumeLabels,
            retryConfig: executionContext.retryConfig,
            state: executionContext.state,
          },
          emitter,
          abortController,
          requestContext,
          writableStream,
          disableScorers,
          tracingContext: {
            currentSpan: conditionalSpan,
          },
        });

        stepResults[step.step.id] = result;
        return result;
      }),
    );
    const hasFailed = results.find(result => result.status === 'failed') as StepFailure<any, any, any, any>;
    const hasSuspended = results.find(result => result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.error };
    } else if (hasSuspended) {
      execResults = {
        status: 'suspended',
        suspendPayload: hasSuspended.suspendPayload,
        ...(hasSuspended.suspendOutput ? { suspendOutput: hasSuspended.suspendOutput } : {}),
      };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.status === 'success') {
            if ('step' in stepsToRun[index]!) {
              acc[stepsToRun[index]!.step.id] = result.output;
            }
          }

          return acc;
        }, {}),
      };
    }

    if (execResults.status === 'failed') {
      conditionalSpan?.error({
        error: new Error(execResults.error),
      });
    } else {
      conditionalSpan?.end({
        output: execResults.output || execResults,
      });
    }

    return execResults;
  }
}

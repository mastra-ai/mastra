import { randomUUID } from 'crypto';
import type { AISpan, TracingContext } from '../ai-tracing';
import { AISpanType, wrapMastra, selectFields } from '../ai-tracing';
import type { RuntimeContext } from '../di';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { IErrorDefinition } from '../error';
import { getErrorFromUnknown } from '../error/utils.js';
import type { MastraScorers } from '../scores';
import { runScorer } from '../scores/hooks';
import type { ChunkType } from '../stream/types';
import { ToolStream } from '../tools/stream';
import type { DynamicArgument } from '../types';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type { ConditionFunction, ExecuteFunction, LoopConditionFunction, Step, SuspendOptions } from './step';
import { getStepResult } from './step';
import type {
  DefaultEngineType,
  Emitter,
  SerializedStepFlowEntry,
  StepFailure,
  StepFlowEntry,
  StepResult,
  StepSuccess,
  StepSuspended,
} from './types';
import {
  getResumeLabelsByStepId,
  validateStepInput,
  createDeprecationProxy,
  runCountDeprecationMessage,
} from './utils';

export type ExecutionContext = {
  workflowId: string;
  runId: string;
  executionPath: number[];
  foreachIndex?: number;
  suspendedPaths: Record<string, number[]>;
  resumeLabels: Record<
    string,
    {
      stepId: string;
      foreachIndex?: number;
    }
  >;
  waitingPaths?: Record<string, number[]>;
  retryConfig: {
    attempts: number;
    delay: number;
  };
  format?: 'legacy' | 'vnext' | undefined;
  state: Record<string, any>;
};

/**
 * Default implementation of the ExecutionEngine using XState
 */
export class DefaultExecutionEngine extends ExecutionEngine {
  /**
   * Preprocesses an error caught during workflow execution.
   *
   * - Wraps a non-MastraError exception
   * - Logs error details
   */
  protected preprocessExecutionError(
    e: unknown,
    errorDefinition: IErrorDefinition<ErrorDomain, ErrorCategory>,
    logPrefix: string,
  ): MastraError {
    const error = e instanceof MastraError ? e : new MastraError(errorDefinition, e);

    // Preserve original stack trace
    if (!(e instanceof MastraError) && e instanceof Error && e.stack) {
      error.stack = e.stack;
    }

    this.logger?.trackException(error);
    this.logger?.error(logPrefix + error?.stack);
    return error;
  }

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
  protected getOrGenerateRetryCount(stepId: Step['id']) {
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

  protected async fmtReturnValue<TOutput>(
    emitter: Emitter,
    stepResults: Record<string, StepResult<any, any, any, any>>,
    lastOutput: StepResult<any, any, any, any>,
    error?: Error | string,
  ): Promise<TOutput> {
    const base: any = {
      status: lastOutput.status,
      steps: stepResults,
      input: stepResults.input,
    };

    if (lastOutput.status === 'success') {
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: lastOutput.status,
            steps: stepResults,
            result: lastOutput.output,
          },
        },
        eventTimestamp: Date.now(),
      });

      base.result = lastOutput.output;
    } else if (lastOutput.status === 'failed') {
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: lastOutput.status,
            steps: stepResults,
            result: null,
            error: lastOutput.error,
          },
        },
        eventTimestamp: Date.now(),
      });

      const errorSource = error || lastOutput.error;
      const errorInstance = getErrorFromUnknown(errorSource, {
        includeStack: false,
        fallbackMessage: 'Unknown workflow error',
      });
      base.error = typeof errorSource === 'string' ? errorInstance.message : `Error: ${errorInstance.message}`;
    } else if (lastOutput.status === 'suspended') {
      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      });
      base.suspended = suspendedStepIds;

      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: lastOutput.status,
            steps: stepResults,
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });
    }

    return base as TOutput;
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
    resume?: {
      // TODO: add execute path
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
      label?: string;
      forEachIndex?: number;
    };
    emitter: Emitter;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    runtimeContext: RuntimeContext;
    workflowAISpan?: AISpan<AISpanType.WORKFLOW_RUN>;
    abortController: AbortController;
    writableStream?: WritableStream<ChunkType>;
    format?: 'legacy' | 'vnext' | undefined;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
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
      workflowAISpan,
      disableScorers,
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

      workflowAISpan?.error({ error: empty_graph_error });
      throw empty_graph_error;
    }

    let startIdx = 0;
    if (resume?.resumePath) {
      startIdx = resume.resumePath[0]!;
      resume.resumePath.shift();
    }

    const stepResults: Record<string, any> = resume?.stepResults || { input };
    let lastOutput: any;
    let lastState: Record<string, any> = initialState ?? {};
    for (let i = startIdx; i < steps.length; i++) {
      const entry = steps[i]!;

      const executionContext: ExecutionContext = {
        workflowId,
        runId,
        executionPath: [i],
        suspendedPaths: {},
        resumeLabels: {},
        retryConfig: { attempts, delay },
        format: params.format,
        state: lastState ?? initialState,
      };

      try {
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
          tracingContext: {
            currentSpan: workflowAISpan,
          },
          abortController: params.abortController,
          emitter: params.emitter,
          runtimeContext: params.runtimeContext,
          writableStream: params.writableStream,
          disableScorers,
        });

        if (lastOutput.executionContext?.state) {
          lastState = lastOutput.executionContext.state;
        }

        // if step result is not success, stop and return
        if (lastOutput.result.status !== 'success') {
          if (lastOutput.result.status === 'bailed') {
            lastOutput.result.status = 'success';
          }

          const result = (await this.fmtReturnValue(params.emitter, stepResults, lastOutput.result)) as any;
          await this.persistStepUpdate({
            workflowId,
            runId,
            resourceId,
            stepResults: lastOutput.stepResults as any,
            serializedStepGraph: params.serializedStepGraph,
            executionContext: lastOutput.executionContext as ExecutionContext,
            workflowStatus: result.status,
            result: result.result,
            error: result.error,
            runtimeContext: params.runtimeContext,
          });

          if (result.error) {
            workflowAISpan?.error({
              error: result.error,
              attributes: {
                status: result.status,
              },
            });
          } else {
            workflowAISpan?.end({
              output: result.result,
              attributes: {
                status: result.status,
              },
            });
          }
          if (lastOutput.result.status === 'suspended' && params.outputOptions?.includeResumeLabels) {
            return { ...result, resumeLabels: lastOutput.executionContext?.resumeLabels };
          }
          return result;
        }

        // if error occurred during step execution, stop and return
      } catch (e) {
        const error = this.preprocessExecutionError(
          e,
          {
            id: 'WORKFLOW_ENGINE_STEP_EXECUTION_FAILED',
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.USER,
            details: { workflowId, runId },
          },
          'Error executing step: ',
        );
        const result = (await this.fmtReturnValue(params.emitter, stepResults, lastOutput.result, e as Error)) as any;
        await this.persistStepUpdate({
          workflowId,
          runId,
          resourceId,
          stepResults: lastOutput.stepResults as any,
          serializedStepGraph: params.serializedStepGraph,
          executionContext: lastOutput.executionContext as ExecutionContext,
          workflowStatus: result.status,
          result: result.result,
          error: result.error,
          runtimeContext: params.runtimeContext,
        });

        workflowAISpan?.error({
          error,
          attributes: {
            status: result.status,
          },
        });

        return result;
      }
    }

    // after all steps are successful, return result
    const result = (await this.fmtReturnValue(params.emitter, stepResults, lastOutput.result)) as any;
    await this.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      stepResults: lastOutput.stepResults as any,
      serializedStepGraph: params.serializedStepGraph,
      executionContext: lastOutput.executionContext as ExecutionContext,
      workflowStatus: result.status,
      result: result.result,
      error: result.error,
      runtimeContext: params.runtimeContext,
    });

    workflowAISpan?.end({
      output: result.result,
      attributes: {
        status: result.status,
      },
    });

    if (params.outputOptions?.includeState) {
      return { ...result, state: lastState };
    }
    return result;
  }

  getStepOutput(stepResults: Record<string, any>, step?: StepFlowEntry): any {
    if (!step) {
      return stepResults.input;
    } else if (step.type === 'step' || step.type === 'waitForEvent') {
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

  async executeSleep({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    emitter,
    abortController,
    runtimeContext,
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
      fn?: ExecuteFunction<any, any, any, any, any, DefaultEngineType>;
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
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext: TracingContext;
  }): Promise<void> {
    let { duration, fn } = entry;

    const sleepSpan = tracingContext.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_SLEEP,
      name: `sleep: ${duration ? `${duration}ms` : 'dynamic'}`,
      attributes: {
        durationMs: duration,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    if (fn) {
      const stepCallId = randomUUID();
      duration = await fn({
        runId,
        workflowId,
        mastra: this.mastra!,
        runtimeContext,
        inputData: prevOutput,
        state: executionContext.state,
        setState: (state: any) => {
          executionContext.state = state;
        },
        runCount: -1,
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
        engine: {},
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
      });

      // Update sleep span with dynamic duration
      sleepSpan?.update({
        attributes: {
          durationMs: duration,
        },
      });
    }

    try {
      await new Promise(resolve => setTimeout(resolve, !duration || duration < 0 ? 0 : duration));
      sleepSpan?.end();
    } catch (e) {
      sleepSpan?.error({ error: e as Error });
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
    runtimeContext,
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
      fn?: ExecuteFunction<any, any, any, any, any, DefaultEngineType>;
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
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext: TracingContext;
  }): Promise<void> {
    let { date, fn } = entry;

    const sleepUntilSpan = tracingContext.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_SLEEP,
      name: `sleepUntil: ${date ? date.toISOString() : 'dynamic'}`,
      attributes: {
        untilDate: date,
        durationMs: date ? Math.max(0, date.getTime() - Date.now()) : undefined,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    if (fn) {
      const stepCallId = randomUUID();
      date = await fn({
        runId,
        workflowId,
        mastra: this.mastra!,
        runtimeContext,
        inputData: prevOutput,
        state: executionContext.state,
        setState: (state: any) => {
          executionContext.state = state;
        },
        runCount: -1,
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
        engine: {},
        abortSignal: abortController?.signal,
        writer: new ToolStream(
          {
            prefix: 'workflow-step',
            callId: stepCallId,
            name: 'sleepUntil',
            runId,
          },
          writableStream,
        ),
      });

      // Update sleep until span with dynamic duration
      const time = !date ? 0 : date.getTime() - Date.now();
      sleepUntilSpan?.update({
        attributes: {
          durationMs: Math.max(0, time),
        },
      });
    }

    const time = !date ? 0 : date?.getTime() - Date.now();

    try {
      await new Promise(resolve => setTimeout(resolve, time < 0 ? 0 : time));
      sleepUntilSpan?.end();
    } catch (e) {
      sleepUntilSpan?.error({ error: e as Error });
    }
  }

  async executeWaitForEvent({
    event,
    emitter,
    timeout,
    tracingContext,
  }: {
    event: string;
    emitter: Emitter;
    timeout?: number;
    tracingContext?: TracingContext;
  }): Promise<any> {
    const waitSpan = tracingContext?.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_WAIT_EVENT,
      name: `wait: ${event}`,
      attributes: {
        eventName: event,
        timeoutMs: timeout,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const cb = (eventData: any) => {
        waitSpan?.end({
          output: eventData,
          attributes: {
            eventReceived: true,
            waitDurationMs: Date.now() - startTime,
          },
        });
        resolve(eventData);
      };

      if (timeout) {
        setTimeout(() => {
          emitter.off(`user-event-${event}`, cb);
          const error = new Error('Timeout waiting for event');
          waitSpan?.error({
            error,
            attributes: {
              eventReceived: false,
              waitDurationMs: Date.now() - startTime,
            },
          });
          reject(error);
        }, timeout);
      }

      emitter.once(`user-event-${event}`, cb);
    });
  }

  async executeStep({
    workflowId,
    runId,
    resourceId,
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    abortController,
    runtimeContext,
    skipEmits = false,
    writableStream,
    disableScorers,
    serializedStepGraph,
    tracingContext,
    iterationCount,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    executionContext: ExecutionContext;
    resume?: {
      steps: string[];
      resumePayload: any;
      label?: string;
      forEachIndex?: number;
    };
    prevOutput: any;
    emitter: Emitter;
    abortController: AbortController;
    runtimeContext: RuntimeContext;
    skipEmits?: boolean;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
    serializedStepGraph: SerializedStepFlowEntry[];
    tracingContext: TracingContext;
    iterationCount?: number;
  }): Promise<StepResult<any, any, any, any>> {
    const startTime = resume?.steps[0] === step.id ? undefined : Date.now();
    const resumeTime = resume?.steps[0] === step.id ? Date.now() : undefined;
    const stepCallId = randomUUID();

    const { inputData, validationError } = await validateStepInput({
      prevOutput,
      step,
      validateInputs: this.options?.validateInputs ?? false,
    });

    const stepInfo = {
      ...stepResults[step.id],
      ...(resume?.steps[0] === step.id ? { resumePayload: resume?.resumePayload } : { payload: inputData }),
      ...(startTime ? { startedAt: startTime } : {}),
      ...(resumeTime ? { resumedAt: resumeTime } : {}),
      status: 'running',
      ...(iterationCount ? { metadata: { iterationCount } } : {}),
    };

    const stepAISpan = tracingContext.currentSpan?.createChildSpan({
      name: `workflow step: '${step.id}'`,
      type: AISpanType.WORKFLOW_STEP,
      input: inputData,
      attributes: {
        stepId: step.id,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    if (!skipEmits) {
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: step.id,
            ...stepInfo,
          },
          workflowState: {
            status: 'running',
            steps: {
              ...stepResults,
              [step.id]: {
                ...stepInfo,
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });
      await emitter.emit('watch-v2', {
        type: 'workflow-step-start',
        payload: {
          id: step.id,
          stepCallId,
          ...stepInfo,
        },
      });
    }

    await this.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      serializedStepGraph,
      stepResults: {
        ...stepResults,
        [step.id]: stepInfo,
      } as Record<string, StepResult<any, any, any, any>>,
      executionContext,
      workflowStatus: 'running',
      runtimeContext,
    });

    const runStep = async (data: any) => {
      // Wrap data with a Proxy to show deprecation warning for runCount
      const proxiedData = createDeprecationProxy(data, {
        paramName: 'runCount',
        deprecationMessage: runCountDeprecationMessage,
        logger: this.logger,
      });

      return step.execute(proxiedData);
    };

    let execResults: any;

    const retries = step.retries ?? executionContext.retryConfig.attempts ?? 0;
    const delay = executionContext.retryConfig.delay ?? 0;

    // +1 for the initial attempt
    for (let i = 0; i < retries + 1; i++) {
      if (i > 0 && delay) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      try {
        let suspended: { payload: any } | undefined;
        let bailed: { payload: any } | undefined;

        if (validationError) {
          throw validationError;
        }

        const retryCount = this.getOrGenerateRetryCount(step.id);

        const result = await runStep({
          runId,
          resourceId,
          workflowId,
          mastra: this.mastra ? wrapMastra(this.mastra, { currentSpan: stepAISpan }) : undefined,
          runtimeContext,
          inputData,
          state: executionContext.state,
          setState: (state: any) => {
            executionContext.state = state;
          },
          runCount: retryCount,
          retryCount,
          resumeData: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
          tracingContext: { currentSpan: stepAISpan },
          getInitData: () => stepResults?.input as any,
          getStepResult: getStepResult.bind(this, stepResults),
          suspend: async (suspendPayload: any, suspendOptions?: SuspendOptions): Promise<any> => {
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

            suspended = { payload: suspendPayload };
          },
          bail: (result: any) => {
            bailed = { payload: result };
          },
          abort: () => {
            abortController?.abort();
          },
          // Only pass resume data if this step was actually suspended before
          // This prevents pending nested workflows from trying to resume instead of start
          resume:
            stepResults[step.id]?.status === 'suspended'
              ? {
                  steps: resume?.steps?.slice(1) || [],
                  resumePayload: resume?.resumePayload,
                  // @ts-ignore
                  runId: stepResults[step.id]?.suspendPayload?.__workflow_meta?.runId,
                  label: resume?.label,
                  forEachIndex: resume?.forEachIndex,
                }
              : undefined,
          [EMITTER_SYMBOL]: emitter,
          [STREAM_FORMAT_SYMBOL]: executionContext.format,
          engine: {},
          abortSignal: abortController?.signal,
          writer: new ToolStream(
            {
              prefix: 'workflow-step',
              callId: stepCallId,
              name: step.id,
              runId,
            },
            writableStream,
          ),
          // Disable scorers must be explicitly set to false they are on by default
          scorers: disableScorers === false ? undefined : step.scorers,
          validateInputs: this.options?.validateInputs,
        });

        if (step.scorers) {
          await this.runScorers({
            scorers: step.scorers,
            runId,
            input: inputData,
            output: result,
            workflowId,
            stepId: step.id,
            runtimeContext,
            disableScorers,
            tracingContext: { currentSpan: stepAISpan },
          });
        }

        if (suspended) {
          execResults = { status: 'suspended', suspendPayload: suspended.payload, suspendedAt: Date.now() };
        } else if (bailed) {
          execResults = { status: 'bailed', output: bailed.payload, endedAt: Date.now() };
        } else {
          execResults = { status: 'success', output: result, endedAt: Date.now() };
        }

        break;
      } catch (e) {
        const error = this.preprocessExecutionError(
          e,
          {
            id: 'WORKFLOW_STEP_INVOKE_FAILED',
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.USER,
            details: { workflowId, runId, stepId: step.id },
          },
          `Error executing step ${step.id}: `,
        );

        stepAISpan?.error({
          error,
          attributes: {
            status: 'failed',
          },
        });

        const errorInstance = getErrorFromUnknown(error, {
          includeStack: false,
          fallbackMessage: 'Unknown step execution error',
        });
        execResults = {
          status: 'failed',
          error: `Error: ${errorInstance.message}`,
          endedAt: Date.now(),
        };
      }
    }

    if (!skipEmits) {
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: step.id,
            ...stepInfo,
            ...execResults,
          },
          workflowState: {
            status: 'running',
            steps: {
              ...stepResults,
              [step.id]: {
                ...stepInfo,
                ...execResults,
              },
            },

            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });

      if (execResults.status === 'suspended') {
        await emitter.emit('watch-v2', {
          type: 'workflow-step-suspended',
          payload: {
            id: step.id,
            stepCallId,
            ...execResults,
          },
        });
      } else {
        await emitter.emit('watch-v2', {
          type: 'workflow-step-result',
          payload: {
            id: step.id,
            stepCallId,
            ...execResults,
          },
        });

        await emitter.emit('watch-v2', {
          type: 'workflow-step-finish',
          payload: {
            id: step.id,
            stepCallId,
            metadata: {},
          },
        });
      }
    }

    if (execResults.status != 'failed') {
      stepAISpan?.end({
        output: execResults.output,
        attributes: {
          status: execResults.status,
        },
      });
    }

    return { ...stepInfo, ...execResults };
  }

  protected async runScorers({
    scorers,
    runId,
    input,
    output,
    workflowId,
    stepId,
    runtimeContext,
    disableScorers,
    tracingContext,
  }: {
    scorers: DynamicArgument<MastraScorers>;
    runId: string;
    input: any;
    output: any;
    runtimeContext: RuntimeContext;
    workflowId: string;
    stepId: string;
    disableScorers?: boolean;
    tracingContext: TracingContext;
  }) {
    let scorersToUse = scorers;
    if (typeof scorersToUse === 'function') {
      try {
        scorersToUse = await scorersToUse({
          runtimeContext: runtimeContext,
        });
      } catch (error) {
        this.preprocessExecutionError(
          error,
          {
            id: 'WORKFLOW_FAILED_TO_FETCH_SCORERS',
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.USER,
            details: {
              runId,
              workflowId,
              stepId,
            },
          },
          'Error fetching scorers: ',
        );
      }
    }

    if (!disableScorers && scorersToUse && Object.keys(scorersToUse || {}).length > 0) {
      for (const [_id, scorerObject] of Object.entries(scorersToUse || {})) {
        runScorer({
          scorerId: scorerObject.name,
          scorerObject: scorerObject,
          runId: runId,
          input: input,
          output: output,
          runtimeContext,
          entity: {
            id: workflowId,
            stepId: stepId,
          },
          structuredOutput: true,
          source: 'LIVE',
          entityType: 'WORKFLOW',
          tracingContext,
        });
      }
    }
  }

  async executeParallel({
    workflowId,
    runId,
    resourceId,
    entry,
    prevStep,
    serializedStepGraph,
    stepResults,
    resume,
    executionContext,
    tracingContext,
    emitter,
    abortController,
    runtimeContext,
    writableStream,
    disableScorers,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    entry: {
      type: 'parallel';
      steps: {
        type: 'step';
        step: Step;
      }[];
    };
    serializedStepGraph: SerializedStepFlowEntry[];
    prevStep: StepFlowEntry;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    tracingContext: TracingContext;
    emitter: Emitter;
    abortController: AbortController;
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
  }): Promise<StepResult<any, any, any, any>> {
    const parallelSpan = tracingContext.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_PARALLEL,
      name: `parallel: '${entry.steps.length} branches'`,
      input: this.getStepOutput(stepResults, prevStep),
      attributes: {
        branchCount: entry.steps.length,
        parallelSteps: entry.steps.map(s => (s.type === 'step' ? s.step.id : `control-${s.type}`)),
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    const prevOutput = this.getStepOutput(stepResults, prevStep);
    for (const step of entry.steps) {
      if (step.type === 'step') {
        const startTime = resume?.steps[0] === step.step.id ? undefined : Date.now();
        const resumeTime = resume?.steps[0] === step.step.id ? Date.now() : undefined;
        stepResults[step.step.id] = {
          ...stepResults[step.step.id],
          status: 'running',
          ...(resumeTime ? { resumePayload: resume?.resumePayload } : { payload: prevOutput }),
          ...(startTime ? { startedAt: startTime } : {}),
          ...(resumeTime ? { resumedAt: resumeTime } : {}),
        } as StepResult<any, any, any, any>;
      }
    }

    let execResults: any;
    const results: StepResult<any, any, any, any>[] = await Promise.all(
      entry.steps.map(async (step, i) => {
        const result = await this.executeStep({
          workflowId,
          runId,
          resourceId,
          step: step.step,
          prevOutput,
          stepResults,
          serializedStepGraph,
          resume,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, i],
            suspendedPaths: executionContext.suspendedPaths,
            resumeLabels: executionContext.resumeLabels,
            retryConfig: executionContext.retryConfig,
            state: executionContext.state,
          },
          tracingContext: {
            currentSpan: parallelSpan,
          },
          emitter,
          abortController,
          runtimeContext,
          writableStream,
          disableScorers,
        });
        stepResults[step.step.id] = result;
        return result;
      }),
    );
    const hasFailed = results.find(result => result.status === 'failed') as StepFailure<any, any, any>;

    const hasSuspended = results.find(result => result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.suspendPayload };
    } else if (abortController?.signal?.aborted) {
      execResults = { status: 'canceled' };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.status === 'success') {
            // @ts-ignore
            acc[entry.steps[index]!.step.id] = result.output;
          }

          return acc;
        }, {}),
      };
    }

    if (execResults.status === 'failed') {
      parallelSpan?.error({
        error: new Error(execResults.error),
      });
    } else {
      parallelSpan?.end({
        output: execResults.output || execResults,
      });
    }

    return execResults;
  }

  async executeConditional({
    workflowId,
    runId,
    resourceId,
    entry,
    prevOutput,
    prevStep,
    serializedStepGraph,
    stepResults,
    resume,
    executionContext,
    tracingContext,
    emitter,
    abortController,
    runtimeContext,
    writableStream,
    disableScorers,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    serializedStepGraph: SerializedStepFlowEntry[];
    entry: {
      type: 'conditional';
      steps: { type: 'step'; step: Step }[];
      conditions: ConditionFunction<any, any, any, any, DefaultEngineType>[];
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
    tracingContext: TracingContext;
    emitter: Emitter;
    abortController: AbortController;
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
  }): Promise<StepResult<any, any, any, any>> {
    const conditionalSpan = tracingContext.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_CONDITIONAL,
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
        entry.conditions.map(async (cond, index) => {
          const evalSpan = conditionalSpan?.createChildSpan({
            type: AISpanType.WORKFLOW_CONDITIONAL_EVAL,
            name: `condition '${index}'`,
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
                  runtimeContext,
                  inputData: prevOutput,
                  state: executionContext.state,
                  setState: (state: any) => {
                    executionContext.state = state;
                  },
                  runCount: -1,
                  retryCount: -1,
                  tracingContext: {
                    currentSpan: evalSpan,
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
                  engine: {},
                  abortSignal: abortController?.signal,
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
            const error = this.preprocessExecutionError(
              e,
              {
                id: 'WORKFLOW_CONDITION_EVALUATION_FAILED',
                domain: ErrorDomain.MASTRA_WORKFLOW,
                category: ErrorCategory.USER,
                details: { workflowId, runId },
              },
              'Error evaluating condition: ',
            );

            evalSpan?.error({
              error,
              attributes: {
                result: false,
              },
            });

            return null;
          }
        }),
      )
    ).filter((index): index is number => index !== null);

    const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));

    // Update conditional span with evaluation results
    conditionalSpan?.update({
      attributes: {
        truthyIndexes,
        selectedSteps: stepsToRun.map(s => (s.type === 'step' ? s.step.id : `control-${s.type}`)),
      },
    });

    const results: StepResult<any, any, any, any>[] = await Promise.all(
      stepsToRun.map(async (step, _index) => {
        const currStepResult = stepResults[step.step.id];
        if (currStepResult && currStepResult.status === 'success') {
          return currStepResult;
        }

        const result = await this.executeStep({
          workflowId,
          runId,
          resourceId,
          step: step.step,
          prevOutput,
          stepResults,
          serializedStepGraph,
          resume,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, stepsToRun.indexOf(step)],
            suspendedPaths: executionContext.suspendedPaths,
            resumeLabels: executionContext.resumeLabels,
            retryConfig: executionContext.retryConfig,
            state: executionContext.state,
          },
          tracingContext: {
            currentSpan: conditionalSpan,
          },
          emitter,
          abortController,
          runtimeContext,
          writableStream,
          disableScorers,
        });

        stepResults[step.step.id] = result;
        return result;
      }),
    );

    const hasFailed = results.find(result => result.status === 'failed') as StepFailure<any, any, any>;
    const hasSuspended = results.find(result => result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.suspendPayload };
    } else if (abortController?.signal?.aborted) {
      execResults = { status: 'canceled' };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.status === 'success') {
            // @ts-ignore
            acc[stepsToRun[index]!.step.id] = result.output;
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

  async executeLoop({
    workflowId,
    runId,
    resourceId,
    entry,
    prevOutput,
    stepResults,
    resume,
    executionContext,
    tracingContext,
    emitter,
    abortController,
    runtimeContext,
    writableStream,
    disableScorers,
    serializedStepGraph,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    entry: {
      type: 'loop';
      step: Step;
      condition: LoopConditionFunction<any, any, any, any, DefaultEngineType>;
      loopType: 'dowhile' | 'dountil';
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
    tracingContext: TracingContext;
    emitter: Emitter;
    abortController: AbortController;
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
    serializedStepGraph: SerializedStepFlowEntry[];
  }): Promise<StepResult<any, any, any, any>> {
    const { step, condition } = entry;

    const loopSpan = tracingContext.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_LOOP,
      name: `loop: '${entry.loopType}'`,
      input: prevOutput,
      attributes: {
        loopType: entry.loopType,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    let isTrue = true;
    const prevIterationCount = stepResults[step.id]?.metadata?.iterationCount;
    let iteration = prevIterationCount ? prevIterationCount - 1 : 0;
    const prevPayload = stepResults[step.id]?.payload;
    let result = { status: 'success', output: prevPayload ?? prevOutput } as unknown as StepResult<any, any, any, any>;
    let currentResume = resume;

    do {
      result = await this.executeStep({
        workflowId,
        runId,
        resourceId,
        step,
        stepResults,
        executionContext,
        resume: currentResume,
        prevOutput: (result as { output: any }).output,
        tracingContext: {
          currentSpan: loopSpan,
        },
        emitter,
        abortController,
        runtimeContext,
        writableStream,
        disableScorers,
        serializedStepGraph,
        iterationCount: iteration + 1,
      });

      // Clear resume for next iteration only if the step has completed resuming
      // This prevents the same resume data from being used multiple times
      if (currentResume && result.status !== 'suspended') {
        currentResume = undefined;
      }

      if (result.status !== 'success') {
        loopSpan?.end({
          attributes: {
            totalIterations: iteration,
          },
        });
        return result;
      }

      const evalSpan = loopSpan?.createChildSpan({
        type: AISpanType.WORKFLOW_CONDITIONAL_EVAL,
        name: `condition: '${entry.loopType}'`,
        input: selectFields(result.output, ['stepResult', 'output.text', 'output.object', 'messages']),
        attributes: {
          conditionIndex: iteration,
        },
        tracingPolicy: this.options?.tracingPolicy,
      });

      isTrue = await condition(
        createDeprecationProxy(
          {
            workflowId,
            runId,
            mastra: this.mastra!,
            runtimeContext,
            inputData: result.output,
            state: executionContext.state,
            setState: (state: any) => {
              executionContext.state = state;
            },
            runCount: -1,
            retryCount: -1,
            tracingContext: {
              currentSpan: evalSpan,
            },
            iterationCount: iteration + 1,
            getInitData: () => stepResults?.input as any,
            getStepResult: getStepResult.bind(this, stepResults),
            suspend: async (_suspendPayload: any): Promise<any> => {},
            bail: () => {},
            abort: () => {
              abortController?.abort();
            },
            [EMITTER_SYMBOL]: emitter,
            [STREAM_FORMAT_SYMBOL]: executionContext.format,
            engine: {},
            abortSignal: abortController?.signal,
            writer: new ToolStream(
              {
                prefix: 'workflow-step',
                callId: randomUUID(),
                name: 'loop',
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
        output: isTrue,
      });

      iteration++;
    } while (entry.loopType === 'dowhile' ? isTrue : !isTrue);

    loopSpan?.end({
      output: result.output,
      attributes: {
        totalIterations: iteration,
      },
    });

    return result;
  }

  async executeForeach({
    workflowId,
    runId,
    resourceId,
    entry,
    prevOutput,
    stepResults,
    resume,
    executionContext,
    tracingContext,
    emitter,
    abortController,
    runtimeContext,
    writableStream,
    disableScorers,
    serializedStepGraph,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    entry: {
      type: 'foreach';
      step: Step;
      opts: {
        concurrency: number;
      };
    };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
      forEachIndex?: number;
    };
    executionContext: ExecutionContext;
    tracingContext: TracingContext;
    emitter: Emitter;
    abortController: AbortController;
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
    serializedStepGraph: SerializedStepFlowEntry[];
  }): Promise<StepResult<any, any, any, any>> {
    const { step, opts } = entry;
    const results: StepResult<any, any, any, any>[] = [];
    const concurrency = opts.concurrency;
    const startTime = resume?.steps[0] === step.id ? undefined : Date.now();
    const resumeTime = resume?.steps[0] === step.id ? Date.now() : undefined;

    const stepInfo = {
      ...stepResults[step.id],
      ...(resume?.steps[0] === step.id ? { resumePayload: resume?.resumePayload } : { payload: prevOutput }),
      ...(startTime ? { startedAt: startTime } : {}),
      ...(resumeTime ? { resumedAt: resumeTime } : {}),
    };

    const loopSpan = tracingContext.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_LOOP,
      name: `loop: 'foreach'`,
      input: prevOutput,
      attributes: {
        loopType: 'foreach',
        concurrency,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    await emitter.emit('watch', {
      type: 'watch',
      payload: {
        currentStep: {
          id: step.id,
          status: 'running',
          ...stepInfo,
        },
        workflowState: {
          status: 'running',
          steps: {
            ...stepResults,
            [step.id]: {
              status: 'running',
              ...stepInfo,
            },
          },
          result: null,
          error: null,
        },
      },
      eventTimestamp: Date.now(),
    });
    await emitter.emit('watch-v2', {
      type: 'workflow-step-start',
      payload: {
        id: step.id,
        ...stepInfo,
        status: 'running',
      },
    });

    const prevPayload = stepResults[step.id];
    const foreachIndexObj: Record<number, any> = {};
    const resumeIndex =
      prevPayload?.status === 'suspended' ? prevPayload?.suspendPayload?.__workflow_meta?.foreachIndex || 0 : 0;

    const prevForeachOutput = (prevPayload?.suspendPayload?.__workflow_meta?.foreachOutput || []) as StepResult<
      any,
      any,
      any,
      any
    >[];
    const prevResumeLabels = prevPayload?.suspendPayload?.__workflow_meta?.resumeLabels || {};
    const resumeLabels = getResumeLabelsByStepId(prevResumeLabels, step.id);

    for (let i = 0; i < prevOutput.length; i += concurrency) {
      const items = prevOutput.slice(i, i + concurrency);
      const itemsResults = await Promise.all(
        items.map((item: any, j: number) => {
          const k = i + j;
          const prevItemResult = prevForeachOutput[k];
          if (
            prevItemResult?.status === 'success' ||
            (prevItemResult?.status === 'suspended' && resume?.forEachIndex !== k && resume?.forEachIndex !== undefined)
          ) {
            return prevItemResult;
          }
          let resumeToUse = undefined;
          if (resume?.forEachIndex !== undefined) {
            resumeToUse = resume.forEachIndex === k ? resume : undefined;
          } else {
            const isIndexSuspended = prevItemResult?.status === 'suspended' || resumeIndex === k;
            if (isIndexSuspended) {
              resumeToUse = resume;
            }
          }

          return this.executeStep({
            workflowId,
            runId,
            resourceId,
            step,
            stepResults,
            executionContext: { ...executionContext, foreachIndex: k },
            resume: resumeToUse,
            prevOutput: item,
            tracingContext: { currentSpan: loopSpan },
            emitter,
            abortController,
            runtimeContext,
            skipEmits: true,
            writableStream,
            disableScorers,
            serializedStepGraph,
          });
        }),
      );

      for (const [resultIndex, result] of itemsResults.entries()) {
        if (result.status !== 'success') {
          const { status, error, suspendPayload, suspendedAt, endedAt, output } = result;
          const execResults = { status, error, suspendPayload, suspendedAt, endedAt, output };

          await emitter.emit('watch', {
            type: 'watch',
            payload: {
              currentStep: {
                id: step.id,
                ...stepInfo,
                ...execResults,
              },
              workflowState: {
                status: 'running',
                steps: {
                  ...stepResults,
                  [step.id]: {
                    ...stepInfo,
                    ...execResults,
                  },
                },

                result: null,
                error: null,
              },
            },
            eventTimestamp: Date.now(),
          });

          if (execResults.status === 'suspended') {
            foreachIndexObj[i + resultIndex] = execResults;
          } else {
            await emitter.emit('watch-v2', {
              type: 'workflow-step-result',
              payload: {
                id: step.id,
                ...execResults,
              },
            });

            await emitter.emit('watch-v2', {
              type: 'workflow-step-finish',
              payload: {
                id: step.id,
                metadata: {},
              },
            });

            return result;
          }
        } else {
          const indexResumeLabel = Object.keys(resumeLabels).find(
            key => resumeLabels[key]?.foreachIndex === i + resultIndex,
          )!;
          delete resumeLabels[indexResumeLabel];
        }

        if (result?.output) {
          results[i + resultIndex] = result?.output;
        }

        prevForeachOutput[i + resultIndex] = { ...result, suspendPayload: {} };
      }

      if (Object.keys(foreachIndexObj).length > 0) {
        const suspendedIndices = Object.keys(foreachIndexObj).map(Number);
        const foreachIndex = suspendedIndices[0]!;
        await emitter.emit('watch-v2', {
          type: 'workflow-step-suspended',
          payload: {
            id: step.id,
            ...foreachIndexObj[foreachIndex],
          },
        });

        executionContext.suspendedPaths[step.id] = executionContext.executionPath;
        executionContext.resumeLabels = { ...resumeLabels, ...executionContext.resumeLabels };

        return {
          ...stepInfo,
          suspendedAt: Date.now(),
          status: 'suspended',
          suspendPayload: {
            ...foreachIndexObj[foreachIndex].suspendPayload,
            __workflow_meta: {
              ...foreachIndexObj[foreachIndex].suspendPayload?.__workflow_meta,
              foreachIndex,
              foreachOutput: prevForeachOutput,
              resumeLabels: executionContext.resumeLabels,
            },
          },
        } as StepSuspended<any, any>;
      }
    }

    await emitter.emit('watch', {
      type: 'watch',
      payload: {
        currentStep: {
          id: step.id,
          ...stepInfo,
          status: 'success',
          output: results,
          endedAt: Date.now(),
        },
        workflowState: {
          status: 'running',
          steps: {
            ...stepResults,
            [step.id]: {
              ...stepInfo,
              status: 'success',
              output: results,
              endedAt: Date.now(),
            },
          },

          result: null,
          error: null,
        },
      },
      eventTimestamp: Date.now(),
    });

    await emitter.emit('watch-v2', {
      type: 'workflow-step-result',
      payload: {
        id: step.id,
        status: 'success',
        output: results,
        endedAt: Date.now(),
      },
    });

    await emitter.emit('watch-v2', {
      type: 'workflow-step-finish',
      payload: {
        id: step.id,
        metadata: {},
      },
    });

    loopSpan?.end({
      output: results,
    });

    return {
      ...stepInfo,
      status: 'success',
      output: results,
      //@ts-ignore
      endedAt: Date.now(),
    } as StepSuccess<any, any, any, any>;
  }

  protected async persistStepUpdate({
    workflowId,
    runId,
    resourceId,
    stepResults,
    serializedStepGraph,
    executionContext,
    workflowStatus,
    result,
    error,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    serializedStepGraph: SerializedStepFlowEntry[];
    executionContext: ExecutionContext;
    workflowStatus: 'success' | 'failed' | 'suspended' | 'running' | 'waiting';
    result?: Record<string, any>;
    error?: string | Error;
    runtimeContext: RuntimeContext;
  }) {
    const shouldPersistSnapshot = this.options?.shouldPersistSnapshot?.({ stepResults, workflowStatus });

    if (!shouldPersistSnapshot) {
      return;
    }

    const runtimeContextObj: Record<string, any> = {};
    runtimeContext.forEach((value, key) => {
      runtimeContextObj[key] = value;
    });

    await this.mastra?.getStorage()?.persistWorkflowSnapshot({
      workflowName: workflowId,
      runId,
      resourceId,
      snapshot: {
        runId,
        status: workflowStatus,
        value: executionContext.state,
        context: stepResults as any,
        activePaths: [],
        serializedStepGraph,
        suspendedPaths: executionContext.suspendedPaths,
        waitingPaths: {},
        resumeLabels: executionContext.resumeLabels,
        result,
        error,
        runtimeContext: runtimeContextObj,
        // @ts-ignore
        timestamp: Date.now(),
      },
    });
  }

  async executeEntry({
    workflowId,
    runId,
    resourceId,
    entry,
    prevStep,
    serializedStepGraph,
    stepResults,
    resume,
    executionContext,
    tracingContext,
    emitter,
    abortController,
    runtimeContext,
    writableStream,
    disableScorers,
  }: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    entry: StepFlowEntry;
    prevStep: StepFlowEntry;
    serializedStepGraph: SerializedStepFlowEntry[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    tracingContext: TracingContext;
    emitter: Emitter;
    abortController: AbortController;
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
  }): Promise<{
    result: StepResult<any, any, any, any>;
    stepResults?: Record<string, StepResult<any, any, any, any>>;
    executionContext?: ExecutionContext;
  }> {
    const prevOutput = this.getStepOutput(stepResults, prevStep);
    let execResults: any;

    if (entry.type === 'step') {
      const { step } = entry;
      execResults = await this.executeStep({
        workflowId,
        runId,
        resourceId,
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput,
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
        disableScorers,
        serializedStepGraph,
      });
    } else if (resume?.resumePath?.length && entry.type === 'parallel') {
      const idx = resume.resumePath.shift();
      const resumedStepResult = await this.executeEntry({
        workflowId,
        runId,
        resourceId,
        entry: entry.steps[idx!]!,
        prevStep,
        serializedStepGraph,
        stepResults,
        resume,
        executionContext: {
          workflowId,
          runId,
          executionPath: [...executionContext.executionPath, idx!],
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,

          state: executionContext.state,
        },
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
        disableScorers,
      });

      // After resuming one parallel step, check if ALL parallel steps are complete
      // Update stepResults with the resumed step's result
      if (resumedStepResult.stepResults) {
        Object.assign(stepResults, resumedStepResult.stepResults);
      }

      // Check the status of all parallel steps in this block
      const allParallelStepsComplete = entry.steps.every(parallelStep => {
        if (parallelStep.type === 'step') {
          const stepResult = stepResults[parallelStep.step.id];
          return stepResult && stepResult.status === 'success';
        }
        return true; // Non-step entries are considered complete
      });

      if (allParallelStepsComplete) {
        // All parallel steps are complete, return success for the parallel block
        execResults = {
          status: 'success',
          output: entry.steps.reduce((acc: Record<string, any>, parallelStep) => {
            if (parallelStep.type === 'step') {
              const stepResult = stepResults[parallelStep.step.id];
              if (stepResult && stepResult.status === 'success') {
                acc[parallelStep.step.id] = stepResult.output;
              }
            }
            return acc;
          }, {}),
        };
      } else {
        // Some parallel steps are still suspended, keep the parallel block suspended
        const stillSuspended = entry.steps.find(parallelStep => {
          if (parallelStep.type === 'step') {
            const stepResult = stepResults[parallelStep.step.id];
            return stepResult && stepResult.status === 'suspended';
          }
          return false;
        });
        execResults = {
          status: 'suspended',
          payload:
            stillSuspended && stillSuspended.type === 'step' ? stepResults[stillSuspended.step.id]?.suspendPayload : {},
        };
      }

      // Ensure execution context includes suspended paths for non-resumed steps
      const updatedExecutionContext: ExecutionContext = {
        ...executionContext,
        ...resumedStepResult.executionContext,
        suspendedPaths: {
          ...executionContext.suspendedPaths,
          ...resumedStepResult.executionContext?.suspendedPaths,
        },
      };

      // For suspended parallel blocks, maintain suspended paths for non-resumed steps
      if (execResults.status === 'suspended') {
        entry.steps.forEach((parallelStep, stepIndex) => {
          if (parallelStep.type === 'step') {
            const stepResult = stepResults[parallelStep.step.id];
            if (stepResult && stepResult.status === 'suspended') {
              // Ensure this step remains in suspendedPaths
              updatedExecutionContext.suspendedPaths[parallelStep.step.id] = [
                ...executionContext.executionPath,
                stepIndex,
              ];
            }
          }
        });
      }

      return {
        result: execResults,
        stepResults: resumedStepResult.stepResults,
        executionContext: updatedExecutionContext,
      };
    } else if (entry.type === 'parallel') {
      execResults = await this.executeParallel({
        workflowId,
        runId,
        entry,
        prevStep,
        stepResults,
        serializedStepGraph,
        resume,
        executionContext,
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
        disableScorers,
      });
    } else if (entry.type === 'conditional') {
      execResults = await this.executeConditional({
        workflowId,
        runId,
        entry,
        prevStep,
        prevOutput,
        stepResults,
        serializedStepGraph,
        resume,
        executionContext,
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
        disableScorers,
      });
    } else if (entry.type === 'loop') {
      execResults = await this.executeLoop({
        workflowId,
        runId,
        entry,
        prevStep,
        prevOutput,
        stepResults,
        resume,
        executionContext,
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
        disableScorers,
        serializedStepGraph,
      });
    } else if (entry.type === 'foreach') {
      execResults = await this.executeForeach({
        workflowId,
        runId,
        entry,
        prevStep,
        prevOutput,
        stepResults,
        resume,
        executionContext,
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
        disableScorers,
        serializedStepGraph,
      });
    } else if (entry.type === 'sleep') {
      const startedAt = Date.now();
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: entry.id,
            status: 'waiting',
            payload: prevOutput,
            startedAt,
          },
          workflowState: {
            status: 'waiting',
            steps: {
              ...stepResults,
              [entry.id]: {
                status: 'waiting',
                payload: prevOutput,
                startedAt,
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });
      await emitter.emit('watch-v2', {
        type: 'workflow-step-waiting',
        payload: {
          id: entry.id,
          payload: prevOutput,
          startedAt,
          status: 'waiting',
        },
      });
      await this.persistStepUpdate({
        workflowId,
        runId,
        resourceId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'waiting',
        runtimeContext,
      });

      await this.executeSleep({
        workflowId,
        runId,
        entry,
        prevStep,
        prevOutput,
        stepResults,
        serializedStepGraph,
        resume,
        executionContext,
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
      });

      await this.persistStepUpdate({
        workflowId,
        runId,
        resourceId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'running',
        runtimeContext,
      });

      const endedAt = Date.now();
      const stepInfo = {
        payload: prevOutput,
        startedAt,
        endedAt,
      };

      execResults = { ...stepInfo, status: 'success', output: prevOutput };
      stepResults[entry.id] = { ...stepInfo, status: 'success', output: prevOutput };
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: entry.id,
            ...execResults,
          },
          workflowState: {
            status: 'running',
            steps: {
              ...stepResults,
              [entry.id]: {
                ...execResults,
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });
      await emitter.emit('watch-v2', {
        type: 'workflow-step-result',
        payload: {
          id: entry.id,
          endedAt,
          status: 'success',
          output: prevOutput,
        },
      });

      await emitter.emit('watch-v2', {
        type: 'workflow-step-finish',
        payload: {
          id: entry.id,
          metadata: {},
        },
      });
    } else if (entry.type === 'sleepUntil') {
      const startedAt = Date.now();
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: entry.id,
            status: 'waiting',
            payload: prevOutput,
            startedAt,
          },
          workflowState: {
            status: 'waiting',
            steps: {
              ...stepResults,
              [entry.id]: {
                status: 'waiting',
                payload: prevOutput,
                startedAt,
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });
      await emitter.emit('watch-v2', {
        type: 'workflow-step-waiting',
        payload: {
          id: entry.id,
          payload: prevOutput,
          startedAt,
          status: 'waiting',
        },
      });

      await this.persistStepUpdate({
        workflowId,
        runId,
        resourceId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'waiting',
        runtimeContext,
      });

      await this.executeSleepUntil({
        workflowId,
        runId,
        entry,
        prevStep,
        prevOutput,
        stepResults,
        serializedStepGraph,
        resume,
        executionContext,
        tracingContext,
        emitter,
        abortController,
        runtimeContext,
        writableStream,
      });

      await this.persistStepUpdate({
        workflowId,
        runId,
        resourceId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'running',
        runtimeContext,
      });

      const endedAt = Date.now();
      const stepInfo = {
        payload: prevOutput,
        startedAt,
        endedAt,
      };

      execResults = { ...stepInfo, status: 'success', output: prevOutput };
      stepResults[entry.id] = { ...stepInfo, status: 'success', output: prevOutput };

      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: entry.id,
            ...execResults,
          },
          workflowState: {
            status: 'running',
            steps: {
              ...stepResults,
              [entry.id]: {
                ...execResults,
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });
      await emitter.emit('watch-v2', {
        type: 'workflow-step-result',
        payload: {
          id: entry.id,
          endedAt,
          status: 'success',
          output: prevOutput,
        },
      });

      await emitter.emit('watch-v2', {
        type: 'workflow-step-finish',
        payload: {
          id: entry.id,
          metadata: {},
        },
      });
    } else if (entry.type === 'waitForEvent') {
      const startedAt = Date.now();
      let eventData: any;
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: entry.step.id,
            status: 'waiting',
            payload: prevOutput,
            startedAt,
          },
          workflowState: {
            status: 'waiting',
            steps: {
              ...stepResults,
              [entry.step.id]: {
                status: 'waiting',
                payload: prevOutput,
                startedAt,
              },
            },
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });
      await emitter.emit('watch-v2', {
        type: 'workflow-step-waiting',
        payload: {
          id: entry.step.id,
          payload: prevOutput,
          startedAt,
          status: 'waiting',
        },
      });

      stepResults[entry.step.id] = {
        status: 'waiting',
        payload: prevOutput,
        startedAt,
      };

      await this.persistStepUpdate({
        workflowId,
        runId,
        resourceId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'waiting',
        runtimeContext,
      });

      try {
        eventData = await this.executeWaitForEvent({
          event: entry.event,
          emitter,
          timeout: entry.timeout,
          tracingContext,
        });

        const { step } = entry;
        execResults = await this.executeStep({
          workflowId,
          runId,
          resourceId,
          step,
          stepResults,
          executionContext,
          resume: {
            resumePayload: eventData,
            steps: [entry.step.id],
          },
          prevOutput,
          tracingContext,
          emitter,
          abortController,
          runtimeContext,
          writableStream,
          disableScorers,
          serializedStepGraph,
        });
      } catch (error) {
        execResults = {
          status: 'failed',
          error: error as Error,
        };
      }
      const endedAt = Date.now();
      const stepInfo = {
        payload: prevOutput,
        startedAt,
        endedAt,
      };

      execResults = { ...execResults, ...stepInfo };
    }

    if (entry.type === 'step' || entry.type === 'waitForEvent' || entry.type === 'loop' || entry.type === 'foreach') {
      stepResults[entry.step.id] = execResults;
    }

    if (abortController?.signal?.aborted) {
      execResults = { ...execResults, status: 'canceled' };
    }

    await this.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      serializedStepGraph,
      stepResults,
      executionContext,
      workflowStatus: execResults.status === 'success' ? 'running' : execResults.status,
      runtimeContext,
    });

    if (execResults.status === 'canceled') {
      await emitter.emit('watch-v2', {
        type: 'workflow-canceled',
        payload: {},
      });
    }

    return { result: execResults, stepResults, executionContext };
  }
}

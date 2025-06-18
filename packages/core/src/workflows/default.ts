import { context as otlpContext, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import type { RuntimeContext } from '../di';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { EMITTER_SYMBOL } from './constants';
import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type { ExecuteFunction, Step } from './step';
import type { Emitter, StepFailure, StepResult, StepSuccess } from './types';
import type { DefaultEngineType, SerializedStepFlowEntry, StepFlowEntry } from './workflow';

export type ExecutionContext = {
  workflowId: string;
  runId: string;
  executionPath: number[];
  suspendedPaths: Record<string, number[]>;
  retryConfig: {
    attempts: number;
    delay: number;
  };
  executionSpan: Span;
};

/**
 * Default implementation of the ExecutionEngine using XState
 */
export class DefaultExecutionEngine extends ExecutionEngine {
  protected async fmtReturnValue<TOutput>(
    executionSpan: Span | undefined,
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

      base.error =
        error instanceof Error
          ? (error?.stack ?? error)
          : (lastOutput.error ??
            (typeof error === 'string'
              ? error
              : (new Error('Unknown error: ' + error)?.stack ?? new Error('Unknown error: ' + error))));
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

    executionSpan?.end();
    return base as TOutput;
  }

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    graph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    input?: TInput;
    resume?: {
      // TODO: add execute path
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    emitter: Emitter;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    runtimeContext: RuntimeContext;
  }): Promise<TOutput> {
    const { workflowId, runId, graph, input, resume, retryConfig } = params;
    const { attempts = 0, delay = 0 } = retryConfig ?? {};
    const steps = graph.steps;

    if (steps.length === 0) {
      throw new MastraError({
        id: 'WORKFLOW_EXECUTE_EMPTY_GRAPH',
        text: 'Workflow must have at least one step',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
      });
    }

    const executionSpan = this.mastra?.getTelemetry()?.tracer.startSpan(`workflow.${workflowId}.execute`, {
      attributes: { componentName: workflowId, runId },
    });

    let startIdx = 0;
    if (resume?.resumePath) {
      startIdx = resume.resumePath[0]!;
      resume.resumePath.shift();
    }

    const stepResults: Record<string, any> = resume?.stepResults || { input };
    let lastOutput: any;
    for (let i = startIdx; i < steps.length; i++) {
      const entry = steps[i]!;
      try {
        lastOutput = await this.executeEntry({
          workflowId,
          runId,
          entry,
          serializedStepGraph: params.serializedStepGraph,
          prevStep: steps[i - 1]!,
          stepResults,
          resume,
          executionContext: {
            workflowId,
            runId,
            executionPath: [i],
            suspendedPaths: {},
            retryConfig: { attempts, delay },
            executionSpan: executionSpan as Span,
          },
          emitter: params.emitter,
          runtimeContext: params.runtimeContext,
        });
        if (lastOutput.result.status !== 'success') {
          const result = (await this.fmtReturnValue(
            executionSpan,
            params.emitter,
            stepResults,
            lastOutput.result,
          )) as any;
          await this.persistStepUpdate({
            workflowId,
            runId,
            stepResults: lastOutput.stepResults as any,
            serializedStepGraph: params.serializedStepGraph,
            executionContext: lastOutput.executionContext as ExecutionContext,
            workflowStatus: result.status,
            result: result.result,
            error: result.error,
          });
          return result;
        }
      } catch (e) {
        const error =
          e instanceof MastraError
            ? e
            : new MastraError(
                {
                  id: 'WORKFLOW_ENGINE_STEP_EXECUTION_FAILED',
                  domain: ErrorDomain.MASTRA_WORKFLOW,
                  category: ErrorCategory.USER,
                  details: { workflowId, runId },
                },
                e,
              );

        this.logger?.trackException(error);
        this.logger?.error(`Error executing step: ${error?.stack}`);
        const result = (await this.fmtReturnValue(
          executionSpan,
          params.emitter,
          stepResults,
          lastOutput.result,
          e as Error,
        )) as any;
        await this.persistStepUpdate({
          workflowId,
          runId,
          stepResults: lastOutput.stepResults as any,
          serializedStepGraph: params.serializedStepGraph,
          executionContext: lastOutput.executionContext as ExecutionContext,
          workflowStatus: result.status,
          result: result.result,
          error: result.error,
        });
        return result;
      }
    }

    const result = (await this.fmtReturnValue(executionSpan, params.emitter, stepResults, lastOutput.result)) as any;
    await this.persistStepUpdate({
      workflowId,
      runId,
      stepResults: lastOutput.stepResults as any,
      serializedStepGraph: params.serializedStepGraph,
      executionContext: lastOutput.executionContext as ExecutionContext,
      workflowStatus: result.status,
      result: result.result,
      error: result.error,
    });
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
          if (entry.type === 'step' || entry.type === 'waitForEvent') {
            acc[entry.step.id] = stepResults[entry.step.id]?.output;
          } else if (entry.type === 'parallel' || entry.type === 'conditional') {
            const parallelResult = this.getStepOutput(stepResults, entry)?.output;
            acc = { ...acc, ...parallelResult };
          } else if (entry.type === 'loop') {
            acc[entry.step.id] = stepResults[entry.step.id]?.output;
          } else if (entry.type === 'foreach') {
            acc[entry.step.id] = stepResults[entry.step.id]?.output;
          } else if (entry.type === 'sleep' || entry.type === 'sleepUntil') {
            acc[entry.id] = stepResults[entry.id]?.output;
          }
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

  async executeSleep({ duration }: { id: string; duration: number }): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  async executeWaitForEvent({
    event,
    emitter,
    timeout,
  }: {
    event: string;
    emitter: Emitter;
    timeout?: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const cb = (eventData: any) => {
        resolve(eventData);
      };
      if (timeout) {
        setTimeout(() => {
          emitter.off(`user-event-${event}`, cb);
          reject(new Error('Timeout waiting for event'));
        }, timeout);
      }

      emitter.once(`user-event-${event}`, cb);
    });
  }

  async executeStep({
    workflowId,
    runId,
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    executionContext: ExecutionContext;
    resume?: {
      steps: string[];
      resumePayload: any;
    };
    prevOutput: any;
    emitter: Emitter;
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    const startTime = resume?.steps[0] === step.id ? undefined : Date.now();
    const resumeTime = resume?.steps[0] === step.id ? Date.now() : undefined;

    const stepInfo = {
      ...stepResults[step.id],
      payload: prevOutput,
      ...(resume?.steps[0] === step.id ? { resumePayload: resume?.resumePayload } : {}),
      ...(startTime ? { startedAt: startTime } : {}),
      ...(resumeTime ? { resumedAt: resumeTime } : {}),
    };

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
      type: 'step-start',
      payload: {
        id: step.id,
      },
    });

    const _runStep = (step: Step<any, any, any, any>, spanName: string, attributes?: Record<string, string>) => {
      return async (data: any) => {
        const telemetry = this.mastra?.getTelemetry();
        const span = executionContext.executionSpan;
        if (!telemetry || !span) {
          return step.execute(data);
        }

        return otlpContext.with(trace.setSpan(otlpContext.active(), span), async () => {
          return telemetry.traceMethod(step.execute.bind(step), {
            spanName,
            attributes,
          })(data);
        });
      };
    };

    const runStep = _runStep(step, `workflow.${workflowId}.step.${step.id}`, {
      componentName: workflowId,
      runId,
    });

    let execResults: any;

    const retries = step.retries ?? executionContext.retryConfig.attempts ?? 0;

    // +1 for the initial attempt
    for (let i = 0; i < retries + 1; i++) {
      try {
        let suspended: { payload: any } | undefined;
        const result = await runStep({
          runId,
          mastra: this.mastra!,
          runtimeContext,
          inputData: prevOutput,
          resumeData: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
          getInitData: () => stepResults?.input as any,
          getStepResult: (step: any) => {
            if (!step?.id) {
              return null;
            }

            const result = stepResults[step.id];
            if (result?.status === 'success') {
              return result.output;
            }

            return null;
          },
          suspend: async (suspendPayload: any) => {
            executionContext.suspendedPaths[step.id] = executionContext.executionPath;
            suspended = { payload: suspendPayload };
          },
          resume: {
            steps: resume?.steps?.slice(1) || [],
            resumePayload: resume?.resumePayload,
            // @ts-ignore
            runId: stepResults[step.id]?.suspendPayload?.__workflow_meta?.runId,
          },
          [EMITTER_SYMBOL]: emitter,
          engine: {},
        });

        if (suspended) {
          execResults = { status: 'suspended', suspendPayload: suspended.payload, suspendedAt: Date.now() };
        } else {
          execResults = { status: 'success', output: result, endedAt: Date.now() };
        }

        break;
      } catch (e) {
        const error =
          e instanceof MastraError
            ? e
            : new MastraError(
                {
                  id: 'WORKFLOW_STEP_INVOKE_FAILED',
                  domain: ErrorDomain.MASTRA_WORKFLOW,
                  category: ErrorCategory.USER,
                  details: { workflowId, runId, stepId: step.id },
                },
                e,
              );
        this.logger.trackException(error);
        this.logger.error('Error executing step: ' + error?.stack);
        execResults = {
          status: 'failed',
          error: error?.stack,
          endedAt: Date.now(),
        };
      }
    }

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
        type: 'step-suspended',
        payload: {
          id: step.id,
          output: execResults.output,
        },
      });
    } else {
      await emitter.emit('watch-v2', {
        type: 'step-result',
        payload: {
          id: step.id,
          status: execResults.status,
          output: execResults.output,
        },
      });

      await emitter.emit('watch-v2', {
        type: 'step-finish',
        payload: {
          id: step.id,
          metadata: {},
        },
      });
    }

    return { ...stepInfo, ...execResults };
  }

  async executeParallel({
    workflowId,
    runId,
    entry,
    prevStep,
    serializedStepGraph,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    entry: { type: 'parallel'; steps: StepFlowEntry[] };
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
    emitter: Emitter;
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    let execResults: any;
    const results: { result: StepResult<any, any, any, any> }[] = await Promise.all(
      entry.steps.map((step, i) =>
        this.executeEntry({
          workflowId,
          runId,
          entry: step,
          prevStep,
          stepResults,
          serializedStepGraph,
          resume,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, i],
            suspendedPaths: executionContext.suspendedPaths,
            retryConfig: executionContext.retryConfig,
            executionSpan: executionContext.executionSpan,
          },
          emitter,
          runtimeContext,
        }),
      ),
    );
    const hasFailed = results.find(result => result.result.status === 'failed') as {
      result: StepFailure<any, any, any>;
    };
    const hasSuspended = results.find(result => result.result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.result.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.result.suspendPayload };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.result.status === 'success') {
            // @ts-ignore
            acc[entry.steps[index]!.step.id] = result.result.output;
          }

          return acc;
        }, {}),
      };
    }

    return execResults;
  }

  async executeConditional({
    workflowId,
    runId,
    entry,
    prevOutput,
    prevStep,
    serializedStepGraph,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    serializedStepGraph: SerializedStepFlowEntry[];
    entry: {
      type: 'conditional';
      steps: StepFlowEntry[];
      conditions: ExecuteFunction<any, any, any, any, DefaultEngineType>[];
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
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    let execResults: any;
    const truthyIndexes = (
      await Promise.all(
        entry.conditions.map(async (cond, index) => {
          try {
            const result = await cond({
              runId,
              mastra: this.mastra!,
              runtimeContext,
              inputData: prevOutput,
              getInitData: () => stepResults?.input as any,
              getStepResult: (step: any) => {
                if (!step?.id) {
                  return null;
                }

                const result = stepResults[step.id];
                if (result?.status === 'success') {
                  return result.output;
                }

                return null;
              },

              // TODO: this function shouldn't have suspend probably?
              suspend: async (_suspendPayload: any) => {},
              [EMITTER_SYMBOL]: emitter,
              engine: {},
            });
            return result ? index : null;
          } catch (e: unknown) {
            const error =
              e instanceof MastraError
                ? e
                : new MastraError(
                    {
                      id: 'WORKFLOW_CONDITION_EVALUATION_FAILED',
                      domain: ErrorDomain.MASTRA_WORKFLOW,
                      category: ErrorCategory.USER,
                      details: { workflowId, runId },
                    },
                    e,
                  );
            this.logger.trackException(error);
            this.logger.error('Error evaluating condition: ' + error?.stack);
            return null;
          }
        }),
      )
    ).filter((index): index is number => index !== null);

    const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));
    const results: { result: StepResult<any, any, any, any> }[] = await Promise.all(
      stepsToRun.map((step, index) =>
        this.executeEntry({
          workflowId,
          runId,
          entry: step,
          prevStep,
          stepResults,
          serializedStepGraph,
          resume,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, index],
            suspendedPaths: executionContext.suspendedPaths,
            retryConfig: executionContext.retryConfig,
            executionSpan: executionContext.executionSpan,
          },
          emitter,
          runtimeContext,
        }),
      ),
    );
    const hasFailed = results.find(result => result.result.status === 'failed') as {
      result: StepFailure<any, any, any>;
    };
    const hasSuspended = results.find(result => result.result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.result.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.result.suspendPayload };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.result.status === 'success') {
            // @ts-ignore
            acc[stepsToRun[index]!.step.id] = result.result.output;
          }

          return acc;
        }, {}),
      };
    }

    return execResults;
  }

  async executeLoop({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    entry: {
      type: 'loop';
      step: Step;
      condition: ExecuteFunction<any, any, any, any, DefaultEngineType>;
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
    emitter: Emitter;
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    const { step, condition } = entry;
    let isTrue = true;
    let result = { status: 'success', output: prevOutput } as unknown as StepResult<any, any, any, any>;

    do {
      result = await this.executeStep({
        workflowId,
        runId,
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput: (result as { output: any }).output,
        emitter,
        runtimeContext,
      });

      if (result.status !== 'success') {
        return result;
      }

      isTrue = await condition({
        runId,
        mastra: this.mastra!,
        runtimeContext,
        inputData: result.output,
        getInitData: () => stepResults?.input as any,
        getStepResult: (step: any) => {
          if (!step?.id) {
            return null;
          }

          const result = stepResults[step.id];
          return result?.status === 'success' ? result.output : null;
        },
        suspend: async (_suspendPayload: any) => {},
        [EMITTER_SYMBOL]: emitter,
        engine: {},
      });
    } while (entry.loopType === 'dowhile' ? isTrue : !isTrue);

    return result;
  }

  async executeForeach({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
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
    };
    executionContext: ExecutionContext;
    emitter: Emitter;
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    const { step, opts } = entry;
    const results: StepResult<any, any, any, any>[] = [];
    const concurrency = opts.concurrency;
    const startTime = resume?.steps[0] === step.id ? undefined : Date.now();
    const resumeTime = resume?.steps[0] === step.id ? Date.now() : undefined;

    for (let i = 0; i < prevOutput.length; i += concurrency) {
      const items = prevOutput.slice(i, i + concurrency);
      const itemsResults = await Promise.all(
        items.map((item: any) => {
          return this.executeStep({
            workflowId,
            runId,
            step,
            stepResults,
            executionContext,
            resume,
            prevOutput: item,
            emitter,
            runtimeContext,
          });
        }),
      );

      for (const result of itemsResults) {
        if (result.status !== 'success') {
          return result;
        }

        results.push(result?.output);
      }
    }

    return {
      ...stepResults[step.id],
      status: 'success',
      payload: prevOutput,
      ...(resume?.steps[0] === step.id ? { resumePayload: resume?.resumePayload } : {}),
      output: results,
      //@ts-ignore
      endedAt: Date.now(),
      ...(startTime ? { startedAt: startTime } : {}),
      ...(resumeTime ? { resumedAt: resumeTime } : {}),
    } as StepSuccess<any, any, any, any>;
  }

  protected async persistStepUpdate({
    workflowId,
    runId,
    stepResults,
    serializedStepGraph,
    executionContext,
    workflowStatus,
    result,
    error,
  }: {
    workflowId: string;
    runId: string;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    serializedStepGraph: SerializedStepFlowEntry[];
    executionContext: ExecutionContext;
    workflowStatus: 'success' | 'failed' | 'suspended' | 'running' | 'waiting';
    result?: Record<string, any>;
    error?: string | Error;
  }) {
    await this.mastra?.getStorage()?.persistWorkflowSnapshot({
      workflowName: workflowId,
      runId,
      snapshot: {
        runId,
        status: workflowStatus,
        value: {},
        context: stepResults as any,
        activePaths: [],
        serializedStepGraph,
        suspendedPaths: executionContext.suspendedPaths,
        result,
        error,
        // @ts-ignore
        timestamp: Date.now(),
      },
    });
  }

  async executeEntry({
    workflowId,
    runId,
    entry,
    prevStep,
    serializedStepGraph,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
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
    emitter: Emitter;
    runtimeContext: RuntimeContext;
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
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput,
        emitter,
        runtimeContext,
      });
    } else if (resume?.resumePath?.length && (entry.type === 'parallel' || entry.type === 'conditional')) {
      const idx = resume.resumePath.shift();
      return this.executeEntry({
        workflowId,
        runId,
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
          retryConfig: executionContext.retryConfig,
          executionSpan: executionContext.executionSpan,
        },
        emitter,
        runtimeContext,
      });
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
        emitter,
        runtimeContext,
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
        emitter,
        runtimeContext,
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
        emitter,
        runtimeContext,
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
        emitter,
        runtimeContext,
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
        type: 'step-waiting',
        payload: {
          id: entry.id,
        },
      });
      await this.persistStepUpdate({
        workflowId,
        runId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'waiting',
      });

      await this.executeSleep({ id: entry.id, duration: entry.duration });

      await this.persistStepUpdate({
        workflowId,
        runId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'running',
      });

      const endedAt = Date.now();
      const stepInfo = {
        payload: prevOutput,
        startedAt,
        endedAt,
      };

      execResults = { ...stepInfo, status: 'success', output: prevOutput };
      stepResults[entry.id] = { ...stepInfo, status: 'success', output: prevOutput };
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
        type: 'step-waiting',
        payload: {
          id: entry.id,
        },
      });

      await this.persistStepUpdate({
        workflowId,
        runId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'waiting',
      });

      await this.executeSleep({ id: entry.id, duration: entry.date.getTime() - Date.now() });

      await this.persistStepUpdate({
        workflowId,
        runId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'running',
      });

      const endedAt = Date.now();
      const stepInfo = {
        payload: prevOutput,
        startedAt,
        endedAt,
      };

      execResults = { ...stepInfo, status: 'success', output: prevOutput };
      stepResults[entry.id] = { ...stepInfo, status: 'success', output: prevOutput };
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
        type: 'step-waiting',
        payload: {
          id: entry.step.id,
        },
      });

      await this.persistStepUpdate({
        workflowId,
        runId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'waiting',
      });

      try {
        eventData = await this.executeWaitForEvent({ event: entry.event, emitter, timeout: entry.timeout });

        await this.persistStepUpdate({
          workflowId,
          runId,
          serializedStepGraph,
          stepResults,
          executionContext,
          workflowStatus: 'running',
        });

        const { step } = entry;
        execResults = await this.executeStep({
          workflowId,
          runId,
          step,
          stepResults,
          executionContext,
          resume: {
            resumePayload: eventData,
            steps: [entry.step.id],
          },
          prevOutput,
          emitter,
          runtimeContext,
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

    await this.persistStepUpdate({
      workflowId,
      runId,
      serializedStepGraph,
      stepResults,
      executionContext,
      workflowStatus: 'running',
    });

    return { result: execResults, stepResults, executionContext };
  }
}

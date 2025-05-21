import { context as otlpContext, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import type { RuntimeContext } from '../di';
import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type { ExecuteFunction, Step } from './step';
import type { StepResult } from './types';
import type { StepFlowEntry } from './workflow';

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
    emitter: { emit: (event: string, data: any) => Promise<void> },
    stepResults: Record<string, StepResult<any>>,
    lastOutput: StepResult<any>,
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

      base.error = error instanceof Error ? error : (lastOutput.error ?? new Error('Unknown error: ' + error));
    } else if (lastOutput.status === 'suspended') {
      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.payload?.__workflow_meta?.path;
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
    input?: TInput;
    resume?: {
      // TODO: add execute path
      steps: string[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    emitter: { emit: (event: string, data: any) => Promise<void> };
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
      throw new Error('Workflow must have at least one step');
    }

    const executionSpan = this.mastra?.getTelemetry()?.tracer.startSpan(`workflow.${workflowId}.execute`, {
      attributes: { componentName: workflowId, runId },
    });

    await this.mastra?.getStorage()?.init();

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
        if (lastOutput.status !== 'success') {
          return this.fmtReturnValue(executionSpan, params.emitter, stepResults, lastOutput);
        }
      } catch (e) {
        this.logger.error('Error executing step: ' + ((e as Error)?.stack ?? e));
        return this.fmtReturnValue(executionSpan, params.emitter, stepResults, lastOutput, e as Error);
      }
    }

    return this.fmtReturnValue(executionSpan, params.emitter, stepResults, lastOutput);
  }

  getStepOutput(stepResults: Record<string, any>, step?: StepFlowEntry): any {
    if (!step) {
      return stepResults.input;
    } else if (step.type === 'step') {
      return stepResults[step.step.id]?.output;
    } else if (step.type === 'parallel' || step.type === 'conditional') {
      return step.steps.reduce(
        (acc, entry) => {
          if (entry.type === 'step') {
            acc[entry.step.id] = stepResults[entry.step.id]?.output;
          } else if (entry.type === 'parallel' || entry.type === 'conditional') {
            const parallelResult = this.getStepOutput(stepResults, entry)?.output;
            acc = { ...acc, ...parallelResult };
          } else if (entry.type === 'loop') {
            acc[entry.step.id] = stepResults[entry.step.id]?.output;
          } else if (entry.type === 'foreach') {
            acc[entry.step.id] = stepResults[entry.step.id]?.output;
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
    stepResults: Record<string, StepResult<any>>;
    executionContext: ExecutionContext;
    resume?: {
      steps: string[];
      resumePayload: any;
    };
    prevOutput: any;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    await emitter.emit('watch', {
      type: 'watch',
      payload: {
        currentStep: {
          id: step.id,
          status: 'running',
        },
        workflowState: {
          status: 'running',
          steps: {
            ...stepResults,
            [step.id]: {
              status: 'running',
            },
          },
          result: null,
          error: null,
        },
      },
      eventTimestamp: Date.now(),
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
            runId: stepResults[step.id]?.payload?.__workflow_meta?.runId,
          },
          emitter,
        });

        if (suspended) {
          execResults = { status: 'suspended', payload: suspended.payload };
        } else {
          execResults = { status: 'success', output: result };
        }

        break;
      } catch (e) {
        this.logger.error('Error executing step: ' + ((e as Error)?.stack ?? e));
        execResults = { status: 'failed', error: e instanceof Error ? e : new Error('Unknown error: ' + e) };
      }
    }

    await emitter.emit('watch', {
      type: 'watch',
      payload: {
        currentStep: {
          id: step.id,
          status: execResults.status,
          output: execResults.output,
        },
        workflowState: {
          status: 'running',
          steps: {
            ...stepResults,
            [step.id]: {
              status: execResults.status,
              output: execResults.output,
              error: execResults.error,
              payload: execResults.payload,
            },
          },

          result: null,
          error: null,
        },
      },
      eventTimestamp: Date.now(),
    });

    return execResults;
  }

  async executeParallel({
    workflowId,
    runId,
    entry,
    prevStep,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    entry: { type: 'parallel'; steps: StepFlowEntry[] };
    prevStep: StepFlowEntry;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    let execResults: any;
    const results: StepResult<any>[] = await Promise.all(
      entry.steps.map((step, i) =>
        this.executeEntry({
          workflowId,
          runId,
          entry: step,
          prevStep,
          stepResults,
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
    const hasFailed = results.find(result => result.status === 'failed');
    const hasSuspended = results.find(result => result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.payload };
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

    return execResults;
  }

  async executeConditional({
    workflowId,
    runId,
    entry,
    prevOutput,
    prevStep,
    stepResults,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    entry: { type: 'conditional'; steps: StepFlowEntry[]; conditions: ExecuteFunction<any, any, any, any>[] };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    let execResults: any;
    const truthyIndexes = (
      await Promise.all(
        entry.conditions.map(async (cond, index) => {
          try {
            const result = await cond({
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
              emitter,
            });
            return result ? index : null;
          } catch (e: unknown) {
            this.logger.error('Error evaluating condition: ' + ((e as Error)?.stack ?? e));
            return null;
          }
        }),
      )
    ).filter((index): index is number => index !== null);

    const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));
    const results: StepResult<any>[] = await Promise.all(
      stepsToRun.map((step, index) =>
        this.executeEntry({
          workflowId,
          runId,
          entry: step,
          prevStep,
          stepResults,
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
    const hasFailed = results.find(result => result.status === 'failed');
    const hasSuspended = results.find(result => result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.payload };
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
      condition: ExecuteFunction<any, any, any, any>;
      loopType: 'dowhile' | 'dountil';
    };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    const { step, condition } = entry;
    let isTrue = true;
    let result: StepResult<any> = { status: 'success', output: prevOutput };

    do {
      result = await this.executeStep({
        workflowId,
        runId,
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput: result.output,
        emitter,
        runtimeContext,
      });

      if (result.status !== 'success') {
        return result;
      }

      isTrue = await condition({
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
        emitter,
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
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
    const { step, opts } = entry;
    const results: StepResult<any>[] = [];
    const concurrency = opts.concurrency;

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

    return { status: 'success', output: results };
  }

  protected async persistStepUpdate({
    workflowId,
    runId,
    stepResults,
    executionContext,
  }: {
    workflowId: string;
    runId: string;
    stepResults: Record<string, StepResult<any>>;
    executionContext: ExecutionContext;
  }) {
    await this.mastra?.getStorage()?.persistWorkflowSnapshot({
      workflowName: workflowId,
      runId,
      snapshot: {
        runId,
        value: {},
        context: stepResults as any,
        activePaths: [],
        suspendedPaths: executionContext.suspendedPaths,
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
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any>> {
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
    }

    if (entry.type === 'step' || entry.type === 'loop' || entry.type === 'foreach') {
      stepResults[entry.step.id] = execResults;
    }

    await this.persistStepUpdate({
      workflowId,
      runId,
      stepResults,
      executionContext,
    });

    return execResults;
  }
}

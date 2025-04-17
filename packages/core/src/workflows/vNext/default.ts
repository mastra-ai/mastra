import type EventEmitter from 'events';
import type { ExecutionGraph } from './execution-engine';
import { ExecutionEngine } from './execution-engine';
import type { ExecuteFunction, NewStep } from './step';
import type { StepResult } from './types';
import type { StepFlowEntry } from './workflow';

type ExecutionContext = {
  executionPath: number[];
  suspendedPaths: Record<string, number[]>;
  retryConfig: {
    attempts: number;
    delay: number;
  };
};

/**
 * Default implementation of the ExecutionEngine using XState
 */
export class DefaultExecutionEngine extends ExecutionEngine {
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
      steps: NewStep<string, any, any>[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    emitter: EventEmitter;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
  }): Promise<TOutput> {
    const { workflowId, runId, graph, input, resume, retryConfig } = params;
    const { attempts = 0, delay = 0 } = retryConfig ?? {};
    const steps = graph.steps;

    if (steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

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
            executionPath: [i],
            suspendedPaths: {},
            retryConfig: { attempts, delay },
          },
          emitter: params.emitter,
        });
        if (lastOutput.status !== 'success') {
          if (entry.type === 'step') {
            params.emitter.emit('watch', {
              type: 'watch',
              payload: {
                currentStep: {
                  id: entry.step.id,
                  ...lastOutput,
                },
                workflowState: {
                  status: lastOutput.status,
                  steps: stepResults,
                  result: null,
                  error: lastOutput.error,
                },
              },
              eventTimestamp: Date.now(),
            });
          }
          return {
            steps: stepResults,
            result: null,
            error: lastOutput.error,
          } as TOutput;
        }
      } catch (e) {
        if (entry.type === 'step') {
          params.emitter.emit('watch', {
            type: 'watch',
            payload: {
              currentStep: {
                id: entry.step.id,
                ...lastOutput,
              },
              workflowState: {
                status: lastOutput.status,
                steps: stepResults,
                result: null,
                error: lastOutput.error,
              },
            },
            eventTimestamp: Date.now(),
          });
        }

        return {
          steps: stepResults,
          result: null,
          error: e instanceof Error ? e.message : 'Unknown error',
        } as TOutput;
      }
    }

    const res = { steps: stepResults, result: lastOutput.output };

    return res as TOutput;
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
          }
          return acc;
        },
        {} as Record<string, any>,
      );
    } else if (step.type === 'loop') {
      return stepResults[step.step.id]?.output;
    }
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
  }: {
    step: NewStep<string, any, any>;
    stepResults: Record<string, StepResult<any>>;
    executionContext: ExecutionContext;
    resume?: {
      steps: NewStep<string, any, any>[];
      resumePayload: any;
    };
    prevOutput: any;
    emitter: EventEmitter;
  }): Promise<StepResult<any>> {
    let execResults: any;

    const retries = step.retries ?? executionContext.retryConfig.attempts ?? 0;

    // +1 for the initial attempt
    for (let i = 0; i < retries + 1; i++) {
      try {
        let suspended: { payload: any } | undefined;
        const result = await step.execute({
          mastra: this.mastra!,
          inputData: prevOutput,
          resumeData: resume?.steps[0]!.id === step.id ? resume?.resumePayload : undefined,
          getInitData: () => stepResults?.input as any,
          getStepResult: (step: any) => {
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
        execResults = { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
      }
    }

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
  }: {
    workflowId: string;
    runId: string;
    entry: { type: 'parallel'; steps: StepFlowEntry[] };
    prevStep: StepFlowEntry;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: NewStep<string, any, any>[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: EventEmitter;
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
            executionPath: [...executionContext.executionPath, i],
            suspendedPaths: executionContext.suspendedPaths,
            retryConfig: executionContext.retryConfig,
          },
          emitter,
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
  }: {
    workflowId: string;
    runId: string;
    entry: { type: 'conditional'; steps: StepFlowEntry[]; conditions: ExecuteFunction<any, any, any, any>[] };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: NewStep<string, any, any>[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: EventEmitter;
  }): Promise<StepResult<any>> {
    let execResults: any;
    const truthyIndexes = (
      await Promise.all(
        entry.conditions.map(async (cond, index) => {
          try {
            const result = await cond({
              mastra: this.mastra!,
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
            executionPath: [...executionContext.executionPath, index],
            suspendedPaths: executionContext.suspendedPaths,
            retryConfig: executionContext.retryConfig,
          },
          emitter,
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
    entry,
    prevOutput,
    stepResults,
    resume,
    executionContext,
    emitter,
  }: {
    workflowId: string;
    runId: string;
    entry: {
      type: 'loop';
      step: NewStep;
      condition: ExecuteFunction<any, any, any, any>;
      loopType: 'dowhile' | 'dountil';
    };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: NewStep<string, any, any>[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: EventEmitter;
  }): Promise<StepResult<any>> {
    const { step, condition } = entry;
    let isTrue = true;
    let result: StepResult<any> = { status: 'success', output: prevOutput };

    do {
      result = await this.executeStep({
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput: result.output,
        emitter,
      });

      if (result.status !== 'success') {
        return result;
      }

      isTrue = await condition({
        mastra: this.mastra!,
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

  async executeEntry({
    workflowId,
    runId,
    entry,
    prevStep,
    stepResults,
    resume,
    executionContext,
    emitter,
  }: {
    workflowId: string;
    runId: string;
    entry: StepFlowEntry;
    prevStep: StepFlowEntry;
    stepResults: Record<string, StepResult<any>>;
    resume?: {
      steps: NewStep<string, any, any>[];
      stepResults: Record<string, StepResult<any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: EventEmitter;
  }): Promise<StepResult<any>> {
    const prevOutput = this.getStepOutput(stepResults, prevStep);
    let execResults: any;

    if (entry.type === 'step') {
      const { step } = entry;
      execResults = await this.executeStep({
        step,
        stepResults,
        executionContext,
        resume,
        prevOutput,
        emitter,
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
          executionPath: [...executionContext.executionPath, idx!],
          suspendedPaths: executionContext.suspendedPaths,
          retryConfig: executionContext.retryConfig,
        },
        emitter,
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
      });
    }

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

    if (entry.type === 'step' || entry.type === 'loop') {
      stepResults[entry.step.id] = execResults;
      emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: entry.step.id,
            status: execResults.status,
            output: execResults.output,
          },
          workflowState: {
            status: 'running',
          },
        },
        eventTimestamp: Date.now(),
      });
    }

    return execResults;
  }
}

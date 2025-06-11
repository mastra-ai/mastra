import { randomUUID } from 'crypto';
import { subscribe } from '@inngest/realtime';
import type { Mastra, WorkflowRun, WorkflowRuns } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/di';
import { Workflow, createStep, Run, DefaultExecutionEngine, cloneStep } from '@mastra/core/workflows';
import type {
  ExecuteFunction,
  ExecutionContext,
  ExecutionEngine,
  ExecutionGraph,
  Step,
  WorkflowConfig,
  StepFlowEntry,
  StepResult,
  WorkflowResult,
  SerializedStepFlowEntry,
  StepFailure,
} from '@mastra/core/workflows';
import { EMITTER_SYMBOL } from '@mastra/core/workflows/_constants';
import type { Span } from '@opentelemetry/api';
import type { Inngest, BaseContext } from 'inngest';
import { serve as inngestServe } from 'inngest/hono';
import type { z } from 'zod';

export type InngestEngineType = {
  step: any;
};

export function serve({ mastra, inngest }: { mastra: Mastra; inngest: Inngest }): ReturnType<typeof inngestServe> {
  const wfs = mastra.getWorkflows();
  const functions = Object.values(wfs).flatMap(wf => {
    if (wf instanceof InngestWorkflow) {
      wf.__registerMastra(mastra);
      return wf.getFunctions();
    }
    return [];
  });
  return inngestServe({
    client: inngest,
    functions,
  });
}

export class InngestRun<
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
> extends Run<TSteps, TInput, TOutput> {
  private inngest: Inngest;
  serializedStepGraph: SerializedStepFlowEntry[];
  #mastra: Mastra;

  constructor(
    params: {
      workflowId: string;
      runId: string;
      executionEngine: ExecutionEngine;
      executionGraph: ExecutionGraph;
      serializedStepGraph: SerializedStepFlowEntry[];
      mastra?: Mastra;
      retryConfig?: {
        attempts?: number;
        delay?: number;
      };
      cleanup?: () => void;
    },
    inngest: Inngest,
  ) {
    super(params);
    this.inngest = inngest;
    this.serializedStepGraph = params.serializedStepGraph;
    this.#mastra = params.mastra!;
  }

  async getRuns(eventId: string) {
    const response = await fetch(`${this.inngest.apiBaseUrl ?? 'https://api.inngest.com'}/v1/events/${eventId}/runs`, {
      headers: {
        Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY}`,
      },
    });
    const json = await response.json();
    return (json as any).data;
  }

  async getRunOutput(eventId: string) {
    let runs = await this.getRuns(eventId);
    while (runs?.[0]?.status !== 'Completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runs = await this.getRuns(eventId);
      if (runs?.[0]?.status === 'Failed' || runs?.[0]?.status === 'Cancelled') {
        throw new Error(`Function run ${runs?.[0]?.status}`);
      }
    }
    return runs?.[0];
  }

  async start({
    inputData,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    await this.#mastra.getStorage()?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        value: {},
        context: {} as any,
        activePaths: [],
        suspendedPaths: {},
        timestamp: Date.now(),
        status: 'running',
      },
    });

    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData,
        runId: this.runId,
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    if (result.status === 'failed') {
      result.error = new Error(result.error);
    }

    this.cleanup?.();
    return result;
  }

  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step:
      | Step<string, any, any, TResumeSchema, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, any, TResumeSchema, any>]
      | string
      | string[];
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    const steps: string[] = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
      typeof step === 'string' ? step : step?.id,
    );
    const snapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData: params.resumeData,
        runId: this.runId,
        stepResults: snapshot?.context as any,
        resume: {
          steps,
          stepResults: snapshot?.context as any,
          resumePayload: params.resumeData,
          // @ts-ignore
          resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
        },
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    if (result.status === 'failed') {
      result.error = new Error(result.error);
    }
    return result;
  }

  watch(cb: (event: any) => void): () => void {
    const streamPromise = subscribe(
      {
        channel: `workflow:${this.workflowId}:${this.runId}`,
        topics: ['watch'],
        app: this.inngest,
      },
      (message: any) => {
        cb(message.data);
      },
    );

    return () => {
      streamPromise
        .then((stream: any) => {
          stream.cancel();
        })
        .catch(err => {
          console.error(err);
        });
    };
  }
}

export class InngestWorkflow<
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TSteps, TWorkflowId, TInput, TOutput, InngestEngineType, TPrevSchema> {
  #mastra: Mastra;
  public inngest: Inngest;

  private function: ReturnType<Inngest['createFunction']> | undefined;

  constructor(params: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>, inngest: Inngest) {
    super(params);
    this.#mastra = params.mastra!;
    this.inngest = inngest;
  }

  async getWorkflowRuns(args?: {
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra engine is not initialized');
      return { runs: [], total: 0 };
    }

    return storage.getWorkflowRuns({ workflowName: this.id, ...(args ?? {}) }) as unknown as WorkflowRuns;
  }

  async getWorkflowRunById(runId: string): Promise<WorkflowRun | null> {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra engine is not initialized');
      return null;
    }
    const run = (await storage.getWorkflowRunById({ runId, workflowName: this.id })) as unknown as WorkflowRun;

    return (
      run ??
      (this.runs.get(runId) ? ({ ...this.runs.get(runId), workflowName: this.id } as unknown as WorkflowRun) : null)
    );
  }

  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    this.executionEngine.__registerMastra(mastra);
    const updateNested = (step: StepFlowEntry) => {
      if (
        (step.type === 'step' || step.type === 'loop' || step.type === 'foreach') &&
        step.step instanceof InngestWorkflow
      ) {
        step.step.__registerMastra(mastra);
      } else if (step.type === 'parallel' || step.type === 'conditional') {
        for (const subStep of step.steps) {
          updateNested(subStep);
        }
      }
    };

    if (this.executionGraph.steps.length) {
      for (const step of this.executionGraph.steps) {
        updateNested(step);
      }
    }
  }

  createRun(options?: { runId?: string }): Run<TSteps, TInput, TOutput> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run: Run<TSteps, TInput, TOutput> =
      this.runs.get(runIdToUse) ??
      new InngestRun(
        {
          workflowId: this.id,
          runId: runIdToUse,
          executionEngine: this.executionEngine,
          executionGraph: this.executionGraph,
          serializedStepGraph: this.serializedStepGraph,
          mastra: this.#mastra,
          retryConfig: this.retryConfig,
          cleanup: () => this.runs.delete(runIdToUse),
        },
        this.inngest,
      );

    this.runs.set(runIdToUse, run);
    return run;
  }

  getFunction() {
    if (this.function) {
      return this.function;
    }
    this.function = this.inngest.createFunction(
      // @ts-ignore
      { id: `workflow.${this.id}`, retries: this.retryConfig?.attempts ?? 0 },
      { event: `workflow.${this.id}` },
      async ({ event, step, attempt, publish }) => {
        let { inputData, runId, resume } = event.data;

        if (!runId) {
          runId = await step.run(`workflow.${this.id}.runIdGen`, async () => {
            return randomUUID();
          });
        }

        const emitter = {
          emit: async (event: string, data: any) => {
            if (!publish) {
              return;
            }

            try {
              await publish({
                channel: `workflow:${this.id}:${runId}`,
                topic: 'watch',
                data,
              });
            } catch (err: any) {
              this.logger.error('Error emitting event: ' + (err?.stack ?? err?.message ?? err));
            }
          },
        };

        const engine = new InngestExecutionEngine(this.#mastra, step, attempt);
        const result = await engine.execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
          workflowId: this.id,
          runId,
          graph: this.executionGraph,
          serializedStepGraph: this.serializedStepGraph,
          input: inputData,
          emitter,
          retryConfig: this.retryConfig,
          runtimeContext: new RuntimeContext(), // TODO
          resume,
        });

        return { result, runId };
      },
    );
    return this.function;
  }

  getNestedFunctions(steps: StepFlowEntry[]): ReturnType<Inngest['createFunction']>[] {
    return steps.flatMap(step => {
      if (step.type === 'step' || step.type === 'loop' || step.type === 'foreach') {
        if (step.step instanceof InngestWorkflow) {
          return [step.step.getFunction(), ...step.step.getNestedFunctions(step.step.executionGraph.steps)];
        }
        return [];
      } else if (step.type === 'parallel' || step.type === 'conditional') {
        return this.getNestedFunctions(step.steps);
      }

      return [];
    });
  }

  getFunctions() {
    return [this.getFunction(), ...this.getNestedFunctions(this.executionGraph.steps)];
  }
}

function cloneWorkflow<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any>[] = Step<string, any, any, any, any>[],
>(
  workflow: InngestWorkflow<TSteps, string, TInput, TOutput>,
  opts: { id: TWorkflowId },
): InngestWorkflow<TSteps, TWorkflowId, TInput, TOutput> {
  const wf = new InngestWorkflow(
    {
      id: opts.id,
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      steps: workflow.stepDefs,
      mastra: workflow.mastra,
    },
    workflow.inngest,
  );

  wf.setStepFlow(workflow.stepGraph);
  wf.commit();
  return wf;
}

export function init(inngest: Inngest) {
  return {
    createWorkflow<
      TWorkflowId extends string = string,
      TInput extends z.ZodType<any> = z.ZodType<any>,
      TOutput extends z.ZodType<any> = z.ZodType<any>,
      TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
    >(params: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
      return new InngestWorkflow(params, inngest);
    },
    createStep<
      TStepId extends string,
      TStepInput extends z.ZodType<any>,
      TStepOutput extends z.ZodType<any>,
      TResumeSchema extends z.ZodType<any>,
      TSuspendSchema extends z.ZodType<any>,
    >(params: {
      id: TStepId;
      inputSchema: TStepInput;
      outputSchema: TStepOutput;
      resumeSchema?: TResumeSchema;
      suspendSchema?: TSuspendSchema;
      execute: ExecuteFunction<
        z.infer<TStepInput>,
        z.infer<TStepOutput>,
        z.infer<TResumeSchema>,
        z.infer<TSuspendSchema>,
        InngestEngineType
      >;
    }) {
      return createStep<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, InngestEngineType>(params);
    },
    cloneStep,
    cloneWorkflow,
  };
}

export class InngestExecutionEngine extends DefaultExecutionEngine {
  private inngestStep: BaseContext<Inngest>['step'];
  private inngestAttempts: number;

  constructor(mastra: Mastra, inngestStep: BaseContext<Inngest>['step'], inngestAttempts: number = 0) {
    super({ mastra });
    this.inngestStep = inngestStep;
    this.inngestAttempts = inngestAttempts;
  }

  protected async fmtReturnValue<TOutput>(
    executionSpan: Span | undefined,
    emitter: { emit: (event: string, data: any) => Promise<void> },
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
      base.error =
        error instanceof Error
          ? (error?.stack ?? error.message)
          : lastOutput?.error instanceof Error
            ? lastOutput.error.message
            : (lastOutput.error ?? error ?? 'Unknown error');

      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: lastOutput.status,
            steps: stepResults,
            result: null,
            error: base.error,
          },
        },
        eventTimestamp: Date.now(),
      });
    } else if (lastOutput.status === 'suspended') {
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

      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.payload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      });
      base.suspended = suspendedStepIds;
    }

    executionSpan?.end();
    return base as TOutput;
  }

  async superExecuteStep({
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
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    return super.executeStep({
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
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    runtimeContext,
  }: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    executionContext: {
      workflowId: string;
      runId: string;
      executionPath: number[];
      suspendedPaths: Record<string, number[]>;
      retryConfig: { attempts: number; delay: number };
    };
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
    };
    prevOutput: any;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    await this.inngestStep.run(
      `workflow.${executionContext.workflowId}.run.${executionContext.runId}.step.${step.id}.running_ev`,
      async () => {
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
      },
    );

    if (step instanceof InngestWorkflow) {
      const isResume = !!resume?.steps?.length;
      let result: WorkflowResult<any, any>;
      let runId: string;
      if (isResume) {
        // @ts-ignore
        runId = stepResults[resume?.steps?.[0]]?.payload?.__workflow_meta?.runId ?? randomUUID();

        const snapshot: any = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
          workflowName: step.id,
          runId: runId,
        });

        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData: prevOutput,
            runId: runId,
            resume: {
              runId: runId,
              steps: resume.steps.slice(1),
              stepResults: snapshot?.context as any,
              resumePayload: resume.resumePayload,
              // @ts-ignore
              resumePath: snapshot?.suspendedPaths?.[resume.steps?.[1]] as any,
            },
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
      } else {
        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData: prevOutput,
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
      }

      const res = await this.inngestStep.run(
        `workflow.${executionContext.workflowId}.step.${step.id}.nestedwf-results`,
        async () => {
          if (result.status === 'failed') {
            await emitter.emit('watch', {
              type: 'watch',
              payload: {
                currentStep: {
                  id: step.id,
                  status: 'failed',
                  error: result?.error,
                },
                workflowState: {
                  status: 'running',
                  steps: stepResults,
                  result: null,
                  error: null,
                },
              },
              eventTimestamp: Date.now(),
            });

            return { executionContext, result: { status: 'failed', error: result?.error } };
          } else if (result.status === 'suspended') {
            const suspendedSteps = Object.entries(result.steps).filter(([_stepName, stepResult]) => {
              const stepRes: StepResult<any, any, any, any> = stepResult as StepResult<any, any, any, any>;
              return stepRes?.status === 'suspended';
            });

            for (const [stepName, stepResult] of suspendedSteps) {
              // @ts-ignore
              const suspendPath: string[] = [stepName, ...(stepResult?.payload?.__workflow_meta?.path ?? [])];
              executionContext.suspendedPaths[step.id] = executionContext.executionPath;

              await emitter.emit('watch', {
                type: 'watch',
                payload: {
                  currentStep: {
                    id: step.id,
                    status: 'suspended',
                    payload: { ...(stepResult as any)?.payload, __workflow_meta: { runId: runId, path: suspendPath } },
                  },
                  workflowState: {
                    status: 'running',
                    steps: stepResults,
                    result: null,
                    error: null,
                  },
                },
                eventTimestamp: Date.now(),
              });

              return {
                executionContext,
                result: {
                  status: 'suspended',
                  payload: { ...(stepResult as any)?.payload, __workflow_meta: { runId: runId, path: suspendPath } },
                },
              };
            }

            await emitter.emit('watch', {
              type: 'watch',
              payload: {
                currentStep: {
                  id: step.id,
                  status: 'suspended',
                  payload: {},
                },
                workflowState: {
                  status: 'running',
                  steps: stepResults,
                  result: null,
                  error: null,
                },
              },
              eventTimestamp: Date.now(),
            });

            return {
              executionContext,
              result: {
                status: 'suspended',
                payload: {},
              },
            };
          }

          // is success

          await emitter.emit('watch', {
            type: 'watch',
            payload: {
              currentStep: {
                id: step.id,
                status: 'success',
                output: result?.result,
              },
              workflowState: {
                status: 'running',
                steps: stepResults,
                result: null,
                error: null,
              },
            },
            eventTimestamp: Date.now(),
          });

          return { executionContext, result: { status: 'success', output: result?.result } };
        },
      );

      Object.assign(executionContext, res.executionContext);
      return res.result as StepResult<any, any, any, any>;
    }

    const stepRes = await this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}`, async () => {
      let execResults: any;
      let suspended: { payload: any } | undefined;
      try {
        const result = await step.execute({
          runId: executionContext.runId,
          mastra: this.mastra!,
          runtimeContext,
          inputData: prevOutput,
          resumeData: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
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
          [EMITTER_SYMBOL]: emitter,
          engine: {
            step: this.inngestStep,
          },
        });

        execResults = { status: 'success', output: result };
      } catch (e) {
        execResults = { status: 'failed', error: e instanceof Error ? e.message : String(e) };
      }

      if (suspended) {
        execResults = { status: 'suspended', payload: suspended.payload };
      }

      if (execResults.status === 'failed') {
        if (executionContext.retryConfig.attempts > 0 && this.inngestAttempts < executionContext.retryConfig.attempts) {
          throw execResults.error;
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
            steps: stepResults,
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });

      return { result: execResults, executionContext, stepResults };
    });

    // @ts-ignore
    Object.assign(executionContext.suspendedPaths, stepRes.executionContext.suspendedPaths);
    // @ts-ignore
    Object.assign(stepResults, stepRes.stepResults);

    // @ts-ignore
    return stepRes.result;
  }

  async persistStepUpdate({
    workflowId,
    runId,
    stepResults,
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
    executionContext: ExecutionContext;
    workflowStatus: 'success' | 'failed' | 'suspended' | 'running';
    result?: Record<string, any>;
    error?: string | Error;
  }) {
    await this.inngestStep.run(
      `workflow.${workflowId}.run.${runId}.path.${JSON.stringify(executionContext.executionPath)}.stepUpdate`,
      async () => {
        await this.mastra?.getStorage()?.persistWorkflowSnapshot({
          workflowName: workflowId,
          runId,
          snapshot: {
            runId,
            value: {},
            context: stepResults as any,
            activePaths: [],
            suspendedPaths: executionContext.suspendedPaths,
            serializedStepGraph,
            status: workflowStatus,
            result,
            error,
            // @ts-ignore
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
    prevStep,
    stepResults,
    serializedStepGraph,
    resume,
    executionContext,
    emitter,
    runtimeContext,
  }: {
    workflowId: string;
    runId: string;
    entry: {
      type: 'conditional';
      steps: StepFlowEntry[];
      conditions: ExecuteFunction<any, any, any, any, InngestEngineType>[];
    };
    prevStep: StepFlowEntry;
    serializedStepGraph: SerializedStepFlowEntry[];
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: { emit: (event: string, data: any) => Promise<void> };
    runtimeContext: RuntimeContext;
  }): Promise<StepResult<any, any, any, any>> {
    let execResults: any;
    const truthyIndexes = (
      await Promise.all(
        entry.conditions.map((cond, index) =>
          this.inngestStep.run(`workflow.${workflowId}.conditional.${index}`, async () => {
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
                engine: {
                  step: this.inngestStep,
                },
              });
              return result ? index : null;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e: unknown) {
              return null;
            }
          }),
        ),
      )
    ).filter((index: any): index is number => index !== null);

    const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));
    const results: { result: StepResult<any, any, any, any> }[] = await Promise.all(
      stepsToRun.map((step, index) =>
        this.executeEntry({
          workflowId,
          runId,
          entry: step,
          prevStep,
          stepResults,
          resume,
          serializedStepGraph,
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
      execResults = { status: 'suspended', payload: hasSuspended.result.payload };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.result.status === 'success') {
            // @ts-ignore
            acc[stepsToRun[index]!.step.id] = result.output;
          }

          return acc;
        }, {}),
      };
    }

    return execResults;
  }
}

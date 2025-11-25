import { randomUUID } from 'crypto';
import type z from 'zod';
import { RequestContext } from '../../di';
import type { Event } from '../../events';
import type { Mastra } from '../../mastra';
import { Workflow, Run } from '../../workflows';
import type { ExecutionEngine, ExecutionGraph } from '../../workflows/execution-engine';
import type { Step } from '../../workflows/step';
import type {
  SerializedStepFlowEntry,
  WorkflowConfig,
  WorkflowResult,
  StepWithComponent,
  WorkflowStreamEvent,
  WorkflowEngineType,
} from '../../workflows/types';

export type EventedEngineType = {};

export class EventedWorkflow<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  constructor(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
    super(params);
    this.engineType = 'evented';
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.executionEngine.__registerMastra(mastra);
  }

  async createRun(options?: { runId?: string }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run: Run<TEngineType, TSteps, TState, TInput, TOutput> =
      this.runs.get(runIdToUse) ??
      new EventedRun({
        workflowId: this.id,
        runId: runIdToUse,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        mastra: this.mastra,
        retryConfig: this.retryConfig,
        cleanup: () => this.runs.delete(runIdToUse),
        workflowSteps: this.steps,
        validateInputs: this.options?.validateInputs,
        workflowEngineType: this.engineType,
      });

    this.runs.set(runIdToUse, run);

    const shouldPersistSnapshot = this.options?.shouldPersistSnapshot?.({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    const workflowSnapshotInStorage = await this.getWorkflowRunExecutionResult(runIdToUse, false);

    if (!workflowSnapshotInStorage && shouldPersistSnapshot) {
      await this.mastra?.getStorage()?.persistWorkflowSnapshot({
        workflowName: this.id,
        runId: runIdToUse,
        snapshot: {
          runId: runIdToUse,
          status: 'pending',
          value: {},
          context: {},
          activePaths: [],
          serializedStepGraph: this.serializedStepGraph,
          activeStepsPath: {},
          suspendedPaths: {},
          resumeLabels: {},
          waitingPaths: {},
          result: undefined,
          error: undefined,
          // @ts-ignore
          timestamp: Date.now(),
        },
      });
    }

    return run;
  }
}

export class EventedRun<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
> extends Run<TEngineType, TSteps, TState, TInput, TOutput> {
  constructor(params: {
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
    workflowSteps: Record<string, StepWithComponent>;
    validateInputs?: boolean;
    workflowEngineType: WorkflowEngineType;
  }) {
    super(params);
    this.serializedStepGraph = params.serializedStepGraph;
  }

  async start({
    inputData,
    initialState,
    requestContext,
  }: {
    inputData?: z.infer<TInput>;
    requestContext?: RequestContext;
    initialState?: z.infer<TState>;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    // Add validation checks
    if (this.serializedStepGraph.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }

    requestContext = requestContext ?? new RequestContext();

    await this.mastra?.getStorage()?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        status: 'running',
        value: {},
        context: {} as any,
        requestContext: Object.fromEntries(requestContext.entries()),
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    const inputDataToUse = await this._validateInput(inputData);
    const initialStateToUse = await this._validateInitialState(initialState ?? {});

    const result = await this.executionEngine.execute<
      z.infer<TState>,
      z.infer<TInput>,
      WorkflowResult<TState, TInput, TOutput, TSteps>
    >({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      input: inputDataToUse,
      initialState: initialStateToUse,
      emitter: {
        emit: async (event: string, data: any) => {
          this.emitter.emit(event, data);
        },
        on: (event: string, callback: (data: any) => void) => {
          this.emitter.on(event, callback);
        },
        off: (event: string, callback: (data: any) => void) => {
          this.emitter.off(event, callback);
        },
        once: (event: string, callback: (data: any) => void) => {
          this.emitter.once(event, callback);
        },
      },
      retryConfig: this.retryConfig,
      requestContext,
      abortController: this.abortController,
    });

    // console.dir({ startResult: result }, { depth: null });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    return result;
  }

  // TODO: stream

  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step:
      | Step<string, any, any, TResumeSchema, any, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, any, TResumeSchema, any, any, TEngineType>,
        ]
      | string
      | string[];
    requestContext?: RequestContext;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    let steps: string[] = [];
    if (typeof params.step === 'string') {
      steps = params.step.split('.');
    } else {
      steps = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
        typeof step === 'string' ? step : step?.id,
      );
    }

    if (steps.length === 0) {
      throw new Error('No steps provided to resume');
    }

    const snapshot = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    const resumePath = snapshot?.suspendedPaths?.[steps[0]!] as any;
    if (!resumePath) {
      throw new Error(
        `No resume path found for step ${JSON.stringify(steps)}, currently suspended paths are ${JSON.stringify(snapshot?.suspendedPaths)}`,
      );
    }

    console.dir(
      { resume: { requestContextObj: snapshot?.requestContext, requestContext: params.requestContext } },
      { depth: null },
    );
    // Start with the snapshot's request context (old values)
    const requestContextObj = snapshot?.requestContext ?? {};
    const requestContext = new RequestContext();

    // First, set values from the snapshot
    for (const [key, value] of Object.entries(requestContextObj)) {
      requestContext.set(key, value);
    }

    // Then, override with any values from the passed request context (new values take precedence)
    if (params.requestContext) {
      for (const [key, value] of params.requestContext.entries()) {
        requestContext.set(key, value);
      }
    }

    const suspendedStep = this.workflowSteps[steps?.[0] ?? ''];

    const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);

    const executionResultPromise = this.executionEngine
      .execute<z.infer<TState>, z.infer<TInput>, WorkflowResult<TState, TInput, TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: resumeDataToUse,
        resume: {
          steps,
          stepResults: snapshot?.context as any,
          resumePayload: resumeDataToUse,
          resumePath,
        },
        emitter: {
          emit: (event: string, data: any) => {
            this.emitter.emit(event, data);
            return Promise.resolve();
          },
          on: (event: string, callback: (data: any) => void) => {
            this.emitter.on(event, callback);
          },
          off: (event: string, callback: (data: any) => void) => {
            this.emitter.off(event, callback);
          },
          once: (event: string, callback: (data: any) => void) => {
            this.emitter.once(event, callback);
          },
        },
        requestContext,
        abortController: this.abortController,
      })
      .then(result => {
        if (result.status !== 'suspended') {
          this.closeStreamAction?.().catch(() => {});
        }

        return result;
      });

    this.executionResults = executionResultPromise;

    return executionResultPromise;
  }

  watch(cb: (event: WorkflowStreamEvent) => void): () => void {
    const watchCb = async (event: Event, ack?: () => Promise<void>) => {
      if (event.runId !== this.runId) {
        return;
      }

      cb(event.data);
      await ack?.();
    };

    this.mastra?.pubsub.subscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});

    return () => {
      this.mastra?.pubsub.unsubscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
    };
  }

  async watchAsync(cb: (event: WorkflowStreamEvent) => void): Promise<() => void> {
    const watchCb = async (event: Event, ack?: () => Promise<void>) => {
      if (event.runId !== this.runId) {
        return;
      }

      cb(event.data);
      await ack?.();
    };

    await this.mastra?.pubsub.subscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});

    return async () => {
      await this.mastra?.pubsub.unsubscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
    };
  }

  async cancel() {
    await this.mastra?.pubsub.publish('workflows', {
      type: 'workflow.cancel',
      runId: this.runId,
      data: {
        workflowId: this.workflowId,
        runId: this.runId,
      },
    });
  }
}

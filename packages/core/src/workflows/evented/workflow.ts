import { randomUUID } from 'node:crypto';
import { z } from 'zod/v3';
import { Agent } from '../../agent';
import { RequestContext } from '../../di';
import type { MastraScorers } from '../../evals';
import type { Event } from '../../events';
import type { Mastra } from '../../mastra';
import { Tool } from '../../tools';
import type { ToolExecutionContext } from '../../tools/types';
import type { DynamicArgument } from '../../types';
import { Workflow, Run } from '../../workflows';
import type { AgentStepOptions } from '../../workflows';
import type { ExecutionEngine, ExecutionGraph } from '../../workflows/execution-engine';
import type { Step } from '../../workflows/step';
import type {
  SerializedStepFlowEntry,
  WorkflowConfig,
  WorkflowResult,
  StepWithComponent,
  WorkflowStreamEvent,
  WorkflowEngineType,
  StepParams,
  ToolStep,
  DefaultEngineType,
} from '../../workflows/types';
import { PUBSUB_SYMBOL } from '../constants';
import { EventedExecutionEngine } from './execution-engine';
import { WorkflowEventProcessor } from './workflow-event-processor';

export type EventedEngineType = {};

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, EventedEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    EventedEngineType
  >[],
  TPrevSchema = TInput,
>(
  workflow: Workflow<EventedEngineType, TSteps, string, TState, TInput, TOutput, TPrevSchema>,
  opts: { id: TWorkflowId },
): Workflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  const wf: Workflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> = new Workflow({
    id: opts.id,
    inputSchema: workflow.inputSchema,
    outputSchema: workflow.outputSchema,
    steps: workflow.stepDefs,
    mastra: workflow.mastra,
    options: workflow.options,
  });

  wf.setStepFlow(workflow.stepGraph);
  wf.commit();
  return wf;
}

export function cloneStep<TStepId extends string>(
  step: Step<string, any, any, any, any, any, EventedEngineType>,
  opts: { id: TStepId },
): Step<TStepId, any, any, any, any, any, EventedEngineType> {
  return {
    id: opts.id,
    description: step.description,
    inputSchema: step.inputSchema,
    outputSchema: step.outputSchema,
    suspendSchema: step.suspendSchema,
    resumeSchema: step.resumeSchema,
    stateSchema: step.stateSchema,
    execute: step.execute,
    retries: step.retries,
    scorers: step.scorers,
    component: step.component,
  };
}

/**
 * Creates a new workflow step
 * @param params Configuration parameters for the step
 * @param params.id Unique identifier for the step
 * @param params.description Optional description of what the step does
 * @param params.inputSchema Zod schema defining the input structure
 * @param params.outputSchema Zod schema defining the output structure
 * @param params.execute Function that performs the step's operations
 * @returns A Step object that can be added to the workflow
 */
export function createStep<TStepId extends string, TState, TStepInput, TStepOutput, TResume, TSuspend>(
  params: StepParams<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend>,
): Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType>;

// Overload for agent WITH structured output schema
export function createStep<TStepId extends string, TStepOutput>(
  agent: Agent<TStepId, any>,
  agentOptions: AgentStepOptions<TStepOutput> & {
    structuredOutput: { schema: TStepOutput };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, unknown, { prompt: string }, TStepOutput, unknown, unknown, DefaultEngineType>;

// Overload for agent WITHOUT structured output (default { text: string })
export function createStep<
  TStepId extends string,
  TStepInput extends { prompt: string },
  TStepOutput extends { text: string },
  TResume,
  TSuspend,
>(
  agent: Agent<TStepId, any>,
  agentOptions?: AgentStepOptions<TStepOutput> & {
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, any, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType>;

export function createStep<
  TSchemaIn,
  TSuspend,
  TResume,
  TSchemaOut,
  TContext extends ToolExecutionContext<TSuspend, TResume>,
>(
  tool: ToolStep<TSchemaIn, TSuspend, TResume, TSchemaOut, TContext>,
  toolOptions?: { retries?: number; scorers?: DynamicArgument<MastraScorers> },
): Step<string, any, TSchemaIn, TSchemaOut, TSuspend, TResume, DefaultEngineType>;

// // Processor overload - wraps a Processor as a workflow step
// export function createStep<TProcessorId extends string>(
//   processor: Processor<TProcessorId>,
// ): Step<
//   `processor:${TProcessorId}`,
//   any,
//   InferSchemaOutput<typeof ProcessorStepSchema>,
//   InferSchemaOutput<typeof ProcessorStepOutputSchema>,
//   any,
//   any,
//   DefaultEngineType
// >;
export function createStep<TStepId extends string, TState, TStepInput, TStepOutput, TResume, TSuspend>(
  params:
    | StepParams<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend>
    | Agent<any, any>
    | ToolStep<TStepInput, TSuspend, TResume, TStepOutput, any>,
  agentOrToolOptions?:
    | (AgentStepOptions<TStepOutput> & {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
      })
    | {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
      },
): Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType> {
  if (params instanceof Agent) {
    const options = (agentOrToolOptions ?? {}) as
      | (AgentStepOptions<TStepOutput> & { retries?: number; scorers?: DynamicArgument<MastraScorers> })
      | undefined;
    // Determine output schema based on structuredOutput option
    const outputSchema = options?.structuredOutput?.schema ?? z.object({ text: z.string() });
    const { retries, scorers, ...agentOptions } = options ?? {};

    return {
      id: params.id,
      description: params.getDescription(),
      // @ts-ignore
      inputSchema: z.object({
        prompt: z.string(),
        // resourceId: z.string().optional(),
        // threadId: z.string().optional(),
      }),
      // @ts-ignore
      outputSchema,
      retries,
      scorers,
      execute: async ({
        inputData,
        runId,
        [PUBSUB_SYMBOL]: pubsub,
        requestContext,
        tracingContext,
        abortSignal,
        abort,
      }) => {
        // TODO: support stream
        let streamPromise = {} as {
          promise: Promise<string>;
          resolve: (value: string) => void;
          reject: (reason?: any) => void;
        };

        streamPromise.promise = new Promise((resolve, reject) => {
          streamPromise.resolve = resolve;
          streamPromise.reject = reject;
        });
        // TODO: should use regular .stream()
        const { fullStream } = await params.streamLegacy((inputData as { prompt: string }).prompt, {
          ...(agentOptions ?? {}),
          // resourceId: inputData.resourceId,
          // threadId: inputData.threadId,
          tracingContext,
          requestContext,
          onFinish: result => {
            streamPromise.resolve(result.text);
          },
          abortSignal,
        });

        if (abortSignal.aborted) {
          return abort() as TStepOutput;
        }

        const toolData = {
          name: params.name,
          args: inputData,
        };

        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'tool-call-streaming-start', ...(toolData ?? {}) },
        });
        for await (const chunk of fullStream) {
          if (chunk.type === 'text-delta') {
            await pubsub.publish(`workflow.events.v2.${runId}`, {
              type: 'watch',
              runId,
              data: { type: 'tool-call-delta', ...(toolData ?? {}), argsTextDelta: chunk.textDelta },
            });
          }
        }
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'tool-call-streaming-finish', ...(toolData ?? {}) },
        });

        return {
          text: await streamPromise.promise,
        } as TStepOutput;
      },
      component: params.component,
    };
  }

  if (params instanceof Tool) {
    if (!params.inputSchema || !params.outputSchema) {
      throw new Error('Tool must have input and output schemas defined');
    }

    return {
      id: params.id as TStepId,
      description: params.description,
      inputSchema: params.inputSchema,
      outputSchema: params.outputSchema,
      suspendSchema: params.suspendSchema,
      resumeSchema: params.resumeSchema,
      retries: agentOrToolOptions?.retries,
      scorers: agentOrToolOptions?.scorers,
      execute: async ({
        inputData,
        mastra,
        requestContext,
        suspend,
        resumeData,
        runId,
        workflowId,
        state,
        setState,
      }) => {
        // Tools receive (input, context) - just call the tool's execute
        if (!params.execute) {
          throw new Error(`Tool ${params.id} does not have an execute function`);
        }

        // Build context matching ToolExecutionContext structure
        const context = {
          mastra,
          requestContext,
          tracingContext: { currentSpan: undefined }, // TODO: Pass proper tracing context when evented workflows support tracing
          workflow: {
            runId,
            workflowId,
            state,
            setState,
            suspend,
            resumeData,
          },
        };

        // Tool.execute already handles the v1.0 signature properly
        return params.execute(inputData, context) as TStepOutput;
      },
      component: 'TOOL',
    };
  }

  return {
    id: params.id as TStepId,
    description: params.description,
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    resumeSchema: params.resumeSchema,
    suspendSchema: params.suspendSchema,
    execute: params.execute,
    retries: params?.retries,
    scorers: params.scorers,
  };
}

export function createWorkflow<
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TSteps extends Step<string, any, any, any, any, any, EventedEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    EventedEngineType
  >[],
>(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
  const eventProcessor = new WorkflowEventProcessor({ mastra: params.mastra! });
  const executionEngine = new EventedExecutionEngine({
    mastra: params.mastra!,
    eventProcessor,
    options: {
      validateInputs: params.options?.validateInputs ?? true,
      shouldPersistSnapshot: params.options?.shouldPersistSnapshot ?? (() => true),
      tracingPolicy: params.options?.tracingPolicy,
      onFinish: params.options?.onFinish,
      onError: params.options?.onError,
    },
  });
  return new EventedWorkflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput>({
    ...params,
    executionEngine,
  });
}

export class EventedWorkflow<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TPrevSchema = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  constructor(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
    super(params);
    this.engineType = 'evented';
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.executionEngine.__registerMastra(mastra);
  }

  async createRun(options?: {
    runId?: string;
    resourceId?: string;
    disableScorers?: boolean;
  }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run: Run<TEngineType, TSteps, TState, TInput, TOutput> =
      this.runs.get(runIdToUse) ??
      new EventedRun({
        workflowId: this.id,
        runId: runIdToUse,
        resourceId: options?.resourceId,
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

    const existingRun = await this.getWorkflowRunById(runIdToUse, {
      withNestedWorkflows: false,
    });

    // Check if run exists in persistent storage (not just in-memory)
    const existsInStorage = existingRun && !existingRun.isFromInMemory;

    if (!existsInStorage && shouldPersistSnapshot) {
      const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: this.id,
        runId: runIdToUse,
        resourceId: options?.resourceId,
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
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
> extends Run<TEngineType, TSteps, TState, TInput, TOutput> {
  constructor(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
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

  /**
   * Set up abort signal handler to publish workflow.cancel event when abortController.abort() is called.
   * This ensures consistent cancellation behavior whether abort() is called directly or via cancel().
   */
  private setupAbortHandler(): void {
    const abortHandler = () => {
      this.mastra?.pubsub
        .publish('workflows', {
          type: 'workflow.cancel',
          runId: this.runId,
          data: {
            workflowId: this.workflowId,
            runId: this.runId,
          },
        })
        .catch(err => {
          this.mastra?.getLogger()?.error(`Failed to publish workflow.cancel for runId ${this.runId}:`, err);
        });
    };
    this.abortController.signal.addEventListener('abort', abortHandler, { once: true });
  }

  async start({
    inputData,
    initialState,
    requestContext,
    perStep,
  }: {
    inputData?: TInput;
    requestContext?: RequestContext;
    initialState?: TState;
    perStep?: boolean;
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

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
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

    const inputDataToUse = await this._validateInput(inputData ?? ({} as TInput));
    const initialStateToUse = await this._validateInitialState(initialState ?? ({} as TState));

    if (!this.mastra?.pubsub) {
      throw new Error('Mastra instance with pubsub is required for workflow execution');
    }

    this.setupAbortHandler();

    const result = await this.executionEngine.execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      input: inputDataToUse,
      initialState: initialStateToUse,
      pubsub: this.mastra.pubsub,
      retryConfig: this.retryConfig,
      requestContext,
      abortController: this.abortController,
      perStep,
    });

    // console.dir({ startResult: result }, { depth: null });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    return result;
  }

  /**
   * Starts the workflow execution without waiting for completion (fire-and-forget).
   * Returns immediately with the runId. The workflow executes in the background via pubsub.
   * Use this when you don't need to wait for the result or want to avoid polling failures.
   */
  async startAsync({
    inputData,
    initialState,
    requestContext,
    perStep,
  }: {
    inputData?: TInput;
    requestContext?: RequestContext;
    initialState?: TState;
    perStep?: boolean;
  }): Promise<{ runId: string }> {
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

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
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

    const inputDataToUse = await this._validateInput(inputData ?? ({} as TInput));
    const initialStateToUse = await this._validateInitialState(initialState ?? ({} as TState));

    if (!this.mastra?.pubsub) {
      throw new Error('Mastra instance with pubsub is required for workflow execution');
    }

    // Fire-and-forget: publish the workflow start event without subscribing for completion
    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.start',
      runId: this.runId,
      data: {
        workflowId: this.workflowId,
        runId: this.runId,
        prevResult: { status: 'success', output: inputDataToUse },
        requestContext: Object.fromEntries(requestContext.entries()),
        initialState: initialStateToUse,
        perStep,
      },
    });

    // Return immediately without waiting for completion
    return { runId: this.runId };
  }

  // TODO: stream

  async resume<TResumeSchema>(params: {
    resumeData?: TResumeSchema;
    step:
      | Step<string, any, any, TResumeSchema, any, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, any, TResumeSchema, any, any, TEngineType>,
        ]
      | string
      | string[];
    requestContext?: RequestContext;
    perStep?: boolean;
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

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) {
      throw new Error('Cannot resume workflow: workflows store is required');
    }
    const snapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });
    if (!snapshot) {
      throw new Error(`Cannot resume workflow: no snapshot found for runId ${this.runId}`);
    }

    const resumePath = snapshot.suspendedPaths?.[steps[0]!] as any;
    if (!resumePath) {
      throw new Error(
        `No resume path found for step ${JSON.stringify(steps)}, currently suspended paths are ${JSON.stringify(snapshot.suspendedPaths)}`,
      );
    }

    console.dir(
      { resume: { requestContextObj: snapshot.requestContext, requestContext: params.requestContext } },
      { depth: null },
    );
    // Start with the snapshot's request context (old values)
    const requestContextObj = snapshot.requestContext ?? {};
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

    if (!this.mastra?.pubsub) {
      throw new Error('Mastra instance with pubsub is required for workflow execution');
    }

    this.setupAbortHandler();

    const executionResultPromise = this.executionEngine
      .execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: snapshot?.context?.input as TInput,
        resume: {
          steps,
          stepResults: snapshot?.context as any,
          resumePayload: resumeDataToUse,
          resumePath,
        },
        pubsub: this.mastra.pubsub,
        requestContext,
        abortController: this.abortController,
        perStep: params.perStep,
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
    // Update storage directly for immediate status update (same pattern as Inngest)
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.updateWorkflowState({
      workflowName: this.workflowId,
      runId: this.runId,
      opts: {
        status: 'canceled',
      },
    });

    // Trigger abort signal - the abort handler will publish the workflow.cancel event
    // This ensures consistent behavior whether cancel() or abort() is called
    this.abortController.abort();
  }
}

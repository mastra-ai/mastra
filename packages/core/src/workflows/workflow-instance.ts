import type { Span } from '@opentelemetry/api';
import { context as otlpContext, trace } from '@opentelemetry/api';
import type { Snapshot } from 'xstate';
import type { z } from 'zod';

import type { Logger } from '../logger';

import type { Mastra } from '../mastra';
import { Machine } from './machine';
import type { Step } from './step';
import type {
  ActionContext,
  RetryConfig,
  StepAction,
  StepDef,
  StepGraph,
  WorkflowContext,
  WorkflowRunResult,
  WorkflowRunState,
} from './types';
import {
  getActivePathsAndStatus,
  getResultActivePaths,
  mergeChildValue,
  resolveVariables,
  updateStepInHierarchy,
} from './utils';

export interface WorkflowResultReturn<
  TResult extends z.ZodObject<any>,
  T extends z.ZodObject<any>,
  TSteps extends Step<any, any, any>[],
> {
  runId: string;
  start: (props?: { triggerData?: z.infer<T> } | undefined) => Promise<WorkflowRunResult<T, TSteps, TResult>>;
  watch: (
    onTransition: (state: Pick<WorkflowRunResult<T, TSteps, TResult>, 'results' | 'activePaths' | 'runId'>) => void,
  ) => () => void;
  resume: (props: {
    stepId: string;
    context?: Record<string, any>;
  }) => Promise<Omit<WorkflowRunResult<T, TSteps, TResult>, 'runId'> | undefined>;
  resumeWithEvent: (
    eventName: string,
    data: any,
  ) => Promise<Omit<WorkflowRunResult<T, TSteps, TResult>, 'runId'> | undefined>;
}

export class WorkflowInstance<
  TSteps extends Step<any, any, any>[] = any,
  TTriggerSchema extends z.ZodObject<any> = any,
  TResult extends z.ZodObject<any> = any,
> implements WorkflowResultReturn<TResult, TTriggerSchema, TSteps>
{
  name: string;
  #mastra?: Mastra;
  #machines: Record<string, Machine<TSteps, TTriggerSchema>> = {};

  logger: Logger;

  #steps: Record<string, StepAction<any, any, any, any>> = {};
  #stepGraph: StepGraph;
  #stepSubscriberGraph: Record<string, StepGraph> = {};

  #retryConfig?: RetryConfig;
  events?: Record<string, { schema: z.ZodObject<any> }>;

  #runId: string;
  #state: any | null = null;
  #executionSpan: Span | undefined;

  #onStepTransition: Set<
    (
      state: Pick<
        WorkflowRunResult<TTriggerSchema, TSteps, TResult>,
        'results' | 'activePaths' | 'runId' | 'timestamp'
      >,
    ) => void | Promise<void>
  > = new Set();
  #onFinish?: () => void;

  #resultMapping?: Record<string, { step: StepAction<any, any, any, any>; path: string }>;

  // indexed by stepId
  #suspendedMachines: Record<string, Machine<TSteps, TTriggerSchema>> = {};
  // {step1&&step2: {step1: true, step2: true}}
  #compoundDependencies: Record<string, Record<string, boolean>> = {};

  constructor({
    name,
    logger,
    steps,
    runId,
    retryConfig,
    mastra,
    stepGraph,
    stepSubscriberGraph,
    onFinish,
    onStepTransition,
    resultMapping,
    events,
  }: {
    name: string;
    logger: Logger;
    steps: Record<string, StepAction<any, any, any, any>>;
    mastra?: Mastra;
    retryConfig?: RetryConfig;
    runId?: string;
    stepGraph: StepGraph;
    stepSubscriberGraph: Record<string, StepGraph>;
    onFinish?: () => void;
    onStepTransition?: Set<
      (
        state: Pick<
          WorkflowRunResult<TTriggerSchema, TSteps, TResult>,
          'results' | 'activePaths' | 'runId' | 'timestamp'
        >,
      ) => void | Promise<void>
    >;
    resultMapping?: Record<string, { step: StepAction<any, any, any, any>; path: string }>;
    events?: Record<string, { schema: z.ZodObject<any> }>;
  }) {
    this.name = name;
    this.logger = logger;

    this.#steps = steps;
    this.#stepGraph = stepGraph;
    this.#stepSubscriberGraph = stepSubscriberGraph;

    this.#retryConfig = retryConfig;
    this.#mastra = mastra;

    this.#runId = runId ?? crypto.randomUUID();

    this.#onFinish = onFinish;

    this.#resultMapping = resultMapping;

    this.events = events;
    onStepTransition?.forEach(handler => this.#onStepTransition.add(handler));
    this.#initializeCompoundDependencies();
  }

  setState(state: any) {
    this.#state = state;
  }

  get runId() {
    return this.#runId;
  }

  get executionSpan() {
    return this.#executionSpan;
  }

  watch(
    onTransition: (
      state: Pick<
        WorkflowRunResult<TTriggerSchema, TSteps, TResult>,
        'results' | 'activePaths' | 'runId' | 'timestamp'
      >,
    ) => void,
  ): () => void {
    this.#onStepTransition.add(onTransition);

    return () => {
      this.#onStepTransition.delete(onTransition);
    };
  }

  async start({ triggerData }: { triggerData?: z.infer<TTriggerSchema> } = {}) {
    const results = await this.execute({ triggerData });

    if (this.#onFinish) {
      this.#onFinish();
    }

    return {
      ...results,
      runId: this.runId,
    };
  }

  private isCompoundDependencyMet(stepKey: string): boolean {
    // If this is not a compound dependency, return true
    if (!this.#isCompoundKey(stepKey)) return true;

    const dependencies = this.#compoundDependencies[stepKey];
    // Check if all required steps are completed successfully
    return dependencies ? Object.values(dependencies).every(status => status === true) : true;
  }

  async execute({
    triggerData,
    snapshot,
    stepId,
    resumeData,
  }: {
    stepId?: string;
    triggerData?: z.infer<TTriggerSchema>;
    snapshot?: Snapshot<any>;
    resumeData?: any; // TODO: once we have a resume schema plug that in here
  } = {}): Promise<Omit<WorkflowRunResult<TTriggerSchema, TSteps, TResult>, 'runId'>> {
    this.#executionSpan = this.#mastra?.getTelemetry()?.tracer.startSpan(`workflow.${this.name}.execute`, {
      attributes: { componentName: this.name, runId: this.runId },
    });

    let machineInput = {
      // Maintain the original step results and their output
      steps: {},
      triggerData: triggerData || {},
      attempts: Object.keys(this.#steps).reduce(
        (acc, stepKey) => {
          acc[stepKey] = this.#steps[stepKey]?.retryConfig?.attempts || this.#retryConfig?.attempts || 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
    let stepGraph = this.#stepGraph;
    let startStepId = 'trigger';

    if (snapshot) {
      const runState = snapshot as unknown as WorkflowRunState;

      if (stepId && runState?.suspendedSteps?.[stepId]) {
        startStepId = runState.suspendedSteps[stepId];
        stepGraph = this.#stepSubscriberGraph[startStepId] ?? this.#stepGraph;
        machineInput = runState.context;
      }
    }

    const defaultMachine = new Machine({
      logger: this.logger,
      mastra: this.#mastra,
      workflowInstance: this,
      name: this.name,
      runId: this.runId,
      steps: this.#steps,
      stepGraph,
      executionSpan: this.#executionSpan,
      startStepId,
      retryConfig: this.#retryConfig,
    });

    this.#machines[startStepId] = defaultMachine;

    const stateUpdateHandler = (startStepId: string, state: any) => {
      if (startStepId === 'trigger') {
        this.#state = state;
      } else {
        this.#state = mergeChildValue(startStepId, this.#state, state.value);
      }

      const now = Date.now();
      if (this.#onStepTransition) {
        this.#onStepTransition.forEach(onTransition => {
          void onTransition({
            runId: this.#runId,
            results: state.context.steps,
            activePaths: getResultActivePaths(
              state as unknown as { value: Record<string, string>; context: { steps: Record<string, any> } },
            ),
            timestamp: now,
          });
        });
      }
    };

    defaultMachine.on('state-update', stateUpdateHandler);

    const { results, activePaths } = await defaultMachine.execute({
      snapshot,
      stepId,
      input: machineInput,
      resumeData,
    });

    await this.persistWorkflowSnapshot();

    const result: Omit<WorkflowRunResult<TTriggerSchema, TSteps, TResult>, 'runId'> = {
      results,
      activePaths,
      timestamp: Date.now(),
    };

    if (this.#resultMapping) {
      result.result = resolveVariables({
        runId: this.#runId,
        logger: this.logger,
        variables: this.#resultMapping,
        context: {
          steps: results,
          triggerData: triggerData,
          inputData: {},
          attempts: machineInput.attempts,
          getStepResult: (stepId: string) => results[stepId],
        },
      });
    }

    return result;
  }

  hasSubscribers(stepId: string) {
    return Object.keys(this.#stepSubscriberGraph).some(key => key.split('&&').includes(stepId));
  }

  async runMachine(parentStepId: string, input: any) {
    const stepStatus = input.steps[parentStepId]?.status;

    // get all keys from this.#stepSubscriberGraph that include the parentStepId after the &&
    const subscriberKeys = Object.keys(this.#stepSubscriberGraph).filter(key => key.split('&&').includes(parentStepId));

    subscriberKeys.forEach(key => {
      if (['success', 'failure', 'skipped'].includes(stepStatus) && this.#isCompoundKey(key)) {
        this.#compoundDependencies[key]![parentStepId] = true;
      }
    });

    const stateUpdateHandler = (startStepId: string, state: any) => {
      if (startStepId === 'trigger') {
        this.#state = state;
      } else {
        this.#state = mergeChildValue(startStepId, this.#state, state.value);
      }

      const now = Date.now();
      if (this.#onStepTransition) {
        this.#onStepTransition.forEach(onTransition => {
          void onTransition({
            runId: this.#runId,
            results: state.context.steps,
            activePaths: getResultActivePaths(
              state as unknown as { value: Record<string, string>; context: { steps: Record<string, any> } },
            ),
            timestamp: now,
          });
        });
      }
    };

    const results = await Promise.all(
      subscriberKeys.map(async key => {
        if (!this.#stepSubscriberGraph[key] || !this.isCompoundDependencyMet(key)) {
          return;
        }

        this.#initializeCompoundDependencies();

        const machine = new Machine({
          logger: this.logger,
          mastra: this.#mastra,
          workflowInstance: this,
          name: parentStepId === 'trigger' ? this.name : `${this.name}-${parentStepId}`,
          runId: this.runId,
          steps: this.#steps,
          stepGraph: this.#stepSubscriberGraph[key],
          executionSpan: this.#executionSpan,
          startStepId: parentStepId,
        });

        machine.on('state-update', stateUpdateHandler);
        this.#machines[parentStepId] = machine;
        return machine.execute({ input });
      }),
    );

    return results;
  }

  async suspend(stepId: string, machine: Machine<TSteps, TTriggerSchema>) {
    this.#suspendedMachines[stepId] = machine;
  }

  /**
   * Persists the workflow state to the database
   */
  async persistWorkflowSnapshot(): Promise<void> {
    const existingSnapshot = (await this.#mastra?.storage?.loadWorkflowSnapshot({
      workflowName: this.name,
      runId: this.#runId,
    })) as WorkflowRunState;

    const machineSnapshots: Record<string, WorkflowRunState> = {};
    for (const [stepId, machine] of Object.entries(this.#machines)) {
      const machineSnapshot = machine?.getSnapshot() as unknown as WorkflowRunState;
      if (machineSnapshot) {
        machineSnapshots[stepId] = { ...machineSnapshot };
      }
    }

    let snapshot = machineSnapshots['trigger'] as unknown as WorkflowRunState;
    delete machineSnapshots['trigger'];

    const suspendedSteps: Record<string, string> = Object.entries(this.#suspendedMachines).reduce(
      (acc, [stepId, machine]) => {
        acc[stepId] = machine.startStepId;
        return acc;
      },
      {} as Record<string, string>,
    );

    if (!snapshot && existingSnapshot) {
      existingSnapshot.childStates = { ...existingSnapshot.childStates, ...machineSnapshots };
      existingSnapshot.suspendedSteps = { ...existingSnapshot.suspendedSteps, ...suspendedSteps };
      await this.#mastra?.storage?.persistWorkflowSnapshot({
        workflowName: this.name,
        runId: this.#runId,
        snapshot: existingSnapshot,
      });

      return;
    } else if (snapshot && !existingSnapshot) {
      snapshot.suspendedSteps = suspendedSteps;
      snapshot.childStates = { ...machineSnapshots };
      await this.#mastra?.storage?.persistWorkflowSnapshot({
        workflowName: this.name,
        runId: this.#runId,
        snapshot,
      });
      return;
    } else if (!snapshot) {
      this.logger.debug('Snapshot cannot be persisted. No snapshot received.', { runId: this.#runId });
      return;
    }

    snapshot.suspendedSteps = { ...existingSnapshot.suspendedSteps, ...suspendedSteps };

    if (!existingSnapshot || snapshot === existingSnapshot) {
      await this.#mastra?.storage?.persistWorkflowSnapshot({
        workflowName: this.name,
        runId: this.#runId,
        snapshot,
      });

      return;
    }

    if (existingSnapshot?.childStates) {
      snapshot.childStates = { ...existingSnapshot.childStates, ...machineSnapshots };
    } else {
      snapshot.childStates = machineSnapshots;
    }

    await this.#mastra?.storage?.persistWorkflowSnapshot({
      workflowName: this.name,
      runId: this.#runId,
      snapshot,
    });
  }

  async getState(): Promise<WorkflowRunState | null> {
    const storedSnapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
      workflowName: this.name,
      runId: this.runId,
    });
    const prevSnapshot: Record<string, WorkflowRunState> = storedSnapshot
      ? {
          trigger: storedSnapshot,
          ...Object.entries(storedSnapshot?.childStates ?? {}).reduce(
            (acc, [stepId, snapshot]) => ({ ...acc, [stepId]: snapshot as WorkflowRunState }),
            {},
          ),
        }
      : ({} as Record<string, WorkflowRunState>);

    const currentSnapshot = Object.entries(this.#machines).reduce(
      (acc, [stepId, machine]) => {
        const snapshot = machine.getSnapshot();
        if (!snapshot) {
          return acc;
        }

        return {
          ...acc,
          [stepId]: snapshot as unknown as WorkflowRunState,
        };
      },
      {} as Record<string, WorkflowRunState>,
    );

    Object.assign(prevSnapshot, currentSnapshot);

    const trigger = prevSnapshot.trigger as unknown as WorkflowRunState;
    delete prevSnapshot.trigger;
    const snapshot = { ...trigger, childStates: prevSnapshot };

    // TODO: really patch the state together here
    const m = getActivePathsAndStatus(prevSnapshot.value as Record<string, any>);
    return {
      runId: this.runId,
      value: snapshot.value as Record<string, string>,
      context: snapshot.context,
      activePaths: m,
      timestamp: Date.now(),
    };
  }

  async resumeWithEvent(eventName: string, data: any) {
    const event = this.events?.[eventName];
    if (!event) {
      throw new Error(`Event ${eventName} not found`);
    }

    const results = await this.resume({ stepId: `__${eventName}_event`, context: { resumedEvent: data } });
    return results;
  }

  async resume({ stepId, context: resumeContext }: { stepId: string; context?: Record<string, any> }) {
    // NOTE: setTimeout(0) makes sure that if the workflow is still running
    // we'll wait for any state changes to be applied before resuming
    await new Promise(resolve => setTimeout(resolve, 0));
    return this._resume({ stepId, context: resumeContext });
  }

  async #loadWorkflowSnapshot(runId: string) {
    if (!this.#mastra?.storage) {
      this.logger.debug('Snapshot cannot be loaded. Mastra engine is not initialized', { runId });
      return;
    }

    await this.persistWorkflowSnapshot();

    return this.#mastra.getStorage()?.loadWorkflowSnapshot({ runId, workflowName: this.name });
  }

  async _resume({ stepId, context: resumeContext }: { stepId: string; context?: Record<string, any> }) {
    const snapshot = await this.#loadWorkflowSnapshot(this.runId);

    if (!snapshot) {
      throw new Error(`No snapshot found for workflow run ${this.runId}`);
    }

    const stepParts = stepId.split('.');
    const stepPath = stepParts.join('.');
    if (stepParts.length > 1) {
      stepId = stepParts[0] ?? stepId;
    }

    let parsedSnapshot;
    try {
      parsedSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot as unknown as string) : snapshot;
    } catch (error) {
      this.logger.debug('Failed to parse workflow snapshot for resume', { error, runId: this.runId });
      throw new Error('Failed to parse workflow snapshot');
    }

    const startStepId = parsedSnapshot.suspendedSteps?.[stepId];

    if (!startStepId) {
      return;
    }
    parsedSnapshot =
      startStepId === 'trigger'
        ? parsedSnapshot
        : { ...parsedSnapshot?.childStates?.[startStepId], ...{ suspendedSteps: parsedSnapshot.suspendedSteps } };
    if (!parsedSnapshot) {
      throw new Error(`No snapshot found for step: ${stepId} starting at ${startStepId}`);
    }

    // Update context if provided

    if (resumeContext) {
      parsedSnapshot.context.steps[stepId] = {
        status: 'success',
        output: {
          ...(parsedSnapshot?.context?.steps?.[stepId]?.output || {}),
          ...resumeContext,
        },
      };
    }

    // Reattach the step handler
    // TODO: need types
    if (parsedSnapshot.children) {
      Object.entries(parsedSnapshot.children).forEach(([_childId, child]: [string, any]) => {
        if (child.snapshot?.input?.stepNode) {
          // Reattach handler
          const stepDef = this.#makeStepDef(child.snapshot.input.stepNode.step.id);
          child.snapshot.input.stepNode.config = {
            ...child.snapshot.input.stepNode.config,
            ...stepDef,
          };

          // Sync the context
          child.snapshot.input.context = parsedSnapshot.context;
        }
      });
    }

    parsedSnapshot.value = updateStepInHierarchy(parsedSnapshot.value, stepId);

    // Reset attempt count
    if (parsedSnapshot.context?.attempts) {
      parsedSnapshot.context.attempts[stepId] =
        this.#steps[stepId]?.retryConfig?.attempts || this.#retryConfig?.attempts || 0;
    }

    this.logger.debug('Resuming workflow with updated snapshot', {
      updatedSnapshot: parsedSnapshot,
      runId: this.runId,
      stepId,
    });

    return this.execute({
      snapshot: parsedSnapshot,
      stepId: stepPath,
      resumeData: resumeContext,
    });
  }

  #initializeCompoundDependencies() {
    Object.keys(this.#stepSubscriberGraph).forEach(stepKey => {
      if (this.#isCompoundKey(stepKey)) {
        const requiredSteps = stepKey.split('&&');
        this.#compoundDependencies[stepKey] = requiredSteps.reduce(
          (acc, step) => {
            acc[step] = false;
            return acc;
          },
          {} as Record<string, boolean>,
        );
      }
    });
  }

  #makeStepDef<TStepId extends TSteps[number]['id'], TSteps extends Step<any, any, any>[]>(
    stepId: TStepId,
  ): StepDef<TStepId, TSteps, any, any>[TStepId] {
    const executeStep = (
      handler: (data: any) => Promise<(data: any) => void>,
      spanName: string,
      attributes?: Record<string, string>,
    ) => {
      return async (data: any) => {
        return await otlpContext.with(trace.setSpan(otlpContext.active(), this.#executionSpan as Span), async () => {
          if (this.#mastra?.getTelemetry()) {
            return this.#mastra.getTelemetry()?.traceMethod(handler, {
              spanName,
              attributes,
            })(data);
          } else {
            return handler(data);
          }
        });
      };
    };

    // NOTE: destructuring rest breaks some injected runtime fields, like runId
    // TODO: investigate why that is exactly
    const handler = async ({ context, ...rest }: ActionContext<TSteps[number]['inputSchema']>) => {
      const targetStep = this.#steps[stepId];
      if (!targetStep) throw new Error(`Step not found`);

      const { payload = {}, execute = async () => {} } = targetStep;

      // Merge static payload with dynamically resolved variables
      // Variables take precedence over payload values
      const mergedData = {
        ...(payload as {}),
        ...context,
      };

      // Only trace if telemetry is available and action exists
      const finalAction = this.#mastra?.getTelemetry()
        ? executeStep(execute, `workflow.${this.name}.action.${stepId}`, {
            componentName: this.name,
            runId: rest.runId as string,
          })
        : execute;

      return finalAction ? await finalAction({ context: mergedData, ...rest }) : {};
    };

    // Only trace handler if telemetry is available

    const finalHandler = ({ context, ...rest }: ActionContext<TSteps[number]['inputSchema']>) => {
      if (this.#executionSpan) {
        return executeStep(handler, `workflow.${this.name}.step.${stepId}`, {
          componentName: this.name,
          runId: rest?.runId as string,
        })({ context, ...rest });
      }

      return handler({ context, ...rest });
    };

    return {
      handler: finalHandler,
      data: {},
    };
  }

  #isCompoundKey(key: string) {
    return key.includes('&&');
  }
}

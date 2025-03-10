import type { Span } from '@opentelemetry/api';
import type { Snapshot } from 'xstate';
import type { z } from 'zod';

import type { Logger } from '../logger';

import type { Mastra } from '../mastra';
import { Machine } from './machine';
import type { Step } from './step';
import type { RetryConfig, StepAction, StepGraph, WorkflowContext, WorkflowRunResult, WorkflowRunState } from './types';
import { getActivePathsAndStatus, mergeChildValue } from './utils';

export interface WorkflowResultReturn<T extends z.ZodType<any>, TSteps extends Step<any, any, any>[]> {
  runId: string;
  start: (props?: { triggerData?: z.infer<T> } | undefined) => Promise<WorkflowRunResult<T, TSteps>>;
}

export class WorkflowInstance<TSteps extends Step<any, any, any>[] = any, TTriggerSchema extends z.ZodObject<any> = any>
  implements WorkflowResultReturn<TTriggerSchema, TSteps>
{
  name: string;
  #mastra?: Mastra;
  #machines: Record<string, Machine<TSteps, TTriggerSchema>> = {};

  logger: Logger;

  #steps: Record<string, StepAction<any, any, any, any>> = {};
  #stepGraph: StepGraph;
  #stepSubscriberGraph: Record<string, StepGraph> = {};

  #retryConfig?: RetryConfig;

  #runId: string;
  #state: any | null = null;
  #executionSpan: Span | undefined;

  #onStepTransition: Set<(state: WorkflowRunState) => void | Promise<void>> = new Set();
  #onFinish?: () => void;

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
    onStepTransition,
    onFinish,
  }: {
    name: string;
    logger: Logger;
    steps: Record<string, StepAction<any, any, any, any>>;
    mastra?: Mastra;
    retryConfig?: RetryConfig;
    runId?: string;
    stepGraph: StepGraph;
    stepSubscriberGraph: Record<string, StepGraph>;
    onStepTransition: Set<(state: WorkflowRunState) => void | Promise<void>>;
    onFinish?: () => void;
  }) {
    this.name = name;
    this.logger = logger;

    this.#steps = steps;
    this.#stepGraph = stepGraph;
    this.#stepSubscriberGraph = stepSubscriberGraph;

    this.#retryConfig = retryConfig;
    this.#mastra = mastra;

    this.#runId = runId ?? crypto.randomUUID();
    this.#onStepTransition = onStepTransition;
    this.#onFinish = onFinish;

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
  } = {}): Promise<Omit<WorkflowRunResult<TTriggerSchema, TSteps>, 'runId'>> {
    this.#executionSpan = this.#mastra?.getTelemetry()?.tracer.startSpan(`workflow.${this.name}.execute`, {
      attributes: { componentName: this.name, runId: this.runId },
    });

    let machineInput = {
      // Maintain the original step results and their output
      steps: {},
      triggerData: triggerData || {},
      attempts: Object.keys(this.#steps).reduce(
        (acc, stepKey) => {
          acc[stepKey] = this.#steps[stepKey]?.retryConfig?.attempts || this.#retryConfig?.attempts || 3;
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
      input: {
        resumeData,
      },
    });

    this.#machines[startStepId] = defaultMachine;

    const stateUpdateHandler = (startStepId: string, state: any, context: any) => {
      if (startStepId === 'trigger') {
        this.#state = state;
      } else {
        this.#state = mergeChildValue(startStepId, this.#state, state);
      }

      const now = Date.now();
      if (this.#onStepTransition) {
        this.#onStepTransition.forEach(onTransition => {
          void onTransition({
            runId: this.#runId,
            value: this.#state as Record<string, string>,
            context: context as WorkflowContext,
            activePaths: getActivePathsAndStatus(this.#state as Record<string, string>),
            timestamp: now,
          });
        });
      }
    };

    defaultMachine.on('state-update', stateUpdateHandler);

    console.log('machine execute', { snapshot, stepId, input: machineInput });
    const { results, activePaths } = await defaultMachine.execute({ snapshot, stepId, input: machineInput });
    console.log('machine executed', results);

    await this.persistWorkflowSnapshot();

    return { results, activePaths };
  }

  async runMachine(parentStepId: string, input: any) {
    console.log('runMachine', { parentStepId, input });
    const stepStatus = input.steps[parentStepId]?.status;

    // get all keys from this.#stepSubscriberGraph that include the parentStepId after the &&
    const subscriberKeys = Object.keys(this.#stepSubscriberGraph).filter(key => key.split('&&').includes(parentStepId));

    subscriberKeys.forEach(key => {
      if (['success', 'failure'].includes(stepStatus) && this.#isCompoundKey(key)) {
        this.#compoundDependencies[key]![parentStepId] = true;
      }
    });

    const stateUpdateHandler = (startStepId: string, state: any, context: any) => {
      if (startStepId === 'trigger') {
        this.#state = state;
      } else {
        this.#state = mergeChildValue(startStepId, this.#state, state);
      }

      const now = Date.now();
      if (this.#onStepTransition) {
        this.#onStepTransition.forEach(onTransition => {
          void onTransition({
            runId: this.#runId,
            value: this.#state as Record<string, string>,
            context: context as WorkflowContext,
            activePaths: getActivePathsAndStatus(this.#state as Record<string, string>),
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

        delete this.#compoundDependencies[key];

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

  #isCompoundKey(key: string) {
    return key.includes('&&');
  }
}

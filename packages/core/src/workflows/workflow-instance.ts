import type { Span } from '@opentelemetry/api';
import { type Snapshot } from 'xstate';
import type { z } from 'zod';

import type { IAction, MastraPrimitives } from '../action';
import type { Logger } from '../logger';

import { Machine } from './machine';
import { Step } from './step';
import type { RetryConfig, StepGraph, StepResult, WorkflowRunState } from './types';
import { getActivePathsAndStatus } from './utils';

export interface WorkflowResultReturn<T extends z.ZodType<any>> {
  runId: string;
  start: (props?: { triggerData?: z.infer<T> } | undefined) => Promise<{
    triggerData?: z.infer<T>;
    results: Record<string, StepResult<any>>;
    runId: string;
  }>;
}

export class WorkflowInstance<TSteps extends Step<any, any, any>[] = any, TTriggerSchema extends z.ZodType<any> = any>
  implements WorkflowResultReturn<TTriggerSchema>
{
  name: string;
  #mastra?: MastraPrimitives;
  #machines: Record<string, Machine<TSteps, TTriggerSchema>> = {};

  logger: Logger;

  #steps: Record<string, IAction<any, any, any, any>> = {};
  #stepGraph: StepGraph;
  #stepSubscriberGraph: Record<string, StepGraph> = {};

  #retryConfig?: RetryConfig;

  #runId: string;
  #executionSpan: Span | undefined;

  #onStepTransition: Set<(state: WorkflowRunState) => void | Promise<void>> = new Set();
  #onFinish?: () => void;

  // indexed by stepId
  #suspendedMachines: Record<string, Machine<TSteps, TTriggerSchema>> = {};

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
    steps: Record<string, IAction<any, any, any, any>>;
    mastra?: MastraPrimitives;
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
  }

  get runId() {
    return this.#runId;
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

  async execute({
    triggerData,
    snapshot,
    stepId,
  }: {
    stepId?: string;
    triggerData?: z.infer<TTriggerSchema>;
    snapshot?: Snapshot<any>;
  } = {}): Promise<{
    triggerData?: z.infer<TTriggerSchema>;
    results: Record<string, StepResult<any>>;
  }> {
    this.#executionSpan = this.#mastra?.telemetry?.tracer.startSpan(`workflow.${this.name}.execute`, {
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
      machineInput = runState.context;
      if (stepId && runState?.suspendedSteps?.[stepId]) {
        stepGraph = this.#stepSubscriberGraph[runState.suspendedSteps[stepId]] ?? this.#stepGraph;
        startStepId = stepId;

        delete this.#suspendedMachines[stepId];
      }
    }

    const defaultMachine = new Machine({
      logger: this.logger,
      mastra: this.#mastra,
      workflowInstance: this,
      name: this.name,
      runId: this.runId,
      steps: this.#steps,
      onStepTransition: this.#onStepTransition,
      stepGraph,
      executionSpan: this.#executionSpan,
      startStepId,
    });

    this.#machines[startStepId] = defaultMachine;

    const nestedMachines: Promise<any>[] = [];
    const spawnHandler = ({ parentStepId, context }: { parentStepId: string; context: any }) => {
      if (this.#stepSubscriberGraph[parentStepId]) {
        console.log('spawning subscriber', { parentStepId, context });
        const machine = new Machine({
          logger: this.logger,
          mastra: this.#mastra,
          workflowInstance: this,
          name: this.name,
          runId: this.runId,
          steps: this.#steps,
          onStepTransition: this.#onStepTransition,
          stepGraph: this.#stepSubscriberGraph[parentStepId],
          executionSpan: this.#executionSpan,
          startStepId: parentStepId,
        });

        this.#machines[parentStepId] = defaultMachine;

        machine.on('spawn-subscriber', spawnHandler);

        nestedMachines.push(machine.execute({ input: context }));
      }
    };

    defaultMachine.on('spawn-subscriber', spawnHandler);

    const { results } = await defaultMachine.execute({ snapshot, stepId, input: machineInput });
    const nestedResults = (await Promise.all(nestedMachines)).reduce(
      (acc, { results }) => ({ ...acc, ...results }),
      {},
    );
    const allResults = { ...results, ...nestedResults };

    await this.persistWorkflowSnapshot();

    return { results: allResults };
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
      const machineSnapshot = machine.getSnapshot() as unknown as WorkflowRunState;
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
}

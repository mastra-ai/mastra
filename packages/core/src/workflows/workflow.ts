import { trace, context as otlpContext } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { get } from 'radash';
import sift from 'sift';
import { assign, createActor, fromPromise, setup } from 'xstate';
import type { MachineContext, Snapshot } from 'xstate';
import type { z } from 'zod';

import type { IAction, MastraPrimitives } from '../action';
import { MastraBase } from '../base';

import type { Step } from './step';
import type {
  ActionContext,
  DependencyCheckOutput,
  ResolverFunctionInput,
  ResolverFunctionOutput,
  RetryConfig,
  StepCondition,
  StepConfig,
  StepDef,
  StepGraph,
  StepNode,
  StepResult,
  StepVariableType,
  WorkflowActionParams,
  WorkflowActions,
  WorkflowActors,
  WorkflowContext,
  WorkflowEvent,
  WorkflowOptions,
  WorkflowRunState,
  WorkflowState,
} from './types';
import { getStepResult, isErrorEvent, isTransitionEvent, isVariableReference } from './utils';

interface WorkflowResultReturn<T extends z.ZodType<any>> {
  runId: string;
  start: (props?: { triggerData?: z.infer<T> } | undefined) => Promise<{
    triggerData?: z.infer<T>;
    results: Record<string, StepResult<any>>;
    runId: string;
  }>;
}

export class Workflow<
  TSteps extends Step<any, any, any>[] = any,
  TTriggerSchema extends z.ZodType<any> = any,
> extends MastraBase {
  name: string;
  triggerSchema?: TTriggerSchema;
  /** XState machine instance that orchestrates the workflow execution */
  #machine!: ReturnType<typeof this.initializeMachine>;
  /** XState actor instance that manages the workflow execution */
  #actor: ReturnType<typeof createActor<ReturnType<typeof this.initializeMachine>>> | null = null;
  #runId: string;
  #retryConfig?: RetryConfig;
  #mastra?: MastraPrimitives;

  // registers stepIds on `after` calls
  #afterStepStack: string[] = [];
  #lastStepStack: string[] = [];
  #stepGraph: StepGraph = { initial: [] };
  #stepSubscriberGraph: Record<string, StepGraph> = {};
  #steps: Record<string, IAction<any, any, any, any>> = {};
  #onStepTransition: Set<(state: WorkflowRunState) => void | Promise<void>> = new Set();
  #executionSpan: Span | undefined;

  /**
   * Creates a new Workflow instance
   * @param name - Identifier for the workflow (not necessarily unique)
   * @param logger - Optional logger instance
   */
  constructor({ name, triggerSchema, retryConfig, mastra }: WorkflowOptions<TTriggerSchema>) {
    super({ component: 'WORKFLOW', name });

    this.name = name;
    this.#retryConfig = retryConfig;
    this.triggerSchema = triggerSchema;
    this.#runId = crypto.randomUUID();
    this.#mastra = mastra;

    if (mastra?.logger) {
      this.logger = mastra?.logger;
    }

    this.initializeMachine();
  }

  /**
   * Initializes the XState machine for the workflow
   *
   * Registers the machine's types, actions, actors, initial context, entry actions, initial state, and states
   * @returns The initialized machine
   */
  private initializeMachine() {
    const machine = setup({
      types: {} as {
        context: Omit<WorkflowContext, 'getStepResult'>;
        input: Omit<WorkflowContext, 'getStepResult'>;
        events: WorkflowEvent;
        actions: WorkflowActions;
        actors: WorkflowActors;
      },
      delays: this.#makeDelayMap(),
      actions: this.#getDefaultActions() as any,
      actors: this.#getDefaultActors(),
    }).createMachine({
      id: this.name,
      type: 'parallel',
      context: ({ input }) => ({
        ...input,
      }),
      states: this.#buildStateHierarchy(this.#stepGraph) as any,
    });

    this.#machine = machine;
    return machine;
  }

  step<
    TStep extends IAction<any, any, any, any>,
    CondStep extends StepVariableType<any, any, any, any>,
    VarStep extends StepVariableType<any, any, any, any>,
  >(step: TStep, config?: StepConfig<TStep, CondStep, VarStep, TTriggerSchema>) {
    const { variables = {} } = config || {};

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }

    const stepKey = this.#makeStepKey(step);

    const graphEntry: StepNode = {
      step,
      config: {
        ...this.#makeStepDef(stepKey),
        ...config,
        data: requiredData,
      },
    };

    this.#steps[stepKey] = step;

    const parentStepKey = this.#afterStepStack[this.#afterStepStack.length - 1];
    const stepGraph = this.#stepSubscriberGraph[parentStepKey || ''];

    // if we are in an after chain and we have a stepGraph
    if (parentStepKey && stepGraph) {
      // if the stepGraph has an initial, but it doesn't contain the current step, add it to the initial
      if (!stepGraph.initial.some(step => step.step.id === stepKey)) {
        stepGraph.initial.push(graphEntry);
      }
      // add the current step to the stepGraph
      stepGraph[stepKey] = [];
    } else {
      // Normal step addition to main graph
      if (!this.#stepGraph[stepKey]) this.#stepGraph[stepKey] = [];
      this.#stepGraph.initial.push(graphEntry);
    }
    this.#lastStepStack.push(stepKey);

    return this;
  }

  then<
    TStep extends IAction<any, any, any, any>,
    CondStep extends StepVariableType<any, any, any, any>,
    VarStep extends StepVariableType<any, any, any, any>,
  >(step: TStep, config?: StepConfig<TStep, CondStep, VarStep, TTriggerSchema>) {
    const { variables = {} } = config || {};

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }

    const lastStepKey = this.#lastStepStack[this.#lastStepStack.length - 1];
    const stepKey = this.#makeStepKey(step);

    const graphEntry: StepNode = {
      step,
      config: {
        ...this.#makeStepDef(stepKey),
        ...config,
        data: requiredData,
      },
    };

    this.#steps[stepKey] = step;
    // if then is called without a step, we are done
    if (!lastStepKey) return this;

    const parentStepKey = this.#afterStepStack[this.#afterStepStack.length - 1];
    const stepGraph = this.#stepSubscriberGraph[parentStepKey || ''];

    if (parentStepKey && stepGraph && stepGraph[lastStepKey]) {
      stepGraph[lastStepKey].push(graphEntry);
    } else {
      // add the step to the graph if not already there.. it should be there though, unless magic
      if (!this.#stepGraph[lastStepKey]) this.#stepGraph[lastStepKey] = [];

      // add the step to the graph
      this.#stepGraph[lastStepKey].push(graphEntry);
    }

    return this;
  }

  after<TStep extends IAction<any, any, any, any>>(step: TStep) {
    const stepKey = this.#makeStepKey(step);
    this.#afterStepStack.push(stepKey);

    // Initialize subscriber array for this step if it doesn't exist
    if (!this.#stepSubscriberGraph[stepKey]) {
      this.#stepSubscriberGraph[stepKey] = { initial: [] };
    }

    return this as Omit<typeof this, 'then' | 'after'>;
  }

  /**
   * Executes the workflow with the given trigger data
   * @param triggerData - Initial data to start the workflow with
   * @returns Promise resolving to workflow results or rejecting with error
   * @throws Error if trigger schema validation fails
   */

  createRun(): WorkflowResultReturn<TTriggerSchema> {
    const runId = crypto.randomUUID();
    this.#runId = runId;

    return {
      runId,
      start: async ({ triggerData } = {}) => this.execute({ triggerData }),
    };
  }

  async execute({
    triggerData,
    snapshot,
    runId,
    stepId,
  }: {
    stepId?: string;
    triggerData?: z.infer<TTriggerSchema>;
    runId?: string;
    snapshot?: Snapshot<any>;
  } = {}): Promise<{
    triggerData?: z.infer<TTriggerSchema>;
    results: Record<string, StepResult<any>>;
    runId: string;
  }> {
    if (runId) {
      this.#runId = runId;
      // First, let's log the incoming snapshot for debugging
      this.logger.debug(`Workflow snapshot received`, { runId: this.#runId, snapshot });
    }

    this.#executionSpan = this.#mastra?.telemetry?.tracer.startSpan(`workflow.${this.name}.execute`, {
      attributes: { componentName: this.name, runId: this.#runId },
    });

    const machineInput = snapshot
      ? (snapshot as any).context
      : {
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

    this.logger.debug(`Machine input prepared`, { runId: this.#runId, machineInput });

    const actorSnapshot = snapshot
      ? {
          ...snapshot,
          context: machineInput,
        }
      : undefined;

    this.logger.debug(`Creating actor with configuration`, {
      machineInput,
      actorSnapshot,
      machineStates: this.#machine.config.states,
      runId: this.#runId,
    });

    this.#actor = createActor(this.#machine, {
      inspect: (inspectionEvent: any) => {
        this.logger.debug('XState inspection event', {
          type: inspectionEvent.type,
          event: inspectionEvent.event,
          runId: this.#runId,
        });
      },
      input: machineInput,
      snapshot: actorSnapshot,
    });

    this.#actor.start();

    if (stepId) {
      this.#actor.send({ type: 'RESET_TO_PENDING', stepId });
    }

    this.logger.debug('Actor started', { runId: this.#runId });

    return new Promise((resolve, reject) => {
      if (!this.#actor) {
        const e = new Error('Actor not initialized');
        this.#executionSpan?.recordException(e);
        this.#executionSpan?.end();
        reject(e);
        return;
      }

      const suspendedPaths: Set<string> = new Set();
      this.#actor.subscribe(async state => {
        if (this.#onStepTransition) {
          this.#onStepTransition.forEach(onTransition => {
            onTransition({
              runId: this.#runId,
              value: state.value as Record<string, string>,
              context: state.context as WorkflowContext,
              activePaths: this.#getActivePathsAndStatus(state.value as Record<string, string>),
              timestamp: Date.now(),
            })?.catch(() => {
              // ignore
            });
          });
        }
        this.#getSuspendedPaths({
          value: state.value as Record<string, string>,
          path: '',
          suspendedPaths,
        });

        const allStatesValue = state.value as Record<string, string>;

        const allStatesComplete = this.#recursivelyCheckForFinalState({
          value: allStatesValue,
          suspendedPaths,
          path: '',
        });

        this.logger.debug('State completion check', {
          allStatesComplete,
          suspendedPaths: Array.from(suspendedPaths),
          runId: this.#runId,
        });

        // Check if all parallel states are in a final state
        if (!allStatesComplete) return;

        try {
          await this.#persistWorkflowSnapshot();
          // Then cleanup and resolve
          this.#cleanup();
          this.#executionSpan?.end();
          resolve({
            triggerData,
            results: state.context.steps,
            runId: this.#runId,
          });
        } catch (error) {
          // If snapshot persistence fails, we should still resolve
          // but maybe log the error
          this.logger.debug('Failed to persist final snapshot', { error });

          this.#cleanup();
          this.#executionSpan?.end();
          resolve({
            triggerData,
            results: state.context.steps,
            runId: this.#runId,
          });
        }
      });
    });
  }

  /**
   * Rebuilds the machine with the current steps configuration and validates the workflow
   *
   * This is the last step of a workflow builder method chain
   * @throws Error if validation fails
   *
   * @returns this instance for method chaining
   */
  commit() {
    // this.#validateWorkflow();
    this.initializeMachine();
    return this;
  }

  // record all object paths that leads to a suspended state
  #getSuspendedPaths({
    value,
    path,
    suspendedPaths,
  }: {
    value: string | Record<string, string>;
    path: string;
    suspendedPaths: Set<string>;
  }) {
    if (typeof value === 'string') {
      if (value === 'suspended') {
        suspendedPaths.add(path);
      }
    } else {
      Object.keys(value).forEach(key =>
        this.#getSuspendedPaths({ value: value[key]!, path: path ? `${path}.${key}` : key, suspendedPaths }),
      );
    }
  }

  #isFinalState(status: string): boolean {
    return ['completed', 'failed'].includes(status);
  }

  #recursivelyCheckForFinalState({
    value,
    suspendedPaths,
    path,
  }: {
    value: string | Record<string, string>;
    suspendedPaths: Set<string>;
    path: string;
  }): boolean {
    if (typeof value === 'string') {
      // if the value is a final state or it has previouslyreached a suspended state, return true
      return this.#isFinalState(value) || suspendedPaths.has(path);
    }
    return Object.keys(value).every(key =>
      this.#recursivelyCheckForFinalState({ value: value[key]!, suspendedPaths, path: path ? `${path}.${key}` : key }),
    );
  }

  #buildBaseState(stepNode: StepNode, nextSteps: StepNode[] = []): any {
    // NOTE: THIS CLEARS THE STEPGRAPH :: no concequences for now
    const nextStep = nextSteps.shift();

    return {
      initial: 'pending',
      on: {
        RESET_TO_PENDING: {
          target: '.pending', // Note the dot to target child state
        },
      },
      states: {
        pending: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} pending`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          exit: () => {
            this.logger.debug(`Step ${stepNode.step.id} finished pending`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          invoke: {
            src: 'conditionCheck',
            input: ({ context }: { context: WorkflowContext }) => {
              return {
                context,
                stepNode,
              };
            },
            onDone: [
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'SUSPENDED';
                },
                target: 'suspended',
                actions: [
                  assign({
                    steps: ({ context, event }) => {
                      if (event.output.type !== 'SUSPENDED') return context.steps;
                      return {
                        ...context.steps,
                        [stepNode.step.id]: {
                          status: 'suspended',
                          ...(context.steps?.[stepNode.step.id] || {}),
                        },
                      };
                    },
                    attempts: ({ context, event }) => {
                      if (event.output.type !== 'SUSPENDED') return context.attempts;
                      // if the step is suspended, reset the attempt count
                      return { ...context.attempts, [stepNode.step.id]: stepNode.step.retryConfig?.attempts || 3 };
                    },
                  }),
                ],
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'WAITING';
                },
                target: 'waiting',
                actions: [
                  { type: 'decrementAttemptCount', params: { stepId: stepNode.step.id } },
                  assign({
                    steps: ({ context, event }) => {
                      if (event.output.type !== 'WAITING') return context.steps;
                      return {
                        ...context.steps,
                        [stepNode.step.id]: {
                          status: 'waiting',
                        },
                      };
                    },
                  }),
                ],
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITIONS_MET';
                },
                target: 'executing',
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITION_FAILED';
                },
                target: 'failed',
                actions: assign({
                  steps: ({ context, event }) => {
                    if (event.output.type !== 'CONDITION_FAILED') return context.steps;

                    this.logger.debug(`Workflow condition check failed`, {
                      error: event.output.error,
                      stepId: stepNode.step.id,
                    });

                    return {
                      ...context.steps,
                      [stepNode.step.id]: {
                        status: 'failed',
                        error: event.output.error,
                      },
                    };
                  },
                }),
              },
            ],
          },
        },
        waiting: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} waiting`, {
              stepId: stepNode.step.id,
              timestamp: new Date().toISOString(),
              runId: this.#runId,
            });
          },
          exit: () => {
            this.logger.debug(`Step ${stepNode.step.id} finished waiting`, {
              stepId: stepNode.step.id,
              timestamp: new Date().toISOString(),
              runId: this.#runId,
            });
          },
          after: {
            [stepNode.step.id]: {
              target: 'pending',
            },
          },
        },
        suspended: {
          type: 'final',
          entry: [
            () => {
              this.logger.debug(`Step ${stepNode.step.id} suspended`, {
                stepId: stepNode.step.id,
                runId: this.#runId,
              });
            },
            assign({
              steps: ({ context }: { context: WorkflowContext }) => ({
                ...context.steps,
                [stepNode.step.id]: {
                  ...(context?.steps?.[stepNode.step.id] || {}),
                  status: 'suspended',
                },
              }),
            }),
          ],
          // after: {
          //   [stepNode.step.id]: {
          //     target: 'pending',
          //     actions: [
          //       assign({
          //         attempts: ({ context }: { context: WorkflowContext }) => ({
          //           ...context.attempts,
          //           [stepNode.step.id]: this.#steps[stepNode.step.id]?.retryConfig?.attempts || 3,
          //         }),
          //       }),
          //     ],
          //   }
          // },
          // entry: () => {
          //   this.logger.debug(`Step ${stepNode.step.id} suspended ${new Date().toISOString()}`);
          // },
          // exit: () => {
          //   this.logger.debug(`Step ${stepNode.step.id} finished suspended ${new Date().toISOString()}`);
          // },
          // after: {
          //   [stepNode.step.id]: {
          //     target: 'suspended',
          //   },
          // },
        },
        executing: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} executing`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          on: {
            SUSPENDED: {
              target: 'suspended',
              actions: [
                assign({
                  steps: ({ context }: { context: WorkflowContext }) => ({
                    ...context.steps,
                    [stepNode.step.id]: {
                      status: 'suspended',
                    },
                  }),
                }),
              ],
            },
          },
          invoke: {
            src: 'resolverFunction',
            input: ({ context }: { context: WorkflowContext }) => ({
              context,
              stepNode,
            }),
            onDone: {
              target: 'runningSubscribers',
              actions: [
                ({ event }: { event: any }) =>
                  this.logger.debug(`Step ${stepNode.step.id} finished executing`, {
                    stepId: stepNode.step.id,
                    output: event.output,
                    runId: this.#runId,
                  }),
                { type: 'updateStepResult', params: { stepId: stepNode.step.id } },
                { type: 'spawnSubscribers', params: { stepId: stepNode.step.id } },
              ],
            },
            onError: {
              target: 'failed',
              actions: [{ type: 'setStepError', params: { stepId: stepNode.step.id } }],
            },
          },
        },
        runningSubscribers: {
          entry: () => {
            this.logger.debug(`Step ${stepNode.step.id} running subscribers`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          exit: () => {
            this.logger.debug(`Step ${stepNode.step.id} finished running subscribers`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
          },
          invoke: {
            src: 'spawnSubscriberFunction',
            input: ({ context }: { context: WorkflowContext }) => ({
              parentStepId: stepNode.step.id,
              context,
            }),
            onDone: {
              target: nextStep ? nextStep.step.id : 'completed',
              actions: [
                assign({
                  steps: ({ context, event }: { context: WorkflowContext; event: any }) => ({
                    ...context.steps,
                    ...event.output.steps,
                  }),
                }),
                () => this.logger.debug(`Subscriber execution completed`, { stepId: stepNode.step.id }),
              ],
            },
            onError: {
              target: nextStep ? nextStep.step.id : 'completed',
              actions: ({ event }: { context: WorkflowContext; event: any }) => {
                this.logger.debug(`Subscriber execution failed`, {
                  error: event.error,
                  stepId: stepNode.step.id,
                });
              },
            },
          },
        },
        completed: {
          type: 'final',
          entry: [
            { type: 'notifyStepCompletion', params: { stepId: stepNode.step.id } },
            { type: 'snapshotStep', params: { stepId: stepNode.step.id } },
            { type: 'persistSnapshot' },
          ],
        },
        failed: {
          type: 'final',
          entry: [
            { type: 'notifyStepCompletion', params: { stepId: stepNode.step.id } },
            { type: 'snapshotStep', params: { stepId: stepNode.step.id } },
            { type: 'persistSnapshot' },
          ],
        },
        // build chain of next steps recursively
        ...(nextStep ? { [nextStep.step.id]: { ...this.#buildBaseState(nextStep, nextSteps) } } : {}),
      },
    };
  }

  #makeStepKey(step: Step<any, any, any>) {
    // return `${step.id}${this.#delimiter}${Object.keys(this.steps2).length}`;
    return `${step.id}`;
  }

  /**
   * Builds the state hierarchy for the workflow
   * @returns Object representing the state hierarchy
   */
  #buildStateHierarchy(stepGraph: StepGraph): WorkflowState {
    const states: Record<string, any> = {};

    stepGraph.initial.forEach(stepNode => {
      const nextSteps = [...(stepGraph[stepNode.step.id] || [])];
      // TODO: For identical steps, use index to create unique key
      states[stepNode.step.id] = {
        ...this.#buildBaseState(stepNode, nextSteps),
      };
    });

    return states;
  }

  #getDefaultActions() {
    return {
      updateStepResult: assign({
        steps: ({ context, event }: { context: WorkflowContext; event: any }) => {
          if (!isTransitionEvent(event)) return context.steps;

          const { stepId, result } = event.output as ResolverFunctionOutput;

          return {
            ...context.steps,
            [stepId]: {
              status: 'success' as const,
              output: result,
            },
          };
        },
      }),
      setStepError: assign({
        steps: ({ context, event }: { context: WorkflowContext; event: any }, params: WorkflowActionParams) => {
          if (!isErrorEvent(event)) return context.steps;

          const { stepId } = params;

          if (!stepId) return context.steps;

          return {
            ...context.steps,
            [stepId]: {
              status: 'failed' as const,
              error: event.error.message,
            },
          };
        },
      }),
      notifyStepCompletion: async (_: any, params: WorkflowActionParams) => {
        const { stepId } = params;
        this.logger.debug(`Step ${stepId} completed`);
      },
      snapshotStep: assign({
        _snapshot: ({}, params: WorkflowActionParams) => {
          const { stepId } = params;
          // This will run after the state update
          return { stepId };
        },
      }),
      persistSnapshot: async ({ context }: { context: MachineContext }) => {
        if (context._snapshot) {
          return await this.#persistWorkflowSnapshot();
        }
        return;
      },
      decrementAttemptCount: assign({
        attempts: ({ context, event }: { context: WorkflowContext; event: any }, params: WorkflowActionParams) => {
          if (!isTransitionEvent(event)) return context.attempts;

          const { stepId } = params;
          const attemptCount = context.attempts[stepId];

          if (attemptCount === undefined) return context.attempts;

          return { ...context.attempts, [stepId]: attemptCount - 1 };
        },
      }),
    };
  }

  #getInjectables() {
    return {
      runId: this.#runId,
      mastra: this.#mastra,
    };
  }

  #getDefaultActors() {
    return {
      resolverFunction: fromPromise(async ({ input }: { input: ResolverFunctionInput }) => {
        const { stepNode, context } = input;
        const injectables = this.#getInjectables();
        const resolvedData = this.#resolveVariables({
          stepConfig: stepNode.config,
          context,
          stepId: stepNode.step.id,
        });

        this.logger.debug(`Resolved variables for ${stepNode.step.id}`, {
          resolvedData,
          runId: this.#runId,
        });

        const result = await stepNode.config.handler({
          context: resolvedData,
          suspend: async () => {
            if (this.#actor) {
              // Update context with current result
              context.steps[stepNode.step.id] = {
                status: 'suspended',
              };
              await this.#persistWorkflowSnapshot();
              this.logger.debug(`Sending SUSPENDED event for step ${stepNode.step.id}`);
              this.#actor?.send({ type: 'SUSPENDED', stepId: stepNode.step.id });
            } else {
              this.logger.debug(`Actor not available for step ${stepNode.step.id}`);
            }
          },
          ...injectables,
        });

        this.logger.debug(`Step ${stepNode.step.id} result`, {
          stepId: stepNode.step.id,
          result,
          runId: this.#runId,
        });

        return {
          stepId: stepNode.step.id,
          result,
        };
      }),
      conditionCheck: fromPromise(async ({ input }: { input: { context: WorkflowContext; stepNode: StepNode } }) => {
        const { context, stepNode } = input;
        const stepConfig = stepNode.config;
        const attemptCount = context.attempts[stepNode.step.id];

        this.logger.debug(`Checking conditions for step ${stepNode.step.id}`, {
          stepId: stepNode.step.id,
          runId: this.#runId,
        });

        this.logger.debug(`Attempt count for step ${stepNode.step.id}`, {
          attemptCount,
          attempts: context.attempts,
          runId: this.#runId,
          stepId: stepNode.step.id,
        });

        // if step has no attempts left, suspend or fail
        if (!attemptCount || attemptCount < 0) {
          // TODO: INSTEAD OF SUSPENDING, LEAVE THE STEP IN THE PENDING STATE, AND UPDATE CONTEXT TO SIGNIFY COMPLETION
          if (stepConfig?.snapshotOnTimeout) {
            return { type: 'SUSPENDED' as const, stepId: stepNode.step.id };
          }
          return { type: 'CONDITION_FAILED' as const, error: `Step:${stepNode.step.id} condition check failed` };
        }

        if (!stepConfig?.when) {
          return { type: 'CONDITIONS_MET' as const };
        }

        this.logger.debug(`Checking conditions for step ${stepNode.step.id}`, {
          stepId: stepNode.step.id,
          runId: this.#runId,
        });

        if (typeof stepConfig?.when === 'function') {
          const conditionMet = await stepConfig.when({
            context: {
              ...context,
              getStepResult: ((stepId: string) => {
                if (stepId === 'trigger') {
                  return context.triggerData;
                }
                const result = context.steps[stepId];
                if (result && result.status === 'success') {
                  return result.output;
                }
                return undefined;
              }) as WorkflowContext<TTriggerSchema>['getStepResult'],
            },
          });
          if (conditionMet) {
            this.logger.debug(`Condition met for step ${stepNode.step.id}`, {
              stepId: stepNode.step.id,
              runId: this.#runId,
            });
            return { type: 'CONDITIONS_MET' as const };
          }
          if (!attemptCount || attemptCount < 0) {
            return { type: 'CONDITION_FAILED' as const, error: `Step:${stepNode.step.id} condition check failed` };
          }
          return { type: 'WAITING' as const, stepId: stepNode.step.id };
        } else {
          const conditionMet = this.#evaluateCondition(stepConfig.when, context);
          if (!conditionMet) {
            return {
              type: 'CONDITION_FAILED' as const,
              error: `Step:${stepNode.step.id} condition check failed`,
            };
          }
        }
        return { type: 'CONDITIONS_MET' as const };
      }),
      spawnSubscriberFunction: fromPromise(
        async ({
          input,
        }: {
          input: {
            parentStepId: string;
            context: WorkflowContext;
          };
        }) => {
          const { parentStepId, context } = input;
          const stepGraph = this.#stepSubscriberGraph[parentStepId];

          if (!stepGraph) {
            return {
              steps: {},
            };
          }

          const subscriberMachine = setup({
            types: {} as {
              context: WorkflowContext;
              input: WorkflowContext;
              events: WorkflowEvent;
              actions: WorkflowActions;
              actors: WorkflowActors;
            },
            delays: this.#makeDelayMap(),
            actions: this.#getDefaultActions() as any,
            actors: this.#getDefaultActors(),
          }).createMachine({
            id: `${this.name}-subscriber-${parentStepId}`,
            context: context as any,
            type: 'parallel',
            states: this.#buildStateHierarchy(stepGraph) as any,
          });

          const actor = createActor(subscriberMachine, { input: context });
          actor.start();

          // Create a promise that resolves when all states are final
          return new Promise(resolve => {
            const suspendedPaths = new Set<string>();
            actor.subscribe(state => {
              this.#getSuspendedPaths({
                value: state.value as Record<string, string>,
                path: '',
                suspendedPaths,
              });
              const allStatesValue = state.value as Record<string, string>;
              const allStatesComplete = this.#recursivelyCheckForFinalState({
                value: allStatesValue,
                suspendedPaths,
                path: '',
              });

              if (allStatesComplete) {
                actor.stop();
                resolve({
                  steps: state.context.steps,
                });
              }
            });
          });
        },
      ),
    };
  }

  /**
   * Persists the workflow state to the database
   */
  async #persistWorkflowSnapshot() {
    const snapshotFromActor = this.#actor?.getPersistedSnapshot();

    if (!this.#mastra?.storage) {
      this.logger.debug('Snapshot cannot be persisted. Mastra engine is not initialized', {
        runId: this.#runId,
      });
      return;
    }

    if (!snapshotFromActor) {
      this.logger.debug('Snapshot cannot be persisted. No snapshot received.', { runId: this.#runId });
      return;
    }

    if (this.#mastra?.storage) {
      await this.#mastra.storage.persistWorkflowSnapshot({
        workflowName: this.name,
        runId: this.#runId,
        snapshot: snapshotFromActor as unknown as WorkflowRunState,
      });
    }

    return this.#runId;
  }

  async #loadWorkflowSnapshot(runId: string) {
    if (!this.#mastra?.storage) {
      this.logger.debug('Snapshot cannot be loaded. Mastra engine is not initialized', { runId });
      return;
    }
    return this.#mastra.storage.loadWorkflowSnapshot({ runId, workflowName: this.name });
  }

  /**
   * Resolves variables for a step from trigger data or previous step results
   * @param stepConfig - Configuration of the step needing variable resolution
   * @param context - Current workflow context containing results and trigger data
   * @returns Object containing resolved variable values
   */
  #resolveVariables<
    TStepId extends TSteps[number]['id'],
    TSchemaIn extends z.ZodSchema,
    TSchemaOut extends z.ZodSchema,
  >({
    stepConfig,
    context,
    stepId,
  }: {
    stepConfig: StepDef<TStepId, TSteps, TSchemaIn, TSchemaOut>[TStepId];
    context: WorkflowContext;
    stepId: TStepId;
  }): Record<string, any> {
    this.logger.debug(`Resolving variables for step ${stepId}`, {
      stepId,
      runId: this.#runId,
    });

    const resolvedData: Record<string, any> = {
      ...context,
      getStepResult: ((stepId: string) => {
        if (stepId === 'trigger') {
          return context.triggerData;
        }
        const result = context.steps[stepId];
        if (result && result.status === 'success') {
          return result.output;
        }
        return undefined;
      }) as WorkflowContext<TTriggerSchema>['getStepResult'],
    };

    for (const [key, variable] of Object.entries(stepConfig.data)) {
      // Check if variable comes from trigger data or a previous step's result
      const sourceData =
        variable.step === 'trigger' ? context.triggerData : getStepResult(context.steps[variable.step.id]);

      this.logger.debug(
        `Got source data for ${key} variable from ${variable.step === 'trigger' ? 'trigger' : variable.step.id}`,
        {
          sourceData,
          path: variable.path,
          runId: this.#runId,
        },
      );

      if (!sourceData && variable.step !== 'trigger') {
        resolvedData[key] = undefined;
        continue;
      }

      // If path is empty or '.', return the entire source data
      const value = variable.path === '' || variable.path === '.' ? sourceData : get(sourceData, variable.path);

      this.logger.debug(`Resolved variable ${key}`, {
        value,
        runId: this.#runId,
      });

      resolvedData[key] = value;
    }

    return resolvedData;
  }

  /**
   * Evaluates a single condition against workflow context
   */
  #evaluateCondition<TStep extends StepVariableType<any, any, any, any>, TTriggerSchema extends z.ZodType<any>>(
    condition: StepCondition<TStep, TTriggerSchema>,
    context: WorkflowContext,
  ): boolean {
    let andBranchResult = true;
    let baseResult = true;
    let orBranchResult = true;

    // Base condition simplified format
    const simpleCondition = Object.entries(condition).find(([key]) => key.includes('.'));
    if (simpleCondition) {
      const [key, queryValue] = simpleCondition;
      const [stepId, ...pathParts] = key.split('.');
      const path = pathParts.join('.');

      const sourceData = stepId === 'trigger' ? context.triggerData : getStepResult(context.steps[stepId as string]);

      this.logger.debug(`Got condition data from step ${stepId}`, {
        stepId,
        sourceData,
        runId: this.#runId,
      });

      if (!sourceData) {
        return false;
      }

      let value = get(sourceData, path);

      // If path is 'status', check if value is empty and we are not referencing the trigger.
      // Currently only successful step results get to this point, so we can safely assume that the status is 'success'
      if (stepId !== 'trigger' && path === 'status' && !value) {
        value = 'success';
      }

      // Handle different types of queries
      if (typeof queryValue === 'object' && queryValue !== null) {
        // If it's an object, treat it as a query object
        baseResult = sift(queryValue)(value);
      } else {
        // For simple values, do an equality check
        baseResult = value === queryValue;
      }
    }

    // Base condition
    if ('ref' in condition) {
      const { ref, query } = condition;
      const sourceData = ref.step === 'trigger' ? context.triggerData : getStepResult(context.steps[ref.step.id]);

      this.logger.debug(`Got condition data from ${ref.step === 'trigger' ? 'trigger' : ref.step.id}`, {
        sourceData,
        runId: this.#runId,
      });

      if (!sourceData) {
        return false;
      }

      let value = get(sourceData, ref.path);

      // If path is 'status', check if value is empty and we are not referencing the trigger.
      // Currently only successful step results get to this point, so we can safely assume that the status is 'success'
      if (ref.step !== 'trigger' && ref.path === 'status' && !value) {
        value = 'success';
      }

      baseResult = sift(query)(value);
    }

    // AND condition
    if ('and' in condition) {
      andBranchResult = condition.and.every(cond => this.#evaluateCondition(cond, context));
      this.logger.debug(`Evaluated AND condition`, {
        andBranchResult,
        runId: this.#runId,
      });
    }

    // OR condition
    if ('or' in condition) {
      orBranchResult = condition.or.some(cond => this.#evaluateCondition(cond, context));
      this.logger.debug(`Evaluated OR condition`, {
        orBranchResult,
        runId: this.#runId,
      });
    }

    const finalResult = baseResult && andBranchResult && orBranchResult;

    this.logger.debug(`Evaluated condition`, {
      finalResult,
      runId: this.#runId,
    });

    return finalResult;
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
          // @ts-ignore
          return this.#mastra.telemetry.traceMethod(handler, {
            spanName,
            attributes,
          })(data);
        });
      };
    };

    const handler = async ({ context, ...rest }: ActionContext<TSteps[number]['inputSchema']>) => {
      const targetStep = this.#steps[stepId];
      if (!targetStep) throw new Error(`Step not found`);

      const { payload = {}, execute } = targetStep;

      // Merge static payload with dynamically resolved variables
      // Variables take precedence over payload values
      const mergedData = {
        ...(payload as {}),
        ...context,
      };

      // Only trace if telemetry is available and action exists
      const finalAction = this.#mastra?.telemetry
        ? executeStep(execute, `workflow.${this.name}.action.${stepId}`, {
            componentName: this.name,
            runId: context.runId ?? this.#runId,
          })
        : execute;

      return finalAction ? await finalAction({ context: mergedData, ...rest }) : {};
    };

    // Only trace handler if telemetry is available

    const finalHandler = ({ context, ...rest }: ActionContext<TSteps[number]['inputSchema']>) => {
      if (this.#executionSpan) {
        return executeStep(handler, `workflow.${this.name}.step.${stepId}`, {
          componentName: this.name,
          runId: context.runId ?? this.#runId,
        })({ context, ...rest });
      }

      return handler({ context, ...rest });
    };

    return {
      handler: finalHandler,
      data: {},
    };
  }

  /**
   * Creates a map of step IDs to their respective delay values
   * @returns Object mapping step IDs to delay values
   */
  #makeDelayMap() {
    const delayMap: Record<string, number> = {};

    Object.keys(this.#steps).forEach(stepId => {
      delayMap[stepId] = this.#steps[stepId]?.retryConfig?.delay || this.#retryConfig?.delay || 1000;
    });

    return delayMap;
  }

  /**
   * Cleans up the actor instance
   */
  #cleanup() {
    if (this.#actor) {
      this.#actor.stop();
      this.#actor = null;
    }
  }

  #getActivePathsAndStatus(value: Record<string, any>): Array<{
    stepPath: string[];
    stepId: string;
    status: string;
  }> {
    const paths: Array<{
      stepPath: string[];
      stepId: string;
      status: string;
    }> = [];

    const traverse = (current: Record<string, any>, path: string[] = []) => {
      for (const [key, value] of Object.entries(current)) {
        const currentPath = [...path, key];

        if (typeof value === 'string') {
          // Found a leaf state
          paths.push({
            stepPath: currentPath,
            stepId: key,
            status: value,
          });
        } else if (typeof value === 'object' && value !== null) {
          // Continue traversing
          traverse(value, currentPath);
        }
      }
    };

    traverse(value);
    return paths;
  }

  async getState(runId: string): Promise<WorkflowRunState | null> {
    // If this is the currently running workflow
    if (this.#runId === runId && this.#actor) {
      const snapshot = this.#actor.getSnapshot();
      const m = this.#getActivePathsAndStatus(snapshot.value as Record<string, any>);
      return {
        runId,
        value: snapshot.value as Record<string, string>,
        context: snapshot.context,
        activePaths: m,
        timestamp: Date.now(),
      };
    }

    // If workflow is suspended/stored, get from storage
    const storedSnapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
      runId,
      workflowName: this.name,
    });

    if (storedSnapshot) {
      const parsed = storedSnapshot;

      const m = this.#getActivePathsAndStatus(parsed.value);

      return {
        runId,
        value: parsed.value,
        context: parsed.context,
        activePaths: m,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  watch(onTransition: (state: WorkflowRunState) => void): () => void {
    this.#onStepTransition.add(onTransition);

    return () => {
      this.#onStepTransition.delete(onTransition);
    };
  }

  async resume({
    runId,
    stepId,
    context: resumeContext,
  }: {
    runId: string;
    stepId: string;
    context?: Record<string, any>;
  }) {
    const snapshot = await this.#loadWorkflowSnapshot(runId);

    if (!snapshot) {
      throw new Error(`No snapshot found for workflow run ${runId}`);
    }

    let parsedSnapshot;
    try {
      parsedSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot as unknown as string) : snapshot;
    } catch (error) {
      this.logger.debug('Failed to parse workflow snapshot for resume', { error, runId });
      throw new Error('Failed to parse workflow snapshot');
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

    // Helper to find and update the step in the hierarchy
    const updateStepInHierarchy = (value: Record<string, any>, targetStepId: string): Record<string, any> => {
      const result: Record<string, any> = {};

      for (const key of Object.keys(value)) {
        const currentValue = value[key];

        if (key === targetStepId) {
          // Found our target step, set it to pending
          result[key] = 'pending';
        } else if (typeof currentValue === 'object' && currentValue !== null) {
          // Recurse into nested states
          result[key] = updateStepInHierarchy(currentValue, targetStepId);
        } else {
          // Keep other states as is
          result[key] = currentValue;
        }
      }

      return result;
    };

    parsedSnapshot.value = updateStepInHierarchy(parsedSnapshot.value, stepId);

    // Reset attempt count
    if (parsedSnapshot.context?.attempts) {
      parsedSnapshot.context.attempts[stepId] =
        this.#steps[stepId]?.retryConfig?.attempts || this.#retryConfig?.attempts || 3;
    }

    this.logger.debug('Resuming workflow with updated snapshot', {
      updatedSnapshot: parsedSnapshot,
      runId,
      stepId,
    });

    return this.execute({
      snapshot: parsedSnapshot,
      runId,
      stepId,
    });
  }
  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }

    this.#mastra = p;
  }

  get stepGraph() {
    return this.#stepGraph;
  }

  get stepSubscriberGraph() {
    return this.#stepSubscriberGraph;
  }

  get steps() {
    return this.#steps;
  }
}

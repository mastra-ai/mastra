import { get } from 'radash';
import sift from 'sift';
import { assign, createActor, fromPromise, setup, Snapshot } from 'xstate';
import { z } from 'zod';

import { IAction, MastraPrimitives } from '../action';
import { MastraBase } from '../base';
import { FilterOperators } from '../engine';
import { LogLevel } from '../logger';

import { Step } from './step';
import {
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
  WorkflowState,
} from './types';
import { getStepResult, isErrorEvent, isTransitionEvent, isVariableReference } from './utils';

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

  #connectionId = `WORKFLOWS`;
  #entityName = `__workflows__`;

  // registers stepIds on `after` calls
  #afterStepStack: string[] = [];
  #lastStepStack: string[] = [];
  #stepGraph: StepGraph = { initial: [] };
  #stepSubscriberGraph: Record<string, StepGraph> = {};
  #steps: Record<string, IAction<any, any, any, any>> = {};

  /**
   * Creates a new Workflow instance
   * @param name - Identifier for the workflow (not necessarily unique)
   * @param logger - Optional logger instance
   */
  constructor({
    name,
    triggerSchema,
    retryConfig,
    mastra,
  }: {
    name: string;
    triggerSchema?: TTriggerSchema;
    retryConfig?: RetryConfig;
    mastra?: MastraPrimitives;
  }) {
    super({ component: 'WORKFLOW', name });

    this.name = name;
    this.#retryConfig = retryConfig || { attempts: 3, delay: 1000 };
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
        context: Omit<WorkflowContext, 'getStepPayload'>;
        input: Omit<WorkflowContext, 'getStepPayload'>;
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
  async execute({
    triggerData,
    loadSnapshot,
  }: {
    triggerData?: z.infer<TTriggerSchema>;
    loadSnapshot?: { runId: string };
  } = {}): Promise<{
    triggerData?: z.infer<TTriggerSchema>;
    results: Record<string, StepResult<any>>;
    runId: string;
  }> {
    let snapshot: Snapshot<any> | undefined;

    if (loadSnapshot && loadSnapshot.runId) {
      snapshot = await this.#loadWorkflowSnapshot(loadSnapshot.runId);
    } else {
      this.#runId = crypto.randomUUID();
    }

    if (snapshot) {
      snapshot = JSON.parse(snapshot as unknown as string);
    }

    this.log(LogLevel.INFO, 'Executing workflow', { triggerData, runId: this.#runId });

    if (this.triggerSchema) {
      try {
        this.triggerSchema.parse(triggerData);
        this.log(LogLevel.DEBUG, 'Trigger schema validation passed', { runId: this.#runId });
      } catch (error) {
        this.log(LogLevel.ERROR, 'Trigger schema validation failed', {
          error,
          runId: this.#runId,
        });
        throw error;
      }
    }

    this.#actor = createActor(this.#machine, {
      input: {
        stepResults: {},
        triggerData: triggerData || {},
        attempts: Object.keys(this.#steps).reduce(
          (acc, stepKey) => {
            acc[stepKey] = this.#steps[stepKey]?.retryConfig?.attempts || this.#retryConfig?.attempts || 3;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      snapshot,
    });

    this.#actor.start();

    return new Promise((resolve, reject) => {
      if (!this.#actor) {
        reject(new Error('Actor not initialized'));
        return;
      }

      this.#actor.subscribe(state => {
        // Check if all parallel states are in a final state
        const allStatesValue = state.value as Record<string, string>;
        const allStatesComplete = this.#recursivelyCheckForFinalState(allStatesValue);

        if (allStatesComplete) {
          // Check if any steps failed
          const allStepsFailed = Object.values(state.context.stepResults).every(result => result.status === 'failed');
          const hasSuspended = Object.values(state.context.stepResults).some(result => result.status === 'suspended');

          if (hasSuspended) {
            this.#persistWorkflowSnapshot();
          }

          if (allStepsFailed) {
            this.log(LogLevel.ERROR, 'Workflow failed', {
              results: state.context.stepResults,
              runId: this.#runId,
            });
            this.#cleanup();
            resolve({
              triggerData,
              results: state.context.stepResults,
              runId: this.#runId,
            });
          } else {
            this.log(LogLevel.INFO, 'Workflow completed', {
              results: state.context.stepResults,
              runId: this.#runId,
            });
            this.#cleanup();
            resolve({
              triggerData,
              results: state.context.stepResults,
              runId: this.#runId,
            });
          }
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

  #recursivelyCheckForFinalState(value: string | Record<string, string>): boolean {
    if (typeof value === 'string') {
      return ['completed', 'failed', 'suspended'].includes(value);
    }
    return Object.values(value).every(val => this.#recursivelyCheckForFinalState(val));
  }

  #buildBaseState(stepNode: StepNode, nextSteps: StepNode[] = []): any {
    // NOTE: THIS CLEARS THE STEPGRAPH :: no concequences for now
    const nextStep = nextSteps.shift();

    return {
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'dependencyCheck',
            input: ({ context }: { context: WorkflowContext }) => ({
              context,
              stepNode,
            }),
            onDone: [
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'SUSPENDED';
                },
                target: 'suspended',
                actions: assign({
                  stepResults: ({ context, event }) => {
                    if (event.output.type !== 'SUSPENDED') return context.stepResults;
                    return {
                      ...context.stepResults,
                      [stepNode.step.id]: {
                        status: 'suspended',
                      },
                    };
                  },
                }),
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'DEPENDENCIES_MET';
                },
                target: 'executing',
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'DEPENDENCIES_NOT_MET';
                },
                target: 'waiting',
                actions: [{ type: 'decrementAttemptCount', params: { stepId: stepNode.step.id } }],
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'TIMED_OUT';
                },
                target: 'failed',
                actions: assign({
                  stepResults: ({ context, event }) => {
                    if (event.output.type !== 'TIMED_OUT') return context.stepResults;

                    this.log(LogLevel.ERROR, `Step:${stepNode.step.id} timed out`, {
                      error: event.output.error,
                    });

                    return {
                      ...context.stepResults,
                      [stepNode.step.id]: {
                        status: 'failed',
                        error: event.output.error,
                      },
                    };
                  },
                }),
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'CONDITION_FAILED';
                },
                target: 'failed',
                actions: assign({
                  stepResults: ({ context, event }) => {
                    if (event.output.type !== 'CONDITION_FAILED') return context.stepResults;

                    this.log(LogLevel.ERROR, `workflow condition check failed`, {
                      error: event.output.error,
                      stepId: stepNode.step.id,
                    });

                    return {
                      ...context.stepResults,
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
            this.log(LogLevel.INFO, `Step ${stepNode.step.id} waiting ${new Date().toISOString()}`);
          },
          exit: () => {
            this.log(LogLevel.INFO, `Step ${stepNode.step.id} finished waiting ${new Date().toISOString()}`);
          },
          after: {
            [stepNode.step.id]: {
              target: 'pending',
            },
          },
        },
        executing: {
          entry: () => {
            this.log(LogLevel.INFO, `Step ${stepNode.step.id} executing`);
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
                  this.log(LogLevel.INFO, `Step ${stepNode.step.id} finished executing`, { output: event.output }),
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
            this.log(LogLevel.INFO, `Step ${stepNode.step.id} running subscribers`);
          },
          exit: () => {
            this.log(LogLevel.INFO, `Step ${stepNode.step.id} finished running subscribers`);
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
                  stepResults: ({ context, event }) => ({
                    ...context.stepResults,
                    ...event.output.stepResults,
                  }),
                }),
                () => this.log(LogLevel.DEBUG, `Subscriber execution completed`, { stepId: stepNode.step.id }),
              ],
            },
            onError: {
              target: nextStep ? nextStep.step.id : 'completed',
              actions: ({ event }: { context: WorkflowContext; event: any }) => {
                this.log(LogLevel.ERROR, `Subscriber execution failed`, {
                  error: event.error,
                  stepId: stepNode.step.id,
                });
              },
            },
          },
        },
        completed: {
          type: 'final',
          entry: [{ type: 'notifyStepCompletion', params: { stepId: stepNode.step.id } }],
        },
        failed: {
          type: 'final',
          entry: [{ type: 'notifyStepCompletion', params: { stepId: stepNode.step.id } }],
        },
        suspended: {
          entry: [{ type: 'notifyStepCompletion', params: { stepId: stepNode.step.id } }],
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
        stepResults: ({ context, event }) => {
          if (!isTransitionEvent(event)) return context.stepResults;

          const { stepId, result } = event.output as ResolverFunctionOutput;

          return {
            ...context.stepResults,
            [stepId]: {
              status: 'success' as const,
              payload: result,
            },
          };
        },
      }),
      setStepError: assign({
        stepResults: ({ context, event }, params: WorkflowActionParams) => {
          if (!isErrorEvent(event)) return context.stepResults;

          const { stepId } = params;

          if (!stepId) return context.stepResults;

          return {
            ...context.stepResults,
            [stepId]: {
              status: 'failed' as const,
              error: event.error.message,
            },
          };
        },
      }),
      notifyStepCompletion: (_: any, params: WorkflowActionParams) => {
        const { stepId } = params;
        this.log(LogLevel.INFO, `Step ${stepId} completed`);
      },
      decrementAttemptCount: assign({
        attempts: ({ context, event }, params: WorkflowActionParams) => {
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

        this.log(LogLevel.DEBUG, `Resolved variables for ${stepNode.step.id}`, {
          resolvedData,
          runId: this.#runId,
        });

        const result = await stepNode.config.handler({
          context: {
            machineContext: context,
            ...resolvedData,
          },
          ...injectables,
        });

        this.log(LogLevel.DEBUG, `Step ${stepNode.step.id} result`, {
          result,
          runId: this.#runId,
        });

        return {
          stepId: stepNode.step.id,
          result,
        };
      }),
      dependencyCheck: fromPromise(async ({ input }: { input: { context: WorkflowContext; stepNode: StepNode } }) => {
        const { context, stepNode } = input;

        const stepConfig = stepNode.config;

        // TODO: Need a way to create unique ids for steps
        const attemptCount = context.attempts[stepNode.step.id];

        if (!attemptCount || attemptCount < 0) {
          if (stepConfig?.snapshotOnTimeout) {
            return { type: 'SUSPENDED' as const, stepId: stepNode.step.id };
          }
          return { type: 'TIMED_OUT' as const, error: `Step:${stepNode.step.id} timed out` };
        }

        if (!stepConfig?.when) {
          return { type: 'DEPENDENCIES_MET' as const };
        }

        // All dependencies available, check conditions
        if (typeof stepConfig?.when === 'function') {
          const conditionMet = await stepConfig.when({ context });
          if (!conditionMet) {
            return {
              type: 'CONDITION_FAILED' as const,
              error: `Step:${stepNode.step.id} condition function check failed`,
            };
          }
        } else {
          const conditionMet = this.#evaluateCondition(stepConfig.when, context);
          if (!conditionMet) {
            return {
              type: 'CONDITION_FAILED' as const,
              error: `Step:${stepNode.step.id} condition check failed`,
            };
          }
        }
        return { type: 'DEPENDENCIES_MET' as const };
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

          if (!stepGraph) return { stepResults: {} };

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
            actor.subscribe(state => {
              const allStatesValue = state.value as Record<string, string>;
              const allStatesComplete = this.#recursivelyCheckForFinalState(allStatesValue);

              if (allStatesComplete) {
                actor.stop();
                resolve({
                  stepResults: state.context.stepResults,
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
    if (!this.#mastra) return;

    const engine = this.#mastra.engine;

    if (!engine) return;

    const snapshot = this.#actor?.getPersistedSnapshot();

    if (!snapshot) return;

    await engine.syncRecords({
      name: this.#entityName,
      connectionId: this.#connectionId,
      records: [
        {
          externalId: this.#runId,
          data: { snapshot: JSON.stringify(snapshot) },
        },
      ],
    });

    return this.#runId;
  }

  async #loadWorkflowSnapshot(runId: string) {
    if (!this.#mastra) return;

    const engine = this.#mastra.engine;

    if (!engine) return;

    const state = await engine.getRecords({
      entityName: this.#entityName,
      connectionId: this.#connectionId,
      options: {
        filters: [{ field: 'externalId', value: runId, operator: FilterOperators.EQUAL }],
      },
    });

    return state[0]?.data.snapshot;
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
    const resolvedData: Record<string, any> = {};

    this.log(LogLevel.DEBUG, `Resolving variables for ${stepId}`, {
      runId: this.#runId,
    });

    // Add machineContext with getStepPayload helper
    resolvedData.machineContext = {
      ...context,
      getStepPayload: ((stepId: string) => {
        if (stepId === 'trigger') {
          return context.triggerData;
        }
        const result = context.stepResults[stepId];
        if (result && result.status === 'success') {
          return result.payload;
        }
        return undefined;
      }) as WorkflowContext<TTriggerSchema>['getStepPayload'],
    };

    for (const [key, variable] of Object.entries(stepConfig.data)) {
      // Check if variable comes from trigger data or a previous step's result
      const sourceData =
        variable.step === 'trigger' ? context.triggerData : getStepResult(context.stepResults[variable.step.id]);

      this.log(
        LogLevel.DEBUG,
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

      this.log(LogLevel.DEBUG, `Resolved variable ${key}`, {
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

      const sourceData =
        stepId === 'trigger' ? context.triggerData : getStepResult(context.stepResults[stepId as string]);

      this.log(LogLevel.DEBUG, `Got condition data from ${stepId}`, {
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
      const sourceData = ref.step === 'trigger' ? context.triggerData : getStepResult(context.stepResults[ref.step.id]);

      this.log(LogLevel.DEBUG, `Got condition data from ${ref.step === 'trigger' ? 'trigger' : ref.step.id}`, {
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
      this.log(LogLevel.DEBUG, `Evaluated AND condition`, {
        andBranchResult,
        runId: this.#runId,
      });
    }

    // OR condition
    if ('or' in condition) {
      orBranchResult = condition.or.some(cond => this.#evaluateCondition(cond, context));
      this.log(LogLevel.DEBUG, `Evaluated OR condition`, {
        orBranchResult,
        runId: this.#runId,
      });
    }

    const finalResult = baseResult && andBranchResult && orBranchResult;

    this.log(LogLevel.DEBUG, `Evaluated condition`, {
      finalResult,
      runId: this.#runId,
    });

    return finalResult;
  }

  #makeStepDef<TStepId extends TSteps[number]['id'], TSteps extends Step<any, any, any>[]>(
    stepId: TStepId,
  ): StepDef<TStepId, TSteps, any, any>[TStepId] {
    const telemetry = this.#mastra?.telemetry;

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
      const finalAction = telemetry
        ? telemetry.traceMethod(execute, {
            spanName: `workflow.${this.name}.action.${stepId}`,
          })
        : execute;

      return finalAction ? await finalAction({ context: mergedData, ...rest }) : {};
    };

    // Only trace handler if telemetry is available
    const finalHandler = telemetry
      ? telemetry.traceMethod(handler, {
          spanName: `workflow.${this.name}.step.${stepId}`,
        })
      : handler;

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

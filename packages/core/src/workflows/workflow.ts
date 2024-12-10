import { get } from 'radash';
import sift from 'sift';
import { setup, createActor, assign, fromPromise, Snapshot } from 'xstate';
import { z } from 'zod';

import { FilterOperators, MastraEngine } from '../engine';
import { Logger, RegisteredLogger, LogLevel } from '../logger';
import { Telemetry } from '../telemetry';

import { Step } from './step';
import {
  StepDef,
  WorkflowLogMessage,
  WorkflowContext,
  StepId,
  StepConfig,
  StepCondition,
  WorkflowEvent,
  WorkflowActions,
  WorkflowActors,
  ResolverFunctionOutput,
  ResolverFunctionInput,
  WorkflowState,
  StepResult,
  DependencyCheckOutput,
  WorkflowActionParams,
  RetryConfig,
  StepGraph,
} from './types';
import { getStepResult, isErrorEvent, isTransitionEvent, isVariableReference } from './utils';

export class Workflow<TSteps extends Step<any, any, any>[] = any, TTriggerSchema extends z.ZodType<any> = any> {
  name: string;
  #logger?: Logger<WorkflowLogMessage>;
  #triggerSchema?: TTriggerSchema;
  #steps: TSteps;
  #stepConfiguration: StepDef<any, TSteps, any, any> = {};
  /** XState machine instance that orchestrates the workflow execution */
  #machine!: ReturnType<typeof this.initializeMachine>;
  /** XState actor instance that manages the workflow execution */
  #actor: ReturnType<typeof createActor<ReturnType<typeof this.initializeMachine>>> | null = null;
  #runId: string;
  #retryConfig?: RetryConfig;
  #engine?: MastraEngine;
  #connectionId = `WORKFLOWS`;
  #entityName = `__workflows__`;
  #telemetry?: Telemetry;

  // registers stepIds on `after` calls
  // #afterStepStack: string[] = [];
  #lastStepStack: string[] = [];
  #stepGraph: StepGraph = { initial: [] };
  // #delimiter = '-([-]::[-])-';
  #steps2: Record<string, Step<any, any, any>> = {};

  /**
   * Creates a new Workflow instance
   * @param name - Identifier for the workflow (not necessarily unique)
   * @param logger - Optional logger instance
   */
  constructor({
    name,
    steps,
    logger,
    engine,
    triggerSchema,
    retryConfig,
    telemetry,
  }: {
    name: string;
    logger?: Logger<WorkflowLogMessage>;
    engine?: MastraEngine;
    steps: TSteps;
    triggerSchema?: TTriggerSchema;
    retryConfig?: RetryConfig;
    telemetry?: Telemetry;
  }) {
    this.name = name;
    this.#logger = logger;
    this.#steps = steps;
    this.#retryConfig = retryConfig || { attempts: 3, delay: 1000 };
    this.#triggerSchema = triggerSchema;
    this.#runId = crypto.randomUUID();
    this.#telemetry = telemetry;
    this.#engine = engine;
    this.initializeMachine();

    // Initialize step definitions
    steps.forEach(step => {
      this.#stepConfiguration[step.id] = {
        ...this.#makeStepDef(step.id),
      };
    });
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
        context: WorkflowContext;
        input: WorkflowContext;
        events: WorkflowEvent;
        actions: WorkflowActions;
        actors: WorkflowActors;
      },
      delays: this.#makeDelayMap(),
      actions: {
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
        notifyStepCompletion: (_, params: WorkflowActionParams) => {
          const { stepId } = params;
          this.#log(LogLevel.INFO, `Step ${stepId} completed`);
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
      },
      actors: {
        resolverFunction: fromPromise(async ({ input }: { input: ResolverFunctionInput }) => {
          const { step, context, stepId } = input;
          const resolvedData = this.#resolveVariables({ stepConfig: step, context });
          const result = await step?.handler({
            data: resolvedData,
            runId: this.#runId,
          });

          return {
            stepId,
            result,
          };
        }),
        dependencyCheck: fromPromise(async ({ input }: { input: { context: WorkflowContext; stepId: string } }) => {
          const { context, stepId } = input;

          const stepConfig = this.#stepConfiguration[stepId];

          const attemptCount = context.attempts[stepId];

          if (!attemptCount || attemptCount < 0) {
            if (stepConfig?.snapshotOnTimeout) {
              return { type: 'SUSPENDED' as const, stepId };
            }
            return { type: 'TIMED_OUT' as const, error: `Step:${stepId} timed out` };
          }

          // Check dependencies are present and valid
          const missingDeps = stepConfig?.dependsOn.filter(depId => !(depId in context.stepResults));
          const suspendedDeps = stepConfig?.dependsOn.filter(
            depId => context.stepResults[depId]?.status === 'suspended',
          );

          if (suspendedDeps?.length && suspendedDeps.length > 0) {
            return { type: 'SUSPENDED' as const, stepId, missingDeps: suspendedDeps };
          }

          if (missingDeps?.length && missingDeps.length > 0) {
            return { type: 'DEPENDENCIES_NOT_MET' as const };
          }

          const failedDeps = stepConfig?.dependsOn.filter(
            depId =>
              context.stepResults[depId]?.status === 'failed' || context.stepResults[depId]?.status === 'skipped',
          );

          if (failedDeps?.length && failedDeps.length > 0) {
            return {
              type: 'SKIP_STEP' as const,
              missingDeps: failedDeps,
            };
          }

          // All dependencies available, check conditions
          if (stepConfig?.condition) {
            const conditionMet = this.#evaluateCondition(stepConfig.condition, context);
            if (!conditionMet) {
              return {
                type: 'CONDITION_FAILED' as const,
                error: `Step:${stepId} condition check failed`,
              };
            }
          }

          // Check custom condition function if present
          if (stepConfig?.conditionFn) {
            const conditionMet = await stepConfig.conditionFn({ context });
            if (!conditionMet) {
              return {
                type: 'CONDITION_FAILED' as const,
                error: `Step:${stepId} condition function check failed`,
              };
            }
          }

          return { type: 'DEPENDENCIES_MET' as const };
        }),
      },
    }).createMachine({
      id: this.name,
      type: 'parallel',
      context: ({ input }) => ({
        ...input,
      }),
      states: this.#buildStateHierarchy() as any,
    });

    this.#machine = machine;
    return machine;
  }

  step(step: Step<any, any, any>, config: StepConfig<any, any>) {
    const { variables = {}, dependsOn, condition, conditionFn } = config;

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }
    const stepKey = this.#makeStepKey(step);

    const graphEntry = {
      step,
      config: {
        ...this.#makeStepDef(stepKey),
        dependsOn,
        condition,
        conditionFn,
        data: requiredData,
      },
    };

    this.#steps2[stepKey] = step;

    if (!this.#stepGraph[stepKey]) this.#stepGraph[stepKey] = [];

    this.#stepGraph.initial.push(graphEntry);
    this.#lastStepStack.push(stepKey);

    return this;
  }

  then(step: Step<any, any, any>) {
    const lastStepKey = this.#lastStepStack[this.#lastStepStack.length - 1];
    const stepKey = this.#makeStepKey(step);

    this.#stepConfiguration[stepKey] = {
      ...this.#makeStepDef(stepKey),
    };

    this.#steps2[stepKey] = step;
    // if then is called without a step, we are done
    if (!lastStepKey) return this;

    // add the step to the graph if not already there.. it should be there though, unless magic
    if (!this.#stepGraph[lastStepKey]) this.#stepGraph[lastStepKey] = [];

    // add the step to the graph
    this.#stepGraph[lastStepKey].push(stepKey);

    return this;
  }

  /**
   * Configures a step in the workflow
   * @param id - Unique identifier for the step
   * @param config - Step configuration including handler, schema, variables, and payload
   * @returns this instance for method chaining
   */
  config<TStepId extends TSteps[number]['id']>(id: TStepId, config: StepConfig<TStepId, TSteps>) {
    const { variables = {}, dependsOn, condition, conditionFn } = config;

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }

    this.#stepConfiguration[id] = {
      ...this.#makeStepDef(id),
      dependsOn,
      condition,
      conditionFn,
      data: requiredData,
    };

    return this;
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

    await this.#log(LogLevel.INFO, 'Executing workflow', { triggerData });

    if (this.#triggerSchema) {
      try {
        this.#triggerSchema.parse(triggerData);
        await this.#log(LogLevel.DEBUG, 'Trigger schema validation passed');
      } catch (error) {
        await this.#log(LogLevel.ERROR, 'Trigger schema validation failed', {
          error,
        });
        throw error;
      }
    }

    this.#actor = createActor(this.#machine, {
      input: {
        stepResults: {},
        triggerData: triggerData || {},
        attempts: Object.keys(this.#steps2).reduce(
          (acc, stepKey) => {
            acc[stepKey] = this.#steps2[stepKey]?.retryConfig?.attempts || this.#retryConfig?.attempts || 3;
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
          const hasFailures = Object.values(state.context.stepResults).some(result => result.status === 'failed');
          const hasSuspended = Object.values(state.context.stepResults).some(result => result.status === 'suspended');

          if (hasSuspended) {
            this.#persistWorkflowSnapshot();
          }

          if (hasFailures) {
            this.#log(LogLevel.ERROR, 'Workflow failed', {
              results: state.context.stepResults,
            });
            this.#cleanup();
            resolve({
              triggerData,
              results: state.context.stepResults,
              runId: this.#runId,
            });
          } else {
            this.#log(LogLevel.INFO, 'Workflow completed', {
              results: state.context.stepResults,
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
      return ['completed', 'failed', 'skipped', 'suspended'].includes(value);
    }
    return Object.values(value).some(val => this.#recursivelyCheckForFinalState(val));
  }

  #buildBaseState(stepKey: string, nextSteps: string[] = []): any {
    // NOTE: THIS CLEARS THE STEPGRAPH
    const nextStep = nextSteps.shift();

    return {
      initial: 'pending',
      entry: ({ context }: { context: WorkflowContext }) => {
        console.log({ stepKey, context }, 'entry =============================');
      },
      exit: ({ context }: { context: WorkflowContext }) => {
        console.log({ stepKey, context }, 'exit =============================');
      },
      states: {
        pending: {
          invoke: {
            src: 'dependencyCheck',
            input: ({ context }: { context: WorkflowContext }) => ({
              context,
              stepId: stepKey,
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
                      [stepKey]: {
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
                actions: [{ type: 'decrementAttemptCount', params: { stepId: stepKey } }],
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'SKIP_STEP';
                },
                target: 'skipped',
                actions: assign({
                  stepResults: ({ context, event }) => {
                    if (event.output.type !== 'SKIP_STEP') return context.stepResults;
                    return {
                      ...context.stepResults,
                      [stepKey]: {
                        status: 'skipped',
                        missingDeps: event.output.missingDeps,
                      },
                    };
                  },
                }),
              },
              {
                guard: ({ event }: { event: { output: DependencyCheckOutput } }) => {
                  return event.output.type === 'TIMED_OUT';
                },
                target: 'failed',
                actions: assign({
                  stepResults: ({ context, event }) => {
                    if (event.output.type !== 'TIMED_OUT') return context.stepResults;

                    this.#log(LogLevel.ERROR, `Step:${stepKey} timed out`, {
                      error: event.output.error,
                    });

                    return {
                      ...context.stepResults,
                      [stepKey]: {
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

                    this.#log(LogLevel.ERROR, `workflow condition check failed`, {
                      error: event.output.error,
                      stepId: stepKey,
                    });

                    return {
                      ...context.stepResults,
                      [stepKey]: {
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
            this.#log(LogLevel.INFO, `Step ${stepKey} waiting ${new Date().toISOString()}`);
          },
          exit: () => {
            this.#log(LogLevel.INFO, `Step ${stepKey} finished waiting ${new Date().toISOString()}`);
          },
          after: {
            [stepKey]: {
              target: 'pending',
            },
          },
        },
        executing: {
          invoke: {
            src: 'resolverFunction',
            input: ({ context }: { context: WorkflowContext }) => ({
              context,
              stepId: stepKey,
              step: this.#stepConfiguration[stepKey],
            }),
            onDone: {
              target: nextStep ? nextStep : 'completed',
              actions: [{ type: 'updateStepResult', params: { stepId: stepKey } }],
            },
            onError: {
              target: 'failed',
              actions: [{ type: 'setStepError', params: { stepId: stepKey } }],
            },
          },
        },
        completed: {
          type: 'final',
          entry: [{ type: 'notifyStepCompletion', params: { stepId: stepKey } }],
        },
        failed: {
          type: 'final',
          entry: [{ type: 'notifyStepCompletion', params: { stepId: stepKey } }],
        },
        skipped: {
          type: 'final',
          entry: [{ type: 'notifyStepCompletion', params: { stepId: stepKey } }],
        },
        suspended: {
          entry: [{ type: 'notifyStepCompletion', params: { stepId: stepKey } }],
        },
        // build chain of next steps recursively
        ...(nextStep ? { [nextStep]: { ...this.#buildBaseState(nextStep, nextSteps) } } : {}),
      },
    };
  }

  #makeStepKey(step: Step<any, any, any>) {
    // return `${step.id}${this.#delimiter}${Object.keys(this.#steps2).length}`;
    return `${step.id}`;
  }

  /**
   * Builds the state hierarchy for the workflow
   * @returns Object representing the state hierarchy
   */
  #buildStateHierarchy(): WorkflowState {
    const states: Record<string, any> = {};
    const stepKeys = Object.keys(this.#stepGraph);

    stepKeys.forEach(stepKey => {
      states[stepKey] = {
        ...this.#buildBaseState(stepKey, this.#stepGraph[stepKey]),
      };
    });

    return states;
  }

  /**
   * Persists the workflow state to the database
   */
  async #persistWorkflowSnapshot() {
    if (!this.#engine) return;

    const snapshot = this.#actor?.getPersistedSnapshot();

    if (!snapshot) return;

    await this.#engine.syncRecords({
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
    if (!this.#engine) return;

    const state = await this.#engine.getRecords({
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
  }: {
    stepConfig: StepDef<TStepId, TSteps, TSchemaIn, TSchemaOut>[TStepId];
    context: WorkflowContext;
  }): Record<string, any> {
    const resolvedData: Record<string, any> = {};

    for (const [key, variable] of Object.entries(stepConfig.data)) {
      // Check if variable comes from trigger data or a previous step's result
      const sourceData =
        variable.stepId === 'trigger' ? context.triggerData : getStepResult(context.stepResults[variable.stepId]);

      if (!sourceData && variable.stepId !== 'trigger') {
        resolvedData[key] = undefined;
        continue;
      }

      // If path is empty or '.', return the entire source data
      const value = variable.path === '' || variable.path === '.' ? sourceData[key] : get(sourceData, variable.path);

      resolvedData[key] = value;
    }

    return resolvedData;
  }

  /**
   * Evaluates a single condition against workflow context
   */
  #evaluateCondition(condition: StepCondition<any, any>, context: WorkflowContext): boolean {
    let andBranchResult = true;
    let baseResult = true;
    let orBranchResult = true;

    // Base condition
    if ('ref' in condition) {
      const { ref, query } = condition;
      const sourceData =
        ref.stepId === 'trigger' ? context.triggerData : getStepResult(context.stepResults[ref.stepId]);

      if (!sourceData) {
        return false;
      }

      const value = get(sourceData, ref.path);
      baseResult = sift(query)(value);
    }

    // AND condition
    if ('and' in condition) {
      andBranchResult = condition.and.every(cond => this.#evaluateCondition(cond, context));
    }

    // OR condition
    if ('or' in condition) {
      orBranchResult = condition.or.some(cond => this.#evaluateCondition(cond, context));
    }

    const finalResult = baseResult && andBranchResult && orBranchResult;
    return finalResult;
  }

  /**
   * Internal logging helper that formats and sends logs to the configured logger
   * @param level - Severity level of the log
   * @param message - Main log message
   * @param data - Optional data to include in the log
   * @param stepId - Optional ID of the step that generated the log
   */
  async #log(level: LogLevel, message: string, data?: any, stepId?: StepId) {
    if (!this.#logger) return;

    const logMessage: WorkflowLogMessage = {
      type: RegisteredLogger.WORKFLOW,
      message,
      workflowName: this.name,
      destinationPath: `workflows/${this.name}`,
      stepId,
      data,
      runId: this.#runId,
    };

    const logMethod = level.toLowerCase() as keyof Logger<WorkflowLogMessage>;

    await this.#logger[logMethod]?.(logMessage);
  }

  #makeStepDef<TStepId extends TSteps[number]['id'], TSteps extends Step<any, any, any>[]>(
    stepId: TStepId,
  ): StepDef<TStepId, TSteps, any, any>[TStepId] {
    const handler = async ({ data, runId }: { data: z.infer<TSteps[number]['inputSchema']>; runId: string }) => {
      const targetStep = this.#steps2[stepId];
      if (!targetStep) throw new Error(`Step not found`);

      const { inputSchema, payload, action } = targetStep;

      // Merge static payload with dynamically resolved variables
      // Variables take precedence over payload values
      const mergedData = {
        ...payload,
        ...data,
      } as z.infer<TSteps[number]['inputSchema']>;

      // Validate complete input data
      const validatedData = inputSchema ? inputSchema.parse(mergedData) : mergedData;

      // Only trace if telemetry is available and action exists
      const finalAction =
        action && this.#telemetry
          ? this.#telemetry.traceMethod(action, {
              spanName: `workflow.${this.name}.action.${stepId}`,
            })
          : action;

      return finalAction ? await finalAction({ data: validatedData, runId }) : {};
    };

    // Only trace handler if telemetry is available
    const finalHandler = this.#telemetry
      ? this.#telemetry.traceMethod(handler, {
          spanName: `workflow.${this.name}.step.${stepId}`,
        })
      : handler;

    return {
      dependsOn: [],
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

    this.#steps.forEach(step => {
      delayMap[step.id] = step?.retryConfig?.delay || this.#retryConfig?.delay || 1000;
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

  __registerEngine(engine?: MastraEngine) {
    this.#engine = engine;
  }

  __registerLogger(logger?: Logger<WorkflowLogMessage>) {
    this.#logger = logger;
  }

  __registerTelemetry(telemetry?: Telemetry) {
    this.#telemetry = telemetry;
  }

  get stepGraph() {
    return this.#stepGraph;
  }
}

import { get } from 'radash';
import sift from 'sift';
import { setup, createActor, assign, fromPromise } from 'xstate';
import { z } from 'zod';

import { Logger, RegisteredLogger, LogLevel } from '../logger';

import { Step } from './step';
import {
  StepConfig,
  WorkflowLogMessage,
  WorkflowContext,
  StepId,
  VariableReference,
  StepDefinition,
  StepCondition,
  ValidationError,
  WorkflowEvent,
  WorkflowActions,
  WorkflowActors,
  ResolverFunctionOutput,
  ResolverFunctionInput,
  WorkflowState,
  DependencyConfig,
  StepTransitionCondition,
  StepResult,
  DependencyCheckOutput,
  WorkflowActionParams,
} from './types';
import { isErrorEvent, isTransitionEvent } from './utils';

export class Workflow<TSteps extends Step<any, any, any>[] = any, TTriggerSchema extends z.ZodType<any> = any> {
  name: string;
  #logger?: Logger<WorkflowLogMessage>;
  #triggerSchema?: TTriggerSchema;
  #steps: TSteps;
  #transitions: StepConfig<any, TSteps, any, any> = {};
  /** XState machine instance that orchestrates the workflow execution */
  #machine!: ReturnType<typeof this.initializeMachine>;
  /** XState actor instance that manages the workflow execution */
  #actor: ReturnType<typeof createActor<ReturnType<typeof this.initializeMachine>>> | null = null;
  #runId: string;

  /**
   * Creates a new Workflow instance
   * @param name - Identifier for the workflow (not necessarily unique)
   * @param logger - Optional logger instance
   */
  constructor({
    name,
    steps,
    logger,
    triggerSchema,
  }: {
    name: string;
    logger?: Logger<WorkflowLogMessage>;
    steps: TSteps;
    triggerSchema?: TTriggerSchema;
  }) {
    this.name = name;
    this.#logger = logger;
    this.#steps = steps;
    this.#triggerSchema = triggerSchema;
    this.#runId = crypto.randomUUID();
    this.initializeMachine();
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
      delays: {
        CHECK_INTERVAL: 1000, // Default 1 second
      },
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
          console.log('notifyStepCompletion', { params }, '============');
          const { stepId } = params;
          this.#log(LogLevel.INFO, `Step ${stepId} completed`);
        },
      },
      actors: {
        resolverFunction: fromPromise(async ({ input }: { input: ResolverFunctionInput }) => {
          const { step, context, stepId } = input;
          const resolvedData = this.#resolveVariables(step, context);
          const result = await step.handler({
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
          const step = this.#transitions[stepId];

          if (!step?.dependsOn) {
            return { type: 'DEPENDENCIES_MET' as const };
          }

          const failedDeps = this.#getFailedDependencies(step, context);
          if (failedDeps.length > 0) {
            return {
              type: 'SKIP_STEP' as const,
              failedDependencies: failedDeps,
            };
          }

          // First check if all required dependencies are present
          if (Array.isArray(step.dependsOn.steps)) {
            const allStepsComplete = step.dependsOn.steps.every(depId => depId in context.stepResults);
            if (!allStepsComplete) {
              return { type: 'DEPENDENCIES_NOT_MET' as const };
            }
          } else {
            // Check if all referenced steps are complete
            const requiredSteps = Object.keys(step.dependsOn.steps);
            const allStepsComplete = requiredSteps.every(depId => depId in context.stepResults);
            if (!allStepsComplete) {
              return { type: 'DEPENDENCIES_NOT_MET' as const };
            }
          }

          // All dependencies are present, now check conditions
          const dependenciesMet = await this.#checkStepDependencies(step.dependsOn, context);

          if (!dependenciesMet) {
            return {
              type: 'CONDITION_FAILED' as const,
              error: `Step:${stepId} condition check failed`,
            };
          }

          return { type: 'DEPENDENCIES_MET' as const };
        }),
      },
    }).createMachine({
      id: this.name,
      type: 'parallel',
      context: ({ input }) => ({
        ...input,
        stepResults: {},
        error: null,
      }),
      states: this.#buildStateHierarchy() as any,
    });

    this.#machine = machine;
    return machine;
  }

  #getFailedDependencies(step: StepConfig<any, any, any, any>[number], context: WorkflowContext): string[] {
    if (!step.dependsOn) return [];

    const deps = Array.isArray(step.dependsOn.steps) ? step.dependsOn.steps : Object.keys(step.dependsOn.steps);

    return deps.filter(
      depId => context.stepResults[depId]?.status === 'failed' || context.stepResults[depId]?.status === 'skipped',
    );
  }

  async #checkStepDependencies<TStepId extends TSteps[number]['id'], TSteps extends Step<any, any, any>[]>(
    dependsOn: DependencyConfig<TStepId, TSteps>,
    context: WorkflowContext,
  ): Promise<boolean> {
    // Check array dependencies
    if (Array.isArray(dependsOn.steps)) {
      const allStepsComplete = dependsOn.steps.every(stepId => stepId in context.stepResults);
      if (!allStepsComplete) return false;
    } else {
      // Check transition conditions
      for (const [_, config] of Object.entries(dependsOn.steps)) {
        const condition = (config as StepTransitionCondition<TStepId, TSteps>)?.condition;
        const evalResult = condition && this.#evaluateCondition(condition, context);

        console.log({ evalResult, condition }, '============ evalResult');
        if (!evalResult) {
          console.log('DEPENDENCIES_NOT_MET ===========================', {
            context,
          });
          return false;
        }
      }
    }

    // Check custom condition function if provided
    if (dependsOn.conditionFn) {
      return await dependsOn.conditionFn(context);
    }

    return true;
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
    this.#validateWorkflow();
    this.initializeMachine();
    return this;
  }

  /**
   * Builds the state hierarchy for the workflow
   * @returns Object representing the state hierarchy
   */
  #buildStateHierarchy(): WorkflowState {
    const states: Record<string, any> = {};

    this.#steps.forEach(step => {
      states[step.id] = {
        initial: 'pending',
        states: {
          pending: {
            invoke: {
              src: 'dependencyCheck',
              input: ({ context }: { context: WorkflowContext }) => ({
                context,
                stepId: step.id,
              }),
              onDone: [
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
                        [step.id]: {
                          status: 'skipped',
                          failedDependencyIds: event.output.missingDeps,
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
                      console.log('CONDITION_FAILED', { event, context });
                      if (event.output.type !== 'CONDITION_FAILED') return context.stepResults;

                      return {
                        ...context.stepResults,
                        [step.id]: {
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
            entry: () => console.log('waiting============'),
            after: {
              CHECK_INTERVAL: {
                target: 'pending',
              },
            },
          },
          executing: {
            entry: () => console.log('executing ============'),
            invoke: {
              src: 'resolverFunction',
              input: ({ context }: { context: WorkflowContext }) => ({
                context,
                stepId: step.id,
                step: this.#transitions[step.id],
              }),
              onDone: {
                target: 'completed',
                actions: [{ type: 'updateStepResult', params: { stepId: step.id } }],
              },
              onError: {
                target: 'failed',
                actions: [{ type: 'setStepError', params: { stepId: step.id } }],
              },
            },
          },
          completed: {
            type: 'final',
            entry: [{ type: 'notifyStepCompletion', params: { stepId: step.id } }],
          },
          failed: {
            type: 'final',
            entry: [{ type: 'notifyStepCompletion', params: { stepId: step.id } }],
          },
          skipped: {
            type: 'final',
            entry: [{ type: 'notifyStepCompletion', params: { stepId: step.id } }],
          },
        },
      };
    });

    return states;
  }

  /**
   * Type guard to check if a value is a valid VariableReference
   * @param value - Value to check
   * @returns True if value is a VariableReference
   */
  #isVariableReference(value: any): value is VariableReference<any, any> {
    return typeof value === 'object' && 'stepId' in value && 'path' in value;
  }

  /**
   * Adds a new step to the workflow
   * @param id - Unique identifier for the step
   * @param config - Step configuration including handler, schema, variables, and payload
   * @returns this instance for method chaining (builder pattern baybyyyy)
   * @throws Error if step ID is duplicate or variable resolution fails
   */
  step<TStepId extends TSteps[number]['id']>(id: TStepId, config?: StepDefinition<TStepId, TSteps>) {
    const variables = config?.variables || {};
    const dependsOn = config?.dependsOn || undefined;

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && this.#isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }

    this.#transitions[id] = {
      dependsOn,
      data: requiredData,
      handler: async ({ data, runId }: { data: z.infer<TSteps[number]['inputSchema']>; runId: string }) => {
        const step = this.#steps.find(s => s.id === id);
        if (!step) throw new Error(`Step ${id} not found`);

        const { inputSchema, payload, action } = step;

        // Merge static payload with dynamically resolved variables
        // Variables take precedence over payload values
        const mergedData = {
          ...payload,
          ...data,
        } as z.infer<TSteps[number]['inputSchema']>;

        // Validate complete input data
        const validatedData = inputSchema ? inputSchema.parse(mergedData) : mergedData;

        return action ? action({ data: validatedData, runId }) : {};
      },
    };

    return this;
  }

  /**
   * Resolves variables for a step from trigger data or previous step results
   * @param stepConfig - Configuration of the step needing variable resolution
   * @param context - Current workflow context containing results and trigger data
   * @returns Object containing resolved variable values
   * @throws Error if variable resolution fails
   */
  #resolveVariables<
    TStepId extends TSteps[number]['id'],
    TSchemaIn extends z.ZodSchema,
    TSchemaOut extends z.ZodSchema,
  >(
    stepConfig: StepConfig<TStepId, TSteps, TSchemaIn, TSchemaOut>[TStepId],
    context: WorkflowContext,
  ): Record<string, any> {
    const resolvedData: Record<string, any> = {};

    for (const [key, variable] of Object.entries(stepConfig.data)) {
      // Check if variable comes from trigger data or a previous step's result
      const sourceData = variable.stepId === 'trigger' ? context.triggerData : context.stepResults[variable.stepId];

      if (!sourceData && variable.stepId !== 'trigger') {
        throw new Error(`Cannot resolve variable: Step ${variable.stepId} has not been executed yet`);
      }

      // If path is empty or '.', return the entire source data
      const value = variable.path === '' || variable.path === '.' ? sourceData[key] : get(sourceData, variable.path);

      if (value === undefined) {
        throw new Error(`Cannot resolve path "${variable.path}" from ${variable.stepId}`);
      }

      resolvedData[key] = value;
    }

    return resolvedData;
  }

  /**
   * Executes the workflow with the given trigger data
   * @param triggerData - Initial data to start the workflow with
   * @returns Promise resolving to workflow results or rejecting with error
   * @throws Error if trigger schema validation fails
   */
  async execute(triggerData?: z.infer<TTriggerSchema>): Promise<{
    triggerData?: z.infer<TTriggerSchema>;
    results: Record<string, StepResult<any>>;
    runId: string;
  }> {
    this.#runId = crypto.randomUUID();
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
      },
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
        const allStatesComplete = Object.values(allStatesValue).every(value =>
          ['completed', 'failed', 'skipped'].includes(value),
        );

        if (allStatesComplete) {
          // Check if any steps failed
          const hasFailures = Object.values(state.context.stepResults).some(result => result.status === 'failed');

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
   * Cleans up the actor instance
   */
  #cleanup() {
    if (this.#actor) {
      this.#actor.stop();
      this.#actor = null;
    }
  }

  /**
   * Evaluates a single condition against workflow context
   */
  #evaluateCondition(condition: StepCondition<any, any>, context: WorkflowContext): boolean {
    console.log('EVALUATING CONDITION', { condition, context });

    let andBranchResult = true;
    let baseResult = true;
    let orBranchResult = true;

    // Base condition
    if ('ref' in condition) {
      const { ref, query } = condition;
      const sourceData = ref.stepId === 'trigger' ? context.triggerData : context.stepResults[ref.stepId];

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
   * Validates the workflow for circular dependencies, terminal paths, and unreachable steps
   * @throws Error if validation fails
   */
  #validateWorkflow(): void {
    const errors: ValidationError[] = [
      // ...this.#detectCircularDependencies(),
      // ...this.#validateTerminalPaths(),
      // ...this.#detectUnreachableSteps(),
    ];

    if (errors.length > 0) {
      const errorMessages = errors.map(
        error =>
          `[${error.type}] ${error.message}${
            error.details.path ? ` (Path: ${error.details.path.join(' → ')})` : ''
          }${error.details.stepId ? ` (Step: ${error.details.stepId})` : ''}`,
      );
      throw new Error(`Workflow validation failed:\n${errorMessages.join('\n')}`);
    }
  }

  /**
   * Detects circular dependencies in the workflow
   * @returns Array of ValidationError objects
   */
  // #detectCircularDependencies(): ValidationError[] {
  //   const errors: ValidationError[] = [];
  //   const stack: StepId[] = [];

  //   const dfs = (stepId: StepId) => {
  //     if (stack.includes(stepId)) {
  //       // Found a cycle
  //       const cycleStartIndex = stack.indexOf(stepId);
  //       const cyclePath = [...stack.slice(cycleStartIndex), stepId];
  //       errors.push({
  //         type: 'circular_dependency',
  //         message: 'Circular dependency detected in workflow',
  //         details: { path: cyclePath },
  //       });
  //       return;
  //     }

  //     stack.push(stepId);

  //     const step = this.#transitions[stepId];
  //     if (step?.transitions) {
  //       Object.keys(step.transitions).forEach((targetId) => {
  //         dfs(targetId as StepId);
  //       });
  //     }

  //     stack.pop();
  //   };

  //   // Start DFS from first step
  //   if (this.#steps.length > 0) {
  //     dfs(this.#steps[0]!.id);
  //   }

  //   return errors;
  // }

  /**
   * Validates the workflow for terminal paths
   * @returns Array of ValidationError objects
   */
  // #validateTerminalPaths(): ValidationError[] {
  //   const errors: ValidationError[] = [];
  //   const visited = new Set<StepId>();
  //   const hasTerminalPath = new Set<StepId>();

  //   const dfs = (stepId: StepId, path: StepId[] = []): boolean => {
  //     if (hasTerminalPath.has(stepId)) return true;
  //     if (visited.has(stepId) && !hasTerminalPath.has(stepId)) return false;

  //     visited.add(stepId);

  //     const step = this.#transitions[stepId];
  //     if (!step) return false;

  //     // Terminal step
  //     if (!step.transitions) {
  //       hasTerminalPath.add(stepId);
  //       return true;
  //     }

  //     const transitions = Object.keys(step.transitions);
  //     if (transitions.length === 0) {
  //       hasTerminalPath.add(stepId);
  //       return true;
  //     }

  //     // Check if any transition leads to a terminal state
  //     const leadsToTerminal = transitions.some(
  //       (targetId) =>
  //         !path.includes(targetId as StepId) &&
  //         dfs(targetId as StepId, [...path, stepId])
  //     );

  //     if (leadsToTerminal) {
  //       hasTerminalPath.add(stepId);
  //     } else {
  //       errors.push({
  //         type: 'no_terminal_path',
  //         message: 'No path to terminal state found',
  //         details: {
  //           stepId,
  //           path: [...path, stepId],
  //         },
  //       });
  //     }

  //     return leadsToTerminal;
  //   };

  //   // Start from first step
  //   if (this.#steps.length > 0) {
  //     dfs(this.#steps[0]!.id);
  //   }

  //   return errors;
  // }

  /**
   * Detects unreachable steps in the workflow
   * @returns Array of ValidationError objects
   */
  // #detectUnreachableSteps(): ValidationError[] {
  //   const errors: ValidationError[] = [];
  //   const reachableSteps = new Set<StepId>();

  //   const dfs = (stepId: StepId) => {
  //     if (reachableSteps.has(stepId)) return;

  //     reachableSteps.add(stepId);
  //     const step = this.#transitions[stepId];

  //     if (step?.transitions) {
  //       Object.keys(step.transitions).forEach((targetId) => {
  //         dfs(targetId as StepId);
  //       });
  //     }
  //   };

  //   // Start from first step
  //   if (this.#steps.length > 0) {
  //     dfs(this.#steps[0]!.id);
  //   }

  //   // Find unreachable steps
  //   this.#steps.forEach((step) => {
  //     if (!reachableSteps.has(step.id)) {
  //       errors.push({
  //         type: 'unreachable_step',
  //         message: 'Step is not reachable from the initial step',
  //         details: { stepId: step.id },
  //       });
  //     }
  //   });

  //   return errors;
  // }
}

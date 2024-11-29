import sift from 'sift';
import { Logger, RegisteredLogger, LogLevel } from '../logger';
import { setup, createActor, assign, fromPromise } from 'xstate';
import { z } from 'zod';
import { get } from 'radash';

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
} from './types';
import { isErrorEvent, isTransitionEvent } from './utils';
import { Step } from './step';

export class Workflow<
  TSteps extends Step<any, any, any>[] = any,
  TTriggerSchema extends z.ZodType<any> = any,
> {
  name: string;
  #logger?: Logger<WorkflowLogMessage>;
  #triggerSchema?: TTriggerSchema;
  #steps: TSteps;
  #transitions: StepConfig<any, TSteps, any, any> = {};
  /** XState machine instance that orchestrates the workflow execution */
  #machine!: ReturnType<typeof this.initializeMachine>;
  /** XState actor instance that manages the workflow execution */
  #actor: ReturnType<
    typeof createActor<ReturnType<typeof this.initializeMachine>>
  > | null = null;
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
      actions: {
        updateStepResult: assign({
          stepResults: ({ context, event }) => {
            if (!isTransitionEvent(event)) return context.stepResults;

            const stepId = (event.output as ResolverFunctionOutput)
              ?.stepId as StepId;
            if (!stepId) return context.stepResults;

            this.#log(
              LogLevel.INFO,
              `Step ${stepId} completed`,
              event.output,
              stepId
            );

            const result = (event.output as ResolverFunctionOutput)?.result;
            if (result !== undefined) {
              const newResults = {
                ...context.stepResults,
                [stepId]: result,
              };

              // Get the step configuration
              const step = this.#transitions[stepId];

              // Evaluate transitions and send events
              if (step?.transitions) {
                const fullContext = { ...context, stepResults: newResults };

                let hasMatchingCondition = false;

                this.#log(
                  LogLevel.DEBUG,
                  'Evaluating transitions with context:',
                  fullContext
                );

                Object.entries(step.transitions).forEach(
                  ([targetId, config]) => {
                    this.#log(
                      LogLevel.DEBUG,
                      `Checking transition to: ${targetId}`
                    );
                    this.#log(
                      LogLevel.DEBUG,
                      `With condition: ${config?.condition}`
                    );
                    if (
                      !config?.condition ||
                      this.#evaluateCondition(config?.condition, fullContext)
                    ) {
                      hasMatchingCondition = true;
                      this.#log(
                        LogLevel.DEBUG,
                        'Condition passed, sending transition to:',
                        targetId
                      );
                      Promise.resolve().then(() => {
                        if (this.#actor) {
                          this.#actor.send({ type: `TRANSITION_${targetId}` });
                        }
                      });
                    }
                  }
                );
                // If no conditions matched, send the NO_MATCHING_CONDITIONS event
                if (!hasMatchingCondition) {
                  Promise.resolve().then(() => {
                    if (this.#actor) {
                      this.#actor.send({ type: 'NO_MATCHING_CONDITIONS' });
                    }
                  });
                }
              }

              return newResults;
            }

            return context.stepResults;
          },
        }),
        setError: assign({
          error: ({ event }) => {
            if (!isErrorEvent(event)) return null;
            this.#log(LogLevel.ERROR, `Workflow error`, event.error);
            return event.error;
          },
        }),
        initializeTriggerData: assign({
          triggerData: ({ context }) => {
            this.#log(LogLevel.INFO, 'Workflow started', context?.triggerData);
            return context?.triggerData;
          },
        }),
      },
      actors: {
        resolverFunction: fromPromise(
          async ({ input }: { input: ResolverFunctionInput }) => {
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
          }
        ),
      },
    }).createMachine({
      id: this.name,
      initial: this.#steps[0]?.id || 'idle',
      context: ({ input }) => ({
        ...input,
        stepResults: {},
        error: null,
      }),
      entry: ['initializeTriggerData'],
      states: this.#buildStateHierarchy(),
    });

    this.#machine = machine;
    return machine;
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
    const stateHierarchy: any = {
      idle: {},
      success: { type: 'final' },
      failure: { type: 'final' },
    };

    // Helper to build nested state structure
    const buildState = (currentStepId: StepId, visited: Set<StepId>) => {
      if (visited.has(currentStepId)) return null;
      visited.add(currentStepId);

      const currentStep = this.#steps.find((s) => s.id === currentStepId);
      if (!currentStep) return null;

      const state: WorkflowState[typeof currentStepId] = {
        invoke: {
          src: 'resolverFunction',
          input: ({ context }) => ({
            context,
            stepId: currentStepId,
            step: this.#transitions[currentStepId] as any,
          }),
          onDone: {
            actions: ['updateStepResult'],
            // If no transitions, go to success state
            target: !this.#transitions[currentStepId]?.transitions
              ? 'success'
              : undefined,
          },
          onError: {
            target: 'failure',
            actions: ['setError'],
          },
        },
        on: {
          // Default transition will trigger if no conditions match
          NO_MATCHING_CONDITIONS: {
            target: 'failure',
            actions: assign({
              error: () => {
                return new Error('No matching transition conditions');
              },
            }),
          },
        },
      };

      // Handle transitions
      if (this.#transitions[currentStepId]?.transitions) {
        Object.entries(this.#transitions[currentStepId]?.transitions).forEach(
          ([targetId, config]) => {
            // Create flat state structure with transitions
            state.on[`TRANSITION_${targetId}`] = {
              target: targetId,
              guard: ({ context }) =>
                !config?.condition ||
                this.#evaluateCondition(config?.condition, context),
            };
          }
        );
      }

      return state;
    };

    // Build flat state structure starting from first step
    const visited = new Set<StepId>();
    this.#steps.forEach((step) => {
      const state = buildState(step.id, visited);
      if (state) {
        stateHierarchy[step.id] = state;
      }
    });

    return stateHierarchy;
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
  step<TStepId extends TSteps[number]['id']>(
    id: TStepId,
    config?: StepDefinition<TStepId, TSteps>
  ) {
    const variables = config?.variables || {};
    const transitions = config?.transitions || undefined;

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && this.#isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }

    this.#transitions[id] = {
      transitions,
      data: requiredData,
      handler: async (data: z.infer<TSteps[number]['inputSchema']>) => {
        const step = this.#steps.find((s) => s.id === id);
        if (!step) throw new Error(`Step ${id} not found`);

        const { inputSchema, payload, action } = step;

        // Merge static payload with dynamically resolved variables
        // Variables take precedence over payload values
        const mergedData = {
          ...payload,
          ...data,
        } as z.infer<TSteps[number]['inputSchema']>;

        // Validate complete input data
        const validatedData = inputSchema
          ? inputSchema.parse(mergedData)
          : mergedData;

        return action ? action(validatedData) : {};
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
    context: WorkflowContext
  ): Record<string, any> {
    const resolvedData: Record<string, any> = {};

    for (const [key, variable] of Object.entries(stepConfig.data)) {
      // Check if variable comes from trigger data or a previous step's result
      const sourceData =
        variable.stepId === 'trigger'
          ? context.triggerData
          : context.stepResults[variable.stepId];

      if (!sourceData && variable.stepId !== 'trigger') {
        throw new Error(
          `Cannot resolve variable: Step ${variable.stepId} has not been executed yet`
        );
      }

      // If path is empty or '.', return the entire source data
      const value =
        variable.path === '' || variable.path === '.'
          ? sourceData[key]
          : get(sourceData, variable.path);

      if (value === undefined) {
        throw new Error(
          `Cannot resolve path "${variable.path}" from ${variable.stepId}`
        );
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
    results: Record<string, unknown>;
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
        error: null,
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

      this.#actor.subscribe((state) => {
        if (state.matches('success')) {
          this.#log(LogLevel.INFO, 'Workflow completed successfully', {
            results: state.context.stepResults,
          });
          this.#cleanup();
          resolve({
            triggerData,
            results: state.context.stepResults,
            runId: this.#runId,
          });
        } else if (state.matches('failure')) {
          this.#log(LogLevel.ERROR, 'Workflow failed', {
            error: state.context.error?.message,
          });
          this.#cleanup();
          reject({
            error: state.context.error?.message,
            runId: this.#runId,
          });
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
  #evaluateCondition(
    condition: StepCondition<any, any>,
    context: WorkflowContext
  ): boolean {
    let andBranchResult = true;
    let baseResult = true;
    let orBranchResult = true;

    // Base condition
    if ('ref' in condition) {
      const { ref, query } = condition;
      const sourceData =
        ref.stepId === 'trigger'
          ? context.triggerData
          : context.stepResults[ref.stepId];

      if (!sourceData) {
        throw new Error(
          `Cannot evaluate condition: Step ${ref.stepId} has not been executed yet`
        );
      }

      const value = get(sourceData, ref.path);
      baseResult = sift(query)(value);
    }

    // AND condition
    if ('and' in condition) {
      andBranchResult = condition.and.every((cond) =>
        this.#evaluateCondition(cond, context)
      );
    }

    // OR condition
    if ('or' in condition) {
      orBranchResult = condition.or.some((cond) =>
        this.#evaluateCondition(cond, context)
      );
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
      ...this.#detectCircularDependencies(),
      ...this.#validateTerminalPaths(),
      ...this.#detectUnreachableSteps(),
    ];

    if (errors.length > 0) {
      const errorMessages = errors.map(
        (error) =>
          `[${error.type}] ${error.message}${
            error.details.path
              ? ` (Path: ${error.details.path.join(' → ')})`
              : ''
          }${error.details.stepId ? ` (Step: ${error.details.stepId})` : ''}`
      );
      throw new Error(
        `Workflow validation failed:\n${errorMessages.join('\n')}`
      );
    }
  }

  /**
   * Detects circular dependencies in the workflow
   * @returns Array of ValidationError objects
   */
  #detectCircularDependencies(): ValidationError[] {
    const errors: ValidationError[] = [];
    const stack: StepId[] = [];

    const dfs = (stepId: StepId) => {
      if (stack.includes(stepId)) {
        // Found a cycle
        const cycleStartIndex = stack.indexOf(stepId);
        const cyclePath = [...stack.slice(cycleStartIndex), stepId];
        errors.push({
          type: 'circular_dependency',
          message: 'Circular dependency detected in workflow',
          details: { path: cyclePath },
        });
        return;
      }

      stack.push(stepId);

      const step = this.#transitions[stepId];
      if (step?.transitions) {
        Object.keys(step.transitions).forEach((targetId) => {
          dfs(targetId as StepId);
        });
      }

      stack.pop();
    };

    // Start DFS from first step
    if (this.#steps.length > 0) {
      dfs(this.#steps[0]!.id);
    }

    return errors;
  }

  /**
   * Validates the workflow for terminal paths
   * @returns Array of ValidationError objects
   */
  #validateTerminalPaths(): ValidationError[] {
    const errors: ValidationError[] = [];
    const visited = new Set<StepId>();
    const hasTerminalPath = new Set<StepId>();

    const dfs = (stepId: StepId, path: StepId[] = []): boolean => {
      if (hasTerminalPath.has(stepId)) return true;
      if (visited.has(stepId) && !hasTerminalPath.has(stepId)) return false;

      visited.add(stepId);

      const step = this.#transitions[stepId];
      if (!step) return false;

      // Terminal step
      if (!step.transitions) {
        hasTerminalPath.add(stepId);
        return true;
      }

      const transitions = Object.keys(step.transitions);
      if (transitions.length === 0) {
        hasTerminalPath.add(stepId);
        return true;
      }

      // Check if any transition leads to a terminal state
      const leadsToTerminal = transitions.some(
        (targetId) =>
          !path.includes(targetId as StepId) &&
          dfs(targetId as StepId, [...path, stepId])
      );

      if (leadsToTerminal) {
        hasTerminalPath.add(stepId);
      } else {
        errors.push({
          type: 'no_terminal_path',
          message: 'No path to terminal state found',
          details: {
            stepId,
            path: [...path, stepId],
          },
        });
      }

      return leadsToTerminal;
    };

    // Start from first step
    if (this.#steps.length > 0) {
      dfs(this.#steps[0]!.id);
    }

    return errors;
  }

  /**
   * Detects unreachable steps in the workflow
   * @returns Array of ValidationError objects
   */
  #detectUnreachableSteps(): ValidationError[] {
    const errors: ValidationError[] = [];
    const reachableSteps = new Set<StepId>();

    const dfs = (stepId: StepId) => {
      if (reachableSteps.has(stepId)) return;

      reachableSteps.add(stepId);
      const step = this.#transitions[stepId];

      if (step?.transitions) {
        Object.keys(step.transitions).forEach((targetId) => {
          dfs(targetId as StepId);
        });
      }
    };

    // Start from first step
    if (this.#steps.length > 0) {
      dfs(this.#steps[0]!.id);
    }

    // Find unreachable steps
    this.#steps.forEach((step) => {
      if (!reachableSteps.has(step.id)) {
        errors.push({
          type: 'unreachable_step',
          message: 'Step is not reachable from the initial step',
          details: { stepId: step.id },
        });
      }
    });

    return errors;
  }
}

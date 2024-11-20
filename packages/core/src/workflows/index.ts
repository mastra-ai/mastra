import sift from 'sift';
import { Logger, RegisteredLogger, LogLevel } from '../logger';
import { setup, createActor, assign, fromPromise, sendParent } from 'xstate';
import { z } from 'zod';

import get from 'lodash/get';

import {
  StepConfig,
  WorkflowLogMessage,
  WorkflowContext,
  StepId,
  VariableReference,
  StepDefinition,
  StepCondition,
} from './types';

/**
 * Workflow engine that manages the execution of sequential steps
 * with variable resolution and state management
 */
export class Workflow {
  /** Array of configured workflow steps */
  private steps: StepConfig<z.ZodType<any>>[] = [];

  /** Optional schema for validating initial trigger data */
  triggerSchema?: z.ZodType<any>;

  /** XState machine instance that orchestrates the workflow execution */
  private machine: ReturnType<typeof this.initializeMachine>;

  private stepGraph: Map<StepId, Set<StepId>> = new Map();

  private actor: ReturnType<typeof createActor> | null = null;

  /**
   * Creates a new Workflow instance
   * @param name - Unique identifier for the workflow
   * @param logger - Optional logger instance for workflow events
   */
  constructor(
    private name: string,
    private logger?: Logger<WorkflowLogMessage>
  ) {
    this.machine = this.initializeMachine();
  }

  /**
   * Internal logging helper that formats and sends logs to the configured logger
   * @param level - Severity level of the log
   * @param message - Main log message
   * @param data - Optional data to include in the log
   * @param stepId - Optional ID of the step that generated the log
   */
  private async log(
    level: LogLevel,
    message: string,
    data?: any,
    stepId?: StepId
  ) {
    if (!this.logger) return;

    const logMessage: WorkflowLogMessage = {
      type: RegisteredLogger.WORKFLOW,
      message,
      workflowName: this.name,
      destinationPath: `workflows/${this.name}`,
      stepId,
      data,
    };

    const logMethod = level.toLowerCase() as keyof Logger<WorkflowLogMessage>;

    await this.logger[logMethod]?.(logMessage);
  }

  /**
   * Initializes the XState machine for the workflow
   * @returns The initialized machine
   */
  private initializeMachine() {
    return setup({
      types: {} as {
        context: WorkflowContext;
        input: WorkflowContext;
        events: { type: string; output?: any; error?: Error };
      },
      actions: {
        updateStepResult: assign({
          stepResults: ({ context, event }) => {
            const stepId = event.output?.stepId as StepId;
            if (!stepId || !event.output) return context.stepResults;

            this.log(
              LogLevel.INFO,
              `Step ${stepId} completed`,
              event.output,
              stepId
            );

            const result = event.output.result;
            if (result !== undefined) {
              const newResults = {
                ...context.stepResults,
                [stepId]: result,
              };

              // Get the step configuration
              const step = this.steps.find((s) => s.id === stepId);

              // Evaluate transitions and send events
              if (step?.transitions) {
                const fullContext = { ...context, stepResults: newResults };
                console.log(
                  'Evaluating transitions with context:',
                  fullContext
                );

                Object.entries(step.transitions).forEach(
                  ([targetId, config]) => {
                    console.log('Checking transition to:', targetId);
                    console.log('With condition:', config.condition);
                    if (
                      !config.condition ||
                      this.evaluateCondition(config.condition, fullContext)
                    ) {
                      console.log(
                        'Condition passed, sending transition to:',
                        targetId
                      );
                      Promise.resolve().then(() => {
                        if (this.actor) {
                          this.actor.send({ type: `TRANSITION_${targetId}` });
                        }
                      });
                    }
                  }
                );
              }

              return newResults;
            }

            return context.stepResults;
          },
        }),
        setError: assign({
          error: ({ event }: any) => {
            this.log(LogLevel.ERROR, `Workflow error`, event.error);
            return event.error;
          },
        }),
        initializeTriggerData: assign({
          triggerData: (input: any) => {
            this.log(
              LogLevel.INFO,
              'Workflow started',
              input?.context?.triggerData
            );
            return input?.context?.triggerData;
          },
        }),
      },
      actors: {
        resolverFunction: fromPromise(async ({ input }: any) => {
          const { step, context } = input;
          const resolvedData = this.resolveVariables(step, context);
          const result = await step.handler(resolvedData);

          return {
            stepId: step.id,
            result,
          };
        }),
      },
    }).createMachine({
      id: this.name,
      initial: this.steps[0]?.id || 'idle',
      context: ({ input }: any) => ({
        ...input,
        stepResults: {},
        error: null,
      }),
      entry: ['initializeTriggerData'],
      states: this.buildStateHierarchy(),
    });
  }

  /**
   * Rebuilds the machine with the current steps configuration
   */
  commitMachine() {
    this.validateWorkflow();
    this.machine = this.initializeMachine();
  }

  /**
   * Builds the state hierarchy for the workflow
   * @returns Object representing the state hierarchy
   */
  private buildStateHierarchy() {
    const stateHierarchy: any = {
      idle: {},
      success: { type: 'final' },
      failure: { type: 'final' },
    };

    // Helper to build nested state structure
    const buildState = (currentStepId: StepId, visited: Set<StepId>) => {
      if (visited.has(currentStepId)) return null;
      visited.add(currentStepId);

      const currentStep = this.steps.find((s) => s.id === currentStepId);
      if (!currentStep) return null;

      const state: any = {
        invoke: {
          src: 'resolverFunction',
          input: ({ context }: any) => ({
            step: currentStep,
            context,
          }),
          onDone: {
            actions: ['updateStepResult'],
            // If no transitions, go to success state
            target: currentStep.transitions ? undefined : 'success',
          },
          onError: {
            target: 'failure',
            actions: ['setError'],
          },
        },
        on: {},
      };

      // Handle transitions
      if (currentStep.transitions) {
        Object.entries(currentStep.transitions).forEach(
          ([targetId, config]) => {
            // Create flat state structure with transitions
            state.on[`TRANSITION_${targetId}`] = {
              target: targetId,
              guard: ({ context }: any) =>
                !config.condition ||
                this.evaluateCondition(config.condition, context),
            };
          }
        );
      }

      return state;
    };

    // Build flat state structure starting from first step
    const visited = new Set<StepId>();
    this.steps.forEach((step) => {
      const state = buildState(step.id, visited);
      if (state) {
        stateHierarchy[step.id] = state;
      }
    });

    return stateHierarchy;
  }

  /**
   * Sets the schema for validating trigger data
   * @param schema - Zod schema for trigger data validation
   * @returns this instance for method chaining
   */
  setTriggerSchema(schema: z.ZodType<any>) {
    this.triggerSchema = schema;
    return this;
  }

  /**
   * Type guard to check if a value is a valid VariableReference
   * @param value - Value to check
   * @returns True if value is a VariableReference
   */
  private isVariableReference(value: any): value is VariableReference {
    return typeof value === 'object' && 'stepId' in value && 'path' in value;
  }

  /**
   * Creates a validated step ID, ensuring uniqueness within the workflow
   * @param id - Proposed step ID
   * @returns The validated and branded step ID
   * @throws Error if ID is invalid or duplicate
   */
  createStepId(id: string): StepId {
    // Check for duplicates
    if (this.steps.some((step) => step.id === id)) {
      throw new Error(
        `Step with ID "${id}" already exists in workflow "${this.name}"`
      );
    }

    return id as StepId;
  }

  /**
   * Adds a new step to the workflow
   * @param id - Unique identifier for the step
   * @param config - Step configuration including handler, schema, variables, and payload
   * @returns this instance for method chaining (builder pattern baybyyyy)
   * @throws Error if step ID is duplicate or variable resolution fails
   */
  addStep<TSchema extends z.ZodType<any>>(
    id: string,
    config: StepDefinition<TSchema>
  ) {
    const stepId = this.createStepId(id);
    const {
      action,
      inputSchema,
      variables = {},
      payload = {},
      transitions,
    } = config;

    // Validate transitions reference existing steps
    if (transitions) {
      Object.keys(transitions).forEach((targetId) => {
        // Skip validation for steps that will be added later
        if (!this.steps.some((s) => s.id === targetId)) {
          this.log(
            LogLevel.DEBUG,
            `Step ${targetId} not found yet, will be validated when workflow starts`
          );
        }
      });
    }

    const requiredData: Record<string, VariableReference> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && this.isVariableReference(variable)) {
        requiredData[key as string] = variable;
      }
    }

    // Create step config
    const stepConfig: StepConfig<z.infer<TSchema>> = {
      id: stepId,
      handler: async (data: z.infer<TSchema>) => {
        // Merge static payload with dynamically resolved variables
        // Variables take precedence over payload values
        const mergedData = {
          ...payload,
          ...data,
        } as z.infer<TSchema>;

        // Validate complete input data
        const validatedData = inputSchema
          ? inputSchema.parse(mergedData)
          : mergedData;

        console.log('Validated data:', { validatedData, data });
        return action(validatedData);
      },
      inputSchema,
      requiredData,
      transitions,
    };

    this.steps.push(stepConfig);
    // rebuild the state machine with the updated steps configuration
    // xstate machines are immutable, so we need to create a new one
    // this.machine = this.initializeMachine();
    return this;
  }

  /**
   * Resolves variables for a step from trigger data or previous step results
   * @param stepConfig - Configuration of the step needing variable resolution
   * @param context - Current workflow context containing results and trigger data
   * @returns Object containing resolved variable values
   * @throws Error if variable resolution fails
   */
  private resolveVariables(
    stepConfig: StepConfig,
    context: WorkflowContext
  ): Record<string, any> {
    const resolvedData: Record<string, any> = {};

    for (const [key, variable] of Object.entries(stepConfig.requiredData)) {
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
  async executeWorkflow<
    TSchema = unknown,
    TTrigger = this['triggerSchema'] extends z.ZodSchema<infer T> ? T : TSchema
  >(
    triggerData?: TTrigger
  ): Promise<{
    triggerData?: TTrigger;
    results: Record<string, unknown>;
  }> {
    await this.log(LogLevel.INFO, 'Executing workflow', { triggerData });

    if (this.triggerSchema) {
      try {
        this.triggerSchema.parse(triggerData);
        await this.log(LogLevel.DEBUG, 'Trigger schema validation passed');
      } catch (error) {
        await this.log(LogLevel.ERROR, 'Trigger schema validation failed', {
          error,
        });
        throw error;
      }
    }

    this.actor = createActor(this.machine, {
      input: {
        error: null,
        stepResults: {},
        triggerData: triggerData || {},
      },
    });

    this.actor.start();

    return new Promise((resolve, reject) => {
      if (!this.actor) {
        reject(new Error('Actor not initialized'));
        return;
      }

      this.actor?.subscribe((state) => {
        if (state.matches('success')) {
          this.log(LogLevel.INFO, 'Workflow completed successfully', {
            results: state.context.stepResults,
          });
          resolve({
            triggerData,
            results: state.context.stepResults,
          });
        } else if (state.matches('failure')) {
          this.log(LogLevel.ERROR, 'Workflow failed', {
            error: state.context.error?.message,
          });
          reject({ error: state.context.error?.message });
        }
      });
    });
  }

  cleanup() {
    if (this.actor) {
      this.actor.stop();
      this.actor = null;
    }
  }

  /**
   * Evaluates a single condition against workflow context
   */
  private evaluateCondition(
    condition: StepCondition,
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
        this.evaluateCondition(cond, context)
      );
    }

    // OR condition
    if ('or' in condition) {
      orBranchResult = condition.or.some((cond) =>
        this.evaluateCondition(cond, context)
      );
    }

    const finalResult = baseResult && andBranchResult && orBranchResult;
    return finalResult;
  }

  // Add validation method to be called before workflow execution
  private validateWorkflow() {
    // Check for undefined step references
    this.steps.forEach((step) => {
      if (!step.transitions) return;

      Object.keys(step.transitions).forEach((targetId) => {
        if (!this.steps.some((s) => s.id === targetId)) {
          throw new Error(
            `Invalid transition in step "${step.id}": Target step "${targetId}" does not exist`
          );
        }
      });
    });

    // Check for unreachable steps
    const reachableSteps = new Set<StepId>([this.steps[0].id]);
    let changed = true;

    while (changed) {
      changed = false;
      this.steps.forEach((step) => {
        if (!reachableSteps.has(step.id)) return;
        if (!step.transitions) return;

        Object.keys(step.transitions).forEach((targetId) => {
          if (!reachableSteps.has(targetId as StepId)) {
            reachableSteps.add(targetId as StepId);
            changed = true;
          }
        });
      });
    }

    const unreachableSteps = this.steps.filter(
      (step) => !reachableSteps.has(step.id)
    );
    if (unreachableSteps.length > 0) {
      throw new Error(
        `Unreachable steps detected: ${unreachableSteps
          .map((s) => s.id)
          .join(', ')}`
      );
    }
  }
}

/**
 * TODO:
 * - Add retry mechanisms for failed steps
 * - Add validation for circular dependencies in variable references
 * - Add support for logging step durations
 * - Add support for step hooks (before/after)
 * - Add workflow execution history
 * - Better types (remove all the any's)
 */

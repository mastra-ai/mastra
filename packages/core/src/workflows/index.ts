import sift from 'sift';
import { Logger, RegisteredLogger, LogLevel } from '../logger';
import { setup, createActor, assign, fromPromise } from 'xstate';
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
   * Initializes the XState machine that powers the workflow
   * Configures actions, actors, and initial state
   * @returns The created XState machine
   */
  private initializeMachine() {
    const machine = setup({
      types: {} as {
        context: WorkflowContext;
        input: WorkflowContext;
        actions: {
          updateStepResult: { type: 'updateStepResult' };
          setError: { type: 'setError' };
          initializeTriggerData: { type: 'initializeTriggerData' };
        };
      },
      actions: {
        updateStepResult: assign({
          stepResults: ({ context, event }) => {
            // Extract step ID from actor ID format: 'parent.child.stepId'
            const actorId = event?.actorId?.split('.');
            const stepId = actorId?.[actorId.length - 1] as StepId;

            this.log(
              LogLevel.INFO,
              `Step ${stepId} completed`,
              event.output,
              stepId
            );

            // if resolverFunction returns a value, add it to the stepResults
            if (event.output) {
              return {
                ...context.stepResults,
                [stepId]: event.output,
              };
            }

            return context.stepResults;
          },
        }),
        setError: assign({
          error: ({ event }) => {
            this.log(LogLevel.ERROR, `Workflow error`, event.error);
            return event.error;
          },
        }),
        initializeTriggerData: assign({
          triggerData: ({ event }: any) => {
            this.log(
              LogLevel.INFO,
              'Workflow started',
              event.input.triggerData
            );
            return event.input.triggerData;
          },
        }),
      },
      actors: {
        resolverFunction: fromPromise(
          async ({
            input,
          }: {
            input: {
              step: StepConfig;
              context: WorkflowContext;
            };
          }) => {
            // resolve variables from trigger data or previous step results
            const resolvedData = this.resolveVariables(
              input.step,
              input.context
            );

            // evaluate conditions
            const conditionResult = input.step?.conditions
              ? this.evaluateCondition(input.step.conditions, input.context)
              : true;

            if (!conditionResult) {
              return undefined;
            }

            // execute the step handler with the resolved data
            return await input.step.handler(resolvedData);
          }
        ),
      },
    }).createMachine({
      id: this.name,
      initial: this.steps[0]?.id || 'idle',
      context: ({ input }) => ({
        ...input,
      }),
      entry: ['initializeTriggerData'],
      states: this.createStates() as any,
    });

    return machine;
  }

  /**
   * Creates the state configuration for the XState machine
   * Defines the states, transitions, and actions for each workflow step
   * @returns Record of state configurations
   */
  private createStates() {
    const states: Record<string, unknown> = {
      idle: {},
      success: {
        type: 'final',
      },
      failure: {
        type: 'final',
      },
    };

    this.steps.forEach((step, index) => {
      const isLastStep = index === this.steps.length - 1;

      states[step.id] = {
        invoke: {
          src: 'resolverFunction',
          input: ({ event, context }: any) => {
            return { event, step, context };
          },
          onDone: {
            // if last step, transition to success, otherwise transition to next step
            target: isLastStep ? 'success' : this.steps[index + 1].id,
            actions: ['updateStepResult'],
          },
          onError: {
            target: 'failure',
            actions: ['setError'],
          },
        },
      };
    });

    return states;
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
      conditions,
    } = config;

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
        return action(validatedData);
      },
      inputSchema,
      requiredData,
      conditions,
    };

    this.steps.push(stepConfig);
    // rebuild the state machine with the updated steps configuration
    // xstate machines are immutable, so we need to create a new one
    this.machine = this.initializeMachine();
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

      const value = get(sourceData, variable.path);

      if (!value) {
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

    const actor = createActor(this.machine, {
      input: {
        error: null,
        stepResults: {},
        triggerData,
      },
    }).start();

    return new Promise((resolve, reject) => {
      actor.subscribe((state) => {
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

    return baseResult && andBranchResult && orBranchResult;
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

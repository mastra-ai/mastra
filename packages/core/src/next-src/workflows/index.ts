import { setup, createActor, assign, fromPromise } from 'xstate';
import { z } from 'zod';
import get from 'lodash/get';
import { Logger, BaseLogMessage, RegisteredLogger, LogLevel } from '../logger';

type DataPath = string;

interface VariableReference {
  stepId: string | 'trigger';
  path: DataPath;
}

interface StepConfig<TInput = any> {
  id: string;
  handler: (data: TInput) => Promise<any>;
  inputSchema?: z.ZodType<TInput>;
  requiredData: Record<string, VariableReference>;
}

interface StepDefinition<TSchema extends z.ZodType<any>> {
  handler: (data: z.infer<TSchema>) => Promise<any>;
  inputSchema?: TSchema;
  variables?: Partial<Record<keyof z.infer<TSchema>, VariableReference>>;
  payload?: Partial<z.infer<TSchema>>;
}

interface WorkflowContext {
  error: Error | null;
  stepResults: Record<string, any>;
  triggerData: any;
}

interface WorkflowLogMessage extends BaseLogMessage {
  type: typeof RegisteredLogger.WORKFLOW;
  workflowName: string;
  stepId?: string;
  data?: any;
}

export class Workflow {
  private steps: StepConfig<z.ZodType<any>>[] = [];
  private triggerSchema?: z.ZodType<any>;
  private machine!: ReturnType<typeof this.initializeMachine>;

  constructor(
    private name: string,
    private logger?: Logger<WorkflowLogMessage>
  ) {
    this.initializeMachine();
  }

  private async log(
    level: LogLevel,
    message: string,
    data?: any,
    stepId?: string
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

  private initializeMachine() {
    const machine = setup({
      types: {} as {
        context: WorkflowContext;
        input: WorkflowContext;
      },
      actions: {
        updateStepResult: assign({
          stepResults: ({ context, event }: any) => {
            const sksks = event.actorId.split('.');
            const stepId = sksks[sksks.length - 1];
            this.log(
              LogLevel.INFO,
              `Step ${stepId} completed`,
              event.output,
              stepId
            );
            return {
              ...context.stepResults,
              [stepId]: event.output,
            };
          },
        }),
        setError: assign({
          error: ({ event }: any) => {
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
          async ({ input: { step, context } }: any) => {
            const resolvedData = this.resolveVariables(step, context);
            return await step.handler(resolvedData);
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
      states: this.createStates(),
    });

    this.machine = machine;
    return machine;
  }

  private createStates() {
    const states: Record<string, any> = {
      idle: {},
      success: {
        type: 'final',
        entry: (e: any) => console.log('success entered'),
        exit: (e: any) => console.log('success exited'),
      },
      failure: {
        type: 'final',
        entry: (e: any) => console.log('failure entered'),
      },
    };

    this.steps.forEach((step, index) => {
      const isLastStep = index === this.steps.length - 1;

      states[step.id] = {
        entry: (e: any) => console.log(`${step.id} entered`),
        exit: (e: any) => console.log(`${step.id} exited`),
        invoke: {
          src: 'resolverFunction',
          input: ({ event, context }: any) => {
            return { event, step, context };
          },
          onDone: {
            target: isLastStep ? 'success' : this.steps[index + 1].id,
            actions: ['updateStepResult'],
            output: ({ event }: any) => ({
              type: 'STEP.COMPLETE',
              stepId: step.id,
              result: event.output,
            }),
          },
          onError: {
            target: 'failure',
            actions: ['setError'],
            output: ({ event }: any) => ({
              type: 'STEP.ERROR',
              error: event.error,
            }),
          },
        },
      };
    });

    return states;
  }

  setTriggerSchema(schema: z.ZodType<any>) {
    this.triggerSchema = schema;
    return this;
  }

  private isVariableReference(value: any): value is VariableReference {
    return typeof value === 'object' && 'stepId' in value && 'path' in value;
  }

  addStep<TSchema extends z.ZodType<any>>(
    id: string,
    config: StepDefinition<TSchema>
  ) {
    const { handler, inputSchema, variables = {}, payload = {} } = config;

    // Convert variables to requiredData format
    const requiredData: Record<string, VariableReference> = {};

    // Add variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && this.isVariableReference(variable)) {
        requiredData[key as string] = variable;
      }
    }

    // Validate payload against input schema
    // const parsedPayload = inputSchema ? inputSchema.parse(payload) : payload;
    const parsedPayload = payload;

    // Create step config
    const stepConfig: StepConfig<z.infer<TSchema>> = {
      id,
      handler: async (data: z.infer<TSchema>) => {
        // Merge payload with resolved variables
        const mergedData = {
          ...parsedPayload,
          ...data,
        } as z.infer<TSchema>;

        // Validate complete input data
        const validatedData = inputSchema
          ? inputSchema.parse(mergedData)
          : mergedData;
        return handler(validatedData);
      },
      inputSchema,
      requiredData,
    };

    this.steps.push(stepConfig);
    this.initializeMachine();
    return this;
  }

  private resolveVariables(
    stepConfig: StepConfig,
    context: WorkflowContext
  ): Record<string, any> {
    const resolvedData: Record<string, any> = {};

    for (const [key, variable] of Object.entries(stepConfig.requiredData)) {
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

  async executeWorkflow(triggerData?: any): Promise<{
    triggerData: any;
    results: Record<string, any>;
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
}

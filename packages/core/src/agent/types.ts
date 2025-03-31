import type {
  GenerateTextOnStepFinishCallback,
  LanguageModelV1,
  StreamObjectOnFinishCallback,
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  TelemetrySettings,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { Metric } from '../eval';
import type {
  CoreMessage,
  DefaultLLMStreamObjectOptions,
  DefaultLLMStreamOptions,
  DefaultLLMTextObjectOptions,
  DefaultLLMTextOptions,
  OutputType,
} from '../llm';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig } from '../memory/types';
import type { ToolActionWithDeps, VercelTool } from '../tools';
import type { DependenciesType } from '../utils';
import { validateDependencies } from '../utils';
import type { CompositeVoice } from '../voice';

export type { Message as AiMessageType } from 'ai';

export type Tools<TSchemaDeps extends ZodSchema | undefined> = ToolActionWithDeps<TSchemaDeps> | VercelTool;
export type ToolsInput<TSchemaDeps extends ZodSchema | undefined> = Record<string, Tools<TSchemaDeps>>;
export type ToolsetsInput<TSchemaDeps extends ZodSchema | undefined> = Record<string, ToolsInput<TSchemaDeps>>;
export type MastraLanguageModel = LanguageModelV1;

export type InstructionsBuilder<TSchemaDeps extends ZodSchema | undefined> = (context: {
  dependencies: DependenciesType<TSchemaDeps>;
}) => Promise<string> | string;

export interface AgentInstructionsOptions<TSchemaDeps extends ZodSchema | undefined> {
  instructions: string;
  instructionsBuilder?: InstructionsBuilder<TSchemaDeps>;
  dependenciesSchema?: TSchemaDeps;
}

/**
 * Handles resolution of agent instructions, supporting both static strings
 * and dynamic functions that depend on runtime values.
 *
 * @template TSchemaDeps - Zod schema for dependencies validation.
 */
export class AgentInstructions<TSchemaDeps extends ZodSchema | undefined> {
  private readonly instructions: string;
  private readonly instructionsBuilder?: InstructionsBuilder<TSchemaDeps>;
  private readonly dependenciesSchema?: TSchemaDeps;

  /**
   * Creates a new AgentInstructions instance.
   *
   * @param instructions Static string instructions to use as fallback.
   * @param instructionsBuilder Optional function that builds dynamic instructions.
   * @param dependenciesSchema Optional Zod schema for validating dependencies.
   */
  constructor({ instructions, instructionsBuilder, dependenciesSchema }: AgentInstructionsOptions<TSchemaDeps>) {
    this.instructions = instructions;
    this.instructionsBuilder = instructionsBuilder;
    this.dependenciesSchema = dependenciesSchema;
  }

  /**
   * Static factory method to create an AgentInstructions instance from either
   * a static string or a dynamic instructions builder function.
   *
   * @param instructionsInput Either a static string or function that generates instructions.
   * @param options.dependenciesSchema Optional Zod schema for validating dependencies.
   * @param options.fallbackInstructions Optional fallback string to use when input is a builder.
   * @returns A new AgentInstructions instance.
   */
  static from<T extends ZodSchema | undefined>(
    instructionsInput: string | InstructionsBuilder<T>,
    options: {
      dependenciesSchema?: T;
      fallbackInstructions?: string;
    } = {},
  ): AgentInstructions<T> {
    const { dependenciesSchema, fallbackInstructions = '[Dynamic Instructions]' } = options;

    return new AgentInstructions({
      instructions: typeof instructionsInput === 'string' ? instructionsInput : fallbackInstructions,
      instructionsBuilder: typeof instructionsInput === 'function' ? instructionsInput : undefined,
      dependenciesSchema,
    });
  }

  /**
   * Resolves the instructions to a string, evaluating any dynamic instructions
   * with the provided dependencies.
   *
   * @param dependencies Optional dependencies to use for dynamic instructions.
   * @param instructions Optional string to override the stored instructions.
   * @returns A promise resolving to the final instructions string.
   * @throws Will throw an error if dependencies are provided but fail validation against the schema.
   */
  async resolve({
    dependencies,
    instructions,
  }: {
    dependencies?: DependenciesType<TSchemaDeps>;
    instructions?: string;
  } = {}): Promise<string> {
    if (instructions) {
      return instructions;
    }

    if (!this.instructionsBuilder) {
      return this.instructions;
    }

    if (this.dependenciesSchema && !dependencies) {
      return this.instructions;
    }

    // We only validate provided dependencies against the existing schema
    const emptyDeps = {} as DependenciesType<TSchemaDeps>;
    const validatedDeps = this.dependenciesSchema
      ? validateDependencies(this.dependenciesSchema, dependencies || emptyDeps)
      : dependencies || emptyDeps;

    return await this.instructionsBuilder({ dependencies: validatedDeps });
  }

  /**
   * Get the static instructions without resolving dependencies.
   */
  getStaticInstructions(): string {
    return this.instructions;
  }

  /**
   * String representation for when instructions are used in string contexts.
   */
  toString(): string {
    return this.instructions;
  }
}

export interface AgentConfig<
  TAgentId extends string = string, 
  TSchemaDeps extends ZodSchema | undefined = undefined,
  TTools extends ToolsInput<TSchemaDeps> = ToolsInput<TSchemaDeps>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> {
  name: TAgentId;
  instructions: string | InstructionsBuilder<TSchemaDeps>;
  model: MastraLanguageModel;
  dependenciesSchema?: TSchemaDeps;
  tools?: TTools;
  mastra?: Mastra;
  /** @deprecated This property is deprecated. Use evals instead to add evaluation metrics. */
  metrics?: TMetrics;
  evals?: TMetrics;
  memory?: MastraMemory;
  voice?: CompositeVoice;
}

/**
 * Options for generating responses with an agent
 * @template Z - The schema type for structured output (Zod schema or JSON schema)
 * @template TSchemaDeps - The schema type for runtime dependencies (Zod schema)
 */
export type AgentGenerateOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaDeps extends ZodSchema | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput<TSchemaDeps>;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /** Memory configuration options */
  memoryOptions?: MemoryConfig;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired after each generation step completes */
  onStepFinish?: Z extends undefined ? GenerateTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output, does not work with tools, use experimental_output instead */
  output?: OutputType | Z;
  /** Schema for structured output generation alongside tool calls */
  experimental_output?: Z;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** Dependencies to use in tool execution or instruction builder */
  dependencies?: DependenciesType<TSchemaDeps>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

/**
 * Options for streaming responses with an agent
 * @template Z - The schema type for structured output (Zod schema or JSON schema)
 * @template TSchemaDeps - The schema type for runtime dependencies (Zod schema)
 */
export type AgentStreamOptions<
  Z extends ZodSchema | JSONSchema7 | undefined = undefined,
  TSchemaDeps extends ZodSchema | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput<TSchemaDeps>;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /** Memory configuration options */
  memoryOptions?: MemoryConfig;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired when streaming completes */
  onFinish?: Z extends undefined
    ? StreamTextOnFinishCallback<any>
    : Z extends ZodSchema
      ? StreamObjectOnFinishCallback<z.infer<Z>>
      : StreamObjectOnFinishCallback<any>;
  /** Callback fired after each generation step completes */
  onStepFinish?: Z extends undefined ? StreamTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output */
  output?: OutputType | Z;
  /** Temperature parameter for controlling randomness */
  temperature?: number;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Experimental schema for structured output */
  experimental_output?: Z;
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** Dependencies to use in tool execution or instruction builder */
  dependencies?: DependenciesType<TSchemaDeps>;
} & ({ resourceId?: undefined; threadId?: undefined } | { resourceId: string; threadId: string }) &
  (Z extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);

import { Agent } from '@mastra/core/agent';
import type {
  AiMessageType,
  AgentGenerateOptions,
  AgentStreamOptions,
  AgentExecutionOptions,
  AgentExecutionOptionsBase,
  ToolsInput,
  AgentConfig,
  PublicStructuredOutputOptions,
} from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { CoreMessage } from '@mastra/core/llm';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraModelOutput, FullOutput } from '@mastra/core/stream';
import { Memory } from '@mastra/memory';
import type { InferStandardSchemaOutput, StandardSchemaWithJSON } from '@mastra/schema-compat/schema';
import { AgentBuilderDefaults } from '../defaults';
import { ToolSummaryProcessor } from '../processors/tool-summary';
import type { AgentBuilderConfig, GenerateAgentOptions } from '../types';

// =============================================================================
// Template Merge Workflow Implementation
// =============================================================================
//
// This workflow implements a comprehensive template merging system that:
// 1. Clones template repositories at specific refs (tags/commits)
// 2. Discovers units (agents, workflows, MCP servers/tools) in templates
// 3. Topologically orders units based on dependencies
// 4. Analyzes conflicts and creates safety classifications
// 5. Applies changes with git branching and checkpoints per unit
//
// The workflow follows the "auto-decide vs ask" principles:
// - Auto: adding new files, missing deps, appending arrays, new scripts with template:slug:* namespace
// - Prompt: overwriting files, major upgrades, renaming conflicts, new ports, postInstall commands
// - Block: removing files, downgrading deps, changing TS target/module, modifying CI/CD secrets
//
// Usage with Mastra templates (see https://mastra.ai/api/templates.json):
//   const run = await agentBuilderTemplateWorkflow.createRun();
//   const result = await run.start({
//     inputData: {
//       repo: 'https://github.com/mastra-ai/template-pdf-questions',
//       ref: 'main', // optional
//       targetPath: './my-project', // optional, defaults to cwd
//     }
//   });
//   // The workflow will automatically analyze and merge the template structure
//
// =============================================================================

export class AgentBuilder<TTools extends ToolsInput = ToolsInput, TOutput = undefined> extends Agent<
  'agent-builder',
  TTools,
  TOutput
> {
  private builderConfig: AgentBuilderConfig;

  /**
   * Constructor for AgentBuilder
   */
  constructor(config: AgentBuilderConfig) {
    const additionalInstructions = config.instructions ? `## Priority Instructions \n\n${config.instructions}` : '';
    const combinedInstructions = additionalInstructions + AgentBuilderDefaults.DEFAULT_INSTRUCTIONS(config.projectPath);

    // Create Memory with storage for AgentBuilder
    // Use provided storage if available, otherwise fall back to in-memory storage
    const memory = new Memory({
      options: AgentBuilderDefaults.DEFAULT_MEMORY_CONFIG,
    });
    memory.setStorage(config.storage ?? new InMemoryStore());

    const agentConfig: AgentConfig<'agent-builder', TTools, TOutput> = {
      id: 'agent-builder',
      name: 'agent-builder',
      description:
        'An AI agent specialized in generating Mastra agents, tools, and workflows from natural language requirements.',
      instructions: combinedInstructions,
      model: config.model,
      tools: async (): Promise<TTools> => {
        return {
          ...(await AgentBuilderDefaults.listToolsForMode(config.projectPath, config.mode)),
          ...(config.tools || ({} as TTools)),
        } as TTools;
      },
      memory,
      inputProcessors: [
        // use the write to disk processor to debug the agent's context
        // new WriteToDiskProcessor({ prefix: 'before-filter' }),
        new ToolSummaryProcessor({ summaryModel: config.summaryModel || config.model }),
        // new WriteToDiskProcessor({ prefix: 'after-filter' }),
      ],
    };

    super(agentConfig);
    this.builderConfig = config;
  }

  /**
   * Enhanced generate method with AgentBuilder-specific configuration
   * Overrides the base Agent generate method to provide additional project context
   */
  generateLegacy: Agent['generateLegacy'] = async (
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    generateOptions: (GenerateAgentOptions & AgentGenerateOptions<any, any>) | undefined = {},
  ): Promise<any> => {
    const { maxSteps, ...baseOptions } = generateOptions;

    const originalInstructions = await this.getInstructions({ requestContext: generateOptions?.requestContext });
    const additionalInstructions = baseOptions.instructions;

    let enhancedInstructions = originalInstructions as string;
    if (additionalInstructions) {
      enhancedInstructions = `${originalInstructions}\n\n${additionalInstructions}`;
    }

    const enhancedContext = [...(baseOptions.context || [])];

    const enhancedOptions = {
      ...baseOptions,
      maxSteps: maxSteps || 100, // Higher default for code generation
      temperature: 0.3, // Lower temperature for more consistent code generation
      instructions: enhancedInstructions,
      context: enhancedContext,
    } satisfies AgentGenerateOptions<any, any>;

    this.logger.debug(`[AgentBuilder:${this.name}] Starting generation with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.generateLegacy(messages, enhancedOptions);
  };

  /**
   * Enhanced stream method with AgentBuilder-specific configuration
   * Overrides the base Agent stream method to provide additional project context
   */
  streamLegacy: Agent['streamLegacy'] = async (
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    streamOptions: (GenerateAgentOptions & AgentStreamOptions<any, any>) | undefined = {},
  ): Promise<any> => {
    const { maxSteps, ...baseOptions } = streamOptions;

    const originalInstructions = await this.getInstructions({ requestContext: streamOptions?.requestContext });
    const additionalInstructions = baseOptions.instructions;

    let enhancedInstructions = originalInstructions as string;
    if (additionalInstructions) {
      enhancedInstructions = `${originalInstructions}\n\n${additionalInstructions}`;
    }
    const enhancedContext = [...(baseOptions.context || [])];

    const enhancedOptions = {
      ...baseOptions,
      maxSteps: maxSteps || 100, // Higher default for code generation
      temperature: 0.3, // Lower temperature for more consistent code generation
      instructions: enhancedInstructions,
      context: enhancedContext,
    };

    this.logger.debug(`[AgentBuilder:${this.name}] Starting streaming with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.streamLegacy(messages, enhancedOptions);
  };

  /**
   * Enhanced stream method with AgentBuilder-specific configuration
   * Overrides the base Agent stream method to provide additional project context
   */
  async stream<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
    },
  ): Promise<MastraModelOutput<T>>;
  async stream<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
    },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async stream(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
    },
  ): Promise<MastraModelOutput<TOutput>>;
  async stream(messages: MessageListInput): Promise<MastraModelOutput<TOutput>>;
  async stream<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
    },
  ): Promise<MastraModelOutput<OUTPUT>> {
    const { ...baseOptions } = streamOptions || ({} as AgentExecutionOptions<OUTPUT>);

    const originalInstructions = await this.getInstructions({ requestContext: streamOptions?.requestContext });
    const additionalInstructions = baseOptions.instructions;

    let enhancedInstructions = originalInstructions as string;
    if (additionalInstructions) {
      enhancedInstructions = `${originalInstructions}\n\n${additionalInstructions}`;
    }
    const enhancedContext = [...(baseOptions.context || ([] as AgentExecutionOptions<OUTPUT>['context'][]))];

    const enhancedOptions = {
      ...baseOptions,
      temperature: 0.3, // Lower temperature for more consistent code generation
      maxSteps: baseOptions?.maxSteps || 100,
      instructions: enhancedInstructions,
      context: enhancedContext,
    } as any;

    this.logger.debug(`[AgentBuilder:${this.name}] Starting streaming with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.stream(messages, enhancedOptions);
  }

  async generate<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
    },
  ): Promise<FullOutput<T>>;
  async generate<OUTPUT extends {}>(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
    },
  ): Promise<FullOutput<OUTPUT>>;
  async generate(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
    },
  ): Promise<FullOutput<TOutput>>;
  async generate<OUTPUT = TOutput>(messages: MessageListInput): Promise<FullOutput<OUTPUT>>;
  async generate<OUTPUT = TOutput>(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
    },
  ): Promise<FullOutput<OUTPUT>> {
    const { ...baseOptions } = options || {};

    const originalInstructions = await this.getInstructions({ requestContext: options?.requestContext });
    const additionalInstructions = baseOptions.instructions;

    let enhancedInstructions = originalInstructions as string;
    if (additionalInstructions) {
      enhancedInstructions = `${originalInstructions}\n\n${additionalInstructions}`;
    }
    const enhancedContext = [...(baseOptions.context || [])];

    const enhancedOptions = {
      ...baseOptions,
      temperature: 0.3, // Lower temperature for more consistent code generation
      maxSteps: baseOptions?.maxSteps || 100,
      instructions: enhancedInstructions,
      context: enhancedContext,
    } as any;

    this.logger.debug(`[AgentBuilder:${this.name}] Starting streaming with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.generate(messages, enhancedOptions);
  }
}

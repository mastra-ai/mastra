import { Agent } from '@mastra/core/agent';
import type {
  AiMessageType,
  AgentGenerateOptions,
  AgentStreamOptions,
  AgentExecutionOptions,
} from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { CoreMessage } from '@mastra/core/llm';
import type { AISDKV5OutputStream, MastraModelOutput, OutputSchema } from '@mastra/core/stream';
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';
import type { JSONSchema7 } from 'ai';
import type { ZodSchema } from 'zod';
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
//   const run = await agentBuilderTemplateWorkflow.createRunAsync();
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

export class AgentBuilder extends Agent {
  private builderConfig: AgentBuilderConfig;

  /**
   * Constructor for AgentBuilder
   */
  constructor(config: AgentBuilderConfig) {
    const additionalInstructions = config.instructions ? `## Priority Instructions \n\n${config.instructions}` : '';
    const combinedInstructions = additionalInstructions + AgentBuilderDefaults.DEFAULT_INSTRUCTIONS(config.projectPath);

    const agentConfig = {
      name: 'agent-builder',
      description:
        'An AI agent specialized in generating Mastra agents, tools, and workflows from natural language requirements.',
      instructions: combinedInstructions,
      model: config.model,
      tools: async () => {
        return {
          ...(await AgentBuilderDefaults.getToolsForMode(config.projectPath, config.mode)),
          ...(config.tools || {}),
        };
      },
      memory: new Memory({
        options: AgentBuilderDefaults.DEFAULT_MEMORY_CONFIG,
        processors: [
          // use the write to disk processor to debug the agent's context
          // new WriteToDiskProcessor({ prefix: 'before-filter' }),
          new ToolSummaryProcessor({ summaryModel: config.summaryModel || config.model }),
          new TokenLimiter(100000),
          // new WriteToDiskProcessor({ prefix: 'after-filter' }),
        ],
      }),
    };

    super(agentConfig);
    this.builderConfig = config;
  }

  /**
   * Enhanced generate method with AgentBuilder-specific configuration
   * Overrides the base Agent generate method to provide additional project context
   */
  generate: Agent['generate'] = async (
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    generateOptions: (GenerateAgentOptions & AgentGenerateOptions<any, any>) | undefined = {},
  ): Promise<any> => {
    const { maxSteps, ...baseOptions } = generateOptions;

    const originalInstructions = await this.getInstructions({ runtimeContext: generateOptions?.runtimeContext });
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

    return super.generate(messages, enhancedOptions);
  };

  /**
   * Enhanced stream method with AgentBuilder-specific configuration
   * Overrides the base Agent stream method to provide additional project context
   */
  stream: Agent['stream'] = async (
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    streamOptions: (GenerateAgentOptions & AgentStreamOptions<any, any>) | undefined = {},
  ): Promise<any> => {
    const { maxSteps, ...baseOptions } = streamOptions;

    const originalInstructions = await this.getInstructions({ runtimeContext: streamOptions?.runtimeContext });
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

    return super.stream(messages, enhancedOptions);
  };

  /**
   * Enhanced stream method with AgentBuilder-specific configuration
   * Overrides the base Agent stream method to provide additional project context
   */
  async streamVNext<
    OUTPUT extends OutputSchema | undefined = undefined,
    STRUCTURED_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    FORMAT extends 'mastra' | 'aisdk' | undefined = undefined,
  >(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptions<OUTPUT, STRUCTURED_OUTPUT, FORMAT>,
  ): Promise<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>> {
    const { ...baseOptions } = streamOptions || {};

    const originalInstructions = await this.getInstructions({ runtimeContext: streamOptions?.runtimeContext });
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
    };

    this.logger.debug(`[AgentBuilder:${this.name}] Starting streaming with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.streamVNext(messages, enhancedOptions);
  }

  async generateVNext<
    OUTPUT extends OutputSchema | undefined = undefined,
    STRUCTURED_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    FORMAT extends 'aisdk' | 'mastra' = 'mastra',
  >(
    messages: MessageListInput,
    options?: AgentExecutionOptions<OUTPUT, STRUCTURED_OUTPUT, FORMAT>,
  ): Promise<
    FORMAT extends 'aisdk'
      ? Awaited<ReturnType<AISDKV5OutputStream<OUTPUT>['getFullOutput']>>
      : Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>
  > {
    const { ...baseOptions } = options || {};

    const originalInstructions = await this.getInstructions({ runtimeContext: options?.runtimeContext });
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
    };

    this.logger.debug(`[AgentBuilder:${this.name}] Starting streaming with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.generateVNext(messages, enhancedOptions);
  }
}

import { Agent } from '@mastra/core/agent';
import type {
  AiMessageType,
  AgentGenerateOptions,
  AgentStreamOptions,
  AgentExecutionOptions,
} from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { CoreMessage } from '@mastra/core/llm';
import type { MastraModelOutput, OutputSchema } from '@mastra/core/stream';
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';
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
          ...(await AgentBuilderDefaults.listToolsForMode(config.projectPath, config.mode)),
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
  async stream<OUTPUT extends OutputSchema = undefined>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    const { ...baseOptions } = streamOptions || {};

    const originalInstructions = await this.getInstructions({ requestContext: streamOptions?.requestContext });
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

    return super.stream(messages, enhancedOptions);
  }

  async generate<OUTPUT extends OutputSchema = undefined>(
    messages: MessageListInput,
    options?: AgentExecutionOptions<OUTPUT>,
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
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
    };

    this.logger.debug(`[AgentBuilder:${this.name}] Starting streaming with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.generate(messages, enhancedOptions);
  }
}

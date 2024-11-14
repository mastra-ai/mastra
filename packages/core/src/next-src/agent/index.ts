import { ZodSchema } from 'zod';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import {
  CoreMessage,
  CoreTool as CT,
  generateText,
  LanguageModelV1,
  streamText,
  tool,
} from 'ai';
import { Integration } from '../integration';
import { createLogger, Logger } from '../logger';
import { AllTools, CoreTool, ToolApi } from '../tools/types';

type OpenAIVercelModelNames = 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';

type OpenAIVercelConfig = {
  provider: 'OPEN_AI_VERCEL';
  name: OpenAIVercelModelNames;
  toolChoice: 'auto' | 'required';
};

type AnthropicVercelModelNames =
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-sonnet-20240620';

type AnthropicVercelConfig = {
  provider: 'ANTHROPIC_VERCEL';
  name: AnthropicVercelModelNames;
  toolChoice: 'auto' | 'required';
};

type GroqVercelModelNames =
  | 'llama3-groq-70b-8192-tool-use-preview'
  | 'llama3-groq-8b-8192-tool-use-preview'
  | 'gemma2-9b-it'
  | 'gemma-7b-it';

type GroqVercelConfig = {
  provider: 'GROQ_VERCEL';
  name: GroqVercelModelNames;
  toolChoice: 'auto' | 'required';
};

type ModelConfig =
  | OpenAIVercelConfig
  | AnthropicVercelConfig
  | GroqVercelConfig;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Agent<
  TIntegrations extends Integration[] | undefined = undefined,
  TTools extends Record<string, ToolApi<TIntegrations>> | undefined = undefined,
  TKeys extends keyof AllTools<TIntegrations, TTools> = keyof AllTools<
    TIntegrations,
    TTools
  >
> {
  public name: string;
  readonly instructions: string;
  readonly model: ModelConfig;
  readonly enabledTools: Partial<Record<TKeys, boolean>>;
  #tools: Record<TKeys, ToolApi>;
  logger: Logger;

  constructor(config: {
    name: string;
    instructions: string;
    model: ModelConfig;
    enabledTools?: Partial<Record<TKeys, boolean>>;
  }) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.model = config.model;
    this.enabledTools = config.enabledTools || {};
    this.#tools = {} as Record<TKeys, ToolApi>;
    this.logger = createLogger({ type: 'CONSOLE' });
    this.logger.info(
      `Agent ${this.name} initialized with model ${this.model.provider}`
    );
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: Record<TKeys, ToolApi>) {
    this.#tools = tools;
    this.logger.debug(`Tools set for agent ${this.name}`, tools);
  }

  /**
   * Set the logger for the agent
   * @param logger
   */
  __setLogger(logger: Logger) {
    this.logger = logger;
    this.logger.debug(`Logger updated for agent ${this.name}`);
  }

  private getModelType(): string {
    const providerToType: Record<string, string> = {
      OPEN_AI_VERCEL: 'openai',
      ANTHROPIC_VERCEL: 'anthropic',
      GROQ_VERCEL: 'groq',
      PERPLEXITY_VERCEL: 'perplexity',
      FIREWORKS_VERCEL: 'fireworks',
    };
    const type = providerToType[this.model.provider] || 'openai';
    this.logger.debug(
      `Model type resolved to ${type} for provider ${this.model.provider}`
    );
    return type;
  }

  private convertTools(): Record<TKeys, CoreTool> {
    const converted = Object.entries(this.enabledTools).reduce(
      (memo, value) => {
        const k = value[0] as TKeys;
        const enabled = value[1] as boolean;
        const tool = this.#tools[k];

        if (enabled && tool) {
          memo[k] = {
            description: tool.description,
            parameters: tool.schema,
            execute: tool.executor,
          };
        }
        return memo;
      },
      {} as Record<TKeys, CoreTool>
    );

    this.logger.debug(`Converted tools for agent ${this.name}`, converted);
    return converted;
  }

  private getAgentParams({
    tools,
    resultTool,
    model,
  }: {
    tools: Record<string, CoreTool>;
    resultTool?: { description: string; parameters: ZodSchema };
    model: { type: string; name?: string; toolChoice?: 'auto' | 'required' };
  }) {
    const toolsConverted = Object.entries(tools).reduce((memo, [key, val]) => {
      memo[key] = tool(val);
      return memo;
    }, {} as Record<string, CT>);

    let answerTool = {};
    if (resultTool) {
      answerTool = { answer: tool(resultTool) };
    }

    let modelDef: LanguageModelV1;
    if (model.type === 'openai') {
      this.logger.info(
        `Initializing OpenAI model ${model.name || 'gpt-4o-2024-08-06'}`
      );
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      modelDef = openai(model.name || 'gpt-4o-2024-08-06', {
        structuredOutputs: true,
      });
    } else if (model.type === 'anthropic') {
      this.logger.info(
        `Initializing Anthropic model ${
          model.name || 'claude-3-5-sonnet-20240620'
        }`
      );
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      modelDef = anthropic(model.name || 'claude-3-5-sonnet-20240620');
    } else if (model.type === 'groq') {
      this.logger.info(
        `Initializing Groq model ${model.name || 'llama-3.2-90b-text-preview'}`
      );
      modelDef = this.createOpenAICompatibleModel(
        'https://api.groq.com/openai/v1',
        process.env.GROQ_API_KEY ?? '',
        'llama-3.2-90b-text-preview',
        model.name
      );
    } else if (model.type === 'perplexity') {
      this.logger.info(
        `Initializing Perplexity model ${
          model.name || 'llama-3.1-sonar-large-128k-chat'
        }`
      );
      modelDef = this.createOpenAICompatibleModel(
        'https://api.perplexity.ai/',
        process.env.PERPLEXITY_API_KEY ?? '',
        'llama-3.1-sonar-large-128k-chat',
        model.name
      );
    } else if (model.type === 'fireworks') {
      this.logger.info(
        `Initializing Fireworks model ${
          model.name || 'llama-v3p1-70b-instruct'
        }`
      );
      modelDef = this.createOpenAICompatibleModel(
        'https://api.fireworks.ai/inference/v1',
        process.env.FIREWORKS_API_KEY ?? '',
        'llama-v3p1-70b-instruct',
        model.name
      );
    } else {
      const error = `Invalid model type: ${model.type}`;
      this.logger.error(error);
      throw new Error(error);
    }

    return {
      toolsConverted,
      modelDef,
      answerTool,
      toolChoice: model.toolChoice || 'required',
    };
  }

  private createOpenAICompatibleModel(
    baseURL: string,
    apiKey: string,
    defaultModelName: string,
    modelName?: string
  ) {
    this.logger.debug(
      `Creating OpenAI compatible model with baseURL: ${baseURL}`
    );
    const client = createOpenAI({
      baseURL,
      apiKey,
    });
    return client(modelName || defaultModelName);
  }

  async text({
    messages,
    onStepFinish,
    maxSteps = 5,
  }: {
    messages: string[];
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting text generation for agent ${this.name}`);
    const params = this.getAgentParams({
      tools: this.convertTools(),
      model: {
        type: this.getModelType(),
        name: this.model.name,
        toolChoice: this.model.toolChoice,
      },
    });

    const argsForExecute = {
      model: params.modelDef,
      tools: {
        ...params.toolsConverted,
        ...params.answerTool,
      },
      toolChoice: params.toolChoice,
      maxSteps,
      onStepFinish: async (props: any) => {
        onStepFinish?.(JSON.stringify(props, null, 2));
        if (
          props?.response?.headers?.['x-ratelimit-remaining-tokens'] &&
          parseInt(
            props?.response?.headers?.['x-ratelimit-remaining-tokens'],
            10
          ) < 2000
        ) {
          this.logger.warn('Rate limit approaching, waiting 10 seconds');
          await delay(10 * 1000);
        }
      },
    };

    const messageObjects: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content,
    }));

    messageObjects.push({
      role: 'system',
      content: this.instructions,
    });

    this.logger.debug(`Generating text with ${messageObjects.length} messages`);
    return await generateText({
      messages: messageObjects,
      ...argsForExecute,
    });
  }

  async stream({
    messages,
    onStepFinish,
    maxSteps = 5,
  }: {
    messages: string[];
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting stream generation for agent ${this.name}`);
    const params = this.getAgentParams({
      tools: this.convertTools(),
      model: {
        type: this.getModelType(),
        name: this.model.name,
        toolChoice: this.model.toolChoice,
      },
    });

    const argsForExecute = {
      model: params.modelDef,
      tools: {
        ...params.toolsConverted,
        ...params.answerTool,
      },
      toolChoice: params.toolChoice,
      maxSteps,
      onStepFinish: async (props: any) => {
        onStepFinish?.(JSON.stringify(props, null, 2));
        if (
          props?.response?.headers?.['x-ratelimit-remaining-tokens'] &&
          parseInt(
            props?.response?.headers?.['x-ratelimit-remaining-tokens'],
            10
          ) < 2000
        ) {
          this.logger.warn('Rate limit approaching, waiting 10 seconds');
          await delay(10 * 1000);
        }
      },
    };

    const messageObjects: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content,
    }));

    messageObjects.push({
      role: 'system',
      content: this.instructions,
    });

    this.logger.debug(`Streaming text with ${messageObjects.length} messages`);
    return await streamText({
      messages: messageObjects,
      ...argsForExecute,
    });
  }
}

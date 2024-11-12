import { z, ZodSchema } from 'zod';
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CoreTool = {
  description: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};

export interface IntegrationApiExcutorParams<
  T extends Record<string, any> = Record<string, any>
> {
  data: T;
}

export type ToolApi<
  IN extends Record<string, any> = Record<string, any>,
  OUT extends Record<string, any> = Record<string, any>
> = {
  // integrationName: string;
  schema: ZodSchema<IN>;
  // | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<IN>>);
  //   outputSchema?:
  //     | ZodSchema
  //     | (({ ctx }: { ctx: IntegrationContext }) => Promise<ZodSchema<OUT>>);
  //   type: string;
  label: string;
  //   getSchemaOptions?: ({
  //     ctx,
  //   }: {
  //     ctx: IntegrationContext;
  //   }) => Promise<Record<string, SchemaFieldOptions>>;
  //   icon?: frameWorkIcon;
  description: string;
  documentation?: string;
  //   category?: string;
  executor: (params: IntegrationApiExcutorParams<IN>) => Promise<OUT>;
  //   isHidden?: boolean;
  //   source?: string;
};

type ToolRecord = Record<
  string,
  ToolApi<Record<string, any>, Record<string, any>>
>;

export function createTool(opts: ToolApi): ToolApi {
  return opts;
}

export abstract class Integration {
  abstract readonly tools: Record<string, ToolApi>;
  name: string = '';
  logoUrl: string = '';
  authType: string = 'API_KEY';

  constructor({ logoUrl, name }: { name: string; logoUrl: string }) {
    this.name = name;
    this.logoUrl = logoUrl;
  }

  protected get toolSchemas(): any {
    return {};
  }

  protected get toolDocumentations(): Record<
    string,
    { comment: string; doc?: string }
  > {
    return {};
  }

  protected get baseClient(): any {
    return {};
  }

  protected _generateIntegrationTools() {
    const { client, ...clientMethods } = this.baseClient;
    const schemas = this.toolSchemas;
    const documentations = this.toolDocumentations;

    const tools = Object.keys(clientMethods).reduce((acc, key) => {
      const comment = documentations[key]?.comment;
      const doc = documentations[key]?.doc;
      const fallbackComment = `Execute ${key}`;

      const tool = createTool({
        label: key,
        schema: schemas[key] || z.object({}),
        description: comment || fallbackComment,
        documentation: doc || fallbackComment,
        executor: async () => {
          //TODO: Implement executor
          return {};
        },
      });

      return { ...acc, [key]: tool };
    }, {});

    return tools;
  }
}

// Helper to extract tools from array of integrations
type IntegrationTools<T extends Integration> = T['tools'];

// Helper to merge all tools from array of integrations
type MergeIntegrationTools<T extends Integration[]> = UnionToIntersection<
  IntegrationTools<T[number]>
>;

// Helper for union to intersection conversion
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

export class GmailIntegration extends Integration {
  constructor(config: { apiKey: string }) {
    super({
      name: 'Gmail',
      logoUrl: '',
    });
  }

  readonly tools = {
    gmailGetProfile: createTool({
      label: 'Get Gmail Profile',
      schema: z.object({}),
      description: 'Get the profile of the authenticated user',
      executor: async () => {
        return { email: '' };
      },
    }),
  } as const;
}

// Helper to merge custom tools with integration tools
type AllTools<
  TTools extends ToolRecord | undefined = undefined,
  TIntegrations extends Integration[] | undefined = undefined
> = (TTools extends ToolRecord ? TTools : {}) &
  (TIntegrations extends Integration[]
    ? MergeIntegrationTools<TIntegrations>
    : {});

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

export class Agent<
  TTools extends Record<string, ToolApi> | undefined = undefined,
  TIntegrations extends Integration[] | undefined = undefined,
  TKeys extends keyof AllTools<TTools, TIntegrations> = keyof AllTools<
    TTools,
    TIntegrations
  >
> {
  public name: string;
  readonly instructions: string;
  readonly model: ModelConfig;
  readonly enabledTools: Partial<Record<TKeys, boolean>>;
  #tools: Record<TKeys, ToolApi>;

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
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: Record<TKeys, ToolApi>) {
    this.#tools = tools;
  }

  private getModelType(): string {
    const providerToType: Record<string, string> = {
      OPEN_AI_VERCEL: 'openai',
      ANTHROPIC_VERCEL: 'anthropic',
      GROQ_VERCEL: 'groq',
      PERPLEXITY_VERCEL: 'perplexity',
      FIREWORKS_VERCEL: 'fireworks',
    };
    return providerToType[this.model.provider] || 'openai';
  }

  private convertTools(): Record<TKeys, CoreTool> {
    return Object.entries(this.enabledTools).reduce((memo, value) => {
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
    }, {} as Record<TKeys, CoreTool>);
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
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      modelDef = openai(model.name || 'gpt-4o-2024-08-06', {
        structuredOutputs: true,
      });
    } else if (model.type === 'anthropic') {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      modelDef = anthropic(model.name || 'claude-3-5-sonnet-20240620');
    } else if (model.type === 'groq') {
      modelDef = this.createOpenAICompatibleModel(
        'https://api.groq.com/openai/v1',
        process.env.GROQ_API_KEY ?? '',
        'llama-3.2-90b-text-preview',
        model.name
      );
    } else if (model.type === 'perplexity') {
      modelDef = this.createOpenAICompatibleModel(
        'https://api.perplexity.ai/',
        process.env.PERPLEXITY_API_KEY ?? '',
        'llama-3.1-sonar-large-128k-chat',
        model.name
      );
    } else if (model.type === 'fireworks') {
      modelDef = this.createOpenAICompatibleModel(
        'https://api.fireworks.ai/inference/v1',
        process.env.FIREWORKS_API_KEY ?? '',
        'llama-v3p1-70b-instruct',
        model.name
      );
    } else {
      throw new Error('Invalid model type');
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
          console.log('Rate limit reached, waiting 10 seconds');
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
          console.log('Rate limit reached, waiting 10 seconds');
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

    return await streamText({
      messages: messageObjects,
      ...argsForExecute,
    });
  }
}

export class Mastra<
  MastraTools extends Record<string, ToolApi>,
  TIntegrations extends Integration[]
> {
  private tools: AllTools<MastraTools, TIntegrations>;
  private agents: Map<string, Agent<MastraTools, TIntegrations>>;
  private integrations: Map<string, Integration>;

  constructor(config: {
    tools: MastraTools;
    agents: Agent<MastraTools, TIntegrations>[];
    integrations: TIntegrations;
  }) {
    // Merge custom tools with integration tools
    this.tools = {
      ...(config.tools || {}),
      ...(config.integrations?.reduce(
        (acc, integration) => ({
          ...acc,
          ...integration.tools,
        }),
        {}
      ) || {}),
    } as AllTools<MastraTools, TIntegrations>;

    this.agents = new Map();

    config.agents.forEach((agent) => {
      if (this.agents.has(agent.name)) {
        throw new Error(`Agent with name ${agent.name} already exists`);
      }
      this.agents.set(agent.name, agent);
      agent.__setTools(this.tools);
    });

    this.integrations = new Map();

    config.integrations.forEach((integration) => {
      if (this.integrations.has(integration.name)) {
        throw new Error(
          `Integration with name ${integration.name} already exists`
        );
      }
      this.integrations.set(integration.name, integration);
    });
  }

  public getAgent(name: string) {
    return this.agents.get(name);
  }

  public getIntegration(name: string) {
    return this.integrations.get(name);
  }

  public availableIntegrations() {
    return Array.from(this.integrations.entries()).map(
      ([name, integration]) => {
        return {
          name,
          integration,
        };
      }
    );
  }

  public getTools() {
    return this.tools;
  }
}

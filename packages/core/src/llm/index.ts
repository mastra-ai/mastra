import type {
  EmbedManyResult as AiEmbedManyResult,
  EmbedResult as AiEmbedResult,
  CoreAssistantMessage as AiCoreAssistantMessage,
  CoreMessage as AiCoreMessage,
  CoreSystemMessage as AiCoreSystemMessage,
  CoreToolMessage as AiCoreToolMessage,
  CoreUserMessage as AiCoreUserMessage,
  UIMessage,
  streamText,
  streamObject,
  generateText,
  generateObject,
  StreamTextOnFinishCallback,
  StreamObjectOnFinishCallback,
} from '@internal/ai-sdk-v4';
import type { SystemModelMessage } from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { ObservabilityContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { Run } from '../run/types';
import type { CoreTool } from '../tools/types';
import type { MastraLanguageModel } from './model/shared.types';

export type LanguageModel = MastraLanguageModel;

export type CoreMessage = AiCoreMessage;

export type CoreSystemMessage = AiCoreSystemMessage;

export type CoreAssistantMessage = AiCoreAssistantMessage;

export type CoreUserMessage = AiCoreUserMessage;

export type CoreToolMessage = AiCoreToolMessage;

export type EmbedResult<T> = AiEmbedResult<T>;

export type EmbedManyResult<T> = AiEmbedManyResult<T>;

export type BaseStructuredOutputType = 'string' | 'number' | 'boolean' | 'date';

export type StructuredOutputType = 'array' | 'string' | 'number' | 'object' | 'boolean' | 'date';

export type StructuredOutputArrayItem =
  | {
      type: BaseStructuredOutputType;
    }
  | {
      type: 'object';
      items: StructuredOutput;
    };

export type StructuredOutput = {
  [key: string]:
    | {
        type: BaseStructuredOutputType;
      }
    | {
        type: 'object';
        items: StructuredOutput;
      }
    | {
        type: 'array';
        items: StructuredOutputArrayItem;
      };
};

export type {
  GenerateReturn,
  StreamReturn,
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
} from './model/base.types';
export type { TripwireProperties, MastraModelConfig, OpenAICompatibleConfig } from './model/shared.types';
export { ModelRouterLanguageModel } from './model/router';
export { PROVIDER_REGISTRY, parseModelString, getProviderConfig } from './model/provider-registry.js';
export { resolveModelConfig } from './model/resolve-model';

export type OutputType = StructuredOutput | ZodSchema | JSONSchema7 | undefined;

export type SystemMessage =
  | string
  | string[]
  | CoreSystemMessage
  | SystemModelMessage
  | CoreSystemMessage[]
  | SystemModelMessage[];

type GenerateTextOptions = Parameters<typeof generateText>[0];
type StreamTextOptions = Parameters<typeof streamText>[0];
type GenerateObjectOptions = Parameters<typeof generateObject>[0];
type StreamObjectOptions = Parameters<typeof streamObject>[0];

type MastraCustomLLMOptionsKeys =
  | 'messages'
  | 'tools'
  | 'model'
  | 'onStepFinish'
  | 'experimental_output'
  | 'messages'
  | 'onFinish'
  | 'output';

export type DefaultLLMTextOptions = Omit<GenerateTextOptions, MastraCustomLLMOptionsKeys>;
export type DefaultLLMTextObjectOptions = Omit<GenerateObjectOptions, MastraCustomLLMOptionsKeys>;
export type DefaultLLMStreamOptions = Omit<StreamTextOptions, MastraCustomLLMOptionsKeys>;
export type DefaultLLMStreamObjectOptions = Omit<StreamObjectOptions, MastraCustomLLMOptionsKeys>;

type MastraCustomLLMOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = ObservabilityContext & {
  tools?: Record<string, CoreTool>;
  onStepFinish?: (step: unknown) => Promise<void> | void;
  experimental_output?: Z;
  threadId?: string;
  resourceId?: string;
  requestContext: RequestContext;
} & Run;

export type LLMTextOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  messages: UIMessage[] | CoreMessage[];
} & MastraCustomLLMOptions<Z> &
  DefaultLLMTextOptions;

export type LLMTextObjectOptions<T extends ZodSchema | JSONSchema7 | undefined = undefined> = LLMTextOptions<T> &
  DefaultLLMTextObjectOptions & {
    structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
  };

export type LLMStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  output?: OutputType | Z;
  onFinish?: StreamTextOnFinishCallback<any>;
} & MastraCustomLLMOptions<Z> &
  DefaultLLMStreamOptions;

export type LLMInnerStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  messages: UIMessage[] | CoreMessage[];
} & MastraCustomLLMOptions<Z> &
  DefaultLLMStreamOptions;

export type LLMStreamObjectOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  structuredOutput: JSONSchema7 | z.ZodType<Z> | StructuredOutput;
  onFinish?: StreamObjectOnFinishCallback<any>;
} & LLMInnerStreamOptions<Z> &
  DefaultLLMStreamObjectOptions;

export type { ProviderConfig, GatewayLanguageModel } from './model/gateways/base';
export { MastraModelGateway, NetlifyGateway, ModelsDevGateway, AzureOpenAIGateway } from './model/gateways';
export type { AzureOpenAIGatewayConfig } from './model/gateways';

export { ModelRouterEmbeddingModel, type EmbeddingModelId, EMBEDDING_MODELS, type EmbeddingModelInfo } from './model';

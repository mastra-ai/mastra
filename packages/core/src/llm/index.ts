import type {
  CoreAssistantMessage as AiCoreAssistantMessage,
  CoreMessage as AiCoreMessage,
  CoreSystemMessage as AiCoreSystemMessage,
  CoreToolMessage as AiCoreToolMessage,
  CoreUserMessage as AiCoreUserMessage,
  EmbedManyResult as AiEmbedManyResult,
  EmbedResult as AiEmbedResult,
  TelemetrySettings,
  streamText,
  streamObject,
  generateText,
  generateObject,
  UIMessage,
  StreamTextOnFinishCallback,
  StreamObjectOnFinishCallback,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { TracingContext } from '../ai-tracing';
import type { Run } from '../run/types';
import type { RuntimeContext } from '../runtime-context';
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
export type { TripwireProperties } from './model/shared.types';

export type OutputType = StructuredOutput | ZodSchema | JSONSchema7 | undefined;

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
  | 'experimental_telemetry'
  | 'messages'
  | 'onFinish'
  | 'output';

export type DefaultLLMTextOptions = Omit<GenerateTextOptions, MastraCustomLLMOptionsKeys>;
export type DefaultLLMTextObjectOptions = Omit<GenerateObjectOptions, MastraCustomLLMOptionsKeys>;
export type DefaultLLMStreamOptions = Omit<StreamTextOptions, MastraCustomLLMOptionsKeys>;
export type DefaultLLMStreamObjectOptions = Omit<StreamObjectOptions, MastraCustomLLMOptionsKeys>;

type MastraCustomLLMOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  tools?: Record<string, CoreTool>;
  onStepFinish?: (step: unknown) => Promise<void> | void;
  experimental_output?: Z;
  telemetry?: TelemetrySettings;
  threadId?: string;
  resourceId?: string;
  runtimeContext: RuntimeContext;
  tracingContext: TracingContext;
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

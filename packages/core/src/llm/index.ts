import type {
  CoreAssistantMessage as AiCoreAssistantMessage,
  CoreMessage as AiCoreMessage,
  CoreSystemMessage as AiCoreSystemMessage,
  CoreToolMessage as AiCoreToolMessage,
  CoreUserMessage as AiCoreUserMessage,
  EmbedManyResult as AiEmbedManyResult,
  EmbedResult as AiEmbedResult,
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
  TelemetrySettings,
  streamText,
  streamObject,
  generateText,
  generateObject,
  StopCondition,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { MastraLanguageModel } from '../agent/types';
import type { Run } from '../run/types';
import type { RuntimeContext } from '../runtime-context';
import type { ConvertedCoreTool } from '../tools/types';

export { createMockModel } from './model/mock';

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

export type GenerateReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? GenerateTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>
  : GenerateObjectResult<Z extends ZodSchema ? z.infer<Z> : unknown>;

export type StreamReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? StreamTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>
  : StreamObjectResult<any, Z extends ZodSchema ? z.infer<Z> : unknown, any>;

export type OutputType = StructuredOutput | ZodSchema | JSONSchema7 | undefined;

type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
type JSONObject = {
  [key: string]: JSONValue;
};
type JSONArray = JSONValue[];

// without <any> there's extremely deep type recursion happening here.
// not sure if there's a better fix than any, or if we even need one
type GenerateTextOptions = Parameters<typeof generateText<any, any, any>>[0];
type StreamTextOptions = Parameters<typeof streamText<any, any, any>>[0];
type GenerateObjectOptions = Parameters<typeof generateObject<any, any, any>>[0];
type StreamObjectOptions = Parameters<typeof streamObject<any, any, any>>[0];

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

export type StopConditionArgs = {
  // maxSteps was replaced with stopWhen. mapping it to stopWhen: stepCountIs(maxSteps) for now to make this easier on us
  maxSteps?: number;
  stopWhen?:
    | ((StopCondition<any> | StopCondition<any>[]) & (StopCondition<any> | StopCondition<any>[] | undefined))
    | undefined;
};

type MastraCustomLLMOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  tools?: Record<string, ConvertedCoreTool>;
  onStepFinish?: (step: unknown) => Promise<void> | void;
  experimental_output?: Z;
  telemetry?: TelemetrySettings;
  threadId?: string;
  resourceId?: string;
  runtimeContext: RuntimeContext;
} & Run &
  StopConditionArgs;

export type LLMTextOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  messages: CoreMessage[];
} & MastraCustomLLMOptions<Z> &
  DefaultLLMTextOptions;

export type LLMTextObjectOptions<T extends ZodSchema | JSONSchema7 | undefined = undefined> = LLMTextOptions<T> &
  DefaultLLMTextObjectOptions & {
    structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
  };

export type LLMStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  output?: OutputType | Z;
  onFinish?: (result: string) => Promise<void> | void;
} & MastraCustomLLMOptions<Z> &
  DefaultLLMStreamOptions;

export type LLMInnerStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  messages: CoreMessage[];
  onFinish?: (result: string) => Promise<void> | void;
} & MastraCustomLLMOptions<Z> &
  DefaultLLMStreamOptions;

export type LLMStreamObjectOptions<T extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
} & LLMInnerStreamOptions<T> &
  DefaultLLMStreamObjectOptions;

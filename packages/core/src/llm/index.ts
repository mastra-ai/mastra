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
  LanguageModelV1,
  StreamObjectResult,
  StreamTextResult,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { ToolsInput } from '../agent/types';
import type { Run } from '../run/types';
import type { CoreTool } from '../tools/types';

export type LanguageModel = LanguageModelV1;

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
  ? GenerateTextResult<any, any>
  : GenerateObjectResult<any>;

export type StreamReturn<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = Z extends undefined
  ? StreamTextResult<any, any>
  : StreamObjectResult<any, any, any>;

export type OutputType = 'text' | StructuredOutput | ZodSchema | JSONSchema7 | undefined;

export type LLMTextOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => void;
  toolChoice?: 'auto' | 'required';
  maxSteps?: number;
  temperature?: number;
  experimental_output?: Z;
} & Run;

export type LLMTextObjectOptions<T> = LLMTextOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
};

export type LLMStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  runId?: string;
  onFinish?: (result: string) => Promise<void> | void;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  output?: OutputType | Z;
  temperature?: number;
  experimental_output?: Z;
};

export type LLMInnerStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => unknown;
  onFinish?: (result: string) => unknown;
  maxSteps?: number;
  temperature?: number;
  toolChoice?: 'auto' | 'required';
  experimental_output?: Z;
} & Run;

export type LLMStreamObjectOptions<T> = LLMInnerStreamOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
};

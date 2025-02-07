import { CoreAssistantMessage as AiCoreAssistantMessage, CoreMessage as AiCoreMessage, CoreSystemMessage as AiCoreSystemMessage, CoreToolMessage as AiCoreToolMessage, CoreUserMessage as AiCoreUserMessage, EmbedManyResult as AiEmbedManyResult, EmbedResult as AiEmbedResult, GenerateObjectResult, GenerateTextResult, LanguageModelV1, StreamObjectResult, StreamTextResult } from 'ai';
import { JSONSchema7 } from 'json-schema';
import { z, ZodSchema } from 'zod';



import { ToolsInput } from '../agent/types';
import { Run } from '../run/types';
import { CoreTool } from '../tools/types';


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

export type OutputType = 'text' | StructuredOutput;

export type LLMStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> = {
  runId?: string;
  onFinish?: (result: string) => Promise<void> | void;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  output?: OutputType | Z;
  temperature?: number;
};

export type LLMTextOptions = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => void;
  toolChoice?: 'auto' | 'required';
  maxSteps?: number;
  temperature?: number;
} & Run;

export type LLMTextObjectOptions<T> = LLMTextOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
};

export type LLMInnerStreamOptions = {
  tools?: ToolsInput;
  convertedTools?: Record<string, CoreTool>;
  messages: CoreMessage[];
  onStepFinish?: (step: string) => void;
  onFinish?: (result: string) => Promise<void> | void;
  maxSteps?: number;
  temperature?: number;
  toolChoice?: 'auto' | 'required';
} & Run;

export type LLMStreamObjectOptions<T> = LLMInnerStreamOptions & {
  structuredOutput: JSONSchema7 | z.ZodType<T> | StructuredOutput;
};
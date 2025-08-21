import type {
  ModelMessage,
  UIMessage,
  ToolSet,
  DeepPartial,
  streamText,
  StreamTextOnFinishCallback as OriginalStreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback as OriginalStreamTextOnStepFinishCallback,
} from 'ai-v5';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import type { LoopOptions } from '../../loop/types';
import type { StructuredOutputOptions, OutputProcessor } from '../../processors';
import type { RuntimeContext } from '../../runtime-context';
import type { inferOutput } from './shared.types';

export type OriginalStreamTextOptions<
  TOOLS extends ToolSet,
  Output extends ZodSchema | JSONSchema7 | undefined = undefined,
> = Parameters<typeof streamText<TOOLS, inferOutput<Output>, DeepPartial<inferOutput<Output>>>>[0];

export type OriginalStreamTextOnFinishEventArg<Tools extends ToolSet> = Parameters<
  OriginalStreamTextOnFinishCallback<Tools>
>[0];

export type StreamTextOnFinishCallback<Tools extends ToolSet> = (
  event: OriginalStreamTextOnFinishEventArg<Tools> & { runId: string },
) => Promise<void> | void;

export type StreamTextOnStepFinishCallback<Tools extends ToolSet> = (
  event: Parameters<OriginalStreamTextOnStepFinishCallback<Tools>>[0] & { runId: string },
) => Promise<void> | void;

export type ModelLoopStreamArgs<
  Tools extends ToolSet,
  Output extends ZodSchema | JSONSchema7 | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  messages: UIMessage[] | ModelMessage[];
  output?: Output;
  structuredOutput?: STRUCTURED_OUTPUT extends z.ZodTypeAny ? StructuredOutputOptions<STRUCTURED_OUTPUT> : never;
  outputProcessors?: OutputProcessor[];
  runtimeContext: RuntimeContext;
  resourceId?: string;
  threadId?: string;
} & Omit<LoopOptions<Tools>, 'model' | 'messageList'>;

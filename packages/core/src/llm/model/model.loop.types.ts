import type {
  ToolSet,
  DeepPartial,
  streamText,
  StreamTextOnFinishCallback as OriginalStreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback as OriginalStreamTextOnStepFinishCallback,
  ModelMessage,
  UIMessage,
} from 'ai-v5';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import type { MessageList } from '../../agent';
import type { TracingContext } from '../../ai-tracing';
import type { LoopOptions } from '../../loop/types';
import type { StructuredOutputOptions, OutputProcessor } from '../../processors';
import type { RuntimeContext } from '../../runtime-context';
import type { OutputSchema } from '../../stream/base/schema';
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
  TOOLS extends ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  messages?: UIMessage[] | ModelMessage[];
  structuredOutput?: STRUCTURED_OUTPUT extends z.ZodTypeAny ? StructuredOutputOptions<STRUCTURED_OUTPUT> : never;
  outputProcessors?: OutputProcessor[];
  runtimeContext: RuntimeContext;
  tracingContext: TracingContext;
  resourceId?: string;
  threadId?: string;
  returnScorerData?: boolean;
  messageList: MessageList;
} & Omit<LoopOptions<TOOLS, OUTPUT>, 'models' | 'messageList'>;

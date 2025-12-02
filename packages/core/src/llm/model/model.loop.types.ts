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
import type { ZodSchema } from 'zod';
import type { MessageList } from '../../agent';
import type { LoopOptions } from '../../loop/types';
import type { TracingContext } from '../../observability';
import type { OutputProcessor } from '../../processors';
import type { RequestContext } from '../../request-context';
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

export type ModelLoopStreamArgs<TOOLS extends ToolSet, OUTPUT extends OutputSchema = undefined> = {
  methodType: ModelMethodType;
  messages?: UIMessage[] | ModelMessage[];
  outputProcessors?: OutputProcessor[];
  requestContext: RequestContext;
  tracingContext: TracingContext;
  resourceId?: string;
  threadId?: string;
  returnScorerData?: boolean;
  messageList: MessageList;
} & Omit<LoopOptions<TOOLS, OUTPUT>, 'models' | 'messageList'>;

export type ModelMethodType = 'generate' | 'stream';

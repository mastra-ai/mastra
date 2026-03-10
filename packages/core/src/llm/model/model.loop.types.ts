import type {
  ToolSet,
  DeepPartial,
  streamText,
  StreamTextOnFinishCallback as OriginalStreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback as OriginalStreamTextOnStepFinishCallback,
  ModelMessage,
  UIMessage,
} from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod/v3';
import type { MessageList } from '../../agent';
import type { LoopOptions } from '../../loop/types';
import type { ObservabilityContext } from '../../observability';
import type { OutputProcessorOrWorkflow } from '../../processors';
import type { RequestContext } from '../../request-context';
import type { StandardSchemaWithJSON } from '../../schema';
import type { inferOutput } from './shared.types';

export type OriginalStreamTextOptions<
  TOOLS extends ToolSet,
  Output extends StandardSchemaWithJSON | ZodSchema | JSONSchema7 | undefined = undefined,
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

export type ModelLoopStreamArgs<TOOLS extends ToolSet, OUTPUT = undefined> = {
  methodType: ModelMethodType;
  messages?: UIMessage[] | ModelMessage[];
  outputProcessors?: OutputProcessorOrWorkflow[];
  requestContext: RequestContext;
  resourceId?: string;
  threadId?: string;
  returnScorerData?: boolean;
  messageList: MessageList;
} & ObservabilityContext &
  Omit<LoopOptions<TOOLS, OUTPUT>, 'models' | 'messageList'>;

export type ModelMethodType = 'generate' | 'stream';

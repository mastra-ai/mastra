import type { UIMessage, UIMessageStreamOptions } from '@mastra/core/ai';
import type { MastraModelOutput, ChunkType, WorkflowRunOutput } from '@mastra/core/stream';
import type { MastraWorkflowStream, Step, WorkflowResult } from '@mastra/core/workflows';
import type { ZodObject, ZodType } from 'zod/v4';
import type { UIMessageStream, WithTraceId } from './public-types';
import { applyMastraStreamTransforms } from './smooth-stream';
import type { MastraStreamTransformOptions } from './smooth-stream';
import { AgentStreamToAISDKTransformer, WorkflowStreamToAISDKTransformer } from './transformers';

type WorkflowStreamOptions = {
  from: 'workflow';
  includeTextStreamParts?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
};

type AgentStreamOptions = {
  from: 'agent';
  lastMessageId?: string;
  sendStart?: boolean;
  sendFinish?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
  /** When true, sub-agent runs are emitted as data-tool-agent parts with ancestry metadata. */
  includeSubAgentMetadata?: boolean;
  /** Experimental transforms applied to Mastra chunks before AI SDK UI conversion. */
  experimentalTransform?: MastraStreamTransformOptions<any>;
  messageMetadata?: WithTraceId<UIMessageStreamOptions<UIMessage>['messageMetadata']>;
  onError?: UIMessageStreamOptions<UIMessage>['onError'];
};

type ToAISDKStreamOptions = WorkflowStreamOptions | AgentStreamOptions;

export function toAISdkStream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(stream: MastraWorkflowStream<TState, TInput, TOutput, TSteps>, options: WorkflowStreamOptions): UIMessageStream;
export function toAISdkStream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>,
  options: WorkflowStreamOptions,
): UIMessageStream;
export function toAISdkStream<TOutput>(
  stream: MastraModelOutput<TOutput>,
  options: AgentStreamOptions,
): UIMessageStream;
export function toAISdkStream(
  stream:
    | WorkflowRunOutput<WorkflowResult<any, any, any, any>>
    | MastraWorkflowStream<any, any, any, any>
    | MastraModelOutput,
  options: ToAISDKStreamOptions = {
    from: 'agent',
    sendStart: true,
    sendFinish: true,
  },
): UIMessageStream {
  if (options.from === 'workflow') {
    const workflowStream =
      'fullStream' in stream
        ? (stream as WorkflowRunOutput<any>).fullStream
        : (stream as ReadableStream<ChunkType<any>>);

    return workflowStream.pipeThrough(
      WorkflowStreamToAISDKTransformer({
        includeTextStreamParts: options.includeTextStreamParts ?? true,
        sendReasoning: options.sendReasoning,
        sendSources: options.sendSources,
      }),
    ) as UIMessageStream;
  }

  const agentReadable: ReadableStream<ChunkType<any>> =
    'fullStream' in stream ? (stream as MastraModelOutput<any>).fullStream : (stream as ReadableStream<ChunkType<any>>);
  return applyMastraStreamTransforms(agentReadable, options.experimentalTransform).pipeThrough(
    AgentStreamToAISDKTransformer<any>({
      lastMessageId: options.lastMessageId,
      sendStart: options.sendStart,
      sendFinish: options.sendFinish,
      sendReasoning: options.sendReasoning,
      sendSources: options.sendSources,
      messageMetadata: options.messageMetadata,
      onError: options.onError,
      includeSubAgentMetadata: options.includeSubAgentMetadata,
    }),
  ) as UIMessageStream;
}

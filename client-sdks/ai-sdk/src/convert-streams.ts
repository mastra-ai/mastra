import type {
  InferUIMessageChunk as InferUIMessageChunkV5,
  UIMessage as UIMessageV5,
  UIMessageStreamOptions as UIMessageStreamOptionsV5,
} from '@internal/ai-sdk-v5';
import type {
  InferUIMessageChunk as InferUIMessageChunkV6,
  UIMessage as UIMessageV6,
  UIMessageStreamOptions as UIMessageStreamOptionsV6,
} from '@internal/ai-v6';
import type { MastraModelOutput, ChunkType, MastraAgentNetworkStream, WorkflowRunOutput } from '@mastra/core/stream';
import type { MastraWorkflowStream, Step, WorkflowResult } from '@mastra/core/workflows';
import type { ZodObject, ZodType } from 'zod/v4';
import type { V6UIMessageStream } from './public-types';
import {
  AgentNetworkToAISDKTransformer,
  AgentStreamToAISDKTransformer,
  WorkflowStreamToAISDKTransformer,
  AgentNetworkToAISDKV6Transformer,
  AgentStreamToAISDKV6Transformer,
  WorkflowStreamToAISDKV6Transformer,
} from './transformers';

type WorkflowStreamOptionsBase = {
  from: 'workflow';
  includeTextStreamParts?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
};

type WorkflowStreamOptionsV5 = WorkflowStreamOptionsBase & {
  version?: 'v5';
};

type WorkflowStreamOptionsV6 = WorkflowStreamOptionsBase & {
  version: 'v6';
};

type NetworkStreamOptionsBase = {
  from: 'network';
};

type NetworkStreamOptionsV5 = NetworkStreamOptionsBase & {
  version?: 'v5';
};

type NetworkStreamOptionsV6 = NetworkStreamOptionsBase & {
  version: 'v6';
};

type AgentStreamOptionsBase = {
  from: 'agent';
  lastMessageId?: string;
  sendStart?: boolean;
  sendFinish?: boolean;
  sendReasoning?: boolean;
  sendSources?: boolean;
};

type AgentStreamOptionsV5 = AgentStreamOptionsBase & {
  version?: 'v5';
  messageMetadata?: UIMessageStreamOptionsV5<UIMessageV5>['messageMetadata'];
  onError?: UIMessageStreamOptionsV5<UIMessageV5>['onError'];
};

type AgentStreamOptionsV6 = AgentStreamOptionsBase & {
  version: 'v6';
  messageMetadata?: UIMessageStreamOptionsV6<UIMessageV6>['messageMetadata'];
  onError?: UIMessageStreamOptionsV6<UIMessageV6>['onError'];
};

type ToAISDKStreamOptionsV5 = WorkflowStreamOptionsV5 | NetworkStreamOptionsV5 | AgentStreamOptionsV5;
type ToAISDKStreamOptionsV6 = WorkflowStreamOptionsV6 | NetworkStreamOptionsV6 | AgentStreamOptionsV6;
type ToAISDKStreamOptions = ToAISDKStreamOptionsV5 | ToAISDKStreamOptionsV6;

export function toAISdkV5Stream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: MastraWorkflowStream<TState, TInput, TOutput, TSteps>,
  options: WorkflowStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkV5Stream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>,
  options: WorkflowStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkV5Stream<OUTPUT = undefined>(
  stream: MastraAgentNetworkStream<OUTPUT>,
  options: NetworkStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkV5Stream<TOutput>(
  stream: MastraModelOutput<TOutput>,
  options: AgentStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkV5Stream(
  stream:
    | WorkflowRunOutput<WorkflowResult<any, any, any, any>>
    | MastraWorkflowStream<any, any, any, any>
    | MastraAgentNetworkStream
    | MastraModelOutput,
  options: ToAISDKStreamOptionsV5 = {
    from: 'agent',
    sendStart: true,
    sendFinish: true,
  },
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>> {
  const from = options.from;

  if (from === 'workflow') {
    const includeTextStreamParts = options.includeTextStreamParts ?? true;
    const workflowStream =
      'fullStream' in stream
        ? (stream as WorkflowRunOutput<any>).fullStream
        : (stream as ReadableStream<ChunkType<any>>);

    return workflowStream.pipeThrough(
      WorkflowStreamToAISDKTransformer({
        includeTextStreamParts,
        sendReasoning: options.sendReasoning,
        sendSources: options.sendSources,
      }),
    ) as ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
  }

  if (from === 'network') {
    return (stream as ReadableStream<ChunkType>).pipeThrough(AgentNetworkToAISDKTransformer()) as ReadableStream<
      InferUIMessageChunkV5<UIMessageV5>
    >;
  }

  const agentReadable: ReadableStream<ChunkType<any>> =
    'fullStream' in stream ? (stream as MastraModelOutput<any>).fullStream : (stream as ReadableStream<ChunkType<any>>);
  return agentReadable.pipeThrough(
    AgentStreamToAISDKTransformer<any>({
      lastMessageId: options.lastMessageId,
      sendStart: options.sendStart,
      sendFinish: options.sendFinish,
      sendReasoning: options.sendReasoning,
      sendSources: options.sendSources,
      messageMetadata: options.messageMetadata,
      onError: options.onError,
    }),
  ) as ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
}

export function toAISdkStream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: MastraWorkflowStream<TState, TInput, TOutput, TSteps>,
  options: WorkflowStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkStream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>,
  options: WorkflowStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkStream<OUTPUT = undefined>(
  stream: MastraAgentNetworkStream<OUTPUT>,
  options: NetworkStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkStream<TOutput>(
  stream: MastraModelOutput<TOutput>,
  options: AgentStreamOptionsV5,
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
export function toAISdkStream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(stream: MastraWorkflowStream<TState, TInput, TOutput, TSteps>, options: WorkflowStreamOptionsV6): V6UIMessageStream;
export function toAISdkStream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>,
  options: WorkflowStreamOptionsV6,
): V6UIMessageStream;
export function toAISdkStream<OUTPUT = undefined>(
  stream: MastraAgentNetworkStream<OUTPUT>,
  options: NetworkStreamOptionsV6,
): V6UIMessageStream;
export function toAISdkStream<TOutput>(
  stream: MastraModelOutput<TOutput>,
  options: AgentStreamOptionsV6,
): V6UIMessageStream;
export function toAISdkStream(
  stream:
    | WorkflowRunOutput<WorkflowResult<any, any, any, any>>
    | MastraWorkflowStream<any, any, any, any>
    | MastraAgentNetworkStream
    | MastraModelOutput,
  options: ToAISDKStreamOptions = {
    from: 'agent',
    sendStart: true,
    sendFinish: true,
  },
): ReadableStream<InferUIMessageChunkV5<UIMessageV5>> | V6UIMessageStream {
  if (options.version === 'v6') {
    const from = options.from;

    if (from === 'workflow') {
      const includeTextStreamParts = options.includeTextStreamParts ?? true;
      const workflowStream =
        'fullStream' in stream
          ? (stream as WorkflowRunOutput<any>).fullStream
          : (stream as ReadableStream<ChunkType<any>>);

      return workflowStream.pipeThrough(
        WorkflowStreamToAISDKV6Transformer({
          includeTextStreamParts,
          sendReasoning: options.sendReasoning,
          sendSources: options.sendSources,
        }),
      ) as V6UIMessageStream;
    }

    if (from === 'network') {
      return (stream as ReadableStream<ChunkType>).pipeThrough(AgentNetworkToAISDKV6Transformer()) as V6UIMessageStream;
    }

    const agentReadable: ReadableStream<ChunkType<any>> =
      'fullStream' in stream
        ? (stream as MastraModelOutput<any>).fullStream
        : (stream as ReadableStream<ChunkType<any>>);
    return agentReadable.pipeThrough(
      AgentStreamToAISDKV6Transformer<any>({
        lastMessageId: options.lastMessageId,
        sendStart: options.sendStart,
        sendFinish: options.sendFinish,
        sendReasoning: options.sendReasoning,
        sendSources: options.sendSources,
        messageMetadata: options.messageMetadata,
        onError: options.onError,
      }),
    ) as ReadableStream<InferUIMessageChunkV6<UIMessageV6>>;
  }

  const from = options.from;

  if (from === 'workflow') {
    const includeTextStreamParts = options.includeTextStreamParts ?? true;
    const workflowStream =
      'fullStream' in stream
        ? (stream as WorkflowRunOutput<any>).fullStream
        : (stream as ReadableStream<ChunkType<any>>);

    return workflowStream.pipeThrough(
      WorkflowStreamToAISDKTransformer({
        includeTextStreamParts,
        sendReasoning: options.sendReasoning,
        sendSources: options.sendSources,
      }),
    ) as ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
  }

  if (from === 'network') {
    return (stream as ReadableStream<ChunkType>).pipeThrough(AgentNetworkToAISDKTransformer()) as ReadableStream<
      InferUIMessageChunkV5<UIMessageV5>
    >;
  }

  const agentReadable: ReadableStream<ChunkType<any>> =
    'fullStream' in stream ? (stream as MastraModelOutput<any>).fullStream : (stream as ReadableStream<ChunkType<any>>);
  return agentReadable.pipeThrough(
    AgentStreamToAISDKTransformer<any>({
      lastMessageId: options.lastMessageId,
      sendStart: options.sendStart,
      sendFinish: options.sendFinish,
      sendReasoning: options.sendReasoning,
      sendSources: options.sendSources,
      messageMetadata: options.messageMetadata,
      onError: options.onError,
    }),
  ) as ReadableStream<InferUIMessageChunkV5<UIMessageV5>>;
}

import type {
  MastraModelOutput,
  ChunkType,
  OutputSchema,
  MastraAgentNetworkStream,
  WorkflowRunOutput,
} from '@mastra/core/stream';
import type { MastraWorkflowStream, Step, WorkflowResult } from '@mastra/core/workflows';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import type { ZodObject, ZodType } from 'zod';
import {
  AgentNetworkToAISDKTransformer,
  AgentStreamToAISDKTransformer,
  WorkflowStreamToAISDKTransformer,
} from './transformers';

type ToAISDKFrom = 'agent' | 'network' | 'workflow';

export function toAISdkV5Stream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: MastraWorkflowStream<TState, TInput, TOutput, TSteps>,
  options: { from: 'workflow' },
): ReadableStream<InferUIMessageChunk<UIMessage>>;
export function toAISdkV5Stream<
  TOutput extends ZodType<any>,
  TInput extends ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[],
  TState extends ZodObject<any>,
>(
  stream: WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>,
  options: { from: 'workflow' },
): ReadableStream<InferUIMessageChunk<UIMessage>>;
export function toAISdkV5Stream(
  stream: MastraAgentNetworkStream,
  options: { from: 'network' },
): ReadableStream<InferUIMessageChunk<UIMessage>>;
export function toAISdkV5Stream<TOutput extends OutputSchema>(
  stream: MastraModelOutput<TOutput>,
  options: { from: 'agent'; lastMessageId?: string },
): ReadableStream<InferUIMessageChunk<UIMessage>>;
export function toAISdkV5Stream(
  stream:
    | MastraAgentNetworkStream
    | MastraWorkflowStream<any, any, any, any>
    | MastraModelOutput
    | WorkflowRunOutput<WorkflowResult<any, any, any, any>>,
  options: { from: ToAISDKFrom; lastMessageId?: string } = { from: 'agent' },
): ReadableStream<InferUIMessageChunk<UIMessage>> {
  const from = options?.from;

  if (from === 'workflow') {
    return (stream as ReadableStream<ChunkType>).pipeThrough(WorkflowStreamToAISDKTransformer()) as ReadableStream<
      InferUIMessageChunk<UIMessage>
    >;
  }

  if (from === 'network') {
    return (stream as ReadableStream<ChunkType>).pipeThrough(AgentNetworkToAISDKTransformer()) as ReadableStream<
      InferUIMessageChunk<UIMessage>
    >;
  }

  const agentReadable: ReadableStream<ChunkType> =
    'fullStream' in stream ? (stream as MastraModelOutput).fullStream : (stream as ReadableStream<ChunkType>);
  return agentReadable.pipeThrough(AgentStreamToAISDKTransformer<any>(options?.lastMessageId)) as ReadableStream<
    InferUIMessageChunk<UIMessage>
  >;
}

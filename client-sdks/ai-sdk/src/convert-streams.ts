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

/**
 * Converts Mastra streams (workflow, agent network, or agent) to AI SDK v5 compatible streams.
 *
 * This function transforms various Mastra stream types into ReadableStream objects that are compatible
 * with the AI SDK v5, enabling seamless integration with AI SDK's streaming capabilities.
 *
 *
 * @param {MastraWorkflowStream | WorkflowRunOutput | MastraAgentNetworkStream | MastraModelOutput} stream
 *   The Mastra stream to convert. Can be one of:
 *   - MastraWorkflowStream: A workflow execution stream
 *   - WorkflowRunOutput: The output of a workflow run
 *   - MastraAgentNetworkStream: An agent network execution stream
 *   - MastraModelOutput: An agent model output stream
 *
 * @param {Object} options - Conversion options
 * @param {'workflow' | 'network' | 'agent'} options.from - The type of stream being converted. Defaults to 'agent'
 * @param {string} [options.lastMessageId] - (Agent only) The ID of the last message in the conversation
 * @param {boolean} [options.sendStart=true] - (Agent only) Whether to send start events. Defaults to true
 * @param {boolean} [options.sendFinish=true] - (Agent only) Whether to send finish events. Defaults to true
 * @param {boolean} [options.sendReasoning] - (Agent only) Whether to include reasoning in the output
 * @param {boolean} [options.sendSources] - (Agent only) Whether to include sources in the output
 *
 * @returns {ReadableStream<InferUIMessageChunk<UIMessage>>} A ReadableStream compatible with AI SDK v5
 *
 * @example
 * // Convert a workflow stream
 * const workflowStream = await workflowRun.stream(...);
 * const aiSDKStream = toAISdkV5Stream(workflowStream, { from: 'workflow' });
 *
 * @example
 * // Convert an agent network stream
 * const networkStream = await agentNetwork.network(...);
 * const aiSDKStream = toAISdkV5Stream(networkStream, { from: 'network' });
 *
 * @example
 * // Convert an agent stream with custom options
 * const agentStream = await agent.stream(...);
 * const aiSDKStream = toAISdkV5Stream(agentStream, {
 *   from: 'agent',
 *   lastMessageId: 'msg-123',
 *   sendReasoning: true,
 *   sendSources: true
 * });
 */
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
  options: {
    from: 'agent';
    lastMessageId?: string;
    sendStart?: boolean;
    sendFinish?: boolean;
    sendReasoning?: boolean;
    sendSources?: boolean;
  },
): ReadableStream<InferUIMessageChunk<UIMessage>>;
export function toAISdkV5Stream(
  stream:
    | MastraAgentNetworkStream
    | MastraWorkflowStream<any, any, any, any>
    | MastraModelOutput
    | WorkflowRunOutput<WorkflowResult<any, any, any, any>>,
  options: {
    from: ToAISDKFrom;
    lastMessageId?: string;
    sendStart?: boolean;
    sendFinish?: boolean;
    sendReasoning?: boolean;
    sendSources?: boolean;
  } = {
    from: 'agent',
    sendStart: true,
    sendFinish: true,
  },
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
  return agentReadable.pipeThrough(
    AgentStreamToAISDKTransformer<any>({
      lastMessageId: options?.lastMessageId,
      sendStart: options?.sendStart,
      sendFinish: options?.sendFinish,
      sendReasoning: options?.sendReasoning,
      sendSources: options?.sendSources,
    }),
  ) as ReadableStream<InferUIMessageChunk<UIMessage>>;
}

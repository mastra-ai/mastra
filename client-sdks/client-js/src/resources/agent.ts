import { parsePartialJson, processDataStream } from '@ai-sdk/ui-utils';
import type {
  JSONValue,
  ReasoningUIPart,
  TextUIPart,
  ToolInvocation,
  ToolInvocationUIPart,
  UIMessage,
  UseChatOptions,
} from '@ai-sdk/ui-utils';
import { v4 as uuid } from '@lukeed/uuid';
import type { AgentExecutionOptionsBase, SerializableStructuredOutputOptions } from '@mastra/core/agent';
import type { AIV5Type, MessageListInput } from '@mastra/core/agent/message-list';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { GenerateReturn, CoreMessage } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import type { ChunkType, FullOutput, MastraModelOutput } from '@mastra/core/stream';
import type { Tool, ToolObserve } from '@mastra/core/tools';
import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/schema-compat/schema';
import type { JSONSchema7 } from 'json-schema';
import { createObservabilityCollector } from '../observability/collector';
import type {
  ZodSchema,
  GenerateLegacyParams,
  GetAgentBrowserSessionResponse,
  GetAgentResponse,
  GetToolResponse,
  ClientOptions,
  AgentVersionIdentifier,
  StreamParams,
  StreamLegacyParams,
  UpdateModelParams,
  UpdateModelInModelListParams,
  ReorderModelListParams,
  NetworkStreamParams,
  StreamParamsBaseWithoutMessages,
  CloneAgentParams,
  StoredAgentResponse,
  StructuredOutputOptions,
  AgentVersionResponse,
  ListAgentVersionsParams,
  ListAgentVersionsResponse,
  SendAgentMessageParams,
  SendAgentSignalParams,
  QueueAgentMessageParams,
  SubscribeAgentThreadParams,
  ListAgentSuspendedRunsParams,
  ListAgentSuspendedRunsResponse,
  ProcessAgentThreadStreamOptions,
  CreateCodeAgentVersionParams,
  ActivateAgentVersionResponse,
  CompareVersionsResponse,
  DeleteAgentVersionResponse,
  RestoreAgentVersionResponse,
} from '../types';

import { parseClientRequestContext, requestContextQueryString, toQueryParams } from '../utils';
import { getClientToolModelOutput } from '../utils/client-tool-model-output';
import { processClientTools } from '../utils/process-client-tools';
import { processMastraNetworkStream, processMastraStream } from '../utils/process-mastra-stream';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { BaseResource } from './base';

type ResumeStreamParams<OUTPUT extends {}> = StreamParamsBaseWithoutMessages<OUTPUT> & {
  messages?: MessageListInput;
  runId: string;
  toolCallId?: string;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
};

type RecoverParams = {
  runId: string;
  requestContext?: Record<string, unknown>;
  versions?: {
    agents?: Record<string, { versionId: string } | { status: 'draft' | 'published' }>;
    defaultStatus?: 'draft' | 'published';
  };
};

type ToolCallRespondFn<OUTPUT> = (
  messages: MessageListInput,
  options: StreamParamsBaseWithoutMessages<OUTPUT> & {
    structuredOutput?: StructuredOutputOptions<OUTPUT>;
  },
) => Promise<FullOutput<OUTPUT>>;

type ClientToolObservabilityContext = { traceparent: string; tracestate?: string; baggage?: string };

type ClientToolObservabilityEnvelope = {
  parentContext: ClientToolObservabilityContext;
  payload?: Record<string, unknown>;
};

type SignalRuntimeOptions = StreamParamsBaseWithoutMessages<any>;
type SignalRuntimeOptionsEntry = {
  streamOptions: SignalRuntimeOptions;
  timeout: ReturnType<typeof setTimeout>;
};

const SIGNAL_RUNTIME_OPTIONS_TTL_MS = 5 * 60 * 1000;
const signalRuntimeOptionsByRunId = new Map<string, SignalRuntimeOptionsEntry>();
const latestSignalRuntimeOptionsByThread = new Map<string, SignalRuntimeOptionsEntry>();

const createSignalRuntimeOptionsEntry = (
  store: Map<string, SignalRuntimeOptionsEntry>,
  key: string,
  streamOptions: SignalRuntimeOptions,
): SignalRuntimeOptionsEntry => {
  const timeout = setTimeout(() => store.delete(key), SIGNAL_RUNTIME_OPTIONS_TTL_MS);
  (timeout as { unref?: () => void }).unref?.();
  return { streamOptions, timeout };
};

const setSignalRuntimeOptionsEntry = (
  store: Map<string, SignalRuntimeOptionsEntry>,
  key: string,
  streamOptions: SignalRuntimeOptions,
): void => {
  const existing = store.get(key);
  if (existing) clearTimeout(existing.timeout);
  store.set(key, createSignalRuntimeOptionsEntry(store, key, streamOptions));
};

const deleteSignalRuntimeOptionsEntry = (store: Map<string, SignalRuntimeOptionsEntry>, key: string): void => {
  const existing = store.get(key);
  if (existing) clearTimeout(existing.timeout);
  store.delete(key);
};

const noopClientToolObserve: ToolObserve = {
  async span<T>(_name: string, fn: () => Promise<T> | T): Promise<T> {
    return fn();
  },
  log(): void {},
};

function getClientToolObservabilityContext(toolCall: unknown): ClientToolObservabilityContext | undefined {
  const candidate = toolCall as
    | {
        payload?: { observability?: ClientToolObservabilityContext };
        observability?: ClientToolObservabilityContext;
      }
    | undefined;
  return candidate?.payload?.observability ?? candidate?.observability;
}

async function executeClientToolWithObservability({
  clientTool,
  args,
  toolName,
  parentContext,
  executeContext,
}: {
  clientTool: Tool;
  args: unknown;
  toolName: string;
  parentContext?: ClientToolObservabilityContext;
  executeContext: Record<string, unknown>;
}): Promise<{ result: unknown; observability?: ClientToolObservabilityEnvelope }> {
  const collector = parentContext ? createObservabilityCollector(parentContext) : undefined;
  const observe: ToolObserve = collector
    ? {
        span: collector.span.bind(collector),
        log: collector.log.bind(collector),
      }
    : noopClientToolObserve;

  const runExecute = () =>
    clientTool.execute!(args, {
      ...executeContext,
      observe,
    });

  const result = collector ? await collector.withContext(runExecute) : await runExecute();
  if (!parentContext) {
    return { result };
  }

  const flushed = collector?.flush() as Record<string, unknown> | undefined;
  if (flushed) {
    flushed.toolName = toolName;
  }

  return {
    result,
    observability: {
      parentContext,
      ...(flushed ? { payload: flushed } : {}),
    },
  };
}

async function executeToolCallAndRespond<OUTPUT>({
  response,
  params,
  agentId,
  resourceId,
  threadId,
  requestContext,
  respondFn,
}: {
  params: StreamParams<OUTPUT>;
  response: Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
  agentId: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext<any>;
  respondFn: ToolCallRespondFn<OUTPUT>;
}) {
  if (response.finishReason === 'tool-calls') {
    const toolCalls = (
      response as unknown as {
        toolCalls: {
          payload: {
            toolName: string;
            args: any;
            toolCallId: string;
            observability?: { traceparent: string; tracestate?: string; baggage?: string };
          };
        }[];
        messages: CoreMessage[];
      }
    ).toolCalls;

    if (!toolCalls || !Array.isArray(toolCalls)) {
      return response;
    }

    for (const toolCall of toolCalls) {
      const clientTool = params.clientTools?.[toolCall.payload.toolName] as Tool;

      if (clientTool && clientTool.execute) {
        const { result, observability } = await executeClientToolWithObservability({
          clientTool,
          args: toolCall?.payload.args,
          toolName: toolCall.payload.toolName,
          parentContext: getClientToolObservabilityContext(toolCall),
          executeContext: {
            requestContext: requestContext as RequestContext,
            tracingContext: { currentSpan: undefined },
            agent: {
              agentId,
              messages: (response as unknown as { messages: CoreMessage[] }).messages,
              toolCallId: toolCall?.payload.toolCallId,
              suspend: async () => {},
              threadId,
              resourceId,
            },
          },
        });

        const modelOutput = await getClientToolModelOutput(clientTool, result);

        // Build the tool-result content block. If we have observability
        // data (carrier + buffered spans/logs), attach it directly on
        // the result so it travels with the specific tool call it
        // belongs to, not on the top-level request body.
        const toolResultContent: Record<string, unknown> = {
          type: 'tool-result',
          toolCallId: toolCall.payload.toolCallId,
          toolName: toolCall.payload.toolName,
          result,
          // Carry the client-side toModelOutput result so the server uses it
          // when building the model prompt, while result keeps the raw value.
          ...(modelOutput != null ? { providerOptions: { mastra: { modelOutput } } } : {}),
        };

        if (observability) {
          toolResultContent.__mastraObservability = observability;
        }

        // Build updated messages from the response, adding the tool result
        // When threadId is present, server has memory - don't re-include original messages to avoid storage duplicates
        // When no threadId (stateless), include full conversation history for context
        const newMessages = [
          ...(response.response.messages || []),
          {
            role: 'tool',
            content: [toolResultContent],
          },
        ];

        const updatedMessages = threadId
          ? newMessages
          : [...(Array.isArray(params.messages) ? params.messages : []), ...newMessages];

        const respondOptions: StreamParamsBaseWithoutMessages<OUTPUT> & {
          structuredOutput?: StructuredOutputOptions<OUTPUT>;
        } = {
          ...params,
        };

        delete (respondOptions as { messages?: MessageListInput }).messages;

        return respondFn(updatedMessages as MessageListInput, respondOptions);
      }
    }
  }

  // If no client tool was executed, return the original response
  return response;
}

export class AgentVoice extends BaseResource {
  constructor(
    options: ClientOptions,
    private agentId: string,
    private version?: AgentVersionIdentifier,
  ) {
    super(options);
    this.agentId = agentId;
  }

  private getQueryString(requestContext?: RequestContext | Record<string, any>, delimiter: string = '?'): string {
    const searchParams = new URLSearchParams(requestContextQueryString(requestContext).slice(1));

    if (this.version) {
      new URLSearchParams(toQueryParams(this.version)).forEach((value, key) => {
        searchParams.set(key, value);
      });
    }

    const queryString = searchParams.toString();
    return queryString ? `${delimiter}${queryString}` : '';
  }

  /**
   * Convert text to speech using the agent's voice provider
   * @param text - Text to convert to speech
   * @param options - Optional provider-specific options for speech generation
   * @returns Promise containing the audio data
   */
  async speak(text: string, options?: { speaker?: string; [key: string]: any }): Promise<Response> {
    return this.request<Response>(`/agents/${this.agentId}/voice/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { text, options },
      stream: true,
    });
  }

  /**
   * Convert speech to text using the agent's voice provider
   * @param audio - Audio data to transcribe
   * @param options - Optional provider-specific options
   * @returns Promise containing the transcribed text
   */
  listen(audio: Blob, options?: Record<string, any>): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append('audio', audio);

    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request(`/agents/${this.agentId}/voice/listen`, {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Get available speakers for the agent's voice provider
   * @param requestContext - Optional request context to pass as query parameter
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing list of available speakers
   */
  getSpeakers(
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<Array<{ voiceId: string; [key: string]: any }>> {
    return this.request(`/agents/${this.agentId}/voice/speakers${this.getQueryString(requestContext)}`);
  }

  /**
   * Get the listener configuration for the agent's voice provider
   * @param requestContext - Optional request context to pass as query parameter
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing a check if the agent has listening capabilities
   */
  getListener(requestContext?: RequestContext | Record<string, any>): Promise<{ enabled: boolean }> {
    return this.request(`/agents/${this.agentId}/voice/listener${this.getQueryString(requestContext)}`);
  }
}

export class Agent extends BaseResource {
  public readonly voice: AgentVoice;

  constructor(
    options: ClientOptions,
    private agentId: string,
    private version?: AgentVersionIdentifier,
    private routeOverrides?: { stream?: string },
  ) {
    super(options);
    this.voice = new AgentVoice(options, this.agentId, this.version);
  }

  private getQueryString(requestContext?: RequestContext | Record<string, any>, delimiter: string = '?'): string {
    const searchParams = new URLSearchParams(requestContextQueryString(requestContext).slice(1));

    if (this.version) {
      new URLSearchParams(toQueryParams(this.version)).forEach((value, key) => {
        searchParams.set(key, value);
      });
    }

    const queryString = searchParams.toString();
    return queryString ? `${delimiter}${queryString}` : '';
  }

  private getSignalRuntimeRunKey(runId: string): string {
    return `${this.options.baseUrl}|${this.apiPrefix}|${this.agentId}|${runId}`;
  }

  private getSignalRuntimeThreadKey({
    resourceId,
    threadId,
  }: {
    resourceId?: string;
    threadId?: string;
  }): string | undefined {
    if (!threadId) return undefined;
    return `${this.options.baseUrl}|${this.apiPrefix}|${this.agentId}|${resourceId ?? ''}|${threadId}`;
  }

  private setSignalRuntimeOptions({
    runId,
    resourceId,
    threadId,
    streamOptions,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    streamOptions: SignalRuntimeOptions;
  }): void {
    const threadKey = this.getSignalRuntimeThreadKey({ resourceId, threadId });
    if (runId) {
      setSignalRuntimeOptionsEntry(signalRuntimeOptionsByRunId, this.getSignalRuntimeRunKey(runId), streamOptions);
      if (threadKey) deleteSignalRuntimeOptionsEntry(latestSignalRuntimeOptionsByThread, threadKey);
      return;
    }

    if (threadKey) {
      setSignalRuntimeOptionsEntry(latestSignalRuntimeOptionsByThread, threadKey, streamOptions);
    }
  }

  private getSignalRuntimeOptions({
    runId,
    resourceId,
    threadId,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
  }): SignalRuntimeOptions | undefined {
    if (runId) {
      const runOptions = signalRuntimeOptionsByRunId.get(this.getSignalRuntimeRunKey(runId));
      if (runOptions) return runOptions.streamOptions;
    }

    const threadKey = this.getSignalRuntimeThreadKey({ resourceId, threadId });
    return threadKey ? latestSignalRuntimeOptionsByThread.get(threadKey)?.streamOptions : undefined;
  }

  private deleteSignalRuntimeOptions(runId?: string): void {
    if (!runId) return;
    deleteSignalRuntimeOptionsEntry(signalRuntimeOptionsByRunId, this.getSignalRuntimeRunKey(runId));
  }

  private deleteLatestSignalRuntimeOptions({ resourceId, threadId }: { resourceId?: string; threadId?: string }): void {
    const threadKey = this.getSignalRuntimeThreadKey({ resourceId, threadId });
    if (threadKey) deleteSignalRuntimeOptionsEntry(latestSignalRuntimeOptionsByThread, threadKey);
  }

  private prepareSignalRouteBody<
    Params extends { resourceId?: string; threadId?: string; ifIdle?: { streamOptions?: unknown } },
  >(params: Params): { body: Params; streamOptions?: SignalRuntimeOptions } {
    const streamOptions = params.ifIdle?.streamOptions as SignalRuntimeOptions | undefined;
    if (!streamOptions) return { body: params };

    this.setSignalRuntimeOptions({
      resourceId: params.resourceId,
      threadId: params.threadId,
      streamOptions,
    });

    return {
      body: {
        ...params,
        ifIdle: {
          ...params.ifIdle,
          streamOptions: {
            ...streamOptions,
            requestContext: parseClientRequestContext(streamOptions.requestContext),
            clientTools: processClientTools(streamOptions.clientTools),
          },
        },
      } as Params,
      streamOptions,
    };
  }

  private async requestSignalRoute<
    Params extends { resourceId?: string; threadId?: string; ifIdle?: { streamOptions?: unknown } },
    Response extends { runId: string },
  >(path: string, params: Params): Promise<Response> {
    const { body, streamOptions } = this.prepareSignalRouteBody(params);

    let response: Response;
    try {
      response = await this.request<Response>(path, {
        method: 'POST',
        body,
      });
    } catch (error) {
      if (streamOptions) {
        this.deleteLatestSignalRuntimeOptions({ resourceId: params.resourceId, threadId: params.threadId });
      }
      throw error;
    }

    if (streamOptions) {
      this.setSignalRuntimeOptions({
        runId: response.runId,
        resourceId: params.resourceId,
        threadId: params.threadId,
        streamOptions,
      });
    }

    return response;
  }

  /**
   * Retrieves details about the agent
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing agent details including model and instructions
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<GetAgentResponse> {
    return this.request(`/agents/${this.agentId}${this.getQueryString(requestContext)}`);
  }

  /**
   * Probe the agent's browser session state before opening a screencast WebSocket.
   *
   * Returns `{ hasSession, screencastAvailable }`. Use this to avoid opening a WS
   * that would either fail (screencast packages not installed) or sit idle (no
   * active browser session yet). See {@link GetAgentBrowserSessionResponse}.
   *
   * @param threadId - Optional thread ID for thread-scoped browser sessions
   */
  browserSession(threadId?: string): Promise<GetAgentBrowserSessionResponse> {
    const query = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
    return this.request(`/agents/${this.agentId}/browser/session${query}`);
  }

  /**
   * Close the agent's browser session.
   *
   * For thread-scoped browsers, pass `threadId` to close only that thread's
   * session. Omit it to close the shared session (or all sessions for the agent
   * depending on the toolset's scope).
   *
   * @param threadId - Optional thread ID for thread-scoped browser sessions
   */
  closeBrowser(threadId?: string): Promise<{ success: boolean }> {
    return this.request(`/agents/${this.agentId}/browser/close`, {
      method: 'POST',
      body: { threadId },
    });
  }

  enhanceInstructions(instructions: string, comment: string): Promise<{ explanation: string; new_prompt: string }> {
    return this.request(`/agents/${this.agentId}/instructions/enhance`, {
      method: 'POST',
      body: { instructions, comment },
    });
  }

  /**
   * @experimental Agent message APIs are experimental and may change in a future release.
   */
  sendMessage(params: SendAgentMessageParams): Promise<{ accepted: true; runId: string; signal?: unknown }> {
    return this.requestSignalRoute(`/agents/${this.agentId}/send-message`, params);
  }

  /**
   * @experimental Agent message APIs are experimental and may change in a future release.
   */
  queueMessage(params: QueueAgentMessageParams): Promise<{ accepted: true; runId: string; signal?: unknown }> {
    return this.requestSignalRoute(`/agents/${this.agentId}/queue-message`, params);
  }

  /**
   * @experimental Agent signals are experimental and may change in a future release.
   */
  sendSignal(params: SendAgentSignalParams): Promise<{ accepted: true; runId: string }> {
    return this.requestSignalRoute(`/agents/${this.agentId}/signals`, params);
  }

  /**
   * @experimental Agent signals are experimental and may change in a future release.
   */
  async subscribeToThread(params: SubscribeAgentThreadParams): Promise<
    Response & {
      processDataStream: (options: ProcessAgentThreadStreamOptions) => Promise<void>;
      abort: () => Promise<boolean>;
      unsubscribe: () => void;
    }
  > {
    const { resourceId, threadId } = params;
    const requestSubscription = () =>
      this.request(`/agents/${this.agentId}/threads/subscribe`, {
        method: 'POST',
        body: { resourceId, threadId },
        stream: true,
      }) as Promise<Response>;

    const streamResponse = (await requestSubscription()) as Response & {
      processDataStream: (options: ProcessAgentThreadStreamOptions) => Promise<void>;
      abort: () => Promise<boolean>;
      unsubscribe: () => void;
    };

    if (!streamResponse.body) {
      throw new Error('No response body');
    }

    const agent = this;
    streamResponse.abort = async () => (await agent.abortThread({ resourceId, threadId })).aborted;

    let unsubscribed = false;
    let processAbortController: AbortController | undefined;
    let processStarted = false;

    streamResponse.unsubscribe = () => {
      if (unsubscribed) return;
      unsubscribed = true;
      processAbortController?.abort();
      if (!processStarted) {
        void streamResponse.body?.cancel().catch(() => {});
      }
    };

    streamResponse.processDataStream = async ({ onChunk, reconnect }: ProcessAgentThreadStreamOptions) => {
      if (unsubscribed) return;
      processStarted = true;
      processAbortController = new AbortController();
      const abortProcessStream = () => processAbortController?.abort();
      const isClosed = () =>
        unsubscribed || processAbortController?.signal.aborted || this.options.abortSignal?.aborted;

      if (this.options.abortSignal?.aborted) {
        abortProcessStream();
      } else {
        this.options.abortSignal?.addEventListener('abort', abortProcessStream, { once: true });
      }

      try {
        const pendingToolCallsByRunId = new Map<
          string,
          Array<{
            toolCallId: string;
            toolName: string;
            args?: unknown;
            observability?: ClientToolObservabilityContext;
          }>
        >();

        const handleSubscribedChunk = async (chunk: ChunkType) => {
          if (chunk.type === 'tool-call') {
            const payload = (
              chunk as {
                payload?: {
                  toolCallId?: string;
                  toolName?: string;
                  args?: unknown;
                  observability?: ClientToolObservabilityContext;
                };
              }
            ).payload;
            const toolCallId = payload?.toolCallId;
            const toolName = payload?.toolName;
            const runId = (chunk as { runId?: string }).runId;
            if (!toolCallId || !toolName || !runId) return;

            const pendingToolCalls = pendingToolCallsByRunId.get(runId) ?? [];
            pendingToolCalls.push({ toolCallId, toolName, args: payload.args, observability: payload.observability });
            pendingToolCallsByRunId.set(runId, pendingToolCalls);
            return;
          }

          if (chunk.type !== 'finish') return;

          const runId = (chunk as { runId?: string }).runId;
          const finishPayload = chunk as {
            payload?: {
              stepResult?: { reason?: string };
              messages?: { nonUser?: CoreMessage[] };
            };
          };
          if (!runId) return;
          if (finishPayload.payload?.stepResult?.reason !== 'tool-calls') {
            agent.deleteSignalRuntimeOptions(runId);
            return;
          }

          const pendingToolCalls = pendingToolCallsByRunId.get(runId);
          pendingToolCallsByRunId.delete(runId);
          if (!pendingToolCalls?.length) {
            agent.deleteSignalRuntimeOptions(runId);
            return;
          }

          const activeRuntimeOptions = agent.getSignalRuntimeOptions({ runId, resourceId, threadId });
          const activeClientTools = activeRuntimeOptions?.clientTools;
          if (!activeClientTools) {
            agent.deleteSignalRuntimeOptions(runId);
            return;
          }

          const activeRequestContext = activeRuntimeOptions.requestContext;
          const processedClientTools = processClientTools(activeClientTools);
          const processedRequestContext = parseClientRequestContext(activeRequestContext);

          const toolResultMessages: AIV5Type.ModelMessage[] = [];
          for (const toolCall of pendingToolCalls) {
            const clientTool = activeClientTools[toolCall.toolName] as Tool | undefined;
            if (!clientTool || typeof clientTool.execute !== 'function') continue;

            let result: unknown;
            let modelOutput: unknown;
            let observability: ClientToolObservabilityEnvelope | undefined;
            try {
              const execution = await executeClientToolWithObservability({
                clientTool,
                args: toolCall.args,
                toolName: toolCall.toolName,
                parentContext: toolCall.observability,
                executeContext: {
                  requestContext: activeRequestContext as RequestContext,
                  tracingContext: { currentSpan: undefined },
                  agent: {
                    agentId: agent.agentId,
                    messages: finishPayload.payload?.messages?.nonUser ?? [],
                    toolCallId: toolCall.toolCallId,
                    suspend: async () => {},
                    threadId,
                    resourceId,
                  },
                },
              });
              result = execution.result;
              observability = execution.observability;
              try {
                modelOutput = await getClientToolModelOutput(clientTool, result);
              } catch {
                // A failing toModelOutput shouldn't discard a successful tool
                // execution; continue with the raw result only.
                modelOutput = undefined;
              }
            } catch (error) {
              result = { error: String(error) };
              modelOutput = undefined;
            }

            const toolResultContent = {
              type: 'tool-result',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
              result,
              ...(observability ? { __mastraObservability: observability } : {}),
            } satisfies Extract<CoreMessage, { role: 'tool' }>['content'][number] & {
              args?: unknown;
              __mastraObservability?: ClientToolObservabilityEnvelope;
            };

            await onChunk({
              type: 'tool-result',
              runId,
              payload: toolResultContent,
            } as never);

            const continuationToolCall = {
              type: 'tool-call',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              input: toolCall.args,
            } satisfies AIV5Type.ToolCallPart;
            const continuationToolResult = {
              type: 'tool-result',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              output: { type: 'json', value: result as JSONValue },
              // Carry the client-side toModelOutput result so the server uses it
              // when building the model prompt, while output keeps the raw result.
              ...(modelOutput != null
                ? { providerOptions: { mastra: { modelOutput: modelOutput as JSONValue } } }
                : {}),
              ...(observability ? { __mastraObservability: observability } : {}),
            } satisfies AIV5Type.ToolResultPart & { __mastraObservability?: ClientToolObservabilityEnvelope };

            toolResultMessages.push({
              role: 'assistant',
              content: [continuationToolCall, continuationToolResult],
            });
          }

          if (toolResultMessages.length === 0) {
            agent.deleteSignalRuntimeOptions(runId);
            return;
          }

          const continuationStreamOptions = {
            ...activeRuntimeOptions,
            requestContext: processedRequestContext,
            memory: threadId ? { thread: threadId, resource: resourceId } : undefined,
            clientTools: processedClientTools,
          } as StreamParamsBaseWithoutMessages<any>;

          agent.setSignalRuntimeOptions({
            resourceId,
            threadId,
            streamOptions: continuationStreamOptions,
          });

          const continuationMessages = (
            threadId ? toolResultMessages : [...(finishPayload.payload?.messages?.nonUser ?? []), ...toolResultMessages]
          ) as MessageListInput;

          try {
            await agent.sendToolApproval({
              resourceId: resourceId || agent.agentId,
              threadId,
              toolCallId: pendingToolCalls[0]!.toolCallId,
              approved: true,
              requestContext: processedRequestContext,
              messages: continuationMessages,
              streamOptions: continuationStreamOptions,
            });
          } catch (error) {
            agent.deleteLatestSignalRuntimeOptions({ resourceId, threadId });
            console.error('Error running client-tool continuation:', error);
          } finally {
            agent.deleteSignalRuntimeOptions(runId);
          }
        };

        const reconnectOptions =
          reconnect === true
            ? { maxRetries: Infinity, delayMs: 1000 }
            : reconnect
              ? { maxRetries: reconnect.maxRetries ?? Infinity, delayMs: reconnect.delayMs ?? 1000 }
              : null;
        let response: Response = streamResponse;
        let attempts = 0;

        // Sentinel used to distinguish errors thrown by the caller's `onChunk`
        // callback from transport errors. Callback errors should not trigger a
        // reconnect — we'd otherwise mask user bugs by resubscribing forever.
        // The sentinel never escapes this method: we unwrap and rethrow the
        // original error so consumers see exactly what they threw.
        const onChunkErrorSentinel = Symbol('onChunkErrorSentinel');
        const guardedOnChunk = async (chunk: ChunkType) => {
          try {
            await onChunk(chunk);
            await handleSubscribedChunk(chunk);
          } catch (cause) {
            throw { [onChunkErrorSentinel]: true, cause };
          }
        };

        while (true) {
          if (!response.body) {
            throw new Error('No response body');
          }

          try {
            await processMastraStream({
              stream: response.body as ReadableStream<Uint8Array>,
              onChunk: guardedOnChunk,
              signal: processAbortController.signal,
            });
          } catch (error) {
            if (typeof error === 'object' && error !== null && (error as any)[onChunkErrorSentinel]) {
              throw (error as { cause: unknown }).cause;
            }
            if (!reconnectOptions || isClosed() || attempts >= reconnectOptions.maxRetries) {
              if (isClosed()) return;
              throw error;
            }
          }

          if (!reconnectOptions || isClosed() || attempts >= reconnectOptions.maxRetries) {
            return;
          }

          while (attempts < reconnectOptions.maxRetries) {
            attempts++;

            if (isClosed()) {
              return;
            }

            await new Promise(resolve => setTimeout(resolve, reconnectOptions.delayMs));

            if (isClosed()) {
              return;
            }

            try {
              response = await requestSubscription();
              break;
            } catch (error) {
              if (isClosed() || attempts >= reconnectOptions.maxRetries) {
                if (isClosed()) return;
                throw error;
              }
            }
          }
        }
      } finally {
        this.options.abortSignal?.removeEventListener('abort', abortProcessStream);
        if (processAbortController?.signal.aborted) {
          unsubscribed = true;
        }
        processAbortController = undefined;
      }
    };

    return streamResponse;
  }

  /**
   * @experimental Agent signals are experimental and may change in a future release.
   */
  async abortThread(params: SubscribeAgentThreadParams): Promise<{ aborted: boolean }> {
    const { resourceId, threadId } = params;
    return this.request<{ aborted: boolean }>(`/agents/${this.agentId}/threads/abort`, {
      method: 'POST',
      body: { resourceId, threadId },
    });
  }

  /**
   * Clones this agent to a new stored agent in the database
   * @param params - Clone parameters including optional newId, newName, metadata, authorId, and requestContext
   * @returns Promise containing the created stored agent
   */
  clone(params?: CloneAgentParams): Promise<StoredAgentResponse> {
    const { requestContext, ...rest } = params || {};
    return this.request(`/agents/${this.agentId}/clone`, {
      method: 'POST',
      body: {
        ...rest,
        requestContext: parseClientRequestContext(requestContext),
      },
    });
  }

  /**
   * Lists all override versions for this code agent
   * @param params - Optional pagination and sorting parameters
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing paginated list of versions
   */
  listVersions(
    params?: ListAgentVersionsParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ListAgentVersionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.set('page', String(params.page));
    if (params?.perPage !== undefined) queryParams.set('perPage', String(params.perPage));
    if (params?.orderBy) {
      if (params.orderBy.field) {
        queryParams.set('orderBy[field]', params.orderBy.field);
      }
      if (params.orderBy.direction) {
        queryParams.set('orderBy[direction]', params.orderBy.direction);
      }
    }

    const queryString = queryParams.toString();
    const contextString = requestContextQueryString(requestContext);
    return this.request(
      `/stored/agents/${encodeURIComponent(this.agentId)}/versions${queryString ? `?${queryString}` : ''}${contextString ? `${queryString ? '&' : '?'}${contextString.slice(1)}` : ''}`,
    );
  }

  /**
   * Creates a new override version snapshot for this code agent
   * @param params - Optional override fields and change message for the version
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the created version
   */
  createVersion(
    params?: CreateCodeAgentVersionParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<AgentVersionResponse> {
    return this.request(
      `/stored/agents/${encodeURIComponent(this.agentId)}/versions${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
        body: params || {},
      },
    );
  }

  /**
   * Retrieves a specific override version by its ID
   * @param versionId - The UUID of the version to retrieve
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the version details
   */
  getVersion(versionId: string, requestContext?: RequestContext | Record<string, any>): Promise<AgentVersionResponse> {
    return this.request(
      `/stored/agents/${encodeURIComponent(this.agentId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Activates a specific override version for this code agent
   * @param versionId - The UUID of the version to activate
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the activated version details
   */
  activateVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ActivateAgentVersionResponse> {
    return this.request(
      `/stored/agents/${encodeURIComponent(this.agentId)}/versions/${encodeURIComponent(versionId)}/activate${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Restores a version by creating a new override version with the same configuration
   * @param versionId - The UUID of the version to restore
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the newly created version
   */
  restoreVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<RestoreAgentVersionResponse> {
    return this.request(
      `/stored/agents/${encodeURIComponent(this.agentId)}/versions/${encodeURIComponent(versionId)}/restore${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Deletes a specific override version
   * @param versionId - The UUID of the version to delete
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise that resolves with deletion response
   */
  deleteVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<DeleteAgentVersionResponse> {
    return this.request(
      `/stored/agents/${encodeURIComponent(this.agentId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Compares two override versions and returns their differences
   * @param fromId - The UUID of the source version
   * @param toId - The UUID of the target version
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the comparison results
   */
  compareVersions(
    fromId: string,
    toId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<CompareVersionsResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('from', fromId);
    queryParams.set('to', toId);

    const contextString = requestContextQueryString(requestContext);
    return this.request(
      `/stored/agents/${encodeURIComponent(this.agentId)}/versions/compare?${queryParams.toString()}${contextString ? `&${contextString.slice(1)}` : ''}`,
    );
  }

  /**
   * Generates a response from the agent
   * @param params - Generation parameters including prompt
   * @returns Promise containing the generated response
   */
  async generateLegacy(
    params: GenerateLegacyParams<undefined> & { output?: never; experimental_output?: never },
  ): Promise<GenerateReturn<any, undefined, undefined>>;
  // Use `any` in overload return types to avoid "Type instantiation is excessively deep" errors
  async generateLegacy<Output extends JSONSchema7 | ZodSchema>(
    params: GenerateLegacyParams<Output> & { output: Output; experimental_output?: never },
  ): Promise<GenerateReturn<any, any, any>>;
  async generateLegacy<StructuredOutput extends JSONSchema7 | ZodSchema>(
    params: GenerateLegacyParams<StructuredOutput> & { output?: never; experimental_output: StructuredOutput },
  ): Promise<GenerateReturn<any, any, any>>;
  async generateLegacy<
    Output extends JSONSchema7 | ZodSchema | undefined = undefined,
    _StructuredOutput extends JSONSchema7 | ZodSchema | undefined = undefined,
  >(params: GenerateLegacyParams<Output>): Promise<GenerateReturn<any, any, any>> {
    const processedParams = {
      ...params,
      output: params.output ? zodToJsonSchema(params.output) : undefined,
      experimental_output: params.experimental_output ? zodToJsonSchema(params.experimental_output) : undefined,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
    };

    const { resourceId, threadId, requestContext } = processedParams as GenerateLegacyParams;

    const response: GenerateReturn<any, any, any> = await this.request(`/agents/${this.agentId}/generate-legacy`, {
      method: 'POST',
      body: processedParams,
    });

    if (response.finishReason === 'tool-calls') {
      const toolCalls = (
        response as unknown as {
          toolCalls: { toolName: string; args: any; toolCallId: string }[];
          messages: CoreMessage[];
        }
      ).toolCalls;

      if (!toolCalls || !Array.isArray(toolCalls)) {
        return response;
      }

      for (const toolCall of toolCalls) {
        const clientTool = params.clientTools?.[toolCall.toolName] as Tool;

        if (clientTool && clientTool.execute) {
          const { result, observability } = await executeClientToolWithObservability({
            clientTool,
            args: toolCall?.args,
            toolName: toolCall.toolName,
            parentContext: getClientToolObservabilityContext(toolCall),
            executeContext: {
              requestContext: requestContext as RequestContext,
              tracingContext: { currentSpan: undefined },
              agent: {
                agentId: this.agentId,
                messages: (response as unknown as { messages: CoreMessage[] }).messages,
                toolCallId: toolCall?.toolCallId,
                suspend: async () => {},
                threadId,
                resourceId,
              },
            },
          });

          // Build updated messages from the response, adding the tool result
          // Do NOT re-include the original user message to avoid storage duplicates
          const updatedMessages = [
            ...(response.response as unknown as { messages: CoreMessage[] }).messages,
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result,
                  ...(observability ? { __mastraObservability: observability } : {}),
                },
              ],
            },
          ];
          // Recursive call to generateLegacy with updated messages
          // Using type assertion to handle the complex overload types
          return (this.generateLegacy as any)({
            ...params,
            messages: updatedMessages,
          });
        }
      }
    }

    return response;
  }

  async generate<OUTPUT extends {}>(
    messages: MessageListInput,
    options: StreamParamsBaseWithoutMessages<OUTPUT> & {
      structuredOutput: StructuredOutputOptions<OUTPUT>;
    },
  ): Promise<FullOutput<OUTPUT>>;
  async generate(messages: MessageListInput, options?: StreamParamsBaseWithoutMessages): Promise<FullOutput<undefined>>;
  async generate<OUTPUT = undefined>(
    messages: MessageListInput,
    options?: StreamParamsBaseWithoutMessages<OUTPUT> & {
      structuredOutput?: StructuredOutputOptions<OUTPUT>;
    },
  ): Promise<FullOutput<OUTPUT>> {
    // Handle both new signature (messages, options) and old signature (single param object)
    const params = {
      ...options,
      messages: messages,
    } as StreamParams<OUTPUT>;
    const processedParams = {
      ...params,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
      structuredOutput: params.structuredOutput
        ? {
            ...params.structuredOutput,
            schema: standardSchemaToJSONSchema(toStandardSchema(params.structuredOutput.schema)),
          }
        : undefined,
    };

    const { memory, requestContext } = processedParams as StreamParams;
    const { resource, thread } = memory ?? {};
    const resourceId = resource;
    const threadId = typeof thread === 'string' ? thread : thread?.id;

    const response = await this.request<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>(
      `/agents/${this.agentId}/generate`,
      {
        method: 'POST',
        body: processedParams,
      },
    );

    if (response.finishReason === 'tool-calls') {
      return executeToolCallAndRespond<OUTPUT>({
        response,
        params,
        agentId: this.agentId,
        resourceId,
        threadId,
        requestContext: requestContext as RequestContext<any>,
        respondFn: this.generate.bind(this) as ToolCallRespondFn<OUTPUT>,
      }) as unknown as Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
    }

    return response;
  }

  private async processChatResponse({
    stream,
    update,
    onToolCall,
    onFinish,
    getCurrentDate = () => new Date(),
    lastMessage,
  }: {
    stream: ReadableStream<Uint8Array>;
    update: (options: { message: UIMessage; data: JSONValue[] | undefined; replaceLastMessage: boolean }) => void;
    onToolCall?: UseChatOptions['onToolCall'];
    onFinish?: (options: { message: UIMessage | undefined; finishReason: string; usage: string }) => void;
    generateId?: () => string;
    getCurrentDate?: () => Date;
    lastMessage: UIMessage | undefined;
  }) {
    const replaceLastMessage = lastMessage?.role === 'assistant';
    let step = replaceLastMessage
      ? 1 +
        // find max step in existing tool invocations:
        (lastMessage.toolInvocations?.reduce((max, toolInvocation) => {
          return Math.max(max, toolInvocation.step ?? 0);
        }, 0) ?? 0)
      : 0;

    const message: UIMessage = replaceLastMessage
      ? structuredClone(lastMessage)
      : {
          id: uuid(),
          createdAt: getCurrentDate(),
          role: 'assistant',
          content: '',
          parts: [],
        };

    let currentTextPart: TextUIPart | undefined = undefined;
    let currentReasoningPart: ReasoningUIPart | undefined = undefined;
    let currentReasoningTextDetail: { type: 'text'; text: string; signature?: string } | undefined = undefined;

    function updateToolInvocationPart(toolCallId: string, invocation: ToolInvocation) {
      const part = message.parts.find(
        part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId,
      ) as ToolInvocationUIPart | undefined;

      if (part != null) {
        part.toolInvocation = invocation;
      } else {
        message.parts.push({
          type: 'tool-invocation',
          toolInvocation: invocation,
        });
      }
    }

    const data: JSONValue[] = [];

    // keep list of current message annotations for message
    let messageAnnotations: JSONValue[] | undefined = replaceLastMessage ? lastMessage?.annotations : undefined;

    // keep track of partial tool calls
    const partialToolCalls: Record<
      string,
      {
        text: string;
        step: number;
        index: number;
        toolName: string;
        observability?: ClientToolObservabilityContext;
      }
    > = {};

    let usage: any = {
      completionTokens: NaN,
      promptTokens: NaN,
      totalTokens: NaN,
    };
    let finishReason: string = 'unknown';

    function execUpdate() {
      // make a copy of the data array to ensure UI is updated (SWR)
      const copiedData = [...data];

      // keeps the currentMessage up to date with the latest annotations,
      // even if annotations preceded the message creation
      if (messageAnnotations?.length) {
        message.annotations = messageAnnotations;
      }

      const copiedMessage = {
        // deep copy the message to ensure that deep changes (msg attachments) are updated
        // with SolidJS. SolidJS uses referential integration of sub-objects to detect changes.
        ...structuredClone(message),
        // add a revision id to ensure that the message is updated with SWR. SWR uses a
        // hashing approach by default to detect changes, but it only works for shallow
        // changes. This is why we need to add a revision id to ensure that the message
        // is updated with SWR (without it, the changes get stuck in SWR and are not
        // forwarded to rendering):
        revisionId: uuid(),
      } as UIMessage;

      update({
        message: copiedMessage,
        data: copiedData,
        replaceLastMessage,
      });
    }

    await processDataStream({
      stream: stream as ReadableStream<Uint8Array>,
      onTextPart(value) {
        if (currentTextPart == null) {
          currentTextPart = {
            type: 'text',
            text: value,
          };
          message.parts.push(currentTextPart);
        } else {
          currentTextPart.text += value;
        }

        message.content += value;
        execUpdate();
      },
      onReasoningPart(value) {
        if (currentReasoningTextDetail == null) {
          currentReasoningTextDetail = { type: 'text', text: value };
          if (currentReasoningPart != null) {
            currentReasoningPart.details.push(currentReasoningTextDetail);
          }
        } else {
          currentReasoningTextDetail.text += value;
        }

        if (currentReasoningPart == null) {
          currentReasoningPart = {
            type: 'reasoning',
            reasoning: value,
            details: [currentReasoningTextDetail],
          };
          message.parts.push(currentReasoningPart);
        } else {
          currentReasoningPart.reasoning += value;
        }

        message.reasoning = (message.reasoning ?? '') + value;

        execUpdate();
      },
      onReasoningSignaturePart(value) {
        if (currentReasoningTextDetail != null) {
          currentReasoningTextDetail.signature = value.signature;
        }
      },
      onRedactedReasoningPart(value) {
        if (currentReasoningPart == null) {
          currentReasoningPart = {
            type: 'reasoning',
            reasoning: '',
            details: [],
          };
          message.parts.push(currentReasoningPart);
        }

        currentReasoningPart.details.push({
          type: 'redacted',
          data: value.data,
        });

        currentReasoningTextDetail = undefined;

        execUpdate();
      },
      onFilePart(value) {
        message.parts.push({
          type: 'file',
          mimeType: value.mimeType,
          data: value.data,
        });

        execUpdate();
      },
      onSourcePart(value) {
        message.parts.push({
          type: 'source',
          source: value,
        });

        execUpdate();
      },
      onToolCallStreamingStartPart(value) {
        if (message.toolInvocations == null) {
          message.toolInvocations = [];
        }

        // add the partial tool call to the map
        partialToolCalls[value.toolCallId] = {
          text: '',
          step,
          toolName: value.toolName,
          index: message.toolInvocations.length,
          observability: getClientToolObservabilityContext(value),
        };

        const observability = getClientToolObservabilityContext(value);
        const invocation = {
          state: 'partial-call',
          step,
          toolCallId: value.toolCallId,
          toolName: value.toolName,
          args: undefined,
          ...(observability ? { observability } : {}),
        } as const;

        message.toolInvocations.push(invocation);

        updateToolInvocationPart(value.toolCallId, invocation);

        execUpdate();
      },
      onToolCallDeltaPart(value) {
        const partialToolCall = partialToolCalls[value.toolCallId];

        partialToolCall!.text += value.argsTextDelta;

        const { value: partialArgs } = parsePartialJson(partialToolCall!.text);

        const invocation = {
          state: 'partial-call',
          step: partialToolCall!.step,
          toolCallId: value.toolCallId,
          toolName: partialToolCall!.toolName,
          args: partialArgs,
          ...(partialToolCall!.observability ? { observability: partialToolCall!.observability } : {}),
        } as const;

        message.toolInvocations![partialToolCall!.index] = invocation;

        updateToolInvocationPart(value.toolCallId, invocation);

        execUpdate();
      },
      async onToolCallPart(value) {
        const partialToolCall = partialToolCalls[value.toolCallId];
        const streamedArgs = partialToolCall?.text ? parsePartialJson(partialToolCall.text).value : undefined;
        const toolCall = streamedArgs === undefined ? value : { ...value, args: streamedArgs };
        const invocation = {
          state: 'call',
          step,
          ...toolCall,
        } as const;

        if (partialToolCall != null) {
          // change the partial tool call to a full tool call
          message.toolInvocations![partialToolCalls[value.toolCallId]!.index] = invocation;
        } else {
          if (message.toolInvocations == null) {
            message.toolInvocations = [];
          }

          message.toolInvocations.push(invocation);
        }

        updateToolInvocationPart(value.toolCallId, invocation);

        execUpdate();

        // invoke the onToolCall callback if it exists. This is blocking.
        // In the future we should make this non-blocking, which
        // requires additional state management for error handling etc.
        if (onToolCall) {
          const result = await onToolCall({ toolCall });
          if (result != null) {
            const invocation = {
              state: 'result',
              step,
              ...toolCall,
              result,
            } as const;

            // store the result in the tool invocation
            message.toolInvocations![message.toolInvocations!.length - 1] = invocation;

            updateToolInvocationPart(value.toolCallId, invocation);

            execUpdate();
          }
        }
      },
      onToolResultPart(value) {
        const toolInvocations = message.toolInvocations;

        if (toolInvocations == null) {
          throw new Error('tool_result must be preceded by a tool_call');
        }

        // find if there is any tool invocation with the same toolCallId
        // and replace it with the result
        const toolInvocationIndex = toolInvocations.findIndex(invocation => invocation.toolCallId === value.toolCallId);

        if (toolInvocationIndex === -1) {
          throw new Error('tool_result must be preceded by a tool_call with the same toolCallId');
        }

        const invocation = {
          ...toolInvocations[toolInvocationIndex],
          state: 'result' as const,
          ...value,
        } as const;

        toolInvocations[toolInvocationIndex] = invocation as ToolInvocation;

        updateToolInvocationPart(value.toolCallId, invocation as ToolInvocation);

        execUpdate();
      },
      onDataPart(value) {
        data.push(...value);
        execUpdate();
      },
      onMessageAnnotationsPart(value) {
        if (messageAnnotations == null) {
          messageAnnotations = [...value];
        } else {
          messageAnnotations.push(...value);
        }

        execUpdate();
      },
      onFinishStepPart(value) {
        step += 1;

        // reset the current text and reasoning parts
        currentTextPart = value.isContinued ? currentTextPart : undefined;
        currentReasoningPart = undefined;
        currentReasoningTextDetail = undefined;
      },
      onStartStepPart(value) {
        // keep message id stable when we are updating an existing message:
        if (!replaceLastMessage) {
          message.id = value.messageId;
        }

        // add a step boundary part to the message
        message.parts.push({ type: 'step-start' });
        execUpdate();
      },
      onFinishMessagePart(value) {
        finishReason = value.finishReason;
        if (value.usage != null) {
          // usage = calculateLanguageModelUsage(value.usage);
          usage = value.usage;
        }
      },
      onErrorPart(error) {
        throw new Error(error);
      },
    });

    onFinish?.({ message, finishReason, usage });
  }

  /**
   * Streams a response from the agent
   * @param params - Stream parameters including prompt
   * @returns Promise containing the enhanced Response object with processDataStream method
   */
  async streamLegacy<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: StreamLegacyParams<T>,
  ): Promise<
    Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    }
  > {
    const processedParams = {
      ...params,
      output: params.output ? zodToJsonSchema(params.output) : undefined,
      experimental_output: params.experimental_output ? zodToJsonSchema(params.experimental_output) : undefined,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
    };

    // Create a readable stream that will handle the response processing
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

    // Start processing the response in the background
    const response = await this.processStreamResponseLegacy(processedParams, writable);

    // Create a new response with the readable stream
    const streamResponse = new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    };

    // Add the processDataStream method to the response
    streamResponse.processDataStream = async (options = {}) => {
      await processDataStream({
        stream: streamResponse.body as unknown as globalThis.ReadableStream<Uint8Array>,
        ...options,
      });
    };

    return streamResponse;
  }

  private async processChatResponse_vNext({
    stream,
    update,
    onToolCall,
    onFinish,
    onStreamChunk,
    getCurrentDate = () => new Date(),
    lastMessage,
  }: {
    stream: ReadableStream<Uint8Array>;
    update: (options: { message: UIMessage; data: JSONValue[] | undefined; replaceLastMessage: boolean }) => void;
    onToolCall?: UseChatOptions['onToolCall'];
    onFinish?: (options: { message: UIMessage | undefined; finishReason: string; usage: string }) => void;
    onStreamChunk?: (chunk: any) => void;
    generateId?: () => string;
    getCurrentDate?: () => Date;
    lastMessage: UIMessage | undefined;
  }) {
    const replaceLastMessage = lastMessage?.role === 'assistant';
    let step = replaceLastMessage
      ? 1 +
        // find max step in existing tool invocations:
        (lastMessage.toolInvocations?.reduce((max, toolInvocation) => {
          return Math.max(max, toolInvocation.step ?? 0);
        }, 0) ?? 0)
      : 0;

    const message: UIMessage = replaceLastMessage
      ? structuredClone(lastMessage)
      : {
          id: uuid(),
          createdAt: getCurrentDate(),
          role: 'assistant',
          content: '',
          parts: [],
        };

    let currentTextPart: TextUIPart | undefined = undefined;
    let currentReasoningPart: ReasoningUIPart | undefined = undefined;
    let currentReasoningTextDetail: { type: 'text'; text: string; signature?: string } | undefined = undefined;

    function updateToolInvocationPart(toolCallId: string, invocation: ToolInvocation) {
      const part = message.parts.find(
        part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId,
      ) as ToolInvocationUIPart | undefined;

      if (part != null) {
        part.toolInvocation = invocation;
      } else {
        message.parts.push({
          type: 'tool-invocation',
          toolInvocation: invocation,
        });
      }
    }

    const data: JSONValue[] = [];

    // keep list of current message annotations for message
    let messageAnnotations: JSONValue[] | undefined = replaceLastMessage ? lastMessage?.annotations : undefined;

    // keep track of partial tool calls
    const partialToolCalls: Record<
      string,
      {
        text: string;
        step: number;
        index: number;
        toolName: string;
        observability?: ClientToolObservabilityContext;
      }
    > = {};

    let usage: any = {
      completionTokens: NaN,
      promptTokens: NaN,
      totalTokens: NaN,
    };
    let finishReason: string = 'unknown';

    function execUpdate() {
      // make a copy of the data array to ensure UI is updated (SWR)
      const copiedData = [...data];

      // keeps the currentMessage up to date with the latest annotations,
      // even if annotations preceded the message creation
      if (messageAnnotations?.length) {
        message.annotations = messageAnnotations;
      }

      const copiedMessage = {
        // deep copy the message to ensure that deep changes (msg attachments) are updated
        // with SolidJS. SolidJS uses referential integration of sub-objects to detect changes.
        ...structuredClone(message),
        // add a revision id to ensure that the message is updated with SWR. SWR uses a
        // hashing approach by default to detect changes, but it only works for shallow
        // changes. This is why we need to add a revision id to ensure that the message
        // is updated with SWR (without it, the changes get stuck in SWR and are not
        // forwarded to rendering):
        revisionId: uuid(),
      } as UIMessage;

      update({
        message: copiedMessage,
        data: copiedData,
        replaceLastMessage,
      });
    }

    await processMastraStream({
      stream,
      // TODO: casting as any here because the stream types were all typed as any before in core.
      // but this is completely wrong and this fn is probably broken. Remove ":any" and you'll see a bunch of type errors
      onChunk: async (chunk: any) => {
        onStreamChunk?.(chunk);

        switch (chunk.type) {
          case 'tripwire': {
            message.parts.push({
              type: 'text',
              text: chunk.payload.reason,
            });

            execUpdate();
            break;
          }

          case 'step-start': {
            // keep message id stable when we are updating an existing message:
            if (!replaceLastMessage) {
              message.id = chunk.payload.messageId;
            }

            // add a step boundary part to the message
            message.parts.push({ type: 'step-start' });
            execUpdate();
            break;
          }

          case 'text-delta': {
            if (currentTextPart == null) {
              currentTextPart = {
                type: 'text',
                text: chunk.payload.text,
              };
              message.parts.push(currentTextPart);
            } else {
              currentTextPart.text += chunk.payload.text;
            }

            message.content += chunk.payload.text;
            execUpdate();
            break;
          }

          case 'reasoning-delta': {
            if (currentReasoningTextDetail == null) {
              currentReasoningTextDetail = { type: 'text', text: chunk.payload.text };
              if (currentReasoningPart != null) {
                currentReasoningPart.details.push(currentReasoningTextDetail);
              }
            } else {
              currentReasoningTextDetail.text += chunk.payload.text;
            }

            if (currentReasoningPart == null) {
              currentReasoningPart = {
                type: 'reasoning',
                reasoning: chunk.payload.text,
                details: [currentReasoningTextDetail],
              };
              message.parts.push(currentReasoningPart);
            } else {
              currentReasoningPart.reasoning += chunk.payload.text;
            }

            message.reasoning = (message.reasoning ?? '') + chunk.payload.text;

            execUpdate();
            break;
          }
          case 'file': {
            message.parts.push({
              type: 'file',
              mimeType: chunk.payload.mimeType,
              data: chunk.payload.data,
            });

            execUpdate();
            break;
          }

          case 'source': {
            message.parts.push({
              type: 'source',
              source: chunk.payload.source,
            });
            execUpdate();
            break;
          }

          case 'tool-call': {
            const partialToolCall = partialToolCalls[chunk.payload.toolCallId];
            const streamedArgs = partialToolCall?.text ? parsePartialJson(partialToolCall.text).value : undefined;
            const toolCall = streamedArgs === undefined ? chunk.payload : { ...chunk.payload, args: streamedArgs };
            const invocation = {
              state: 'call',
              step,
              ...toolCall,
            } as const;

            if (partialToolCall != null) {
              // change the partial tool call to a full tool call
              message.toolInvocations![partialToolCalls[chunk.payload.toolCallId]!.index] =
                invocation as ToolInvocation;
            } else {
              if (message.toolInvocations == null) {
                message.toolInvocations = [];
              }

              message.toolInvocations.push(invocation as ToolInvocation);
            }

            updateToolInvocationPart(chunk.payload.toolCallId, invocation as ToolInvocation);

            execUpdate();

            // invoke the onToolCall callback if it exists. This is blocking.
            // In the future we should make this non-blocking, which
            // requires additional state management for error handling etc.
            if (onToolCall) {
              const result = await onToolCall({ toolCall: toolCall as any });
              if (result != null) {
                const invocation = {
                  state: 'result',
                  step,
                  ...toolCall,
                  result,
                } as const;

                // store the result in the tool invocation
                message.toolInvocations![message.toolInvocations!.length - 1] = invocation as ToolInvocation;

                updateToolInvocationPart(chunk.payload.toolCallId, invocation as ToolInvocation);

                execUpdate();
              }
            }
            break;
          }

          case 'tool-call-input-streaming-start': {
            if (message.toolInvocations == null) {
              message.toolInvocations = [];
            }

            // add the partial tool call to the map
            partialToolCalls[chunk.payload.toolCallId] = {
              text: '',
              step,
              toolName: chunk.payload.toolName,
              index: message.toolInvocations.length,
              observability: getClientToolObservabilityContext(chunk),
            };

            const observability = getClientToolObservabilityContext(chunk);
            const invocation = {
              state: 'partial-call',
              step,
              toolCallId: chunk.payload.toolCallId,
              toolName: chunk.payload.toolName,
              args: chunk.payload.args,
              ...(observability ? { observability } : {}),
            } as const;

            message.toolInvocations.push(invocation as ToolInvocation);

            updateToolInvocationPart(chunk.payload.toolCallId, invocation);

            execUpdate();
            break;
          }

          case 'tool-call-delta': {
            const partialToolCall = partialToolCalls[chunk.payload.toolCallId];

            partialToolCall!.text += chunk.payload.argsTextDelta;

            const { value: partialArgs } = parsePartialJson(partialToolCall!.text);

            const invocation = {
              state: 'partial-call',
              step: partialToolCall!.step,
              toolCallId: chunk.payload.toolCallId,
              toolName: partialToolCall!.toolName,
              args: partialArgs,
              ...(partialToolCall!.observability ? { observability: partialToolCall!.observability } : {}),
            } as const;

            message.toolInvocations![partialToolCall!.index] = invocation as ToolInvocation;

            updateToolInvocationPart(chunk.payload.toolCallId, invocation);

            execUpdate();
            break;
          }

          case 'tool-result': {
            const toolInvocations = message.toolInvocations;

            if (toolInvocations == null) {
              throw new Error('tool_result must be preceded by a tool_call');
            }

            // find if there is any tool invocation with the same toolCallId
            // and replace it with the result
            const toolInvocationIndex = toolInvocations.findIndex(
              invocation => invocation.toolCallId === chunk.payload.toolCallId,
            );

            if (toolInvocationIndex === -1) {
              throw new Error('tool_result must be preceded by a tool_call with the same toolCallId');
            }

            const invocation = {
              ...toolInvocations[toolInvocationIndex],
              state: 'result' as const,
              ...chunk.payload,
            } as const;

            toolInvocations[toolInvocationIndex] = invocation as ToolInvocation;

            updateToolInvocationPart(chunk.payload.toolCallId, invocation as ToolInvocation);

            execUpdate();
            break;
          }

          case 'error': {
            throw getErrorFromUnknown(chunk.payload.error, {
              fallbackMessage: 'Unknown error in stream',
              supportSerialization: false,
            });
          }

          case 'data': {
            data.push(...chunk.payload.data);
            execUpdate();
            break;
          }

          case 'step-finish': {
            step += 1;

            // reset the current text and reasoning parts
            currentTextPart = chunk.payload?.stepResult?.isContinued ? currentTextPart : undefined;
            currentReasoningPart = undefined;
            currentReasoningTextDetail = undefined;

            execUpdate();
            break;
          }

          case 'finish': {
            finishReason = chunk.payload?.stepResult?.reason ?? finishReason;
            if (chunk.payload?.usage != null) {
              // usage = calculateLanguageModelUsage(value.usage);
              usage = chunk.payload.usage;
            }
            break;
          }
        }
      },
    });

    onFinish?.({ message, finishReason, usage });
  }

  async processStreamResponse(
    processedParams: any,
    controller: ReadableStreamDefaultController<Uint8Array>,
    route: string = 'stream',
  ) {
    // Extract threadId from memory config if present (matching generate() behavior)
    const { memory } = processedParams ?? {};
    const { resource, thread } = memory ?? {};
    const threadId = processedParams.threadId ?? (typeof thread === 'string' ? thread : thread?.id);
    const resourceId = processedParams.resourceId ?? resource;

    let requestBody = processedParams;
    if (route === 'resume-stream') {
      const { messages: _messages, ...resumeStreamBody } = processedParams;
      requestBody = resumeStreamBody;
    }

    const requestPath =
      route === 'stream' && this.routeOverrides?.stream
        ? this.routeOverrides.stream
        : `/agents/${this.agentId}/${route}`;
    const response: Response = await this.request(requestPath, {
      method: 'POST',
      body: requestBody,
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    try {
      let messages: UIMessage[] = [];
      let streamRunId: string | undefined = processedParams.runId;

      // Use tee() to split the stream into two branches
      const [streamForController, streamForProcessing] = response.body.tee();

      // Pipe one branch directly to the controller
      const pipePromise = streamForController
        .pipeTo(
          new WritableStream<Uint8Array>({
            async write(chunk) {
              // Filter out terminal markers so the client stream doesn't end before recursion
              try {
                const text = new TextDecoder().decode(chunk);
                const lines = text.split('\n\n');
                const readableLines = lines
                  .filter(line => line.trim() !== '[DONE]' && line.trim() !== 'data: [DONE]')
                  .join('\n\n');
                if (readableLines) {
                  const encoded = new TextEncoder().encode(readableLines);
                  controller.enqueue(encoded);
                }
              } catch (error) {
                console.error('Error enqueueing to controller:', error);
                controller.enqueue(chunk);
              }
            },
          }),
        )
        .catch(error => {
          console.error('Error piping to controller:', error);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });

      // Process the other branch for chat response handling
      this.processChatResponse_vNext({
        stream: streamForProcessing as unknown as ReadableStream<Uint8Array>,
        update: ({ message }) => {
          const existingIndex = messages.findIndex(m => m.id === message.id);

          if (existingIndex !== -1) {
            messages[existingIndex] = message;
          } else {
            messages.push(message);
          }
        },
        onFinish: async ({ finishReason, message }) => {
          if (finishReason === 'tool-calls') {
            const toolInvocationsById = new Map<string, ToolInvocation>();

            for (const part of message?.parts ?? []) {
              if (part.type !== 'tool-invocation' || !part.toolInvocation?.toolCallId) {
                continue;
              }

              const toolInvocationWithMetadata = message?.toolInvocations?.find(
                invocation => invocation.toolCallId === part.toolInvocation.toolCallId,
              );

              toolInvocationsById.set(part.toolInvocation.toolCallId, {
                ...toolInvocationWithMetadata,
                ...part.toolInvocation,
                ...(!getClientToolObservabilityContext(part.toolInvocation) && toolInvocationWithMetadata
                  ? { observability: getClientToolObservabilityContext(toolInvocationWithMetadata) }
                  : {}),
              });
            }

            for (const toolInvocation of message?.toolInvocations ?? []) {
              if (!toolInvocation.toolCallId) {
                continue;
              }

              toolInvocationsById.set(toolInvocation.toolCallId, {
                ...toolInvocationsById.get(toolInvocation.toolCallId),
                ...toolInvocation,
              });
            }

            const executableToolCalls = [...toolInvocationsById.values()].filter(toolCall => {
              const clientTool = processedParams.clientTools?.[toolCall.toolName] as Tool;
              return Boolean(clientTool?.execute);
            });

            if (executableToolCalls.length > 0) {
              const syntheticChunks: Array<
                | {
                    type: 'tool-result';
                    runId: string;
                    from: 'AGENT';
                    payload: {
                      toolCallId: string;
                      toolName: string;
                      result: unknown;
                      isError: boolean;
                      providerExecuted: false;
                    };
                  }
                | {
                    type: 'tool-error';
                    runId: string;
                    from: 'AGENT';
                    payload: {
                      toolCallId: string;
                      toolName: string;
                      error: unknown;
                      args?: unknown;
                      providerExecuted: false;
                    };
                  }
              > = [];
              const toolResultContents: Array<Record<string, unknown>> = [];

              for (const toolCall of executableToolCalls) {
                const clientTool = processedParams.clientTools?.[toolCall.toolName] as Tool;

                const runId: string = streamRunId ?? toolCall.toolCallId;
                let result: unknown;
                let modelOutput: unknown;
                let observability: ClientToolObservabilityEnvelope | undefined;
                let synthetic: (typeof syntheticChunks)[number];

                try {
                  ({ result, observability } = await executeClientToolWithObservability({
                    clientTool,
                    args: toolCall?.args,
                    toolName: toolCall.toolName,
                    parentContext: getClientToolObservabilityContext(toolCall),
                    executeContext: {
                      requestContext: processedParams.requestContext as RequestContext,
                      tracingContext: { currentSpan: undefined },
                      agent: {
                        agentId: this.agentId,
                        messages: (response as unknown as { messages: CoreMessage[] }).messages,
                        toolCallId: toolCall?.toolCallId,
                        suspend: async () => {},
                        threadId,
                        resourceId,
                      },
                    },
                  }));

                  modelOutput = await getClientToolModelOutput(clientTool, result);

                  synthetic = {
                    type: 'tool-result',
                    runId,
                    from: 'AGENT',
                    payload: {
                      toolCallId: toolCall.toolCallId,
                      toolName: toolCall.toolName,
                      result,
                      isError: false,
                      providerExecuted: false,
                    },
                  };
                } catch (error) {
                  synthetic = {
                    type: 'tool-error',
                    runId,
                    from: 'AGENT',
                    payload: {
                      toolCallId: toolCall.toolCallId,
                      toolName: toolCall.toolName,
                      error,
                      args: toolCall?.args,
                      providerExecuted: false,
                    },
                  };
                  // Mirror the executed-result message-patching path so the
                  // internal `messages[]` carries the error too (matches the
                  // existing legacy reducer's expectations for the recursive
                  // request body).
                  result = { error: error instanceof Error ? error.message : String(error) };
                }

                syntheticChunks.push(synthetic);
                toolResultContents.push({
                  type: 'tool-result' as const,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  input: toolCall.args,
                  result,
                  ...(modelOutput != null
                    ? { providerOptions: { mastra: { modelOutput: modelOutput as JSONValue } } }
                    : {}),
                  ...(observability ? { __mastraObservability: observability } : {}),
                });
              }

              // Wait for the server-side stream pipe to finish before
              // enqueueing synthetic chunks so the React reducer observes
              // the server `finish` chunk first, then terminal tool chunks.
              try {
                await pipePromise;
              } catch {
                // pipePromise already has its own .catch; ignore here.
              }

              for (const synthetic of syntheticChunks) {
                try {
                  const errorForSerialization = synthetic.type === 'tool-error' ? synthetic.payload.error : undefined;
                  const serializedError =
                    errorForSerialization instanceof Error
                      ? {
                          name: errorForSerialization.name,
                          message: errorForSerialization.message,
                          stack: errorForSerialization.stack,
                        }
                      : errorForSerialization;
                  const payloadForWire =
                    synthetic.type === 'tool-error'
                      ? { ...synthetic, payload: { ...synthetic.payload, error: serializedError } }
                      : synthetic;
                  const sseLine = `data: ${JSON.stringify(payloadForWire)}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseLine));
                } catch (enqueueErr) {
                  console.error('Failed to enqueue synthetic tool-result chunk:', enqueueErr);
                }
              }

              const toolResultMessage = {
                role: 'tool' as const,
                content: toolResultContents,
              };

              const updatedMessages = threadId
                ? [toolResultMessage]
                : [
                    ...(Array.isArray(processedParams.messages) ? processedParams.messages : []),
                    ...messages,
                    toolResultMessage,
                  ];

              // Recursively call stream with updated messages
              // This will wait for the recursive stream to complete before continuing.
              // Resume routes are one-shot (they consume server-side resumeData),
              // so client-tool continuations must fall back to the corresponding
              // non-resume stream endpoint. Other routes (e.g. stream-until-idle)
              // are idempotent continuations and stay on the same endpoint.
              const recursionRoute =
                route === 'resume-stream'
                  ? 'stream'
                  : route === 'resume-stream-until-idle'
                    ? 'stream-until-idle'
                    : route;
              try {
                await this.processStreamResponse(
                  {
                    ...processedParams,
                    messages: updatedMessages,
                  },
                  controller,
                  recursionRoute,
                );
              } catch (error) {
                console.error('Error processing recursive stream response:', error);
              }
            } else {
              // Close the controller after all processing is complete
              // Wait for current pipe to finish before closing
              await pipePromise;
              controller.close();
            }
          } else {
            // No tool calls - wait for pipe to complete then close the stream
            await pipePromise;
            controller.close();
          }
        },
        onStreamChunk: chunk => {
          if (!streamRunId && typeof chunk.runId === 'string') {
            streamRunId = chunk.runId;
          }
        },
        lastMessage: undefined,
      }).catch(async error => {
        console.error('Error processing stream response:', error);
        // On error, wait for pipe to complete then close the controller
        try {
          await pipePromise;
          controller.close();
        } catch {
          // Already closed
        }
      });
    } catch (error) {
      console.error('Error processing stream response:', error);
    }

    return response;
  }

  async network<OUTPUT>(
    messages: MessageListInput,
    params: Omit<NetworkStreamParams<OUTPUT>, 'messages'>,
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const processedParams = {
      ...params,
      messages,
      requestContext: parseClientRequestContext(params.requestContext),
      structuredOutput: params.structuredOutput
        ? {
            ...params.structuredOutput,
            schema: zodToJsonSchema(params.structuredOutput.schema),
          }
        : undefined,
    };

    const response: Response = await this.request(`/agents/${this.agentId}/network`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const streamResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
    }) => {
      await processMastraNetworkStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  async approveNetworkToolCall(params: {
    runId: string;
    requestContext?: RequestContext | Record<string, any>;
  }): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const { requestContext, ...rest } = params;
    const response: Response = await this.request(`/agents/${this.agentId}/approve-network-tool-call`, {
      method: 'POST',
      body: { ...rest, requestContext: parseClientRequestContext(requestContext) },
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const streamResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
    }) => {
      await processMastraNetworkStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  async declineNetworkToolCall(params: {
    runId: string;
    requestContext?: RequestContext | Record<string, any>;
  }): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const { requestContext, ...rest } = params;
    const response: Response = await this.request(`/agents/${this.agentId}/decline-network-tool-call`, {
      method: 'POST',
      body: { ...rest, requestContext: parseClientRequestContext(requestContext) },
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const streamResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
    }) => {
      await processMastraNetworkStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  async stream<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: StreamParamsBaseWithoutMessages<OUTPUT> & {
      structuredOutput: StructuredOutputOptions<OUTPUT>;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  async stream(
    messages: MessageListInput,
    streamOptions: StreamParamsBaseWithoutMessages<any> & {
      structuredOutput?: StructuredOutputOptions<any>;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  async stream(
    messages: MessageListInput,
    streamOptions?: StreamParamsBaseWithoutMessages,
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  async stream<OUTPUT>(
    messagesOrParams: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: StreamParamsBaseWithoutMessages<any>;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    // Handle both new signature (messages, options) and old signature (single param object)
    let params: StreamParams<OUTPUT> = {
      messages: messagesOrParams as MessageListInput,
      ...options,
    } as StreamParams<OUTPUT>;

    let structuredOutput: SerializableStructuredOutputOptions<OUTPUT> | undefined = undefined;
    if (params.structuredOutput?.schema) {
      structuredOutput = {
        ...params.structuredOutput,
        schema: standardSchemaToJSONSchema(toStandardSchema(params.structuredOutput.schema)),
      } as SerializableStructuredOutputOptions<OUTPUT>;
    }
    const processedParams: StreamParams<OUTPUT> = {
      ...params,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
      structuredOutput,
    };

    // Create a manually controlled readable stream
    let readableController: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
    });

    // Start processing the response in the background
    // This returns immediately with response metadata and continues streaming in background
    const response = await this.processStreamResponse(processedParams, readableController!);

    // Create a new response with the readable stream
    const streamResponse = new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    // Add the processDataStream method to the response
    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  /**
   * @deprecated Use `stream(messages, { untilIdle: true })` instead.
   */
  async streamUntilIdle<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: StreamParamsBaseWithoutMessages<OUTPUT> & {
      structuredOutput: StructuredOutputOptions<OUTPUT>;
      maxIdleMs?: number;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  async streamUntilIdle(
    messages: MessageListInput,
    streamOptions: StreamParamsBaseWithoutMessages<any> & {
      structuredOutput?: StructuredOutputOptions<any>;
      maxIdleMs?: number;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  async streamUntilIdle(
    messages: MessageListInput,
    streamOptions?: StreamParamsBaseWithoutMessages<any> & {
      maxIdleMs?: number;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  async streamUntilIdle<OUTPUT>(
    messagesOrParams: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: StreamParamsBaseWithoutMessages<any>;
      maxIdleMs?: number;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    // Handle both new signature (messages, options) and old signature (single param object)
    let params: StreamParams<OUTPUT> = {
      messages: messagesOrParams as MessageListInput,
      ...options,
    } as StreamParams<OUTPUT>;

    let structuredOutput: SerializableStructuredOutputOptions<OUTPUT> | undefined = undefined;
    if (params.structuredOutput?.schema) {
      structuredOutput = {
        ...params.structuredOutput,
        schema: standardSchemaToJSONSchema(toStandardSchema(params.structuredOutput.schema)),
      } as SerializableStructuredOutputOptions<OUTPUT>;
    }
    const processedParams: StreamParams<OUTPUT> = {
      ...params,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
      structuredOutput,
    };

    // Create a manually controlled readable stream
    let readableController: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
    });

    // Start processing the response in the background
    // This returns immediately with response metadata and continues streaming in background
    const response = await this.processStreamResponse(processedParams, readableController!, 'stream-until-idle');

    // Create a new response with the readable stream
    const streamResponse = new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    // Add the processDataStream method to the response
    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  /**
   * Lists suspended runs for this agent from storage — runs waiting on a
   * tool-call approval or on a tool that suspended. Backed by storage, so it
   * works after a server restart and across server instances. Pass the
   * returned runId to approveToolCall(), declineToolCall(), or resumeStream().
   * @param params - Optional filters (threadId, resourceId, fromDate, toDate) and pagination (perPage, page)
   * @param requestContext - Optional request context
   * @returns Promise containing the matching runs and the total count before pagination
   */
  async listSuspendedRuns(
    params?: ListAgentSuspendedRunsParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ListAgentSuspendedRunsResponse> {
    const searchParams = new URLSearchParams(requestContextQueryString(requestContext).slice(1));
    if (params?.threadId) searchParams.set('threadId', params.threadId);
    if (params?.resourceId) searchParams.set('resourceId', params.resourceId);
    if (params?.fromDate) searchParams.set('fromDate', params.fromDate.toISOString());
    if (params?.toDate) searchParams.set('toDate', params.toDate.toISOString());
    if (params?.perPage !== undefined) searchParams.set('perPage', String(params.perPage));
    if (params?.page !== undefined) searchParams.set('page', String(params.page));

    const query = searchParams.size ? `?${searchParams}` : '';
    return this.request<ListAgentSuspendedRunsResponse>(`/agents/${this.agentId}/suspended-runs${query}`);
  }

  async approveToolCall(params: {
    runId: string;
    toolCallId: string;
    requestContext?: RequestContext | Record<string, any>;
  }): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const { requestContext, ...rest } = params;
    const processedParams = { ...rest, requestContext: parseClientRequestContext(requestContext) };

    // Create a manually controlled readable stream
    let readableController: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
    });

    // Start processing the response in the background
    const response = await this.processStreamResponse(processedParams, readableController!, 'approve-tool-call');

    // Create a new response with the readable stream
    const streamResponse = new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    // Add the processDataStream method to the response
    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  async sendToolApproval(params: {
    resourceId: string;
    threadId: string;
    toolCallId: string;
    approved: boolean;
    resumeData?: unknown;
    requestContext?: RequestContext | Record<string, any>;
    messages?: MessageListInput;
    streamOptions?: StreamParamsBaseWithoutMessages<any>;
  }): Promise<{ accepted: true; runId: string; toolCallId?: string }> {
    const { requestContext, ...rest } = params;
    return this.request<{ accepted: true; runId: string; toolCallId?: string }>(
      `/agents/${this.agentId}/send-tool-approval`,
      {
        method: 'POST',
        body: { ...rest, requestContext: parseClientRequestContext(requestContext) },
      },
    );
  }

  async declineToolCall(params: {
    runId: string;
    toolCallId: string;
    requestContext?: RequestContext | Record<string, any>;
  }): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const { requestContext, ...rest } = params;
    const processedParams = { ...rest, requestContext: parseClientRequestContext(requestContext) };

    // Create a manually controlled readable stream
    let readableController: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
    });

    // Start processing the response in the background
    const response = await this.processStreamResponse(processedParams, readableController!, 'decline-tool-call');

    // Create a new response with the readable stream
    const streamResponse = new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    // Add the processDataStream method to the response
    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  /**
   * Observe (reconnect to) an existing agent stream.
   * Use this to resume receiving events after a disconnection.
   *
   * @param params.runId - The run ID to observe
   * @param params.offset - Optional position to resume from (0-based). If omitted, replays all events.
   * @returns Promise containing a streaming Response
   *
   * @example
   * ```typescript
   * // Reconnect to a stream from a specific position
   * const response = await client.agents('my-agent').observe({
   *   runId: 'run-123',
   *   offset: 42, // Resume from event 42
   * });
   *
   * await response.processDataStream({
   *   onChunk: (chunk) => console.log('Received:', chunk),
   * });
   * ```
   */
  async observe(params: { runId: string; offset?: number }): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const response: Response = await this.request(`/agents/${this.agentId}/observe`, {
      method: 'POST',
      body: params,
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const streamResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  /**
   * Resumes a suspended agent stream with custom resume data.
   * Used to continue execution after a suspension point (e.g., workflow suspend within an agent).
   */
  async resumeStream<OUTPUT extends {}>(
    resumeData: JSONValue,
    options: ResumeStreamParams<OUTPUT>,
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const processedParams = {
      ...options,
      resumeData,
      requestContext: parseClientRequestContext(options.requestContext),
      clientTools: processClientTools(options.clientTools),
      structuredOutput: options.structuredOutput
        ? {
            ...options.structuredOutput,
            schema: standardSchemaToJSONSchema(toStandardSchema(options.structuredOutput.schema)),
          }
        : undefined,
    };

    let readableController: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
    });

    const response = await this.processStreamResponse(processedParams, readableController!, 'resume-stream');

    const streamResponse = new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  /**
   * Re-drives an orphaned RUNNING durable-agent run after a process restart.
   *
   * Only supported when the target agent is a durable agent (createDurableAgent).
   * The server rebuilds the runtime state from the persisted snapshot, replays
   * past chunks, and continues the loop to completion.
   */
  async recover(params: RecoverParams): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const body = {
      runId: params.runId,
      requestContext: parseClientRequestContext(params.requestContext),
      versions: params.versions,
    };

    const response: Response = await this.request(`/agents/${this.agentId}/recover`, {
      method: 'POST',
      body,
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const streamResponse = response as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  /**
   * @deprecated Use `resumeStream(resumeData, { untilIdle: true, ... })` instead.
   *
   * Resumes a suspended agent stream until idle with custom resume data.
   * Used to continue execution after a suspension point (e.g., workflow suspend within an agent).
   */
  async resumeStreamUntilIdle<OUTPUT extends {}>(
    resumeData: JSONValue,
    options: ResumeStreamParams<OUTPUT> & {
      maxIdleMs?: number;
    },
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const processedParams = {
      ...options,
      resumeData,
      requestContext: parseClientRequestContext(options.requestContext),
      clientTools: processClientTools(options.clientTools),
      structuredOutput: options.structuredOutput
        ? {
            ...options.structuredOutput,
            schema: standardSchemaToJSONSchema(toStandardSchema(options.structuredOutput.schema)),
          }
        : undefined,
    };

    let readableController: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        readableController = controller;
      },
    });

    const response = await this.processStreamResponse(processedParams, readableController!, 'resume-stream-until-idle');

    const streamResponse = new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }) as Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    };

    streamResponse.processDataStream = async ({
      onChunk,
    }: {
      onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
    }) => {
      await processMastraStream({
        stream: streamResponse.body as ReadableStream<Uint8Array>,
        onChunk,
      });
    };

    return streamResponse;
  }

  /**
   * Approves a pending tool call and returns the complete response (non-streaming).
   * Used when `requireToolApproval` is enabled with generate() to allow the agent to proceed.
   */
  async approveToolCallGenerate(params: {
    runId: string;
    toolCallId: string;
    requestContext?: RequestContext | Record<string, any>;
  }): Promise<any> {
    const { requestContext, ...rest } = params;
    return this.request(`/agents/${this.agentId}/approve-tool-call-generate`, {
      method: 'POST',
      body: { ...rest, requestContext: parseClientRequestContext(requestContext) },
    });
  }

  /**
   * Declines a pending tool call and returns the complete response (non-streaming).
   * Used when `requireToolApproval` is enabled with generate() to prevent tool execution.
   */
  async declineToolCallGenerate(params: {
    runId: string;
    toolCallId: string;
    requestContext?: RequestContext | Record<string, any>;
  }): Promise<any> {
    const { requestContext, ...rest } = params;
    return this.request(`/agents/${this.agentId}/decline-tool-call-generate`, {
      method: 'POST',
      body: { ...rest, requestContext: parseClientRequestContext(requestContext) },
    });
  }

  /**
   * Processes the stream response and handles tool calls
   */
  private async processStreamResponseLegacy(processedParams: any, writable: WritableStream<Uint8Array>) {
    // Extract threadId from memory config if present (matching generate() behavior)
    const { memory } = processedParams ?? {};
    const { resource, thread } = memory ?? {};
    const threadId = processedParams.threadId ?? (typeof thread === 'string' ? thread : thread?.id);
    const resourceId = processedParams.resourceId ?? resource;

    const response: Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    } = await this.request(this.routeOverrides?.stream ?? `/agents/${this.agentId}/stream-legacy`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    try {
      let toolCalls: ToolInvocation[] = [];
      let messages: UIMessage[] = [];

      // Use tee() to split the stream into two branches
      const [streamForWritable, streamForProcessing] = response.body.tee();

      // Pipe one branch to the writable stream
      streamForWritable
        .pipeTo(writable, {
          preventClose: true,
        })
        .catch(error => {
          console.error('Error piping to writable stream:', error);
        });

      // Process the other branch for chat response handling
      this.processChatResponse({
        stream: streamForProcessing as unknown as ReadableStream<Uint8Array>,
        update: ({ message }) => {
          const existingIndex = messages.findIndex(m => m.id === message.id);

          if (existingIndex !== -1) {
            messages[existingIndex] = message;
          } else {
            messages.push(message);
          }
        },
        onFinish: async ({ finishReason, message }) => {
          if (finishReason === 'tool-calls') {
            const toolCall = [...(message?.parts ?? [])]
              .reverse()
              .find(part => part.type === 'tool-invocation')?.toolInvocation;
            if (toolCall) {
              const toolInvocationWithMetadata = message?.toolInvocations?.find(
                invocation => invocation.toolCallId === toolCall.toolCallId,
              );
              toolCalls.push({
                ...toolInvocationWithMetadata,
                ...toolCall,
                ...(!getClientToolObservabilityContext(toolCall) && toolInvocationWithMetadata
                  ? { observability: getClientToolObservabilityContext(toolInvocationWithMetadata) }
                  : {}),
              });
            }

            // Handle tool calls if needed
            for (const toolCall of toolCalls) {
              const clientTool = processedParams.clientTools?.[toolCall.toolName] as Tool;
              if (clientTool && clientTool.execute) {
                const { result, observability } = await executeClientToolWithObservability({
                  clientTool,
                  args: toolCall?.args,
                  toolName: toolCall.toolName,
                  parentContext: getClientToolObservabilityContext(toolCall),
                  executeContext: {
                    requestContext: processedParams.requestContext as RequestContext,
                    tracingContext: { currentSpan: undefined },
                    agent: {
                      agentId: this.agentId,
                      messages: (response as unknown as { messages: CoreMessage[] }).messages,
                      toolCallId: toolCall?.toolCallId,
                      suspend: async () => {},
                      threadId,
                      resourceId,
                    },
                  },
                });

                // write the tool result part to the stream
                const writer = writable.getWriter();

                try {
                  await writer.write(
                    new TextEncoder().encode(
                      'a:' +
                        JSON.stringify({
                          toolCallId: toolCall.toolCallId,
                          result,
                        }) +
                        '\n',
                    ),
                  );
                } finally {
                  writer.releaseLock();
                }

                const toolResultMessage = {
                  role: 'tool' as const,
                  content: [
                    {
                      type: 'tool-result' as const,
                      toolCallId: toolCall.toolCallId,
                      toolName: toolCall.toolName,
                      input: toolCall.args,
                      result,
                      ...(observability ? { __mastraObservability: observability } : {}),
                    },
                  ],
                };

                const updatedMessages = threadId
                  ? [toolResultMessage]
                  : [
                      ...(Array.isArray(processedParams.messages) ? processedParams.messages : []),
                      ...messages,
                      toolResultMessage,
                    ];

                // Recursively call stream with updated messages
                this.processStreamResponseLegacy(
                  {
                    ...processedParams,
                    messages: updatedMessages,
                  },
                  writable,
                ).catch(error => {
                  console.error('Error processing stream response:', error);
                });
              }
            }
          } else {
            setTimeout(() => {
              // We can't close the stream in this function, we have to wait until it's done
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              writable.close();
            }, 0);
          }
        },
        lastMessage: undefined,
      }).catch(error => {
        console.error('Error processing stream response:', error);
      });
    } catch (error) {
      console.error('Error processing stream response:', error);
    }
    return response;
  }

  /**
   * Gets details about a specific tool available to the agent
   * @param toolId - ID of the tool to retrieve
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing tool details
   */
  getTool(toolId: string, requestContext?: RequestContext | Record<string, any>): Promise<GetToolResponse> {
    return this.request(`/agents/${this.agentId}/tools/${toolId}${this.getQueryString(requestContext)}`);
  }

  /**
   * Executes a tool for the agent
   * @param toolId - ID of the tool to execute
   * @param params - Parameters required for tool execution
   * @returns Promise containing the tool execution results
   */
  executeTool(
    toolId: string,
    params: { data: any; requestContext?: RequestContext | Record<string, any> },
  ): Promise<any> {
    const body = {
      data: params.data,
      requestContext: parseClientRequestContext(params.requestContext),
    };
    return this.request(`/agents/${this.agentId}/tools/${toolId}/execute`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Updates the model for the agent
   * @param params - Parameters for updating the model
   * @returns Promise containing the updated model
   */
  updateModel(params: UpdateModelParams): Promise<{ message: string }> {
    return this.request(`/agents/${this.agentId}/model`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Resets the agent's model to the original model that was set during construction
   * @returns Promise containing a success message
   */
  resetModel(): Promise<{ message: string }> {
    return this.request(`/agents/${this.agentId}/model/reset`, {
      method: 'POST',
      body: {},
    });
  }

  /**
   * Updates the model for the agent in the model list
   * @param params - Parameters for updating the model
   * @returns Promise containing the updated model
   */
  updateModelInModelList({ modelConfigId, ...params }: UpdateModelInModelListParams): Promise<{ message: string }> {
    return this.request(`/agents/${this.agentId}/models/${modelConfigId}`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Reorders the models for the agent
   * @param params - Parameters for reordering the model list
   * @returns Promise containing the updated model list
   */
  reorderModelList(params: ReorderModelListParams): Promise<{ message: string }> {
    return this.request(`/agents/${this.agentId}/models/reorder`, {
      method: 'POST',
      body: params,
    });
  }
}

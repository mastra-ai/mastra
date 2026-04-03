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
import type { MessageListInput } from '@mastra/core/agent/message-list';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { GenerateReturn, CoreMessage } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import type { FullOutput, MastraModelOutput } from '@mastra/core/stream';
import type { Tool } from '@mastra/core/tools';
import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/schema-compat/schema';
import type { JSONSchema7 } from 'json-schema';
import type {
  ZodSchema,
  GenerateLegacyParams,
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
  CreateCodeAgentVersionParams,
  ActivateAgentVersionResponse,
  CompareVersionsResponse,
  DeleteAgentVersionResponse,
  RestoreAgentVersionResponse,
} from '../types';

import { parseClientRequestContext, requestContextQueryString, toQueryParams } from '../utils';
import { processClientTools } from '../utils/process-client-tools';
import { processMastraNetworkStream, processMastraStream } from '../utils/process-mastra-stream';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { BaseResource } from './base';

type ToolCallRespondFn<OUTPUT> = (
  messages: MessageListInput,
  options: StreamParamsBaseWithoutMessages<OUTPUT> & {
    structuredOutput?: StructuredOutputOptions<OUTPUT>;
  },
) => Promise<FullOutput<OUTPUT>>;

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
        toolCalls: { payload: { toolName: string; args: any; toolCallId: string } }[];
        messages: CoreMessage[];
      }
    ).toolCalls;

    if (!toolCalls || !Array.isArray(toolCalls)) {
      return response;
    }

    for (const toolCall of toolCalls) {
      const clientTool = params.clientTools?.[toolCall.payload.toolName] as Tool;

      if (clientTool && clientTool.execute) {
        const result = await clientTool.execute(toolCall?.payload.args, {
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
        });

        // Build updated messages from the response, adding the tool result
        // When threadId is present, server has memory - don't re-include original messages to avoid storage duplicates
        // When no threadId (stateless), include full conversation history for context
        const newMessages = [
          ...(response.response.messages || []),
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: toolCall.payload.toolCallId,
                toolName: toolCall.payload.toolName,
                result,
              },
            ],
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

  /**
   * Retrieves details about the agent
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing agent details including model and instructions
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<GetAgentResponse> {
    return this.request(`/agents/${this.agentId}${this.getQueryString(requestContext)}`);
  }

  enhanceInstructions(instructions: string, comment: string): Promise<{ explanation: string; new_prompt: string }> {
    return this.request(`/agents/${this.agentId}/instructions/enhance`, {
      method: 'POST',
      body: { instructions, comment },
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
    if (params?.orderBy) queryParams.set('orderBy', params.orderBy);
    if (params?.sortDirection) queryParams.set('sortDirection', params.sortDirection);

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
          const result = await clientTool.execute(toolCall?.args, {
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
    const partialToolCalls: Record<string, { text: string; step: number; index: number; toolName: string }> = {};

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

    function getActiveToolCallId(): string | undefined {
      if (message.toolInvocations == null || message.toolInvocations.length === 0) {
        return undefined;
      }
      // Find the last tool invocation that is not in a 'result' or 'error' state.
      // The protocol streams tool calls sequentially.
      for (let i = message.toolInvocations.length - 1; i >= 0; i--) {
        const inv = message.toolInvocations[i];
        if (inv.state !== 'result' && inv.state !== 'error') {
          return inv.toolCallId;
        }
      }
      return undefined;
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
        };

        const invocation = {
          state: 'partial-call',
          step,
          toolCallId: value.toolCallId,
          toolName: value.toolName,
          args: undefined,
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
        } as const;

        message.toolInvocations![partialToolCall!.index] = invocation;

        updateToolInvocationPart(value.toolCallId, invocation);

        execUpdate();
      },
      async onToolCallPart(value) {
        const invocation = {
          state: 'call',
          step,
          ...value,
        } as const;

        if (partialToolCalls[value.toolCallId] != null) {
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
          const result = await onToolCall({ toolCall: value });
          if (result != null) {
            const invocation = {
              state: 'result',
              step,
              ...value,
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
        };

        toolInvocations[toolInvocationIndex] = invocation;

        updateToolInvocationPart(value.toolCallId, invocation);

        step += 1;
        currentTextPart = undefined;
        currentReasoningPart = undefined;
        currentReasoningTextDetail = undefined;

        execUpdate();
      },
      onDataPart(value) {
        const activeToolCallId = getActiveToolCallId();

        // When a sub-agent streams, the server may send raw stream parts as data parts
        // without the 'tool-agent' wrapper. This happens in 3+ level delegations.
        // We need to wrap them here so the UI can attribute them to the active tool call.
        if (
          activeToolCallId &&
          value &&
          typeof value === 'object' &&
          'type' in value &&
          (value as { type: string }).type !== 'tool-agent'
        ) {
          data.push({
            type: 'tool-agent',
            toolCallId: activeToolCallId,
            payload: value,
          });
        } else {
          // This is either a normal data part, a pre-wrapped 'tool-agent' part (from a 2-level call),
          // or we are not in an active tool call. Pass it through.
          data.push(value);
        }
        execUpdate();
      },
      onStepStartPart() {
        step += 1;
        currentTextPart = undefined;
        currentReasoningPart = undefined;
        currentReasoningTextDetail = undefined;
      },
      onStepFinishPart() {
        // do nothing
      },
      onMessageAnnotationPart(value) {
        if (messageAnnotations == null) {
          messageAnnotations = [];
        }
        messageAnnotations.push(value);
        execUpdate();
      },
      onFinishPart(value) {
        finishReason = value.finishReason;
        usage = value.usage;
      },
      onErrorPart(value) {
        message.role = 'error';
        message.content = value.error.message ?? String(value.error);
        finishReason = 'error';
        execUpdate();
      },
    });

    onFinish?.({
      message: message.content === '' && message.toolInvocations == null ? undefined : message,
      finishReason,
      usage,
    });
  }
}

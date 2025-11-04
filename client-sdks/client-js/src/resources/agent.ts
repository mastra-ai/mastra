import type { ReadableStream } from 'stream/web';
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
import type { MessageListInput } from '@mastra/core/agent/message-list';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { GenerateReturn, CoreMessage } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import type { OutputSchema, MastraModelOutput } from '@mastra/core/stream';
import type { Tool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';
import type { ZodType } from 'zod';
import type {
  GenerateLegacyParams,
  GetAgentResponse,
  GetToolResponse,
  ClientOptions,
  StreamParams,
  StreamLegacyParams,
  UpdateModelParams,
  UpdateModelInModelListParams,
  ReorderModelListParams,
  NetworkStreamParams,
} from '../types';

import { parseClientRequestContext, requestContextQueryString } from '../utils';
import { processClientTools } from '../utils/process-client-tools';
import { processMastraNetworkStream, processMastraStream } from '../utils/process-mastra-stream';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { BaseResource } from './base';

async function executeToolCallAndRespond({
  response,
  params,
  resourceId,
  threadId,
  requestContext,
  respondFn,
}: {
  params: StreamParams<any>;
  response: Awaited<ReturnType<MastraModelOutput['getFullOutput']>>;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext<any>;
  respondFn: Agent['generate'];
}) {
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
          ...(response.response.messages || []),
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
        ] as MessageListInput;

        // @ts-ignore
        return respondFn({
          ...params,
          messages: updatedMessages,
        });
      }
    }
  }
}

export class AgentVoice extends BaseResource {
  constructor(
    options: ClientOptions,
    private agentId: string,
  ) {
    super(options);
    this.agentId = agentId;
  }

  /**
   * Convert text to speech using the agent's voice provider
   * @param text - Text to convert to speech
   * @param options - Optional provider-specific options for speech generation
   * @returns Promise containing the audio data
   */
  async speak(text: string, options?: { speaker?: string; [key: string]: any }): Promise<Response> {
    return this.request<Response>(`/api/agents/${this.agentId}/voice/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { input: text, options },
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

    return this.request(`/api/agents/${this.agentId}/voice/listen`, {
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
    return this.request(`/api/agents/${this.agentId}/voice/speakers${requestContextQueryString(requestContext)}`);
  }

  /**
   * Get the listener configuration for the agent's voice provider
   * @param requestContext - Optional request context to pass as query parameter
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing a check if the agent has listening capabilities
   */
  getListener(requestContext?: RequestContext | Record<string, any>): Promise<{ enabled: boolean }> {
    return this.request(`/api/agents/${this.agentId}/voice/listener${requestContextQueryString(requestContext)}`);
  }
}

export class Agent extends BaseResource {
  public readonly voice: AgentVoice;

  constructor(
    options: ClientOptions,
    private agentId: string,
  ) {
    super(options);
    this.voice = new AgentVoice(options, this.agentId);
  }

  /**
   * Retrieves details about the agent
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing agent details including model and instructions
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<GetAgentResponse> {
    return this.request(`/api/agents/${this.agentId}${requestContextQueryString(requestContext)}`);
  }

  enhanceInstructions(instructions: string, comment: string): Promise<{ explanation: string; new_prompt: string }> {
    return this.request(`/api/agents/${this.agentId}/instructions/enhance`, {
      method: 'POST',
      body: { instructions, comment },
    });
  }

  /**
   * Generates a response from the agent
   * @param params - Generation parameters including prompt
   * @returns Promise containing the generated response
   */
  async generateLegacy(
    params: GenerateLegacyParams<undefined> & { output?: never; experimental_output?: never },
  ): Promise<GenerateReturn<any, undefined, undefined>>;
  async generateLegacy<Output extends JSONSchema7 | ZodType>(
    params: GenerateLegacyParams<Output> & { output: Output; experimental_output?: never },
  ): Promise<GenerateReturn<any, Output, undefined>>;
  async generateLegacy<StructuredOutput extends JSONSchema7 | ZodType>(
    params: GenerateLegacyParams<StructuredOutput> & { output?: never; experimental_output: StructuredOutput },
  ): Promise<GenerateReturn<any, undefined, StructuredOutput>>;
  async generateLegacy<
    Output extends JSONSchema7 | ZodType | undefined = undefined,
    StructuredOutput extends JSONSchema7 | ZodType | undefined = undefined,
  >(params: GenerateLegacyParams<Output>): Promise<GenerateReturn<any, Output, StructuredOutput>> {
    const processedParams = {
      ...params,
      output: params.output ? zodToJsonSchema(params.output) : undefined,
      experimental_output: params.experimental_output ? zodToJsonSchema(params.experimental_output) : undefined,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
    };

    const { resourceId, threadId, requestContext } = processedParams as GenerateLegacyParams;

    const response: GenerateReturn<any, Output, StructuredOutput> = await this.request(
      `/api/agents/${this.agentId}/generate-legacy`,
      {
        method: 'POST',
        body: processedParams,
      },
    );

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
          // @ts-ignore
          return this.generate({
            ...params,
            messages: updatedMessages,
          });
        }
      }
    }

    return response;
  }

  async generate<OUTPUT extends OutputSchema = undefined>(
    messages: MessageListInput,
    options?: Omit<StreamParams<OUTPUT>, 'messages'>,
  ): Promise<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
  // Backward compatibility overload
  async generate<OUTPUT extends OutputSchema = undefined>(
    params: StreamParams<OUTPUT>,
  ): Promise<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
  async generate<OUTPUT extends OutputSchema = undefined>(
    messagesOrParams: MessageListInput | StreamParams<OUTPUT>,
    options?: Omit<StreamParams<OUTPUT>, 'messages'>,
  ): Promise<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>> {
    // Handle both new signature (messages, options) and old signature (single param object)
    let params: StreamParams<OUTPUT>;
    if (typeof messagesOrParams === 'object' && 'messages' in messagesOrParams) {
      // Old signature: single parameter object
      params = messagesOrParams;
    } else {
      // New signature: messages as first param, options as second
      params = {
        messages: messagesOrParams as MessageListInput,
        ...options,
      } as StreamParams<OUTPUT>;
    }
    const processedParams = {
      ...params,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
      structuredOutput: params.structuredOutput
        ? {
            ...params.structuredOutput,
            schema: zodToJsonSchema(params.structuredOutput.schema),
          }
        : undefined,
    };

    const { resourceId, threadId, requestContext } = processedParams as StreamParams;

    const response = await this.request<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>(
      `/api/agents/${this.agentId}/generate`,
      {
        method: 'POST',
        body: processedParams,
      },
    );

    if (response.finishReason === 'tool-calls') {
      return executeToolCallAndRespond({
        response,
        params,
        resourceId,
        threadId,
        requestContext: requestContext as RequestContext<any>,
        respondFn: this.generate.bind(this),
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
  async streamLegacy<T extends JSONSchema7 | ZodType | undefined = undefined>(
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

    await processMastraStream({
      stream,
      // TODO: casting as any here because the stream types were all typed as any before in core.
      // but this is completely wrong and this fn is probably broken. Remove ":any" and you'll see a bunch of type errors
      onChunk: async (chunk: any) => {
        switch (chunk.type) {
          case 'tripwire': {
            message.parts.push({
              type: 'text',
              text: chunk.payload.tripwireReason,
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
            const invocation = {
              state: 'call',
              step,
              ...chunk.payload,
            } as const;

            if (partialToolCalls[chunk.payload.toolCallId] != null) {
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
              const result = await onToolCall({ toolCall: chunk.payload as any });
              if (result != null) {
                const invocation = {
                  state: 'result',
                  step,
                  ...chunk.payload,
                  result,
                } as const;

                // store the result in the tool invocation
                message.toolInvocations![message.toolInvocations!.length - 1] = invocation as ToolInvocation;

                updateToolInvocationPart(chunk.payload.toolCallId, invocation as ToolInvocation);

                execUpdate();
              }
            }
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
            };

            const invocation = {
              state: 'partial-call',
              step,
              toolCallId: chunk.payload.toolCallId,
              toolName: chunk.payload.toolName,
              args: chunk.payload.args,
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
            currentTextPart = chunk.payload.stepResult.isContinued ? currentTextPart : undefined;
            currentReasoningPart = undefined;
            currentReasoningTextDetail = undefined;

            execUpdate();
            break;
          }

          case 'finish': {
            finishReason = chunk.payload.stepResult.reason;
            if (chunk.payload.usage != null) {
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

  async processStreamResponse(processedParams: any, writable: any, route: string = 'stream') {
    const response: Response = await this.request(`/api/agents/${this.agentId}/${route}`, {
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

      // Pipe one branch to the writable stream without holding a persistent lock

      streamForWritable
        .pipeTo(
          new WritableStream<Uint8Array>({
            async write(chunk) {
              let writer;

              // Filter out terminal markers so the client stream doesn't end before recursion
              try {
                writer = writable.getWriter();
                const text = new TextDecoder().decode(chunk);
                const lines = text.split('\n\n');
                const readableLines = lines.filter(line => line !== '[DONE]').join('\n\n');

                await writer.write(new TextEncoder().encode(readableLines));
              } catch {
                await writer?.write(chunk);
              } finally {
                writer?.releaseLock();
              }
            },
          }),
          {
            preventClose: true,
          },
        )
        .catch(error => {
          console.error('Error piping to writable stream:', error);
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
            const toolCall = [...(message?.parts ?? [])]
              .reverse()
              .find(part => part.type === 'tool-invocation')?.toolInvocation;
            if (toolCall) {
              toolCalls.push(toolCall);
            }

            let shouldExecuteClientTool = false;
            // Handle tool calls if needed
            for (const toolCall of toolCalls) {
              const clientTool = processedParams.clientTools?.[toolCall.toolName] as Tool;
              if (clientTool && clientTool.execute) {
                shouldExecuteClientTool = true;
                const result = await clientTool.execute(toolCall?.args, {
                  requestContext: processedParams.requestContext as RequestContext,
                  // TODO: Pass proper tracing context when client-js supports tracing
                  tracingContext: { currentSpan: undefined },
                  agent: {
                    messages: (response as unknown as { messages: CoreMessage[] }).messages,
                    toolCallId: toolCall?.toolCallId,
                    suspend: async () => {},
                    threadId: processedParams.threadId,
                    resourceId: processedParams.resourceId,
                  },
                });

                const lastMessageRaw = messages[messages.length - 1];
                const lastMessage: UIMessage | undefined =
                  lastMessageRaw != null ? JSON.parse(JSON.stringify(lastMessageRaw)) : undefined;

                const toolInvocationPart = lastMessage?.parts?.find(
                  part => part.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCall.toolCallId,
                ) as ToolInvocationUIPart | undefined;

                if (toolInvocationPart) {
                  toolInvocationPart.toolInvocation = {
                    ...toolInvocationPart.toolInvocation,
                    state: 'result',
                    result,
                  };
                }

                const toolInvocation = lastMessage?.toolInvocations?.find(
                  toolInvocation => toolInvocation.toolCallId === toolCall.toolCallId,
                ) as ToolInvocation | undefined;

                if (toolInvocation) {
                  toolInvocation.state = 'result';
                  // @ts-ignore
                  toolInvocation.result = result;
                }

                // Build updated messages for the recursive call
                // Do NOT re-include the original messages to avoid storage duplicates
                const updatedMessages =
                  lastMessage != null ? [...messages.filter(m => m.id !== lastMessage.id), lastMessage] : [...messages];

                // Recursively call stream with updated messages
                this.processStreamResponse(
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

            if (!shouldExecuteClientTool) {
              setTimeout(() => {
                writable.close();
              }, 0);
            }
          } else {
            setTimeout(() => {
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

  async network(params: NetworkStreamParams): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraNetworkStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    const response: Response = await this.request(`/api/agents/${this.agentId}/network`, {
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
  async stream<OUTPUT extends OutputSchema = undefined>(
    messages: MessageListInput,
    options?: Omit<StreamParams<OUTPUT>, 'messages'>,
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  // Backward compatibility overload
  async stream<OUTPUT extends OutputSchema = undefined>(
    params: StreamParams<OUTPUT>,
  ): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  >;
  async stream<OUTPUT extends OutputSchema = undefined>(
    messagesOrParams: MessageListInput | StreamParams<OUTPUT>,
    options?: Omit<StreamParams<OUTPUT>, 'messages'>,
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
    let params: StreamParams<OUTPUT>;
    if (typeof messagesOrParams === 'object' && 'messages' in messagesOrParams) {
      // Old signature: single parameter object
      params = messagesOrParams;
    } else {
      // New signature: messages as first param, options as second
      params = {
        messages: messagesOrParams as MessageListInput,
        ...options,
      } as StreamParams<OUTPUT>;
    }
    const processedParams: StreamParams<OUTPUT> = {
      ...params,
      requestContext: parseClientRequestContext(params.requestContext),
      clientTools: processClientTools(params.clientTools),
      structuredOutput: params.structuredOutput
        ? {
            ...params.structuredOutput,
            schema: zodToJsonSchema(params.structuredOutput.schema) as OUTPUT,
          }
        : undefined,
    };

    // Create a readable stream that will handle the response processing
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

    // Start processing the response in the background
    const response = await this.processStreamResponse(processedParams, writable);

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

  async approveToolCall(params: { runId: string; toolCallId: string }): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    // Create a readable stream that will handle the response processing
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

    // Start processing the response in the background
    const response = await this.processStreamResponse(params, writable, 'approve-tool-call');

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

  async declineToolCall(params: { runId: string; toolCallId: string }): Promise<
    Response & {
      processDataStream: ({
        onChunk,
      }: {
        onChunk: Parameters<typeof processMastraStream>[0]['onChunk'];
      }) => Promise<void>;
    }
  > {
    // Create a readable stream that will handle the response processing
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

    // Start processing the response in the background
    const response = await this.processStreamResponse(params, writable, 'decline-tool-call');

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
   * Processes the stream response and handles tool calls
   */
  private async processStreamResponseLegacy(processedParams: any, writable: WritableStream<Uint8Array>) {
    const response: Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    } = await this.request(`/api/agents/${this.agentId}/stream-legacy`, {
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
              toolCalls.push(toolCall);
            }

            // Handle tool calls if needed
            for (const toolCall of toolCalls) {
              const clientTool = processedParams.clientTools?.[toolCall.toolName] as Tool;
              if (clientTool && clientTool.execute) {
                const result = await clientTool.execute(toolCall?.args, {
                  requestContext: processedParams.requestContext as RequestContext,
                  // TODO: Pass proper tracing context when client-js supports tracing
                  tracingContext: { currentSpan: undefined },
                  agent: {
                    messages: (response as unknown as { messages: CoreMessage[] }).messages,
                    toolCallId: toolCall?.toolCallId,
                    suspend: async () => {},
                    threadId: processedParams.threadId,
                    resourceId: processedParams.resourceId,
                  },
                });

                const lastMessage: UIMessage = JSON.parse(JSON.stringify(messages[messages.length - 1]));

                const toolInvocationPart = lastMessage?.parts?.find(
                  part => part.type === 'tool-invocation' && part.toolInvocation?.toolCallId === toolCall.toolCallId,
                ) as ToolInvocationUIPart | undefined;

                if (toolInvocationPart) {
                  toolInvocationPart.toolInvocation = {
                    ...toolInvocationPart.toolInvocation,
                    state: 'result',
                    result,
                  };
                }

                const toolInvocation = lastMessage?.toolInvocations?.find(
                  toolInvocation => toolInvocation.toolCallId === toolCall.toolCallId,
                ) as ToolInvocation | undefined;

                if (toolInvocation) {
                  toolInvocation.state = 'result';
                  // @ts-ignore
                  toolInvocation.result = result;
                }

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

                // Recursively call stream with updated messages
                this.processStreamResponseLegacy(
                  {
                    ...processedParams,
                    messages: [...messages.filter(m => m.id !== lastMessage.id), lastMessage],
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
    return this.request(`/api/agents/${this.agentId}/tools/${toolId}${requestContextQueryString(requestContext)}`);
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
    return this.request(`/api/agents/${this.agentId}/tools/${toolId}/execute`, {
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
    return this.request(`/api/agents/${this.agentId}/model`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Resets the agent's model to the original model that was set during construction
   * @returns Promise containing a success message
   */
  resetModel(): Promise<{ message: string }> {
    return this.request(`/api/agents/${this.agentId}/model/reset`, {
      method: 'POST',
    });
  }

  /**
   * Updates the model for the agent in the model list
   * @param params - Parameters for updating the model
   * @returns Promise containing the updated model
   */
  updateModelInModelList({ modelConfigId, ...params }: UpdateModelInModelListParams): Promise<{ message: string }> {
    return this.request(`/api/agents/${this.agentId}/models/${modelConfigId}`, {
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
    return this.request(`/api/agents/${this.agentId}/models/reorder`, {
      method: 'POST',
      body: params,
    });
  }
}

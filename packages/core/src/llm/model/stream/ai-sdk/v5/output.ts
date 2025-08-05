import { TransformStream } from 'stream/web';
import { createTextStreamResponse, createUIMessageStream, createUIMessageStreamResponse } from 'ai-v5';
import type { TextStreamPart, ToolSet, UIMessage, UIMessageStreamOptions, StepResult } from 'ai-v5';

import type { ChunkType } from '../../../../../stream/types';
import type { MastraModelOutput } from '../../base';
import type { ConsumeStreamOptions } from '../v4/compat';
import { consumeStream, getErrorMessage } from '../v4/compat';
import { convertFullStreamChunkToUIMessageStream, getErrorMessageV5, getResponseUIMessageId } from './compat';
import { convertFullStreamChunkToAISDKv5 } from './transforms';

export class DefaultStepResult<TOOLS extends ToolSet> implements StepResult<TOOLS> {
  readonly content: StepResult<TOOLS>['content'];
  readonly finishReason: StepResult<TOOLS>['finishReason'];
  readonly usage: StepResult<TOOLS>['usage'];
  readonly warnings: StepResult<TOOLS>['warnings'];
  readonly request: StepResult<TOOLS>['request'];
  readonly response: StepResult<TOOLS>['response'];
  readonly providerMetadata: StepResult<TOOLS>['providerMetadata'];

  constructor({
    content,
    finishReason,
    usage,
    warnings,
    request,
    response,
    providerMetadata,
  }: {
    content: StepResult<TOOLS>['content'];
    finishReason: StepResult<TOOLS>['finishReason'];
    usage: StepResult<TOOLS>['usage'];
    warnings: StepResult<TOOLS>['warnings'];
    request: StepResult<TOOLS>['request'];
    response: StepResult<TOOLS>['response'];
    providerMetadata: StepResult<TOOLS>['providerMetadata'];
  }) {
    this.content = content;
    this.finishReason = finishReason;
    this.usage = usage;
    this.warnings = warnings;
    this.request = request;
    this.response = response;
    this.providerMetadata = providerMetadata;
  }

  get text() {
    return this.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }

  get reasoning() {
    return this.content.filter(part => part.type === 'reasoning');
  }

  get reasoningText() {
    return this.reasoning.length === 0 ? undefined : this.reasoning.map(part => part.text).join('');
  }

  get files() {
    return this.content.filter(part => part.type === 'file').map(part => part.file);
  }

  get sources() {
    return this.content.filter(part => part.type === 'source');
  }

  get toolCalls() {
    return this.content.filter(part => part.type === 'tool-call');
  }

  get staticToolCalls() {
    // @ts-ignore
    return this.toolCalls.filter((toolCall): toolCall is StaticToolCall<TOOLS> => toolCall.dynamic === false);
  }

  get dynamicToolCalls() {
    // @ts-ignore
    return this.toolCalls.filter((toolCall): toolCall is DynamicToolCall => toolCall.dynamic === true);
  }

  get toolResults() {
    return this.content.filter(part => part.type === 'tool-result');
  }

  get staticToolResults() {
    // @ts-ignore
    return this.toolResults.filter((toolResult): toolResult is StaticToolResult<TOOLS> => toolResult.dynamic === false);
  }

  get dynamicToolResults() {
    // @ts-ignore
    return this.toolResults.filter((toolResult): toolResult is DynamicToolResult => toolResult.dynamic === true);
  }
}

export class AISDKV5OutputStream {
  #modelOutput: MastraModelOutput;
  #options: { toolCallStreaming?: boolean };

  constructor({ modelOutput, options }: { modelOutput: MastraModelOutput; options: { toolCallStreaming?: boolean } }) {
    this.#modelOutput = modelOutput;
    this.#options = options;
  }

  toTextStreamResponse(init?: ResponseInit): Response {
    return createTextStreamResponse({
      textStream: this.#modelOutput.textStream as any,
      ...init,
    });
  }

  toUIMessageStreamResponse<UI_MESSAGE extends UIMessage>({
    // @ts-ignore
    generateMessageId,
    originalMessages,
    sendFinish,
    sendReasoning,
    sendSources,
    onError,
    sendStart,
    messageMetadata,
    onFinish,
    ...init
  }: UIMessageStreamOptions<UI_MESSAGE> & ResponseInit = {}) {
    return createUIMessageStreamResponse({
      stream: this.toUIMessageStream({
        // @ts-ignore
        generateMessageId,
        originalMessages,
        sendFinish,
        sendReasoning,
        sendSources,
        onError,
        sendStart,
        messageMetadata,
        onFinish,
      }),
      ...init,
    });
  }

  toUIMessageStream<UI_MESSAGE extends UIMessage>({
    // @ts-ignore
    generateMessageId,
    originalMessages,
    sendFinish = true,
    sendReasoning = true,
    sendSources = false,
    onError = getErrorMessageV5,
    sendStart = true,
    messageMetadata,
    onFinish,
  }: UIMessageStreamOptions<UI_MESSAGE> = {}) {
    const responseMessageId =
      generateMessageId != null
        ? getResponseUIMessageId({
            originalMessages,
            responseMessageId: generateMessageId,
          })
        : undefined;

    return createUIMessageStream({
      onError,
      onFinish,
      generateId: () => responseMessageId ?? generateMessageId?.(),
      execute: async ({ writer }) => {
        for await (const part of this.fullStream) {
          const messageMetadataValue = messageMetadata?.({ part });

          const partType = part.type;

          const transformedChunk = convertFullStreamChunkToUIMessageStream({
            part,
            sendReasoning,
            messageMetadataValue,
            sendSources,
            sendStart,
            sendFinish,
            responseMessageId,
            onError,
          });

          if (transformedChunk) {
            writer.write(transformedChunk as any);
          }

          // start and finish events already have metadata
          // so we only need to send metadata for other parts
          if (messageMetadataValue != null && partType !== 'start' && partType !== 'finish') {
            writer.write({
              type: 'message-metadata',
              messageMetadata: messageMetadataValue,
            });
          }
        }
      },
    });
  }

  async consumeStream(options?: ConsumeStreamOptions): Promise<void> {
    try {
      await consumeStream({
        stream: this.fullStream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              controller.enqueue(chunk);
            },
          }),
        ) as any,
        onError: options?.onError,
      });
    } catch (error) {
      console.log('consumeStream error', error);
      options?.onError?.(error);
    }
  }

  get sources() {
    return this.#modelOutput.sources.map(source => {
      return convertFullStreamChunkToAISDKv5({
        chunk: source,
        sendReasoning: false,
        sendSources: true,
        sendUsage: false,
        getErrorMessage: getErrorMessage,
      });
    });
  }

  get files() {
    return this.#modelOutput.files.map(file => {
      return convertFullStreamChunkToAISDKv5({
        chunk: file,
        sendReasoning: false,
        sendSources: false,
        sendUsage: false,
        getErrorMessage: getErrorMessage,
      })?.file;
    });
  }

  get toolCalls() {
    return this.#modelOutput.toolCalls.map(toolCall => {
      return convertFullStreamChunkToAISDKv5({
        chunk: toolCall,
        sendReasoning: false,
        sendSources: false,
        sendUsage: false,
        getErrorMessage: getErrorMessage,
      });
    });
  }

  get toolResults() {
    return this.#modelOutput.toolResults.map(toolResult => {
      return convertFullStreamChunkToAISDKv5({
        chunk: toolResult,
        sendReasoning: false,
        sendSources: false,
        sendUsage: false,
        getErrorMessage: getErrorMessage,
      });
    });
  }

  get reasoningText() {
    return this.#modelOutput.reasoningText;
  }

  get reasoning() {
    return this.#modelOutput.reasoningDetails;
  }

  transformResponse(response: any, isMessages: boolean = false) {
    const newResponse = { ...response };
    newResponse.messages = response.messages.map((message: any) => {
      let newContent = message.content.map((part: any) => {
        if (part.type === 'file') {
          if (isMessages) {
            return {
              type: 'file',
              mediaType: part.mimeType,
              data: part.data,
              providerOptions: part.providerOptions,
            };
          }
          const transformedFile = convertFullStreamChunkToAISDKv5({
            chunk: {
              type: 'file',
              payload: {
                data: part.data,
                mimeType: part.mimeType,
              },
            },
            sendReasoning: false,
            sendSources: false,
            sendUsage: false,
            getErrorMessage: getErrorMessage,
          });
          console.log('transformedFile', transformedFile);

          return transformedFile;
        }

        if (!isMessages) {
          const { providerOptions, providerMetadata, ...rest } = part;
          const providerMetadataValue = providerMetadata ?? providerOptions;
          return {
            ...rest,
            ...(providerMetadataValue ? { providerMetadata: providerMetadataValue } : {}),
          };
        }

        return part;
      });

      if (isMessages) {
        newContent = newContent.filter((part: any) => part.type !== 'source');
      }

      return {
        ...message,
        content: newContent,
      };
    });

    return newResponse;
  }

  get response() {
    return this.transformResponse(this.#modelOutput.response, true);
  }

  get steps() {
    return this.#modelOutput.steps.map(step => {
      return new DefaultStepResult({
        content: this.transformResponse(step.response).messages[0]?.content ?? [],
        warnings: step.warnings ?? [],
        providerMetadata: step.providerMetadata,
        finishReason: step.finishReason,
        response: this.transformResponse(step.response, true),
        request: step.request,
        usage: step.usage,
      });
    });
  }

  get content() {
    return this.transformResponse(this.response, true).messages[0]?.content ?? [];
  }

  get fullStream() {
    let startEvent: ChunkType | undefined;
    let hasStarted: boolean = false;
    let stepCounter = 1;
    return this.#modelOutput.fullStream.pipeThrough(
      new TransformStream<ChunkType, TextStreamPart<ToolSet>>({
        transform(chunk, controller) {
          if (chunk.type === 'step-start' && !startEvent) {
            startEvent = convertFullStreamChunkToAISDKv5({
              chunk,
              sendReasoning: false,
              sendSources: false,
              sendUsage: false,
              getErrorMessage: getErrorMessage,
            });
            stepCounter++;
            return;
          } else if (chunk.type !== 'error') {
            hasStarted = true;
          }

          if (startEvent && hasStarted) {
            controller.enqueue(startEvent as any);
            startEvent = undefined;
          }

          const transformedChunk = convertFullStreamChunkToAISDKv5({
            chunk,
            sendReasoning: false,
            sendSources: false,
            sendUsage: false,
            getErrorMessage: getErrorMessage,
          });

          if (transformedChunk) {
            // if (!['start', 'finish', 'finish-step'].includes(transformedChunk.type)) {
            //   console.log('step counter', stepCounter);
            //   transformedChunk.id = transformedChunk.id ?? stepCounter.toString();
            // }

            controller.enqueue(transformedChunk);
          }
        },
      }),
    );
  }

  async getFullOutput() {
    await this.consumeStream();
    return {
      text: this.#modelOutput.text,
      usage: this.#modelOutput.usage,
      steps: this.steps,
      finishReason: this.#modelOutput.finishReason,
      warnings: this.#modelOutput.warnings,
      providerMetadata: this.#modelOutput.providerMetadata,
      request: this.#modelOutput.request,
      reasoning: this.reasoning,
      reasoningText: this.reasoningText,
      toolCalls: this.toolCalls,
      toolResults: this.toolResults,
      sources: this.sources,
      files: this.files,
      response: this.response,
      content: this.content, // TODO: wrong shape / missing 'sources' (filtered out in transformResponse) etc
      totalUsage: this.#modelOutput.totalUsage,
      // experimental_output: // TODO
    };
  }
}

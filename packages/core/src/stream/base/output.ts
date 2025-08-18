import type { ReadableStream } from 'stream/web';
import { TransformStream } from 'stream/web';
import type { Span } from '@opentelemetry/api';
import { consumeStream } from 'ai-v5';
import type { TelemetrySettings } from 'ai-v5';
import type { MessageList } from '../../agent/message-list';
import { MastraBase } from '../../base';
import type { ObjectOptions } from '../../loop/types';
import { DelayedPromise } from '../aisdk/v5/compat';
import type { ConsumeStreamOptions } from '../aisdk/v5/compat';
import { createJsonTextStreamTransformer, createObjectStreamTransformer } from '../aisdk/v5/object/stream-object';
import { AISDKV5OutputStream } from '../aisdk/v5/output';
import { reasoningDetailsFromMessages, transformSteps } from '../aisdk/v5/output-helpers';
import type { BufferedByStep, ChunkType, StepBufferItem } from '../types';

type MastraModelOutputOptions = {
  runId: string;
  rootSpan?: Span;
  telemetry_settings?: TelemetrySettings;
  toolCallStreaming?: boolean;
  onFinish?: (event: any) => Promise<void> | void;
  onStepFinish?: (event: any) => Promise<void> | void;
  includeRawChunks?: boolean;
  objectOptions?: ObjectOptions;
};
export class MastraModelOutput extends MastraBase {
  #aisdkv5: AISDKV5OutputStream;
  #error: Error | string | { message: string; stack: string } | undefined;
  #baseStream: ReadableStream<any>;
  #bufferedSteps: StepBufferItem[] = [];
  #bufferedReasoningDetails: Record<
    string,
    {
      type: string;
      text: string;
      providerMetadata: any;
    }
  > = {};
  #bufferedByStep: BufferedByStep = {
    text: '',
    reasoning: '',
    sources: [],
    files: [],
    toolCalls: [],
    toolResults: [],
    msgCount: 0,
  };
  #bufferedText: string[] = [];
  #bufferedTextChunks: Record<string, string[]> = {};
  #bufferedSources: any[] = [];
  #bufferedReasoning: string[] = [];
  #bufferedFiles: any[] = [];
  #toolCallArgsDeltas: Record<string, string[]> = {};
  #toolCallDeltaIdNameMap: Record<string, string> = {};
  #toolCalls: any[] = [];
  #toolResults: any[] = [];
  #warnings: any[] = [];
  #finishReason: string | undefined;
  #providerMetadata: Record<string, any> | undefined;
  #response: any | undefined;
  #request: any | undefined;
  #usageCount: Record<string, number> = {};
  #objectPromise: DelayedPromise<any> = new DelayedPromise();
  public runId: string;
  #options: MastraModelOutputOptions;

  constructor({
    stream,
    options,
    model,
    messageList,
  }: {
    model: {
      modelId: string;
      provider: string;
      version: 'v1' | 'v2';
    };
    stream: ReadableStream<ChunkType>;
    messageList: MessageList;
    options: MastraModelOutputOptions;
  }) {
    super({ component: 'LLM', name: 'MastraModelOutput' });
    this.#options = options;

    this.runId = options.runId;

    const self = this;

    this.#baseStream = stream.pipeThrough(
      new TransformStream<ChunkType, ChunkType>({
        transform: async (chunk, controller) => {
          switch (chunk.type) {
            case 'source':
              self.#bufferedSources.push(chunk);
              self.#bufferedByStep.sources.push(chunk);
              break;
            case 'text-delta':
              self.#bufferedText.push(chunk.payload.text);
              self.#bufferedByStep.text += chunk.payload.text;
              if (chunk.payload.id) {
                const ary = self.#bufferedTextChunks[chunk.payload.id] ?? [];
                ary.push(chunk.payload.text);
                self.#bufferedTextChunks[chunk.payload.id] = ary;
              }
              break;
            case 'tool-call-input-streaming-start':
              self.#toolCallDeltaIdNameMap[chunk.payload.toolCallId] = chunk.payload.toolName;
              break;
            case 'tool-call-delta':
              if (!self.#toolCallArgsDeltas[chunk.payload.toolCallId]) {
                self.#toolCallArgsDeltas[chunk.payload.toolCallId] = [];
              }
              self.#toolCallArgsDeltas?.[chunk.payload.toolCallId]?.push(chunk.payload.argsTextDelta);
              // mutate chunk to add toolname, we need it later to look up tools by their name
              chunk.payload.toolName ||= self.#toolCallDeltaIdNameMap[chunk.payload.toolCallId];
              break;
            case 'file':
              self.#bufferedFiles.push(chunk);
              self.#bufferedByStep.files.push(chunk);
              break;
            case 'reasoning-start':
              self.#bufferedReasoningDetails[chunk.payload.id] = {
                type: 'reasoning',
                text: '',
                providerMetadata: chunk.payload.providerMetadata,
              };
              break;
            case 'reasoning-delta': {
              self.#bufferedReasoning.push(chunk.payload.text);
              self.#bufferedByStep.reasoning += chunk.payload.text;

              const bufferedReasoning = self.#bufferedReasoningDetails[chunk.payload.id];
              if (bufferedReasoning) {
                bufferedReasoning.text += chunk.payload.text;
                if (chunk.payload.providerMetadata) {
                  bufferedReasoning.providerMetadata = chunk.payload.providerMetadata;
                }
              }

              break;
            }
            case 'reasoning-end': {
              const bufferedReasoning = self.#bufferedReasoningDetails[chunk.payload.id];
              if (chunk.payload.providerMetadata && bufferedReasoning) {
                bufferedReasoning.providerMetadata = chunk.payload.providerMetadata;
              }
              break;
            }
            case 'tool-call':
              self.#toolCalls.push(chunk);
              self.#bufferedByStep.toolCalls.push(chunk);
              if (chunk.payload?.output?.from === 'AGENT' && chunk.payload?.output?.type === 'finish') {
                const finishPayload = chunk.payload?.output.payload;
                self.updateUsageCount(finishPayload.usage);
              }
              break;
            case 'tool-result':
              self.#toolResults.push(chunk);
              self.#bufferedByStep.toolResults.push(chunk);
              break;
            case 'step-finish': {
              self.updateUsageCount(chunk.payload.output.usage);
              // chunk.payload.totalUsage = self.totalUsage;
              self.#warnings = chunk.payload.stepResult.warnings;

              if (chunk.payload.metadata.request) {
                self.#request = chunk.payload.metadata.request;
              }

              const reasoningDetails = reasoningDetailsFromMessages(
                chunk.payload.messages.all.slice(self.#bufferedByStep.msgCount),
              );

              const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;

              const stepResult: StepBufferItem = {
                stepType: self.#bufferedSteps.length === 0 ? 'initial' : 'tool-result',
                text: self.#bufferedByStep.text,
                reasoning: self.#bufferedByStep.reasoning || undefined,
                sources: self.#bufferedByStep.sources,
                files: self.#bufferedByStep.files,
                toolCalls: self.#bufferedByStep.toolCalls,
                toolResults: self.#bufferedByStep.toolResults,
                warnings: self.warnings,
                reasoningDetails: reasoningDetails,
                providerMetadata: providerMetadata,
                experimental_providerMetadata: providerMetadata,
                isContinued: chunk.payload.stepResult.isContinued,
                logprobs: chunk.payload.stepResult.logprobs,
                finishReason: chunk.payload.stepResult.reason,
                response: { ...otherMetadata, messages: chunk.payload.messages.nonUser },
                request: request,
                usage: chunk.payload.output.usage,
                // TODO: need to be able to pass a step id into this fn to get the content for a specific step id
                content: messageList.get.response.aiV5.stepContent(),
              };

              await options?.onStepFinish?.(stepResult);

              self.#bufferedSteps.push(stepResult);

              self.#bufferedByStep = {
                text: '',
                reasoning: '',
                sources: [],
                files: [],
                toolCalls: [],
                toolResults: [],
                msgCount: chunk.payload.messages.all.length,
              };

              break;
            }
            case 'finish':
              if (chunk.payload.stepResult.reason) {
                self.#finishReason = chunk.payload.stepResult.reason;
              }

              if (chunk.payload.metadata) {
                const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;

                self.#providerMetadata = chunk.payload.metadata.providerMetadata;

                self.#response = {
                  ...otherMetadata,
                  messages: chunk.payload.messages?.nonUser ?? [],
                };
              }

              this.populateUsageCount(chunk.payload.output.usage);
              chunk.payload.output.usage = self.totalUsage;

              const baseFinishStep = self.#bufferedSteps[self.#bufferedSteps.length - 1];

              if (baseFinishStep) {
                const { stepType: _stepType, isContinued: _isContinued } = baseFinishStep;

                let onFinishPayload: any = {};


                if (model.version === 'v2') {
                  onFinishPayload = {
                    text: baseFinishStep.text,
                    warnings: baseFinishStep.warnings ?? [],
                    finishReason: chunk.payload.stepResult.reason,
                    // TODO: we should add handling for step IDs in message list so you can retrieve step content by step id. And on finish should the content here be from all steps?
                    content: messageList.get.response.aiV5.stepContent(),
                    request: this.request,
                    reasoning: this.aisdk.v5.reasoning,
                    reasoningText: !this.aisdk.v5.reasoningText ? undefined : this.aisdk.v5.reasoningText,
                    sources: this.aisdk.v5.sources,
                    files: this.aisdk.v5.files,
                    steps: transformSteps({ steps: this.#bufferedSteps }),
                    response: { ...this.response, messages: messageList.get.response.aiV5.model() },
                    usage: chunk.payload.output.usage,
                    totalUsage: self.totalUsage,
                    toolCalls: this.aisdk.v5.toolCalls,
                    toolResults: this.aisdk.v5.toolResults,
                    staticToolCalls: this.aisdk.v5.toolCalls.filter((toolCall: any) => toolCall.dynamic === false),
                    staticToolResults: this.aisdk.v5.toolResults.filter(
                      (toolResult: any) => toolResult.dynamic === false,
                    ),
                    dynamicToolCalls: this.aisdk.v5.toolCalls.filter((toolCall: any) => toolCall.dynamic === true),
                    dynamicToolResults: this.aisdk.v5.toolResults.filter(
                      (toolResult: any) => toolResult.dynamic === true,
                    ),
                  };
                }

                await options?.onFinish?.(onFinishPayload);
              }

              if (options?.rootSpan) {
                options.rootSpan.setAttributes({
                  ...(baseFinishStep?.usage.reasoningTokens
                    ? {
                        'stream.usage.reasoningTokens': baseFinishStep.usage.reasoningTokens,
                      }
                    : {}),

                  ...(baseFinishStep?.usage.totalTokens
                    ? {
                        'stream.usage.totalTokens': baseFinishStep.usage.totalTokens,
                      }
                    : {}),

                  ...(baseFinishStep?.usage.inputTokens
                    ? {
                        'stream.usage.inputTokens': baseFinishStep.usage.inputTokens,
                      }
                    : {}),
                  ...(baseFinishStep?.usage.outputTokens
                    ? {
                        'stream.usage.outputTokens': baseFinishStep.usage.outputTokens,
                      }
                    : {}),
                  ...(baseFinishStep?.usage.cachedInputTokens
                    ? {
                        'stream.usage.cachedInputTokens': baseFinishStep.usage.cachedInputTokens,
                      }
                    : {}),

                  ...(baseFinishStep?.providerMetadata
                    ? { 'stream.response.providerMetadata': JSON.stringify(baseFinishStep?.providerMetadata) }
                    : {}),
                  ...(baseFinishStep?.finishReason
                    ? { 'stream.response.finishReason': baseFinishStep?.finishReason }
                    : {}),
                  ...(options?.telemetry_settings?.recordOutputs !== false
                    ? { 'stream.response.text': baseFinishStep?.text }
                    : {}),
                  ...(baseFinishStep?.toolCalls && options?.telemetry_settings?.recordOutputs !== false
                    ? {
                        'stream.response.toolCalls': JSON.stringify(
                          baseFinishStep?.toolCalls?.map(chunk => {
                            return {
                              type: 'tool-call',
                              toolCallId: chunk.payload.toolCallId,
                              args: chunk.payload.args,
                              toolName: chunk.payload.toolName,
                            };
                          }),
                        ),
                      }
                    : {}),
                });

                options.rootSpan.end();
              }

              break;

            case 'error':
              console.log('RECEIVED ERROR IN FULLSTREAM', JSON.stringify(chunk, null, 2));
              self.#error = chunk.payload.error;
              break;
          }

          controller.enqueue(chunk);
        },
      }),
    );

    this.#aisdkv5 = new AISDKV5OutputStream({
      modelOutput: this,
      messageList,
      options: {
        toolCallStreaming: options?.toolCallStreaming,
        objectOptions: options?.objectOptions,
      },
    });
  }

  get text() {
    return this.#bufferedText.join('');
  }

  get reasoning() {
    return this.#bufferedReasoning.join('');
  }

  get reasoningText() {
    return this.reasoning;
  }

  get reasoningDetails() {
    return Object.values(this.#bufferedReasoningDetails || {});
  }

  get sources() {
    return this.#bufferedSources;
  }

  get files() {
    return this.#bufferedFiles;
  }

  get steps() {
    return this.#bufferedSteps;
  }

  teeStream() {
    const [stream1, stream2] = this.#baseStream.tee();
    this.#baseStream = stream2;
    return stream1;
  }

  get fullStream() {
    const self = this;

    let fullStream = this.teeStream();

    return fullStream
      .pipeThrough(
        createObjectStreamTransformer({
          objectOptions: self.#options.objectOptions!,
          onFinish: data => self.#objectPromise.resolve(data),
          onError: error => self.#objectPromise.reject(error),
        }),
      )
      .pipeThrough(
        new TransformStream<ChunkType, ChunkType>({
          transform(chunk, controller) {
            if (chunk.type === 'raw' && !self.#options.includeRawChunks) {
              return;
            }

            controller.enqueue(chunk);
          },
        }),
      );
  }

  get finishReason() {
    return this.#finishReason;
  }

  get toolCalls() {
    return this.#toolCalls;
  }

  get toolResults() {
    return this.#toolResults;
  }

  get usage() {
    return this.#usageCount;
  }

  get warnings() {
    return this.#warnings;
  }

  get providerMetadata() {
    return this.#providerMetadata;
  }

  get response() {
    return this.#response;
  }

  get request() {
    return this.#request;
  }

  get error() {
    if (typeof this.#error === 'object') {
      const error = new Error(this.#error.message);
      error.stack = this.#error.stack;
      return error;
    }

    return this.#error;
  }

  updateUsageCount(usage: Record<string, number>) {
    if (!usage) {
      return;
    }

    for (const [key, value] of Object.entries(usage)) {
      this.#usageCount[key] = (this.#usageCount[key] ?? 0) + (value ?? 0);
    }
  }

  populateUsageCount(usage: Record<string, number>) {
    if (!usage) {
      return;
    }

    for (const [key, value] of Object.entries(usage)) {
      if (!this.#usageCount[key]) {
        this.#usageCount[key] = value;
      }
    }
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
      options?.onError?.(error);
    }
  }

  async getFullOutput() {
    await this.consumeStream({
      onError: (error: any) => {
        throw error;
      },
    });

    let object: any;
    if (this.#options.objectOptions) {
      object = await this.object;
    }

    return {
      text: this.text,
      usage: this.usage,
      steps: this.steps,
      finishReason: this.finishReason,
      warnings: this.warnings,
      providerMetadata: this.providerMetadata,
      request: this.request,
      reasoning: this.reasoning,
      reasoningText: this.reasoningText,
      toolCalls: this.toolCalls,
      toolResults: this.toolResults,
      sources: this.sources,
      files: this.files,
      response: this.response,
      totalUsage: this.totalUsage,
      object,
      error: this.error,
      // experimental_output: // TODO
    };
  }

  get totalUsage() {
    let total = 0;
    for (const [key, value] of Object.entries(this.#usageCount)) {
      if (key !== 'totalTokens' && value && !key.startsWith('cached')) {
        total += value;
      }
    }
    return {
      ...this.#usageCount,
      totalTokens: total,
    };
  }

  get aisdk() {
    return {
      v5: this.#aisdkv5,
    };
  }

  get objectStream() {
    const self = this;
    if (!self.#options.objectOptions) {
      throw new Error('objectStream requires objectOptions');
    }

    return this.fullStream.pipeThrough(
      new TransformStream<ChunkType | any, ChunkType>({
        transform(chunk, controller) {
          if (chunk.type === 'object') {
            controller.enqueue(chunk.object);
          }
        },
      }),
    );
  }

  get elementStream() {
    let publishedElements = 0;
    const self = this;
    if (!self.#options.objectOptions) {
      throw new Error('elementStream requires objectOptions');
    }

    return this.fullStream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          switch (chunk.type) {
            case 'object': {
              const array = (chunk as any).object;
              // Only process arrays - stream individual elements as they become available
              if (Array.isArray(array)) {
                // Publish new elements one by one
                for (; publishedElements < array.length; publishedElements++) {
                  controller.enqueue(array[publishedElements]);
                }
              }
              break;
            }
          }
        },
      }),
    );
  }

  get textStream() {
    const self = this;
    if (self.#options.objectOptions?.output === 'array') {
      return this.fullStream.pipeThrough(createJsonTextStreamTransformer(self.#options.objectOptions));
    }

    return this.teeStream().pipeThrough(
      new TransformStream<ChunkType, string>({
        transform(chunk, controller) {
          if (chunk.type === 'text-delta') {
            controller.enqueue(chunk.payload.text);
          }
        },
      }),
    );
  }

  get object() {
    return this.#objectPromise.promise;
  }
}

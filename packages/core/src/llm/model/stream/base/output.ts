import type { ReadableStream } from 'stream/web';
import { TransformStream } from 'stream/web';
import type { Span } from '@opentelemetry/api';
import type { ReasoningUIPart, TelemetrySettings } from 'ai-v5';
import type { MastraMessageV3 } from '../../../../agent/message-list';
import { MastraBase } from '../../../../base';
import type { ChunkType } from '../../../../stream/types';
import { AISDKV4OutputStream, convertFullStreamChunkToAISDKv4 } from '../ai-sdk/v4';
import { AISDKV5OutputStream } from '../ai-sdk/v5/output';

interface StepBufferItem {
  stepType: 'initial' | 'tool-result';
  text: string;
  reasoning?: string;
  sources: any[];
  files: any[];
  toolCalls: any[];
  toolResults: any[];
  warnings?: any[];
  reasoningDetails?: any;
  providerMetadata?: any;
  experimental_providerMetadata?: any;
  isContinued?: boolean;
  logprobs?: any;
  finishReason?: string;
  response?: any;
  request?: any;
  usage?: any;
}

interface BufferedByStep {
  text: string;
  reasoning: string;
  sources: any[];
  files: any[];
  toolCalls: any[];
  toolResults: any[];
  msgCount: number;
}

function reasoningDetailsFromMessages(messages: MastraMessageV3[]): ReasoningUIPart[] {
  return messages
    .flatMap(msg => {
      // v3 messages have content.parts array
      if (msg.content?.parts && Array.isArray(msg.content.parts)) {
        return msg.content.parts;
      }
      return [];
    })
    .filter(part => part.type === `reasoning`);
}

export class MastraModelOutput extends MastraBase {
  #aisdkv4: AISDKV4OutputStream;
  #aisdkv5: AISDKV5OutputStream;
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
  #toolCalls: any[] = [];
  #toolResults: any[] = [];
  #warnings: any[] = [];
  #finishReason: string | undefined;
  #providerMetadata: Record<string, any> | undefined;
  #response: any | undefined;
  #request: any | undefined;
  #usageCount: Record<string, number> = {};

  constructor({
    stream,
    options,
    model,
  }: {
    model: {
      modelId: string;
      provider: string;
      version: 'v1' | 'v2';
    };
    stream: ReadableStream<ChunkType>;
    options: {
      rootSpan?: Span;
      experimental_telemetry?: TelemetrySettings;
      toolCallStreaming?: boolean;
      onFinish?: (event: any) => Promise<void> | void;
      onStepFinish?: (event: any) => Promise<void> | void;
    };
  }) {
    super({ component: 'LLM', name: 'MastraModelOutput' });
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
            case 'tool-call-delta':
              if (!self.#toolCallArgsDeltas[chunk.payload.toolCallId]) {
                self.#toolCallArgsDeltas[chunk.payload.toolCallId] = [];
              }
              self.#toolCallArgsDeltas?.[chunk.payload.toolCallId]?.push(chunk.payload.argsTextDelta);
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

              console.dir({ stepFinishChunk: chunk }, { depth: null });
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
              };

              let stepResultPayload;
              if (model.version === 'v1') {
                stepResultPayload = {
                  ...stepResult,
                  files: stepResult.files.map((file: any) => {
                    return convertFullStreamChunkToAISDKv4({
                      chunk: file,
                      client: false,
                      sendReasoning: false,
                      sendSources: false,
                      sendUsage: false,
                      getErrorMessage: (error: string) => error,
                    });
                  }),
                  toolCalls: stepResult.toolCalls.map((toolCall: any) => {
                    return convertFullStreamChunkToAISDKv4({
                      chunk: toolCall,
                      client: false,
                      sendReasoning: false,
                      sendSources: false,
                      sendUsage: false,
                      getErrorMessage: (error: string) => error,
                    });
                  }),
                  toolResults: stepResult.toolResults.map((toolResult: any) => {
                    return convertFullStreamChunkToAISDKv4({
                      chunk: toolResult,
                      client: false,
                      sendReasoning: false,
                      sendSources: false,
                      sendUsage: false,
                      getErrorMessage: (error: string) => error,
                    });
                  }),
                  sources: stepResult.sources.map((source: any) => {
                    return convertFullStreamChunkToAISDKv4({
                      chunk: source,
                      client: false,
                      sendReasoning: false,
                      sendSources: true,
                      sendUsage: false,
                      getErrorMessage: (error: string) => error,
                    }).source;
                  }),
                  request: request || {},
                  response: {
                    ...otherMetadata,
                    messages: stepResult.response.messages.map((message: any) => {
                      return {
                        ...message,
                        content: message.content.filter((part: any) => part.type !== 'source'),
                      };
                    }),
                  },
                };
              }

              await options?.onStepFinish?.(stepResultPayload);

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
                  messages: chunk.payload.messages.all.slice(1),
                };
              }

              this.populateUsageCount(chunk.payload.output.usage);
              chunk.payload.output.usage = self.totalUsage;

              const baseFinishStep = self.#bufferedSteps[self.#bufferedSteps.length - 1];

              if (baseFinishStep) {
                const { stepType: _stepType, isContinued: _isContinued } = baseFinishStep;

                const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;

                let onFinishPayload: any = {};

                if (model.version === 'v1') {
                  onFinishPayload = {
                    text: baseFinishStep.text,
                    warnings: baseFinishStep.warnings,
                    finishReason: chunk.payload.stepResult.reason,
                    experimental_providerMetadata: chunk.payload.metadata.providerMetadata,
                    providerMetadata: chunk.payload.metadata.providerMetadata,
                    files: baseFinishStep.files.map((file: any) => {
                      return convertFullStreamChunkToAISDKv4({
                        chunk: file,
                        client: false,
                        sendReasoning: false,
                        sendSources: false,
                        sendUsage: false,
                        getErrorMessage: (error: string) => error,
                      });
                    }),
                    toolCalls: baseFinishStep.toolCalls.map((toolCall: any) => {
                      return convertFullStreamChunkToAISDKv4({
                        chunk: toolCall,
                        client: false,
                        sendReasoning: false,
                        sendSources: false,
                        sendUsage: false,
                        getErrorMessage: (error: string) => error,
                      });
                    }),
                    toolResults: baseFinishStep.toolResults.map((toolResult: any) => {
                      return convertFullStreamChunkToAISDKv4({
                        chunk: toolResult,
                        client: false,
                        sendReasoning: false,
                        sendSources: false,
                        sendUsage: false,
                        getErrorMessage: (error: string) => error,
                      });
                    }),
                    logprobs: baseFinishStep.logprobs,
                    reasoning: baseFinishStep.reasoning,
                    reasoningDetails: baseFinishStep.reasoningDetails,
                    sources: baseFinishStep.sources.map((source: any) => {
                      return convertFullStreamChunkToAISDKv4({
                        chunk: source,
                        client: false,
                        sendReasoning: false,
                        sendSources: true,
                        sendUsage: false,
                        getErrorMessage: (error: string) => error,
                      }).source;
                    }),
                    request: request || {},
                    response: {
                      ...otherMetadata,
                      messages: chunk.payload.messages.all.slice(1).map((message: any) => {
                        return {
                          ...message,
                          content: message.content.filter((part: any) => part.type !== 'source'),
                        };
                      }),
                    },
                    steps: self.aisdk.v4.steps,
                    usage: self.usage,
                  };
                } else if (model.version === 'v2') {
                  onFinishPayload = {
                    text: baseFinishStep.text,
                    warnings: baseFinishStep.warnings,
                    finishReason: chunk.payload.stepResult.reason,
                    content: this.aisdk.v5.content,
                    reasoning: this.aisdk.v5.reasoning,
                    sources: this.aisdk.v5.sources,
                    files: this.aisdk.v5.files,
                    steps: this.aisdk.v5.steps,
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
                  ...(options?.experimental_telemetry?.recordOutputs !== false
                    ? { 'stream.response.text': baseFinishStep?.text }
                    : {}),
                  ...(baseFinishStep?.toolCalls && options?.experimental_telemetry?.recordOutputs !== false
                    ? {
                        'stream.response.toolCalls': JSON.stringify(
                          baseFinishStep?.toolCalls?.map(chunk => {
                            return {
                              type: chunk.type,
                              ...chunk.payload,
                            };
                          }),
                        ),
                      }
                    : {}),
                });

                options.rootSpan.end();
              }

              break;
          }

          controller.enqueue(chunk);
        },
      }),
    );

    this.#aisdkv4 = new AISDKV4OutputStream({
      modelOutput: this as MastraModelOutput,
      options: {
        toolCallStreaming: options?.toolCallStreaming,
      },
    });

    this.#aisdkv5 = new AISDKV5OutputStream({
      modelOutput: this,
      options: {
        toolCallStreaming: options?.toolCallStreaming,
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
    return this.teeStream().pipeThrough(
      new TransformStream<ChunkType, ChunkType>({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
      }),
    );
  }

  get textStream() {
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
      v4: this.#aisdkv4,
      v5: this.#aisdkv5,
    };
  }
}

import type { ReadableStream } from 'stream/web';
import { TransformStream } from 'stream/web';
import type { Span } from '@opentelemetry/api';
import { consumeStream } from 'ai-v5';
import type { TelemetrySettings } from 'ai-v5';
import { TripWire } from '../../agent';
import { MessageList } from '../../agent/message-list';
import { MastraBase } from '../../base';
import type { ObjectOptions } from '../../loop/types';
import type { OutputProcessor } from '../../processors';
import type { ProcessorState } from '../../processors/runner';
import { ProcessorRunner } from '../../processors/runner';
import { DelayedPromise } from '../aisdk/v5/compat';
import type { ConsumeStreamOptions } from '../aisdk/v5/compat';
import { getTransformedSchema } from '../aisdk/v5/object/schema';
import { createJsonTextStreamTransformer, createObjectStreamTransformer } from '../aisdk/v5/object/stream-object';
import { AISDKV5OutputStream } from '../aisdk/v5/output';
import { reasoningDetailsFromMessages, transformSteps } from '../aisdk/v5/output-helpers';
import type { BufferedByStep, ChunkType, StepBufferItem } from '../types';

export class JsonToSseTransformStream extends TransformStream<unknown, string> {
  constructor() {
    super({
      transform(part, controller) {
        controller.enqueue(`data: ${JSON.stringify(part)}\n\n`);
      },
      flush(controller) {
        controller.enqueue('data: [DONE]\n\n');
      },
    });
  }
}

type MastraModelOutputOptions = {
  runId: string;
  rootSpan?: Span;
  telemetry_settings?: TelemetrySettings;
  toolCallStreaming?: boolean;
  onFinish?: (event: any) => Promise<void> | void;
  onStepFinish?: (event: any) => Promise<void> | void;
  includeRawChunks?: boolean;
  objectOptions?: ObjectOptions;
  outputProcessors?: OutputProcessor[];
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
  #request: any | undefined;
  #usageCount: Record<string, number> = {};
  #tripwire = false;
  #tripwireReason = '';

  #delayedPromises = {
    object: new DelayedPromise<any>(),
    finishReason: new DelayedPromise<string | undefined>(),
    usage: new DelayedPromise<Record<string, number>>(),
    warnings: new DelayedPromise<any[]>(),
    providerMetadata: new DelayedPromise<Record<string, any> | undefined>(),
    response: new DelayedPromise<any>(),
    request: new DelayedPromise<any>(),
    text: new DelayedPromise<string>(),
    reasoning: new DelayedPromise<string>(),
    reasoningText: new DelayedPromise<string | undefined>(),
    sources: new DelayedPromise<any[]>(),
    files: new DelayedPromise<any[]>(),
    toolCalls: new DelayedPromise<any[]>(),
    toolResults: new DelayedPromise<any[]>(),
    steps: new DelayedPromise<StepBufferItem[]>(),
    totalUsage: new DelayedPromise<Record<string, number>>(),
    content: new DelayedPromise<any>(),
    reasoningDetails: new DelayedPromise<any[]>(),
  };

  #streamConsumed = false;

  public runId: string;
  #options: MastraModelOutputOptions;
  public processorRunner?: ProcessorRunner;
  public messageList: MessageList;

  constructor({
    stream,
    options,
    model: _model,
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

    // Create processor runner if outputProcessors are provided
    if (options.outputProcessors?.length) {
      this.processorRunner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors: options.outputProcessors,
        logger: this.logger,
        agentName: 'MastraModelOutput',
      });
    }

    this.messageList = messageList;

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
                warnings: self.#warnings,
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

              let response = {};
              if (chunk.payload.metadata) {
                const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;

                response = {
                  ...otherMetadata,
                  messages: messageList.get.response.aiV5.model(),
                };
              }

              this.populateUsageCount(chunk.payload.output.usage);

              chunk.payload.output.usage = self.#usageCount;

              try {
                if (self.processorRunner) {
                  await self.processorRunner.runOutputProcessors(self.messageList);
                  const outputText = self.messageList.get.response.aiV4
                    .core()
                    .map(m => MessageList.coreContentToString(m.content))
                    .join('\n');

                  const messages = self.messageList.get.response.v2();
                  const messagesWithStructuredData = messages.filter(
                    msg => msg.content.metadata && (msg.content.metadata as any).structuredOutput,
                  );

                  if (
                    messagesWithStructuredData[0] &&
                    messagesWithStructuredData[0].content.metadata?.structuredOutput
                  ) {
                    const structuredOutput = messagesWithStructuredData[0].content.metadata.structuredOutput;
                    self.#delayedPromises.object.resolve(structuredOutput);
                  } else if (!self.#options.objectOptions?.schema) {
                    self.#delayedPromises.object.resolve(undefined);
                  }

                  self.#delayedPromises.text.resolve(outputText);
                  self.#delayedPromises.finishReason.resolve(self.#finishReason);
                } else {
                  self.#delayedPromises.text.resolve(self.#bufferedText.join(''));
                  self.#delayedPromises.finishReason.resolve(self.#finishReason);
                  if (!self.#options.objectOptions?.schema) {
                    self.#delayedPromises.object.resolve(undefined);
                  }
                }
              } catch (error) {
                if (error instanceof TripWire) {
                  self.#tripwire = true;
                  self.#tripwireReason = error.message;
                  self.#delayedPromises.finishReason.resolve('other');
                } else {
                  self.#error = error instanceof Error ? error.message : String(error);
                  self.#delayedPromises.finishReason.resolve('error');
                }
                self.#delayedPromises.object.resolve(undefined);
              }

              // Resolve all delayed promises with final values
              self.#delayedPromises.usage.resolve(self.#usageCount);
              self.#delayedPromises.warnings.resolve(self.#warnings);
              self.#delayedPromises.providerMetadata.resolve(chunk.payload.metadata?.providerMetadata);
              self.#delayedPromises.response.resolve(response);
              self.#delayedPromises.request.resolve(self.#request);
              self.#delayedPromises.text.resolve(self.#bufferedText.join(''));
              self.#delayedPromises.reasoning.resolve(self.#bufferedReasoning.join(''));
              const reasoningText = self.#bufferedReasoning.length > 0 ? self.#bufferedReasoning.join('') : undefined;
              self.#delayedPromises.reasoningText.resolve(reasoningText);
              self.#delayedPromises.sources.resolve(self.#bufferedSources);
              self.#delayedPromises.files.resolve(self.#bufferedFiles);
              self.#delayedPromises.toolCalls.resolve(self.#toolCalls);
              self.#delayedPromises.toolResults.resolve(self.#toolResults);
              self.#delayedPromises.steps.resolve(self.#bufferedSteps);
              self.#delayedPromises.totalUsage.resolve(self.#getTotalUsage());
              self.#delayedPromises.content.resolve(messageList.get.response.aiV5.stepContent());
              self.#delayedPromises.reasoningDetails.resolve(Object.values(self.#bufferedReasoningDetails || {}));

              const baseFinishStep = self.#bufferedSteps[self.#bufferedSteps.length - 1];

              if (baseFinishStep) {
                const { stepType: _stepType, isContinued: _isContinued } = baseFinishStep;

                const onFinishPayload = {
                  text: baseFinishStep.text,
                  warnings: baseFinishStep.warnings ?? [],
                  finishReason: chunk.payload.stepResult.reason,
                  // TODO: we should add handling for step IDs in message list so you can retrieve step content by step id. And on finish should the content here be from all steps?
                  content: messageList.get.response.aiV5.stepContent(),
                  request: await self.request,
                  error: self.error,
                  reasoning: await self.aisdk.v5.reasoning,
                  reasoningText: await self.aisdk.v5.reasoningText,
                  sources: await self.aisdk.v5.sources,
                  files: await self.aisdk.v5.files,
                  steps: transformSteps({ steps: self.#bufferedSteps }),
                  response: { ...(await self.response), messages: messageList.get.response.aiV5.model() },
                  usage: chunk.payload.output.usage,
                  totalUsage: self.#getTotalUsage(),
                  toolCalls: await self.aisdk.v5.toolCalls,
                  toolResults: await self.aisdk.v5.toolResults,
                  staticToolCalls: (await self.aisdk.v5.toolCalls).filter(
                    (toolCall: any) => toolCall.dynamic === false,
                  ),
                  staticToolResults: (await self.aisdk.v5.toolResults).filter(
                    (toolResult: any) => toolResult.dynamic === false,
                  ),
                  dynamicToolCalls: (await self.aisdk.v5.toolCalls).filter(
                    (toolCall: any) => toolCall.dynamic === true,
                  ),
                  dynamicToolResults: (await self.aisdk.v5.toolResults).filter(
                    (toolResult: any) => toolResult.dynamic === true,
                  ),
                };

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
              self.#error = chunk.payload.error;

              // Reject all delayed promises on error
              const error =
                typeof self.#error === 'object' ? new Error(self.#error.message) : new Error(String(self.#error));

              Object.values(self.#delayedPromises).forEach(promise => promise.reject(error));

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

  private getDelayedPromise<T>(promise: DelayedPromise<T>): Promise<T> {
    if (!this.#streamConsumed) {
      void this.consumeStream();
    }
    return promise.promise;
  }

  get text() {
    return this.getDelayedPromise(this.#delayedPromises.text);
  }

  get reasoning() {
    return this.getDelayedPromise(this.#delayedPromises.reasoning);
  }

  get reasoningText() {
    return this.getDelayedPromise(this.#delayedPromises.reasoningText);
  }

  get reasoningDetails() {
    return this.getDelayedPromise(this.#delayedPromises.reasoningDetails);
  }

  get sources() {
    return this.getDelayedPromise(this.#delayedPromises.sources);
  }

  get files() {
    return this.getDelayedPromise(this.#delayedPromises.files);
  }

  get steps() {
    return this.getDelayedPromise(this.#delayedPromises.steps);
  }

  teeStream() {
    const [stream1, stream2] = this.#baseStream.tee();
    this.#baseStream = stream2;
    return stream1;
  }

  get fullStream() {
    const self = this;

    let fullStream = this.teeStream();

    const processorStates = new Map<string, ProcessorState>();

    return fullStream
      .pipeThrough(
        new TransformStream({
          async transform(chunk, controller) {
            // Process all stream parts through output processors
            if (self.processorRunner) {
              const {
                part: processedPart,
                blocked,
                reason,
              } = await self.processorRunner.processPart(chunk as any, processorStates);

              if (blocked) {
                // Send tripwire part and close stream for abort
                controller.enqueue({
                  type: 'tripwire',
                  payload: {
                    tripwireReason: reason || 'Output processor blocked content',
                  },
                });
                controller.terminate();
                return;
              }

              if (processedPart) {
                controller.enqueue(processedPart);
              }
            } else {
              controller.enqueue(chunk);
            }
          },
        }),
      )
      .pipeThrough(
        createObjectStreamTransformer({
          schema: self.#options.objectOptions?.schema,
          onFinish: data => self.#delayedPromises.object.resolve(data),
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
          flush: () => {
            // If stream ends without proper finish/error chunks, reject unresolved promises
            // This must be in the final transformer in the fullStream pipeline
            // to ensure all of the delayed promises had a chance to resolve or reject already
            // Avoids promises hanging forever
            Object.entries(self.#delayedPromises).forEach(([key, promise]) => {
              if (promise.status.type === 'pending') {
                promise.reject(new Error(`Stream ${key} terminated unexpectedly`));
              }
            });
          },
        }),
      );
  }

  get finishReason() {
    return this.getDelayedPromise(this.#delayedPromises.finishReason);
  }

  get toolCalls() {
    return this.getDelayedPromise(this.#delayedPromises.toolCalls);
  }

  get toolResults() {
    return this.getDelayedPromise(this.#delayedPromises.toolResults);
  }

  get usage() {
    return this.getDelayedPromise(this.#delayedPromises.usage);
  }

  get warnings() {
    return this.getDelayedPromise(this.#delayedPromises.warnings);
  }

  get providerMetadata() {
    return this.getDelayedPromise(this.#delayedPromises.providerMetadata);
  }

  get response() {
    return this.getDelayedPromise(this.#delayedPromises.response);
  }

  get request() {
    return this.getDelayedPromise(this.#delayedPromises.request);
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

  // toUIMessageStreamResponse() {
  //   const stream = this.teeStream()
  //     .pipeThrough(new JsonToSseTransformStream())
  //     .pipeThrough(new TextEncoderStream())

  //   return new Response(stream as BodyInit);
  // }

  async consumeStream(options?: ConsumeStreamOptions): Promise<void> {
    this.#streamConsumed = true;
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
        console.error(error);
        throw error;
      },
    });

    const object = await this.object;

    const fullOutput = {
      text: await this.text,
      usage: await this.usage,
      steps: await this.steps,
      finishReason: await this.finishReason,
      warnings: await this.warnings,
      providerMetadata: await this.providerMetadata,
      request: await this.request,
      reasoning: await this.reasoning,
      reasoningText: await this.reasoningText,
      toolCalls: await this.toolCalls,
      toolResults: await this.toolResults,
      sources: await this.sources,
      files: await this.files,
      response: await this.response,
      totalUsage: await this.totalUsage,
      object,
      error: this.error,
      tripwire: this.#tripwire,
      tripwireReason: this.#tripwireReason,
    };

    fullOutput.response.messages = this.messageList.get.response.aiV5.model();

    return fullOutput;
  }

  get tripwire() {
    return this.#tripwire;
  }

  get tripwireReason() {
    return this.#tripwireReason;
  }

  get totalUsage() {
    return this.getDelayedPromise(this.#delayedPromises.totalUsage);
  }

  get content() {
    return this.getDelayedPromise(this.#delayedPromises.content);
  }

  get aisdk() {
    return {
      v5: this.#aisdkv5,
    };
  }

  get objectStream() {
    const self = this;
    if (!self.#options.objectOptions?.schema) {
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
    const outputSchema = getTransformedSchema(self.#options.objectOptions?.schema);
    if (outputSchema?.outputFormat === 'array') {
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
    if (!this.processorRunner && !this.#options.objectOptions?.schema) {
      this.#delayedPromises.object.resolve(undefined);
    }

    return this.getDelayedPromise(this.#delayedPromises.object);
  }

  // Internal methods for immediate values - used internally by Mastra (llm-execution.ts bailing on errors/abort signals with current state)
  // These are not part of the public API
  _getImmediateToolCalls() {
    return this.#toolCalls;
  }

  _getImmediateToolResults() {
    return this.#toolResults;
  }

  _getImmediateText() {
    return this.#bufferedText.join('');
  }

  _getImmediateUsage() {
    return this.#usageCount;
  }

  _getImmediateWarnings() {
    return this.#warnings;
  }

  _getImmediateFinishReason() {
    return this.#finishReason;
  }

  #getTotalUsage() {
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
}

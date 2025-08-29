import type { ReadableStream } from 'stream/web';
import { TransformStream } from 'stream/web';
import type { SharedV2ProviderMetadata, LanguageModelV2CallWarning } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import { consumeStream } from 'ai-v5';
import type { FinishReason, TelemetrySettings } from 'ai-v5';
import { TripWire } from '../../agent';
import { MessageList } from '../../agent/message-list';
import type { AIV5Type } from '../../agent/message-list/types';
import { MastraBase } from '../../base';
import type { OutputProcessor } from '../../processors';
import type { ProcessorState } from '../../processors/runner';
import { ProcessorRunner } from '../../processors/runner';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../scores';
import { DelayedPromise } from '../aisdk/v5/compat';
import type { ConsumeStreamOptions } from '../aisdk/v5/compat';
import { AISDKV5OutputStream } from '../aisdk/v5/output';
import { reasoningDetailsFromMessages, transformSteps } from '../aisdk/v5/output-helpers';
import type { BufferedByStep, ChunkType, StepBufferItem } from '../types';
import { createJsonTextStreamTransformer, createObjectStreamTransformer } from './output-format-handlers';
import { getTransformedSchema } from './schema';
import type { InferSchemaOutput, OutputSchema, PartialSchemaOutput } from './schema';

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

type MastraModelOutputOptions<OUTPUT extends OutputSchema = undefined> = {
  runId: string;
  rootSpan?: Span;
  telemetry_settings?: TelemetrySettings;
  toolCallStreaming?: boolean;
  onFinish?: (event: Record<string, any>) => Promise<void> | void;
  onStepFinish?: (event: Record<string, any>) => Promise<void> | void;
  includeRawChunks?: boolean;
  output?: OUTPUT;
  outputProcessors?: OutputProcessor[];
  returnScorerData?: boolean;
};
export class MastraModelOutput<OUTPUT extends OutputSchema = undefined> extends MastraBase {
  #aisdkv5: AISDKV5OutputStream<OUTPUT>;
  #error: Error | string | { message: string; stack: string } | undefined;
  #baseStream: ReadableStream<ChunkType<OUTPUT>>;
  #bufferedSteps: StepBufferItem[] = [];
  #bufferedReasoningDetails: Record<
    string,
    {
      type: string;
      text: string;
      providerMetadata: SharedV2ProviderMetadata;
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
  #toolCalls: any[] = []; // TODO: add type
  #toolResults: any[] = []; // TODO: add type
  #warnings: LanguageModelV2CallWarning[] = [];
  #finishReason: FinishReason | string | undefined;
  #request: Record<string, any> | undefined;
  #usageCount: Record<string, number> = {};
  #tripwire = false;
  #tripwireReason = '';

  #delayedPromises = {
    object: new DelayedPromise<InferSchemaOutput<OUTPUT>>(),
    finishReason: new DelayedPromise<FinishReason | string | undefined>(),
    usage: new DelayedPromise<Record<string, number>>(),
    warnings: new DelayedPromise<LanguageModelV2CallWarning[]>(),
    providerMetadata: new DelayedPromise<Record<string, any> | undefined>(),
    response: new DelayedPromise<Record<string, any>>(), // TODO: add type
    request: new DelayedPromise<Record<string, any>>(), // TODO: add type
    text: new DelayedPromise<string>(),
    reasoning: new DelayedPromise<string>(),
    reasoningText: new DelayedPromise<string | undefined>(),
    sources: new DelayedPromise<any[]>(), // TODO: add type
    files: new DelayedPromise<any[]>(), // TODO: add type
    toolCalls: new DelayedPromise<any[]>(), // TODO: add type
    toolResults: new DelayedPromise<any[]>(), // TODO: add type
    steps: new DelayedPromise<StepBufferItem[]>(),
    totalUsage: new DelayedPromise<Record<string, number>>(),
    content: new DelayedPromise<AIV5Type.StepResult<any>['content']>(),
    reasoningDetails: new DelayedPromise<
      {
        type: string;
        text: string;
        providerMetadata: SharedV2ProviderMetadata;
      }[]
    >(),
  };

  #streamConsumed = false;
  #returnScorerData = false;

  /**
   * Unique identifier for this execution run.
   */
  public runId: string;
  #options: MastraModelOutputOptions<OUTPUT>;
  /**
   * The processor runner for this stream.
   */
  public processorRunner?: ProcessorRunner;
  /**
   * The message list for this stream.
   */
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
    stream: ReadableStream<ChunkType<OUTPUT>>;
    messageList: MessageList;
    options: MastraModelOutputOptions<OUTPUT>;
  }) {
    super({ component: 'LLM', name: 'MastraModelOutput' });
    this.#options = options;
    this.#returnScorerData = !!options.returnScorerData;
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
      new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
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
                providerMetadata: chunk.payload.providerMetadata || {},
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
              self.updateUsageCount(chunk.payload.output.usage as Record<string, number>);
              // chunk.payload.totalUsage = self.totalUsage;
              self.#warnings = chunk.payload.stepResult.warnings || [];

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
                response: { ...otherMetadata, messages: chunk.payload.messages.nonUser } as any,
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

              this.populateUsageCount(chunk.payload.output.usage as Record<string, number>);

              chunk.payload.output.usage = self.#usageCount as any;

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
                    self.#delayedPromises.object.resolve(structuredOutput as InferSchemaOutput<OUTPUT>);
                  } else if (!self.#options.output) {
                    self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
                  }

                  self.#delayedPromises.text.resolve(outputText);
                  self.#delayedPromises.finishReason.resolve(self.#finishReason);
                } else {
                  self.#delayedPromises.text.resolve(self.#bufferedText.join(''));
                  self.#delayedPromises.finishReason.resolve(self.#finishReason);
                  if (!self.#options.output) {
                    self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
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
                self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
              }

              // Resolve all delayed promises with final values
              self.#delayedPromises.usage.resolve(self.#usageCount);
              self.#delayedPromises.warnings.resolve(self.#warnings);
              self.#delayedPromises.providerMetadata.resolve(chunk.payload.metadata?.providerMetadata);
              self.#delayedPromises.response.resolve(response);
              self.#delayedPromises.request.resolve(self.#request || {});
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
                  ...(baseFinishStep?.usage?.reasoningTokens
                    ? {
                        'stream.usage.reasoningTokens': baseFinishStep.usage.reasoningTokens,
                      }
                    : {}),

                  ...(baseFinishStep?.usage?.totalTokens
                    ? {
                        'stream.usage.totalTokens': baseFinishStep.usage.totalTokens,
                      }
                    : {}),

                  ...(baseFinishStep?.usage?.inputTokens
                    ? {
                        'stream.usage.inputTokens': baseFinishStep.usage.inputTokens,
                      }
                    : {}),
                  ...(baseFinishStep?.usage?.outputTokens
                    ? {
                        'stream.usage.outputTokens': baseFinishStep.usage.outputTokens,
                      }
                    : {}),
                  ...(baseFinishStep?.usage?.cachedInputTokens
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
              self.#error = chunk.payload.error as any;

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
        output: options?.output,
      },
    });
  }

  #getDelayedPromise<T>(promise: DelayedPromise<T>): Promise<T> {
    if (!this.#streamConsumed) {
      void this.consumeStream();
    }
    return promise.promise;
  }

  /**
   * Resolves to the complete text response after streaming completes.
   */
  get text() {
    return this.#getDelayedPromise(this.#delayedPromises.text);
  }

  /**
   * Resolves to complete reasoning text for models that support reasoning.
   */
  get reasoning() {
    return this.#getDelayedPromise(this.#delayedPromises.reasoning);
  }

  get reasoningText() {
    return this.#getDelayedPromise(this.#delayedPromises.reasoningText);
  }

  get reasoningDetails() {
    return this.#getDelayedPromise(this.#delayedPromises.reasoningDetails);
  }

  get sources() {
    return this.#getDelayedPromise(this.#delayedPromises.sources);
  }

  get files() {
    return this.#getDelayedPromise(this.#delayedPromises.files);
  }

  get steps() {
    return this.#getDelayedPromise(this.#delayedPromises.steps);
  }

  teeStream() {
    const [stream1, stream2] = this.#baseStream.tee();
    this.#baseStream = stream2;
    return stream1;
  }

  /**
   * Stream of all chunks. Provides complete control over stream processing.
   */
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
          schema: self.#options.output,
          onFinish: data => self.#delayedPromises.object.resolve(data),
        }),
      )
      .pipeThrough(
        new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
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

  /**
   * Resolves to the reason generation finished.
   */
  get finishReason() {
    return this.#getDelayedPromise(this.#delayedPromises.finishReason);
  }

  /**
   * Resolves to array of all tool calls made during execution.
   */
  get toolCalls() {
    return this.#getDelayedPromise(this.#delayedPromises.toolCalls);
  }

  /**
   * Resolves to array of all tool execution results.
   */
  get toolResults() {
    return this.#getDelayedPromise(this.#delayedPromises.toolResults);
  }

  /**
   * Resolves to token usage statistics including inputTokens, outputTokens, and totalTokens.
   */
  get usage() {
    return this.#getDelayedPromise(this.#delayedPromises.usage);
  }

  /**
   * Resolves to array of all warnings generated during execution.
   */
  get warnings() {
    return this.#getDelayedPromise(this.#delayedPromises.warnings);
  }

  /**
   * Resolves to provider metadata generated during execution.
   */
  get providerMetadata() {
    return this.#getDelayedPromise(this.#delayedPromises.providerMetadata);
  }

  /**
   * Resolves to the complete response from the model.
   */
  get response() {
    return this.#getDelayedPromise(this.#delayedPromises.response);
  }

  /**
   * Resolves to the complete request sent to the model.
   */
  get request() {
    return this.#getDelayedPromise(this.#delayedPromises.request);
  }

  /**
   * Resolves to an error if an error occurred during streaming.
   */
  get error(): Error | string | { message: string; stack: string } | undefined {
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

  /**
   * Returns complete output including text, usage, tool calls, and all metadata.
   */
  async getFullOutput() {
    await this.consumeStream({
      onError: (error: any) => {
        console.error(error);
        throw error;
      },
    });

    let scoringData:
      | {
          input: Omit<ScorerRunInputForAgent, 'runId'>;
          output: ScorerRunOutputForAgent;
        }
      | undefined;

    if (this.#returnScorerData) {
      scoringData = {
        input: {
          inputMessages: this.messageList.getPersisted.input.ui(),
          rememberedMessages: this.messageList.getPersisted.remembered.ui(),
          systemMessages: this.messageList.getSystemMessages(),
          taggedSystemMessages: this.messageList.getPersisted.taggedSystemMessages,
        },
        output: this.messageList.getPersisted.response.ui(),
      };
    }

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
      object: await this.object,
      error: this.error,
      tripwire: this.#tripwire,
      tripwireReason: this.#tripwireReason,
      ...(scoringData ? { scoringData } : {}),
    };

    fullOutput.response.messages = this.messageList.get.response.aiV5.model();

    return fullOutput;
  }

  /**
   * The tripwire flag is set when the stream is aborted due to an output processor blocking the content.
   */
  get tripwire() {
    return this.#tripwire;
  }

  /**
   * The reason for the tripwire.
   */
  get tripwireReason() {
    return this.#tripwireReason;
  }

  /**
   * The total usage of the stream.
   */
  get totalUsage() {
    return this.#getDelayedPromise(this.#delayedPromises.totalUsage);
  }

  get content() {
    return this.#getDelayedPromise(this.#delayedPromises.content);
  }

  /**
   * Other output stream formats.
   */
  get aisdk() {
    return {
      /**
       * The AI SDK v5 output stream format.
       */
      v5: this.#aisdkv5,
    };
  }

  /**
   * Stream of valid JSON chunks. The final JSON result is validated against the output schema when the stream ends.
   *
   * @example
   * ```typescript
   * const stream = await agent.streamVNext("Extract data", {
   *   output: z.object({ name: z.string(), age: z.number() })
   * });
   * // partial json chunks
   * for await (const data of stream.objectStream) {
   *   console.log(data); // { name: 'John' }, { name: 'John', age: 30 }
   * }
   * ```
   */
  get objectStream() {
    return this.fullStream.pipeThrough(
      new TransformStream<ChunkType<OUTPUT>, PartialSchemaOutput<OUTPUT>>({
        transform(chunk, controller) {
          if (chunk.type === 'object') {
            controller.enqueue(chunk.object);
          }
        },
      }),
    );
  }

  /**
   * Stream of individual array elements when output schema is an array type.
   */
  get elementStream(): ReadableStream<InferSchemaOutput<OUTPUT> extends Array<infer T> ? T : never> {
    let publishedElements = 0;

    return this.fullStream.pipeThrough(
      new TransformStream<ChunkType<OUTPUT>, InferSchemaOutput<OUTPUT> extends Array<infer T> ? T : never>({
        transform(chunk, controller) {
          if (chunk.type === 'object') {
            if (Array.isArray(chunk.object)) {
              // Publish new elements of the array one by one
              for (; publishedElements < chunk.object.length; publishedElements++) {
                controller.enqueue(chunk.object[publishedElements]);
              }
            }
          }
        },
      }),
    );
  }

  /**
   * Stream of only text content, filtering out metadata and other chunk types.
   */
  get textStream() {
    const self = this;
    const outputSchema = getTransformedSchema(self.#options.output);
    if (outputSchema?.outputFormat === 'array') {
      return this.fullStream.pipeThrough(createJsonTextStreamTransformer(self.#options.output));
    }

    return this.teeStream().pipeThrough(
      new TransformStream<ChunkType<OUTPUT>, string>({
        transform(chunk, controller) {
          if (chunk.type === 'text-delta') {
            controller.enqueue(chunk.payload.text);
          }
        },
      }),
    );
  }

  /**
   * Resolves to the complete object response from the model. Validated against the 'output' schema when the stream ends.
   *
   * @example
   * ```typescript
   * const stream = await agent.streamVNext("Extract data", {
   *   output: z.object({ name: z.string(), age: z.number() })
   * });
   * // final validated json
   * const data = await stream.object // { name: 'John', age: 30 }
   * ```
   */
  get object() {
    if (!this.processorRunner && !this.#options.output) {
      this.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
    }

    return this.#getDelayedPromise(this.#delayedPromises.object);
  }

  // Internal methods for immediate values - used internally by Mastra (llm-execution.ts bailing on errors/abort signals with current state)
  // These are not part of the public API
  /** @internal */
  _getImmediateToolCalls() {
    return this.#toolCalls;
  }
  /** @internal */
  _getImmediateToolResults() {
    return this.#toolResults;
  }
  /** @internal */
  _getImmediateText() {
    return this.#bufferedText.join('');
  }
  /** @internal */
  _getImmediateUsage() {
    return this.#usageCount;
  }
  /** @internal */
  _getImmediateWarnings() {
    return this.#warnings;
  }
  /** @internal */
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

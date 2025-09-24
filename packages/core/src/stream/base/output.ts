import { EventEmitter } from 'events';
import { ReadableStream, TransformStream } from 'stream/web';
import type { SharedV2ProviderMetadata, LanguageModelV2CallWarning } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import { consumeStream } from 'ai-v5';
import type { FinishReason, TelemetrySettings } from 'ai-v5';
import { TripWire } from '../../agent';
import { MessageList } from '../../agent/message-list';
import type { AIV5Type } from '../../agent/message-list/types';
import { getValidTraceId } from '../../ai-tracing';
import type { TracingContext } from '../../ai-tracing';
import { MastraBase } from '../../base';
import type { OutputProcessor } from '../../processors';
import type { ProcessorRunnerMode } from '../../processors/runner';
import { ProcessorState, ProcessorRunner } from '../../processors/runner';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../scores';
import { DelayedPromise } from '../aisdk/v5/compat';
import type { ConsumeStreamOptions } from '../aisdk/v5/compat';
import { AISDKV5OutputStream } from '../aisdk/v5/output';
import { reasoningDetailsFromMessages, transformSteps } from '../aisdk/v5/output-helpers';
import type { BufferedByStep, ChunkType, StepBufferItem } from '../types';
import { createJsonTextStreamTransformer, createObjectStreamTransformer } from './output-format-handlers';
import { getTransformedSchema } from './schema';
import type { InferSchemaOutput, OutputSchema, PartialSchemaOutput } from './schema';

export interface LanguageModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

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
  outputProcessorRunnerMode?: ProcessorRunnerMode;
  returnScorerData?: boolean;
  tracingContext?: TracingContext;
};
/**
 * Helper function to create a destructurable version of MastraModelOutput.
 * This wraps the output to ensure properties maintain their context when destructured.
 */
export function createDestructurableOutput<OUTPUT extends OutputSchema = undefined>(
  output: MastraModelOutput<OUTPUT>,
): MastraModelOutput<OUTPUT> {
  // Now that we've fixed teeStream() to not mutate #baseStream, we just need to bind methods
  return new Proxy(output, {
    get(target, prop, _receiver) {
      // Use target as receiver to preserve private member access
      const originalValue = Reflect.get(target, prop, target);

      // For methods, return bound version
      if (typeof originalValue === 'function') {
        return originalValue.bind(target);
      }

      // For everything else (including getters), return as-is
      return originalValue;
    },
  }) as MastraModelOutput<OUTPUT>;
}

export class MastraModelOutput<OUTPUT extends OutputSchema = undefined> extends MastraBase {
  #aisdkv5: AISDKV5OutputStream<OUTPUT>;
  #error: Error | string | { message: string; stack: string } | undefined;
  #baseStream: ReadableStream<ChunkType<OUTPUT>>;
  #bufferedChunks: ChunkType<OUTPUT>[] = [];
  #streamFinished = false;
  #emitter = new EventEmitter();
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
  #bufferedObject: InferSchemaOutput<OUTPUT> | undefined;
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
  #usageCount: LanguageModelUsage = {};
  #tripwire = false;
  #tripwireReason = '';

  #delayedPromises = {
    object: new DelayedPromise<InferSchemaOutput<OUTPUT>>(),
    finishReason: new DelayedPromise<FinishReason | string | undefined>(),
    usage: new DelayedPromise<LanguageModelUsage>(),
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
    totalUsage: new DelayedPromise<LanguageModelUsage>(),
    content: new DelayedPromise<AIV5Type.StepResult<any>['content']>(),
    reasoningDetails: new DelayedPromise<
      {
        type: string;
        text: string;
        providerMetadata: SharedV2ProviderMetadata;
      }[]
    >(),
  };

  #consumptionStarted = false;
  #returnScorerData = false;

  #model: {
    modelId: string | undefined;
    provider: string | undefined;
    version: 'v1' | 'v2';
  };

  /**
   * Unique identifier for this execution run.
   */
  public runId: string;
  #options: MastraModelOutputOptions<OUTPUT>;
  /**
   * The processor runner for this stream.
   */
  public processorRunner?: ProcessorRunner;
  private outputProcessorRunnerMode: ProcessorRunnerMode = false;
  /**
   * The message list for this stream.
   */
  public messageList: MessageList;
  /**
   * Trace ID used on the execution (if the execution was traced).
   */
  public traceId?: string;
  public messageId: string;

  constructor({
    model: _model,
    stream,
    messageList,
    options,
    messageId,
  }: {
    model: {
      modelId: string | undefined;
      provider: string | undefined;
      version: 'v1' | 'v2';
    };
    stream: ReadableStream<ChunkType<OUTPUT>>;
    messageList: MessageList;
    options: MastraModelOutputOptions<OUTPUT>;
    messageId: string;
  }) {
    super({ component: 'LLM', name: 'MastraModelOutput' });
    this.#options = options;
    this.#returnScorerData = !!options.returnScorerData;
    this.runId = options.runId;
    this.traceId = getValidTraceId(options.tracingContext?.currentSpan);

    this.#model = _model;

    this.messageId = messageId;
    // Create processor runner if outputProcessors are provided
    if (options.outputProcessors?.length) {
      this.processorRunner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors: options.outputProcessors,
        logger: this.logger,
        agentName: 'MastraModelOutput',
      });
    }

    if (options.outputProcessorRunnerMode) {
      this.outputProcessorRunnerMode = options.outputProcessorRunnerMode;
    }

    this.messageList = messageList;

    const self = this;

    // Apply output processors if they exist
    let processedStream = stream;
    const processorRunner = this.processorRunner;
    if (processorRunner && options.outputProcessorRunnerMode === `inner`) {
      const processorStates = new Map<string, ProcessorState>();

      processedStream = stream.pipeThrough(
        new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
          async transform(chunk, controller) {
            /**
             * Add base stream controller to structured output processor state
             * so it can be used to enqueue chunks into the main stream from the structuring agent stream
             */
            const STRUCTURED_OUTPUT_PROCESSOR_NAME = 'structured-output';
            if (!processorStates.has(STRUCTURED_OUTPUT_PROCESSOR_NAME)) {
              const structuredOutputProcessorState = new ProcessorState(STRUCTURED_OUTPUT_PROCESSOR_NAME);
              structuredOutputProcessorState.customState = { controller };
              processorStates.set(STRUCTURED_OUTPUT_PROCESSOR_NAME, structuredOutputProcessorState);
            }

            const {
              part: processed,
              blocked,
              reason,
            } = await processorRunner.processPart(chunk as any, processorStates);
            if (blocked) {
              // Emit a tripwire chunk so downstream knows about the abort
              controller.enqueue({
                type: 'tripwire',
                payload: {
                  tripwireReason: reason || 'Output processor blocked content',
                },
              } as ChunkType<OUTPUT>);
              return;
            }
            if (processed) {
              controller.enqueue(processed as ChunkType<OUTPUT>);
            }
          },
        }),
      );
    }

    this.#baseStream = processedStream
      .pipeThrough(
        createObjectStreamTransformer({
          outputProcessorRunnerMode: self.#options.outputProcessorRunnerMode,
          schema: self.#options.output,
        }),
      )
      .pipeThrough(
        new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
          transform: async (chunk, controller) => {
            self.#bufferedChunks.push(chunk);
            self.#emitter.emit('chunk', chunk);

            switch (chunk.type) {
              case 'object-result':
                self.#bufferedObject = chunk.object;
                // Only resolve if not already rejected by validation error
                if (self.#delayedPromises.object.status.type === 'pending') {
                  self.#delayedPromises.object.resolve(chunk.object);
                }
                break;
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
                  content: messageList.get.response.aiV5.modelContent(-1),
                  object:
                    self.#delayedPromises.object.status.type === 'resolved'
                      ? self.#delayedPromises.object.status.value
                      : undefined,
                };

                await options?.onStepFinish?.({
                  ...(self.#model.modelId && self.#model.provider && self.#model.version ? { model: self.#model } : {}),
                  ...stepResult,
                });

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
              case 'tripwire':
                // Handle tripwire chunks from processors
                self.#tripwire = true;
                self.#tripwireReason = chunk.payload?.tripwireReason || 'Content blocked';
                self.#finishReason = 'other';

                // Mark stream as finished for EventEmitter
                self.#streamFinished = true;

                // Resolve all delayed promises before terminating
                self.#delayedPromises.text.resolve(self.#bufferedText.join(''));
                self.#delayedPromises.finishReason.resolve('other');
                self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
                self.#delayedPromises.usage.resolve(self.#usageCount);
                self.#delayedPromises.warnings.resolve(self.#warnings);
                self.#delayedPromises.providerMetadata.resolve(undefined);
                self.#delayedPromises.response.resolve({});
                self.#delayedPromises.request.resolve({});
                self.#delayedPromises.reasoning.resolve('');
                self.#delayedPromises.reasoningText.resolve(undefined);
                self.#delayedPromises.sources.resolve([]);
                self.#delayedPromises.files.resolve([]);
                self.#delayedPromises.toolCalls.resolve([]);
                self.#delayedPromises.toolResults.resolve([]);
                self.#delayedPromises.steps.resolve(self.#bufferedSteps);
                self.#delayedPromises.totalUsage.resolve(self.#usageCount);
                self.#delayedPromises.content.resolve([]);
                self.#delayedPromises.reasoningDetails.resolve([]);

                // Pass the tripwire chunk through
                controller.enqueue(chunk);

                // Emit finish event for EventEmitter streams (since flush won't be called on terminate)
                self.#emitter.emit('finish');

                // Terminate the stream
                controller.terminate();
                return;
              case 'finish':
                // Mark consumption as started (if we're processing chunks, consumption has started)
                self.#consumptionStarted = true;
                // Mark stream as finished for EventEmitter
                self.#streamFinished = true;

                if (chunk.payload.stepResult.reason) {
                  self.#finishReason = chunk.payload.stepResult.reason;
                }

                let response = {};
                if (chunk.payload.metadata) {
                  const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;

                  response = {
                    ...otherMetadata,
                    messages: messageList.get.response.aiV5.model(),
                    uiMessages: messageList.get.response.aiV5.ui(),
                  };
                }

                this.populateUsageCount(chunk.payload.output.usage as Record<string, number>);

                chunk.payload.output.usage = self.#usageCount as any;

                try {
                  if (self.processorRunner && self.outputProcessorRunnerMode === `outer`) {
                    self.messageList = await self.processorRunner.runOutputProcessors(self.messageList);
                    const outputText = self.messageList.get.response.aiV4
                      .core()
                      .map(m => MessageList.coreContentToString(m.content))
                      .join('\n');

                    const messages = self.messageList.get.response.v2();
                    const messagesWithStructuredData = messages.filter(
                      msg => msg.content.metadata && (msg.content.metadata as any).structuredOutput,
                    );
                    // TODO: do we still need this messagesWithStructuredData stuff?
                    if (
                      messagesWithStructuredData[0] &&
                      messagesWithStructuredData[0].content.metadata?.structuredOutput
                    ) {
                      const structuredOutput = messagesWithStructuredData[0].content.metadata.structuredOutput;
                      self.#delayedPromises.object.resolve(structuredOutput as InferSchemaOutput<OUTPUT>);
                    } else if (!self.#options.output && self.#delayedPromises.object.status.type !== 'resolved') {
                      self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
                    }

                    self.#delayedPromises.text.resolve(outputText);
                    self.#delayedPromises.finishReason.resolve(self.#finishReason);

                    // Update response with processed messages after output processors have run
                    if (chunk.payload.metadata) {
                      const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;
                      response = {
                        ...otherMetadata,
                        messages: messageList.get.response.aiV5.model(),
                        uiMessages: messageList.get.response.aiV5.ui(),
                      };
                    }
                  } else {
                    const textContent = self.#bufferedText.join('');
                    self.#delayedPromises.text.resolve(textContent);
                    self.#delayedPromises.finishReason.resolve(self.#finishReason);

                    // Check for structuredOutput in metadata (from output processors in stream mode)
                    const messages = self.messageList.get.response.v2();
                    const messagesWithStructuredData = messages.filter(
                      msg => msg.content.metadata && (msg.content.metadata as any).structuredOutput,
                    );

                    if (
                      messagesWithStructuredData[0] &&
                      // this is to make typescript happy
                      messagesWithStructuredData[0].content.metadata?.structuredOutput
                    ) {
                      const structuredOutput = messagesWithStructuredData[0].content.metadata.structuredOutput;
                      self.#delayedPromises.object.resolve(structuredOutput as InferSchemaOutput<OUTPUT>);
                    } else if (!self.#options.output && self.#delayedPromises.object.status.type !== 'resolved') {
                      // Resolve object promise to avoid hanging
                      self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
                    }
                  }
                } catch (error) {
                  if (error instanceof TripWire) {
                    self.#tripwire = true;
                    self.#tripwireReason = error.message;
                    self.#delayedPromises.finishReason.resolve('other');
                    self.#delayedPromises.text.resolve('');
                  } else {
                    self.#error = error instanceof Error ? error.message : String(error);
                    self.#delayedPromises.finishReason.resolve('error');
                    self.#delayedPromises.text.resolve('');
                  }
                  if (self.#delayedPromises.object.status.type !== 'resolved') {
                    self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
                  }
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
                    ...(self.#model.modelId && self.#model.provider && self.#model.version
                      ? { model: self.#model }
                      : {}),
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
                    object:
                      self.#delayedPromises.object.status.type === 'rejected'
                        ? undefined
                        : self.#delayedPromises.object.status.type === 'resolved'
                          ? self.#delayedPromises.object.status.value
                          : self.#options.output && baseFinishStep.text
                            ? (() => {
                                try {
                                  return JSON.parse(baseFinishStep.text);
                                } catch {
                                  return undefined;
                                }
                              })()
                            : undefined,
                  };

                  await options?.onFinish?.(onFinishPayload);
                }

                if (options?.rootSpan) {
                  options.rootSpan.setAttributes({
                    ...(self.#model.modelId ? { 'aisdk.model.id': self.#model.modelId } : {}),
                    ...(self.#model.provider ? { 'aisdk.model.provider': self.#model.provider } : {}),
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
                // Mark stream as finished for EventEmitter
                self.#streamFinished = true;

                self.#error = chunk.payload.error as any;

                // Reject all delayed promises on error
                const error =
                  typeof self.#error === 'object' ? new Error(self.#error.message) : new Error(String(self.#error));

                Object.values(self.#delayedPromises).forEach(promise => {
                  if (promise.status.type === 'pending') {
                    promise.reject(error);
                  }
                });

                break;
            }

            controller.enqueue(chunk);
          },
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
            // TODO: might need to also check if we are in the main stream with a structuring agent so we
            // TODO: can also reject if structuredOutput.errorStrategy is not 'ignore'
            // TODO: main agent will not have #options.output but can still have a structuring agent and object promise
            if (!self.#options.output && self.#delayedPromises.object.status.type !== 'resolved') {
              // always resolve object promise as undefined if still hanging in flush and no output schema provided
              self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
            }
            // If stream ends without proper finish/error chunks, reject unresolved promises
            // This must be in the final transformer in the fullStream pipeline
            // to ensure all of the delayed promises had a chance to resolve or reject already
            // Avoids promises hanging forever
            Object.entries(self.#delayedPromises).forEach(([key, promise]) => {
              if (promise.status.type === 'pending') {
                promise.reject(new Error(`promise '${key}' was not resolved or rejected when stream finished`));
              }
            });

            // Emit finish event for EventEmitter streams
            self.#streamFinished = true;
            self.#emitter.emit('finish');
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

    // // Bind methods to ensure they work when destructured
    // const methodsToBind = [
    //   { name: 'consumeStream', fn: this.consumeStream },
    //   { name: 'getFullOutput', fn: this.getFullOutput },
    //   { name: 'teeStream', fn: this.teeStream },
    // ] as const;

    // methodsToBind.forEach(({ name, fn }) => {
    //   (this as any)[name] = fn.bind(this);
    // });

    // // Convert getters to bound properties to support destructuring
    // // We need to do this because getters lose their 'this' context when destructured
    // const bindGetter = (name: string, getter: () => any) => {
    //   Object.defineProperty(this, name, {
    //     get: getter.bind(this),
    //     enumerable: true,
    //     configurable: true,
    //   });
    // };

    // // Get the prototype to access the getters
    // const proto = Object.getPrototypeOf(this);
    // const descriptors = Object.getOwnPropertyDescriptors(proto);

    // // Bind all getters from the prototype
    // for (const [key, descriptor] of Object.entries(descriptors)) {
    //   if (descriptor.get && key !== 'constructor') {
    //     bindGetter(key, descriptor.get);
    //   }
    // }
  }

  #getDelayedPromise<T>(promise: DelayedPromise<T>): Promise<T> {
    if (!this.#consumptionStarted) {
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

  // teeStream() {
  //   // Don't mutate #baseStream - this ensures consumeStream() works correctly for destructuring
  //   // Trade-off: This may cause "ReadableStream is locked" for multiple stream accesses
  //   const [teeStream] = this.#baseStream.tee();
  //   return teeStream;
  // }

  /**
   * Stream of all chunks. Provides complete control over stream processing.
   */
  get fullStream() {
    return this.#createEventedStream();
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

  updateUsageCount(usage: Partial<LanguageModelUsage>) {
    if (!usage) {
      return;
    }

    // Use AI SDK v5 format only (MastraModelOutput is only used in VNext paths)
    if (usage.inputTokens !== undefined) {
      this.#usageCount.inputTokens = (this.#usageCount.inputTokens ?? 0) + usage.inputTokens;
    }
    if (usage.outputTokens !== undefined) {
      this.#usageCount.outputTokens = (this.#usageCount.outputTokens ?? 0) + usage.outputTokens;
    }
    if (usage.totalTokens !== undefined) {
      this.#usageCount.totalTokens = (this.#usageCount.totalTokens ?? 0) + usage.totalTokens;
    }
    if (usage.reasoningTokens !== undefined) {
      this.#usageCount.reasoningTokens = (this.#usageCount.reasoningTokens ?? 0) + usage.reasoningTokens;
    }
    if (usage.cachedInputTokens !== undefined) {
      this.#usageCount.cachedInputTokens = (this.#usageCount.cachedInputTokens ?? 0) + usage.cachedInputTokens;
    }
  }

  populateUsageCount(usage: Partial<LanguageModelUsage>) {
    if (!usage) {
      return;
    }

    // Use AI SDK v5 format only (MastraModelOutput is only used in VNext paths)
    if (usage.inputTokens !== undefined && this.#usageCount.inputTokens === undefined) {
      this.#usageCount.inputTokens = usage.inputTokens;
    }
    if (usage.outputTokens !== undefined && this.#usageCount.outputTokens === undefined) {
      this.#usageCount.outputTokens = usage.outputTokens;
    }
    if (usage.totalTokens !== undefined && this.#usageCount.totalTokens === undefined) {
      this.#usageCount.totalTokens = usage.totalTokens;
    }
    if (usage.reasoningTokens !== undefined && this.#usageCount.reasoningTokens === undefined) {
      this.#usageCount.reasoningTokens = usage.reasoningTokens;
    }
    if (usage.cachedInputTokens !== undefined && this.#usageCount.cachedInputTokens === undefined) {
      this.#usageCount.cachedInputTokens = usage.cachedInputTokens;
    }
  }

  async consumeStream(options?: ConsumeStreamOptions): Promise<void> {
    if (this.#consumptionStarted) {
      return;
    }

    this.#consumptionStarted = true;

    try {
      await consumeStream({
        stream: this.#baseStream as globalThis.ReadableStream<any>,
        onError: error => {
          options?.onError?.(error);
        },
      });
    } catch (error) {
      options?.onError?.(error);
    }
  }

  /**
   * Returns complete output including text, usage, tool calls, and all metadata.
   */
  async getFullOutput() {
    if (!this.#consumptionStarted) {
      await this.consumeStream({
        onError: (error: any) => {
          console.error(error);
          throw error;
        },
      });
    }

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
      traceId: this.traceId,
    };

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
    return this.#createEventedStream().pipeThrough(
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

    return this.#createEventedStream().pipeThrough(
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
    const outputSchema = getTransformedSchema(this.#options.output);

    if (outputSchema?.outputFormat === 'array') {
      return this.#createEventedStream().pipeThrough(createJsonTextStreamTransformer(this.#options.output));
    }

    return this.#createEventedStream().pipeThrough(
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
  _getImmediateObject() {
    return this.#bufferedObject;
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

  #getTotalUsage(): LanguageModelUsage {
    let total = this.#usageCount.totalTokens;

    if (total === undefined) {
      const input = this.#usageCount.inputTokens ?? 0;
      const output = this.#usageCount.outputTokens ?? 0;
      const reasoning = this.#usageCount.reasoningTokens ?? 0;
      total = input + output + reasoning;
    }

    return {
      inputTokens: this.#usageCount.inputTokens,
      outputTokens: this.#usageCount.outputTokens,
      totalTokens: total,
      reasoningTokens: this.#usageCount.reasoningTokens,
      cachedInputTokens: this.#usageCount.cachedInputTokens,
    };
  }

  #createEventedStream() {
    const self = this;
    return new ReadableStream<ChunkType<OUTPUT>>({
      start(controller) {
        // Start consuming stream if not already started
        if (!self.#consumptionStarted) {
          void self.consumeStream();
        }

        // Replay buffered chunks
        self.#bufferedChunks.forEach(chunk => {
          controller.enqueue(chunk);
        });

        // If stream already finished, close immediately
        if (self.#streamFinished) {
          controller.close();
          return;
        }

        // Listen for chunks and stream finish
        const chunkHandler = (chunk: ChunkType<OUTPUT>) => {
          controller.enqueue(chunk);
        };

        const finishHandler = () => {
          self.#emitter.off('chunk', chunkHandler);
          self.#emitter.off('finish', finishHandler);
          controller.close();
        };

        self.#emitter.on('chunk', chunkHandler);
        self.#emitter.on('finish', finishHandler);
      },

      cancel() {
        // Cleanup happens in the handlers above when they're removed
      },
    });
  }
}

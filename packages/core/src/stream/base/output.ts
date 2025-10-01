import type { ReadableStream } from 'stream/web';
import { TransformStream } from 'stream/web';
import { consumeStream } from 'ai-v5';
import { TripWire } from '../../agent';
import { MessageList } from '../../agent/message-list';
import { getValidTraceId } from '../../ai-tracing';
import { MastraBase } from '../../base';
import { safeParseErrorObject } from '../../error/utils.js';
import type { ProcessorRunnerMode, ProcessorState } from '../../processors/runner';
import { ProcessorRunner } from '../../processors/runner';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../scores';
import type { WorkflowRunStatus } from '../../workflows';
import { DelayedPromise } from '../aisdk/v5/compat';
import type { ConsumeStreamOptions } from '../aisdk/v5/compat';
import { AISDKV5OutputStream } from '../aisdk/v5/output';
import type {
  ChunkType,
  LanguageModelUsage,
  LLMStepResult,
  MastraModelOutputOptions,
  MastraOnFinishCallbackArgs,
} from '../types';
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

export class MastraModelOutput<OUTPUT extends OutputSchema = undefined> extends MastraBase {
  #status: WorkflowRunStatus = 'running';
  #aisdkv5: AISDKV5OutputStream<OUTPUT>;
  #error: Error | string | { message: string; stack: string } | undefined;
  #baseStream: ReadableStream<ChunkType<OUTPUT>>;
  #bufferedSteps: LLMStepResult[] = [];
  #bufferedReasoningDetails: Record<string, LLMStepResult['reasoning'][number]> = {};
  #bufferedByStep: LLMStepResult = {
    text: '',
    reasoning: [],
    sources: [],
    files: [],
    toolCalls: [],
    toolResults: [],
    dynamicToolCalls: [],
    dynamicToolResults: [],
    staticToolCalls: [],
    staticToolResults: [],
    content: [],
    usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
    warnings: [],
    request: {},
    response: {
      id: '',
      timestamp: new Date(),
      modelId: '',
      messages: [],
      uiMessages: [],
    },
    reasoningText: '',
    providerMetadata: undefined,
    finishReason: undefined,
  };
  #bufferedText: LLMStepResult['text'][] = [];
  #bufferedTextChunks: Record<string, LLMStepResult['text'][]> = {};
  #bufferedSources: LLMStepResult['sources'] = [];
  #bufferedReasoning: LLMStepResult['reasoning'] = [];
  #bufferedFiles: LLMStepResult['files'] = [];
  #toolCallArgsDeltas: Record<string, LLMStepResult['text'][]> = {};
  #toolCallDeltaIdNameMap: Record<string, string> = {};
  #toolCalls: LLMStepResult['toolCalls'] = [];
  #toolResults: LLMStepResult['toolResults'] = [];
  #warnings: LLMStepResult['warnings'] = [];
  #finishReason: LLMStepResult['finishReason'] = undefined;
  #request: LLMStepResult['request'] = {};
  #usageCount: LLMStepResult['usage'] = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
  #tripwire = false;
  #tripwireReason = '';

  #delayedPromises = {
    suspendPayload: new DelayedPromise<any>(),
    object: new DelayedPromise<InferSchemaOutput<OUTPUT>>(),
    finishReason: new DelayedPromise<LLMStepResult['finishReason']>(),
    usage: new DelayedPromise<LLMStepResult['usage']>(),
    warnings: new DelayedPromise<LLMStepResult['warnings']>(),
    providerMetadata: new DelayedPromise<LLMStepResult['providerMetadata']>(),
    response: new DelayedPromise<LLMStepResult['response']>(),
    request: new DelayedPromise<LLMStepResult['request']>(),
    text: new DelayedPromise<LLMStepResult['text']>(),
    reasoning: new DelayedPromise<LLMStepResult['reasoning']>(),
    reasoningText: new DelayedPromise<string | undefined>(),
    sources: new DelayedPromise<LLMStepResult['sources']>(),
    files: new DelayedPromise<LLMStepResult['files']>(),
    toolCalls: new DelayedPromise<LLMStepResult['toolCalls']>(),
    toolResults: new DelayedPromise<LLMStepResult['toolResults']>(),
    steps: new DelayedPromise<LLMStepResult[]>(),
    totalUsage: new DelayedPromise<LLMStepResult['usage']>(),
    content: new DelayedPromise<LLMStepResult['content']>(),
  };

  #streamConsumed = false;
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
    if (processorRunner && options.outputProcessorRunnerMode === `stream`) {
      const processorStates = new Map<string, ProcessorState>();
      processedStream = stream.pipeThrough(
        new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
          async transform(chunk, controller) {
            const { part: processed, blocked, reason } = await processorRunner.processPart(chunk, processorStates);
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

    this.#baseStream = processedStream.pipeThrough(
      new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
        transform: async (chunk, controller) => {
          switch (chunk.type) {
            case 'tool-call-suspended':
            case 'tool-call-approval':
              self.#status = 'suspended';
              self.#delayedPromises.suspendPayload.resolve(chunk.payload);
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
                runId: chunk.runId,
                from: chunk.from,
                payload: {
                  id: chunk.payload.id,
                  providerMetadata: chunk.payload.providerMetadata,
                  text: '',
                },
              };
              break;
            case 'reasoning-delta': {
              self.#bufferedReasoning.push({
                type: 'reasoning',
                runId: chunk.runId,
                from: chunk.from,
                payload: chunk.payload,
              });
              self.#bufferedByStep.reasoning.push({
                type: 'reasoning',
                runId: chunk.runId,
                from: chunk.from,
                payload: chunk.payload,
              });

              const bufferedReasoning = self.#bufferedReasoningDetails[chunk.payload.id];
              if (bufferedReasoning) {
                bufferedReasoning.payload.text += chunk.payload.text;
                if (chunk.payload.providerMetadata) {
                  bufferedReasoning.payload.providerMetadata = chunk.payload.providerMetadata;
                }
              }

              break;
            }
            case 'reasoning-end': {
              const bufferedReasoning = self.#bufferedReasoningDetails[chunk.payload.id];
              if (chunk.payload.providerMetadata && bufferedReasoning) {
                bufferedReasoning.payload.providerMetadata = chunk.payload.providerMetadata;
              }
              break;
            }
            case 'tool-call':
              self.#toolCalls.push(chunk);
              self.#bufferedByStep.toolCalls.push(chunk);
              const toolCallPayload = chunk.payload;
              // @ts-ignore TODO: What does this mean??? Why is there a nested output, what is the type supposed to be
              if (toolCallPayload?.output?.from === 'AGENT' && toolCallPayload?.output?.type === 'finish') {
                // @ts-ignore TODO: What does this mean??? Why is there a nested output, what is the type supposed to be
                const finishPayload = toolCallPayload.output.payload;
                if (finishPayload?.usage) {
                  self.updateUsageCount(finishPayload.usage);
                }
              }
              break;
            case 'tool-result':
              self.#toolResults.push(chunk);
              self.#bufferedByStep.toolResults.push(chunk);
              break;
            case 'step-finish': {
              self.updateUsageCount(chunk.payload.output.usage);
              // chunk.payload.totalUsage = self.totalUsage;
              self.#warnings = chunk.payload.stepResult.warnings || [];

              if (chunk.payload.metadata.request) {
                self.#request = chunk.payload.metadata.request;
              }

              const { providerMetadata, request, ...otherMetadata } = chunk.payload.metadata;

              const stepResult: LLMStepResult = {
                stepType: self.#bufferedSteps.length === 0 ? 'initial' : 'tool-result',
                sources: self.#bufferedByStep.sources,
                files: self.#bufferedByStep.files,
                toolCalls: self.#bufferedByStep.toolCalls,
                toolResults: self.#bufferedByStep.toolResults,

                content: messageList.get.response.aiV5.modelContent(-1),
                text: self.#bufferedByStep.text,
                reasoningText: self.#bufferedReasoning.map(reasoningPart => reasoningPart.payload.text).join(''),
                reasoning: self.#bufferedByStep.reasoning,
                get staticToolCalls() {
                  return self.#bufferedByStep.toolCalls.filter(
                    part => part.type === 'tool-call' && part.payload?.dynamic === false,
                  );
                },
                get dynamicToolCalls() {
                  return self.#bufferedByStep.toolCalls.filter(
                    part => part.type === 'tool-call' && part.payload?.dynamic === true,
                  );
                },
                get staticToolResults() {
                  return self.#bufferedByStep.toolResults.filter(
                    part => part.type === 'tool-result' && part.payload?.dynamic === false,
                  );
                },
                get dynamicToolResults() {
                  return self.#bufferedByStep.toolResults.filter(
                    part => part.type === 'tool-result' && part.payload?.dynamic === true,
                  );
                },
                finishReason: chunk.payload.stepResult.reason,
                usage: chunk.payload.output.usage,
                warnings: self.#warnings,
                request: request || {},
                response: {
                  id: chunk.payload.id || '',
                  timestamp: (chunk.payload.metadata?.timestamp as Date) || new Date(),
                  modelId:
                    (chunk.payload.metadata?.modelId as string) || (chunk.payload.metadata?.model as string) || '',
                  ...otherMetadata,
                  messages: chunk.payload.messages?.nonUser || [],
                  uiMessages: messageList.get.response.aiV5.ui(),
                },
                providerMetadata: providerMetadata,
              };

              await options?.onStepFinish?.({
                ...(self.#model.modelId && self.#model.provider && self.#model.version ? { model: self.#model } : {}),
                ...stepResult,
              });

              self.#bufferedSteps.push(stepResult);

              self.#bufferedByStep = {
                text: '',
                reasoning: [],
                sources: [],
                files: [],
                toolCalls: [],
                toolResults: [],
                dynamicToolCalls: [],
                dynamicToolResults: [],
                staticToolCalls: [],
                staticToolResults: [],
                content: [],
                usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
                warnings: [],
                request: {},
                response: {
                  id: '',
                  timestamp: new Date(),
                  modelId: '',
                  messages: [],
                  uiMessages: [],
                },
                reasoningText: '',
                providerMetadata: undefined,
                finishReason: undefined,
              };

              break;
            }
            case 'tripwire':
              // Handle tripwire chunks from processors
              self.#tripwire = true;
              self.#tripwireReason = chunk.payload?.tripwireReason || 'Content blocked';
              self.#finishReason = 'other';

              // Resolve all delayed promises before terminating
              self.#delayedPromises.text.resolve(self.#bufferedText.join(''));
              self.#delayedPromises.finishReason.resolve('other');
              self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
              self.#delayedPromises.usage.resolve(self.#usageCount);
              self.#delayedPromises.warnings.resolve(self.#warnings);
              self.#delayedPromises.providerMetadata.resolve(undefined);
              self.#delayedPromises.response.resolve({} as LLMStepResult['response']);
              self.#delayedPromises.request.resolve({});
              self.#delayedPromises.reasoning.resolve([]);
              self.#delayedPromises.reasoningText.resolve(undefined);
              self.#delayedPromises.sources.resolve([]);
              self.#delayedPromises.files.resolve([]);
              self.#delayedPromises.toolCalls.resolve([]);
              self.#delayedPromises.toolResults.resolve([]);
              self.#delayedPromises.steps.resolve(self.#bufferedSteps);
              self.#delayedPromises.totalUsage.resolve(self.#usageCount);
              self.#delayedPromises.content.resolve([]);

              // Pass the tripwire chunk through
              controller.enqueue(chunk);
              // Terminate the stream
              controller.terminate();
              return;
            case 'finish':
              self.#status = 'success';
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

              chunk.payload.output.usage = {
                inputTokens: self.#usageCount.inputTokens ?? 0,
                outputTokens: self.#usageCount.outputTokens ?? 0,
                totalTokens: self.#usageCount.totalTokens ?? 0,
                ...(self.#usageCount.reasoningTokens !== undefined && {
                  reasoningTokens: self.#usageCount.reasoningTokens,
                }),
                ...(self.#usageCount.cachedInputTokens !== undefined && {
                  cachedInputTokens: self.#usageCount.cachedInputTokens,
                }),
              };

              try {
                if (self.processorRunner && self.outputProcessorRunnerMode === `result`) {
                  self.messageList = await self.processorRunner.runOutputProcessors(self.messageList);
                  const outputText = self.messageList.get.response.aiV4
                    .core()
                    .map(m => MessageList.coreContentToString(m.content))
                    .join('\n');

                  const messages = self.messageList.get.response.v2();
                  const messagesWithStructuredData = messages.filter(
                    msg =>
                      msg.content.metadata &&
                      'structuredOutput' in msg.content.metadata &&
                      msg.content.metadata.structuredOutput,
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
                    msg =>
                      msg.content.metadata &&
                      'structuredOutput' in msg.content.metadata &&
                      msg.content.metadata.structuredOutput,
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
                self.#delayedPromises.object.resolve(undefined as InferSchemaOutput<OUTPUT>);
              }

              // Resolve all delayed promises with final values
              self.#delayedPromises.usage.resolve(self.#usageCount);
              self.#delayedPromises.warnings.resolve(self.#warnings);
              self.#delayedPromises.providerMetadata.resolve(chunk.payload.metadata?.providerMetadata);
              self.#delayedPromises.response.resolve(response as LLMStepResult['response']);
              self.#delayedPromises.request.resolve(self.#request || {});
              self.#delayedPromises.text.resolve(self.#bufferedText.join(''));
              const reasoningText =
                self.#bufferedReasoning.length > 0
                  ? self.#bufferedReasoning.map(reasoningPart => reasoningPart.payload.text).join('')
                  : undefined;
              self.#delayedPromises.reasoningText.resolve(reasoningText);
              self.#delayedPromises.reasoning.resolve(Object.values(self.#bufferedReasoningDetails || {}));
              self.#delayedPromises.sources.resolve(self.#bufferedSources);
              self.#delayedPromises.files.resolve(self.#bufferedFiles);
              self.#delayedPromises.toolCalls.resolve(self.#toolCalls);
              self.#delayedPromises.toolResults.resolve(self.#toolResults);
              self.#delayedPromises.steps.resolve(self.#bufferedSteps);
              self.#delayedPromises.totalUsage.resolve(self.#getTotalUsage());
              self.#delayedPromises.content.resolve(messageList.get.response.aiV5.stepContent());
              self.#delayedPromises.suspendPayload.resolve(undefined);

              const baseFinishStep = self.#bufferedSteps[self.#bufferedSteps.length - 1];

              if (baseFinishStep) {
                const onFinishPayload: MastraOnFinishCallbackArgs<OUTPUT> = {
                  // StepResult properties from baseFinishStep
                  providerMetadata: baseFinishStep.providerMetadata,
                  text: baseFinishStep.text,
                  warnings: baseFinishStep.warnings ?? [],
                  finishReason: chunk.payload.stepResult.reason,
                  content: messageList.get.response.aiV5.stepContent(),
                  request: await self.request,
                  error: self.error,
                  reasoning: await self.reasoning,
                  reasoningText: await self.reasoningText,
                  sources: await self.sources,
                  files: await self.files,
                  steps: self.#bufferedSteps,
                  response: {
                    ...(await self.response),
                    ...baseFinishStep.response,
                    messages: messageList.get.response.aiV5.model(),
                  },
                  usage: chunk.payload.output.usage,
                  totalUsage: self.#getTotalUsage(),
                  toolCalls: await self.toolCalls,
                  toolResults: await self.toolResults,
                  staticToolCalls: (await self.toolCalls).filter(toolCall => toolCall?.payload?.dynamic === false),
                  staticToolResults: (await self.toolResults).filter(
                    toolResult => toolResult?.payload?.dynamic === false,
                  ),
                  dynamicToolCalls: (await self.toolCalls).filter(toolCall => toolCall?.payload?.dynamic === true),
                  dynamicToolResults: (await self.toolResults).filter(
                    toolResult => toolResult?.payload?.dynamic === true,
                  ),
                  // Custom properties (not part of standard callback)
                  ...(self.#model.modelId && self.#model.provider && self.#model.version ? { model: self.#model } : {}),
                  object:
                    self.#delayedPromises.object.status.type === 'resolved'
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
                          baseFinishStep?.toolCalls
                            ?.map(toolCall => {
                              return {
                                type: 'tool-call',
                                toolCallId: toolCall.payload?.toolCallId,
                                args: toolCall.payload?.args,
                                toolName: toolCall.payload?.toolName,
                              };
                            })
                            .filter(Boolean),
                        ),
                      }
                    : {}),
                });

                options.rootSpan.end();
              }

              break;

            case 'error':
              self.#error = chunk.payload.error as Error | string | { message: string; stack: string };
              self.#status = 'failed';

              // Reject all delayed promises on error
              const errorMessage = (self.#error as any)?.message || safeParseErrorObject(self.#error);
              const error = new Error(errorMessage);

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
        tracingContext: options?.tracingContext,
      },
    });

    // Bind methods to ensure they work when destructured
    const methodsToBind = [
      { name: 'consumeStream', fn: this.consumeStream },
      { name: 'getFullOutput', fn: this.getFullOutput },
      { name: 'teeStream', fn: this.teeStream },
    ] as const;

    methodsToBind.forEach(({ name, fn }) => {
      // Type-safe method binding for destructuring support
      (this as Record<string, unknown>)[name] = fn.bind(this);
    });

    // Convert getters to bound properties to support destructuring
    // We need to do this because getters lose their 'this' context when destructured
    const bindGetter = <T>(name: string, getter: () => T) => {
      Object.defineProperty(this, name, {
        get: getter.bind(this),
        enumerable: true,
        configurable: true,
      });
    };

    // Get the prototype to access the getters
    const proto = Object.getPrototypeOf(this);
    const descriptors = Object.getOwnPropertyDescriptors(proto);

    // Bind all getters from the prototype
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor.get && key !== 'constructor') {
        bindGetter(key, descriptor.get);
      }
    }
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
   * Resolves to reasoning parts array for models that support reasoning.
   */
  get reasoning() {
    return this.#getDelayedPromise(this.#delayedPromises.reasoning);
  }

  /**
   * Resolves to complete reasoning text for models that support reasoning.
   */
  get reasoningText() {
    return this.#getDelayedPromise(this.#delayedPromises.reasoningText);
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

  get suspendPayload() {
    return this.#getDelayedPromise(this.#delayedPromises.suspendPayload);
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

    return fullStream
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
    this.#streamConsumed = true;
    try {
      await consumeStream({
        stream: this.fullStream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              controller.enqueue(chunk);
            },
          }),
        ) as Parameters<typeof consumeStream>[0]['stream'],
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
      onError: (error: unknown) => {
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

  get status() {
    return this.#status;
  }

  serializeState() {
    return {
      status: this.#status,
      bufferedSteps: this.#bufferedSteps,
      bufferedReasoningDetails: this.#bufferedReasoningDetails,
      bufferedByStep: this.#bufferedByStep,
      bufferedText: this.#bufferedText,
      bufferedTextChunks: this.#bufferedTextChunks,
      bufferedSources: this.#bufferedSources,
      bufferedReasoning: this.#bufferedReasoning,
      bufferedFiles: this.#bufferedFiles,
      toolCallArgsDeltas: this.#toolCallArgsDeltas,
      toolCallDeltaIdNameMap: this.#toolCallDeltaIdNameMap,
      toolCalls: this.#toolCalls,
      toolResults: this.#toolResults,
      warnings: this.#warnings,
      finishReason: this.#finishReason,
      request: this.#request,
      usageCount: this.#usageCount,
      tripwire: this.#tripwire,
      tripwireReason: this.#tripwireReason,
    };
  }

  deserializeState(state: any) {
    this.#status = state.status;
    this.#bufferedSteps = state.bufferedSteps;
    this.#bufferedReasoningDetails = state.bufferedReasoningDetails;
    this.#bufferedByStep = state.bufferedByStep;
    this.#bufferedText = state.bufferedText;
    this.#bufferedTextChunks = state.bufferedTextChunks;
    this.#bufferedSources = state.bufferedSources;
    this.#bufferedReasoning = state.bufferedReasoning;
    this.#bufferedFiles = state.bufferedFiles;
    this.#toolCallArgsDeltas = state.toolCallArgsDeltas;
    this.#toolCallDeltaIdNameMap = state.toolCallDeltaIdNameMap;
    this.#toolCalls = state.toolCalls;
    this.#toolResults = state.toolResults;
    this.#warnings = state.warnings;
    this.#finishReason = state.finishReason;
    this.#request = state.request;
    this.#usageCount = state.usageCount;
    this.#tripwire = state.tripwire;
    this.#tripwireReason = state.tripwireReason;
  }
}

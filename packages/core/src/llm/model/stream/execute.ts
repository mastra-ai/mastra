import { ReadableStream } from 'stream/web';
import type { LanguageModelV1Prompt } from 'ai';
import { generateId } from 'ai';
import { z } from 'zod';
import { MessageList } from '../../../agent';
import { ConsoleLogger } from '../../../logger';
import type { MastraMessageV1 } from '../../../memory';
import type { ChunkType } from '../../../stream/types';
import { createStep, createWorkflow } from '../../../workflows';
import { assembleOperationName, getBaseTelemetryAttributes, getTracer } from './ai-sdk/telemetry';
import { convertFullStreamChunkToAISDKv4, executeV4 } from './ai-sdk/v4';
import { executeV5 } from './ai-sdk/v5/execute';
import { convertFullStreamChunkToAISDKv5 } from './ai-sdk/v5/transforms';
import { MastraModelOutput } from './base';
import { AgenticRunState } from './run-state';
import type { AgentWorkflowProps, StreamExecutorProps } from './types';

const toolCallInpuSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.any(),
  providerMetadata: z.any(),
});

const toolCallOutputSchema = toolCallInpuSchema.extend({
  result: z.any(),
});

const llmIterationOutputSchema = z.object({
  messageId: z.string(),
  messages: z.object({
    all: z.array(z.any()),
    user: z.array(z.any()),
    nonUser: z.array(z.any()),
  }),
  output: z.any(),
  metadata: z.any(),
  stepResult: z.any(),
});

function createAgentWorkflow({
  messageId,
  model,
  runId,
  providerMetadata,
  tools,
  toolChoice,
  experimental_telemetry,
  toolCallStreaming,
  _internal,
  experimental_generateMessageId,
  controller,
  options,
  doStreamSpan,
}: AgentWorkflowProps) {
  function toolCallStep() {
    return createStep({
      id: 'toolCallStep',
      inputSchema: toolCallInpuSchema,
      outputSchema: toolCallOutputSchema,
      execute: async ({ inputData, getStepResult }) => {
        const tool =
          tools?.[inputData.toolName] || Object.values(tools || {})?.find(tool => tool.name === inputData.toolName);

        if (!tool) {
          throw new Error(`Tool ${inputData.toolName} not found`);
        }

        if (!tool.execute) {
          return inputData;
        }

        const initialResult = getStepResult({
          id: 'generateText',
        } as any);

        const messageList = MessageList.fromArray(initialResult.messages.user);

        const tracer = getTracer({
          isEnabled: experimental_telemetry?.isEnabled,
          tracer: experimental_telemetry?.tracer,
        });

        const span = tracer.startSpan('mastra.stream.toolCall').setAttributes({
          ...assembleOperationName({
            operationId: 'mastra.stream.toolCall',
            telemetry: experimental_telemetry,
          }),
          'stream.toolCall.toolName': inputData.toolName,
          'stream.toolCall.toolCallId': inputData.toolCallId,
          'stream.toolCall.args': JSON.stringify(inputData.args),
        });

        try {
          const result = await tool.execute(inputData.args, {
            abortSignal: options?.abortSignal,
            toolCallId: inputData.toolCallId,
            messages: messageList.get.all
              ?.ui()
              ?.filter(message => message.role === 'user')
              ?.map(message => ({
                role: message.role,
                content: message.content,
              })) as any,
          });

          span.setAttributes({
            'stream.toolCall.result': JSON.stringify(result),
          });

          span.end();

          return { result, ...inputData };
        } catch (error) {
          span.setStatus({
            code: 2,
            message: (error as Error)?.message ?? error,
          });
          span.recordException(error as Error);
          throw error;
        }
      },
    });
  }

  function createLLMExecutionStep() {
    return createStep({
      id: 'generateText',
      inputSchema: z.object({
        messageId: z.string(),
        messages: z.object({
          all: z.array(z.any()),
          user: z.array(z.any()),
          nonUser: z.array(z.any()),
        }),
        metadata: z.any(),
        output: z.any(),
        stepResult: z.any(),
      }),
      outputSchema: llmIterationOutputSchema,
      execute: async ({ inputData }) => {
        const messagesToUse = inputData.messages.all;
        const messageList = MessageList.fromArray(messagesToUse);
        console.log('messages_to_use', JSON.stringify(messagesToUse, null, 2));
        console.log('message_list', JSON.stringify(messageList.get.all.core(), null, 2));
        console.log('message_list_ui', JSON.stringify(messageList.get.all.aiV5.ui(), null, 2));
        console.log('message_list_model', JSON.stringify(messageList.get.all.model(), null, 2));

        const runState = new AgenticRunState({
          _internal: _internal!,
          model,
        });

        let modelResult;

        let warnings: any;
        let request: any;
        let rawResponse: any;

        switch (model.specificationVersion) {
          case 'v1': {
            modelResult = executeV4({
              model,
              runId,
              providerMetadata,
              inputMessages: messageList.get.all.core() as any,
              tools,
              toolChoice,
              _internal,
              options,
              onResult: ({
                warnings: warningsFromStream,
                request: requestFromStream,
                rawResponse: rawResponseFromStream,
              }) => {
                warnings = warningsFromStream;
                request = requestFromStream || {};
                rawResponse = rawResponseFromStream;

                controller.enqueue({
                  runId,
                  from: 'AGENT',
                  type: 'step-start',
                  payload: {
                    request: request || {},
                    warnings: [],
                    messageId: messageId,
                  },
                });
              },
            });
            break;
          }
          case 'v2': {
            modelResult = executeV5({
              model,
              runId,
              providerMetadata,
              inputMessages: messageList.get.all.core() as any,
              tools,
              toolChoice,
              _internal,
              options,
              experimental_telemetry,
              onResult: ({
                warnings: warningsFromStream,
                request: requestFromStream,
                rawResponse: rawResponseFromStream,
              }) => {
                warnings = warningsFromStream;
                request = requestFromStream || {};
                rawResponse = rawResponseFromStream;

                controller.enqueue({
                  runId,
                  from: 'AGENT',
                  type: 'step-start',
                  payload: {
                    request: request || {},
                    warnings: [],
                    messageId: messageId,
                  },
                });
              },
              doStreamSpan,
            });

            break;
          }
          default: {
            //@ts-ignore
            throw new Error(`Unsupported model version: ${model.specificationVersion}`);
          }
        }

        const outputStream = new MastraModelOutput({
          model: {
            modelId: model.modelId,
            provider: model.provider,
            version: model.specificationVersion,
          },
          stream: modelResult!,
          options: {
            toolCallStreaming,
            experimental_telemetry,
          },
        });

        try {
          for await (const chunk of outputStream.fullStream) {
            if (
              chunk.type !== 'reasoning-delta' &&
              chunk.type !== 'reasoning-signature' &&
              chunk.type !== 'redacted-reasoning' &&
              runState.state.isReasoning
            ) {
              if (runState.state.reasoningDeltas.length) {
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [
                      {
                        type: 'reasoning',
                        text: runState.state.reasoningDeltas.join(''),
                        signature: chunk.payload.signature,
                        providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                      },
                    ],
                  },
                  'response',
                );
              }

              runState.setState({
                isReasoning: false,
                reasoningDeltas: [],
              });
            }

            if (chunk.type !== 'text-delta' && chunk.type !== 'tool-call' && runState.state.isStreaming) {
              if (runState.state.textDeltas.length) {
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [
                      {
                        type: 'text',
                        text: runState.state.textDeltas.join(''),
                        providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                      },
                    ],
                  },
                  'response',
                );
              }

              runState.setState({
                isStreaming: false,
                textDeltas: [],
              });
            }

            switch (chunk.type) {
              case 'error':
                runState.setState({
                  hasErrored: true,
                });

                controller.enqueue(chunk);

                runState.setState({
                  stepResult: {
                    isContinued: false,
                    reason: 'error',
                  },
                });

                await options?.onError?.({ error: chunk.payload.error });

                break;
              case 'response-metadata':
                runState.setState({
                  responseMetadata: {
                    id: chunk.payload.id,
                    timestamp: chunk.payload.timestamp,
                    modelId: chunk.payload.modelId,
                    headers: chunk.payload.headers,
                  },
                });
                break;
              case 'finish':
                providerMetadata = chunk.payload.metadata.providerMetadata;
                runState.setState({
                  stepResult: {
                    reason: chunk.payload.reason,
                    logprobs: chunk.payload.logprobs,
                    warnings: warnings,
                    totalUsage: chunk.payload.totalUsage,
                    headers: rawResponse?.headers,
                    messageId,
                    isContinued: !['stop', 'error'].includes(chunk.payload.reason),
                    request,
                  },
                });
                break;
              case 'reasoning-delta': {
                const reasoningDeltasFromState = runState.state.reasoningDeltas;
                reasoningDeltasFromState.push(chunk.payload.text);
                runState.setState({
                  isReasoning: true,
                  reasoningDeltas: reasoningDeltasFromState,
                  providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                });
                controller.enqueue(chunk);
                break;
              }
              case 'reasoning-signature': {
                const reasoningDeltasFromState = runState.state.reasoningDeltas;
                if (reasoningDeltasFromState.length) {
                  messageList.add(
                    {
                      id: messageId,
                      role: 'assistant',
                      content: [
                        {
                          type: 'reasoning',
                          text: reasoningDeltasFromState.join(''),
                          signature: chunk.payload.signature,
                          providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                        },
                      ],
                    },
                    'response',
                  );

                  runState.setState({
                    reasoningDeltas: [],
                    providerOptions: undefined,
                  });
                }

                controller.enqueue(chunk);
                break;
              }
              case 'reasoning-start': {
                runState.setState({
                  providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                });

                if (Object.values(chunk.payload.providerMetadata || {}).find((v: any) => v?.redactedData)) {
                  messageList.add(
                    {
                      id: messageId,
                      role: 'assistant',
                      content: [
                        {
                          type: 'reasoning',
                          text: '',
                          providerOptions: chunk.payload.providerMetadata ?? runState.state.providerOptions,
                        },
                      ],
                    },
                    'response',
                  );
                  controller.enqueue(chunk);
                  break;
                }
                controller.enqueue(chunk);
                break;
              }
              case 'redacted-reasoning':
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [{ type: 'redacted-reasoning', data: chunk.payload.data }],
                  },
                  'response',
                );
                controller.enqueue(chunk);
                break;
              case 'tool-call-delta': {
                const hasToolCallStreaming = runState.state.hasToolCallStreaming;
                if (!hasToolCallStreaming && model.specificationVersion === 'v1') {
                  // @TODO:
                  // This needs to go to src/llm/model/stream/ai-sdk/v4/input.ts as an input stream transform, to add events
                  const streamingChunk = {
                    type: 'tool-call-input-streaming-start',
                    from: 'AGENT',
                    runId: chunk.runId,
                    payload: {
                      toolCallId: chunk.payload.toolCallId,
                      toolName: chunk.payload.toolName,
                    },
                  };
                  controller.enqueue(streamingChunk);

                  await options?.onChunk?.(
                    convertFullStreamChunkToAISDKv4({
                      chunk: streamingChunk,
                      client: false,
                      sendReasoning: true,
                      sendSources: true,
                      sendUsage: true,
                      toolCallStreaming: true,
                      getErrorMessage: (error: string) => error,
                    }),
                  );

                  runState.setState({
                    hasToolCallStreaming: true,
                  });
                }
                controller.enqueue(chunk);
                break;
              }
              case 'file':
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: [
                      {
                        type: 'file',
                        data: chunk.payload.data,
                        mimeType: chunk.payload.mimeType,
                      },
                    ],
                  },
                  'response',
                );
                controller.enqueue(chunk);
                break;
              case 'source':
                messageList.add(
                  {
                    id: messageId,
                    role: 'assistant',
                    content: {
                      format: 2,
                      parts: [
                        {
                          type: 'source',
                          source: {
                            sourceType: 'url',
                            id: chunk.payload.id,
                            url: chunk.payload.url,
                            title: chunk.payload.title,
                            providerMetadata: chunk.payload.providerMetadata,
                          },
                        },
                      ],
                    },
                    createdAt: new Date(),
                  },
                  'response',
                );

                controller.enqueue(chunk);
                break;
              case 'text-delta': {
                const textDeltasFromState = runState.state.textDeltas;
                textDeltasFromState.push(chunk.payload.text);
                runState.setState({
                  textDeltas: textDeltasFromState,
                  isStreaming: true,
                });
                controller.enqueue(chunk);
                break;
              }
              default:
                controller.enqueue(chunk);
            }

            if (
              [
                'text-delta',
                'reasoning-delta',
                'source',
                'tool-call',
                'tool-call-input-streaming-start',
                'tool-call-delta',
              ].includes(chunk.type)
            ) {
              if (model.specificationVersion === 'v1') {
                const transformedChunk = convertFullStreamChunkToAISDKv4({
                  chunk,
                  client: false,
                  sendReasoning: true,
                  sendSources: true,
                  sendUsage: true,
                  toolCallStreaming: true,
                  getErrorMessage: (error: string) => error,
                });
                await options?.onChunk?.(transformedChunk);
              } else if (model.specificationVersion === 'v2') {
                const transformedChunk = convertFullStreamChunkToAISDKv5({
                  chunk,
                  sendReasoning: true,
                  sendSources: true,
                  sendUsage: true,
                  getErrorMessage: (error: string) => error,
                });
                await options?.onChunk?.({ chunk: transformedChunk } as any);
              }
            }

            if (runState.state.hasErrored) {
              break;
            }
          }
        } catch (error) {
          console.log('Error in LLM Execution Step', error);

          runState.setState({
            hasErrored: true,
            stepResult: {
              isContinued: false,
              reason: 'error',
            },
          });
        }

        const toolCalls = outputStream.toolCalls?.map(chunk => {
          return chunk.payload;
        });

        /**
         * Update Message List piece
         */

        if (toolCalls.length > 0) {
          const assistantContent = [
            ...(toolCalls.map(toolCall => {
              return {
                type: 'tool-call',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: toolCall.args,
              };
            }) as any),
          ];

          messageList.add(
            {
              id: messageId,
              role: 'assistant',
              content: assistantContent,
            },
            'response',
          );
        }

        /**
         * Assemble messages
         */

        const allMessages = messageList.get.all.v1().map(message => {
          return {
            id: message.id,
            role: message.role,
            content: message.content,
          };
        });

        const userMessages = allMessages.filter(message => message.role === 'user');
        const nonUserMessages = allMessages.filter(message => message.role !== 'user');

        const finishReason = runState?.state?.stepResult?.reason ?? outputStream.finishReason;
        const hasErrored = runState.state.hasErrored;
        const usage = outputStream.usage;
        const responseMetadata = runState.state.responseMetadata;
        const text = outputStream.text;

        return {
          messageId,
          stepResult: {
            reason: hasErrored ? 'error' : finishReason,
            warnings,
            isContinued: !['stop', 'error'].includes(finishReason),
          },
          metadata: {
            providerMetadata: providerMetadata,
            ...responseMetadata,
            headers: rawResponse?.headers,
            request,
          },
          output: {
            text,
            toolCalls,
            usage: usage ?? inputData.output?.usage,
            steps: outputStream.aisdk.v5.steps,
          },
          messages: {
            all: allMessages,
            user: userMessages,
            nonUser: nonUserMessages,
          },
        };
      },
    });
  }

  function llmMappingStep() {
    return createStep({
      id: 'llmExecutionMappingStep',
      inputSchema: z.array(toolCallOutputSchema),
      outputSchema: llmIterationOutputSchema,
      execute: async ({ inputData, getStepResult, bail }) => {
        const initialResult = getStepResult(llmExecutionStep);

        const messageList = MessageList.fromArray(initialResult.messages.all || []);

        if (inputData?.every(toolCall => toolCall?.result === undefined)) {
          initialResult.stepResult.isContinued = false;
          return bail(initialResult);
        }

        if (inputData?.length) {
          for (const toolCall of inputData) {
            const chunk = {
              type: 'tool-result',
              runId: runId,
              from: 'AGENT',
              payload: {
                args: toolCall.args,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                result: toolCall.result,
                providerMetadata: toolCall.providerMetadata,
              },
            };

            controller.enqueue(chunk);

            if (model.specificationVersion === 'v1') {
              await options?.onChunk?.(
                convertFullStreamChunkToAISDKv4({
                  chunk,
                  client: false,
                  sendReasoning: true,
                  sendSources: true,
                  sendUsage: true,
                  getErrorMessage: (error: string) => error,
                }),
              );
            } else if (model.specificationVersion === 'v2') {
              await options?.onChunk?.({
                chunk: convertFullStreamChunkToAISDKv5({
                  chunk,
                  sendReasoning: true,
                  sendSources: true,
                  sendUsage: true,
                  getErrorMessage: (error: string) => error,
                }),
              } as any);
            }
          }

          const toolResultMessageId = experimental_generateMessageId?.() || _internal?.generateId?.();

          messageList.add(
            {
              id: toolResultMessageId,
              role: 'tool',
              content: inputData.map(toolCall => {
                return {
                  type: 'tool-result',
                  args: toolCall.args,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: toolCall.result,
                };
              }),
            },
            'response',
          );
        }

        return {
          ...initialResult,
          messages: {
            all: messageList.get.all.v1().map(message => {
              return {
                id: message.id,
                role: message.role,
                content: message.content,
              };
            }),
            user: messageList.get.all
              .v1()
              .filter(message => message.role === 'user')
              .map(message => {
                return {
                  id: message.id,
                  role: message.role,
                  content: message.content,
                };
              }),
            nonUser: messageList.get.all
              .v1()
              .filter(message => message.role !== 'user')
              .map(message => {
                return {
                  id: message.id,
                  role: message.role,
                  content: message.content,
                };
              }),
          },
        };
      },
    });
  }

  const llmExecutionStep = createLLMExecutionStep();
  const toolCallExecutionStep = toolCallStep();
  const llmExecutionMappingStep = llmMappingStep();

  return createWorkflow({
    id: 'executionWorkflow',
    inputSchema: llmIterationOutputSchema,
    outputSchema: z.any(),
  })
    .then(llmExecutionStep)
    .map(({ inputData }) => {
      if (doStreamSpan && experimental_telemetry?.recordOutputs !== false && inputData.output.toolCalls?.length) {
        doStreamSpan.setAttribute('stream.response.toolCalls', JSON.stringify(inputData.output.toolCalls));
      }
      return inputData.output.toolCalls || [];
    })
    .foreach(toolCallExecutionStep)
    .then(llmExecutionMappingStep)
    .commit();
}

function createStreamExecutor({
  _internal,
  experimental_generateMessageId,
  model,
  runId,
  providerMetadata,
  tools,
  toolChoice = 'auto',
  inputMessages,
  options,
  maxRetries = 2,
  stopWhen,
  maxSteps = 5,
  logger,
  experimental_telemetry,
  modelSettings = {
    maxRetries: 2,
  },
  headers,
  startTimestamp,
}: StreamExecutorProps) {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const messageId = experimental_generateMessageId?.() || _internal?.generateId?.();

      let stepCount = 1;

      const tracer = getTracer({
        isEnabled: experimental_telemetry?.isEnabled,
        tracer: experimental_telemetry?.tracer,
      });

      const baseTelemetryAttributes = getBaseTelemetryAttributes({
        model,
        settings: modelSettings ?? {},
        telemetry: experimental_telemetry,
        headers,
      });

      const rootSpan = tracer.startSpan('mastra.stream.aisdk.doStream').setAttributes({
        ...baseTelemetryAttributes,
        ...assembleOperationName({
          operationId: 'mastra.stream.aisdk.doStream',
          telemetry: experimental_telemetry,
        }),
        ...(experimental_telemetry?.recordInputs !== false
          ? {
              'stream.prompt.toolChoice': toolChoice as string,
            }
          : {}),
      });

      const outerAgentWorkflow = createAgentWorkflow({
        messageId: messageId!,
        model,
        runId,
        providerMetadata,
        tools,
        toolChoice,
        inputMessages,
        _internal,
        experimental_generateMessageId,
        experimental_telemetry,
        controller,
        options,
        logger,
        doStreamSpan: rootSpan,
      });

      const mainWorkflow = createWorkflow({
        id: 'agentic-loop',
        inputSchema: llmIterationOutputSchema,
        outputSchema: z.any(),
        retryConfig: {
          attempts: maxRetries,
        },
      })
        .dowhile(outerAgentWorkflow, async ({ inputData }) => {
          stepCount++;
          let hasFinishedSteps = stepCount >= maxSteps;

          if (stopWhen) {
            console.log('stop_when', JSON.stringify(inputData.output.steps, null, 2));
            const conditions = await Promise.all(
              (Array.isArray(stopWhen) ? stopWhen : [stopWhen]).map(condition => {
                return condition({
                  steps: inputData.output.steps,
                });
              }),
            );

            const hasStopped = conditions.some(condition => condition);
            hasFinishedSteps = hasStopped;
          }

          inputData.stepResult.isContinued = hasFinishedSteps ? false : inputData.stepResult.isContinued;

          controller.enqueue({
            type: 'step-finish',
            runId,
            from: 'AGENT',
            payload: inputData,
          });

          rootSpan.setAttributes({
            'stream.response.id': inputData.metadata.id,
            'stream.response.model': model.modelId,
            ...(inputData.metadata.providerMetadata
              ? { 'stream.response.providerMetadata': JSON.stringify(inputData.metadata.providerMetadata) }
              : {}),
            'stream.response.finishReason': inputData.stepResult.reason,
            'stream.usage.inputTokens': inputData.output.usage?.inputTokens,
            'stream.usage.outputTokens': inputData.output.usage?.outputTokens,
            'stream.usage.totalTokens': inputData.output.usage?.totalTokens,
            ...(experimental_telemetry?.recordOutputs !== false
              ? {
                  'stream.response.text': inputData.output.text,
                  'stream.prompt.messages': JSON.stringify(
                    inputData.messages.user.map((message: MastraMessageV1) => ({
                      role: message.role,
                      content: message.content,
                    })),
                  ),
                }
              : {}),
          });

          rootSpan.end();

          const reason = inputData.stepResult.reason;

          if (reason === undefined) {
            return false;
          }

          return inputData.stepResult.isContinued && stepCount <= maxSteps;
        })
        .map(({ inputData }) => {
          const toolCalls = inputData.messages.nonUser.filter((message: any) => message.role === 'tool');
          const hasFinishedSteps = stepCount >= maxSteps;

          inputData.stepResult.isContinued = hasFinishedSteps ? false : inputData.stepResult.isContinued;
          inputData.output.toolCalls = toolCalls;

          return inputData;
        })

        .commit();

      const msToFirstChunk = _internal?.now?.()! - startTimestamp!;

      rootSpan.addEvent('ai.stream.firstChunk', {
        'ai.response.msToFirstChunk': msToFirstChunk,
      });

      rootSpan.setAttributes({
        'stream.response.timestamp': new Date(startTimestamp).toISOString(),
        'stream.response.msToFirstChunk': msToFirstChunk,
      });

      controller.enqueue({
        type: 'start',
        runId,
        from: 'AGENT',
        payload: {},
      });

      const run = await mainWorkflow.createRunAsync({
        runId,
      });

      const executionResult = await run.start({
        inputData: {
          messageId: messageId!,
          messages: {
            all: inputMessages,
            user: inputMessages,
            nonUser: [],
          },
        },
      });

      if (executionResult.status !== 'success') {
        controller.close();
        return;
      }

      controller.enqueue({
        type: 'finish',
        runId,
        from: 'AGENT',
        payload: executionResult.result,
      });

      const msToFinish = (_internal?.now?.() ?? Date.now()) - startTimestamp;
      rootSpan.addEvent('ai.stream.finish');
      rootSpan.setAttributes({
        'stream.response.msToFinish': msToFinish,
        'stream.response.avgOutputTokensPerSecond':
          (1000 * (executionResult?.result?.output?.usage?.outputTokens ?? 0)) / msToFinish,
      });

      controller.close();
    },
  });
}

export async function execute(
  props: { type?: 'stream' | 'generate'; system?: string; prompt?: string } & {
    resourceId?: string;
    threadId?: string;
  } & Omit<StreamExecutorProps, 'inputMessages' | 'startTimestamp'>,
) {
  const { system, prompt, resourceId, threadId, runId, _internal, logger, type = 'stream', ...rest } = props;

  let loggerToUse =
    logger ||
    new ConsoleLogger({
      level: 'debug',
    });

  let runIdToUse = runId;

  if (!runIdToUse) {
    runIdToUse = crypto.randomUUID();
  }

  const messageList = new MessageList({
    threadId,
    resourceId,
  });

  if (system) {
    messageList.addSystem(system);
  }

  if (prompt) {
    messageList.add(prompt, 'user');
  }

  const messages = messageList.get.all.core() as LanguageModelV1Prompt;

  let _internalToUse = _internal
    ? {
        currentDate: _internal.currentDate || (() => new Date()),
        now: _internal.now || (() => Date.now()),
        generateId: _internal.generateId || generateId,
      }
    : {
        currentDate: () => new Date(),
        now: () => Date.now(),
        generateId,
      };

  let startTimestamp = _internalToUse?.now?.();

  // We call this for no reason because of aisdk
  if (rest.model.specificationVersion === 'v1') {
    _internalToUse.generateId?.();
  }

  // Always use streaming approach with MastraModelOutput
  const streamExecutorProps: StreamExecutorProps = {
    runId,
    _internal: _internalToUse,
    inputMessages: messages,
    logger: loggerToUse,
    startTimestamp: startTimestamp!,
    ...rest,
  };

  const tracer = getTracer({
    isEnabled: rest.experimental_telemetry?.isEnabled,
    tracer: rest.experimental_telemetry?.tracer,
  });

  const baseTelemetryAttributes = getBaseTelemetryAttributes({
    model: {
      modelId: rest.model.modelId,
      provider: rest.model.provider,
    },
    settings: rest.modelSettings ?? {
      maxRetries: 2,
    },
    telemetry: rest.experimental_telemetry,
    headers: rest.headers,
  });

  const rootSpan = tracer.startSpan('mastra.stream').setAttributes({
    ...baseTelemetryAttributes,
    ...assembleOperationName({
      operationId: 'mastra.stream',
      telemetry: rest.experimental_telemetry,
    }),
    ...(rest.experimental_telemetry?.recordOutputs !== false
      ? { 'stream.prompt.messages': JSON.stringify(messages) }
      : {}),
  });

  const executor = createStreamExecutor({
    ...streamExecutorProps,
    startTimestamp: startTimestamp!,
  });

  const output = new MastraModelOutput({
    model: {
      modelId: rest.model.modelId,
      provider: rest.model.provider,
      version: rest.model.specificationVersion,
    },
    stream: executor,
    options: {
      experimental_telemetry: rest.experimental_telemetry,
      rootSpan,
      toolCallStreaming: rest.toolCallStreaming,
      onFinish: rest.options?.onFinish,
      onStepFinish: rest.options?.onStepFinish,
    },
  });

  if (type === 'stream') {
    return output;
  } else if (type === 'generate') {
    return output._getGenerateOutput();
  } else {
    throw new Error(`Unsupported execution type: ${type}`);
  }
}

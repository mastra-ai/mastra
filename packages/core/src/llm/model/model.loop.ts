import {
  AnthropicSchemaCompatLayer,
  applyCompatLayer,
  DeepSeekSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  MetaSchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
} from '@mastra/schema-compat';
import { stepCountIs } from 'ai-v5';
import type { Schema, ModelMessage, ToolSet } from 'ai-v5';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import type { MastraPrimitives } from '../../action';
import { MastraBase } from '../../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { loop } from '../../loop';
import type { LoopOptions } from '../../loop/types';
import type { Mastra } from '../../mastra';
import { SpanType } from '../../observability';
import type { MastraModelOutput } from '../../stream/base/output';
import type { OutputSchema } from '../../stream/base/schema';
import type { ModelManagerModelConfig } from '../../stream/types';
import { delay } from '../../utils';

import type { ModelLoopStreamArgs } from './model.loop.types';
import type { MastraModelOptions } from './shared.types';

export class MastraLLMVNext extends MastraBase {
  #models: ModelManagerModelConfig[];
  #mastra?: Mastra;
  #options?: MastraModelOptions;
  #firstModel: ModelManagerModelConfig;

  constructor({
    mastra,
    models,
    options,
  }: {
    mastra?: Mastra;
    models: ModelManagerModelConfig[];
    options?: MastraModelOptions;
  }) {
    super({ name: 'aisdk' });

    this.#options = options;

    if (mastra) {
      this.#mastra = mastra;
      if (mastra.getLogger()) {
        this.__setLogger(this.#mastra.getLogger());
      }
    }

    if (models.length === 0 || !models[0]) {
      const mastraError = new MastraError({
        id: 'LLM_LOOP_MODELS_EMPTY',
        domain: ErrorDomain.LLM,
        category: ErrorCategory.USER,
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    } else {
      this.#models = models;
      this.#firstModel = models[0];
    }
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.logger) {
      this.__setLogger(p.logger);
    }
  }

  __registerMastra(p: Mastra) {
    this.#mastra = p;
  }

  getProvider() {
    return this.#firstModel.model.provider;
  }

  getModelId() {
    return this.#firstModel.model.modelId;
  }

  getModel() {
    return this.#firstModel.model;
  }

  private _applySchemaCompat(schema: OutputSchema): Schema {
    const model = this.#firstModel.model;

    const schemaCompatLayers = [];

    if (model) {
      const modelInfo = {
        modelId: model.modelId,
        supportsStructuredOutputs: true,
        provider: model.provider,
      };
      schemaCompatLayers.push(
        new OpenAIReasoningSchemaCompatLayer(modelInfo),
        new OpenAISchemaCompatLayer(modelInfo),
        new GoogleSchemaCompatLayer(modelInfo),
        new AnthropicSchemaCompatLayer(modelInfo),
        new DeepSeekSchemaCompatLayer(modelInfo),
        new MetaSchemaCompatLayer(modelInfo),
      );
    }

    return applyCompatLayer({
      schema: schema as any,
      compatLayers: schemaCompatLayers,
      mode: 'aiSdkSchema',
    }) as unknown as Schema<ZodSchema | JSONSchema7>;
  }

  convertToMessages(messages: string | string[] | ModelMessage[]): ModelMessage[] {
    if (Array.isArray(messages)) {
      return messages.map(m => {
        if (typeof m === 'string') {
          return {
            role: 'user',
            content: m,
          };
        }
        return m;
      });
    }

    return [
      {
        role: 'user',
        content: messages,
      },
    ];
  }

  stream<Tools extends ToolSet, OUTPUT extends OutputSchema | undefined = undefined>({
    resumeContext,
    runId,
    stopWhen = stepCountIs(5),
    maxSteps,
    tools = {} as Tools,
    modelSettings,
    toolChoice = 'auto',
    threadId,
    resourceId,
    structuredOutput,
    options,
    outputProcessors,
    returnScorerData,
    providerOptions,
    tracingContext,
    messageList,
    requireToolApproval,
    _internal,
    agentId,
    toolCallId,
    methodType,
  }: ModelLoopStreamArgs<Tools, OUTPUT>): MastraModelOutput<OUTPUT> {
    let stopWhenToUse;

    if (maxSteps && typeof maxSteps === 'number') {
      stopWhenToUse = stepCountIs(maxSteps);
    } else {
      stopWhenToUse = stopWhen;
    }

    const messages = messageList.get.all.aiV5.model();

    const firstModel = this.#firstModel.model;
    this.logger.debug(`[LLM] - Streaming text`, {
      runId,
      threadId,
      resourceId,
      messages,
      tools: Object.keys(tools || {}),
    });

    const modelSpan = tracingContext?.currentSpan?.createChildSpan({
      name: `llm: '${firstModel.modelId}'`,
      type: SpanType.MODEL_GENERATION,
      input: {
        messages: [...messageList.getSystemMessages(), ...messages],
      },
      attributes: {
        model: firstModel.modelId,
        provider: firstModel.provider,
        streaming: true,
        parameters: modelSettings,
      },
      metadata: {
        runId,
        threadId,
        resourceId,
      },
      tracingPolicy: this.#options?.tracingPolicy,
    });

    // Create model span tracker that will be shared across all LLM execution steps
    const modelSpanTracker = modelSpan?.createTracker();

    try {
      const loopOptions: LoopOptions<Tools, OUTPUT> = {
        mastra: this.#mastra,
        resumeContext,
        runId,
        toolCallId,
        messageList,
        models: this.#models,
        tools: tools as Tools,
        stopWhen: stopWhenToUse,
        toolChoice,
        modelSettings,
        providerOptions,
        _internal,
        structuredOutput,
        outputProcessors,
        returnScorerData,
        modelSpanTracker,
        requireToolApproval,
        agentId,
        methodType,
        options: {
          ...options,
          onStepFinish: async props => {
            try {
              await options?.onStepFinish?.({ ...props, runId: runId! });
            } catch (e: unknown) {
              const mastraError = new MastraError(
                {
                  id: 'LLM_STREAM_ON_STEP_FINISH_CALLBACK_EXECUTION_FAILED',
                  domain: ErrorDomain.LLM,
                  category: ErrorCategory.USER,
                  details: {
                    modelId: props.model?.modelId as string,
                    modelProvider: props.model?.provider as string,
                    runId: runId ?? 'unknown',
                    threadId: threadId ?? 'unknown',
                    resourceId: resourceId ?? 'unknown',
                    finishReason: props?.finishReason as string,
                    toolCalls: props?.toolCalls ? JSON.stringify(props.toolCalls) : '',
                    toolResults: props?.toolResults ? JSON.stringify(props.toolResults) : '',
                    usage: props?.usage ? JSON.stringify(props.usage) : '',
                  },
                },
                e,
              );
              modelSpanTracker?.reportGenerationError({ error: mastraError });
              this.logger.trackException(mastraError);
              throw mastraError;
            }

            this.logger.debug('[LLM] - Stream Step Change:', {
              text: props?.text,
              toolCalls: props?.toolCalls,
              toolResults: props?.toolResults,
              finishReason: props?.finishReason,
              usage: props?.usage,
              runId,
            });

            if (
              props?.response?.headers?.['x-ratelimit-remaining-tokens'] &&
              parseInt(props?.response?.headers?.['x-ratelimit-remaining-tokens'], 10) < 2000
            ) {
              this.logger.warn('Rate limit approaching, waiting 10 seconds', { runId });
              await delay(10 * 1000);
            }
          },

          onFinish: async props => {
            // End the model generation span BEFORE calling the user's onFinish callback
            // This ensures the model span ends before the agent span
            modelSpanTracker?.endGeneration({
              output: {
                files: props?.files,
                object: props?.object,
                reasoning: props?.reasoning,
                reasoningText: props?.reasoningText,
                sources: props?.sources,
                text: props?.text,
                warnings: props?.warnings,
              },
              attributes: {
                finishReason: props?.finishReason,
                usage: {
                  inputTokens: props?.totalUsage?.inputTokens,
                  outputTokens: props?.totalUsage?.outputTokens,
                  totalTokens: props?.totalUsage?.totalTokens,
                  reasoningTokens: props?.totalUsage?.reasoningTokens,
                  cachedInputTokens: props?.totalUsage?.cachedInputTokens,
                },
              },
            });

            try {
              await options?.onFinish?.({ ...props, runId: runId! });
            } catch (e: unknown) {
              const mastraError = new MastraError(
                {
                  id: 'LLM_STREAM_ON_FINISH_CALLBACK_EXECUTION_FAILED',
                  domain: ErrorDomain.LLM,
                  category: ErrorCategory.USER,
                  details: {
                    modelId: props.model?.modelId as string,
                    modelProvider: props.model?.provider as string,
                    runId: runId ?? 'unknown',
                    threadId: threadId ?? 'unknown',
                    resourceId: resourceId ?? 'unknown',
                    finishReason: props?.finishReason as string,
                    toolCalls: props?.toolCalls ? JSON.stringify(props.toolCalls) : '',
                    toolResults: props?.toolResults ? JSON.stringify(props.toolResults) : '',
                    usage: props?.usage ? JSON.stringify(props.usage) : '',
                  },
                },
                e,
              );
              modelSpanTracker?.reportGenerationError({ error: mastraError });
              this.logger.trackException(mastraError);
              throw mastraError;
            }

            this.logger.debug('[LLM] - Stream Finished:', {
              text: props?.text,
              toolCalls: props?.toolCalls,
              toolResults: props?.toolResults,
              finishReason: props?.finishReason,
              usage: props?.usage,
              runId,
              threadId,
              resourceId,
            });
          },
        },
      };

      return loop(loopOptions);
    } catch (e: unknown) {
      const mastraError = new MastraError(
        {
          id: 'LLM_STREAM_TEXT_AI_SDK_EXECUTION_FAILED',
          domain: ErrorDomain.LLM,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            modelId: firstModel.modelId,
            modelProvider: firstModel.provider,
            runId: runId ?? 'unknown',
            threadId: threadId ?? 'unknown',
            resourceId: resourceId ?? 'unknown',
          },
        },
        e,
      );
      modelSpanTracker?.reportGenerationError({ error: mastraError });
      throw mastraError;
    }
  }
}

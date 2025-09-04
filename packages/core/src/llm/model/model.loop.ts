import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
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
import { MessageList } from '../../agent';
import { AISpanType } from '../../ai-tracing';
import { MastraBase } from '../../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { loop } from '../../loop';
import type { LoopOptions } from '../../loop/types';
import type { Mastra } from '../../mastra';
import type { MastraModelOutput } from '../../stream/base/output';
import type { OutputSchema } from '../../stream/base/schema';
import { delay } from '../../utils';

import type { ModelLoopStreamArgs } from './model.loop.types';

export class MastraLLMVNext extends MastraBase {
  #model: LanguageModelV2;
  #mastra?: Mastra;

  constructor({ model, mastra }: { model: LanguageModelV2; mastra?: Mastra }) {
    super({ name: 'aisdk' });

    this.#model = model;

    if (mastra) {
      this.#mastra = mastra;
      if (mastra.getLogger()) {
        this.__setLogger(this.#mastra.getLogger());
      }
    }
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }
  }

  __registerMastra(p: Mastra) {
    this.#mastra = p;
  }

  getProvider() {
    return this.#model.provider;
  }

  getModelId() {
    return this.#model.modelId;
  }

  getModel() {
    return this.#model;
  }

  private _applySchemaCompat(schema: OutputSchema): Schema {
    const model = this.#model;

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
    messages,
    stopWhen = stepCountIs(5),
    maxSteps,
    tools = {} as Tools,
    runId,
    modelSettings,
    toolChoice = 'auto',
    telemetry_settings,
    threadId,
    resourceId,
    output,
    options,
    outputProcessors,
    returnScorerData,
    providerOptions,
    tracingContext,
    // ...rest
  }: ModelLoopStreamArgs<Tools, OUTPUT>): MastraModelOutput<OUTPUT | undefined> {
    let stopWhenToUse;

    if (maxSteps && typeof maxSteps === 'number') {
      stopWhenToUse = stepCountIs(maxSteps);
    } else {
      stopWhenToUse = stopWhen;
    }

    const model = this.#model;
    this.logger.debug(`[LLM] - Streaming text`, {
      runId,
      threadId,
      resourceId,
      messages,
      tools: Object.keys(tools || {}),
    });

    if (output) {
      output = this._applySchemaCompat(output) as any; // TODO: types for schema compat
    }

    const llmAISpan = tracingContext?.currentSpan?.createChildSpan({
      name: `llm stream: '${model.modelId}'`,
      type: AISpanType.LLM_GENERATION,
      input: messages,
      attributes: {
        model: model.modelId,
        provider: model.provider,
        streaming: true,
      },
      metadata: {
        threadId,
        resourceId,
      },
    });

    try {
      const messageList = new MessageList({
        threadId,
        resourceId,
      });
      messageList.add(messages, 'input');

      const loopOptions: LoopOptions<Tools, OUTPUT> = {
        messageList,
        model: this.#model,
        tools: tools as Tools,
        stopWhen: stopWhenToUse,
        toolChoice,
        modelSettings,
        providerOptions,
        telemetry_settings: {
          ...this.experimental_telemetry,
          ...telemetry_settings,
        },
        output,
        outputProcessors,
        returnScorerData,
        llmAISpan,
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
                    modelId: model.modelId,
                    modelProvider: model.provider,
                    runId: runId ?? 'unknown',
                    threadId: threadId ?? 'unknown',
                    resourceId: resourceId ?? 'unknown',
                    finishReason: props?.finishReason,
                    toolCalls: props?.toolCalls ? JSON.stringify(props.toolCalls) : '',
                    toolResults: props?.toolResults ? JSON.stringify(props.toolResults) : '',
                    usage: props?.usage ? JSON.stringify(props.usage) : '',
                  },
                },
                e,
              );
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
            try {
              await options?.onFinish?.({ ...props, runId: runId! });
            } catch (e: unknown) {
              const mastraError = new MastraError(
                {
                  id: 'LLM_STREAM_ON_FINISH_CALLBACK_EXECUTION_FAILED',
                  domain: ErrorDomain.LLM,
                  category: ErrorCategory.USER,
                  details: {
                    modelId: model.modelId,
                    modelProvider: model.provider,
                    runId: runId ?? 'unknown',
                    threadId: threadId ?? 'unknown',
                    resourceId: resourceId ?? 'unknown',
                    finishReason: props?.finishReason,
                    toolCalls: props?.toolCalls ? JSON.stringify(props.toolCalls) : '',
                    toolResults: props?.toolResults ? JSON.stringify(props.toolResults) : '',
                    usage: props?.usage ? JSON.stringify(props.usage) : '',
                  },
                },
                e,
              );
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

      const result = loop(loopOptions);
      llmAISpan?.end({ output: result });
      return result;
    } catch (e: unknown) {
      const mastraError = new MastraError(
        {
          id: 'LLM_STREAM_TEXT_AI_SDK_EXECUTION_FAILED',
          domain: ErrorDomain.LLM,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            modelId: model.modelId,
            modelProvider: model.provider,
            runId: runId ?? 'unknown',
            threadId: threadId ?? 'unknown',
            resourceId: resourceId ?? 'unknown',
          },
        },
        e,
      );
      llmAISpan?.error({ error: mastraError });
      throw mastraError;
    }
  }
}

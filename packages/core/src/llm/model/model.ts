import {
  AnthropicSchemaCompatLayer,
  applyCompatLayer,
  DeepSeekSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  MetaSchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
} from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import type { CoreMessage, LanguageModel, Schema, StreamObjectOnFinishCallback, StreamTextOnFinishCallback } from 'ai';
import { generateObject, generateText, jsonSchema, Output, streamObject, streamText } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import type { MastraPrimitives } from '../../action';
import { AISpanType } from '../../ai-tracing';
import { MastraBase } from '../../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { Mastra } from '../../mastra';
import { delay, isZodType } from '../../utils';

import type {
  GenerateObjectWithMessagesArgs,
  GenerateTextResult,
  GenerateObjectResult,
  GenerateTextWithMessagesArgs,
  OriginalGenerateTextOptions,
  ToolSet,
  GenerateReturn,
  OriginalGenerateObjectOptions,
  StreamTextWithMessagesArgs,
  StreamTextResult,
  OriginalStreamTextOptions,
  StreamObjectWithMessagesArgs,
  OriginalStreamObjectOptions,
  StreamObjectResult,
  StreamReturn,
} from './base.types';
import type { inferOutput, MastraModelOptions } from './shared.types';

export class MastraLLMV1 extends MastraBase {
  #model: LanguageModel;
  #mastra?: Mastra;
  #options?: MastraModelOptions;

  constructor({ model, mastra, options }: { model: LanguageModel; mastra?: Mastra; options?: MastraModelOptions }) {
    super({ name: 'aisdk' });

    this.#model = model;
    this.#options = options;

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

  private _applySchemaCompat(schema: ZodSchema | JSONSchema7): Schema {
    const model = this.#model;

    const schemaCompatLayers = [];

    if (model) {
      const modelInfo = {
        modelId: model.modelId,
        supportsStructuredOutputs: model.supportsStructuredOutputs ?? false,
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
    });
  }

  async __text<Tools extends ToolSet, Z extends ZodSchema | JSONSchema7 | undefined>({
    runId,
    messages,
    maxSteps = 5,
    tools = {},
    temperature,
    toolChoice = 'auto',
    onStepFinish,
    experimental_output,
    telemetry,
    threadId,
    resourceId,
    runtimeContext,
    tracingContext,
    ...rest
  }: GenerateTextWithMessagesArgs<Tools, Z>): Promise<GenerateTextResult<Tools, Z>> {
    const model = this.#model;

    this.logger.debug(`[LLM] - Generating text`, {
      runId,
      messages,
      maxSteps,
      threadId,
      resourceId,
      tools: Object.keys(tools),
    });

    let schema: z.ZodType<inferOutput<Z>> | Schema<inferOutput<Z>> | undefined = undefined;

    if (experimental_output) {
      this.logger.debug('[LLM] - Using experimental output', {
        runId,
      });

      if (isZodType(experimental_output)) {
        schema = experimental_output as z.ZodType<inferOutput<Z>>;
        if (schema instanceof z.ZodArray) {
          schema = schema._def.type as z.ZodType<inferOutput<Z>>;
        }

        let jsonSchemaToUse;
        jsonSchemaToUse = zodToJsonSchema(schema, 'jsonSchema7') as JSONSchema7;

        schema = jsonSchema(jsonSchemaToUse) as Schema<inferOutput<Z>>;
      } else {
        schema = jsonSchema(experimental_output as JSONSchema7) as Schema<inferOutput<Z>>;
      }
    }

    const llmSpan = tracingContext.currentSpan?.createChildSpan({
      name: `llm: '${model.modelId}'`,
      type: AISpanType.LLM_GENERATION,
      input: {
        messages,
        schema,
      },
      attributes: {
        model: model.modelId,
        provider: model.provider,
        parameters: {
          temperature,
          maxOutputTokens: rest.maxTokens,
          topP: rest.topP,
          frequencyPenalty: rest.frequencyPenalty,
          presencePenalty: rest.presencePenalty,
        },
        streaming: false,
      },
      metadata: {
        runId,
        threadId,
        resourceId,
      },
      tracingPolicy: this.#options?.tracingPolicy,
    });

    const argsForExecute: OriginalGenerateTextOptions<Tools, Z> = {
      ...rest,
      messages,
      model,
      temperature,
      tools: {
        ...(tools as Tools),
      },
      toolChoice,
      maxSteps,
      onStepFinish: async props => {
        try {
          await onStepFinish?.({ ...props, runId: runId! });
        } catch (e: unknown) {
          const mastraError = new MastraError(
            {
              id: 'LLM_TEXT_ON_STEP_FINISH_CALLBACK_EXECUTION_FAILED',
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
          throw mastraError;
        }

        this.logger.debug('[LLM] - Text Step Change:', {
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
      experimental_telemetry: {
        ...this.experimental_telemetry,
        ...telemetry,
      },
      experimental_output: schema
        ? Output.object({
            schema,
          })
        : undefined,
    };

    try {
      const result: GenerateTextResult<Tools, Z> = await generateText(argsForExecute);

      if (schema && result.finishReason === 'stop') {
        result.object = (result as any).experimental_output;
      }
      llmSpan?.end({
        output: {
          text: result.text,
          object: result.object,
          reasoning: result.reasoningDetails,
          reasoningText: result.reasoning,
          files: result.files,
          sources: result.sources,
          warnings: result.warnings,
        },
        attributes: {
          finishReason: result.finishReason,
          usage: result.usage,
        },
      });

      return result;
    } catch (e: unknown) {
      const mastraError = new MastraError(
        {
          id: 'LLM_GENERATE_TEXT_AI_SDK_EXECUTION_FAILED',
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
      llmSpan?.error({ error: mastraError });
      throw mastraError;
    }
  }

  async __textObject<Z extends ZodSchema | JSONSchema7>({
    messages,
    structuredOutput,
    runId,
    telemetry,
    threadId,
    resourceId,
    runtimeContext,
    tracingContext,
    ...rest
  }: GenerateObjectWithMessagesArgs<Z>): Promise<GenerateObjectResult<Z>> {
    const model = this.#model;

    this.logger.debug(`[LLM] - Generating a text object`, { runId });

    const llmSpan = tracingContext.currentSpan?.createChildSpan({
      name: `llm: '${model.modelId}'`,
      type: AISpanType.LLM_GENERATION,
      input: {
        messages,
      },
      attributes: {
        model: model.modelId,
        provider: model.provider,
        parameters: {
          temperature: rest.temperature,
          maxOutputTokens: rest.maxTokens,
          topP: rest.topP,
          frequencyPenalty: rest.frequencyPenalty,
          presencePenalty: rest.presencePenalty,
        },
        streaming: false,
      },
      metadata: {
        runId,
        threadId,
        resourceId,
      },
      tracingPolicy: this.#options?.tracingPolicy,
    });

    try {
      let output: 'object' | 'array' = 'object';
      if (structuredOutput instanceof z.ZodArray) {
        output = 'array';
        structuredOutput = structuredOutput._def.type;
      }

      const processedSchema = this._applySchemaCompat(structuredOutput!);
      llmSpan?.update({
        input: {
          messages,
          schema: processedSchema,
        },
      });

      const argsForExecute: OriginalGenerateObjectOptions<Z> = {
        ...rest,
        messages,
        model,
        // @ts-expect-error - output in our implementation can only be object or array
        output,
        schema: processedSchema as Schema<Z>,
        experimental_telemetry: {
          ...this.experimental_telemetry,
          ...telemetry,
        },
      };

      try {
        // @ts-expect-error - output in our implementation can only be object or array
        const result = await generateObject(argsForExecute);

        llmSpan?.end({
          output: {
            object: result.object,
            warnings: result.warnings,
          },
          attributes: {
            finishReason: result.finishReason,
            usage: result.usage,
          },
        });

        // @ts-expect-error - output in our implementation can only be object or array
        return result;
      } catch (e: unknown) {
        const mastraError = new MastraError(
          {
            id: 'LLM_GENERATE_OBJECT_AI_SDK_EXECUTION_FAILED',
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
        llmSpan?.error({ error: mastraError });
        throw mastraError;
      }
    } catch (e: unknown) {
      if (e instanceof MastraError) {
        throw e;
      }

      const mastraError = new MastraError(
        {
          id: 'LLM_GENERATE_OBJECT_AI_SDK_SCHEMA_CONVERSION_FAILED',
          domain: ErrorDomain.LLM,
          category: ErrorCategory.USER,
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
      llmSpan?.error({ error: mastraError });
      throw mastraError;
    }
  }

  __stream<Tools extends ToolSet, Z extends ZodSchema | JSONSchema7 | undefined = undefined>({
    messages,
    onStepFinish,
    onFinish,
    maxSteps = 5,
    tools = {},
    runId,
    temperature,
    toolChoice = 'auto',
    experimental_output,
    telemetry,
    threadId,
    resourceId,
    runtimeContext,
    tracingContext,
    ...rest
  }: StreamTextWithMessagesArgs<Tools, Z>): StreamTextResult<Tools, Z> {
    const model = this.#model;
    this.logger.debug(`[LLM] - Streaming text`, {
      runId,
      threadId,
      resourceId,
      messages,
      maxSteps,
      tools: Object.keys(tools || {}),
    });

    let schema: z.ZodType<Z> | Schema<Z> | undefined;
    if (experimental_output) {
      this.logger.debug('[LLM] - Using experimental output', {
        runId,
      });
      if (typeof (experimental_output as any).parse === 'function') {
        schema = experimental_output as z.ZodType<Z>;
        if (schema instanceof z.ZodArray) {
          schema = schema._def.type as z.ZodType<Z>;
        }
      } else {
        schema = jsonSchema(experimental_output as JSONSchema7) as Schema<Z>;
      }
    }

    const llmSpan = tracingContext.currentSpan?.createChildSpan({
      name: `llm: '${model.modelId}'`,
      type: AISpanType.LLM_GENERATION,
      input: {
        messages,
      },
      attributes: {
        model: model.modelId,
        provider: model.provider,
        parameters: {
          temperature,
          maxOutputTokens: rest.maxTokens,
          topP: rest.topP,
          frequencyPenalty: rest.frequencyPenalty,
          presencePenalty: rest.presencePenalty,
        },
        streaming: true,
      },
      metadata: {
        runId,
        threadId,
        resourceId,
      },
      tracingPolicy: this.#options?.tracingPolicy,
    });

    const argsForExecute: OriginalStreamTextOptions<Tools, Z> = {
      model,
      temperature,
      tools: {
        ...(tools as Tools),
      },
      maxSteps,
      toolChoice,
      onStepFinish: async props => {
        try {
          await onStepFinish?.({ ...props, runId: runId! });
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
          llmSpan?.error({ error: mastraError });
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
          await onFinish?.({ ...props, runId: runId! });
          llmSpan?.end({
            output: {
              text: props?.text,
              reasoning: props?.reasoningDetails,
              reasoningText: props?.reasoning,
              files: props?.files,
              sources: props?.sources,
              warnings: props?.warnings,
            },
            attributes: {
              finishReason: props?.finishReason,
              usage: props?.usage,
            },
          });
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
          llmSpan?.error({ error: mastraError });
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
      ...rest,
      messages,
      experimental_telemetry: {
        ...this.experimental_telemetry,
        ...telemetry,
      },
      experimental_output: schema
        ? (Output.object({
            schema,
          }) as any)
        : undefined,
    };

    try {
      return streamText(argsForExecute);
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
      llmSpan?.error({ error: mastraError });
      throw mastraError;
    }
  }

  __streamObject<T extends ZodSchema | JSONSchema7>({
    messages,
    runId,
    runtimeContext,
    threadId,
    resourceId,
    onFinish,
    structuredOutput,
    telemetry,
    tracingContext,
    ...rest
  }: StreamObjectWithMessagesArgs<T>): StreamObjectResult<T> {
    const model = this.#model;
    this.logger.debug(`[LLM] - Streaming structured output`, {
      runId,
      messages,
    });

    const llmSpan = tracingContext.currentSpan?.createChildSpan({
      name: `llm: '${model.modelId}'`,
      type: AISpanType.LLM_GENERATION,
      input: {
        messages,
      },
      attributes: {
        model: model.modelId,
        provider: model.provider,
        parameters: {
          temperature: rest.temperature,
          maxOutputTokens: rest.maxTokens,
          topP: rest.topP,
          frequencyPenalty: rest.frequencyPenalty,
          presencePenalty: rest.presencePenalty,
        },
        streaming: true,
      },
      metadata: {
        runId,
        threadId,
        resourceId,
      },
      tracingPolicy: this.#options?.tracingPolicy,
    });

    try {
      let output: 'object' | 'array' = 'object';
      if (structuredOutput instanceof z.ZodArray) {
        output = 'array';
        structuredOutput = structuredOutput._def.type;
      }

      const processedSchema = this._applySchemaCompat(structuredOutput!);
      llmSpan?.update({
        input: {
          messages,
          schema: processedSchema,
        },
      });

      const argsForExecute: OriginalStreamObjectOptions<T> = {
        ...rest,
        model,
        onFinish: async (props: any) => {
          try {
            await onFinish?.({ ...props, runId: runId! });
            llmSpan?.end({
              output: {
                text: props?.text,
                object: props?.object,
                reasoning: props?.reasoningDetails,
                reasoningText: props?.reasoning,
                files: props?.files,
                sources: props?.sources,
                warnings: props?.warnings,
              },
              attributes: {
                finishReason: props?.finishReason,
                usage: props?.usage,
              },
            });
          } catch (e: unknown) {
            const mastraError = new MastraError(
              {
                id: 'LLM_STREAM_OBJECT_ON_FINISH_CALLBACK_EXECUTION_FAILED',
                domain: ErrorDomain.LLM,
                category: ErrorCategory.USER,
                details: {
                  modelId: model.modelId,
                  modelProvider: model.provider,
                  runId: runId ?? 'unknown',
                  threadId: threadId ?? 'unknown',
                  resourceId: resourceId ?? 'unknown',
                  toolCalls: '',
                  toolResults: '',
                  finishReason: '',
                  usage: props?.usage ? JSON.stringify(props.usage) : '',
                },
              },
              e,
            );
            this.logger.trackException(mastraError);
            llmSpan?.error({ error: mastraError });
            throw mastraError;
          }

          this.logger.debug('[LLM] - Object Stream Finished:', {
            usage: props?.usage,
            runId,
            threadId,
            resourceId,
          });
        },
        messages,
        // @ts-expect-error - output in our implementation can only be object or array
        output,
        experimental_telemetry: {
          ...this.experimental_telemetry,
          ...telemetry,
        },
        schema: processedSchema as Schema<inferOutput<T>>,
      };

      try {
        return streamObject(argsForExecute as any);
      } catch (e: unknown) {
        const mastraError = new MastraError(
          {
            id: 'LLM_STREAM_OBJECT_AI_SDK_EXECUTION_FAILED',
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
        llmSpan?.error({ error: mastraError });
        throw mastraError;
      }
    } catch (e: unknown) {
      if (e instanceof MastraError) {
        llmSpan?.error({ error: e });
        throw e;
      }

      const mastraError = new MastraError(
        {
          id: 'LLM_STREAM_OBJECT_AI_SDK_SCHEMA_CONVERSION_FAILED',
          domain: ErrorDomain.LLM,
          category: ErrorCategory.USER,
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
      llmSpan?.error({ error: mastraError });
      throw mastraError;
    }
  }

  convertToMessages(messages: string | string[] | CoreMessage[]): CoreMessage[] {
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

  async generate<
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    StructuredOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
    Tools extends ToolSet = ToolSet,
  >(
    messages: string | string[] | CoreMessage[],
    {
      output,
      ...rest
    }: Omit<
      Output extends undefined
        ? GenerateTextWithMessagesArgs<Tools, StructuredOutput>
        : Omit<GenerateObjectWithMessagesArgs<NonNullable<Output>>, 'structuredOutput' | 'output'>,
      'messages'
    > & { output?: Output },
  ): Promise<GenerateReturn<Tools, Output, StructuredOutput>> {
    const msgs = this.convertToMessages(messages);

    if (!output) {
      const { maxSteps, onStepFinish, ...textOptions } = rest as Omit<
        GenerateTextWithMessagesArgs<Tools, StructuredOutput>,
        'messages'
      >;
      return (await this.__text<Tools, StructuredOutput>({
        messages: msgs,
        maxSteps,
        onStepFinish,
        ...textOptions,
      })) as unknown as GenerateReturn<Tools, Output, StructuredOutput>;
    }

    return (await this.__textObject({
      messages: msgs,
      structuredOutput: output as NonNullable<Output>,
      ...rest,
    })) as unknown as GenerateReturn<Tools, Output, StructuredOutput>;
  }

  stream<
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    StructuredOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
    Tools extends ToolSet = ToolSet,
  >(
    messages: string | string[] | CoreMessage[],
    {
      maxSteps = 5,
      output,
      onFinish,
      ...rest
    }: Omit<
      Output extends undefined
        ? StreamTextWithMessagesArgs<Tools, StructuredOutput>
        : Omit<StreamObjectWithMessagesArgs<NonNullable<Output>>, 'structuredOutput' | 'output'> & { maxSteps?: never },
      'messages'
    > & { output?: Output },
  ): StreamReturn<Tools, Output, StructuredOutput> {
    const msgs = this.convertToMessages(messages);

    if (!output) {
      return this.__stream({
        messages: msgs,
        maxSteps,
        onFinish: onFinish as StreamTextOnFinishCallback<Tools> | undefined,
        ...rest,
      }) as unknown as StreamReturn<Tools, Output, StructuredOutput>;
    }

    return this.__streamObject({
      messages: msgs,
      structuredOutput: output as NonNullable<Output>,
      onFinish: onFinish as StreamObjectOnFinishCallback<inferOutput<Output>> | undefined,
      ...rest,
    }) as unknown as StreamReturn<Tools, Output, StructuredOutput>;
  }
}

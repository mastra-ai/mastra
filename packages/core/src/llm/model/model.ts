import {
  AnthropicSchemaCompatLayer,
  applyCompatLayer,
  DeepSeekSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  MetaSchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
} from '@mastra/schema-compat';
import type { CoreMessage, LanguageModel, Schema, StreamObjectOnFinishCallback, StreamTextOnFinishCallback } from 'ai';
import { generateObject, generateText, jsonSchema, Output, streamObject, streamText } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

import type { MastraPrimitives } from '../../action';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { Mastra } from '../../mastra';
import { delay } from '../../utils';

import { MastraLLMBase } from './base';
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
  inferOutput,
  StreamObjectWithMessagesArgs,
  OriginalStreamObjectOptions,
  StreamObjectResult,
  StreamReturn,
} from './base.types';

export class MastraLLM extends MastraLLMBase {
  #model: LanguageModel;
  #mastra?: Mastra;

  constructor({ model, mastra }: { model: LanguageModel; mastra?: Mastra }) {
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

  private _applySchemaCompat(schema: ZodSchema | JSONSchema7): Schema {
    const model = this.#model;

    const schemaCompatLayers = [];

    if (model) {
      schemaCompatLayers.push(
        new OpenAIReasoningSchemaCompatLayer(model),
        new OpenAISchemaCompatLayer(model),
        new GoogleSchemaCompatLayer(model),
        new AnthropicSchemaCompatLayer(model),
        new DeepSeekSchemaCompatLayer(model),
        new MetaSchemaCompatLayer(model),
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
      if (typeof (experimental_output as any).parse === 'function') {
        schema = experimental_output as z.ZodType<inferOutput<Z>>;
        if (schema instanceof z.ZodArray) {
          schema = schema._def.type as z.ZodType<inferOutput<Z>>;
        }
      } else {
        schema = jsonSchema(experimental_output as JSONSchema7) as Schema<inferOutput<Z>>;
      }
    }

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

        this.logger.debug('[LLM] - Step Change:', {
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
    ...rest
  }: GenerateObjectWithMessagesArgs<Z>): Promise<GenerateObjectResult<Z>> {
    const model = this.#model;

    this.logger.debug(`[LLM] - Generating a text object`, { runId });

    try {
      let output: 'object' | 'array' = 'object';
      if (structuredOutput instanceof z.ZodArray) {
        output = 'array';
        structuredOutput = structuredOutput._def.type;
      }

      const processedSchema = this._applySchemaCompat(structuredOutput!);

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
        return await generateObject(argsForExecute);
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
    ...rest
  }: StreamObjectWithMessagesArgs<T>): StreamObjectResult<T> {
    const model = this.#model;
    this.logger.debug(`[LLM] - Streaming structured output`, {
      runId,
      messages,
    });

    try {
      let output: 'object' | 'array' = 'object';
      if (structuredOutput instanceof z.ZodArray) {
        output = 'array';
        structuredOutput = structuredOutput._def.type;
      }

      const processedSchema = this._applySchemaCompat(structuredOutput!);

      const argsForExecute: OriginalStreamObjectOptions<T> = {
        ...rest,
        model,
        onFinish: async props => {
          try {
            // @ts-expect-error - onFinish is not infered correctly
            await onFinish?.({ ...props, runId: runId! });
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
            throw mastraError;
          }

          this.logger.debug('[LLM] - Stream Finished:', {
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
        throw mastraError;
      }
    } catch (e: unknown) {
      if (e instanceof MastraError) {
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
      throw mastraError;
    }
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

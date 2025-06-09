import {
  AnthropicSchemaCompatLayer,
  applyCompatLayer,
  DeepSeekSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  MetaSchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
} from '@mastra/schema-compat';
import type { CoreMessage, LanguageModel, Schema } from 'ai';
import { generateObject, generateText, jsonSchema, Output, streamObject, streamText } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

import type {
  GenerateReturn,
  LLMInnerStreamOptions,
  LLMStreamObjectOptions,
  LLMStreamOptions,
  LLMTextObjectOptions,
  LLMTextOptions,
  StreamReturn,
} from '../';
import type { MastraPrimitives } from '../../action';
import type { Mastra } from '../../mastra';
import type { MastraMemory } from '../../memory/memory';
import { delay } from '../../utils';

import { MastraLLMBase } from './base';

export class MastraLLM extends MastraLLMBase {
  #model: LanguageModel;
  #mastra?: Mastra;

  constructor({ model, mastra }: { model: LanguageModel; mastra?: Mastra }) {
    super({ name: 'aisdk', model });

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

  async __text<Z extends ZodSchema | JSONSchema7 | undefined>({
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
    memory,
    runtimeContext,
    ...rest
  }: LLMTextOptions<Z> & { memory?: MastraMemory }) {
    const model = this.#model;

    this.logger.debug(`[LLM] - Generating text`, {
      runId,
      messages,
      maxSteps,
      threadId,
      resourceId,
      tools: Object.keys(tools),
    });

    const argsForExecute = {
      model,
      temperature,
      tools: {
        ...tools,
      },
      toolChoice,
      maxSteps,
      onStepFinish: async (props: any) => {
        await onStepFinish?.(props);

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
      ...rest,
    };

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

    return await generateText({
      messages,
      ...argsForExecute,
      experimental_telemetry: {
        ...this.experimental_telemetry,
        ...telemetry,
      },
      experimental_output: schema
        ? Output.object({
            schema,
          })
        : undefined,
    });
  }

  async __textObject<T extends ZodSchema | JSONSchema7 | undefined>({
    messages,
    onStepFinish,
    maxSteps = 5,
    tools = {},
    structuredOutput,
    runId,
    temperature,
    toolChoice = 'auto',
    telemetry,
    threadId,
    resourceId,
    memory,
    runtimeContext,
    ...rest
  }: LLMTextObjectOptions<T> & { memory?: MastraMemory }) {
    const model = this.#model;

    this.logger.debug(`[LLM] - Generating a text object`, { runId });

    const argsForExecute = {
      model,
      temperature,
      tools: {
        ...tools,
      },
      maxSteps,
      toolChoice,
      onStepFinish: async (props: any) => {
        await onStepFinish?.(props);

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
      ...rest,
    };

    let output: any = 'object';
    if (structuredOutput instanceof z.ZodArray) {
      output = 'array';
      structuredOutput = structuredOutput._def.type;
    }

    const processedSchema = this._applySchemaCompat(structuredOutput!);

    return await generateObject({
      messages,
      ...argsForExecute,
      output,
      schema: processedSchema as Schema<T>,
      experimental_telemetry: {
        ...this.experimental_telemetry,
        ...telemetry,
      },
    });
  }

  async __stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>({
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
    memory,
    runtimeContext,
    ...rest
  }: LLMInnerStreamOptions<Z> & { memory?: MastraMemory }) {
    const model = this.#model;
    this.logger.debug(`[LLM] - Streaming text`, {
      runId,
      threadId,
      resourceId,
      messages,
      maxSteps,
      tools: Object.keys(tools || {}),
    });

    const argsForExecute = {
      model,
      temperature,
      tools: {
        ...tools,
      },
      maxSteps,
      toolChoice,
      onStepFinish: async (props: any) => {
        await onStepFinish?.(props);

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
      onFinish: async (props: any) => {
        await onFinish?.(props);

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
    };

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

    return await streamText({
      messages,
      ...argsForExecute,
      experimental_telemetry: {
        ...this.experimental_telemetry,
        ...telemetry,
      },
      experimental_output: schema
        ? Output.object({
            schema,
          })
        : undefined,
    });
  }

  async __streamObject<T extends ZodSchema | JSONSchema7 | undefined>({
    messages,
    runId,
    tools = {},
    maxSteps = 5,
    toolChoice = 'auto',
    runtimeContext,
    threadId,
    resourceId,
    memory,
    temperature,
    onStepFinish,
    onFinish,
    structuredOutput,
    telemetry,
    ...rest
  }: LLMStreamObjectOptions<T> & { memory?: MastraMemory }) {
    const model = this.#model;
    this.logger.debug(`[LLM] - Streaming structured output`, {
      runId,
      messages,
      maxSteps,
      tools: Object.keys(tools || {}),
    });

    const finalTools = tools;

    const argsForExecute = {
      model,
      temperature,
      tools: {
        ...finalTools,
      },
      maxSteps,
      toolChoice,
      onStepFinish: async (props: any) => {
        await onStepFinish?.(props);

        this.logger.debug('[LLM] - Stream Step Change:', {
          text: props?.text,
          toolCalls: props?.toolCalls,
          toolResults: props?.toolResults,
          finishReason: props?.finishReason,
          usage: props?.usage,
          runId,
          threadId,
          resourceId,
        });

        if (
          props?.response?.headers?.['x-ratelimit-remaining-tokens'] &&
          parseInt(props?.response?.headers?.['x-ratelimit-remaining-tokens'], 10) < 2000
        ) {
          this.logger.warn('Rate limit approaching, waiting 10 seconds', { runId });
          await delay(10 * 1000);
        }
      },
      onFinish: async (props: any) => {
        await onFinish?.(props);

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
    };

    let output: any = 'object';
    if (structuredOutput instanceof z.ZodArray) {
      output = 'array';
      structuredOutput = structuredOutput._def.type;
    }

    const processedSchema = this._applySchemaCompat(structuredOutput!);

    return streamObject({
      messages,
      ...argsForExecute,
      output,
      schema: processedSchema as Schema<T>,
      experimental_telemetry: {
        ...this.experimental_telemetry,
        ...telemetry,
      },
    });
  }

  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    { maxSteps = 5, output, ...rest }: LLMStreamOptions<Z> & { memory?: MastraMemory },
  ): Promise<GenerateReturn<Z>> {
    const msgs = this.convertToMessages(messages);

    if (!output) {
      return (await this.__text({
        messages: msgs,
        maxSteps,
        ...rest,
      })) as unknown as GenerateReturn<Z>;
    }

    return (await this.__textObject({
      messages: msgs,
      structuredOutput: output,
      maxSteps,
      ...rest,
    })) as unknown as GenerateReturn<Z>;
  }

  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    { maxSteps = 5, output, ...rest }: LLMStreamOptions<Z> & { memory?: MastraMemory },
  ) {
    const msgs = this.convertToMessages(messages);

    if (!output) {
      return (await this.__stream({
        messages: msgs as CoreMessage[],
        maxSteps,
        ...rest,
      })) as unknown as StreamReturn<Z>;
    }

    return (await this.__streamObject({
      messages: msgs,
      structuredOutput: output,
      maxSteps,
      ...rest,
    })) as unknown as StreamReturn<Z>;
  }
}

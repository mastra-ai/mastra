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
import { jsonSchema } from 'ai';
import { stepCountIs } from 'ai-v5';
import type { Schema, ModelMessage, ToolSet } from 'ai-v5';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

import type { MastraPrimitives } from '../../action';
import { MessageList } from '../../agent';
import { MastraBase } from '../../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { loop } from '../../loop';
import type { LoopOptions } from '../../loop/types';
import type { Mastra } from '../../mastra';
import type { MastraModelOutput } from '../../stream/base/output';
import { delay } from '../../utils';

import type {
    OriginalStreamObjectOptions,
    StreamObjectResult,
    StreamObjectWithMessagesArgs,
    StreamTextWithMessagesArgs,
    OriginalStreamTextOptions,
} from './model.loop.types';
import type { inferOutput } from './shared.types';

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

    private _applySchemaCompat(schema: ZodSchema | JSONSchema7): Schema {
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
        });
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

    stream<Tools extends ToolSet, Z extends ZodSchema | JSONSchema7 | undefined = undefined>({
        messages,
        onStepFinish,
        onFinish,
        stopWhen = stepCountIs(5),
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
    }: StreamTextWithMessagesArgs<Tools, Z>): MastraModelOutput {
        const model = this.#model;
        this.logger.debug(`[LLM] - Streaming text`, {
            runId,
            threadId,
            resourceId,
            messages,
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
            ...rest,
        };

        try {
            const messageList = new MessageList()
            messageList.add(messages, 'input')

            const loopOptions: LoopOptions<Tools> = {
                messageList,
                model: this.#model,
                tools: tools as Tools,
                stopWhen,
                toolChoice,
                modelSettings: {
                    temperature,
                },
                telemetry_settings: {
                    ...this.experimental_telemetry,
                    ...telemetry,
                },
                options: {
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
                    }
                },
                // TODO:
                // experimental_output: schema
                //     ? (Output.object({
                //         schema,
                //     }) as any)
                //     : undefined,
            }

            return loop(loopOptions);
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

    streamObject<T extends ZodSchema | JSONSchema7>({
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
                return loop(argsForExecute as any);
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
}

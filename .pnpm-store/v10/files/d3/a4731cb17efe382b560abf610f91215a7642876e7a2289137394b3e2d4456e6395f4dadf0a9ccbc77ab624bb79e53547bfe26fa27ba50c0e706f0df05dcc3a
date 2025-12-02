"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertMessageToTracedFormat = exports.wrapAISDK = exports.createLangSmithProviderOptions = void 0;
const middleware_js_1 = require("./middleware.cjs");
const utils_js_1 = require("./utils.cjs");
Object.defineProperty(exports, "convertMessageToTracedFormat", { enumerable: true, get: function () { return utils_js_1.convertMessageToTracedFormat; } });
const traceable_js_1 = require("../../traceable.cjs");
const _wrapTools = (tools, lsConfig) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrappedTools = {};
    if (tools) {
        for (const [key, tool] of Object.entries(tools)) {
            wrappedTools[key] = Object.assign(Object.create(Object.getPrototypeOf(tool)), tool);
            if (wrappedTools[key] != null &&
                typeof wrappedTools[key] === "object" &&
                "execute" in wrappedTools[key] &&
                typeof wrappedTools[key].execute === "function" &&
                !(0, traceable_js_1.isTraceableFunction)(wrappedTools[key].execute)) {
                wrappedTools[key].execute = (0, traceable_js_1.traceable)(wrappedTools[key].execute.bind(wrappedTools[key]), {
                    ...lsConfig,
                    name: key,
                    run_type: "tool",
                });
            }
        }
    }
    return wrappedTools;
};
const _getModelDisplayName = (model) => {
    if (typeof model === "string") {
        return model;
    }
    if (model.config != null &&
        typeof model.config === "object" &&
        "provider" in model.config &&
        typeof model.config.provider === "string") {
        return model.config.provider;
    }
    if (model.modelId != null && typeof model.modelId === "string") {
        return model.modelId;
    }
    return "unknown";
};
const _getModelId = (model) => {
    if (typeof model === "string") {
        return model;
    }
    return typeof model.modelId === "string" ? model.modelId : undefined;
};
const _formatTracedInputs = (params) => {
    const { prompt, messages, model, tools, ...rest } = params;
    if (Array.isArray(prompt)) {
        return {
            ...rest,
            messages: prompt.map((message) => (0, utils_js_1.convertMessageToTracedFormat)(message)),
        };
    }
    else if (Array.isArray(messages)) {
        return {
            ...rest,
            messages: messages.map((message) => (0, utils_js_1.convertMessageToTracedFormat)(message)),
        };
    }
    else {
        return { ...rest, prompt, messages };
    }
};
const _mergeConfig = (baseConfig, runtimeConfig) => {
    return {
        ...baseConfig,
        ...runtimeConfig,
        metadata: {
            ...baseConfig?.metadata,
            ...runtimeConfig?.metadata,
        },
    };
};
const _extractChildRunConfig = (lsConfig) => {
    const { id, name, parent_run_id, start_time, end_time, attachments, dotted_order, processInputs, processOutputs, processChildLLMRunInputs, processChildLLMRunOutputs, ...inheritedConfig } = lsConfig ?? {};
    const childConfig = inheritedConfig;
    if (processChildLLMRunInputs) {
        childConfig.processInputs = processChildLLMRunInputs;
    }
    if (processChildLLMRunOutputs) {
        // TODO: Fix this typing on minor bump
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        childConfig.processOutputs = processChildLLMRunOutputs;
    }
    return childConfig;
};
const _resolveConfigs = (baseLsConfig, runtimeLsConfig) => {
    const baseChildRunConfig = _extractChildRunConfig(baseLsConfig);
    const runtimeChildLLMRunConfig = _extractChildRunConfig(runtimeLsConfig);
    const resolvedLsConfig = _mergeConfig(baseLsConfig, runtimeLsConfig);
    const resolvedChildLLMRunConfig = _mergeConfig(baseChildRunConfig, runtimeChildLLMRunConfig);
    const { processInputs: _processInputs, processOutputs: _processOutputs, ...resolvedToolConfig } = resolvedChildLLMRunConfig;
    return {
        resolvedLsConfig,
        resolvedChildLLMRunConfig,
        resolvedToolConfig,
    };
};
/**
 * Wraps LangSmith config in a way that matches AI SDK provider types.
 *
 * ```ts
 * import { createLangSmithProviderOptions } from "langsmith/experimental/vercel";
 * import * as ai from "ai";
 *
 * const lsConfig = createLangSmithProviderOptions<typeof ai.generateText>({
 *   // Will have appropriate typing
 *   processInputs: (inputs) => {
 *     const { messages } = inputs;
 *     return {
 *       messages: messages?.map((message) => ({
 *         ...message,
 *         content: "REDACTED",
 *       })),
 *       prompt: "REDACTED",
 *     };
 *   },
 * });
 * ```
 *
 * Note: AI SDK expects only JSON values in an object for
 * provider options, but LangSmith's config may contain non-JSON values.
 * These are not passed to the underlying AI SDK model, so it is safe to
 * cast the typing here.
 */
const createLangSmithProviderOptions = (lsConfig) => {
    return (lsConfig ?? {});
};
exports.createLangSmithProviderOptions = createLangSmithProviderOptions;
/**
 * Wraps Vercel AI SDK 5 functions with LangSmith tracing capabilities.
 *
 * @param methods - Object containing AI SDK methods to wrap
 * @param methods.wrapLanguageModel - AI SDK's wrapLanguageModel function
 * @param methods.generateText - AI SDK's generateText function
 * @param methods.streamText - AI SDK's streamText function
 * @param methods.streamObject - AI SDK's streamObject function
 * @param methods.generateObject - AI SDK's generateObject function
 *
 * @returns Object containing wrapped versions of the AI SDK functions with LangSmith tracing
 * @returns returns.generateText - Wrapped generateText function that traces calls to LangSmith
 * @returns returns.generateObject - Wrapped generateObject function that traces calls to LangSmith
 * @returns returns.streamText - Wrapped streamText function that traces calls to LangSmith
 * @returns returns.streamObject - Wrapped streamObject function that traces calls to LangSmith
 */
const wrapAISDK = ({ wrapLanguageModel, generateText, streamText, streamObject, generateObject, }, baseLsConfig) => {
    /**
     * Wrapped version of AI SDK 5's generateText with LangSmith tracing.
     *
     * This function has the same signature and behavior as the original generateText,
     * but adds automatic tracing to LangSmith for observability.
     *
     * ```ts
     * import * as ai from "ai";
     * import { wrapAISDK } from "langsmith/experimental/vercel";
     *
     * const { generateText } = wrapAISDK(ai);
     * const { text } = await generateText(...);
     * ```
     *
     * @see {@link https://sdk.vercel.ai/docs/ai-sdk-core/generating-text} Original generateText documentation
     * @param params - Same parameters as the original generateText function
     * @returns Promise resolving to the same result as generateText, with tracing applied
     */
    const wrappedGenerateText = async (...args) => {
        const params = args[0];
        const { langsmith: runtimeLsConfig, ...providerOptions } = params.providerOptions ?? {};
        const { resolvedLsConfig, resolvedChildLLMRunConfig, resolvedToolConfig } = _resolveConfigs(baseLsConfig, runtimeLsConfig);
        const traceableFunc = (0, traceable_js_1.traceable)(async (...args) => {
            const [params, ...rest] = args;
            const wrappedModel = wrapLanguageModel({
                model: params.model,
                middleware: (0, middleware_js_1.LangSmithMiddleware)({
                    name: _getModelDisplayName(params.model),
                    modelId: _getModelId(params.model),
                    // TODO: Fix this typing on minor bump
                    lsConfig: resolvedChildLLMRunConfig,
                }),
            });
            return generateText({
                ...params,
                providerOptions,
                tools: _wrapTools(params.tools, resolvedToolConfig),
                model: wrappedModel,
            }, ...rest);
        }, {
            name: _getModelDisplayName(params.model),
            ...resolvedLsConfig,
            metadata: {
                ai_sdk_method: "ai.generateText",
                ...resolvedLsConfig?.metadata,
            },
            processInputs: (inputs) => {
                const inputFormatter = resolvedLsConfig?.processInputs ?? _formatTracedInputs;
                return inputFormatter(inputs);
            },
            processOutputs: async (outputs) => {
                if (resolvedLsConfig?.processOutputs) {
                    const processedOutputs = await resolvedLsConfig.processOutputs(
                    // TODO: Fix this typing on minor bump
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    outputs);
                    return processedOutputs;
                }
                if (outputs.outputs == null || typeof outputs.outputs !== "object") {
                    return outputs;
                }
                // If experimental_output is present, return it directly at top level (like generateObject)
                // Note: accessing experimental_output throws if not specified, so wrap in try-catch
                try {
                    if ("experimental_output" in outputs.outputs) {
                        const experimentalOutput = outputs.outputs.experimental_output;
                        if (experimentalOutput != null) {
                            return experimentalOutput;
                        }
                    }
                }
                catch (e) {
                    // experimental_output not specified, continue with normal processing
                }
                const { steps } = outputs.outputs;
                if (Array.isArray(steps)) {
                    const lastStep = steps.at(-1);
                    if (lastStep == null || typeof lastStep !== "object") {
                        return outputs;
                    }
                    const { content } = lastStep;
                    return (0, utils_js_1.convertMessageToTracedFormat)({
                        content: content ?? outputs.outputs.text,
                        role: "assistant",
                    }, resolvedLsConfig?.traceResponseMetadata ? { steps } : undefined);
                }
                else {
                    return outputs;
                }
            },
        });
        return traceableFunc(...args);
    };
    /**
     * Wrapped version of AI SDK 5's generateObject with LangSmith tracing.
     *
     * This function has the same signature and behavior as the original generateObject,
     * but adds automatic tracing to LangSmith for observability.
     *
     * ```ts
     * import * as ai from "ai";
     * import { wrapAISDK } from "langsmith/experimental/vercel";
     *
     * const { generateObject } = wrapAISDK(ai);
     * const { object } = await generateObject(...);
     * ```
     *
     * @see {@link https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data} Original generateObject documentation
     * @param params - Same parameters as the original generateObject function
     * @returns Promise resolving to the same result as generateObject, with tracing applied
     */
    const wrappedGenerateObject = async (...args) => {
        const params = args[0];
        const { langsmith: runtimeLsConfig, ...providerOptions } = params.providerOptions ?? {};
        const { resolvedLsConfig, resolvedChildLLMRunConfig } = _resolveConfigs(baseLsConfig, runtimeLsConfig);
        const traceableFunc = (0, traceable_js_1.traceable)(async (...args) => {
            const [params, ...rest] = args;
            const wrappedModel = wrapLanguageModel({
                model: params.model,
                middleware: (0, middleware_js_1.LangSmithMiddleware)({
                    name: _getModelDisplayName(params.model),
                    modelId: _getModelId(params.model),
                    // TODO: Fix this typing on minor bump
                    lsConfig: resolvedChildLLMRunConfig,
                }),
            });
            return generateObject({
                ...params,
                providerOptions,
                model: wrappedModel,
            }, ...rest);
        }, {
            name: _getModelDisplayName(params.model),
            ...resolvedLsConfig,
            metadata: {
                ai_sdk_method: "ai.generateObject",
                ...resolvedLsConfig?.metadata,
            },
            processInputs: (inputs) => {
                const inputFormatter = resolvedLsConfig?.processInputs ?? _formatTracedInputs;
                return inputFormatter(inputs);
            },
            processOutputs: async (outputs) => {
                if (resolvedLsConfig?.processOutputs) {
                    const processedOutputs = await resolvedLsConfig.processOutputs(
                    // TODO: Fix this typing on minor bump
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    outputs);
                    return processedOutputs;
                }
                if (outputs.outputs == null || typeof outputs.outputs !== "object") {
                    return outputs;
                }
                return outputs.outputs.object ?? outputs;
            },
        });
        return traceableFunc(...args);
    };
    /**
     * Wrapped version of AI SDK 5's streamText with LangSmith tracing.
     *
     * Must be called with `await`, but otherwise behaves the same as the
     * original streamText and adds adds automatic tracing to LangSmith
     * for observability.
     *
     * ```ts
     * import * as ai from "ai";
     * import { wrapAISDK } from "langsmith/experimental/vercel";
     *
     * const { streamText } = wrapAISDK(ai);
     * const { textStream } = await streamText(...);
     * ```
     *
     * @see {@link https://sdk.vercel.ai/docs/ai-sdk-core/generating-text} Original streamText documentation
     * @param params - Same parameters as the original streamText function
     * @returns Promise resolving to the same result as streamText, with tracing applied
     */
    const wrappedStreamText = (...args) => {
        const params = args[0];
        const { langsmith: runtimeLsConfig, ...providerOptions } = params.providerOptions ?? {};
        const { resolvedLsConfig, resolvedChildLLMRunConfig, resolvedToolConfig } = _resolveConfigs(baseLsConfig, runtimeLsConfig);
        const traceableFunc = (0, traceable_js_1.traceable)((...args) => {
            const [params, ...rest] = args;
            const wrappedModel = wrapLanguageModel({
                model: params.model,
                middleware: (0, middleware_js_1.LangSmithMiddleware)({
                    name: _getModelDisplayName(params.model),
                    modelId: _getModelId(params.model),
                    // TODO: Fix this typing on minor bump
                    lsConfig: resolvedChildLLMRunConfig,
                }),
            });
            return streamText({
                ...params,
                providerOptions,
                tools: _wrapTools(params.tools, resolvedToolConfig),
                model: wrappedModel,
            }, ...rest);
        }, {
            name: _getModelDisplayName(params.model),
            ...resolvedLsConfig,
            metadata: {
                ai_sdk_method: "ai.streamText",
                ...resolvedLsConfig?.metadata,
            },
            processInputs: (inputs) => {
                const inputFormatter = resolvedLsConfig?.processInputs ?? _formatTracedInputs;
                return inputFormatter(inputs);
            },
            processOutputs: async (outputs) => {
                try {
                    if (resolvedLsConfig?.processOutputs) {
                        const processedOutputs = await resolvedLsConfig.processOutputs(
                        // TODO: Fix this typing on minor bump
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        outputs);
                        return processedOutputs;
                    }
                    if (outputs.outputs == null ||
                        typeof outputs.outputs !== "object") {
                        return outputs;
                    }
                    // Important: Even accessing this property creates a promise.
                    // This must be awaited.
                    let content = await outputs.outputs.content;
                    if (content == null) {
                        // AI SDK 4 shim
                        content = await outputs.outputs.text;
                    }
                    if (content == null ||
                        !["object", "string"].includes(typeof content)) {
                        return outputs;
                    }
                    try {
                        if ("experimental_partialOutputStream" in outputs.outputs &&
                            outputs.outputs.experimental_partialOutputStream != null) {
                            const textContent = await outputs.outputs.text;
                            return JSON.parse(textContent);
                        }
                    }
                    catch (e) {
                        // experimental_partialOutputStream not specified, continue with normal processing
                    }
                    let responseMetadata = undefined;
                    if (resolvedLsConfig?.traceResponseMetadata) {
                        try {
                            const steps = await outputs.outputs.steps;
                            responseMetadata = { steps };
                        }
                        catch (e) {
                            // Do nothing if step parsing fails
                        }
                    }
                    return (0, utils_js_1.convertMessageToTracedFormat)({
                        content,
                        role: "assistant",
                    }, responseMetadata);
                }
                catch (e) {
                    // Handle parsing failures without a log
                    return outputs;
                }
            },
        });
        return traceableFunc(...args);
    };
    /**
     * Wrapped version of AI SDK 5's streamObject with LangSmith tracing.
     *
     * Must be called with `await`, but otherwise behaves the same as the
     * original streamObject and adds adds automatic tracing to LangSmith
     * for observability.
     *
     * ```ts
     * import * as ai from "ai";
     * import { wrapAISDK } from "langsmith/experimental/vercel";
     *
     * const { streamObject } = wrapAISDK(ai);
     * const { partialObjectStream } = await streamObject(...);
     * ```
     *
     * @see {@link https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data} Original streamObject documentation
     * @param params - Same parameters as the original streamObject function
     * @returns Promise resolving to the same result as streamObject, with tracing applied
     */
    const wrappedStreamObject = (...args) => {
        const params = args[0];
        const { langsmith: runtimeLsConfig, ...providerOptions } = params.providerOptions ?? {};
        const { resolvedLsConfig, resolvedChildLLMRunConfig } = _resolveConfigs(baseLsConfig, runtimeLsConfig);
        const traceableFunc = (0, traceable_js_1.traceable)((...args) => {
            const [params, ...rest] = args;
            const wrappedModel = wrapLanguageModel({
                model: params.model,
                middleware: (0, middleware_js_1.LangSmithMiddleware)({
                    name: _getModelDisplayName(params.model),
                    modelId: _getModelId(params.model),
                    // TODO: Fix this typing on minor bump
                    lsConfig: resolvedChildLLMRunConfig,
                }),
            });
            return streamObject({
                ...params,
                providerOptions,
                model: wrappedModel,
            }, ...rest);
        }, {
            name: _getModelDisplayName(params.model),
            ...resolvedLsConfig,
            metadata: {
                ai_sdk_method: "ai.streamObject",
                ...resolvedLsConfig?.metadata,
            },
            processInputs: (inputs) => {
                const inputFormatter = resolvedLsConfig?.processInputs ?? _formatTracedInputs;
                return inputFormatter(inputs);
            },
            processOutputs: async (outputs) => {
                try {
                    if (resolvedLsConfig?.processOutputs) {
                        const processedOutputs = await resolvedLsConfig.processOutputs(
                        // TODO: Fix this typing on minor bump
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        outputs);
                        return processedOutputs;
                    }
                    if (outputs.outputs == null ||
                        typeof outputs.outputs !== "object") {
                        return outputs;
                    }
                    const object = await outputs.outputs.object;
                    if (object == null || typeof object !== "object") {
                        return outputs;
                    }
                    return object;
                }
                catch (e) {
                    // Handle parsing failures without a log
                    return outputs;
                }
            },
        });
        return traceableFunc(...args);
    };
    return {
        generateText: wrappedGenerateText,
        generateObject: wrappedGenerateObject,
        streamText: wrappedStreamText,
        streamObject: wrappedStreamObject,
    };
};
exports.wrapAISDK = wrapAISDK;

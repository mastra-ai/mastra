"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapAISDKModel = void 0;
const traceable_js_1 = require("../traceable.cjs");
const generic_js_1 = require("./generic.cjs");
/**
 * @deprecated Use `wrapAISDK` from `langsmith/experimental/vercel` instead.
 * Wrap a Vercel AI SDK model, enabling automatic LangSmith tracing.
 * After wrapping a model, you can use it with the Vercel AI SDK Core
 * methods as normal.
 *
 * @example
 * ```ts
 * import { anthropic } from "@ai-sdk/anthropic";
 * import { streamText } from "ai";
 * import { wrapAISDKModel } from "langsmith/wrappers/vercel";
 *
 * const anthropicModel = anthropic("claude-3-haiku-20240307");
 *
 * const modelWithTracing = wrapAISDKModel(anthropicModel);
 *
 * const { textStream } = await streamText({
 *   model: modelWithTracing,
 *   prompt: "Write a vegetarian lasagna recipe for 4 people.",
 * });
 *
 * for await (const chunk of textStream) {
 *   console.log(chunk);
 * }
 * ```
 * @param model An AI SDK model instance.
 * @param options LangSmith options.
 * @returns
 */
const wrapAISDKModel = (model, options) => {
    if (!("doStream" in model) ||
        typeof model.doStream !== "function" ||
        !("doGenerate" in model) ||
        typeof model.doGenerate !== "function") {
        throw new Error(`Received invalid input. This version of wrapAISDKModel only supports Vercel LanguageModelV1 instances.`);
    }
    const runName = options?.name ?? model.constructor?.name;
    return new Proxy(model, {
        get(target, propKey, receiver) {
            const originalValue = target[propKey];
            if (typeof originalValue === "function") {
                let __finalTracedIteratorKey;
                let aggregator;
                if (propKey === "doStream") {
                    __finalTracedIteratorKey = "stream";
                    aggregator = (chunks) => {
                        return chunks.reduce((aggregated, chunk) => {
                            if (chunk.type === "text-delta") {
                                return {
                                    ...aggregated,
                                    text: aggregated.text + chunk.textDelta,
                                };
                            }
                            else if (chunk.type === "tool-call") {
                                return {
                                    ...aggregated,
                                    ...chunk,
                                };
                            }
                            else if (chunk.type === "finish") {
                                return {
                                    ...aggregated,
                                    usage: chunk.usage,
                                    finishReason: chunk.finishReason,
                                };
                            }
                            else {
                                return aggregated;
                            }
                        }, {
                            text: "",
                        });
                    };
                }
                return (0, traceable_js_1.traceable)(originalValue.bind(target), {
                    run_type: "llm",
                    name: runName,
                    ...options,
                    __finalTracedIteratorKey,
                    aggregator,
                });
            }
            else if (originalValue != null &&
                !Array.isArray(originalValue) &&
                // eslint-disable-next-line no-instanceof/no-instanceof
                !(originalValue instanceof Date) &&
                typeof originalValue === "object") {
                return (0, generic_js_1._wrapClient)(originalValue, [runName, propKey.toString()].join("."), options);
            }
            else {
                return Reflect.get(target, propKey, receiver);
            }
        },
    });
};
exports.wrapAISDKModel = wrapAISDKModel;

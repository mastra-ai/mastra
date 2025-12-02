import type { JSONValue } from "ai";
import type { LanguageModelV2, LanguageModelV2CallOptions } from "@ai-sdk/provider";
import { type AggregatedDoStreamOutput } from "./middleware.js";
import { convertMessageToTracedFormat } from "./utils.js";
import { RunTreeConfig } from "../../run_trees.js";
export type { AggregatedDoStreamOutput };
export type WrapAISDKConfig<T extends (...args: any[]) => any = (...args: any[]) => any> = Partial<Omit<RunTreeConfig, "inputs" | "outputs" | "run_type" | "child_runs" | "parent_run" | "error" | "serialized">> & {
    /**
     * Apply transformations to AI SDK inputs before logging.
     * This function should NOT mutate the inputs.
     * Receives both "raw" and LangSmith-suggested "formatted" inputs,
     * and should combine them into a single LangSmith-formatted input.
     *
     * ```ts
     * import {
     *   wrapAISDK,
     *   createLangSmithProviderOptions,
     * } from "langsmith/experimental/vercel";
     * import * as ai from "ai";
     * import { openai } from "@ai-sdk/openai";
     *
     * const { generateText } = wrapAISDK(ai);
     *
     * const lsConfig = createLangSmithProviderOptions<typeof ai.generateText>({
     *   processInputs: (inputs) => {
     *     const { messages } = inputs;
     *     return {
     *       messages: messages?.map((message) => ({
     *         providerMetadata: message.providerOptions,
     *         role: "assistant",
     *         content: "REDACTED",
     *       })),
     *       prompt: "REDACTED",
     *     };
     *   },
     * });
     * const { text } = await generateText({
     *   model: openai("gpt-5-nano"),
     *   prompt: "What is the capital of France?",
     *   providerOptions: {
     *     langsmith: lsConfig,
     *   },
     * });
     * ```
     *
     * This function is not inherited by nested LLM runs or tool calls.
     * Pass `processChildLLMRunInputs` to override child LLM run
     * input processing or wrap your tool's `execute` method in a
     * separate `traceable` for tool calls.
     *
     * @param inputs Key-value map of the function inputs.
     * @param inputs.formatted - Inputs formatted for LangSmith.
     * @param inputs.raw - Raw inputs from the AI SDK.
     * @returns A single combined key-value map of processed inputs.
     */
    processInputs?: (inputs: Parameters<T>[0]) => Record<string, unknown>;
    /**
     * Apply transformations to AI SDK outputs before logging.
     * This function should NOT mutate the outputs.
     * Receives both "raw" and LangSmith-suggested "formatted" outputs,
     * and should combine them into a single LangSmith-formatted output.
     *
     * ```ts
     * import {
     *   wrapAISDK,
     *   createLangSmithProviderOptions,
     * } from "langsmith/experimental/vercel";
     * import * as ai from "ai";
     * import { openai } from "@ai-sdk/openai";
     *
     * const { generateText } = wrapAISDK(ai);
     *
     * const lsConfig = createLangSmithProviderOptions<typeof ai.generateText>({
     *   processOutputs: (outputs) => {
     *     return {
     *       providerMetadata: outputs.providerMetadata,
     *       role: "assistant",
     *       content: "REDACTED",
     *     };
     *   },
     * });
     * const { text } = await generateText({
     *   model: openai("gpt-5-nano"),
     *   prompt: "What is the capital of France?",
     *   providerOptions: {
     *     langsmith: lsConfig,
     *   },
     * });
     * ```
     *
     * This function is not inherited by nested LLM runs or tool calls.
     * Pass `processChildLLMRunOutputs` to override child LLM run
     * output processing or wrap your tool's `execute` method in a
     * separate `traceable` for tool calls.
     *
     * @param outputs Key-value map of the function inputs.
     * @param outputs.formatted - Outputs formatted for LangSmith.
     * @param outputs.raw - Raw outputs from the AI SDK.
     * @returns A single combined key-value map of processed outputs.
     */
    processOutputs?: (outputs: {
        outputs: Awaited<ReturnType<T>>;
    }) => Record<string, unknown> | Promise<Record<string, unknown>>;
    /**
     * Apply transformations to AI SDK child LLM run inputs before logging.
     * This function should NOT mutate the inputs.
     * Receives both "raw" and LangSmith-suggested "formatted" inputs,
     * and should combine them into a single LangSmith-formatted input.
     *
     * ```ts
     * import {
     *   wrapAISDK,
     *   createLangSmithProviderOptions,
     * } from "langsmith/experimental/vercel";
     * import * as ai from "ai";
     * import { openai } from "@ai-sdk/openai";
     *
     * const { generateText } = wrapAISDK(ai);
     *
     * const lsConfig = createLangSmithProviderOptions<typeof ai.generateText>({
     *   processChildLLMRunInputs: (inputs) => {
     *     const { prompt } = inputs;
     *     return {
     *       messages: prompt.map((message) => ({
     *         ...message,
     *         content: "REDACTED CHILD INPUTS",
     *       })),
     *     };
     *   },
     * });
     * const { text } = await generateText({
     *   model: openai("gpt-5-nano"),
     *   prompt: "What is the capital of France?",
     *   providerOptions: {
     *     langsmith: lsConfig,
     *   },
     * });
     * ```
     *
     * @param inputs Key-value map of the function inputs.
     * @param inputs.formatted - Inputs formatted for LangSmith.
     * @param inputs.raw - Raw inputs from the AI SDK.
     * @returns A single combined key-value map of processed inputs.
     */
    processChildLLMRunInputs?: (inputs: LanguageModelV2CallOptions) => Record<string, unknown>;
    /**
     * Apply transformations to AI SDK child LLM run outputs before logging.
     * This function should NOT mutate the outputs.
     * Receives both "raw" and LangSmith-suggested "formatted" outputs,
     * and should combine them into a single LangSmith-formatted output.
     *
     * ```ts
     * import {
     *   wrapAISDK,
     *   createLangSmithProviderOptions,
     * } from "langsmith/experimental/vercel";
     * import * as ai from "ai";
     * import { openai } from "@ai-sdk/openai";
     *
     * const { generateText } = wrapAISDK(ai);
     *
     * const lsConfig = createLangSmithProviderOptions<typeof ai.generateText>({
     *   processChildLLMRunOutputs: (outputs) => {
     *     return {
     *       providerMetadata: outputs.providerMetadata,
     *       content: "REDACTED CHILD OUTPUTS",
     *       role: "assistant",
     *     };
     *   },
     * });
     * const { text } = await generateText({
     *   model: openai("gpt-5-nano"),
     *   prompt: "What is the capital of France?",
     *   providerOptions: {
     *     langsmith: lsConfig,
     *   },
     * });
     * ```
     *
     * @param outputs Key-value map of the function inputs.
     * @param outputs.formatted - Outputs formatted for LangSmith.
     * @param outputs.raw - Raw outputs from the AI SDK.
     * @returns A single combined key-value map of processed outputs.
     */
    processChildLLMRunOutputs?: (outputs: "fullStream" extends keyof Awaited<ReturnType<T>> ? AggregatedDoStreamOutput : Awaited<ReturnType<LanguageModelV2["doGenerate"]>>) => Record<string, unknown>;
    /**
     * Whether to include additional fields such as intermediate steps in traced
     * output messages.
     * @default false
     */
    traceResponseMetadata?: boolean;
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
export declare const createLangSmithProviderOptions: <T extends (...args: any[]) => any>(lsConfig?: WrapAISDKConfig<T>) => Record<string, JSONValue>;
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
declare const wrapAISDK: <GenerateTextType extends (...args: any[]) => any, StreamTextType extends (...args: any[]) => any, GenerateObjectType extends (...args: any[]) => any, StreamObjectType extends (...args: any[]) => any, WrapLanguageModelType extends (...args: any[]) => any>({ wrapLanguageModel, generateText, streamText, streamObject, generateObject, }: {
    wrapLanguageModel: WrapLanguageModelType;
    generateText: GenerateTextType;
    streamText: StreamTextType;
    streamObject: StreamObjectType;
    generateObject: GenerateObjectType;
}, baseLsConfig?: WrapAISDKConfig) => {
    generateText: GenerateTextType;
    generateObject: GenerateObjectType;
    streamText: StreamTextType;
    streamObject: StreamObjectType;
};
export { wrapAISDK };
export { convertMessageToTracedFormat };

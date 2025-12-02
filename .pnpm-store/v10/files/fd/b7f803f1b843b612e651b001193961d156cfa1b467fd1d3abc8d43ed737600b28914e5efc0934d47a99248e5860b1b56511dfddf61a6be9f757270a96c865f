import { type AnthropicAiAdapter } from "./adapters/anthropic.js";
import { type OpenAiResponsesAdapter } from "./adapters/openai-responses.js";
import { type GeminiAiAdapter } from "./adapters/gemini.js";
import { type GrokAiAdapter } from "./adapters/grok.js";
import { type OpenAiAiAdapter } from "./adapters/openai.js";
import { type AzureOpenAiAiAdapter } from "./adapters/azure-openai.js";
/**
 * An AI model, defining the I/O format and typing, and how to call the model.
 *
 * Models should extend this interface to define their own input and output
 * types.
 */
export interface AiAdapter {
    /**
     * The I/O format for the adapter.
     */
    format: AiAdapter.Format;
    /**
     * The constructor options for the adapter.
     */
    options: any;
    /**
     * The input and output types for this AI I/O format.
     *
     * This is not accessible externally, and is only used internally to define
     * the user-facing types for each model in a way that avoids using generics.
     */
    "~types": {
        /**
         * The input typing for the format.
         */
        input: any;
        /**
         * The output typing for the format.
         */
        output: any;
    };
    /**
     * The URL to use for the format.
     */
    url?: string;
    /**
     * Headers to pass to the format.
     */
    headers?: Record<string, string>;
    /**
     * The authentication key to use for the format.
     */
    authKey: string;
    /**
     * Given the model and a body, mutate them as needed. This is useful for
     * addressing any dynamic changes to the model options or body based on each
     * other, such as the target URL changing based on a model.
     */
    onCall?: (
    /**
     * The model to use for the inference.
     */
    model: AiAdapter, 
    /**
     * The input to pass to the model.
     */
    body: this["~types"]["input"]) => void;
}
/**
 * An AI model, defining the I/O format and typing, and how to call the model.
 *
 * Models should extend this interface to define their own input and output
 * types.
 */
export declare namespace AiAdapter {
    interface Any extends Omit<AiAdapter, "format"> {
        /**
         * The I/O format for the adapter.
         *
         * Allows any value, such that this type can be easily used with any
         * adapter.
         */
        format: any;
    }
    /**
     * A helper used to infer the input type of an adapter.
     */
    type Input<TAdapter extends AiAdapter> = TAdapter["~types"]["input"];
    /**
     * A helper used to infer the output type of an adapter.
     */
    type Output<TAdapter extends AiAdapter> = TAdapter["~types"]["output"];
    /**
     * Supported I/O formats for AI models.
     */
    type Format = "openai-chat" | "openai-responses" | "anthropic" | "gemini" | "grok" | "azure-openai";
    /**
     * A function that creates a model that adheres to an existng AI adapter
     * interface.
     */
    type ModelCreator<TInput extends unknown[], TOutput extends AiAdapter> = (...args: TInput) => TOutput;
}
/**
 * A cheeky hack to ensure we account for all AI adapters.
 */
declare const adapters: {
    "openai-chat": OpenAiAiAdapter;
    "openai-responses": OpenAiResponsesAdapter;
    anthropic: AnthropicAiAdapter;
    gemini: GeminiAiAdapter;
    grok: GrokAiAdapter;
    "azure-openai": AzureOpenAiAiAdapter;
};
/**
 * All AI adapters available for use.
 */
export type AiAdapters = typeof adapters;
export {};
//# sourceMappingURL=adapter.d.ts.map
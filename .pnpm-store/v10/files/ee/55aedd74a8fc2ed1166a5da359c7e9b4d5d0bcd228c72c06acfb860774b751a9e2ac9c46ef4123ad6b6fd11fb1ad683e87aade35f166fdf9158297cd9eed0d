import { type AiAdapter } from "../adapter.js";
import { type GeminiAiAdapter } from "../adapters/gemini.js";
/**
 * Create a Gemini model using the OpenAI chat format.
 *
 * By default it targets the `https://generativelanguage.googleapis.com/v1beta/`
 * base URL.
 */
export declare const gemini: AiAdapter.ModelCreator<[
    options: Gemini.AiModelOptions
], Gemini.AiModel>;
export declare namespace Gemini {
    /**
     * IDs of models to use.
     */
    type Model = GeminiAiAdapter.Model;
    /**
     * Options for creating a Gemini model.
     */
    interface AiModelOptions {
        /**
         * ID of the model to use.
         */
        model: Gemini.Model;
        /**
         * The Gemini API key to use for authenticating your request. By default
         * we'll search for and use the `GEMINI_API_KEY` environment variable.
         */
        apiKey?: string;
        /**
         * The base URL for the Gemini API.
         *
         * @default "https://generativelanguage.googleapis.com/v1beta/"
         */
        baseUrl?: string;
        /**
         * Default parameters to use for the model when calling.
         *
         * Note that common parameters like `messages` will likely be overwritten by
         * the adapter.
         */
        defaultParameters?: Partial<AiAdapter.Input<AiModel>>;
    }
    /**
     * A Gemini model using the OpenAI format for I/O.
     */
    interface AiModel extends GeminiAiAdapter {
        options: AiModelOptions;
    }
}
//# sourceMappingURL=gemini.d.ts.map
import { type AiAdapter } from "../adapter.js";
import { type OpenAiAiAdapter } from "../adapters/openai.js";
/**
 * Create an OpenAI model using the OpenAI chat format.
 *
 * By default it targets the `https://api.openai.com/v1/` base URL.
 * @deprecated Use `openaiResponses` instead.
 */
export declare const openai: AiAdapter.ModelCreator<[
    options: OpenAi.AiModelOptions
], OpenAi.AiModel>;
export declare namespace OpenAi {
    /**
     * IDs of models to use. See the [model endpoint
     * compatibility](https://platform.openai.com/docs/models#model-endpoint-compatibility)
     * table for details on which models work with the Chat API.
     */
    type Model = (string & {}) | "gpt-5" | "gpt-5-mini" | "gpt-5-nano" | "gpt-4.1-mini" | "gpt-4.1" | "gpt-4.5-preview" | "gpt-4o" | "chatgpt-4o-latest" | "gpt-4o-mini" | "gpt-4" | "o1" | "o1-preview" | "o1-mini" | "o3-mini" | "gpt-4-turbo" | "gpt-3.5-turbo";
    /**
     * Options for creating an OpenAI model.
     */
    interface AiModelOptions {
        /**
         * ID of the model to use. See the [model endpoint
         * compatibility](https://platform.openai.com/docs/models#model-endpoint-compatibility)
         * table for details on which models work with the Chat API.
         */
        model: Model;
        /**
         * The OpenAI API key to use for authenticating your request. By default we'll
         * search for and use the `OPENAI_API_KEY` environment variable.
         */
        apiKey?: string;
        /**
         * The base URL for the OpenAI API.
         *
         * @default "https://api.openai.com/v1/"
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
     * An OpenAI model using the OpenAI format for I/O.
     */
    interface AiModel extends OpenAiAiAdapter {
        options: AiModelOptions;
    }
}
//# sourceMappingURL=openai.d.ts.map
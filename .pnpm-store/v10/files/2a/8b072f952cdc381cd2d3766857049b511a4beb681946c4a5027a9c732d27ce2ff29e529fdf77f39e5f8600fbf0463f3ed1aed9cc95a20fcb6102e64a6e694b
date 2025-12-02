import { type AiAdapter } from "../adapter.js";
import { type OpenAiAiAdapter } from "../adapters/openai.js";
/**
 * Create a DeepSeek model using the OpenAI-compatible chat format.
 *
 * By default it targets the `https://api.deepseek.com/v1/` base URL.
 */
export declare const deepseek: AiAdapter.ModelCreator<[
    options: DeepSeek.AiModelOptions
], DeepSeek.AiModel>;
export declare namespace DeepSeek {
    /**
     * IDs of models available in the DeepSeek API.
     */
    type Model = "deepseek-chat" | "deepseek-reasoner" | (string & {});
    /**
     * Options for creating a DeepSeek model.
     */
    interface AiModelOptions {
        /**
         * ID of the model to use. Currently supports 'deepseek-chat' (DeepSeek-V3)
         * and 'deepseek-reasoner' (DeepSeek-R1).
         */
        model: Model;
        /**
         * The DeepSeek API key to use for authenticating your request. By default we'll
         * search for and use the `DEEPSEEK_API_KEY` environment variable.
         */
        apiKey?: string;
        /**
         * The base URL for the DeepSeek API.
         *
         * @default "https://api.deepseek.com/v1/"
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
     * A DeepSeek model using the OpenAI-compatible format for I/O.
     */
    interface AiModel extends OpenAiAiAdapter {
        options: AiModelOptions;
    }
}
//# sourceMappingURL=deepseek.d.ts.map
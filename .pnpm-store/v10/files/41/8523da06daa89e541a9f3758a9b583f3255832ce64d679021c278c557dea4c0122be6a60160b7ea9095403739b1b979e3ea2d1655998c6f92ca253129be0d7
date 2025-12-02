import { type AiAdapter } from "../adapter.js";
import { type AnthropicAiAdapter } from "../adapters/anthropic.js";
/**
 * Create an Anthropic model using the Anthropic chat format.
 *
 * By default it targets the `https://api.anthropic.com/v1/` base URL, with the
 * "2023-06-01" anthropic-version header.
 */
export declare const anthropic: AiAdapter.ModelCreator<[
    options: Anthropic.AiModelOptions
], Anthropic.AiModel>;
export declare namespace Anthropic {
    /**
     * IDs of models to use. See the [model endpoint
     * compatibility](https://docs.anthropic.com/en/docs/about-claude/models)
     * table for details on which models work with the Anthropic API.
     */
    type Model = AnthropicAiAdapter.Model;
    /**
     * Options for creating an Anthropic model.
     */
    interface AiModelOptions {
        /**
         * ID of the model to use. See the [model endpoint
         * compatibility](https://docs.anthropic.com/en/docs/about-claude/models)
         * table for details on which models work with the Anthropic API.
         */
        model: Model;
        /**
         * The Anthropic API key to use for authenticating your request. By default
         * we'll search for and use the `ANTHROPIC_API_KEY` environment variable.
         */
        apiKey?: string;
        /**
         * The beta headers to enable, eg. for computer use, prompt caching, and so
         * on
         */
        betaHeaders?: AnthropicAiAdapter.Beta[];
        /**
         * The base URL for the Anthropic API.
         *
         * @default "https://api.anthropic.com/v1/"
         */
        baseUrl?: string;
        /**
         * Default parameters to use for the model when calling.
         *
         * Note that common parameters like `messages` will likely be overwritten by
         * the adapter.
         */
        defaultParameters: Partial<AiAdapter.Input<AiModel>> & Required<Pick<AiAdapter.Input<AiModel>, "max_tokens">>;
    }
    /**
     * An Anthropic model using the Anthropic format for I/O.
     */
    interface AiModel extends AnthropicAiAdapter {
        options: AiModelOptions;
    }
}
//# sourceMappingURL=anthropic.d.ts.map
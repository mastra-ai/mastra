import { type AiAdapter } from "../adapter.js";
import { GrokAiAdapter } from "../adapters/grok.js";
import { type OpenAi } from "./openai.js";
/**
 * Create a Grok model using the OpenAI chat format.
 *
 * By default it targets the `https://api.x.ai/v1`
 * base URL.
 */
export declare const grok: AiAdapter.ModelCreator<[
    options: Grok.AiModelOptions
], Grok.AiModel>;
export declare namespace Grok {
    /**
     * IDs of models to use.
     */
    type Model = (string & {}) | "grok-2-1212" | "grok-2" | "grok-2-latest" | "grok-3" | "grok-3-latest";
    /**
     * Options for creating a Gemini model.
     */
    interface AiModelOptions extends Omit<OpenAi.AiModelOptions, "model"> {
        /**
         * ID of the model to use.
         */
        model: Grok.Model;
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
    type AiModel = GrokAiAdapter;
}
//# sourceMappingURL=grok.d.ts.map
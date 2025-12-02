import { type AiAdapter } from "../adapter.js";
import { type AzureOpenAiAiAdapter } from "../adapters/azure-openai.js";
import { type OpenAi } from "./openai.js";
/**
 * Creates an Azure OpenAI model that uses the OpenAI chat format.
 *
 * This model extends the base OpenAI model with Azure-specific configurations:
 * - Uses a custom endpoint URL format: `{endpoint}/openai/deployments/{deployment}/chat/completions`
 * - Requires an API version parameter in the URL
 * - Uses Azure's API key authentication instead of OpenAI's Bearer token
 *
 * The model inherits all input/output types from the OpenAI adapter but uses
 * Azure's endpoint structure and authentication method.
 */
export declare const azureOpenai: AiAdapter.ModelCreator<[
    options: AzureOpenAi.AiModelOptions
], AzureOpenAi.AiModel>;
export declare namespace AzureOpenAi {
    /** Reuse OpenAI's model type */
    type Model = OpenAi.Model;
    /**
     * Common deployment names for Azure OpenAI.
     * In Azure, deployments usually correspond to model names.
     */
    type Deployment = AzureOpenAiAiAdapter.Deployment;
    /**
     * Options for creating an Azure OpenAI model.
     * Extends OpenAI options but replaces baseUrl with Azure-specific fields:
     * - endpoint: The Azure OpenAI endpoint URL
     * - deployment: The deployment name for the model (usually corresponds to model name)
     * - apiVersion: The Azure OpenAI API version to use
     *
     * The Azure OpenAI API key can be provided via the `apiKey` option or the
     * `AZURE_OPENAI_API_KEY` environment variable.
     */
    interface AiModelOptions extends Omit<OpenAi.AiModelOptions, "baseUrl"> {
        endpoint: string;
        deployment: Deployment;
        apiVersion: string;
    }
    /**
     * An Azure OpenAI model that extends the OpenAI adapter.
     * Uses the same input/output types as OpenAI but with Azure-specific
     * endpoint structure and authentication.
     */
    interface AiModel extends AzureOpenAiAiAdapter {
        options: AiModelOptions;
    }
}
//# sourceMappingURL=azure-openai.d.ts.map
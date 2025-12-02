"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.azureOpenai = void 0;
const env_js_1 = require("../env.js");
const openai_js_1 = require("./openai.js");
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
const azureOpenai = (options) => {
    if (!options.endpoint) {
        throw new Error("Azure OpenAI endpoint is required");
    }
    const authKey = options.apiKey || (0, env_js_1.processEnv)(env_js_1.envKeys.AzureOpenAiApiKey) || "";
    // Create base OpenAI model with Azure endpoint
    const baseModel = (0, openai_js_1.openai)({
        model: options.model,
        apiKey: authKey,
        baseUrl: options.endpoint,
        defaultParameters: options.defaultParameters,
    });
    // Construct Azure-specific URL with deployment and API version
    const url = new URL(`openai/deployments/${options.deployment}/chat/completions`, options.endpoint);
    url.searchParams.set("api-version", options.apiVersion);
    return Object.assign(Object.assign({}, baseModel), { url: url.href, format: "azure-openai", onCall(_, body) {
            Object.assign(body, options.defaultParameters);
            body.model || (body.model = options.model);
        }, 
        // Override headers to use Azure's API key format
        headers: {
            "api-key": baseModel.authKey,
            "Content-Type": "application/json",
        }, options });
};
exports.azureOpenai = azureOpenai;
//# sourceMappingURL=azure-openai.js.map
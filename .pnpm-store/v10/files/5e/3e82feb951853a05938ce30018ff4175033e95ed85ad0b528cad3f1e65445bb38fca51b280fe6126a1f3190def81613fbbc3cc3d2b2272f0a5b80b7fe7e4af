"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiResponses = void 0;
const env_1 = require("../env");
/**
 * Create an OpenAI model using the OpenAI Responses API format.
 *
 * By default it targets the `https://api.openai.com/v1/` base URL.
 */
const openaiResponses = (options) => {
    const authKey = options.apiKey || (0, env_1.processEnv)(env_1.envKeys.OpenAiApiKey) || "";
    // Ensure trailing slash on base URL to avoid path replacement.
    let baseUrl = options.baseUrl || "https://api.openai.com/v1/";
    if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
    }
    const url = new URL("responses", baseUrl);
    return {
        url: url.href,
        authKey,
        format: "openai-responses",
        onCall(_, body) {
            Object.assign(body, options.defaultParameters);
            body.model || (body.model = options.model);
        },
        options,
    };
};
exports.openaiResponses = openaiResponses;
//# sourceMappingURL=openai-responses.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepseek = void 0;
const env_1 = require("../env");
/**
 * Create a DeepSeek model using the OpenAI-compatible chat format.
 *
 * By default it targets the `https://api.deepseek.com/v1/` base URL.
 */
const deepseek = (options) => {
    const authKey = options.apiKey || (0, env_1.processEnv)(env_1.envKeys.DeepSeekApiKey) || "";
    // Ensure we add a trailing slash to our base URL if it doesn't have one,
    // otherwise we'll replace the path instead of appending it.
    let baseUrl = options.baseUrl || "https://api.deepseek.com/v1/";
    if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
    }
    const url = new URL("chat/completions", baseUrl);
    return {
        url: url.href,
        authKey,
        format: "openai-chat",
        onCall(_, body) {
            Object.assign(body, options.defaultParameters);
            body.model || (body.model = options.model);
        },
        options,
    };
};
exports.deepseek = deepseek;
//# sourceMappingURL=deepseek.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envKeys = exports.processEnv = exports.allProcessEnv = void 0;
/**
 * allProcessEnv returns the current process environment variables, or an empty
 * object if they cannot be read, making sure we support environments other than
 * Node such as Deno, too.
 *
 * Using this ensures we don't dangerously access `process.env` in environments
 * where it may not be defined, such as Deno or the browser.
 */
const allProcessEnv = () => {
    // Node, or Node-like environments
    try {
        if (process.env) {
            return process.env;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }
    catch (_err) {
        // noop
    }
    // Deno
    try {
        const env = Deno.env.toObject();
        if (env) {
            return env;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }
    catch (_err) {
        // noop
    }
    // Netlify
    try {
        const env = Netlify.env.toObject();
        if (env) {
            return env;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }
    catch (_err) {
        // noop
    }
    return {};
};
exports.allProcessEnv = allProcessEnv;
const processEnv = (key) => {
    return (0, exports.allProcessEnv)()[key];
};
exports.processEnv = processEnv;
var envKeys;
(function (envKeys) {
    envKeys["OpenAiApiKey"] = "OPENAI_API_KEY";
    envKeys["GeminiApiKey"] = "GEMINI_API_KEY";
    envKeys["AnthropicApiKey"] = "ANTHROPIC_API_KEY";
    envKeys["DeepSeekApiKey"] = "DEEPSEEK_API_KEY";
    envKeys["GrokApiKey"] = "XAI_API_KEY";
    envKeys["AzureOpenAiApiKey"] = "AZURE_OPENAI_API_KEY";
})(envKeys || (exports.envKeys = envKeys = {}));
//# sourceMappingURL=env.js.map
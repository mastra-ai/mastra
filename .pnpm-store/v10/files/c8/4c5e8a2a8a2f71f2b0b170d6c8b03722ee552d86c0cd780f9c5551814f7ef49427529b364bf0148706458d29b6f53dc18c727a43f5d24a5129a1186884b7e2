"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grok = void 0;
const env_1 = require("../env");
const openai_js_1 = require("./openai.js");
/**
 * Create a Grok model using the OpenAI chat format.
 *
 * By default it targets the `https://api.x.ai/v1`
 * base URL.
 */
const grok = (options) => {
    const apiKey = options.apiKey || (0, env_1.processEnv)(env_1.envKeys.GrokApiKey);
    const baseUrl = options.baseUrl || "https://api.x.ai/v1";
    const model = options.model;
    const adapter = (0, openai_js_1.openai)(Object.assign(Object.assign({}, options), { apiKey,
        baseUrl,
        model }));
    adapter.format = "grok";
    return adapter;
};
exports.grok = grok;
//# sourceMappingURL=grok.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropic = void 0;
const env_1 = require("../env");
/**
 * Create an Anthropic model using the Anthropic chat format.
 *
 * By default it targets the `https://api.anthropic.com/v1/` base URL, with the
 * "2023-06-01" anthropic-version header.
 */
const anthropic = (options) => {
    var _a, _b;
    const authKey = options.apiKey || (0, env_1.processEnv)(env_1.envKeys.AnthropicApiKey) || "";
    // Ensure we add a trailing slash to our base URL if it doesn't have one,
    // otherwise we'll replace the path instead of appending it.
    let baseUrl = options.baseUrl || "https://api.anthropic.com/v1/";
    if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
    }
    const url = new URL("messages", baseUrl);
    const headers = {
        "anthropic-version": "2023-06-01",
    };
    if ((((_a = options.betaHeaders) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0) {
        headers["anthropic-beta"] = ((_b = options.betaHeaders) === null || _b === void 0 ? void 0 : _b.join(",")) || "";
    }
    return {
        url: url.href,
        authKey,
        format: "anthropic",
        onCall(_, body) {
            Object.assign(body, options.defaultParameters);
            body.model || (body.model = options.model);
        },
        headers,
        options,
    };
};
exports.anthropic = anthropic;
//# sourceMappingURL=anthropic.js.map
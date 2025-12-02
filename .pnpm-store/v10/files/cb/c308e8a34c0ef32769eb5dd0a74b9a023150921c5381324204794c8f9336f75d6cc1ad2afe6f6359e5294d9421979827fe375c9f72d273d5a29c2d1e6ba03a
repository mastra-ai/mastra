"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gemini = void 0;
const env_1 = require("../env");
/**
 * Create a Gemini model using the OpenAI chat format.
 *
 * By default it targets the `https://generativelanguage.googleapis.com/v1beta/`
 * base URL.
 */
const gemini = (options) => {
    const authKey = options.apiKey || (0, env_1.processEnv)(env_1.envKeys.GeminiApiKey) || "";
    // Ensure we add a trailing slash to our base URL if it doesn't have one,
    // otherwise we'll replace the path instead of appending it.
    let baseUrl = options.baseUrl || "https://generativelanguage.googleapis.com/v1beta/";
    if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
    }
    const url = new URL(`models/${options.model}:generateContent?key=${authKey}`, baseUrl);
    const headers = {};
    return {
        url: url.href,
        authKey,
        format: "gemini",
        onCall(_, body) {
            var _a;
            if (!options.defaultParameters) {
                return;
            }
            const _b = options.defaultParameters, { generationConfig: defaultGenerationConfig } = _b, otherDefaults = __rest(_b, ["generationConfig"]);
            // Assign top-level defaults first, user-provided values will override
            Object.assign(body, Object.assign(Object.assign({}, otherDefaults), body));
            // Then, deep-merge generationConfig
            if (defaultGenerationConfig) {
                body.generationConfig = Object.assign(Object.assign(Object.assign({}, defaultGenerationConfig), (body.generationConfig || {})), { 
                    // And ensure nested thinkingConfig is also deep-merged
                    thinkingConfig: Object.assign(Object.assign({}, defaultGenerationConfig.thinkingConfig), (((_a = body.generationConfig) === null || _a === void 0 ? void 0 : _a.thinkingConfig) || {})) });
            }
        },
        headers,
        options,
    };
};
exports.gemini = gemini;
//# sourceMappingURL=gemini.js.map
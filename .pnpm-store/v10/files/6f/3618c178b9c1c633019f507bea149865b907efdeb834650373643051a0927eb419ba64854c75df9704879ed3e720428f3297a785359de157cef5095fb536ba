"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertLegacyOptions = exports.isDeepgramClientOptions = exports.isLiveSchema = exports.buildRequestUrl = exports.convertProtocolToWs = exports.CallbackUrl = exports.isFileSource = exports.isTextSource = exports.isUrlSource = exports.resolveHeadersConstructor = exports.appendSearchParams = exports.applyDefaults = exports.stripTrailingSlash = void 0;
const cross_fetch_1 = require("cross-fetch");
const deepmerge_1 = __importDefault(require("deepmerge"));
function stripTrailingSlash(url) {
    return url.replace(/\/$/, "");
}
exports.stripTrailingSlash = stripTrailingSlash;
function applyDefaults(options = {}, subordinate = {}) {
    return (0, deepmerge_1.default)(subordinate, options);
}
exports.applyDefaults = applyDefaults;
function appendSearchParams(searchParams, options) {
    Object.keys(options).forEach((i) => {
        if (Array.isArray(options[i])) {
            const arrayParams = options[i];
            arrayParams.forEach((param) => {
                searchParams.append(i, String(param));
            });
        }
        else {
            searchParams.append(i, String(options[i]));
        }
    });
}
exports.appendSearchParams = appendSearchParams;
const resolveHeadersConstructor = () => {
    if (typeof Headers === "undefined") {
        return cross_fetch_1.Headers;
    }
    return Headers;
};
exports.resolveHeadersConstructor = resolveHeadersConstructor;
const isUrlSource = (providedSource) => {
    if (providedSource.url)
        return true;
    return false;
};
exports.isUrlSource = isUrlSource;
const isTextSource = (providedSource) => {
    if (providedSource.text)
        return true;
    return false;
};
exports.isTextSource = isTextSource;
const isFileSource = (providedSource) => {
    if (isReadStreamSource(providedSource) || isBufferSource(providedSource))
        return true;
    return false;
};
exports.isFileSource = isFileSource;
const isBufferSource = (providedSource) => {
    if (providedSource)
        return true;
    return false;
};
const isReadStreamSource = (providedSource) => {
    if (providedSource)
        return true;
    return false;
};
class CallbackUrl extends URL {
    constructor() {
        super(...arguments);
        this.callbackUrl = true;
    }
}
exports.CallbackUrl = CallbackUrl;
const convertProtocolToWs = (url) => {
    const convert = (string) => string.toLowerCase().replace(/^http/, "ws");
    return convert(url);
};
exports.convertProtocolToWs = convertProtocolToWs;
const buildRequestUrl = (endpoint, baseUrl, transcriptionOptions) => {
    const url = new URL(endpoint, baseUrl);
    appendSearchParams(url.searchParams, transcriptionOptions);
    return url;
};
exports.buildRequestUrl = buildRequestUrl;
function isLiveSchema(arg) {
    return arg && typeof arg.interim_results !== "undefined";
}
exports.isLiveSchema = isLiveSchema;
function isDeepgramClientOptions(arg) {
    return arg && typeof arg.global !== "undefined";
}
exports.isDeepgramClientOptions = isDeepgramClientOptions;
const convertLegacyOptions = (optionsArg) => {
    var _a, _b, _c, _d, _e, _f;
    const newOptions = {};
    if (optionsArg._experimentalCustomFetch) {
        newOptions.global = {
            fetch: {
                client: optionsArg._experimentalCustomFetch,
            },
        };
    }
    optionsArg = (0, deepmerge_1.default)(optionsArg, newOptions);
    if ((_a = optionsArg.restProxy) === null || _a === void 0 ? void 0 : _a.url) {
        newOptions.global = {
            fetch: {
                options: {
                    proxy: {
                        url: (_b = optionsArg.restProxy) === null || _b === void 0 ? void 0 : _b.url,
                    },
                },
            },
        };
    }
    optionsArg = (0, deepmerge_1.default)(optionsArg, newOptions);
    if ((_c = optionsArg.global) === null || _c === void 0 ? void 0 : _c.url) {
        newOptions.global = {
            fetch: {
                options: {
                    url: optionsArg.global.url,
                },
            },
            websocket: {
                options: {
                    url: optionsArg.global.url,
                },
            },
        };
    }
    optionsArg = (0, deepmerge_1.default)(optionsArg, newOptions);
    if ((_d = optionsArg.global) === null || _d === void 0 ? void 0 : _d.headers) {
        newOptions.global = {
            fetch: {
                options: {
                    headers: (_e = optionsArg.global) === null || _e === void 0 ? void 0 : _e.headers,
                },
            },
            websocket: {
                options: {
                    _nodeOnlyHeaders: (_f = optionsArg.global) === null || _f === void 0 ? void 0 : _f.headers,
                },
            },
        };
    }
    optionsArg = (0, deepmerge_1.default)(optionsArg, newOptions);
    return optionsArg;
};
exports.convertLegacyOptions = convertLegacyOptions;
//# sourceMappingURL=helpers.js.map
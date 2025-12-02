import { Headers as CrossFetchHeaders } from "cross-fetch";
import merge from "deepmerge";
export function stripTrailingSlash(url) {
    return url.replace(/\/$/, "");
}
export function applyDefaults(options = {}, subordinate = {}) {
    return merge(subordinate, options);
}
export function appendSearchParams(searchParams, options) {
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
export const resolveHeadersConstructor = () => {
    if (typeof Headers === "undefined") {
        return CrossFetchHeaders;
    }
    return Headers;
};
export const isUrlSource = (providedSource) => {
    if (providedSource.url)
        return true;
    return false;
};
export const isTextSource = (providedSource) => {
    if (providedSource.text)
        return true;
    return false;
};
export const isFileSource = (providedSource) => {
    if (isReadStreamSource(providedSource) || isBufferSource(providedSource))
        return true;
    return false;
};
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
export class CallbackUrl extends URL {
    constructor() {
        super(...arguments);
        this.callbackUrl = true;
    }
}
export const convertProtocolToWs = (url) => {
    const convert = (string) => string.toLowerCase().replace(/^http/, "ws");
    return convert(url);
};
export const buildRequestUrl = (endpoint, baseUrl, transcriptionOptions) => {
    const url = new URL(endpoint, baseUrl);
    appendSearchParams(url.searchParams, transcriptionOptions);
    return url;
};
export function isLiveSchema(arg) {
    return arg && typeof arg.interim_results !== "undefined";
}
export function isDeepgramClientOptions(arg) {
    return arg && typeof arg.global !== "undefined";
}
export const convertLegacyOptions = (optionsArg) => {
    var _a, _b, _c, _d, _e, _f;
    const newOptions = {};
    if (optionsArg._experimentalCustomFetch) {
        newOptions.global = {
            fetch: {
                client: optionsArg._experimentalCustomFetch,
            },
        };
    }
    optionsArg = merge(optionsArg, newOptions);
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
    optionsArg = merge(optionsArg, newOptions);
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
    optionsArg = merge(optionsArg, newOptions);
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
    optionsArg = merge(optionsArg, newOptions);
    return optionsArg;
};
//# sourceMappingURL=helpers.js.map
(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["static/chunks/78671_next_dist_client_4faed6._.js", {

"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-bootstrap.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * Before starting the Next.js runtime and requiring any module, we need to make
 * sure the following scripts are executed in the correct order:
 * - Polyfills
 * - next/script with `beforeInteractive` strategy
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "appBootstrap", {
    enumerable: true,
    get: function() {
        return appBootstrap;
    }
});
const version = "15.0.3";
window.next = {
    version,
    appDir: true
};
function loadScriptsInSequence(scripts, hydrate) {
    if (!scripts || !scripts.length) {
        return hydrate();
    }
    return scripts.reduce((promise, param)=>{
        let [src, props] = param;
        return promise.then(()=>{
            return new Promise((resolve, reject)=>{
                const el = document.createElement('script');
                if (props) {
                    for(const key in props){
                        if (key !== 'children') {
                            el.setAttribute(key, props[key]);
                        }
                    }
                }
                if (src) {
                    el.src = src;
                    el.onload = ()=>resolve();
                    el.onerror = reject;
                } else if (props) {
                    el.innerHTML = props.children;
                    setTimeout(resolve);
                }
                document.head.appendChild(el);
            });
        });
    }, Promise.resolve()).catch((err)=>{
        console.error(err);
    // Still try to hydrate even if there's an error.
    }).then(()=>{
        hydrate();
    });
}
function appBootstrap(callback) {
    loadScriptsInSequence(self.__next_s, ()=>{
        callback();
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-bootstrap.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/not-found.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    isNotFoundError: null,
    notFound: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    isNotFoundError: function() {
        return isNotFoundError;
    },
    notFound: function() {
        return notFound;
    }
});
const NOT_FOUND_ERROR_CODE = 'NEXT_NOT_FOUND';
function notFound() {
    // eslint-disable-next-line no-throw-literal
    const error = new Error(NOT_FOUND_ERROR_CODE);
    error.digest = NOT_FOUND_ERROR_CODE;
    throw error;
}
function isNotFoundError(error) {
    if (typeof error !== 'object' || error === null || !('digest' in error)) {
        return false;
    }
    return error.digest === NOT_FOUND_ERROR_CODE;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=not-found.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect-status-code.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RedirectStatusCode", {
    enumerable: true,
    get: function() {
        return RedirectStatusCode;
    }
});
var RedirectStatusCode;
(function(RedirectStatusCode) {
    RedirectStatusCode[RedirectStatusCode["SeeOther"] = 303] = "SeeOther";
    RedirectStatusCode[RedirectStatusCode["TemporaryRedirect"] = 307] = "TemporaryRedirect";
    RedirectStatusCode[RedirectStatusCode["PermanentRedirect"] = 308] = "PermanentRedirect";
})(RedirectStatusCode || (RedirectStatusCode = {}));
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=redirect-status-code.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    RedirectType: null,
    getRedirectError: null,
    getRedirectStatusCodeFromError: null,
    getRedirectTypeFromError: null,
    getURLFromRedirectError: null,
    isRedirectError: null,
    permanentRedirect: null,
    redirect: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    RedirectType: function() {
        return RedirectType;
    },
    getRedirectError: function() {
        return getRedirectError;
    },
    getRedirectStatusCodeFromError: function() {
        return getRedirectStatusCodeFromError;
    },
    getRedirectTypeFromError: function() {
        return getRedirectTypeFromError;
    },
    getURLFromRedirectError: function() {
        return getURLFromRedirectError;
    },
    isRedirectError: function() {
        return isRedirectError;
    },
    permanentRedirect: function() {
        return permanentRedirect;
    },
    redirect: function() {
        return redirect;
    }
});
const _actionasyncstorageexternal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/action-async-storage.external.js [app-client] (ecmascript)");
const _redirectstatuscode = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect-status-code.js [app-client] (ecmascript)");
const REDIRECT_ERROR_CODE = 'NEXT_REDIRECT';
var RedirectType;
(function(RedirectType) {
    RedirectType["push"] = "push";
    RedirectType["replace"] = "replace";
})(RedirectType || (RedirectType = {}));
function getRedirectError(url, type, statusCode) {
    if (statusCode === void 0) statusCode = _redirectstatuscode.RedirectStatusCode.TemporaryRedirect;
    const error = new Error(REDIRECT_ERROR_CODE);
    error.digest = REDIRECT_ERROR_CODE + ";" + type + ";" + url + ";" + statusCode + ";";
    return error;
}
function redirect(/** The URL to redirect to */ url, type) {
    const actionStore = _actionasyncstorageexternal.actionAsyncStorage.getStore();
    const redirectType = type || ((actionStore == null ? void 0 : actionStore.isAction) ? "push" : "replace");
    throw getRedirectError(url, redirectType, _redirectstatuscode.RedirectStatusCode.TemporaryRedirect);
}
function permanentRedirect(/** The URL to redirect to */ url, type) {
    if (type === void 0) type = "replace";
    throw getRedirectError(url, type, _redirectstatuscode.RedirectStatusCode.PermanentRedirect);
}
function isRedirectError(error) {
    if (typeof error !== 'object' || error === null || !('digest' in error) || typeof error.digest !== 'string') {
        return false;
    }
    const digest = error.digest.split(';');
    const [errorCode, type] = digest;
    const destination = digest.slice(2, -2).join(';');
    const status = digest.at(-2);
    const statusCode = Number(status);
    return errorCode === REDIRECT_ERROR_CODE && (type === 'replace' || type === 'push') && typeof destination === 'string' && !isNaN(statusCode) && statusCode in _redirectstatuscode.RedirectStatusCode;
}
function getURLFromRedirectError(error) {
    if (!isRedirectError(error)) return null;
    // Slices off the beginning of the digest that contains the code and the
    // separating ';'.
    return error.digest.split(';').slice(2, -2).join(';');
}
function getRedirectTypeFromError(error) {
    if (!isRedirectError(error)) {
        throw new Error('Not a redirect error');
    }
    return error.digest.split(';', 2)[1];
}
function getRedirectStatusCodeFromError(error) {
    if (!isRedirectError(error)) {
        throw new Error('Not a redirect error');
    }
    return Number(error.digest.split(';').at(-2));
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=redirect.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-next-router-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "isNextRouterError", {
    enumerable: true,
    get: function() {
        return isNextRouterError;
    }
});
const _notfound = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/not-found.js [app-client] (ecmascript)");
const _redirect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect.js [app-client] (ecmascript)");
function isNextRouterError(error) {
    return (0, _redirect.isRedirectError)(error) || (0, _notfound.isNotFoundError)(error);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=is-next-router-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/capture-stack-trace.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
// Polyfill for `Error.captureStackTrace` in browsers
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "captureStackTrace", {
    enumerable: true,
    get: function() {
        return captureStackTrace;
    }
});
function captureStackTrace(obj) {
    const container = new Error();
    Object.defineProperty(obj, 'stack', {
        configurable: true,
        get () {
            const { stack } = container;
            Object.defineProperty(this, 'stack', {
                value: stack
            });
            return stack;
        }
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=capture-stack-trace.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-hydration-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    getDefaultHydrationErrorMessage: null,
    getHydrationErrorStackInfo: null,
    isHydrationError: null,
    isReactHydrationErrorMessage: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    getDefaultHydrationErrorMessage: function() {
        return getDefaultHydrationErrorMessage;
    },
    getHydrationErrorStackInfo: function() {
        return getHydrationErrorStackInfo;
    },
    isHydrationError: function() {
        return isHydrationError;
    },
    isReactHydrationErrorMessage: function() {
        return isReactHydrationErrorMessage;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _iserror = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/is-error.js [app-client] (ecmascript)"));
const hydrationErrorRegex = /hydration failed|while hydrating|content does not match|did not match|HTML didn't match/i;
const reactUnifiedMismatchWarning = "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used";
const reactHydrationStartMessages = [
    reactUnifiedMismatchWarning,
    "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:"
];
const reactHydrationErrorDocLink = 'https://react.dev/link/hydration-mismatch';
const getDefaultHydrationErrorMessage = ()=>{
    return reactUnifiedMismatchWarning;
};
function isHydrationError(error) {
    return (0, _iserror.default)(error) && hydrationErrorRegex.test(error.message);
}
function isReactHydrationErrorMessage(msg) {
    return reactHydrationStartMessages.some((prefix)=>msg.startsWith(prefix));
}
function getHydrationErrorStackInfo(rawMessage) {
    rawMessage = rawMessage.replace(/^Error: /, '');
    if (!isReactHydrationErrorMessage(rawMessage)) {
        return {
            message: null
        };
    }
    const firstLineBreak = rawMessage.indexOf('\n');
    rawMessage = rawMessage.slice(firstLineBreak + 1).trim();
    const [message, trailing] = rawMessage.split("" + reactHydrationErrorDocLink);
    const trimmedMessage = message.trim();
    // React built-in hydration diff starts with a newline, checking if length is > 1
    if (trailing && trailing.length > 1) {
        const stacks = [];
        const diffs = [];
        trailing.split('\n').forEach((line)=>{
            if (line.trim() === '') return;
            if (line.trim().startsWith('at ')) {
                stacks.push(line);
            } else {
                diffs.push(line);
            }
        });
        return {
            message: trimmedMessage,
            link: reactHydrationErrorDocLink,
            diff: diffs.join('\n'),
            stack: stacks.join('\n')
        };
    } else {
        return {
            message: trimmedMessage,
            link: reactHydrationErrorDocLink,
            stack: trailing
        };
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=is-hydration-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/hydration-error-info.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    getHydrationWarningType: null,
    getReactHydrationDiffSegments: null,
    hydrationErrorState: null,
    storeHydrationErrorStateFromConsoleArgs: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    getHydrationWarningType: function() {
        return getHydrationWarningType;
    },
    getReactHydrationDiffSegments: function() {
        return getReactHydrationDiffSegments;
    },
    hydrationErrorState: function() {
        return hydrationErrorState;
    },
    storeHydrationErrorStateFromConsoleArgs: function() {
        return storeHydrationErrorStateFromConsoleArgs;
    }
});
const _ishydrationerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-hydration-error.js [app-client] (ecmascript)");
const hydrationErrorState = {};
// https://github.com/facebook/react/blob/main/packages/react-dom/src/__tests__/ReactDOMHydrationDiff-test.js used as a reference
const htmlTagsWarnings = new Set([
    'Warning: In HTML, %s cannot be a child of <%s>.%s\nThis will cause a hydration error.%s',
    'Warning: In HTML, %s cannot be a descendant of <%s>.\nThis will cause a hydration error.%s',
    'Warning: In HTML, text nodes cannot be a child of <%s>.\nThis will cause a hydration error.',
    "Warning: In HTML, whitespace text nodes cannot be a child of <%s>. Make sure you don't have any extra whitespace between tags on each line of your source code.\nThis will cause a hydration error.",
    'Warning: Expected server HTML to contain a matching <%s> in <%s>.%s',
    'Warning: Did not expect server HTML to contain a <%s> in <%s>.%s'
]);
const textAndTagsMismatchWarnings = new Set([
    'Warning: Expected server HTML to contain a matching text node for "%s" in <%s>.%s',
    'Warning: Did not expect server HTML to contain the text node "%s" in <%s>.%s'
]);
const textMismatchWarning = 'Warning: Text content did not match. Server: "%s" Client: "%s"%s';
const getHydrationWarningType = (message)=>{
    if (typeof message !== 'string') {
        // TODO: Doesn't make sense to treat no message as a hydration error message.
        // We should bail out somewhere earlier.
        return 'text';
    }
    const normalizedMessage = message.startsWith('Warning: ') ? message : "Warning: " + message;
    if (isHtmlTagsWarning(normalizedMessage)) return 'tag';
    if (isTextInTagsMismatchWarning(normalizedMessage)) return 'text-in-tag';
    return 'text';
};
const isHtmlTagsWarning = (message)=>htmlTagsWarnings.has(message);
const isTextMismatchWarning = (message)=>textMismatchWarning === message;
const isTextInTagsMismatchWarning = (msg)=>textAndTagsMismatchWarnings.has(msg);
const isKnownHydrationWarning = (message)=>{
    if (typeof message !== 'string') {
        return false;
    }
    // React 18 has the `Warning: ` prefix.
    // React 19 does not.
    const normalizedMessage = message.startsWith('Warning: ') ? message : "Warning: " + message;
    return isHtmlTagsWarning(normalizedMessage) || isTextInTagsMismatchWarning(normalizedMessage) || isTextMismatchWarning(normalizedMessage);
};
const getReactHydrationDiffSegments = (msg)=>{
    if (msg) {
        const { message, diff } = (0, _ishydrationerror.getHydrationErrorStackInfo)(msg);
        if (message) return [
            message,
            diff
        ];
    }
    return undefined;
};
function storeHydrationErrorStateFromConsoleArgs() {
    for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
        args[_key] = arguments[_key];
    }
    const [msg, serverContent, clientContent, componentStack] = args;
    if (isKnownHydrationWarning(msg)) {
        hydrationErrorState.warning = [
            // remove the last %s from the message
            msg,
            serverContent,
            clientContent
        ];
        hydrationErrorState.componentStack = componentStack;
        hydrationErrorState.serverContent = serverContent;
        hydrationErrorState.clientContent = clientContent;
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=hydration-error-info.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/attach-hydration-error-state.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "attachHydrationErrorState", {
    enumerable: true,
    get: function() {
        return attachHydrationErrorState;
    }
});
const _ishydrationerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-hydration-error.js [app-client] (ecmascript)");
const _hydrationerrorinfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/hydration-error-info.js [app-client] (ecmascript)");
function attachHydrationErrorState(error) {
    if ((0, _ishydrationerror.isHydrationError)(error) && !error.message.includes('https://nextjs.org/docs/messages/react-hydration-error')) {
        const reactHydrationDiffSegments = (0, _hydrationerrorinfo.getReactHydrationDiffSegments)(error.message);
        let parsedHydrationErrorState = {};
        if (reactHydrationDiffSegments) {
            parsedHydrationErrorState = {
                ...error.details,
                ..._hydrationerrorinfo.hydrationErrorState,
                warning: _hydrationerrorinfo.hydrationErrorState.warning || [
                    (0, _ishydrationerror.getDefaultHydrationErrorMessage)()
                ],
                notes: reactHydrationDiffSegments[0],
                reactOutputComponentDiff: reactHydrationDiffSegments[1]
            };
        } else {
            // If there's any extra information in the error message to display,
            // append it to the error message details property
            if (_hydrationerrorinfo.hydrationErrorState.warning) {
                // The patched console.error found hydration errors logged by React
                // Append the logged warning to the error message
                parsedHydrationErrorState = {
                    ...error.details,
                    // It contains the warning, component stack, server and client tag names
                    ..._hydrationerrorinfo.hydrationErrorState
                };
            }
        }
        error.details = parsedHydrationErrorState;
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=attach-hydration-error-state.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/lib/console.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "formatConsoleArgs", {
    enumerable: true,
    get: function() {
        return formatConsoleArgs;
    }
});
function formatObject(arg, depth) {
    switch(typeof arg){
        case 'object':
            if (arg === null) {
                return 'null';
            } else if (Array.isArray(arg)) {
                let result = '[';
                if (depth < 1) {
                    for(let i = 0; i < arg.length; i++){
                        if (result !== '[') {
                            result += ',';
                        }
                        if (Object.prototype.hasOwnProperty.call(arg, i)) {
                            result += formatObject(arg[i], depth + 1);
                        }
                    }
                } else {
                    result += arg.length > 0 ? '...' : '';
                }
                result += ']';
                return result;
            } else if (arg instanceof Error) {
                return arg + '';
            } else {
                const keys = Object.keys(arg);
                let result = '{';
                if (depth < 1) {
                    for(let i = 0; i < keys.length; i++){
                        const key = keys[i];
                        const desc = Object.getOwnPropertyDescriptor(arg, 'key');
                        if (desc && !desc.get && !desc.set) {
                            const jsonKey = JSON.stringify(key);
                            if (jsonKey !== '"' + key + '"') {
                                result += jsonKey + ': ';
                            } else {
                                result += key + ': ';
                            }
                            result += formatObject(desc.value, depth + 1);
                        }
                    }
                } else {
                    result += keys.length > 0 ? '...' : '';
                }
                result += '}';
                return result;
            }
        case 'string':
            return JSON.stringify(arg);
        default:
            return String(arg);
    }
}
function formatConsoleArgs(args) {
    let message;
    let idx;
    if (typeof args[0] === 'string') {
        message = args[0];
        idx = 1;
    } else {
        message = '';
        idx = 0;
    }
    let result = '';
    let startQuote = false;
    for(let i = 0; i < message.length; ++i){
        const char = message[i];
        if (char !== '%' || i === message.length - 1 || idx >= args.length) {
            result += char;
            continue;
        }
        const code = message[++i];
        switch(code){
            case 'c':
                {
                    // TODO: We should colorize with HTML instead of turning into a string.
                    // Ignore for now.
                    result = startQuote ? "" + result + "]" : "[" + result;
                    startQuote = !startQuote;
                    idx++;
                    break;
                }
            case 'O':
            case 'o':
                {
                    result += formatObject(args[idx++], 0);
                    break;
                }
            case 'd':
            case 'i':
                {
                    result += parseInt(args[idx++], 10);
                    break;
                }
            case 'f':
                {
                    result += parseFloat(args[idx++]);
                    break;
                }
            case 's':
                {
                    result += String(args[idx++]);
                    break;
                }
            default:
                result += '%' + code;
        }
    }
    for(; idx < args.length; idx++){
        result += (idx > 0 ? ' ' : '') + formatObject(args[idx], 0);
    }
    return result;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=console.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/console-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
// Represent non Error shape unhandled promise rejections or console.error errors.
// Those errors will be captured and displayed in Error Overlay.
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    createUnhandledError: null,
    isUnhandledConsoleOrRejection: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    createUnhandledError: function() {
        return createUnhandledError;
    },
    isUnhandledConsoleOrRejection: function() {
        return isUnhandledConsoleOrRejection;
    }
});
function createUnhandledError(message) {
    const error = new Error(message);
    error.digest = 'NEXT_UNHANDLED_ERROR';
    return error;
}
const isUnhandledConsoleOrRejection = (error)=>{
    return error && error.digest === 'NEXT_UNHANDLED_ERROR';
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=console-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/enqueue-client-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "enqueueConsecutiveDedupedError", {
    enumerable: true,
    get: function() {
        return enqueueConsecutiveDedupedError;
    }
});
const _ishydrationerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-hydration-error.js [app-client] (ecmascript)");
function enqueueConsecutiveDedupedError(queue, error) {
    const isFront = (0, _ishydrationerror.isHydrationError)(error);
    const previousError = isFront ? queue[0] : queue[queue.length - 1];
    // Compare the error stack to dedupe the consecutive errors
    if (previousError && previousError.stack === error.stack) {
        return;
    }
    // TODO: change all to push error into errorQueue,
    // currently there's a async api error is always erroring while hydration error showing up.
    // Move hydration error to the front of the queue to unblock.
    if (isFront) {
        queue.unshift(error);
    } else {
        queue.push(error);
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=enqueue-client-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stitched-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getReactStitchedError", {
    enumerable: true,
    get: function() {
        return getReactStitchedError;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _iserror = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/is-error.js [app-client] (ecmascript)"));
const REACT_ERROR_STACK_BOTTOM_FRAME = 'react-stack-bottom-frame';
const REACT_ERROR_STACK_BOTTOM_FRAME_REGEX = new RegExp("(at " + REACT_ERROR_STACK_BOTTOM_FRAME + " )|(" + REACT_ERROR_STACK_BOTTOM_FRAME + "\\@)");
const captureOwnerStack = _react.default.captureOwnerStack ? _react.default.captureOwnerStack : ()=>'';
function getReactStitchedError(err) {
    if (typeof _react.default.captureOwnerStack !== 'function') {
        return err;
    }
    const isErrorInstance = (0, _iserror.default)(err);
    const originStack = isErrorInstance ? err.stack || '' : '';
    const originMessage = isErrorInstance ? err.message : '';
    const stackLines = originStack.split('\n');
    const indexOfSplit = stackLines.findIndex((line)=>REACT_ERROR_STACK_BOTTOM_FRAME_REGEX.test(line));
    const isOriginalReactError = indexOfSplit >= 0 // has the react-stack-bottom-frame
    ;
    let newStack = isOriginalReactError ? stackLines.slice(0, indexOfSplit).join('\n') : originStack;
    const newError = new Error(originMessage);
    // Copy all enumerable properties, e.g. digest
    Object.assign(newError, err);
    newError.stack = newStack;
    // Avoid duplicate overriding stack frames
    appendOwnerStack(newError);
    return newError;
}
function appendOwnerStack(error) {
    let stack = error.stack || '';
    // Avoid duplicate overriding stack frames
    const ownerStack = captureOwnerStack();
    if (ownerStack && stack.endsWith(ownerStack) === false) {
        stack += ownerStack;
        // Override stack
        error.stack = stack;
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=stitched-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-error-handler.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    handleClientError: null,
    handleGlobalErrors: null,
    useErrorHandler: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    handleClientError: function() {
        return handleClientError;
    },
    handleGlobalErrors: function() {
        return handleGlobalErrors;
    },
    useErrorHandler: function() {
        return useErrorHandler;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _attachhydrationerrorstate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/attach-hydration-error-state.js [app-client] (ecmascript)");
const _isnextroutererror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-next-router-error.js [app-client] (ecmascript)");
const _hydrationerrorinfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/hydration-error-info.js [app-client] (ecmascript)");
const _console = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/lib/console.js [app-client] (ecmascript)");
const _iserror = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/is-error.js [app-client] (ecmascript)"));
const _consoleerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/console-error.js [app-client] (ecmascript)");
const _enqueueclienterror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/enqueue-client-error.js [app-client] (ecmascript)");
const _stitchederror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stitched-error.js [app-client] (ecmascript)");
const errorQueue = [];
const errorHandlers = [];
const rejectionQueue = [];
const rejectionHandlers = [];
function handleClientError(originError, consoleErrorArgs) {
    let error;
    if (!originError || !(0, _iserror.default)(originError)) {
        // If it's not an error, format the args into an error
        const formattedErrorMessage = (0, _console.formatConsoleArgs)(consoleErrorArgs);
        error = (0, _stitchederror.getReactStitchedError)((0, _consoleerror.createUnhandledError)(formattedErrorMessage));
    } else {
        error = originError;
    }
    (0, _hydrationerrorinfo.storeHydrationErrorStateFromConsoleArgs)(...consoleErrorArgs);
    (0, _attachhydrationerrorstate.attachHydrationErrorState)(error);
    (0, _enqueueclienterror.enqueueConsecutiveDedupedError)(errorQueue, error);
    for (const handler of errorHandlers){
        handler(error);
    }
}
function useErrorHandler(handleOnUnhandledError, handleOnUnhandledRejection) {
    (0, _react.useEffect)(()=>{
        // Handle queued errors.
        errorQueue.forEach(handleOnUnhandledError);
        rejectionQueue.forEach(handleOnUnhandledRejection);
        // Listen to new errors.
        errorHandlers.push(handleOnUnhandledError);
        rejectionHandlers.push(handleOnUnhandledRejection);
        return ()=>{
            // Remove listeners.
            errorHandlers.splice(errorHandlers.indexOf(handleOnUnhandledError), 1);
            rejectionHandlers.splice(rejectionHandlers.indexOf(handleOnUnhandledRejection), 1);
        };
    }, [
        handleOnUnhandledError,
        handleOnUnhandledRejection
    ]);
}
function onUnhandledError(event) {
    if ((0, _isnextroutererror.isNextRouterError)(event.error)) {
        event.preventDefault();
        return false;
    }
    handleClientError(event.error, []);
}
function onUnhandledRejection(ev) {
    const reason = ev == null ? void 0 : ev.reason;
    if ((0, _isnextroutererror.isNextRouterError)(reason)) {
        ev.preventDefault();
        return;
    }
    let error = reason;
    if (error && !(0, _iserror.default)(error)) {
        error = (0, _consoleerror.createUnhandledError)(error + '');
    }
    rejectionQueue.push(error);
    for (const handler of rejectionHandlers){
        handler(error);
    }
}
function handleGlobalErrors() {
    if (typeof window !== 'undefined') {
        try {
            // Increase the number of stack frames on the client
            Error.stackTraceLimit = 50;
        } catch (e) {}
        window.addEventListener('error', onUnhandledError);
        window.addEventListener('unhandledrejection', onUnhandledRejection);
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=use-error-handler.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/globals/intercept-console-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    originConsoleError: null,
    patchConsoleError: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    originConsoleError: function() {
        return originConsoleError;
    },
    patchConsoleError: function() {
        return patchConsoleError;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _iserror = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/is-error.js [app-client] (ecmascript)"));
const _isnextroutererror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-next-router-error.js [app-client] (ecmascript)");
const _capturestacktrace = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/capture-stack-trace.js [app-client] (ecmascript)");
const _useerrorhandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-error-handler.js [app-client] (ecmascript)");
const originConsoleError = window.console.error;
function patchConsoleError() {
    // Ensure it's only patched once
    if (typeof window === 'undefined') {
        return;
    }
    window.console.error = function error() {
        for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
            args[_key] = arguments[_key];
        }
        let maybeError;
        let isReplayedError = false;
        if ("TURBOPACK compile-time truthy", 1) {
            const replayedError = matchReplayedError(...args);
            if (replayedError) {
                isReplayedError = true;
                maybeError = replayedError;
            } else {
                // See https://github.com/facebook/react/blob/d50323eb845c5fde0d720cae888bf35dedd05506/packages/react-reconciler/src/ReactFiberErrorLogger.js#L78
                maybeError = args[1];
            }
        } else {
            "TURBOPACK unreachable";
        }
        if (!(0, _isnextroutererror.isNextRouterError)(maybeError)) {
            if ("TURBOPACK compile-time truthy", 1) {
                // Create an origin stack that pointing to the origin location of the error
                if (!isReplayedError && (0, _iserror.default)(maybeError)) {
                    (0, _capturestacktrace.captureStackTrace)(maybeError);
                }
                (0, _useerrorhandler.handleClientError)(// but if we pass the error directly, `handleClientError` will ignore it
                maybeError, args);
            }
            originConsoleError.apply(window.console, args);
        }
    };
}
function matchReplayedError() {
    for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
        args[_key] = arguments[_key];
    }
    // See
    // https://github.com/facebook/react/blob/65a56d0e99261481c721334a3ec4561d173594cd/packages/react-devtools-shared/src/backend/flight/renderer.js#L88-L93
    //
    // Logs replayed from the server look like this:
    // [
    //   "%c%s%c %o\n\n%s\n\n%s\n",
    //   "background: #e6e6e6; ...",
    //   " Server ", // can also be e.g. " Prerender "
    //   "",
    //   Error
    //   "The above error occurred in the <Page> component."
    //   ...
    // ]
    if (args.length > 3 && typeof args[0] === 'string' && args[0].startsWith('%c%s%c ') && typeof args[1] === 'string' && typeof args[2] === 'string' && typeof args[3] === 'string') {
        const maybeError = args[4];
        if ((0, _iserror.default)(maybeError)) {
            return maybeError;
        }
    }
    return null;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=intercept-console-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/globals/patch-console.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _interceptconsoleerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/globals/intercept-console-error.js [app-client] (ecmascript)");
(0, _interceptconsoleerror.patchConsoleError)();
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=patch-console.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/globals/handle-global-errors.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _useerrorhandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-error-handler.js [app-client] (ecmascript)");
(0, _useerrorhandler.handleGlobalErrors)();
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=handle-global-errors.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/react-client-callbacks/report-global-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "reportGlobalError", {
    enumerable: true,
    get: function() {
        return reportGlobalError;
    }
});
const reportGlobalError = typeof reportError === 'function' ? reportError : (error)=>{
    window.console.error(error);
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=report-global-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/react-client-callbacks/shared.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
// This module can be shared between both pages router and app router
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "onRecoverableError", {
    enumerable: true,
    get: function() {
        return onRecoverableError;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _bailouttocsr = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js [app-client] (ecmascript)");
const _reportglobalerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/react-client-callbacks/report-global-error.js [app-client] (ecmascript)");
const _stitchederror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stitched-error.js [app-client] (ecmascript)");
const _iserror = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/is-error.js [app-client] (ecmascript)"));
const onRecoverableError = (error, errorInfo)=>{
    // x-ref: https://github.com/facebook/react/pull/28736
    const cause = (0, _iserror.default)(error) && 'cause' in error ? error.cause : error;
    const stitchedError = (0, _stitchederror.getReactStitchedError)(cause);
    // In development mode, pass along the component stack to the error
    if (("TURBOPACK compile-time value", "development") === 'development' && errorInfo.componentStack) {
        stitchedError._componentStack = errorInfo.componentStack;
    }
    // Skip certain custom errors which are not expected to be reported on client
    if ((0, _bailouttocsr.isBailoutToCSRError)(cause)) return;
    (0, _reportglobalerror.reportGlobalError)(stitchedError);
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=shared.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/react-client-callbacks/app-router.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
// This file is only used in app router due to the specific error state handling.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    onCaughtError: null,
    onUncaughtError: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    onCaughtError: function() {
        return onCaughtError;
    },
    onUncaughtError: function() {
        return onUncaughtError;
    }
});
const _stitchederror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stitched-error.js [app-client] (ecmascript)");
const _useerrorhandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-error-handler.js [app-client] (ecmascript)");
const _isnextroutererror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-next-router-error.js [app-client] (ecmascript)");
const _bailouttocsr = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js [app-client] (ecmascript)");
const _reportglobalerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/react-client-callbacks/report-global-error.js [app-client] (ecmascript)");
const _interceptconsoleerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/globals/intercept-console-error.js [app-client] (ecmascript)");
const onCaughtError = (err, errorInfo)=>{
    // Skip certain custom errors which are not expected to be reported on client
    if ((0, _bailouttocsr.isBailoutToCSRError)(err) || (0, _isnextroutererror.isNextRouterError)(err)) return;
    if ("TURBOPACK compile-time truthy", 1) {
        var _errorInfo_errorBoundary, _errorInfo_componentStack;
        const errorBoundaryComponent = errorInfo == null ? void 0 : (_errorInfo_errorBoundary = errorInfo.errorBoundary) == null ? void 0 : _errorInfo_errorBoundary.constructor;
        const errorBoundaryName = (errorBoundaryComponent == null ? void 0 : errorBoundaryComponent.displayName) || (errorBoundaryComponent == null ? void 0 : errorBoundaryComponent.name) || 'Unknown';
        const componentThatErroredFrame = errorInfo == null ? void 0 : (_errorInfo_componentStack = errorInfo.componentStack) == null ? void 0 : _errorInfo_componentStack.split('\n')[1];
        var // example 1: at Page (http://localhost:3000/_next/static/chunks/pages/index.js?ts=1631600000000:2:1)
        // example 2: Page@http://localhost:3000/_next/static/chunks/pages/index.js?ts=1631600000000:2:1
        _componentThatErroredFrame_match;
        // Match chrome or safari stack trace
        const matches = (_componentThatErroredFrame_match = componentThatErroredFrame == null ? void 0 : componentThatErroredFrame.match(/\s+at (\w+)\s+|(\w+)@/)) != null ? _componentThatErroredFrame_match : [];
        const componentThatErroredName = matches[1] || matches[2] || 'Unknown';
        // Create error location with errored component and error boundary, to match the behavior of default React onCaughtError handler.
        const errorBoundaryMessage = "It was handled by the <" + errorBoundaryName + "> error boundary.";
        const componentErrorMessage = ("TURBOPACK compile-time truthy", 1) ? "The above error occurred in the <" + componentThatErroredName + "> component." : ("TURBOPACK unreachable", undefined);
        const errorLocation = componentErrorMessage + " " + errorBoundaryMessage;
        const stitchedError = (0, _stitchederror.getReactStitchedError)(err);
        // TODO: change to passing down errorInfo later
        // In development mode, pass along the component stack to the error
        if (errorInfo.componentStack) {
            stitchedError._componentStack = errorInfo.componentStack;
        }
        // Log and report the error with location but without modifying the error stack
        (0, _interceptconsoleerror.originConsoleError)('%o\n\n%s', err, errorLocation);
        (0, _useerrorhandler.handleClientError)(stitchedError, []);
    } else {
        "TURBOPACK unreachable";
    }
};
const onUncaughtError = (err, errorInfo)=>{
    // Skip certain custom errors which are not expected to be reported on client
    if ((0, _bailouttocsr.isBailoutToCSRError)(err) || (0, _isnextroutererror.isNextRouterError)(err)) return;
    if ("TURBOPACK compile-time truthy", 1) {
        var _errorInfo_componentStack;
        const componentThatErroredFrame = errorInfo == null ? void 0 : (_errorInfo_componentStack = errorInfo.componentStack) == null ? void 0 : _errorInfo_componentStack.split('\n')[1];
        var _componentThatErroredFrame_match;
        // Match chrome or safari stack trace
        const matches = (_componentThatErroredFrame_match = componentThatErroredFrame == null ? void 0 : componentThatErroredFrame.match(/\s+at (\w+)\s+|(\w+)@/)) != null ? _componentThatErroredFrame_match : [];
        const componentThatErroredName = matches[1] || matches[2] || 'Unknown';
        // Create error location with errored component and error boundary, to match the behavior of default React onCaughtError handler.
        const errorLocation = ("TURBOPACK compile-time truthy", 1) ? "The above error occurred in the <" + componentThatErroredName + "> component." : ("TURBOPACK unreachable", undefined);
        const stitchedError = (0, _stitchederror.getReactStitchedError)(err);
        // TODO: change to passing down errorInfo later
        // In development mode, pass along the component stack to the error
        if (errorInfo.componentStack) {
            stitchedError._componentStack = errorInfo.componentStack;
        }
        // Log and report the error with location but without modifying the error stack
        (0, _interceptconsoleerror.originConsoleError)('%o\n\n%s', err, errorLocation);
        (0, _reportglobalerror.reportGlobalError)(stitchedError);
    } else {
        "TURBOPACK unreachable";
    }
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-router.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    ACTION_HMR_REFRESH: null,
    ACTION_NAVIGATE: null,
    ACTION_PREFETCH: null,
    ACTION_REFRESH: null,
    ACTION_RESTORE: null,
    ACTION_SERVER_ACTION: null,
    ACTION_SERVER_PATCH: null,
    PrefetchCacheEntryStatus: null,
    PrefetchKind: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    ACTION_HMR_REFRESH: function() {
        return ACTION_HMR_REFRESH;
    },
    ACTION_NAVIGATE: function() {
        return ACTION_NAVIGATE;
    },
    ACTION_PREFETCH: function() {
        return ACTION_PREFETCH;
    },
    ACTION_REFRESH: function() {
        return ACTION_REFRESH;
    },
    ACTION_RESTORE: function() {
        return ACTION_RESTORE;
    },
    ACTION_SERVER_ACTION: function() {
        return ACTION_SERVER_ACTION;
    },
    ACTION_SERVER_PATCH: function() {
        return ACTION_SERVER_PATCH;
    },
    PrefetchCacheEntryStatus: function() {
        return PrefetchCacheEntryStatus;
    },
    PrefetchKind: function() {
        return PrefetchKind;
    }
});
const ACTION_REFRESH = 'refresh';
const ACTION_NAVIGATE = 'navigate';
const ACTION_RESTORE = 'restore';
const ACTION_SERVER_PATCH = 'server-patch';
const ACTION_PREFETCH = 'prefetch';
const ACTION_HMR_REFRESH = 'hmr-refresh';
const ACTION_SERVER_ACTION = 'server-action';
var PrefetchKind;
(function(PrefetchKind) {
    PrefetchKind["AUTO"] = "auto";
    PrefetchKind["FULL"] = "full";
    PrefetchKind["TEMPORARY"] = "temporary";
})(PrefetchKind || (PrefetchKind = {}));
var PrefetchCacheEntryStatus;
(function(PrefetchCacheEntryStatus) {
    PrefetchCacheEntryStatus["fresh"] = "fresh";
    PrefetchCacheEntryStatus["reusable"] = "reusable";
    PrefetchCacheEntryStatus["expired"] = "expired";
    PrefetchCacheEntryStatus["stale"] = "stale";
})(PrefetchCacheEntryStatus || (PrefetchCacheEntryStatus = {}));
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=router-reducer-types.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-call-server.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    callServer: null,
    useServerActionDispatcher: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    callServer: function() {
        return callServer;
    },
    useServerActionDispatcher: function() {
        return useServerActionDispatcher;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
let globalServerActionDispatcher = null;
function useServerActionDispatcher(dispatch) {
    const serverActionDispatcher = (0, _react.useCallback)((actionPayload)=>{
        (0, _react.startTransition)(()=>{
            dispatch({
                ...actionPayload,
                type: _routerreducertypes.ACTION_SERVER_ACTION
            });
        });
    }, [
        dispatch
    ]);
    globalServerActionDispatcher = serverActionDispatcher;
}
async function callServer(actionId, actionArgs) {
    const actionDispatcher = globalServerActionDispatcher;
    if (!actionDispatcher) {
        throw new Error('Invariant: missing action dispatcher.');
    }
    return new Promise((resolve, reject)=>{
        actionDispatcher({
            actionId,
            actionArgs,
            resolve,
            reject
        });
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-call-server.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-find-source-map-url.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "findSourceMapURL", {
    enumerable: true,
    get: function() {
        return findSourceMapURL;
    }
});
const basePath = ("TURBOPACK compile-time value", "") || '';
const pathname = "" + basePath + "/__nextjs_source-map";
const findSourceMapURL = ("TURBOPACK compile-time truthy", 1) ? function findSourceMapURL(filename) {
    if (filename === '') {
        return null;
    }
    const url = new URL(pathname, document.location.origin);
    url.searchParams.set('filename', filename.replace(new RegExp("^" + document.location.origin + basePath), ''));
    return url.href;
} : ("TURBOPACK unreachable", undefined);
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-find-source-map-url.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router-headers.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    ACTION_HEADER: null,
    FLIGHT_HEADERS: null,
    NEXT_DID_POSTPONE_HEADER: null,
    NEXT_HMR_REFRESH_HEADER: null,
    NEXT_IS_PRERENDER_HEADER: null,
    NEXT_ROUTER_PREFETCH_HEADER: null,
    NEXT_ROUTER_SEGMENT_PREFETCH_HEADER: null,
    NEXT_ROUTER_STALE_TIME_HEADER: null,
    NEXT_ROUTER_STATE_TREE_HEADER: null,
    NEXT_RSC_UNION_QUERY: null,
    NEXT_URL: null,
    RSC_CONTENT_TYPE_HEADER: null,
    RSC_HEADER: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    ACTION_HEADER: function() {
        return ACTION_HEADER;
    },
    FLIGHT_HEADERS: function() {
        return FLIGHT_HEADERS;
    },
    NEXT_DID_POSTPONE_HEADER: function() {
        return NEXT_DID_POSTPONE_HEADER;
    },
    NEXT_HMR_REFRESH_HEADER: function() {
        return NEXT_HMR_REFRESH_HEADER;
    },
    NEXT_IS_PRERENDER_HEADER: function() {
        return NEXT_IS_PRERENDER_HEADER;
    },
    NEXT_ROUTER_PREFETCH_HEADER: function() {
        return NEXT_ROUTER_PREFETCH_HEADER;
    },
    NEXT_ROUTER_SEGMENT_PREFETCH_HEADER: function() {
        return NEXT_ROUTER_SEGMENT_PREFETCH_HEADER;
    },
    NEXT_ROUTER_STALE_TIME_HEADER: function() {
        return NEXT_ROUTER_STALE_TIME_HEADER;
    },
    NEXT_ROUTER_STATE_TREE_HEADER: function() {
        return NEXT_ROUTER_STATE_TREE_HEADER;
    },
    NEXT_RSC_UNION_QUERY: function() {
        return NEXT_RSC_UNION_QUERY;
    },
    NEXT_URL: function() {
        return NEXT_URL;
    },
    RSC_CONTENT_TYPE_HEADER: function() {
        return RSC_CONTENT_TYPE_HEADER;
    },
    RSC_HEADER: function() {
        return RSC_HEADER;
    }
});
const RSC_HEADER = 'RSC';
const ACTION_HEADER = 'Next-Action';
const NEXT_ROUTER_STATE_TREE_HEADER = 'Next-Router-State-Tree';
const NEXT_ROUTER_PREFETCH_HEADER = 'Next-Router-Prefetch';
const NEXT_ROUTER_SEGMENT_PREFETCH_HEADER = 'Next-Router-Segment-Prefetch';
const NEXT_HMR_REFRESH_HEADER = 'Next-HMR-Refresh';
const NEXT_URL = 'Next-Url';
const RSC_CONTENT_TYPE_HEADER = 'text/x-component';
const FLIGHT_HEADERS = [
    RSC_HEADER,
    NEXT_ROUTER_STATE_TREE_HEADER,
    NEXT_ROUTER_PREFETCH_HEADER,
    NEXT_HMR_REFRESH_HEADER,
    NEXT_ROUTER_SEGMENT_PREFETCH_HEADER
];
const NEXT_RSC_UNION_QUERY = '_rsc';
const NEXT_ROUTER_STALE_TIME_HEADER = 'x-nextjs-stale-time';
const NEXT_DID_POSTPONE_HEADER = 'x-nextjs-postponed';
const NEXT_IS_PRERENDER_HEADER = 'x-nextjs-prerender';
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-router-headers.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    getFlightDataPartsFromPath: null,
    getNextFlightSegmentPath: null,
    normalizeFlightData: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    getFlightDataPartsFromPath: function() {
        return getFlightDataPartsFromPath;
    },
    getNextFlightSegmentPath: function() {
        return getNextFlightSegmentPath;
    },
    normalizeFlightData: function() {
        return normalizeFlightData;
    }
});
function getFlightDataPartsFromPath(flightDataPath) {
    // tree, seedData, and head are *always* the last three items in the `FlightDataPath`.
    const [tree, seedData, head] = flightDataPath.slice(-3);
    // The `FlightSegmentPath` is everything except the last three items. For a root render, it won't be present.
    const segmentPath = flightDataPath.slice(0, -3);
    var _segmentPath_;
    return {
        // TODO: Unify these two segment path helpers. We are inconsistently pushing an empty segment ("")
        // to the start of the segment path in some places which makes it hard to use solely the segment path.
        // Look for "// TODO-APP: remove ''" in the codebase.
        pathToSegment: segmentPath.slice(0, -1),
        segmentPath,
        // if the `FlightDataPath` corresponds with the root, there'll be no segment path,
        // in which case we default to ''.
        segment: (_segmentPath_ = segmentPath[segmentPath.length - 1]) != null ? _segmentPath_ : '',
        tree,
        seedData,
        head,
        isRootRender: flightDataPath.length === 3
    };
}
function getNextFlightSegmentPath(flightSegmentPath) {
    // Since `FlightSegmentPath` is a repeated tuple of `Segment` and `ParallelRouteKey`, we slice off two items
    // to get the next segment path.
    return flightSegmentPath.slice(2);
}
function normalizeFlightData(flightData) {
    // FlightData can be a string when the server didn't respond with a proper flight response,
    // or when a redirect happens, to signal to the client that it needs to perform an MPA navigation.
    if (typeof flightData === 'string') {
        return flightData;
    }
    return flightData.map(getFlightDataPartsFromPath);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=flight-data-helpers.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "fetchServerResponse", {
    enumerable: true,
    get: function() {
        return fetchServerResponse;
    }
});
const _approuterheaders = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router-headers.js [app-client] (ecmascript)");
const _appcallserver = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-call-server.js [app-client] (ecmascript)");
const _appfindsourcemapurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-find-source-map-url.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _hash = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/hash.js [app-client] (ecmascript)");
const _flightdatahelpers = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)");
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
// import { createFromReadableStream } from 'react-server-dom-webpack/client'
const { createFromReadableStream } = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/client.js [app-client] (ecmascript)");
function urlToUrlWithoutFlightMarker(url) {
    const urlWithoutFlightParameters = new URL(url, location.origin);
    urlWithoutFlightParameters.searchParams.delete(_approuterheaders.NEXT_RSC_UNION_QUERY);
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    return urlWithoutFlightParameters;
}
function doMpaNavigation(url) {
    return {
        flightData: urlToUrlWithoutFlightMarker(url).toString(),
        canonicalUrl: undefined,
        couldBeIntercepted: false,
        prerendered: false,
        postponed: false,
        staleTime: -1
    };
}
async function fetchServerResponse(url, options) {
    const { flightRouterState, nextUrl, buildId, prefetchKind } = options;
    const headers = {
        // Enable flight response
        [_approuterheaders.RSC_HEADER]: '1',
        // Provide the current router state
        [_approuterheaders.NEXT_ROUTER_STATE_TREE_HEADER]: encodeURIComponent(JSON.stringify(flightRouterState))
    };
    /**
   * Three cases:
   * - `prefetchKind` is `undefined`, it means it's a normal navigation, so we want to prefetch the page data fully
   * - `prefetchKind` is `full` - we want to prefetch the whole page so same as above
   * - `prefetchKind` is `auto` - if the page is dynamic, prefetch the page data partially, if static prefetch the page data fully
   */ if (prefetchKind === _routerreducertypes.PrefetchKind.AUTO) {
        headers[_approuterheaders.NEXT_ROUTER_PREFETCH_HEADER] = '1';
    }
    if (("TURBOPACK compile-time value", "development") === 'development' && options.isHmrRefresh) {
        headers[_approuterheaders.NEXT_HMR_REFRESH_HEADER] = '1';
    }
    if (nextUrl) {
        headers[_approuterheaders.NEXT_URL] = nextUrl;
    }
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    const uniqueCacheQuery = (0, _hash.hexHash)([
        headers[_approuterheaders.NEXT_ROUTER_PREFETCH_HEADER] || '0',
        headers[_approuterheaders.NEXT_ROUTER_STATE_TREE_HEADER],
        headers[_approuterheaders.NEXT_URL]
    ].join(','));
    try {
        var _res_headers_get;
        let fetchUrl = new URL(url);
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
        // Add unique cache query to avoid caching conflicts on CDN which don't respect the Vary header
        fetchUrl.searchParams.set(_approuterheaders.NEXT_RSC_UNION_QUERY, uniqueCacheQuery);
        // When creating a "temporary" prefetch (the "on-demand" prefetch that gets created on navigation, if one doesn't exist)
        // we send the request with a "high" priority as it's in response to a user interaction that could be blocking a transition.
        // Otherwise, all other prefetches are sent with a "low" priority.
        // We use "auto" for in all other cases to match the existing default, as this function is shared outside of prefetching.
        const fetchPriority = prefetchKind ? prefetchKind === _routerreducertypes.PrefetchKind.TEMPORARY ? 'high' : 'low' : 'auto';
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
        const res = await fetch(fetchUrl, {
            // Backwards compat for older browsers. `same-origin` is the default in modern browsers.
            credentials: 'same-origin',
            headers,
            priority: fetchPriority
        });
        const responseUrl = urlToUrlWithoutFlightMarker(res.url);
        const canonicalUrl = res.redirected ? responseUrl : undefined;
        const contentType = res.headers.get('content-type') || '';
        const interception = !!((_res_headers_get = res.headers.get('vary')) == null ? void 0 : _res_headers_get.includes(_approuterheaders.NEXT_URL));
        const postponed = !!res.headers.get(_approuterheaders.NEXT_DID_POSTPONE_HEADER);
        const staleTimeHeader = res.headers.get(_approuterheaders.NEXT_ROUTER_STALE_TIME_HEADER);
        const staleTime = staleTimeHeader !== null ? parseInt(staleTimeHeader, 10) : -1;
        let isFlightResponse = contentType.startsWith(_approuterheaders.RSC_CONTENT_TYPE_HEADER);
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
        // If fetch returns something different than flight response handle it like a mpa navigation
        // If the fetch was not 200, we also handle it like a mpa navigation
        if (!isFlightResponse || !res.ok || !res.body) {
            // in case the original URL came with a hash, preserve it before redirecting to the new URL
            if (url.hash) {
                responseUrl.hash = url.hash;
            }
            return doMpaNavigation(responseUrl.toString());
        }
        // We may navigate to a page that requires a different Webpack runtime.
        // In prod, every page will have the same Webpack runtime.
        // In dev, the Webpack runtime is minimal for each page.
        // We need to ensure the Webpack runtime is updated before executing client-side JS of the new page.
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
        // Handle the `fetch` readable stream that can be unwrapped by `React.use`.
        const flightStream = postponed ? createUnclosingPrefetchStream(res.body) : res.body;
        const response = await createFromReadableStream(flightStream, {
            callServer: _appcallserver.callServer,
            findSourceMapURL: _appfindsourcemapurl.findSourceMapURL
        });
        if (buildId !== response.b) {
            return doMpaNavigation(res.url);
        }
        return {
            flightData: (0, _flightdatahelpers.normalizeFlightData)(response.f),
            canonicalUrl: canonicalUrl,
            couldBeIntercepted: interception,
            prerendered: response.S,
            postponed,
            staleTime
        };
    } catch (err) {
        console.error("Failed to fetch RSC payload for " + url + ". Falling back to browser navigation.", err);
        // If fetch fails handle it like a mpa navigation
        // TODO-APP: Add a test for the case where a CORS request fails, e.g. external url redirect coming from the response.
        // See https://github.com/vercel/next.js/issues/43605#issuecomment-1451617521 for a reproduction.
        return {
            flightData: url.toString(),
            canonicalUrl: undefined,
            couldBeIntercepted: false,
            prerendered: false,
            postponed: false,
            staleTime: -1
        };
    }
}
function createUnclosingPrefetchStream(originalFlightStream) {
    // When PPR is enabled, prefetch streams may contain references that never
    // resolve, because that's how we encode dynamic data access. In the decoded
    // object returned by the Flight client, these are reified into hanging
    // promises that suspend during render, which is effectively what we want.
    // The UI resolves when it switches to the dynamic data stream
    // (via useDeferredValue(dynamic, static)).
    //
    // However, the Flight implementation currently errors if the server closes
    // the response before all the references are resolved. As a cheat to work
    // around this, we wrap the original stream in a new stream that never closes,
    // and therefore doesn't error.
    const reader = originalFlightStream.getReader();
    return new ReadableStream({
        async pull (controller) {
            while(true){
                const { done, value } = await reader.read();
                if (!done) {
                    // Pass to the target stream and keep consuming the Flight response
                    // from the server.
                    controller.enqueue(value);
                    continue;
                }
                // The server stream has closed. Exit, but intentionally do not close
                // the target stream.
                return;
            }
        }
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=fetch-server-response.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createHrefFromUrl", {
    enumerable: true,
    get: function() {
        return createHrefFromUrl;
    }
});
function createHrefFromUrl(url, includeHash) {
    if (includeHash === void 0) includeHash = true;
    return url.pathname + url.search + (includeHash ? url.hash : '');
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=create-href-from-url.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createRouterCacheKey", {
    enumerable: true,
    get: function() {
        return createRouterCacheKey;
    }
});
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
function createRouterCacheKey(segment, withoutSearchParameters) {
    if (withoutSearchParameters === void 0) withoutSearchParameters = false;
    // if the segment is an array, it means it's a dynamic segment
    // for example, ['lang', 'en', 'd']. We need to convert it to a string to store it as a cache node key.
    if (Array.isArray(segment)) {
        return segment[0] + "|" + segment[1] + "|" + segment[2];
    }
    // Page segments might have search parameters, ie __PAGE__?foo=bar
    // When `withoutSearchParameters` is true, we only want to return the page segment
    if (withoutSearchParameters && segment.startsWith(_segment.PAGE_SEGMENT_KEY)) {
        return _segment.PAGE_SEGMENT_KEY;
    }
    return segment;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=create-router-cache-key.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/invalidate-cache-below-flight-segmentpath.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "invalidateCacheBelowFlightSegmentPath", {
    enumerable: true,
    get: function() {
        return invalidateCacheBelowFlightSegmentPath;
    }
});
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
const _flightdatahelpers = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)");
function invalidateCacheBelowFlightSegmentPath(newCache, existingCache, flightSegmentPath) {
    const isLastEntry = flightSegmentPath.length <= 2;
    const [parallelRouteKey, segment] = flightSegmentPath;
    const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(segment);
    const existingChildSegmentMap = existingCache.parallelRoutes.get(parallelRouteKey);
    if (!existingChildSegmentMap) {
        // Bailout because the existing cache does not have the path to the leaf node
        // Will trigger lazy fetch in layout-router because of missing segment
        return;
    }
    let childSegmentMap = newCache.parallelRoutes.get(parallelRouteKey);
    if (!childSegmentMap || childSegmentMap === existingChildSegmentMap) {
        childSegmentMap = new Map(existingChildSegmentMap);
        newCache.parallelRoutes.set(parallelRouteKey, childSegmentMap);
    }
    // In case of last entry don't copy further down.
    if (isLastEntry) {
        childSegmentMap.delete(cacheKey);
        return;
    }
    const existingChildCacheNode = existingChildSegmentMap.get(cacheKey);
    let childCacheNode = childSegmentMap.get(cacheKey);
    if (!childCacheNode || !existingChildCacheNode) {
        // Bailout because the existing cache does not have the path to the leaf node
        // Will trigger lazy fetch in layout-router because of missing segment
        return;
    }
    if (childCacheNode === existingChildCacheNode) {
        childCacheNode = {
            lazyData: childCacheNode.lazyData,
            rsc: childCacheNode.rsc,
            prefetchRsc: childCacheNode.prefetchRsc,
            head: childCacheNode.head,
            prefetchHead: childCacheNode.prefetchHead,
            parallelRoutes: new Map(childCacheNode.parallelRoutes)
        };
        childSegmentMap.set(cacheKey, childCacheNode);
    }
    invalidateCacheBelowFlightSegmentPath(childCacheNode, existingChildCacheNode, (0, _flightdatahelpers.getNextFlightSegmentPath)(flightSegmentPath));
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=invalidate-cache-below-flight-segmentpath.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/match-segments.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    canSegmentBeOverridden: null,
    matchSegment: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    canSegmentBeOverridden: function() {
        return canSegmentBeOverridden;
    },
    matchSegment: function() {
        return matchSegment;
    }
});
const _getsegmentparam = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/get-segment-param.js [app-client] (ecmascript)");
const matchSegment = (existingSegment, segment)=>{
    // segment is either Array or string
    if (typeof existingSegment === 'string') {
        if (typeof segment === 'string') {
            // Common case: segment is just a string
            return existingSegment === segment;
        }
        return false;
    }
    if (typeof segment === 'string') {
        return false;
    }
    return existingSegment[0] === segment[0] && existingSegment[1] === segment[1];
};
const canSegmentBeOverridden = (existingSegment, segment)=>{
    var _getSegmentParam;
    if (Array.isArray(existingSegment) || !Array.isArray(segment)) {
        return false;
    }
    return ((_getSegmentParam = (0, _getsegmentparam.getSegmentParam)(existingSegment)) == null ? void 0 : _getSegmentParam.param) === segment[0];
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=match-segments.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-lazy-items-till-leaf-with-head.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "fillLazyItemsTillLeafWithHead", {
    enumerable: true,
    get: function() {
        return fillLazyItemsTillLeafWithHead;
    }
});
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
function fillLazyItemsTillLeafWithHead(newCache, existingCache, routerState, cacheNodeSeedData, head, prefetchEntry) {
    const isLastSegment = Object.keys(routerState[1]).length === 0;
    if (isLastSegment) {
        newCache.head = head;
        return;
    }
    // Remove segment that we got data for so that it is filled in during rendering of rsc.
    for(const key in routerState[1]){
        const parallelRouteState = routerState[1][key];
        const segmentForParallelRoute = parallelRouteState[0];
        const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(segmentForParallelRoute);
        // TODO: We should traverse the cacheNodeSeedData tree instead of the router
        // state tree. Ideally, they would always be the same shape, but because of
        // the loading.js pattern, cacheNodeSeedData sometimes only represents a
        // partial tree. That's why this node is sometimes null. Once PPR lands,
        // loading.js will no longer have special behavior and we can traverse the
        // data tree instead.
        //
        // We should also consider merging the router state tree and the data tree
        // in the response format, so that we don't have to send the keys twice.
        // Then the client can convert them into separate representations.
        const parallelSeedData = cacheNodeSeedData !== null && cacheNodeSeedData[2][key] !== undefined ? cacheNodeSeedData[2][key] : null;
        if (existingCache) {
            const existingParallelRoutesCacheNode = existingCache.parallelRoutes.get(key);
            if (existingParallelRoutesCacheNode) {
                const hasReusablePrefetch = (prefetchEntry == null ? void 0 : prefetchEntry.kind) === 'auto' && prefetchEntry.status === _routerreducertypes.PrefetchCacheEntryStatus.reusable;
                let parallelRouteCacheNode = new Map(existingParallelRoutesCacheNode);
                const existingCacheNode = parallelRouteCacheNode.get(cacheKey);
                let newCacheNode;
                if (parallelSeedData !== null) {
                    // New data was sent from the server.
                    const seedNode = parallelSeedData[1];
                    const loading = parallelSeedData[3];
                    newCacheNode = {
                        lazyData: null,
                        rsc: seedNode,
                        // This is a PPR-only field. When PPR is enabled, we shouldn't hit
                        // this path during a navigation, but until PPR is fully implemented
                        // yet it's possible the existing node does have a non-null
                        // `prefetchRsc`. As an incremental step, we'll just de-opt to the
                        // old behavior — no PPR value.
                        prefetchRsc: null,
                        head: null,
                        prefetchHead: null,
                        loading,
                        parallelRoutes: new Map(existingCacheNode == null ? void 0 : existingCacheNode.parallelRoutes)
                    };
                } else if (hasReusablePrefetch && existingCacheNode) {
                    // No new data was sent from the server, but the existing cache node
                    // was prefetched, so we should reuse that.
                    newCacheNode = {
                        lazyData: existingCacheNode.lazyData,
                        rsc: existingCacheNode.rsc,
                        // This is a PPR-only field. Unlike the previous branch, since we're
                        // just cloning the existing cache node, we might as well keep the
                        // PPR value, if it exists.
                        prefetchRsc: existingCacheNode.prefetchRsc,
                        head: existingCacheNode.head,
                        prefetchHead: existingCacheNode.prefetchHead,
                        parallelRoutes: new Map(existingCacheNode.parallelRoutes),
                        loading: existingCacheNode.loading
                    };
                } else {
                    // No data available for this node. This will trigger a lazy fetch
                    // during render.
                    newCacheNode = {
                        lazyData: null,
                        rsc: null,
                        prefetchRsc: null,
                        head: null,
                        prefetchHead: null,
                        parallelRoutes: new Map(existingCacheNode == null ? void 0 : existingCacheNode.parallelRoutes),
                        loading: null
                    };
                }
                // Overrides the cache key with the new cache node.
                parallelRouteCacheNode.set(cacheKey, newCacheNode);
                // Traverse deeper to apply the head / fill lazy items till the head.
                fillLazyItemsTillLeafWithHead(newCacheNode, existingCacheNode, parallelRouteState, parallelSeedData ? parallelSeedData : null, head, prefetchEntry);
                newCache.parallelRoutes.set(key, parallelRouteCacheNode);
                continue;
            }
        }
        let newCacheNode;
        if (parallelSeedData !== null) {
            // New data was sent from the server.
            const seedNode = parallelSeedData[1];
            const loading = parallelSeedData[3];
            newCacheNode = {
                lazyData: null,
                rsc: seedNode,
                prefetchRsc: null,
                head: null,
                prefetchHead: null,
                parallelRoutes: new Map(),
                loading
            };
        } else {
            // No data available for this node. This will trigger a lazy fetch
            // during render.
            newCacheNode = {
                lazyData: null,
                rsc: null,
                prefetchRsc: null,
                head: null,
                prefetchHead: null,
                parallelRoutes: new Map(),
                loading: null
            };
        }
        const existingParallelRoutes = newCache.parallelRoutes.get(key);
        if (existingParallelRoutes) {
            existingParallelRoutes.set(cacheKey, newCacheNode);
        } else {
            newCache.parallelRoutes.set(key, new Map([
                [
                    cacheKey,
                    newCacheNode
                ]
            ]));
        }
        fillLazyItemsTillLeafWithHead(newCacheNode, undefined, parallelRouteState, parallelSeedData, head, prefetchEntry);
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=fill-lazy-items-till-leaf-with-head.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/invalidate-cache-by-router-state.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "invalidateCacheByRouterState", {
    enumerable: true,
    get: function() {
        return invalidateCacheByRouterState;
    }
});
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
function invalidateCacheByRouterState(newCache, existingCache, routerState) {
    // Remove segment that we got data for so that it is filled in during rendering of rsc.
    for(const key in routerState[1]){
        const segmentForParallelRoute = routerState[1][key][0];
        const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(segmentForParallelRoute);
        const existingParallelRoutesCacheNode = existingCache.parallelRoutes.get(key);
        if (existingParallelRoutesCacheNode) {
            let parallelRouteCacheNode = new Map(existingParallelRoutesCacheNode);
            parallelRouteCacheNode.delete(cacheKey);
            newCache.parallelRoutes.set(key, parallelRouteCacheNode);
        }
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=invalidate-cache-by-router-state.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-cache-with-new-subtree-data.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    fillCacheWithNewSubTreeData: null,
    fillCacheWithNewSubTreeDataButOnlyLoading: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    fillCacheWithNewSubTreeData: function() {
        return fillCacheWithNewSubTreeData;
    },
    fillCacheWithNewSubTreeDataButOnlyLoading: function() {
        return fillCacheWithNewSubTreeDataButOnlyLoading;
    }
});
const _invalidatecachebyrouterstate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/invalidate-cache-by-router-state.js [app-client] (ecmascript)");
const _filllazyitemstillleafwithhead = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-lazy-items-till-leaf-with-head.js [app-client] (ecmascript)");
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
/**
 * Common logic for filling cache with new sub tree data.
 */ function fillCacheHelper(newCache, existingCache, flightData, prefetchEntry, fillLazyItems) {
    const { segmentPath, seedData: cacheNodeSeedData, tree: treePatch, head } = flightData;
    let newCacheNode = newCache;
    let existingCacheNode = existingCache;
    for(let i = 0; i < segmentPath.length; i += 2){
        const parallelRouteKey = segmentPath[i];
        const segment = segmentPath[i + 1];
        // segmentPath is a repeating tuple of parallelRouteKey and segment
        // we know we've hit the last entry we've reached our final pair
        const isLastEntry = i === segmentPath.length - 2;
        const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(segment);
        const existingChildSegmentMap = existingCacheNode.parallelRoutes.get(parallelRouteKey);
        if (!existingChildSegmentMap) {
            continue;
        }
        let childSegmentMap = newCacheNode.parallelRoutes.get(parallelRouteKey);
        if (!childSegmentMap || childSegmentMap === existingChildSegmentMap) {
            childSegmentMap = new Map(existingChildSegmentMap);
            newCacheNode.parallelRoutes.set(parallelRouteKey, childSegmentMap);
        }
        const existingChildCacheNode = existingChildSegmentMap.get(cacheKey);
        let childCacheNode = childSegmentMap.get(cacheKey);
        if (isLastEntry) {
            if (cacheNodeSeedData && (!childCacheNode || !childCacheNode.lazyData || childCacheNode === existingChildCacheNode)) {
                const incomingSegment = cacheNodeSeedData[0];
                const rsc = cacheNodeSeedData[1];
                const loading = cacheNodeSeedData[3];
                childCacheNode = {
                    lazyData: null,
                    // When `fillLazyItems` is false, we only want to fill the RSC data for the layout,
                    // not the page segment.
                    rsc: fillLazyItems || incomingSegment !== _segment.PAGE_SEGMENT_KEY ? rsc : null,
                    prefetchRsc: null,
                    head: null,
                    prefetchHead: null,
                    loading,
                    parallelRoutes: fillLazyItems && existingChildCacheNode ? new Map(existingChildCacheNode.parallelRoutes) : new Map()
                };
                if (existingChildCacheNode && fillLazyItems) {
                    (0, _invalidatecachebyrouterstate.invalidateCacheByRouterState)(childCacheNode, existingChildCacheNode, treePatch);
                }
                if (fillLazyItems) {
                    (0, _filllazyitemstillleafwithhead.fillLazyItemsTillLeafWithHead)(childCacheNode, existingChildCacheNode, treePatch, cacheNodeSeedData, head, prefetchEntry);
                }
                childSegmentMap.set(cacheKey, childCacheNode);
            }
            continue;
        }
        if (!childCacheNode || !existingChildCacheNode) {
            continue;
        }
        if (childCacheNode === existingChildCacheNode) {
            childCacheNode = {
                lazyData: childCacheNode.lazyData,
                rsc: childCacheNode.rsc,
                prefetchRsc: childCacheNode.prefetchRsc,
                head: childCacheNode.head,
                prefetchHead: childCacheNode.prefetchHead,
                parallelRoutes: new Map(childCacheNode.parallelRoutes),
                loading: childCacheNode.loading
            };
            childSegmentMap.set(cacheKey, childCacheNode);
        }
        // Move deeper into the cache nodes
        newCacheNode = childCacheNode;
        existingCacheNode = existingChildCacheNode;
    }
}
function fillCacheWithNewSubTreeData(newCache, existingCache, flightData, prefetchEntry) {
    fillCacheHelper(newCache, existingCache, flightData, prefetchEntry, true);
}
function fillCacheWithNewSubTreeDataButOnlyLoading(newCache, existingCache, flightData, prefetchEntry) {
    fillCacheHelper(newCache, existingCache, flightData, prefetchEntry, false);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=fill-cache-with-new-subtree-data.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-flight-data.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "applyFlightData", {
    enumerable: true,
    get: function() {
        return applyFlightData;
    }
});
const _filllazyitemstillleafwithhead = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-lazy-items-till-leaf-with-head.js [app-client] (ecmascript)");
const _fillcachewithnewsubtreedata = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-cache-with-new-subtree-data.js [app-client] (ecmascript)");
function applyFlightData(existingCache, cache, flightData, prefetchEntry) {
    // The one before last item is the router state tree patch
    const { tree: treePatch, seedData, head, isRootRender } = flightData;
    // Handles case where prefetch only returns the router tree patch without rendered components.
    if (seedData === null) {
        return false;
    }
    if (isRootRender) {
        const rsc = seedData[1];
        const loading = seedData[3];
        cache.loading = loading;
        cache.rsc = rsc;
        // This is a PPR-only field. When PPR is enabled, we shouldn't hit
        // this path during a navigation, but until PPR is fully implemented
        // yet it's possible the existing node does have a non-null
        // `prefetchRsc`. As an incremental step, we'll just de-opt to the
        // old behavior — no PPR value.
        cache.prefetchRsc = null;
        (0, _filllazyitemstillleafwithhead.fillLazyItemsTillLeafWithHead)(cache, existingCache, treePatch, seedData, head, prefetchEntry);
    } else {
        // Copy rsc for the root node of the cache.
        cache.rsc = existingCache.rsc;
        // This is a PPR-only field. Unlike the previous branch, since we're
        // just cloning the existing cache node, we might as well keep the
        // PPR value, if it exists.
        cache.prefetchRsc = existingCache.prefetchRsc;
        cache.parallelRoutes = new Map(existingCache.parallelRoutes);
        cache.loading = existingCache.loading;
        // Create a copy of the existing cache with the rsc applied.
        (0, _fillcachewithnewsubtreedata.fillCacheWithNewSubTreeData)(cache, existingCache, flightData, prefetchEntry);
    }
    return true;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=apply-flight-data.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/refetch-inactive-parallel-segments.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    addRefreshMarkerToActiveParallelSegments: null,
    refreshInactiveParallelSegments: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    addRefreshMarkerToActiveParallelSegments: function() {
        return addRefreshMarkerToActiveParallelSegments;
    },
    refreshInactiveParallelSegments: function() {
        return refreshInactiveParallelSegments;
    }
});
const _applyflightdata = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-flight-data.js [app-client] (ecmascript)");
const _fetchserverresponse = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js [app-client] (ecmascript)");
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
async function refreshInactiveParallelSegments(options) {
    const fetchedSegments = new Set();
    await refreshInactiveParallelSegmentsImpl({
        ...options,
        rootTree: options.updatedTree,
        fetchedSegments
    });
}
async function refreshInactiveParallelSegmentsImpl(param) {
    let { state, updatedTree, updatedCache, includeNextUrl, fetchedSegments, rootTree = updatedTree, canonicalUrl } = param;
    const [, parallelRoutes, refetchPath, refetchMarker] = updatedTree;
    const fetchPromises = [];
    if (refetchPath && refetchPath !== canonicalUrl && refetchMarker === 'refresh' && // it's possible for the tree to contain multiple segments that contain data at the same URL
    // we keep track of them so we can dedupe the requests
    !fetchedSegments.has(refetchPath)) {
        fetchedSegments.add(refetchPath) // Mark this URL as fetched
        ;
        // Eagerly kick off the fetch for the refetch path & the parallel routes. This should be fine to do as they each operate
        // independently on their own cache nodes, and `applyFlightData` will copy anything it doesn't care about from the existing cache.
        const fetchPromise = (0, _fetchserverresponse.fetchServerResponse)(new URL(refetchPath, location.origin), {
            // refetch from the root of the updated tree, otherwise it will be scoped to the current segment
            // and might not contain the data we need to patch in interception route data (such as dynamic params from a previous segment)
            flightRouterState: [
                rootTree[0],
                rootTree[1],
                rootTree[2],
                'refetch'
            ],
            nextUrl: includeNextUrl ? state.nextUrl : null,
            buildId: state.buildId
        }).then((param)=>{
            let { flightData } = param;
            if (typeof flightData !== 'string') {
                for (const flightDataPath of flightData){
                    // we only pass the new cache as this function is called after clearing the router cache
                    // and filling in the new page data from the server. Meaning the existing cache is actually the cache that's
                    // just been created & has been written to, but hasn't been "committed" yet.
                    (0, _applyflightdata.applyFlightData)(updatedCache, updatedCache, flightDataPath);
                }
            } else {
            // When flightData is a string, it suggests that the server response should have triggered an MPA navigation
            // I'm not 100% sure of this decision, but it seems unlikely that we'd want to introduce a redirect side effect
            // when refreshing on-screen data, so handling this has been ommitted.
            }
        });
        fetchPromises.push(fetchPromise);
    }
    for(const key in parallelRoutes){
        const parallelFetchPromise = refreshInactiveParallelSegmentsImpl({
            state,
            updatedTree: parallelRoutes[key],
            updatedCache,
            includeNextUrl,
            fetchedSegments,
            rootTree,
            canonicalUrl
        });
        fetchPromises.push(parallelFetchPromise);
    }
    await Promise.all(fetchPromises);
}
function addRefreshMarkerToActiveParallelSegments(tree, path) {
    const [segment, parallelRoutes, , refetchMarker] = tree;
    // a page segment might also contain concatenated search params, so we do a partial match on the key
    if (segment.includes(_segment.PAGE_SEGMENT_KEY) && refetchMarker !== 'refresh') {
        tree[2] = path;
        tree[3] = 'refresh';
    }
    for(const key in parallelRoutes){
        addRefreshMarkerToActiveParallelSegments(parallelRoutes[key], path);
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=refetch-inactive-parallel-segments.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-router-state-patch-to-tree.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "applyRouterStatePatchToTree", {
    enumerable: true,
    get: function() {
        return applyRouterStatePatchToTree;
    }
});
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
const _flightdatahelpers = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)");
const _matchsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/match-segments.js [app-client] (ecmascript)");
const _refetchinactiveparallelsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/refetch-inactive-parallel-segments.js [app-client] (ecmascript)");
/**
 * Deep merge of the two router states. Parallel route keys are preserved if the patch doesn't have them.
 */ function applyPatch(initialTree, patchTree) {
    const [initialSegment, initialParallelRoutes] = initialTree;
    const [patchSegment, patchParallelRoutes] = patchTree;
    // if the applied patch segment is __DEFAULT__ then it can be ignored in favor of the initial tree
    // this is because the __DEFAULT__ segment is used as a placeholder on navigation
    if (patchSegment === _segment.DEFAULT_SEGMENT_KEY && initialSegment !== _segment.DEFAULT_SEGMENT_KEY) {
        return initialTree;
    }
    if ((0, _matchsegments.matchSegment)(initialSegment, patchSegment)) {
        const newParallelRoutes = {};
        for(const key in initialParallelRoutes){
            const isInPatchTreeParallelRoutes = typeof patchParallelRoutes[key] !== 'undefined';
            if (isInPatchTreeParallelRoutes) {
                newParallelRoutes[key] = applyPatch(initialParallelRoutes[key], patchParallelRoutes[key]);
            } else {
                newParallelRoutes[key] = initialParallelRoutes[key];
            }
        }
        for(const key in patchParallelRoutes){
            if (newParallelRoutes[key]) {
                continue;
            }
            newParallelRoutes[key] = patchParallelRoutes[key];
        }
        const tree = [
            initialSegment,
            newParallelRoutes
        ];
        // Copy over the existing tree
        if (initialTree[2]) {
            tree[2] = initialTree[2];
        }
        if (initialTree[3]) {
            tree[3] = initialTree[3];
        }
        if (initialTree[4]) {
            tree[4] = initialTree[4];
        }
        return tree;
    }
    return patchTree;
}
function applyRouterStatePatchToTree(flightSegmentPath, flightRouterState, treePatch, path) {
    const [segment, parallelRoutes, url, refetch, isRootLayout] = flightRouterState;
    // Root refresh
    if (flightSegmentPath.length === 1) {
        const tree = applyPatch(flightRouterState, treePatch);
        (0, _refetchinactiveparallelsegments.addRefreshMarkerToActiveParallelSegments)(tree, path);
        return tree;
    }
    const [currentSegment, parallelRouteKey] = flightSegmentPath;
    // Tree path returned from the server should always match up with the current tree in the browser
    if (!(0, _matchsegments.matchSegment)(currentSegment, segment)) {
        return null;
    }
    const lastSegment = flightSegmentPath.length === 2;
    let parallelRoutePatch;
    if (lastSegment) {
        parallelRoutePatch = applyPatch(parallelRoutes[parallelRouteKey], treePatch);
    } else {
        parallelRoutePatch = applyRouterStatePatchToTree((0, _flightdatahelpers.getNextFlightSegmentPath)(flightSegmentPath), parallelRoutes[parallelRouteKey], treePatch, path);
        if (parallelRoutePatch === null) {
            return null;
        }
    }
    const tree = [
        flightSegmentPath[0],
        {
            ...parallelRoutes,
            [parallelRouteKey]: parallelRoutePatch
        },
        url,
        refetch
    ];
    // Current segment is the root layout
    if (isRootLayout) {
        tree[4] = true;
    }
    (0, _refetchinactiveparallelsegments.addRefreshMarkerToActiveParallelSegments)(tree, path);
    return tree;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=apply-router-state-patch-to-tree.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/should-hard-navigate.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "shouldHardNavigate", {
    enumerable: true,
    get: function() {
        return shouldHardNavigate;
    }
});
const _flightdatahelpers = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)");
const _matchsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/match-segments.js [app-client] (ecmascript)");
function shouldHardNavigate(flightSegmentPath, flightRouterState) {
    const [segment, parallelRoutes] = flightRouterState;
    // TODO-APP: Check if `as` can be replaced.
    const [currentSegment, parallelRouteKey] = flightSegmentPath;
    // Check if current segment matches the existing segment.
    if (!(0, _matchsegments.matchSegment)(currentSegment, segment)) {
        // If dynamic parameter in tree doesn't match up with segment path a hard navigation is triggered.
        if (Array.isArray(currentSegment)) {
            return true;
        }
        // If the existing segment did not match soft navigation is triggered.
        return false;
    }
    const lastSegment = flightSegmentPath.length <= 2;
    if (lastSegment) {
        return false;
    }
    return shouldHardNavigate((0, _flightdatahelpers.getNextFlightSegmentPath)(flightSegmentPath), parallelRoutes[parallelRouteKey]);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=should-hard-navigate.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/is-navigating-to-new-root-layout.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "isNavigatingToNewRootLayout", {
    enumerable: true,
    get: function() {
        return isNavigatingToNewRootLayout;
    }
});
function isNavigatingToNewRootLayout(currentTree, nextTree) {
    // Compare segments
    const currentTreeSegment = currentTree[0];
    const nextTreeSegment = nextTree[0];
    // If any segment is different before we find the root layout, the root layout has changed.
    // E.g. /same/(group1)/layout.js -> /same/(group2)/layout.js
    // First segment is 'same' for both, keep looking. (group1) changed to (group2) before the root layout was found, it must have changed.
    if (Array.isArray(currentTreeSegment) && Array.isArray(nextTreeSegment)) {
        // Compare dynamic param name and type but ignore the value, different values would not affect the current root layout
        // /[name] - /slug1 and /slug2, both values (slug1 & slug2) still has the same layout /[name]/layout.js
        if (currentTreeSegment[0] !== nextTreeSegment[0] || currentTreeSegment[2] !== nextTreeSegment[2]) {
            return true;
        }
    } else if (currentTreeSegment !== nextTreeSegment) {
        return true;
    }
    // Current tree root layout found
    if (currentTree[4]) {
        // If the next tree doesn't have the root layout flag, it must have changed.
        return !nextTree[4];
    }
    // Current tree didn't have its root layout here, must have changed.
    if (nextTree[4]) {
        return true;
    }
    // We can't assume it's `parallelRoutes.children` here in case the root layout is `app/@something/layout.js`
    // But it's not possible to be more than one parallelRoutes before the root layout is found
    // TODO-APP: change to traverse all parallel routes
    const currentTreeChild = Object.values(currentTree[1])[0];
    const nextTreeChild = Object.values(nextTree[1])[0];
    if (!currentTreeChild || !nextTreeChild) return true;
    return isNavigatingToNewRootLayout(currentTreeChild, nextTreeChild);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=is-navigating-to-new-root-layout.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/compute-changed-path.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    computeChangedPath: null,
    extractPathFromFlightRouterState: null,
    getSelectedParams: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    computeChangedPath: function() {
        return computeChangedPath;
    },
    extractPathFromFlightRouterState: function() {
        return extractPathFromFlightRouterState;
    },
    getSelectedParams: function() {
        return getSelectedParams;
    }
});
const _interceptionroutes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/lib/interception-routes.js [app-client] (ecmascript)");
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
const _matchsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/match-segments.js [app-client] (ecmascript)");
const removeLeadingSlash = (segment)=>{
    return segment[0] === '/' ? segment.slice(1) : segment;
};
const segmentToPathname = (segment)=>{
    if (typeof segment === 'string') {
        // 'children' is not a valid path -- it's technically a parallel route that corresponds with the current segment's page
        // if we don't skip it, then the computed pathname might be something like `/children` which doesn't make sense.
        if (segment === 'children') return '';
        return segment;
    }
    return segment[1];
};
function normalizeSegments(segments) {
    return segments.reduce((acc, segment)=>{
        segment = removeLeadingSlash(segment);
        if (segment === '' || (0, _segment.isGroupSegment)(segment)) {
            return acc;
        }
        return acc + "/" + segment;
    }, '') || '/';
}
function extractPathFromFlightRouterState(flightRouterState) {
    const segment = Array.isArray(flightRouterState[0]) ? flightRouterState[0][1] : flightRouterState[0];
    if (segment === _segment.DEFAULT_SEGMENT_KEY || _interceptionroutes.INTERCEPTION_ROUTE_MARKERS.some((m)=>segment.startsWith(m))) return undefined;
    if (segment.startsWith(_segment.PAGE_SEGMENT_KEY)) return '';
    const segments = [
        segmentToPathname(segment)
    ];
    var _flightRouterState_;
    const parallelRoutes = (_flightRouterState_ = flightRouterState[1]) != null ? _flightRouterState_ : {};
    const childrenPath = parallelRoutes.children ? extractPathFromFlightRouterState(parallelRoutes.children) : undefined;
    if (childrenPath !== undefined) {
        segments.push(childrenPath);
    } else {
        for (const [key, value] of Object.entries(parallelRoutes)){
            if (key === 'children') continue;
            const childPath = extractPathFromFlightRouterState(value);
            if (childPath !== undefined) {
                segments.push(childPath);
            }
        }
    }
    return normalizeSegments(segments);
}
function computeChangedPathImpl(treeA, treeB) {
    const [segmentA, parallelRoutesA] = treeA;
    const [segmentB, parallelRoutesB] = treeB;
    const normalizedSegmentA = segmentToPathname(segmentA);
    const normalizedSegmentB = segmentToPathname(segmentB);
    if (_interceptionroutes.INTERCEPTION_ROUTE_MARKERS.some((m)=>normalizedSegmentA.startsWith(m) || normalizedSegmentB.startsWith(m))) {
        return '';
    }
    if (!(0, _matchsegments.matchSegment)(segmentA, segmentB)) {
        var _extractPathFromFlightRouterState;
        // once we find where the tree changed, we compute the rest of the path by traversing the tree
        return (_extractPathFromFlightRouterState = extractPathFromFlightRouterState(treeB)) != null ? _extractPathFromFlightRouterState : '';
    }
    for(const parallelRouterKey in parallelRoutesA){
        if (parallelRoutesB[parallelRouterKey]) {
            const changedPath = computeChangedPathImpl(parallelRoutesA[parallelRouterKey], parallelRoutesB[parallelRouterKey]);
            if (changedPath !== null) {
                return segmentToPathname(segmentB) + "/" + changedPath;
            }
        }
    }
    return null;
}
function computeChangedPath(treeA, treeB) {
    const changedPath = computeChangedPathImpl(treeA, treeB);
    if (changedPath == null || changedPath === '/') {
        return changedPath;
    }
    // lightweight normalization to remove route groups
    return normalizeSegments(changedPath.split('/'));
}
function getSelectedParams(currentTree, params) {
    if (params === void 0) params = {};
    const parallelRoutes = currentTree[1];
    for (const parallelRoute of Object.values(parallelRoutes)){
        const segment = parallelRoute[0];
        const isDynamicParameter = Array.isArray(segment);
        const segmentValue = isDynamicParameter ? segment[1] : segment;
        if (!segmentValue || segmentValue.startsWith(_segment.PAGE_SEGMENT_KEY)) continue;
        // Ensure catchAll and optional catchall are turned into an array
        const isCatchAll = isDynamicParameter && (segment[2] === 'c' || segment[2] === 'oc');
        if (isCatchAll) {
            params[segment[0]] = segment[1].split('/');
        } else if (isDynamicParameter) {
            params[segment[0]] = segment[1];
        }
        params = getSelectedParams(parallelRoute, params);
    }
    return params;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=compute-changed-path.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-mutable.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "handleMutable", {
    enumerable: true,
    get: function() {
        return handleMutable;
    }
});
const _computechangedpath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/compute-changed-path.js [app-client] (ecmascript)");
function isNotUndefined(value) {
    return typeof value !== 'undefined';
}
function handleMutable(state, mutable) {
    var _mutable_shouldScroll;
    // shouldScroll is true by default, can override to false.
    const shouldScroll = (_mutable_shouldScroll = mutable.shouldScroll) != null ? _mutable_shouldScroll : true;
    let nextUrl = state.nextUrl;
    if (isNotUndefined(mutable.patchedTree)) {
        // If we received a patched tree, we need to compute the changed path.
        const changedPath = (0, _computechangedpath.computeChangedPath)(state.tree, mutable.patchedTree);
        if (changedPath) {
            // If the tree changed, we need to update the nextUrl
            nextUrl = changedPath;
        } else if (!nextUrl) {
            // if the tree ends up being the same (ie, no changed path), and we don't have a nextUrl, then we should use the canonicalUrl
            nextUrl = state.canonicalUrl;
        }
    // otherwise this will be a no-op and continue to use the existing nextUrl
    }
    var _mutable_scrollableSegments;
    return {
        buildId: state.buildId,
        // Set href.
        canonicalUrl: isNotUndefined(mutable.canonicalUrl) ? mutable.canonicalUrl === state.canonicalUrl ? state.canonicalUrl : mutable.canonicalUrl : state.canonicalUrl,
        pushRef: {
            pendingPush: isNotUndefined(mutable.pendingPush) ? mutable.pendingPush : state.pushRef.pendingPush,
            mpaNavigation: isNotUndefined(mutable.mpaNavigation) ? mutable.mpaNavigation : state.pushRef.mpaNavigation,
            preserveCustomHistoryState: isNotUndefined(mutable.preserveCustomHistoryState) ? mutable.preserveCustomHistoryState : state.pushRef.preserveCustomHistoryState
        },
        // All navigation requires scroll and focus management to trigger.
        focusAndScrollRef: {
            apply: shouldScroll ? isNotUndefined(mutable == null ? void 0 : mutable.scrollableSegments) ? true : state.focusAndScrollRef.apply : false,
            onlyHashChange: mutable.onlyHashChange || false,
            hashFragment: shouldScroll ? mutable.hashFragment && mutable.hashFragment !== '' ? decodeURIComponent(mutable.hashFragment.slice(1)) : state.focusAndScrollRef.hashFragment : null,
            segmentPaths: shouldScroll ? (_mutable_scrollableSegments = mutable == null ? void 0 : mutable.scrollableSegments) != null ? _mutable_scrollableSegments : state.focusAndScrollRef.segmentPaths : []
        },
        // Apply cache.
        cache: mutable.cache ? mutable.cache : state.cache,
        prefetchCache: mutable.prefetchCache ? mutable.prefetchCache : state.prefetchCache,
        // Apply patched router state.
        tree: isNotUndefined(mutable.patchedTree) ? mutable.patchedTree : state.tree,
        nextUrl
    };
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=handle-mutable.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/promise-queue.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/*
    This is a simple promise queue that allows you to limit the number of concurrent promises
    that are running at any given time. It's used to limit the number of concurrent
    prefetch requests that are being made to the server but could be used for other
    things as well.
*/ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PromiseQueue", {
    enumerable: true,
    get: function() {
        return PromiseQueue;
    }
});
const _class_private_field_loose_base = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_class_private_field_loose_base.cjs [app-client] (ecmascript)");
const _class_private_field_loose_key = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_class_private_field_loose_key.cjs [app-client] (ecmascript)");
var _maxConcurrency = /*#__PURE__*/ _class_private_field_loose_key._("_maxConcurrency"), _runningCount = /*#__PURE__*/ _class_private_field_loose_key._("_runningCount"), _queue = /*#__PURE__*/ _class_private_field_loose_key._("_queue"), _processNext = /*#__PURE__*/ _class_private_field_loose_key._("_processNext");
class PromiseQueue {
    enqueue(promiseFn) {
        let taskResolve;
        let taskReject;
        const taskPromise = new Promise((resolve, reject)=>{
            taskResolve = resolve;
            taskReject = reject;
        });
        const task = async ()=>{
            try {
                _class_private_field_loose_base._(this, _runningCount)[_runningCount]++;
                const result = await promiseFn();
                taskResolve(result);
            } catch (error) {
                taskReject(error);
            } finally{
                _class_private_field_loose_base._(this, _runningCount)[_runningCount]--;
                _class_private_field_loose_base._(this, _processNext)[_processNext]();
            }
        };
        const enqueueResult = {
            promiseFn: taskPromise,
            task
        };
        // wonder if we should take a LIFO approach here
        _class_private_field_loose_base._(this, _queue)[_queue].push(enqueueResult);
        _class_private_field_loose_base._(this, _processNext)[_processNext]();
        return taskPromise;
    }
    bump(promiseFn) {
        const index = _class_private_field_loose_base._(this, _queue)[_queue].findIndex((item)=>item.promiseFn === promiseFn);
        if (index > -1) {
            const bumpedItem = _class_private_field_loose_base._(this, _queue)[_queue].splice(index, 1)[0];
            _class_private_field_loose_base._(this, _queue)[_queue].unshift(bumpedItem);
            _class_private_field_loose_base._(this, _processNext)[_processNext](true);
        }
    }
    constructor(maxConcurrency = 5){
        Object.defineProperty(this, _processNext, {
            value: processNext
        });
        Object.defineProperty(this, _maxConcurrency, {
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _runningCount, {
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, _queue, {
            writable: true,
            value: void 0
        });
        _class_private_field_loose_base._(this, _maxConcurrency)[_maxConcurrency] = maxConcurrency;
        _class_private_field_loose_base._(this, _runningCount)[_runningCount] = 0;
        _class_private_field_loose_base._(this, _queue)[_queue] = [];
    }
}
function processNext(forced) {
    if (forced === void 0) forced = false;
    if ((_class_private_field_loose_base._(this, _runningCount)[_runningCount] < _class_private_field_loose_base._(this, _maxConcurrency)[_maxConcurrency] || forced) && _class_private_field_loose_base._(this, _queue)[_queue].length > 0) {
        var _class_private_field_loose_base__queue_shift;
        (_class_private_field_loose_base__queue_shift = _class_private_field_loose_base._(this, _queue)[_queue].shift()) == null ? void 0 : _class_private_field_loose_base__queue_shift.task();
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=promise-queue.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/prefetch-cache-utils.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    createSeededPrefetchCacheEntry: null,
    getOrCreatePrefetchCacheEntry: null,
    prunePrefetchCache: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    createSeededPrefetchCacheEntry: function() {
        return createSeededPrefetchCacheEntry;
    },
    getOrCreatePrefetchCacheEntry: function() {
        return getOrCreatePrefetchCacheEntry;
    },
    prunePrefetchCache: function() {
        return prunePrefetchCache;
    }
});
const _fetchserverresponse = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _prefetchreducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/prefetch-reducer.js [app-client] (ecmascript)");
const INTERCEPTION_CACHE_KEY_MARKER = '%';
/**
 * Creates a cache key for the router prefetch cache
 *
 * @param url - The URL being navigated to
 * @param nextUrl - an internal URL, primarily used for handling rewrites. Defaults to '/'.
 * @return The generated prefetch cache key.
 */ function createPrefetchCacheKeyImpl(url, includeSearchParams, prefix) {
    // Initially we only use the pathname as the cache key. We don't want to include
    // search params so that multiple URLs with the same search parameter can re-use
    // loading states.
    let pathnameFromUrl = url.pathname;
    // RSC responses can differ based on search params, specifically in the case where we aren't
    // returning a partial response (ie with `PrefetchKind.AUTO`).
    // In the auto case, since loading.js & layout.js won't have access to search params,
    // we can safely re-use that cache entry. But for full prefetches, we should not
    // re-use the cache entry as the response may differ.
    if (includeSearchParams) {
        // if we have a full prefetch, we can include the search param in the key,
        // as we'll be getting back a full response. The server might have read the search
        // params when generating the full response.
        pathnameFromUrl += url.search;
    }
    if (prefix) {
        return "" + prefix + INTERCEPTION_CACHE_KEY_MARKER + pathnameFromUrl;
    }
    return pathnameFromUrl;
}
function createPrefetchCacheKey(url, kind, nextUrl) {
    return createPrefetchCacheKeyImpl(url, kind === _routerreducertypes.PrefetchKind.FULL, nextUrl);
}
function getExistingCacheEntry(url, kind, nextUrl, prefetchCache, allowAliasing) {
    if (kind === void 0) kind = _routerreducertypes.PrefetchKind.TEMPORARY;
    // We first check if there's a more specific interception route prefetch entry
    // This is because when we detect a prefetch that corresponds with an interception route, we prefix it with nextUrl (see `createPrefetchCacheKey`)
    // to avoid conflicts with other pages that may have the same URL but render different things depending on the `Next-URL` header.
    for (const maybeNextUrl of [
        nextUrl,
        null
    ]){
        const cacheKeyWithParams = createPrefetchCacheKeyImpl(url, true, maybeNextUrl);
        const cacheKeyWithoutParams = createPrefetchCacheKeyImpl(url, false, maybeNextUrl);
        // First, we check if we have a cache entry that exactly matches the URL
        const cacheKeyToUse = url.search ? cacheKeyWithParams : cacheKeyWithoutParams;
        const existingEntry = prefetchCache.get(cacheKeyToUse);
        if (existingEntry && allowAliasing) {
            // We know we're returning an aliased entry when the pathname matches but the search params don't,
            const isAliased = existingEntry.url.pathname === url.pathname && existingEntry.url.search !== url.search;
            if (isAliased) {
                return {
                    ...existingEntry,
                    aliased: true
                };
            }
            return existingEntry;
        }
        // If the request contains search params, and we're not doing a full prefetch, we can return the
        // param-less entry if it exists.
        // This is technically covered by the check at the bottom of this function, which iterates over cache entries,
        // but lets us arrive there quicker in the param-full case.
        const entryWithoutParams = prefetchCache.get(cacheKeyWithoutParams);
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
    }
    // If we've gotten to this point, we didn't find a specific cache entry that matched
    // the request URL.
    // We attempt a partial match by checking if there's a cache entry with the same pathname.
    // Regardless of what we find, since it doesn't correspond with the requested URL, we'll mark it "aliased".
    // This will signal to the router that it should only apply the loading state on the prefetched data.
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    return undefined;
}
function getOrCreatePrefetchCacheEntry(param) {
    let { url, nextUrl, tree, buildId, prefetchCache, kind, allowAliasing = true } = param;
    const existingCacheEntry = getExistingCacheEntry(url, kind, nextUrl, prefetchCache, allowAliasing);
    if (existingCacheEntry) {
        // Grab the latest status of the cache entry and update it
        existingCacheEntry.status = getPrefetchEntryCacheStatus(existingCacheEntry);
        // when `kind` is provided, an explicit prefetch was requested.
        // if the requested prefetch is "full" and the current cache entry wasn't, we want to re-prefetch with the new intent
        const switchedToFullPrefetch = existingCacheEntry.kind !== _routerreducertypes.PrefetchKind.FULL && kind === _routerreducertypes.PrefetchKind.FULL;
        if (switchedToFullPrefetch) {
            // If we switched to a full prefetch, validate that the existing cache entry contained partial data.
            // It's possible that the cache entry was seeded with full data but has a cache type of "auto" (ie when cache entries
            // are seeded but without a prefetch intent)
            existingCacheEntry.data.then((prefetchResponse)=>{
                const isFullPrefetch = Array.isArray(prefetchResponse.flightData) && prefetchResponse.flightData.some((flightData)=>{
                    // If we started rendering from the root and we returned RSC data (seedData), we already had a full prefetch.
                    return flightData.isRootRender && flightData.seedData !== null;
                });
                if (!isFullPrefetch) {
                    return createLazyPrefetchEntry({
                        tree,
                        url,
                        buildId,
                        nextUrl,
                        prefetchCache,
                        // If we didn't get an explicit prefetch kind, we want to set a temporary kind
                        // rather than assuming the same intent as the previous entry, to be consistent with how we
                        // lazily create prefetch entries when intent is left unspecified.
                        kind: kind != null ? kind : _routerreducertypes.PrefetchKind.TEMPORARY
                    });
                }
            });
        }
        // If the existing cache entry was marked as temporary, it means it was lazily created when attempting to get an entry,
        // where we didn't have the prefetch intent. Now that we have the intent (in `kind`), we want to update the entry to the more accurate kind.
        if (kind && existingCacheEntry.kind === _routerreducertypes.PrefetchKind.TEMPORARY) {
            existingCacheEntry.kind = kind;
        }
        // We've determined that the existing entry we found is still valid, so we return it.
        return existingCacheEntry;
    }
    // If we didn't return an entry, create a new one.
    return createLazyPrefetchEntry({
        tree,
        url,
        buildId,
        nextUrl,
        prefetchCache,
        kind: kind || _routerreducertypes.PrefetchKind.TEMPORARY
    });
}
/*
 * Used to take an existing cache entry and prefix it with the nextUrl, if it exists.
 * This ensures that we don't have conflicting cache entries for the same URL (as is the case with route interception).
 */ function prefixExistingPrefetchCacheEntry(param) {
    let { url, nextUrl, prefetchCache, existingCacheKey } = param;
    const existingCacheEntry = prefetchCache.get(existingCacheKey);
    if (!existingCacheEntry) {
        // no-op -- there wasn't an entry to move
        return;
    }
    const newCacheKey = createPrefetchCacheKey(url, existingCacheEntry.kind, nextUrl);
    prefetchCache.set(newCacheKey, {
        ...existingCacheEntry,
        key: newCacheKey
    });
    prefetchCache.delete(existingCacheKey);
    return newCacheKey;
}
function createSeededPrefetchCacheEntry(param) {
    let { nextUrl, tree, prefetchCache, url, data, kind } = param;
    // The initial cache entry technically includes full data, but it isn't explicitly prefetched -- we just seed the
    // prefetch cache so that we can skip an extra prefetch request later, since we already have the data.
    // if the prefetch corresponds with an interception route, we use the nextUrl to prefix the cache key
    const prefetchCacheKey = data.couldBeIntercepted ? createPrefetchCacheKey(url, kind, nextUrl) : createPrefetchCacheKey(url, kind);
    const prefetchEntry = {
        treeAtTimeOfPrefetch: tree,
        data: Promise.resolve(data),
        kind,
        prefetchTime: Date.now(),
        lastUsedTime: Date.now(),
        staleTime: -1,
        key: prefetchCacheKey,
        status: _routerreducertypes.PrefetchCacheEntryStatus.fresh,
        url
    };
    prefetchCache.set(prefetchCacheKey, prefetchEntry);
    return prefetchEntry;
}
/**
 * Creates a prefetch entry entry and enqueues a fetch request to retrieve the data.
 */ function createLazyPrefetchEntry(param) {
    let { url, kind, tree, nextUrl, buildId, prefetchCache } = param;
    const prefetchCacheKey = createPrefetchCacheKey(url, kind);
    // initiates the fetch request for the prefetch and attaches a listener
    // to the promise to update the prefetch cache entry when the promise resolves (if necessary)
    const data = _prefetchreducer.prefetchQueue.enqueue(()=>(0, _fetchserverresponse.fetchServerResponse)(url, {
            flightRouterState: tree,
            nextUrl,
            buildId,
            prefetchKind: kind
        }).then((prefetchResponse)=>{
            // TODO: `fetchServerResponse` should be more tighly coupled to these prefetch cache operations
            // to avoid drift between this cache key prefixing logic
            // (which is currently directly influenced by the server response)
            let newCacheKey;
            if (prefetchResponse.couldBeIntercepted) {
                // Determine if we need to prefix the cache key with the nextUrl
                newCacheKey = prefixExistingPrefetchCacheEntry({
                    url,
                    existingCacheKey: prefetchCacheKey,
                    nextUrl,
                    prefetchCache
                });
            }
            // If the prefetch was a cache hit, we want to update the existing cache entry to reflect that it was a full prefetch.
            // This is because we know that a static response will contain the full RSC payload, and can be updated to respect the `static`
            // staleTime.
            if (prefetchResponse.prerendered) {
                const existingCacheEntry = prefetchCache.get(newCacheKey != null ? newCacheKey : prefetchCacheKey);
                if (existingCacheEntry) {
                    existingCacheEntry.kind = _routerreducertypes.PrefetchKind.FULL;
                    if (prefetchResponse.staleTime !== -1) {
                        // This is the stale time that was collected by the server during
                        // static generation. Use this in place of the default stale time.
                        existingCacheEntry.staleTime = prefetchResponse.staleTime;
                    }
                }
            }
            return prefetchResponse;
        }));
    const prefetchEntry = {
        treeAtTimeOfPrefetch: tree,
        data,
        kind,
        prefetchTime: Date.now(),
        lastUsedTime: null,
        staleTime: -1,
        key: prefetchCacheKey,
        status: _routerreducertypes.PrefetchCacheEntryStatus.fresh,
        url
    };
    prefetchCache.set(prefetchCacheKey, prefetchEntry);
    return prefetchEntry;
}
function prunePrefetchCache(prefetchCache) {
    for (const [href, prefetchCacheEntry] of prefetchCache){
        if (getPrefetchEntryCacheStatus(prefetchCacheEntry) === _routerreducertypes.PrefetchCacheEntryStatus.expired) {
            prefetchCache.delete(href);
        }
    }
}
// These values are set by `define-env-plugin` (based on `nextConfig.experimental.staleTimes`)
// and default to 5 minutes (static) / 0 seconds (dynamic)
const DYNAMIC_STALETIME_MS = Number(("TURBOPACK compile-time value", "0")) * 1000;
const STATIC_STALETIME_MS = Number(("TURBOPACK compile-time value", "300")) * 1000;
function getPrefetchEntryCacheStatus(param) {
    let { kind, prefetchTime, lastUsedTime, staleTime } = param;
    if (staleTime !== -1) {
        // `staleTime` is the value sent by the server during static generation.
        // When this is available, it takes precedence over any of the heuristics
        // that follow.
        //
        // TODO: When PPR is enabled, the server will *always* return a stale time
        // when prefetching. We should never use a prefetch entry that hasn't yet
        // received data from the server. So the only two cases should be 1) we use
        // the server-generated stale time 2) the unresolved entry is discarded.
        return Date.now() < prefetchTime + staleTime ? _routerreducertypes.PrefetchCacheEntryStatus.fresh : _routerreducertypes.PrefetchCacheEntryStatus.stale;
    }
    // We will re-use the cache entry data for up to the `dynamic` staletime window.
    if (Date.now() < (lastUsedTime != null ? lastUsedTime : prefetchTime) + DYNAMIC_STALETIME_MS) {
        return lastUsedTime ? _routerreducertypes.PrefetchCacheEntryStatus.reusable : _routerreducertypes.PrefetchCacheEntryStatus.fresh;
    }
    // For "auto" prefetching, we'll re-use only the loading boundary for up to `static` staletime window.
    // A stale entry will only re-use the `loading` boundary, not the full data.
    // This will trigger a "lazy fetch" for the full data.
    if (kind === _routerreducertypes.PrefetchKind.AUTO) {
        if (Date.now() < prefetchTime + STATIC_STALETIME_MS) {
            return _routerreducertypes.PrefetchCacheEntryStatus.stale;
        }
    }
    // for "full" prefetching, we'll re-use the cache entry data for up to `static` staletime window.
    if (kind === _routerreducertypes.PrefetchKind.FULL) {
        if (Date.now() < prefetchTime + STATIC_STALETIME_MS) {
            return _routerreducertypes.PrefetchCacheEntryStatus.reusable;
        }
    }
    return _routerreducertypes.PrefetchCacheEntryStatus.expired;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=prefetch-cache-utils.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/prefetch-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    prefetchQueue: null,
    prefetchReducer: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    prefetchQueue: function() {
        return prefetchQueue;
    },
    prefetchReducer: function() {
        return prefetchReducer;
    }
});
const _approuterheaders = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router-headers.js [app-client] (ecmascript)");
const _promisequeue = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/promise-queue.js [app-client] (ecmascript)");
const _prefetchcacheutils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/prefetch-cache-utils.js [app-client] (ecmascript)");
const prefetchQueue = new _promisequeue.PromiseQueue(5);
function prefetchReducer(state, action) {
    // let's prune the prefetch cache before we do anything else
    (0, _prefetchcacheutils.prunePrefetchCache)(state.prefetchCache);
    const { url } = action;
    url.searchParams.delete(_approuterheaders.NEXT_RSC_UNION_QUERY);
    (0, _prefetchcacheutils.getOrCreatePrefetchCacheEntry)({
        url,
        nextUrl: state.nextUrl,
        prefetchCache: state.prefetchCache,
        kind: action.kind,
        tree: state.tree,
        buildId: state.buildId,
        allowAliasing: true
    });
    return state;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=prefetch-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/use-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    useReducer: null,
    useUnwrapState: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    useReducer: function() {
        return useReducer;
    },
    useUnwrapState: function() {
        return useUnwrapState;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _isthenable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/is-thenable.js [app-client] (ecmascript)");
function useUnwrapState(state) {
    // reducer actions can be async, so sometimes we need to suspend until the state is resolved
    if ((0, _isthenable.isThenable)(state)) {
        const result = (0, _react.use)(state);
        return result;
    }
    return state;
}
function useReducer(actionQueue) {
    const [state, setState] = _react.default.useState(actionQueue.state);
    const dispatch = (0, _react.useCallback)((action)=>{
        actionQueue.dispatch(action, setState);
    }, [
        actionQueue
    ]);
    return [
        state,
        dispatch
    ];
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=use-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation-untracked.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "useUntrackedPathname", {
    enumerable: true,
    get: function() {
        return useUntrackedPathname;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _hooksclientcontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/hooks-client-context.shared-runtime.js [app-client] (ecmascript)");
/**
 * This checks to see if the current render has any unknown route parameters.
 * It's used to trigger a different render path in the error boundary.
 *
 * @returns true if there are any unknown route parameters, false otherwise
 */ function hasFallbackRouteParams() {
    if (typeof window === 'undefined') {
        // AsyncLocalStorage should not be included in the client bundle.
        const { workAsyncStorage } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/work-async-storage.external.js [app-client] (ecmascript)");
        const workStore = workAsyncStorage.getStore();
        if (!workStore) return false;
        const { fallbackRouteParams } = workStore;
        if (!fallbackRouteParams || fallbackRouteParams.size === 0) return false;
        return true;
    }
    return false;
}
function useUntrackedPathname() {
    // If there are any unknown route parameters we would typically throw
    // an error, but this internal method allows us to return a null value instead
    // for components that do not propagate the pathname to the static shell (like
    // the error boundary).
    if (hasFallbackRouteParams()) {
        return null;
    }
    // This shouldn't cause any issues related to conditional rendering because
    // the environment will be consistent for the render.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return (0, _react.useContext)(_hooksclientcontextsharedruntime.PathnameContext);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=navigation-untracked.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/nav-failure-handler.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    handleHardNavError: null,
    useNavFailureHandler: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    handleHardNavError: function() {
        return handleHardNavError;
    },
    useNavFailureHandler: function() {
        return useNavFailureHandler;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
function handleHardNavError(error) {
    if (error && typeof window !== 'undefined' && window.next.__pendingUrl && (0, _createhreffromurl.createHrefFromUrl)(new URL(window.location.href)) !== (0, _createhreffromurl.createHrefFromUrl)(window.next.__pendingUrl)) {
        console.error("Error occurred during navigation, falling back to hard navigation", error);
        window.location.href = window.next.__pendingUrl.toString();
        return true;
    }
    return false;
}
function useNavFailureHandler() {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=nav-failure-handler.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/error-boundary.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    ErrorBoundary: null,
    ErrorBoundaryHandler: null,
    GlobalError: null,
    default: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    ErrorBoundary: function() {
        return ErrorBoundary;
    },
    ErrorBoundaryHandler: function() {
        return ErrorBoundaryHandler;
    },
    GlobalError: function() {
        return GlobalError;
    },
    // Exported so that the import signature in the loaders can be identical to user
    // supplied custom global error signatures.
    default: function() {
        return _default;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _navigationuntracked = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation-untracked.js [app-client] (ecmascript)");
const _isnextroutererror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-next-router-error.js [app-client] (ecmascript)");
const _navfailurehandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/nav-failure-handler.js [app-client] (ecmascript)");
const _workasyncstorageexternal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/work-async-storage.external.js [app-client] (ecmascript)");
const styles = {
    error: {
        // https://github.com/sindresorhus/modern-normalize/blob/main/modern-normalize.css#L38-L52
        fontFamily: 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
        height: '100vh',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    },
    text: {
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: '28px',
        margin: '0 8px'
    }
};
// if we are revalidating we want to re-throw the error so the
// function crashes so we can maintain our previous cache
// instead of caching the error page
function HandleISRError(param) {
    let { error } = param;
    const store = _workasyncstorageexternal.workAsyncStorage.getStore();
    if ((store == null ? void 0 : store.isRevalidate) || (store == null ? void 0 : store.isStaticGeneration)) {
        console.error(error);
        throw error;
    }
    return null;
}
class ErrorBoundaryHandler extends _react.default.Component {
    static getDerivedStateFromError(error) {
        if ((0, _isnextroutererror.isNextRouterError)(error)) {
            // Re-throw if an expected internal Next.js router error occurs
            // this means it should be handled by a different boundary (such as a NotFound boundary in a parent segment)
            throw error;
        }
        return {
            error
        };
    }
    static getDerivedStateFromProps(props, state) {
        const { error } = state;
        // if we encounter an error while
        // a navigation is pending we shouldn't render
        // the error boundary and instead should fallback
        // to a hard navigation to attempt recovering
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
        /**
     * Handles reset of the error boundary when a navigation happens.
     * Ensures the error boundary does not stay enabled when navigating to a new page.
     * Approach of setState in render is safe as it checks the previous pathname and then overrides
     * it as outlined in https://react.dev/reference/react/useState#storing-information-from-previous-renders
     */ if (props.pathname !== state.previousPathname && state.error) {
            return {
                error: null,
                previousPathname: props.pathname
            };
        }
        return {
            error: state.error,
            previousPathname: props.pathname
        };
    }
    // Explicit type is needed to avoid the generated `.d.ts` having a wide return type that could be specific to the `@types/react` version.
    render() {
        if (this.state.error) {
            return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(HandleISRError, {
                        error: this.state.error
                    }),
                    this.props.errorStyles,
                    this.props.errorScripts,
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(this.props.errorComponent, {
                        error: this.state.error,
                        reset: this.reset
                    })
                ]
            });
        }
        return this.props.children;
    }
    constructor(props){
        super(props);
        this.reset = ()=>{
            this.setState({
                error: null
            });
        };
        this.state = {
            error: null,
            previousPathname: this.props.pathname
        };
    }
}
function GlobalError(param) {
    let { error } = param;
    const digest = error == null ? void 0 : error.digest;
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("html", {
        id: "__next_error__",
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("head", {}),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("body", {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(HandleISRError, {
                        error: error
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                        style: styles.error,
                        children: /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                            children: [
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("h2", {
                                    style: styles.text,
                                    children: "Application error: a " + (digest ? 'server' : 'client') + "-side exception has occurred (see the " + (digest ? 'server logs' : 'browser console') + " for more information)."
                                }),
                                digest ? /*#__PURE__*/ (0, _jsxruntime.jsx)("p", {
                                    style: styles.text,
                                    children: "Digest: " + digest
                                }) : null
                            ]
                        })
                    })
                ]
            })
        ]
    });
}
const _default = GlobalError;
function ErrorBoundary(param) {
    let { errorComponent, errorStyles, errorScripts, children } = param;
    // When we're rendering the missing params shell, this will return null. This
    // is because we won't be rendering any not found boundaries or error
    // boundaries for the missing params shell. When this runs on the client
    // (where these errors can occur), we will get the correct pathname.
    const pathname = (0, _navigationuntracked.useUntrackedPathname)();
    if (errorComponent) {
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(ErrorBoundaryHandler, {
            pathname: pathname,
            errorComponent: errorComponent,
            errorStyles: errorStyles,
            errorScripts: errorScripts,
            children: children
        });
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
        children: children
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=error-boundary.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/normalize-trailing-slash.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "normalizePathTrailingSlash", {
    enumerable: true,
    get: function() {
        return normalizePathTrailingSlash;
    }
});
const _removetrailingslash = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/utils/remove-trailing-slash.js [app-client] (ecmascript)");
const _parsepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/utils/parse-path.js [app-client] (ecmascript)");
const normalizePathTrailingSlash = (path)=>{
    if (!path.startsWith('/') || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.__NEXT_MANUAL_TRAILING_SLASH) {
        return path;
    }
    const { pathname, query, hash } = (0, _parsepath.parsePath)(path);
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    return "" + (0, _removetrailingslash.removeTrailingSlash)(pathname) + query + hash;
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=normalize-trailing-slash.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/add-base-path.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "addBasePath", {
    enumerable: true,
    get: function() {
        return addBasePath;
    }
});
const _addpathprefix = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/utils/add-path-prefix.js [app-client] (ecmascript)");
const _normalizetrailingslash = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/normalize-trailing-slash.js [app-client] (ecmascript)");
const basePath = ("TURBOPACK compile-time value", "") || '';
function addBasePath(path, required) {
    return (0, _normalizetrailingslash.normalizePathTrailingSlash)(("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : (0, _addpathprefix.addPathPrefix)(path, basePath));
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=add-base-path.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router-announcer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AppRouterAnnouncer", {
    enumerable: true,
    get: function() {
        return AppRouterAnnouncer;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _reactdom = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
const ANNOUNCER_TYPE = 'next-route-announcer';
const ANNOUNCER_ID = '__next-route-announcer__';
function getAnnouncerNode() {
    var _existingAnnouncer_shadowRoot;
    const existingAnnouncer = document.getElementsByName(ANNOUNCER_TYPE)[0];
    if (existingAnnouncer == null ? void 0 : (_existingAnnouncer_shadowRoot = existingAnnouncer.shadowRoot) == null ? void 0 : _existingAnnouncer_shadowRoot.childNodes[0]) {
        return existingAnnouncer.shadowRoot.childNodes[0];
    } else {
        const container = document.createElement(ANNOUNCER_TYPE);
        container.style.cssText = 'position:absolute';
        const announcer = document.createElement('div');
        announcer.ariaLive = 'assertive';
        announcer.id = ANNOUNCER_ID;
        announcer.role = 'alert';
        announcer.style.cssText = 'position:absolute;border:0;height:1px;margin:-1px;padding:0;width:1px;clip:rect(0 0 0 0);overflow:hidden;white-space:nowrap;word-wrap:normal';
        // Use shadow DOM here to avoid any potential CSS bleed
        const shadow = container.attachShadow({
            mode: 'open'
        });
        shadow.appendChild(announcer);
        document.body.appendChild(container);
        return announcer;
    }
}
function AppRouterAnnouncer(param) {
    let { tree } = param;
    const [portalNode, setPortalNode] = (0, _react.useState)(null);
    (0, _react.useEffect)(()=>{
        const announcer = getAnnouncerNode();
        setPortalNode(announcer);
        return ()=>{
            const container = document.getElementsByTagName(ANNOUNCER_TYPE)[0];
            if (container == null ? void 0 : container.isConnected) {
                document.body.removeChild(container);
            }
        };
    }, []);
    const [routeAnnouncement, setRouteAnnouncement] = (0, _react.useState)('');
    const previousTitle = (0, _react.useRef)(undefined);
    (0, _react.useEffect)(()=>{
        let currentTitle = '';
        if (document.title) {
            currentTitle = document.title;
        } else {
            const pageHeader = document.querySelector('h1');
            if (pageHeader) {
                currentTitle = pageHeader.innerText || pageHeader.textContent || '';
            }
        }
        // Only announce the title change, but not for the first load because screen
        // readers do that automatically.
        if (previousTitle.current !== undefined && previousTitle.current !== currentTitle) {
            setRouteAnnouncement(currentTitle);
        }
        previousTitle.current = currentTitle;
    }, [
        tree
    ]);
    return portalNode ? /*#__PURE__*/ (0, _reactdom.createPortal)(routeAnnouncement, portalNode) : null;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-router-announcer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/get-segment-value.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getSegmentValue", {
    enumerable: true,
    get: function() {
        return getSegmentValue;
    }
});
function getSegmentValue(segment) {
    return Array.isArray(segment) ? segment[1] : segment;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=get-segment-value.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/hooks-server-context.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    DynamicServerError: null,
    isDynamicServerError: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    DynamicServerError: function() {
        return DynamicServerError;
    },
    isDynamicServerError: function() {
        return isDynamicServerError;
    }
});
const DYNAMIC_ERROR_CODE = 'DYNAMIC_SERVER_USAGE';
class DynamicServerError extends Error {
    constructor(description){
        super("Dynamic server usage: " + description);
        this.description = description;
        this.digest = DYNAMIC_ERROR_CODE;
    }
}
function isDynamicServerError(err) {
    if (typeof err !== 'object' || err === null || !('digest' in err) || typeof err.digest !== 'string') {
        return false;
    }
    return err.digest === DYNAMIC_ERROR_CODE;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=hooks-server-context.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/static-generation-bailout.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    StaticGenBailoutError: null,
    isStaticGenBailoutError: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    StaticGenBailoutError: function() {
        return StaticGenBailoutError;
    },
    isStaticGenBailoutError: function() {
        return isStaticGenBailoutError;
    }
});
const NEXT_STATIC_GEN_BAILOUT = 'NEXT_STATIC_GEN_BAILOUT';
class StaticGenBailoutError extends Error {
    constructor(...args){
        super(...args);
        this.code = NEXT_STATIC_GEN_BAILOUT;
    }
}
function isStaticGenBailoutError(error) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }
    return error.code === NEXT_STATIC_GEN_BAILOUT;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=static-generation-bailout.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/unstable-rethrow.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "unstable_rethrow", {
    enumerable: true,
    get: function() {
        return unstable_rethrow;
    }
});
const _isdynamicusageerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/export/helpers/is-dynamic-usage-error.js [app-client] (ecmascript)");
const _ispostpone = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/lib/router-utils/is-postpone.js [app-client] (ecmascript)");
const _bailouttocsr = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js [app-client] (ecmascript)");
const _isnextroutererror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-next-router-error.js [app-client] (ecmascript)");
function unstable_rethrow(error) {
    if ((0, _isnextroutererror.isNextRouterError)(error) || (0, _bailouttocsr.isBailoutToCSRError)(error) || (0, _isdynamicusageerror.isDynamicUsageError)(error) || (0, _ispostpone.isPostpone)(error)) {
        throw error;
    }
    if (error instanceof Error && 'cause' in error) {
        unstable_rethrow(error.cause);
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=unstable-rethrow.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation.react-server.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/** @internal */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    ReadonlyURLSearchParams: null,
    RedirectType: null,
    notFound: null,
    permanentRedirect: null,
    redirect: null,
    unstable_rethrow: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    ReadonlyURLSearchParams: function() {
        return ReadonlyURLSearchParams;
    },
    RedirectType: function() {
        return _redirect.RedirectType;
    },
    notFound: function() {
        return _notfound.notFound;
    },
    permanentRedirect: function() {
        return _redirect.permanentRedirect;
    },
    redirect: function() {
        return _redirect.redirect;
    },
    unstable_rethrow: function() {
        return _unstablerethrow.unstable_rethrow;
    }
});
const _redirect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect.js [app-client] (ecmascript)");
const _notfound = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/not-found.js [app-client] (ecmascript)");
const _unstablerethrow = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/unstable-rethrow.js [app-client] (ecmascript)");
class ReadonlyURLSearchParamsError extends Error {
    constructor(){
        super('Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams');
    }
}
class ReadonlyURLSearchParams extends URLSearchParams {
    /** @deprecated Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams */ append() {
        throw new ReadonlyURLSearchParamsError();
    }
    /** @deprecated Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams */ delete() {
        throw new ReadonlyURLSearchParamsError();
    }
    /** @deprecated Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams */ set() {
        throw new ReadonlyURLSearchParamsError();
    }
    /** @deprecated Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams */ sort() {
        throw new ReadonlyURLSearchParamsError();
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=navigation.react-server.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/bailout-to-client-rendering.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "bailoutToClientRendering", {
    enumerable: true,
    get: function() {
        return bailoutToClientRendering;
    }
});
const _bailouttocsr = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js [app-client] (ecmascript)");
const _workasyncstorageexternal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/work-async-storage.external.js [app-client] (ecmascript)");
function bailoutToClientRendering(reason) {
    const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
    if (workStore == null ? void 0 : workStore.forceStatic) return;
    if (workStore == null ? void 0 : workStore.isStaticGeneration) throw new _bailouttocsr.BailoutToCSRError(reason);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=bailout-to-client-rendering.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    ReadonlyURLSearchParams: null,
    RedirectType: null,
    ServerInsertedHTMLContext: null,
    notFound: null,
    permanentRedirect: null,
    redirect: null,
    unstable_rethrow: null,
    useParams: null,
    usePathname: null,
    useRouter: null,
    useSearchParams: null,
    useSelectedLayoutSegment: null,
    useSelectedLayoutSegments: null,
    useServerInsertedHTML: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    ReadonlyURLSearchParams: function() {
        return _navigationreactserver.ReadonlyURLSearchParams;
    },
    RedirectType: function() {
        return _navigationreactserver.RedirectType;
    },
    ServerInsertedHTMLContext: function() {
        return _serverinsertedhtmlsharedruntime.ServerInsertedHTMLContext;
    },
    notFound: function() {
        return _navigationreactserver.notFound;
    },
    permanentRedirect: function() {
        return _navigationreactserver.permanentRedirect;
    },
    redirect: function() {
        return _navigationreactserver.redirect;
    },
    unstable_rethrow: function() {
        return _navigationreactserver.unstable_rethrow;
    },
    useParams: function() {
        return useParams;
    },
    usePathname: function() {
        return usePathname;
    },
    useRouter: function() {
        return useRouter;
    },
    useSearchParams: function() {
        return useSearchParams;
    },
    useSelectedLayoutSegment: function() {
        return useSelectedLayoutSegment;
    },
    useSelectedLayoutSegments: function() {
        return useSelectedLayoutSegments;
    },
    useServerInsertedHTML: function() {
        return _serverinsertedhtmlsharedruntime.useServerInsertedHTML;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _approutercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
const _hooksclientcontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/hooks-client-context.shared-runtime.js [app-client] (ecmascript)");
const _getsegmentvalue = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/get-segment-value.js [app-client] (ecmascript)");
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
const _navigationreactserver = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation.react-server.js [app-client] (ecmascript)");
const _dynamicrendering = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/dynamic-rendering.js [app-client] (ecmascript)");
const _serverinsertedhtmlsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/server-inserted-html.shared-runtime.js [app-client] (ecmascript)");
function useSearchParams() {
    const searchParams = (0, _react.useContext)(_hooksclientcontextsharedruntime.SearchParamsContext);
    // In the case where this is `null`, the compat types added in
    // `next-env.d.ts` will add a new overload that changes the return type to
    // include `null`.
    const readonlySearchParams = (0, _react.useMemo)(()=>{
        if (!searchParams) {
            // When the router is not ready in pages, we won't have the search params
            // available.
            return null;
        }
        return new _navigationreactserver.ReadonlyURLSearchParams(searchParams);
    }, [
        searchParams
    ]);
    if (typeof window === 'undefined') {
        // AsyncLocalStorage should not be included in the client bundle.
        const { bailoutToClientRendering } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/bailout-to-client-rendering.js [app-client] (ecmascript)");
        // TODO-APP: handle dynamic = 'force-static' here and on the client
        bailoutToClientRendering('useSearchParams()');
    }
    return readonlySearchParams;
}
function usePathname() {
    (0, _dynamicrendering.useDynamicRouteParams)('usePathname()');
    // In the case where this is `null`, the compat types added in `next-env.d.ts`
    // will add a new overload that changes the return type to include `null`.
    return (0, _react.useContext)(_hooksclientcontextsharedruntime.PathnameContext);
}
function useRouter() {
    const router = (0, _react.useContext)(_approutercontextsharedruntime.AppRouterContext);
    if (router === null) {
        throw new Error('invariant expected app router to be mounted');
    }
    return router;
}
function useParams() {
    (0, _dynamicrendering.useDynamicRouteParams)('useParams()');
    return (0, _react.useContext)(_hooksclientcontextsharedruntime.PathParamsContext);
}
/** Get the canonical parameters from the current level to the leaf node. */ // Client components API
function getSelectedLayoutSegmentPath(tree, parallelRouteKey, first, segmentPath) {
    if (first === void 0) first = true;
    if (segmentPath === void 0) segmentPath = [];
    let node;
    if (first) {
        // Use the provided parallel route key on the first parallel route
        node = tree[1][parallelRouteKey];
    } else {
        // After first parallel route prefer children, if there's no children pick the first parallel route.
        const parallelRoutes = tree[1];
        var _parallelRoutes_children;
        node = (_parallelRoutes_children = parallelRoutes.children) != null ? _parallelRoutes_children : Object.values(parallelRoutes)[0];
    }
    if (!node) return segmentPath;
    const segment = node[0];
    let segmentValue = (0, _getsegmentvalue.getSegmentValue)(segment);
    if (!segmentValue || segmentValue.startsWith(_segment.PAGE_SEGMENT_KEY)) {
        return segmentPath;
    }
    segmentPath.push(segmentValue);
    return getSelectedLayoutSegmentPath(node, parallelRouteKey, false, segmentPath);
}
function useSelectedLayoutSegments(parallelRouteKey) {
    if (parallelRouteKey === void 0) parallelRouteKey = 'children';
    (0, _dynamicrendering.useDynamicRouteParams)('useSelectedLayoutSegments()');
    const context = (0, _react.useContext)(_approutercontextsharedruntime.LayoutRouterContext);
    // @ts-expect-error This only happens in `pages`. Type is overwritten in navigation.d.ts
    if (!context) return null;
    return getSelectedLayoutSegmentPath(context.tree, parallelRouteKey);
}
function useSelectedLayoutSegment(parallelRouteKey) {
    if (parallelRouteKey === void 0) parallelRouteKey = 'children';
    (0, _dynamicrendering.useDynamicRouteParams)('useSelectedLayoutSegment()');
    const selectedLayoutSegments = useSelectedLayoutSegments(parallelRouteKey);
    if (!selectedLayoutSegments || selectedLayoutSegments.length === 0) {
        return null;
    }
    const selectedLayoutSegment = parallelRouteKey === 'children' ? selectedLayoutSegments[0] : selectedLayoutSegments[selectedLayoutSegments.length - 1];
    // if the default slot is showing, we return null since it's not technically "selected" (it's a fallback)
    // and returning an internal value like `__DEFAULT__` would be confusing.
    return selectedLayoutSegment === _segment.DEFAULT_SEGMENT_KEY ? null : selectedLayoutSegment;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=navigation.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect-boundary.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    RedirectBoundary: null,
    RedirectErrorBoundary: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    RedirectBoundary: function() {
        return RedirectBoundary;
    },
    RedirectErrorBoundary: function() {
        return RedirectErrorBoundary;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _navigation = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)");
const _redirect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect.js [app-client] (ecmascript)");
function HandleRedirect(param) {
    let { redirect, reset, redirectType } = param;
    const router = (0, _navigation.useRouter)();
    (0, _react.useEffect)(()=>{
        _react.default.startTransition(()=>{
            if (redirectType === _redirect.RedirectType.push) {
                router.push(redirect, {});
            } else {
                router.replace(redirect, {});
            }
            reset();
        });
    }, [
        redirect,
        redirectType,
        reset,
        router
    ]);
    return null;
}
class RedirectErrorBoundary extends _react.default.Component {
    static getDerivedStateFromError(error) {
        if ((0, _redirect.isRedirectError)(error)) {
            const url = (0, _redirect.getURLFromRedirectError)(error);
            const redirectType = (0, _redirect.getRedirectTypeFromError)(error);
            return {
                redirect: url,
                redirectType
            };
        }
        // Re-throw if error is not for redirect
        throw error;
    }
    // Explicit type is needed to avoid the generated `.d.ts` having a wide return type that could be specific to the `@types/react` version.
    render() {
        const { redirect, redirectType } = this.state;
        if (redirect !== null && redirectType !== null) {
            return /*#__PURE__*/ (0, _jsxruntime.jsx)(HandleRedirect, {
                redirect: redirect,
                redirectType: redirectType,
                reset: ()=>this.setState({
                        redirect: null
                    })
            });
        }
        return this.props.children;
    }
    constructor(props){
        super(props);
        this.state = {
            redirect: null,
            redirectType: null
        };
    }
}
function RedirectBoundary(param) {
    let { children } = param;
    const router = (0, _navigation.useRouter)();
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(RedirectErrorBoundary, {
        router: router,
        children: children
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=redirect-boundary.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/find-head-in-cache.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "findHeadInCache", {
    enumerable: true,
    get: function() {
        return findHeadInCache;
    }
});
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
function findHeadInCache(cache, parallelRoutes) {
    return findHeadInCacheImpl(cache, parallelRoutes, '');
}
function findHeadInCacheImpl(cache, parallelRoutes, keyPrefix) {
    const isLastItem = Object.keys(parallelRoutes).length === 0;
    if (isLastItem) {
        // Returns the entire Cache Node of the segment whose head we will render.
        return [
            cache,
            keyPrefix
        ];
    }
    for(const key in parallelRoutes){
        const [segment, childParallelRoutes] = parallelRoutes[key];
        const childSegmentMap = cache.parallelRoutes.get(key);
        if (!childSegmentMap) {
            continue;
        }
        const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(segment);
        const cacheNode = childSegmentMap.get(cacheKey);
        if (!cacheNode) {
            continue;
        }
        const item = findHeadInCacheImpl(cacheNode, childParallelRoutes, keyPrefix + '/' + cacheKey);
        if (item) {
            return item;
        }
    }
    return null;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=find-head-in-cache.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/unresolved-thenable.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * Create a "Thenable" that does not resolve. This is used to suspend indefinitely when data is not available yet.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "unresolvedThenable", {
    enumerable: true,
    get: function() {
        return unresolvedThenable;
    }
});
const unresolvedThenable = {
    then: ()=>{}
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=unresolved-thenable.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/has-base-path.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "hasBasePath", {
    enumerable: true,
    get: function() {
        return hasBasePath;
    }
});
const _pathhasprefix = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/utils/path-has-prefix.js [app-client] (ecmascript)");
const basePath = ("TURBOPACK compile-time value", "") || '';
function hasBasePath(path) {
    return (0, _pathhasprefix.pathHasPrefix)(path, basePath);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=has-base-path.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/remove-base-path.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "removeBasePath", {
    enumerable: true,
    get: function() {
        return removeBasePath;
    }
});
const _hasbasepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/has-base-path.js [app-client] (ecmascript)");
const basePath = ("TURBOPACK compile-time value", "") || '';
function removeBasePath(path) {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    // Can't trim the basePath if it has zero length!
    if (basePath.length === 0) return path;
    path = path.slice(basePath.length);
    if (!path.startsWith('/')) path = "/" + path;
    return path;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=remove-base-path.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/not-found-boundary.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NotFoundBoundary", {
    enumerable: true,
    get: function() {
        return NotFoundBoundary;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _navigationuntracked = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation-untracked.js [app-client] (ecmascript)");
const _notfound = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/not-found.js [app-client] (ecmascript)");
const _warnonce = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/utils/warn-once.js [app-client] (ecmascript)");
const _approutercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
class NotFoundErrorBoundary extends _react.default.Component {
    componentDidCatch() {
        if (("TURBOPACK compile-time value", "development") === 'development' && this.props.missingSlots && // A missing children slot is the typical not-found case, so no need to warn
        !this.props.missingSlots.has('children')) {
            let warningMessage = 'No default component was found for a parallel route rendered on this page. Falling back to nearest NotFound boundary.\n' + 'Learn more: https://nextjs.org/docs/app/building-your-application/routing/parallel-routes#defaultjs\n\n';
            if (this.props.missingSlots.size > 0) {
                const formattedSlots = Array.from(this.props.missingSlots).sort((a, b)=>a.localeCompare(b)).map((slot)=>"@" + slot).join(', ');
                warningMessage += 'Missing slots: ' + formattedSlots;
            }
            (0, _warnonce.warnOnce)(warningMessage);
        }
    }
    static getDerivedStateFromError(error) {
        if ((0, _notfound.isNotFoundError)(error)) {
            return {
                notFoundTriggered: true
            };
        }
        // Re-throw if error is not for 404
        throw error;
    }
    static getDerivedStateFromProps(props, state) {
        /**
     * Handles reset of the error boundary when a navigation happens.
     * Ensures the error boundary does not stay enabled when navigating to a new page.
     * Approach of setState in render is safe as it checks the previous pathname and then overrides
     * it as outlined in https://react.dev/reference/react/useState#storing-information-from-previous-renders
     */ if (props.pathname !== state.previousPathname && state.notFoundTriggered) {
            return {
                notFoundTriggered: false,
                previousPathname: props.pathname
            };
        }
        return {
            notFoundTriggered: state.notFoundTriggered,
            previousPathname: props.pathname
        };
    }
    render() {
        if (this.state.notFoundTriggered) {
            return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("meta", {
                        name: "robots",
                        content: "noindex"
                    }),
                    ("TURBOPACK compile-time value", "development") === 'development' && /*#__PURE__*/ (0, _jsxruntime.jsx)("meta", {
                        name: "next-error",
                        content: "not-found"
                    }),
                    this.props.notFoundStyles,
                    this.props.notFound
                ]
            });
        }
        return this.props.children;
    }
    constructor(props){
        super(props);
        this.state = {
            notFoundTriggered: !!props.asNotFound,
            previousPathname: props.pathname
        };
    }
}
function NotFoundBoundary(param) {
    let { notFound, notFoundStyles, asNotFound, children } = param;
    // When we're rendering the missing params shell, this will return null. This
    // is because we won't be rendering any not found boundaries or error
    // boundaries for the missing params shell. When this runs on the client
    // (where these error can occur), we will get the correct pathname.
    const pathname = (0, _navigationuntracked.useUntrackedPathname)();
    const missingSlots = (0, _react.useContext)(_approutercontextsharedruntime.MissingSlotContext);
    if (notFound) {
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(NotFoundErrorBoundary, {
            pathname: pathname,
            notFound: notFound,
            notFoundStyles: notFoundStyles,
            asNotFound: asNotFound,
            missingSlots: missingSlots,
            children: children
        });
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
        children: children
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=not-found-boundary.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/dev-root-not-found-boundary.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    DevRootNotFoundBoundary: null,
    bailOnNotFound: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    DevRootNotFoundBoundary: function() {
        return DevRootNotFoundBoundary;
    },
    bailOnNotFound: function() {
        return bailOnNotFound;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _notfoundboundary = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/not-found-boundary.js [app-client] (ecmascript)");
function bailOnNotFound() {
    throw new Error('notFound() is not allowed to use in root layout');
}
function NotAllowedRootNotFoundError() {
    bailOnNotFound();
    return null;
}
function DevRootNotFoundBoundary(param) {
    let { children } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_notfoundboundary.NotFoundBoundary, {
        notFound: /*#__PURE__*/ (0, _jsxruntime.jsx)(NotAllowedRootNotFoundError, {}),
        children: children
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=dev-root-not-found-boundary.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/format-webpack-messages.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
MIT License

Copyright (c) 2015-present, Facebook, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return formatWebpackMessages;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _stripansi = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/strip-ansi/index.js [app-client] (ecmascript)"));
// This file is based on https://github.com/facebook/create-react-app/blob/7b1a32be6ec9f99a6c9a3c66813f3ac09c4736b9/packages/react-dev-utils/formatWebpackMessages.js
// It's been edited to remove chalk and CRA-specific logic
const friendlySyntaxErrorLabel = 'Syntax error:';
const WEBPACK_BREAKING_CHANGE_POLYFILLS = '\n\nBREAKING CHANGE: webpack < 5 used to include polyfills for node.js core modules by default.';
function isLikelyASyntaxError(message) {
    return (0, _stripansi.default)(message).includes(friendlySyntaxErrorLabel);
}
let hadMissingSassError = false;
// Cleans up webpack error messages.
function formatMessage(message, verbose, importTraceNote) {
    // TODO: Replace this once webpack 5 is stable
    if (typeof message === 'object' && message.message) {
        const filteredModuleTrace = message.moduleTrace && message.moduleTrace.filter((trace)=>!/next-(middleware|client-pages|route|edge-function)-loader\.js/.test(trace.originName));
        let body = message.message;
        const breakingChangeIndex = body.indexOf(WEBPACK_BREAKING_CHANGE_POLYFILLS);
        if (breakingChangeIndex >= 0) {
            body = body.slice(0, breakingChangeIndex);
        }
        message = (message.moduleName ? (0, _stripansi.default)(message.moduleName) + '\n' : '') + (message.file ? (0, _stripansi.default)(message.file) + '\n' : '') + body + (message.details && verbose ? '\n' + message.details : '') + (filteredModuleTrace && filteredModuleTrace.length ? (importTraceNote || '\n\nImport trace for requested module:') + filteredModuleTrace.map((trace)=>"\n" + trace.moduleName).join('') : '') + (message.stack && verbose ? '\n' + message.stack : '');
    }
    let lines = message.split('\n');
    // Strip Webpack-added headers off errors/warnings
    // https://github.com/webpack/webpack/blob/master/lib/ModuleError.js
    lines = lines.filter((line)=>!/Module [A-z ]+\(from/.test(line));
    // Transform parsing error into syntax error
    // TODO: move this to our ESLint formatter?
    lines = lines.map((line)=>{
        const parsingError = /Line (\d+):(?:(\d+):)?\s*Parsing error: (.+)$/.exec(line);
        if (!parsingError) {
            return line;
        }
        const [, errorLine, errorColumn, errorMessage] = parsingError;
        return friendlySyntaxErrorLabel + " " + errorMessage + " (" + errorLine + ":" + errorColumn + ")";
    });
    message = lines.join('\n');
    // Smoosh syntax errors (commonly found in CSS)
    message = message.replace(/SyntaxError\s+\((\d+):(\d+)\)\s*(.+?)\n/g, "" + friendlySyntaxErrorLabel + " $3 ($1:$2)\n");
    // Clean up export errors
    message = message.replace(/^.*export '(.+?)' was not found in '(.+?)'.*$/gm, "Attempted import error: '$1' is not exported from '$2'.");
    message = message.replace(/^.*export 'default' \(imported as '(.+?)'\) was not found in '(.+?)'.*$/gm, "Attempted import error: '$2' does not contain a default export (imported as '$1').");
    message = message.replace(/^.*export '(.+?)' \(imported as '(.+?)'\) was not found in '(.+?)'.*$/gm, "Attempted import error: '$1' is not exported from '$3' (imported as '$2').");
    lines = message.split('\n');
    // Remove leading newline
    if (lines.length > 2 && lines[1].trim() === '') {
        lines.splice(1, 1);
    }
    // Cleans up verbose "module not found" messages for files and packages.
    if (lines[1] && lines[1].startsWith('Module not found: ')) {
        lines = [
            lines[0],
            lines[1].replace('Error: ', '').replace('Module not found: Cannot find file:', 'Cannot find file:'),
            ...lines.slice(2)
        ];
    }
    // Add helpful message for users trying to use Sass for the first time
    if (lines[1] && lines[1].match(/Cannot find module.+sass/)) {
        // ./file.module.scss (<<loader info>>) => ./file.module.scss
        const firstLine = lines[0].split('!');
        lines[0] = firstLine[firstLine.length - 1];
        lines[1] = "To use Next.js' built-in Sass support, you first need to install `sass`.\n";
        lines[1] += 'Run `npm i sass` or `yarn add sass` inside your workspace.\n';
        lines[1] += '\nLearn more: https://nextjs.org/docs/messages/install-sass';
        // dispose of unhelpful stack trace
        lines = lines.slice(0, 2);
        hadMissingSassError = true;
    } else if (hadMissingSassError && message.match(/(sass-loader|resolve-url-loader: CSS error)/)) {
        // dispose of unhelpful stack trace following missing sass module
        lines = [];
    }
    if (!verbose) {
        message = lines.join('\n');
        // Internal stacks are generally useless so we strip them... with the
        // exception of stacks containing `webpack:` because they're normally
        // from user code generated by Webpack. For more information see
        // https://github.com/facebook/create-react-app/pull/1050
        message = message.replace(/^\s*at\s((?!webpack:).)*:\d+:\d+[\s)]*(\n|$)/gm, '') // at ... ...:x:y
        ;
        message = message.replace(/^\s*at\s<anonymous>(\n|$)/gm, '') // at <anonymous>
        ;
        message = message.replace(/File was processed with these loaders:\n(.+[\\/](next[\\/]dist[\\/].+|@next[\\/]react-refresh-utils[\\/]loader)\.js\n)*You may need an additional loader to handle the result of these loaders.\n/g, '');
        lines = message.split('\n');
    }
    // Remove duplicated newlines
    lines = lines.filter((line, index, arr)=>index === 0 || line.trim() !== '' || line.trim() !== arr[index - 1].trim());
    // Reassemble the message
    message = lines.join('\n');
    return message.trim();
}
function formatWebpackMessages(json, verbose) {
    const formattedErrors = json.errors.map((message)=>{
        const isUnknownNextFontError = message.message.includes('An error occurred in `next/font`.');
        return formatMessage(message, isUnknownNextFontError || verbose);
    });
    const formattedWarnings = json.warnings.map((message)=>{
        return formatMessage(message, verbose);
    });
    // Reorder errors to put the most relevant ones first.
    let reactServerComponentsError = -1;
    for(let i = 0; i < formattedErrors.length; i++){
        const error = formattedErrors[i];
        if (error.includes('ReactServerComponentsError')) {
            reactServerComponentsError = i;
            break;
        }
    }
    // Move the reactServerComponentsError to the top if it exists
    if (reactServerComponentsError !== -1) {
        const error = formattedErrors.splice(reactServerComponentsError, 1);
        formattedErrors.unshift(error[0]);
    }
    const result = {
        ...json,
        errors: formattedErrors,
        warnings: formattedWarnings
    };
    if (!verbose && result.errors.some(isLikelyASyntaxError)) {
        // If there are any syntax errors, show just them.
        result.errors = result.errors.filter(isLikelyASyntaxError);
        result.warnings = [];
    }
    return result;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=format-webpack-messages.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/shared.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    ACTION_BEFORE_REFRESH: null,
    ACTION_BUILD_ERROR: null,
    ACTION_BUILD_OK: null,
    ACTION_DEBUG_INFO: null,
    ACTION_REFRESH: null,
    ACTION_STATIC_INDICATOR: null,
    ACTION_UNHANDLED_ERROR: null,
    ACTION_UNHANDLED_REJECTION: null,
    ACTION_VERSION_INFO: null,
    INITIAL_OVERLAY_STATE: null,
    REACT_REFRESH_FULL_RELOAD_FROM_ERROR: null,
    useErrorOverlayReducer: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    ACTION_BEFORE_REFRESH: function() {
        return ACTION_BEFORE_REFRESH;
    },
    ACTION_BUILD_ERROR: function() {
        return ACTION_BUILD_ERROR;
    },
    ACTION_BUILD_OK: function() {
        return ACTION_BUILD_OK;
    },
    ACTION_DEBUG_INFO: function() {
        return ACTION_DEBUG_INFO;
    },
    ACTION_REFRESH: function() {
        return ACTION_REFRESH;
    },
    ACTION_STATIC_INDICATOR: function() {
        return ACTION_STATIC_INDICATOR;
    },
    ACTION_UNHANDLED_ERROR: function() {
        return ACTION_UNHANDLED_ERROR;
    },
    ACTION_UNHANDLED_REJECTION: function() {
        return ACTION_UNHANDLED_REJECTION;
    },
    ACTION_VERSION_INFO: function() {
        return ACTION_VERSION_INFO;
    },
    INITIAL_OVERLAY_STATE: function() {
        return INITIAL_OVERLAY_STATE;
    },
    REACT_REFRESH_FULL_RELOAD_FROM_ERROR: function() {
        return REACT_REFRESH_FULL_RELOAD_FROM_ERROR;
    },
    useErrorOverlayReducer: function() {
        return useErrorOverlayReducer;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const ACTION_STATIC_INDICATOR = 'static-indicator';
const ACTION_BUILD_OK = 'build-ok';
const ACTION_BUILD_ERROR = 'build-error';
const ACTION_BEFORE_REFRESH = 'before-fast-refresh';
const ACTION_REFRESH = 'fast-refresh';
const ACTION_VERSION_INFO = 'version-info';
const ACTION_UNHANDLED_ERROR = 'unhandled-error';
const ACTION_UNHANDLED_REJECTION = 'unhandled-rejection';
const ACTION_DEBUG_INFO = 'debug-info';
function pushErrorFilterDuplicates(errors, err) {
    return [
        ...errors.filter((e)=>{
            // Filter out duplicate errors
            return e.event.reason !== err.event.reason;
        }),
        err
    ];
}
const INITIAL_OVERLAY_STATE = {
    nextId: 1,
    buildError: null,
    errors: [],
    notFound: false,
    staticIndicator: false,
    refreshState: {
        type: 'idle'
    },
    rootLayoutMissingTags: [],
    versionInfo: {
        installed: '0.0.0',
        staleness: 'unknown'
    },
    debugInfo: undefined
};
function useErrorOverlayReducer() {
    return (0, _react.useReducer)((_state, action)=>{
        switch(action.type){
            case ACTION_DEBUG_INFO:
                {
                    return {
                        ..._state,
                        debugInfo: action.debugInfo
                    };
                }
            case ACTION_STATIC_INDICATOR:
                {
                    return {
                        ..._state,
                        staticIndicator: action.staticIndicator
                    };
                }
            case ACTION_BUILD_OK:
                {
                    return {
                        ..._state,
                        buildError: null
                    };
                }
            case ACTION_BUILD_ERROR:
                {
                    return {
                        ..._state,
                        buildError: action.message
                    };
                }
            case ACTION_BEFORE_REFRESH:
                {
                    return {
                        ..._state,
                        refreshState: {
                            type: 'pending',
                            errors: []
                        }
                    };
                }
            case ACTION_REFRESH:
                {
                    return {
                        ..._state,
                        buildError: null,
                        errors: // and UNHANDLED_REJECTION events might be dispatched between the
                        // BEFORE_REFRESH and the REFRESH event. We want to keep those errors
                        // around until the next refresh. Otherwise we run into a race
                        // condition where those errors would be cleared on refresh completion
                        // before they can be displayed.
                        _state.refreshState.type === 'pending' ? _state.refreshState.errors : [],
                        refreshState: {
                            type: 'idle'
                        }
                    };
                }
            case ACTION_UNHANDLED_ERROR:
            case ACTION_UNHANDLED_REJECTION:
                {
                    switch(_state.refreshState.type){
                        case 'idle':
                            {
                                return {
                                    ..._state,
                                    nextId: _state.nextId + 1,
                                    errors: pushErrorFilterDuplicates(_state.errors, {
                                        id: _state.nextId,
                                        event: action
                                    })
                                };
                            }
                        case 'pending':
                            {
                                return {
                                    ..._state,
                                    nextId: _state.nextId + 1,
                                    refreshState: {
                                        ..._state.refreshState,
                                        errors: pushErrorFilterDuplicates(_state.refreshState.errors, {
                                            id: _state.nextId,
                                            event: action
                                        })
                                    }
                                };
                            }
                        default:
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const _ = _state.refreshState;
                            return _state;
                    }
                }
            case ACTION_VERSION_INFO:
                {
                    return {
                        ..._state,
                        versionInfo: action.versionInfo
                    };
                }
            default:
                {
                    return _state;
                }
        }
    }, INITIAL_OVERLAY_STATE);
}
const REACT_REFRESH_FULL_RELOAD_FROM_ERROR = '[Fast Refresh] performing full reload because your application had an unrecoverable error';
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=shared.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/parse-stack.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "parseStack", {
    enumerable: true,
    get: function() {
        return parseStack;
    }
});
const _stacktraceparser = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/stacktrace-parser/stack-trace-parser.cjs.js [app-client] (ecmascript)");
const _ishydrationerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/is-hydration-error.js [app-client] (ecmascript)");
const regexNextStatic = /\/_next(\/static\/.+)/;
function parseStack(stack) {
    if (!stack) return [];
    const messageAndStack = stack.replace(/^Error: /, '');
    if ((0, _ishydrationerror.isReactHydrationErrorMessage)(messageAndStack)) {
        const { stack: parsedStack } = (0, _ishydrationerror.getHydrationErrorStackInfo)(messageAndStack);
        if (parsedStack) {
            stack = parsedStack;
        }
    }
    // throw away eval information that stacktrace-parser doesn't support
    // adapted from https://github.com/stacktracejs/error-stack-parser/blob/9f33c224b5d7b607755eb277f9d51fcdb7287e24/error-stack-parser.js#L59C33-L59C62
    stack = stack.split('\n').map((line)=>{
        if (line.includes('(eval ')) {
            line = line.replace(/eval code/g, 'eval').replace(/\(eval at [^()]* \(/, '(file://').replace(/\),.*$/g, ')');
        }
        return line;
    }).join('\n');
    const frames = (0, _stacktraceparser.parse)(stack);
    return frames.map((frame)=>{
        try {
            const url = new URL(frame.file);
            const res = regexNextStatic.exec(url.pathname);
            if (res) {
                var _process_env___NEXT_DIST_DIR_replace, _process_env___NEXT_DIST_DIR;
                const distDir = (_process_env___NEXT_DIST_DIR = ("TURBOPACK compile-time value", "/Users/user/Desktop/code/kepler/future/examples/vnext/.next")) == null ? void 0 : (_process_env___NEXT_DIST_DIR_replace = _process_env___NEXT_DIST_DIR.replace(/\\/g, '/')) == null ? void 0 : _process_env___NEXT_DIST_DIR_replace.replace(/\/$/, '');
                if (distDir) {
                    frame.file = 'file://' + distDir.concat(res.pop()) + url.search;
                }
            }
        } catch (e) {}
        return frame;
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=parse-stack.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/ShadowPortal.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ShadowPortal", {
    enumerable: true,
    get: function() {
        return ShadowPortal;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _reactdom = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
function ShadowPortal(param) {
    let { children } = param;
    let portalNode = _react.useRef(null);
    let shadowNode = _react.useRef(null);
    let [, forceUpdate] = _react.useState();
    _react.useLayoutEffect({
        "ShadowPortal.useLayoutEffect": ()=>{
            const ownerDocument = document;
            portalNode.current = ownerDocument.createElement('nextjs-portal');
            shadowNode.current = portalNode.current.attachShadow({
                mode: 'open'
            });
            ownerDocument.body.appendChild(portalNode.current);
            forceUpdate({});
            return ({
                "ShadowPortal.useLayoutEffect": ()=>{
                    if (portalNode.current && portalNode.current.ownerDocument) {
                        portalNode.current.ownerDocument.body.removeChild(portalNode.current);
                    }
                }
            })["ShadowPortal.useLayoutEffect"];
        }
    }["ShadowPortal.useLayoutEffect"], []);
    return shadowNode.current ? /*#__PURE__*/ (0, _reactdom.createPortal)(children, shadowNode.current) : null;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=ShadowPortal.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/hooks/use-on-click-outside.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "useOnClickOutside", {
    enumerable: true,
    get: function() {
        return useOnClickOutside;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
function useOnClickOutside(el, handler) {
    _react.useEffect({
        "useOnClickOutside.useEffect": ()=>{
            if (el == null || handler == null) {
                return;
            }
            const listener = {
                "useOnClickOutside.useEffect.listener": (e)=>{
                    // Do nothing if clicking ref's element or descendent elements
                    if (!el || el.contains(e.target)) {
                        return;
                    }
                    handler(e);
                }
            }["useOnClickOutside.useEffect.listener"];
            const root = el.getRootNode();
            root.addEventListener('mousedown', listener);
            root.addEventListener('touchstart', listener, {
                passive: false
            });
            return ({
                "useOnClickOutside.useEffect": function() {
                    root.removeEventListener('mousedown', listener);
                    root.removeEventListener('touchstart', listener);
                }
            })["useOnClickOutside.useEffect"];
        }
    }["useOnClickOutside.useEffect"], [
        handler,
        el
    ]);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=use-on-click-outside.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/Dialog.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Dialog", {
    enumerable: true,
    get: function() {
        return Dialog;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _useonclickoutside = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/hooks/use-on-click-outside.js [app-client] (ecmascript)");
const Dialog = function Dialog(param) {
    let { children, type, onClose, ...props } = param;
    const [dialog, setDialog] = _react.useState(null);
    const [role, setRole] = _react.useState(typeof document !== 'undefined' && document.hasFocus() ? 'dialog' : undefined);
    const onDialog = _react.useCallback({
        "Dialog.useCallback[onDialog]": (node)=>{
            setDialog(node);
        }
    }["Dialog.useCallback[onDialog]"], []);
    (0, _useonclickoutside.useOnClickOutside)(dialog, (e)=>{
        e.preventDefault();
        return onClose == null ? void 0 : onClose();
    });
    // Make HTMLElements with `role=link` accessible to be triggered by the
    // keyboard, i.e. [Enter].
    _react.useEffect({
        "Dialog.useEffect": ()=>{
            if (dialog == null) {
                return;
            }
            const root = dialog.getRootNode();
            // Always true, but we do this for TypeScript:
            if (!(root instanceof ShadowRoot)) {
                return;
            }
            const shadowRoot = root;
            function handler(e) {
                const el = shadowRoot.activeElement;
                if (e.key === 'Enter' && el instanceof HTMLElement && el.getAttribute('role') === 'link') {
                    e.preventDefault();
                    e.stopPropagation();
                    el.click();
                }
            }
            function handleFocus() {
                // safari will force itself as the active application when a background page triggers any sort of autofocus
                // this is a workaround to only set the dialog role if the document has focus
                setRole(document.hasFocus() ? 'dialog' : undefined);
            }
            shadowRoot.addEventListener('keydown', handler);
            window.addEventListener('focus', handleFocus);
            window.addEventListener('blur', handleFocus);
            return ({
                "Dialog.useEffect": ()=>{
                    shadowRoot.removeEventListener('keydown', handler);
                    window.removeEventListener('focus', handleFocus);
                    window.removeEventListener('blur', handleFocus);
                }
            })["Dialog.useEffect"];
        }
    }["Dialog.useEffect"], [
        dialog
    ]);
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        ref: onDialog,
        "data-nextjs-dialog": true,
        tabIndex: -1,
        role: role,
        "aria-labelledby": props['aria-labelledby'],
        "aria-describedby": props['aria-describedby'],
        "aria-modal": "true",
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                "data-nextjs-dialog-banner": true,
                className: "banner-" + type
            }),
            children
        ]
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=Dialog.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/DialogBody.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DialogBody", {
    enumerable: true,
    get: function() {
        return DialogBody;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const DialogBody = function DialogBody(param) {
    let { children, className } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
        "data-nextjs-dialog-body": true,
        className: className,
        children: children
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=DialogBody.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/DialogContent.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DialogContent", {
    enumerable: true,
    get: function() {
        return DialogContent;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const DialogContent = function DialogContent(param) {
    let { children, className } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
        "data-nextjs-dialog-content": true,
        className: className,
        children: children
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=DialogContent.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/DialogHeader.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DialogHeader", {
    enumerable: true,
    get: function() {
        return DialogHeader;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const DialogHeader = function DialogHeader(param) {
    let { children, className } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
        "data-nextjs-dialog-header": true,
        className: className,
        children: children
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=DialogHeader.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "noop", {
    enumerable: true,
    get: function() {
        return noop;
    }
});
function noop(strings) {
    for(var _len = arguments.length, keys = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
        keys[_key - 1] = arguments[_key];
    }
    const lastIndex = strings.length - 1;
    return strings.slice(0, lastIndex).reduce((p, s, i)=>p + s + keys[i], '') + strings[lastIndex];
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=noop-template.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/styles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "styles", {
    enumerable: true,
    get: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  [data-nextjs-dialog] {\n    display: flex;\n    flex-direction: column;\n    width: 100%;\n    margin-right: auto;\n    margin-left: auto;\n    outline: none;\n    background: var(--color-background);\n    border-radius: var(--size-gap);\n    box-shadow: 0 var(--size-gap-half) var(--size-gap-double)\n      rgba(0, 0, 0, 0.25);\n    max-height: calc(100% - 56px);\n    overflow-y: hidden;\n  }\n\n  @media (max-height: 812px) {\n    [data-nextjs-dialog-overlay] {\n      max-height: calc(100% - 15px);\n    }\n  }\n\n  @media (min-width: 576px) {\n    [data-nextjs-dialog] {\n      max-width: 540px;\n      box-shadow: 0 var(--size-gap) var(--size-gap-quad) rgba(0, 0, 0, 0.25);\n    }\n  }\n\n  @media (min-width: 768px) {\n    [data-nextjs-dialog] {\n      max-width: 720px;\n    }\n  }\n\n  @media (min-width: 992px) {\n    [data-nextjs-dialog] {\n      max-width: 960px;\n    }\n  }\n\n  [data-nextjs-dialog-banner] {\n    position: relative;\n  }\n  [data-nextjs-dialog-banner].banner-warning {\n    border-color: var(--color-ansi-yellow);\n  }\n  [data-nextjs-dialog-banner].banner-error {\n    border-color: var(--color-ansi-red);\n  }\n\n  [data-nextjs-dialog-banner]::after {\n    z-index: 2;\n    content: '';\n    position: absolute;\n    top: 0;\n    right: 0;\n    width: 100%;\n    /* banner width: */\n    border-top-width: var(--size-gap-half);\n    border-bottom-width: 0;\n    border-top-style: solid;\n    border-bottom-style: solid;\n    border-top-color: inherit;\n    border-bottom-color: transparent;\n  }\n\n  [data-nextjs-dialog-content] {\n    overflow-y: auto;\n    border: none;\n    margin: 0;\n    /* calc(padding + banner width offset) */\n    padding: calc(var(--size-gap-double) + var(--size-gap-half))\n      var(--size-gap-double);\n    height: 100%;\n    display: flex;\n    flex-direction: column;\n  }\n  [data-nextjs-dialog-content] > [data-nextjs-dialog-header] {\n    flex-shrink: 0;\n    margin-bottom: var(--size-gap-double);\n  }\n  [data-nextjs-dialog-content] > [data-nextjs-dialog-body] {\n    position: relative;\n    flex: 1 1 auto;\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=styles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    Dialog: null,
    DialogBody: null,
    DialogContent: null,
    DialogHeader: null,
    styles: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    Dialog: function() {
        return _Dialog.Dialog;
    },
    DialogBody: function() {
        return _DialogBody.DialogBody;
    },
    DialogContent: function() {
        return _DialogContent.DialogContent;
    },
    DialogHeader: function() {
        return _DialogHeader.DialogHeader;
    },
    styles: function() {
        return _styles.styles;
    }
});
const _Dialog = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/Dialog.js [app-client] (ecmascript)");
const _DialogBody = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/DialogBody.js [app-client] (ecmascript)");
const _DialogContent = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/DialogContent.js [app-client] (ecmascript)");
const _DialogHeader = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/DialogHeader.js [app-client] (ecmascript)");
const _styles = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/styles.js [app-client] (ecmascript)");
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/maintain--tab-focus.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/* eslint-disable */ // @ts-nocheck
// Copied from https://github.com/medialize/ally.js
// License: MIT
// Copyright (c) 2015 Rodney Rehm
//
// Entrypoint: ally.js/maintain/tab-focus
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _platform = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/platform/platform.js [app-client] (ecmascript)"));
const _cssescape = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/css.escape/css.escape.js [app-client] (ecmascript)"));
// input may be undefined, selector-tring, Node, NodeList, HTMLCollection, array of Nodes
// yes, to some extent this is a bad replica of jQuery's constructor function
function nodeArray(input) {
    if (!input) {
        return [];
    }
    if (Array.isArray(input)) {
        return input;
    }
    // instanceof Node - does not work with iframes
    if (input.nodeType !== undefined) {
        return [
            input
        ];
    }
    if (typeof input === 'string') {
        input = document.querySelectorAll(input);
    }
    if (input.length !== undefined) {
        return [].slice.call(input, 0);
    }
    throw new TypeError('unexpected input ' + String(input));
}
function contextToElement(_ref) {
    var context = _ref.context, _ref$label = _ref.label, label = _ref$label === undefined ? 'context-to-element' : _ref$label, resolveDocument = _ref.resolveDocument, defaultToDocument = _ref.defaultToDocument;
    var element = nodeArray(context)[0];
    if (resolveDocument && element && element.nodeType === Node.DOCUMENT_NODE) {
        element = element.documentElement;
    }
    if (!element && defaultToDocument) {
        return document.documentElement;
    }
    if (!element) {
        throw new TypeError(label + ' requires valid options.context');
    }
    if (element.nodeType !== Node.ELEMENT_NODE && element.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
        throw new TypeError(label + ' requires options.context to be an Element');
    }
    return element;
}
function getShadowHost() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context;
    var element = contextToElement({
        label: 'get/shadow-host',
        context: context
    });
    // walk up to the root
    var container = null;
    while(element){
        container = element;
        element = element.parentNode;
    }
    // https://developer.mozilla.org/docs/Web/API/Node.nodeType
    // NOTE: Firefox 34 does not expose ShadowRoot.host (but 37 does)
    if (container.nodeType === container.DOCUMENT_FRAGMENT_NODE && container.host) {
        // the root is attached to a fragment node that has a host
        return container.host;
    }
    return null;
}
function getDocument(node) {
    if (!node) {
        return document;
    }
    if (node.nodeType === Node.DOCUMENT_NODE) {
        return node;
    }
    return node.ownerDocument || document;
}
function isActiveElement(context) {
    var element = contextToElement({
        label: 'is/active-element',
        resolveDocument: true,
        context: context
    });
    var _document = getDocument(element);
    if (_document.activeElement === element) {
        return true;
    }
    var shadowHost = getShadowHost({
        context: element
    });
    if (shadowHost && shadowHost.shadowRoot.activeElement === element) {
        return true;
    }
    return false;
}
// [elem, elem.parent, elem.parent.parent, …, html]
// will not contain the shadowRoot (DOCUMENT_FRAGMENT_NODE) and shadowHost
function getParents() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context;
    var list = [];
    var element = contextToElement({
        label: 'get/parents',
        context: context
    });
    while(element){
        list.push(element);
        // IE does know support parentElement on SVGElement
        element = element.parentNode;
        if (element && element.nodeType !== Node.ELEMENT_NODE) {
            element = null;
        }
    }
    return list;
}
// Element.prototype.matches may be available at a different name
// https://developer.mozilla.org/en/docs/Web/API/Element/matches
var names = [
    'matches',
    'webkitMatchesSelector',
    'mozMatchesSelector',
    'msMatchesSelector'
];
var name = null;
function findMethodName(element) {
    names.some(function(_name) {
        if (!element[_name]) {
            return false;
        }
        name = _name;
        return true;
    });
}
function elementMatches(element, selector) {
    if (!name) {
        findMethodName(element);
    }
    return element[name](selector);
}
// deep clone of original platform
var platform = JSON.parse(JSON.stringify(_platform.default));
// operating system
var os = platform.os.family || '';
var ANDROID = os === 'Android';
var WINDOWS = os.slice(0, 7) === 'Windows';
var OSX = os === 'OS X';
var IOS = os === 'iOS';
// layout
var BLINK = platform.layout === 'Blink';
var GECKO = platform.layout === 'Gecko';
var TRIDENT = platform.layout === 'Trident';
var EDGE = platform.layout === 'EdgeHTML';
var WEBKIT = platform.layout === 'WebKit';
// browser version (not layout engine version!)
var version = parseFloat(platform.version);
var majorVersion = Math.floor(version);
platform.majorVersion = majorVersion;
platform.is = {
    // operating system
    ANDROID: ANDROID,
    WINDOWS: WINDOWS,
    OSX: OSX,
    IOS: IOS,
    // layout
    BLINK: BLINK,
    GECKO: GECKO,
    TRIDENT: TRIDENT,
    EDGE: EDGE,
    WEBKIT: WEBKIT,
    // INTERNET EXPLORERS
    IE9: TRIDENT && majorVersion === 9,
    IE10: TRIDENT && majorVersion === 10,
    IE11: TRIDENT && majorVersion === 11
};
function before() {
    var data = {
        // remember what had focus to restore after test
        activeElement: document.activeElement,
        // remember scroll positions to restore after test
        windowScrollTop: window.scrollTop,
        windowScrollLeft: window.scrollLeft,
        bodyScrollTop: document.body.scrollTop,
        bodyScrollLeft: document.body.scrollLeft
    };
    // wrap tests in an element hidden from screen readers to prevent them
    // from announcing focus, which can be quite irritating to the user
    var iframe = document.createElement('iframe');
    iframe.setAttribute('style', 'position:absolute; position:fixed; top:0; left:-2px; width:1px; height:1px; overflow:hidden;');
    iframe.setAttribute('aria-live', 'off');
    iframe.setAttribute('aria-busy', 'true');
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
    var _window = iframe.contentWindow;
    var _document = _window.document;
    _document.open();
    _document.close();
    var wrapper = _document.createElement('div');
    _document.body.appendChild(wrapper);
    data.iframe = iframe;
    data.wrapper = wrapper;
    data.window = _window;
    data.document = _document;
    return data;
}
// options.element:
//  {string} element name
//  {function} callback(wrapper, document) to generate an element
// options.mutate: (optional)
//  {function} callback(element, wrapper, document) to manipulate element prior to focus-test.
//             Can return DOMElement to define focus target (default: element)
// options.validate: (optional)
//  {function} callback(element, focusTarget, document) to manipulate test-result
function test(data, options) {
    // make sure we operate on a clean slate
    data.wrapper.innerHTML = '';
    // create dummy element to test focusability of
    var element = typeof options.element === 'string' ? data.document.createElement(options.element) : options.element(data.wrapper, data.document);
    // allow callback to further specify dummy element
    // and optionally define element to focus
    var focus = options.mutate && options.mutate(element, data.wrapper, data.document);
    if (!focus && focus !== false) {
        focus = element;
    }
    // element needs to be part of the DOM to be focusable
    !element.parentNode && data.wrapper.appendChild(element);
    // test if the element with invalid tabindex can be focused
    focus && focus.focus && focus.focus();
    // validate test's result
    return options.validate ? options.validate(element, focus, data.document) : data.document.activeElement === focus;
}
function after(data) {
    // restore focus to what it was before test and cleanup
    if (data.activeElement === document.body) {
        document.activeElement && document.activeElement.blur && document.activeElement.blur();
        if (platform.is.IE10) {
            // IE10 does not redirect focus to <body> when the activeElement is removed
            document.body.focus();
        }
    } else {
        data.activeElement && data.activeElement.focus && data.activeElement.focus();
    }
    document.body.removeChild(data.iframe);
    // restore scroll position
    window.scrollTop = data.windowScrollTop;
    window.scrollLeft = data.windowScrollLeft;
    document.body.scrollTop = data.bodyScrollTop;
    document.body.scrollLeft = data.bodyScrollLeft;
}
function detectFocus(tests) {
    var data = before();
    var results = {};
    Object.keys(tests).map(function(key) {
        results[key] = test(data, tests[key]);
    });
    after(data);
    return results;
}
// this file is overwritten by `npm run build:pre`
var version$1 = '1.4.1';
/*
    Facility to cache test results in localStorage.

    USAGE:
      cache.get('key');
      cache.set('key', 'value');
 */ function readLocalStorage(key) {
    // allow reading from storage to retrieve previous support results
    // even while the document does not have focus
    var data = void 0;
    try {
        data = window.localStorage && window.localStorage.getItem(key);
        data = data ? JSON.parse(data) : {};
    } catch (e) {
        data = {};
    }
    return data;
}
function writeLocalStorage(key, value) {
    if (!document.hasFocus()) {
        // if the document does not have focus when tests are executed, focus() may
        // not be handled properly and events may not be dispatched immediately.
        // This can happen when a document is reloaded while Developer Tools have focus.
        try {
            window.localStorage && window.localStorage.removeItem(key);
        } catch (e) {
        // ignore
        }
        return;
    }
    try {
        window.localStorage && window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
    // ignore
    }
}
var userAgent = typeof window !== 'undefined' && window.navigator.userAgent || '';
var cacheKey = 'ally-supports-cache';
var cache = readLocalStorage(cacheKey);
// update the cache if ally or the user agent changed (newer version, etc)
if (cache.userAgent !== userAgent || cache.version !== version$1) {
    cache = {};
}
cache.userAgent = userAgent;
cache.version = version$1;
var cache$1 = {
    get: function get() {
        return cache;
    },
    set: function set(values) {
        Object.keys(values).forEach(function(key) {
            cache[key] = values[key];
        });
        cache.time = new Date().toISOString();
        writeLocalStorage(cacheKey, cache);
    }
};
function cssShadowPiercingDeepCombinator() {
    var combinator = void 0;
    // see https://dev.w3.org/csswg/css-scoping-1/#deep-combinator
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1117572
    // https://code.google.com/p/chromium/issues/detail?id=446051
    try {
        document.querySelector('html >>> :first-child');
        combinator = '>>>';
    } catch (noArrowArrowArrow) {
        try {
            // old syntax supported at least up to Chrome 41
            // https://code.google.com/p/chromium/issues/detail?id=446051
            document.querySelector('html /deep/ :first-child');
            combinator = '/deep/';
        } catch (noDeep) {
            combinator = '';
        }
    }
    return combinator;
}
var gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
// https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap
var focusAreaImgTabindex = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = '<map name="image-map-tabindex-test">' + '<area shape="rect" coords="63,19,144,45"></map>' + '<img usemap="#image-map-tabindex-test" tabindex="-1" alt="" src="' + gif + '">';
        return element.querySelector('area');
    }
};
// https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap
var focusAreaTabindex = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = '<map name="image-map-tabindex-test">' + '<area href="#void" tabindex="-1" shape="rect" coords="63,19,144,45"></map>' + '<img usemap="#image-map-tabindex-test" alt="" src="' + gif + '">';
        return false;
    },
    validate: function validate(element, focusTarget, _document) {
        if (platform.is.GECKO) {
            // fixes https://github.com/medialize/ally.js/issues/35
            // Firefox loads the DataURI asynchronously, causing a false-negative
            return true;
        }
        var focus = element.querySelector('area');
        focus.focus();
        return _document.activeElement === focus;
    }
};
// https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap
var focusAreaWithoutHref = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = '<map name="image-map-area-href-test">' + '<area shape="rect" coords="63,19,144,45"></map>' + '<img usemap="#image-map-area-href-test" alt="" src="' + gif + '">';
        return element.querySelector('area');
    },
    validate: function validate(element, focusTarget, _document) {
        if (platform.is.GECKO) {
            // fixes https://github.com/medialize/ally.js/issues/35
            // Firefox loads the DataURI asynchronously, causing a false-negative
            return true;
        }
        return _document.activeElement === focusTarget;
    }
};
var focusAudioWithoutControls = {
    name: 'can-focus-audio-without-controls',
    element: 'audio',
    mutate: function mutate(element) {
        try {
            // invalid media file can trigger warning in console, data-uri to prevent HTTP request
            element.setAttribute('src', gif);
        } catch (e) {
        // IE9 may throw "Error: Not implemented"
        }
    }
};
var invalidGif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
// NOTE: https://github.com/medialize/ally.js/issues/35
// https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap
var focusBrokenImageMap = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = '<map name="broken-image-map-test"><area href="#void" shape="rect" coords="63,19,144,45"></map>' + '<img usemap="#broken-image-map-test" alt="" src="' + invalidGif + '">';
        return element.querySelector('area');
    }
};
// Children of focusable elements with display:flex are focusable in IE10-11
var focusChildrenOfFocusableFlexbox = {
    element: 'div',
    mutate: function mutate(element) {
        element.setAttribute('tabindex', '-1');
        element.setAttribute('style', 'display: -webkit-flex; display: -ms-flexbox; display: flex;');
        element.innerHTML = '<span style="display: block;">hello</span>';
        return element.querySelector('span');
    }
};
// fieldset[tabindex=0][disabled] should not be focusable, but Blink and WebKit disagree
// @specification https://www.w3.org/TR/html5/disabled-elements.html#concept-element-disabled
// @browser-issue Chromium https://crbug.com/453847
// @browser-issue WebKit https://bugs.webkit.org/show_bug.cgi?id=141086
var focusFieldsetDisabled = {
    element: 'fieldset',
    mutate: function mutate(element) {
        element.setAttribute('tabindex', 0);
        element.setAttribute('disabled', 'disabled');
    }
};
var focusFieldset = {
    element: 'fieldset',
    mutate: function mutate(element) {
        element.innerHTML = '<legend>legend</legend><p>content</p>';
    }
};
// elements with display:flex are focusable in IE10-11
var focusFlexboxContainer = {
    element: 'span',
    mutate: function mutate(element) {
        element.setAttribute('style', 'display: -webkit-flex; display: -ms-flexbox; display: flex;');
        element.innerHTML = '<span style="display: block;">hello</span>';
    }
};
// form[tabindex=0][disabled] should be focusable as the
// specification doesn't know the disabled attribute on the form element
// @specification https://www.w3.org/TR/html5/forms.html#the-form-element
var focusFormDisabled = {
    element: 'form',
    mutate: function mutate(element) {
        element.setAttribute('tabindex', 0);
        element.setAttribute('disabled', 'disabled');
    }
};
// NOTE: https://github.com/medialize/ally.js/issues/35
// fixes https://github.com/medialize/ally.js/issues/20
// https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-ismap
var focusImgIsmap = {
    element: 'a',
    mutate: function mutate(element) {
        element.href = '#void';
        element.innerHTML = '<img ismap src="' + gif + '" alt="">';
        return element.querySelector('img');
    }
};
// NOTE: https://github.com/medialize/ally.js/issues/35
// https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap
var focusImgUsemapTabindex = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = '<map name="image-map-tabindex-test"><area href="#void" shape="rect" coords="63,19,144,45"></map>' + '<img usemap="#image-map-tabindex-test" tabindex="-1" alt="" ' + 'src="' + gif + '">';
        return element.querySelector('img');
    }
};
var focusInHiddenIframe = {
    element: function element(wrapper, _document) {
        var iframe = _document.createElement('iframe');
        // iframe must be part of the DOM before accessing the contentWindow is possible
        wrapper.appendChild(iframe);
        // create the iframe's default document (<html><head></head><body></body></html>)
        var iframeDocument = iframe.contentWindow.document;
        iframeDocument.open();
        iframeDocument.close();
        return iframe;
    },
    mutate: function mutate(iframe) {
        iframe.style.visibility = 'hidden';
        var iframeDocument = iframe.contentWindow.document;
        var input = iframeDocument.createElement('input');
        iframeDocument.body.appendChild(input);
        return input;
    },
    validate: function validate(iframe) {
        var iframeDocument = iframe.contentWindow.document;
        var focus = iframeDocument.querySelector('input');
        return iframeDocument.activeElement === focus;
    }
};
var result = !platform.is.WEBKIT;
function focusInZeroDimensionObject() {
    return result;
}
// Firefox allows *any* value and treats invalid values like tabindex="-1"
// @browser-issue Gecko https://bugzilla.mozilla.org/show_bug.cgi?id=1128054
var focusInvalidTabindex = {
    element: 'div',
    mutate: function mutate(element) {
        element.setAttribute('tabindex', 'invalid-value');
    }
};
var focusLabelTabindex = {
    element: 'label',
    mutate: function mutate(element) {
        element.setAttribute('tabindex', '-1');
    },
    validate: function validate(element, focusTarget, _document) {
        // force layout in Chrome 49, otherwise the element won't be focusable
        /* eslint-disable no-unused-vars */ var variableToPreventDeadCodeElimination = element.offsetHeight;
        /* eslint-enable no-unused-vars */ element.focus();
        return _document.activeElement === element;
    }
};
var svg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtb' + 'G5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBpZD0ic3ZnIj48dGV4dCB4PSIxMCIgeT0iMjAiIGlkPSJ' + 'zdmctbGluay10ZXh0Ij50ZXh0PC90ZXh0Pjwvc3ZnPg==';
// Note: IE10 on BrowserStack does not like this test
var focusObjectSvgHidden = {
    element: 'object',
    mutate: function mutate(element) {
        element.setAttribute('type', 'image/svg+xml');
        element.setAttribute('data', svg);
        element.setAttribute('width', '200');
        element.setAttribute('height', '50');
        element.style.visibility = 'hidden';
    }
};
// Note: IE10 on BrowserStack does not like this test
var focusObjectSvg = {
    name: 'can-focus-object-svg',
    element: 'object',
    mutate: function mutate(element) {
        element.setAttribute('type', 'image/svg+xml');
        element.setAttribute('data', svg);
        element.setAttribute('width', '200');
        element.setAttribute('height', '50');
    },
    validate: function validate(element, focusTarget, _document) {
        if (platform.is.GECKO) {
            // Firefox seems to be handling the object creation asynchronously and thereby produces a false negative test result.
            // Because we know Firefox is able to focus object elements referencing SVGs, we simply cheat by sniffing the user agent string
            return true;
        }
        return _document.activeElement === element;
    }
};
// Every Environment except IE9 considers SWF objects focusable
var result$1 = !platform.is.IE9;
function focusObjectSwf() {
    return result$1;
}
var focusRedirectImgUsemap = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = '<map name="focus-redirect-img-usemap"><area href="#void" shape="rect" coords="63,19,144,45"></map>' + '<img usemap="#focus-redirect-img-usemap" alt="" ' + 'src="' + gif + '">';
        // focus the <img>, not the <div>
        return element.querySelector('img');
    },
    validate: function validate(element, focusTarget, _document) {
        var target = element.querySelector('area');
        return _document.activeElement === target;
    }
};
// see https://jsbin.com/nenirisage/edit?html,js,console,output
var focusRedirectLegend = {
    element: 'fieldset',
    mutate: function mutate(element) {
        element.innerHTML = '<legend>legend</legend><input tabindex="-1"><input tabindex="0">';
        // take care of focus in validate();
        return false;
    },
    validate: function validate(element, focusTarget, _document) {
        var focusable = element.querySelector('input[tabindex="-1"]');
        var tabbable = element.querySelector('input[tabindex="0"]');
        // Firefox requires this test to focus the <fieldset> first, while this is not necessary in
        // https://jsbin.com/nenirisage/edit?html,js,console,output
        element.focus();
        element.querySelector('legend').focus();
        return _document.activeElement === focusable && 'focusable' || _document.activeElement === tabbable && 'tabbable' || '';
    }
};
// https://github.com/medialize/ally.js/issues/21
var focusScrollBody = {
    element: 'div',
    mutate: function mutate(element) {
        element.setAttribute('style', 'width: 100px; height: 50px; overflow: auto;');
        element.innerHTML = '<div style="width: 500px; height: 40px;">scrollable content</div>';
        return element.querySelector('div');
    }
};
// https://github.com/medialize/ally.js/issues/21
var focusScrollContainerWithoutOverflow = {
    element: 'div',
    mutate: function mutate(element) {
        element.setAttribute('style', 'width: 100px; height: 50px;');
        element.innerHTML = '<div style="width: 500px; height: 40px;">scrollable content</div>';
    }
};
// https://github.com/medialize/ally.js/issues/21
var focusScrollContainer = {
    element: 'div',
    mutate: function mutate(element) {
        element.setAttribute('style', 'width: 100px; height: 50px; overflow: auto;');
        element.innerHTML = '<div style="width: 500px; height: 40px;">scrollable content</div>';
    }
};
var focusSummary = {
    element: 'details',
    mutate: function mutate(element) {
        element.innerHTML = '<summary>foo</summary><p>content</p>';
        return element.firstElementChild;
    }
};
function makeFocusableForeignObject() {
    // Constructs <foreignObject width="30" height="30"><input type="text"/></foreignObject>
    // without raising a Trusted Types violation
    var foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.width.baseVal.value = 30;
    foreignObject.height.baseVal.value = 30;
    foreignObject.appendChild(document.createElement('input'));
    foreignObject.lastChild.type = 'text';
    return foreignObject;
}
function focusSvgForeignObjectHack(element) {
    // Edge13, Edge14: foreignObject focus hack
    // https://jsbin.com/kunehinugi/edit?html,js,output
    // https://jsbin.com/fajagi/3/edit?html,js,output
    var isSvgElement = element.ownerSVGElement || element.nodeName.toLowerCase() === 'svg';
    if (!isSvgElement) {
        return false;
    }
    // inject and focus an <input> element into the SVG element to receive focus
    var foreignObject = makeFocusableForeignObject();
    element.appendChild(foreignObject);
    var input = foreignObject.querySelector('input');
    input.focus();
    // upon disabling the activeElement, IE and Edge
    // will not shift focus to <body> like all the other
    // browsers, but instead find the first focusable
    // ancestor and shift focus to that
    input.disabled = true;
    // clean up
    element.removeChild(foreignObject);
    return true;
}
function generate(element) {
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' + element + '</svg>';
}
function focus(element) {
    if (element.focus) {
        return;
    }
    try {
        HTMLElement.prototype.focus.call(element);
    } catch (e) {
        focusSvgForeignObjectHack(element);
    }
}
function validate(element, focusTarget, _document) {
    focus(focusTarget);
    return _document.activeElement === focusTarget;
}
var focusSvgFocusableAttribute = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = generate('<text focusable="true">a</text>');
        return element.querySelector('text');
    },
    validate: validate
};
var focusSvgTabindexAttribute = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = generate('<text tabindex="0">a</text>');
        return element.querySelector('text');
    },
    validate: validate
};
var focusSvgNegativeTabindexAttribute = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = generate('<text tabindex="-1">a</text>');
        return element.querySelector('text');
    },
    validate: validate
};
var focusSvgUseTabindex = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = generate([
            '<g id="ally-test-target"><a xlink:href="#void"><text>link</text></a></g>',
            '<use xlink:href="#ally-test-target" x="0" y="0" tabindex="-1" />'
        ].join(''));
        return element.querySelector('use');
    },
    validate: validate
};
var focusSvgForeignobjectTabindex = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = generate('<foreignObject tabindex="-1"><input type="text" /></foreignObject>');
        // Safari 8's querySelector() can't identify foreignObject, but getElementsByTagName() can
        return element.querySelector('foreignObject') || element.getElementsByTagName('foreignObject')[0];
    },
    validate: validate
};
// Firefox seems to be handling the SVG-document-in-iframe creation asynchronously
// and thereby produces a false negative test result. Thus the test is pointless
// and we resort to UA sniffing once again.
// see http://jsbin.com/vunadohoko/1/edit?js,console,output
var result$2 = Boolean(platform.is.GECKO && typeof SVGElement !== 'undefined' && SVGElement.prototype.focus);
function focusSvgInIframe() {
    return result$2;
}
var focusSvg = {
    element: 'div',
    mutate: function mutate(element) {
        element.innerHTML = generate('');
        return element.firstChild;
    },
    validate: validate
};
// Firefox allows *any* value and treats invalid values like tabindex="-1"
// @browser-issue Gecko https://bugzilla.mozilla.org/show_bug.cgi?id=1128054
var focusTabindexTrailingCharacters = {
    element: 'div',
    mutate: function mutate(element) {
        element.setAttribute('tabindex', '3x');
    }
};
var focusTable = {
    element: 'table',
    mutate: function mutate(element, wrapper, _document) {
        // IE9 has a problem replacing TBODY contents with innerHTML.
        // https://stackoverflow.com/a/8097055/515124
        // element.innerHTML = '<tr><td>cell</td></tr>';
        var fragment = _document.createDocumentFragment();
        fragment.innerHTML = '<tr><td>cell</td></tr>';
        element.appendChild(fragment);
    }
};
var focusVideoWithoutControls = {
    element: 'video',
    mutate: function mutate(element) {
        try {
            // invalid media file can trigger warning in console, data-uri to prevent HTTP request
            element.setAttribute('src', gif);
        } catch (e) {
        // IE9 may throw "Error: Not implemented"
        }
    }
};
// https://jsbin.com/vafaba/3/edit?html,js,console,output
var result$3 = platform.is.GECKO || platform.is.TRIDENT || platform.is.EDGE;
function tabsequenceAreaAtImgPosition() {
    return result$3;
}
var testCallbacks = {
    cssShadowPiercingDeepCombinator: cssShadowPiercingDeepCombinator,
    focusInZeroDimensionObject: focusInZeroDimensionObject,
    focusObjectSwf: focusObjectSwf,
    focusSvgInIframe: focusSvgInIframe,
    tabsequenceAreaAtImgPosition: tabsequenceAreaAtImgPosition
};
var testDescriptions = {
    focusAreaImgTabindex: focusAreaImgTabindex,
    focusAreaTabindex: focusAreaTabindex,
    focusAreaWithoutHref: focusAreaWithoutHref,
    focusAudioWithoutControls: focusAudioWithoutControls,
    focusBrokenImageMap: focusBrokenImageMap,
    focusChildrenOfFocusableFlexbox: focusChildrenOfFocusableFlexbox,
    focusFieldsetDisabled: focusFieldsetDisabled,
    focusFieldset: focusFieldset,
    focusFlexboxContainer: focusFlexboxContainer,
    focusFormDisabled: focusFormDisabled,
    focusImgIsmap: focusImgIsmap,
    focusImgUsemapTabindex: focusImgUsemapTabindex,
    focusInHiddenIframe: focusInHiddenIframe,
    focusInvalidTabindex: focusInvalidTabindex,
    focusLabelTabindex: focusLabelTabindex,
    focusObjectSvg: focusObjectSvg,
    focusObjectSvgHidden: focusObjectSvgHidden,
    focusRedirectImgUsemap: focusRedirectImgUsemap,
    focusRedirectLegend: focusRedirectLegend,
    focusScrollBody: focusScrollBody,
    focusScrollContainerWithoutOverflow: focusScrollContainerWithoutOverflow,
    focusScrollContainer: focusScrollContainer,
    focusSummary: focusSummary,
    focusSvgFocusableAttribute: focusSvgFocusableAttribute,
    focusSvgTabindexAttribute: focusSvgTabindexAttribute,
    focusSvgNegativeTabindexAttribute: focusSvgNegativeTabindexAttribute,
    focusSvgUseTabindex: focusSvgUseTabindex,
    focusSvgForeignobjectTabindex: focusSvgForeignobjectTabindex,
    focusSvg: focusSvg,
    focusTabindexTrailingCharacters: focusTabindexTrailingCharacters,
    focusTable: focusTable,
    focusVideoWithoutControls: focusVideoWithoutControls
};
function executeTests() {
    var results = detectFocus(testDescriptions);
    Object.keys(testCallbacks).forEach(function(key) {
        results[key] = testCallbacks[key]();
    });
    return results;
}
var supportsCache = null;
function _supports() {
    if (supportsCache) {
        return supportsCache;
    }
    supportsCache = cache$1.get();
    if (!supportsCache.time) {
        cache$1.set(executeTests());
        supportsCache = cache$1.get();
    }
    return supportsCache;
}
var supports = void 0;
// https://www.w3.org/TR/html5/infrastructure.html#rules-for-parsing-integers
// NOTE: all browsers agree to allow trailing spaces as well
var validIntegerPatternNoTrailing = /^\s*(-|\+)?[0-9]+\s*$/;
var validIntegerPatternWithTrailing = /^\s*(-|\+)?[0-9]+.*$/;
function isValidTabindex(context) {
    if (!supports) {
        supports = _supports();
    }
    var validIntegerPattern = supports.focusTabindexTrailingCharacters ? validIntegerPatternWithTrailing : validIntegerPatternNoTrailing;
    var element = contextToElement({
        label: 'is/valid-tabindex',
        resolveDocument: true,
        context: context
    });
    // Edge 14 has a capitalization problem on SVG elements,
    // see https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/9282058/
    var hasTabindex = element.hasAttribute('tabindex');
    var hasTabIndex = element.hasAttribute('tabIndex');
    if (!hasTabindex && !hasTabIndex) {
        return false;
    }
    // older Firefox and Internet Explorer don't support tabindex on SVG elements
    var isSvgElement = element.ownerSVGElement || element.nodeName.toLowerCase() === 'svg';
    if (isSvgElement && !supports.focusSvgTabindexAttribute) {
        return false;
    }
    // @browser-issue Gecko https://bugzilla.mozilla.org/show_bug.cgi?id=1128054
    if (supports.focusInvalidTabindex) {
        return true;
    }
    // an element matches the tabindex selector even if its value is invalid
    var tabindex = element.getAttribute(hasTabindex ? 'tabindex' : 'tabIndex');
    // IE11 parses tabindex="" as the value "-32768"
    // @browser-issue Trident https://connect.microsoft.com/IE/feedback/details/1072965
    if (tabindex === '-32768') {
        return false;
    }
    return Boolean(tabindex && validIntegerPattern.test(tabindex));
}
function tabindexValue(element) {
    if (!isValidTabindex(element)) {
        return null;
    }
    // Edge 14 has a capitalization problem on SVG elements,
    // see https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/9282058/
    var hasTabindex = element.hasAttribute('tabindex');
    var attributeName = hasTabindex ? 'tabindex' : 'tabIndex';
    // @browser-issue Gecko https://bugzilla.mozilla.org/show_bug.cgi?id=1128054
    var tabindex = parseInt(element.getAttribute(attributeName), 10);
    return isNaN(tabindex) ? -1 : tabindex;
}
// this is a shared utility file for focus-relevant.js and tabbable.js
// separate testing of this file's functions is not necessary,
// as they're implicitly tested by way of the consumers
function isUserModifyWritable(style) {
    // https://www.w3.org/TR/1999/WD-css3-userint-19990916#user-modify
    // https://github.com/medialize/ally.js/issues/17
    var userModify = style.webkitUserModify || '';
    return Boolean(userModify && userModify.indexOf('write') !== -1);
}
function hasCssOverflowScroll(style) {
    return [
        style.getPropertyValue('overflow'),
        style.getPropertyValue('overflow-x'),
        style.getPropertyValue('overflow-y')
    ].some(function(overflow) {
        return overflow === 'auto' || overflow === 'scroll';
    });
}
function hasCssDisplayFlex(style) {
    return style.display.indexOf('flex') > -1;
}
function isScrollableContainer(element, nodeName, parentNodeName, parentStyle) {
    if (nodeName !== 'div' && nodeName !== 'span') {
        // Internet Explorer advances scrollable containers and bodies to focusable
        // only if the scrollable container is <div> or <span> - this does *not*
        // happen for <section>, <article>, …
        return false;
    }
    if (parentNodeName && parentNodeName !== 'div' && parentNodeName !== 'span' && !hasCssOverflowScroll(parentStyle)) {
        return false;
    }
    return element.offsetHeight < element.scrollHeight || element.offsetWidth < element.scrollWidth;
}
var supports$1 = void 0;
function isFocusRelevantRules() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, _ref$except = _ref.except, except = _ref$except === undefined ? {
        flexbox: false,
        scrollable: false,
        shadow: false
    } : _ref$except;
    if (!supports$1) {
        supports$1 = _supports();
    }
    var element = contextToElement({
        label: 'is/focus-relevant',
        resolveDocument: true,
        context: context
    });
    if (!except.shadow && element.shadowRoot) {
        // a ShadowDOM host receives focus when the focus moves to its content
        return true;
    }
    var nodeName = element.nodeName.toLowerCase();
    if (nodeName === 'input' && element.type === 'hidden') {
        // input[type="hidden"] supports.cannot be focused
        return false;
    }
    if (nodeName === 'input' || nodeName === 'select' || nodeName === 'button' || nodeName === 'textarea') {
        return true;
    }
    if (nodeName === 'legend' && supports$1.focusRedirectLegend) {
        // specifics filtered in is/focusable
        return true;
    }
    if (nodeName === 'label') {
        // specifics filtered in is/focusable
        return true;
    }
    if (nodeName === 'area') {
        // specifics filtered in is/focusable
        return true;
    }
    if (nodeName === 'a' && element.hasAttribute('href')) {
        return true;
    }
    if (nodeName === 'object' && element.hasAttribute('usemap')) {
        // object[usemap] is not focusable in any browser
        return false;
    }
    if (nodeName === 'object') {
        var svgType = element.getAttribute('type');
        if (!supports$1.focusObjectSvg && svgType === 'image/svg+xml') {
            // object[type="image/svg+xml"] is not focusable in Internet Explorer
            return false;
        } else if (!supports$1.focusObjectSwf && svgType === 'application/x-shockwave-flash') {
            // object[type="application/x-shockwave-flash"] is not focusable in Internet Explorer 9
            return false;
        }
    }
    if (nodeName === 'iframe' || nodeName === 'object') {
        // browsing context containers
        return true;
    }
    if (nodeName === 'embed' || nodeName === 'keygen') {
        // embed is considered focus-relevant but not focusable
        // see https://github.com/medialize/ally.js/issues/82
        return true;
    }
    if (element.hasAttribute('contenteditable')) {
        // also see CSS property user-modify below
        return true;
    }
    if (nodeName === 'audio' && (supports$1.focusAudioWithoutControls || element.hasAttribute('controls'))) {
        return true;
    }
    if (nodeName === 'video' && (supports$1.focusVideoWithoutControls || element.hasAttribute('controls'))) {
        return true;
    }
    if (supports$1.focusSummary && nodeName === 'summary') {
        return true;
    }
    var validTabindex = isValidTabindex(element);
    if (nodeName === 'img' && element.hasAttribute('usemap')) {
        // Gecko, Trident and Edge do not allow an image with an image map and tabindex to be focused,
        // it appears the tabindex is overruled so focus is still forwarded to the <map>
        return validTabindex && supports$1.focusImgUsemapTabindex || supports$1.focusRedirectImgUsemap;
    }
    if (supports$1.focusTable && (nodeName === 'table' || nodeName === 'td')) {
        // IE10-11 supports.can focus <table> and <td>
        return true;
    }
    if (supports$1.focusFieldset && nodeName === 'fieldset') {
        // IE10-11 supports.can focus <fieldset>
        return true;
    }
    var isSvgElement = nodeName === 'svg';
    var isSvgContent = element.ownerSVGElement;
    var focusableAttribute = element.getAttribute('focusable');
    var tabindex = tabindexValue(element);
    if (nodeName === 'use' && tabindex !== null && !supports$1.focusSvgUseTabindex) {
        // <use> cannot be made focusable by adding a tabindex attribute anywhere but Blink and WebKit
        return false;
    }
    if (nodeName === 'foreignobject') {
        // <use> can only be made focusable in Blink and WebKit
        return tabindex !== null && supports$1.focusSvgForeignobjectTabindex;
    }
    if (elementMatches(element, 'svg a') && element.hasAttribute('xlink:href')) {
        return true;
    }
    if ((isSvgElement || isSvgContent) && element.focus && !supports$1.focusSvgNegativeTabindexAttribute && tabindex < 0) {
        // Firefox 51 and 52 treat any natively tabbable SVG element with
        // tabindex="-1" as tabbable and everything else as inert
        // see https://bugzilla.mozilla.org/show_bug.cgi?id=1302340
        return false;
    }
    if (isSvgElement) {
        return validTabindex || supports$1.focusSvg || supports$1.focusSvgInIframe || // Internet Explorer understands the focusable attribute introduced in SVG Tiny 1.2
        Boolean(supports$1.focusSvgFocusableAttribute && focusableAttribute && focusableAttribute === 'true');
    }
    if (isSvgContent) {
        if (supports$1.focusSvgTabindexAttribute && validTabindex) {
            return true;
        }
        if (supports$1.focusSvgFocusableAttribute) {
            // Internet Explorer understands the focusable attribute introduced in SVG Tiny 1.2
            return focusableAttribute === 'true';
        }
    }
    // https://www.w3.org/TR/html5/editing.html#sequential-focus-navigation-and-the-tabindex-attribute
    if (validTabindex) {
        return true;
    }
    var style = window.getComputedStyle(element, null);
    if (isUserModifyWritable(style)) {
        return true;
    }
    if (supports$1.focusImgIsmap && nodeName === 'img' && element.hasAttribute('ismap')) {
        // IE10-11 considers the <img> in <a href><img ismap> focusable
        // https://github.com/medialize/ally.js/issues/20
        var hasLinkParent = getParents({
            context: element
        }).some(function(parent) {
            return parent.nodeName.toLowerCase() === 'a' && parent.hasAttribute('href');
        });
        if (hasLinkParent) {
            return true;
        }
    }
    // https://github.com/medialize/ally.js/issues/21
    if (!except.scrollable && supports$1.focusScrollContainer) {
        if (supports$1.focusScrollContainerWithoutOverflow) {
            // Internet Explorer does will consider the scrollable area focusable
            // if the element is a <div> or a <span> and it is in fact scrollable,
            // regardless of the CSS overflow property
            if (isScrollableContainer(element, nodeName)) {
                return true;
            }
        } else if (hasCssOverflowScroll(style)) {
            // Firefox requires proper overflow setting, IE does not necessarily
            // https://developer.mozilla.org/docs/Web/CSS/overflow
            return true;
        }
    }
    if (!except.flexbox && supports$1.focusFlexboxContainer && hasCssDisplayFlex(style)) {
        // elements with display:flex are focusable in IE10-11
        return true;
    }
    var parent = element.parentElement;
    if (!except.scrollable && parent) {
        var parentNodeName = parent.nodeName.toLowerCase();
        var parentStyle = window.getComputedStyle(parent, null);
        if (supports$1.focusScrollBody && isScrollableContainer(parent, nodeName, parentNodeName, parentStyle)) {
            // scrollable bodies are focusable Internet Explorer
            // https://github.com/medialize/ally.js/issues/21
            return true;
        }
        // Children of focusable elements with display:flex are focusable in IE10-11
        if (supports$1.focusChildrenOfFocusableFlexbox) {
            if (hasCssDisplayFlex(parentStyle)) {
                return true;
            }
        }
    }
    // NOTE: elements marked as inert are not focusable,
    // but that property is not exposed to the DOM
    // https://www.w3.org/TR/html5/editing.html#inert
    return false;
}
// bind exceptions to an iterator callback
isFocusRelevantRules.except = function() {
    var except = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var isFocusRelevant = function isFocusRelevant(context) {
        return isFocusRelevantRules({
            context: context,
            except: except
        });
    };
    isFocusRelevant.rules = isFocusRelevantRules;
    return isFocusRelevant;
};
// provide isFocusRelevant(context) as default iterator callback
var isFocusRelevant = isFocusRelevantRules.except({});
function findIndex(array, callback) {
    // attempt to use native or polyfilled Array#findIndex first
    if (array.findIndex) {
        return array.findIndex(callback);
    }
    var length = array.length;
    // shortcut if the array is empty
    if (length === 0) {
        return -1;
    }
    // otherwise loop over array
    for(var i = 0; i < length; i++){
        if (callback(array[i], i, array)) {
            return i;
        }
    }
    return -1;
}
function getContentDocument(node) {
    try {
        // works on <object> and <iframe>
        return node.contentDocument || // works on <object> and <iframe>
        node.contentWindow && node.contentWindow.document || // works on <object> and <iframe> that contain SVG
        node.getSVGDocument && node.getSVGDocument() || null;
    } catch (e) {
        // SecurityError: Failed to read the 'contentDocument' property from 'HTMLObjectElement'
        // also IE may throw member not found exception e.g. on <object type="image/png">
        return null;
    }
}
function getWindow(node) {
    var _document = getDocument(node);
    return _document.defaultView || window;
}
var shadowPrefix = void 0;
function selectInShadows(selector) {
    if (typeof shadowPrefix !== 'string') {
        var operator = cssShadowPiercingDeepCombinator();
        if (operator) {
            shadowPrefix = ', html ' + operator + ' ';
        }
    }
    if (!shadowPrefix) {
        return selector;
    }
    return selector + shadowPrefix + selector.replace(/\s*,\s*/g, ',').split(',').join(shadowPrefix);
}
var selector = void 0;
function findDocumentHostElement(_window) {
    if (!selector) {
        selector = selectInShadows('object, iframe');
    }
    if (_window._frameElement !== undefined) {
        return _window._frameElement;
    }
    _window._frameElement = null;
    var potentialHosts = _window.parent.document.querySelectorAll(selector);
    [].some.call(potentialHosts, function(element) {
        var _document = getContentDocument(element);
        if (_document !== _window.document) {
            return false;
        }
        _window._frameElement = element;
        return true;
    });
    return _window._frameElement;
}
function getFrameElement(element) {
    var _window = getWindow(element);
    if (!_window.parent || _window.parent === _window) {
        // if there is no parent browsing context,
        // we're not going to get a frameElement either way
        return null;
    }
    try {
        // see https://developer.mozilla.org/docs/Web/API/Window/frameElement
        // does not work within <embed> anywhere, and not within in <object> in IE
        return _window.frameElement || findDocumentHostElement(_window);
    } catch (e) {
        return null;
    }
}
// https://www.w3.org/TR/html5/rendering.html#being-rendered
// <area> is not rendered, but we *consider* it visible to simplfiy this function's usage
var notRenderedElementsPattern = /^(area)$/;
function computedStyle(element, property) {
    return window.getComputedStyle(element, null).getPropertyValue(property);
}
function notDisplayed(_path) {
    return _path.some(function(element) {
        // display:none is not visible (optimized away at layout)
        return computedStyle(element, 'display') === 'none';
    });
}
function notVisible(_path) {
    // https://github.com/jquery/jquery-ui/blob/master/ui/core.js#L109-L114
    // NOTE: a nested element can reverse visibility:hidden|collapse by explicitly setting visibility:visible
    // NOTE: visibility can be ["", "visible", "hidden", "collapse"]
    var hidden = findIndex(_path, function(element) {
        var visibility = computedStyle(element, 'visibility');
        return visibility === 'hidden' || visibility === 'collapse';
    });
    if (hidden === -1) {
        // there is no hidden element
        return false;
    }
    var visible = findIndex(_path, function(element) {
        return computedStyle(element, 'visibility') === 'visible';
    });
    if (visible === -1) {
        // there is no visible element (but a hidden element)
        return true;
    }
    if (hidden < visible) {
        // there is a hidden element and it's closer than the first visible element
        return true;
    }
    // there may be a hidden element, but the closest element is visible
    return false;
}
function collapsedParent(_path) {
    var offset = 1;
    if (_path[0].nodeName.toLowerCase() === 'summary') {
        offset = 2;
    }
    return _path.slice(offset).some(function(element) {
        // "content children" of a closed details element are not visible
        return element.nodeName.toLowerCase() === 'details' && element.open === false;
    });
}
function isVisibleRules() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, _ref$except = _ref.except, except = _ref$except === undefined ? {
        notRendered: false,
        cssDisplay: false,
        cssVisibility: false,
        detailsElement: false,
        browsingContext: false
    } : _ref$except;
    var element = contextToElement({
        label: 'is/visible',
        resolveDocument: true,
        context: context
    });
    var nodeName = element.nodeName.toLowerCase();
    if (!except.notRendered && notRenderedElementsPattern.test(nodeName)) {
        return true;
    }
    var _path = getParents({
        context: element
    });
    // in Internet Explorer <audio> has a default display: none, where others have display: inline
    // but IE allows focusing <audio style="display:none">, but not <div display:none><audio>
    // this is irrelevant to other browsers, as the controls attribute is required to make <audio> focusable
    var isAudioWithoutControls = nodeName === 'audio' && !element.hasAttribute('controls');
    if (!except.cssDisplay && notDisplayed(isAudioWithoutControls ? _path.slice(1) : _path)) {
        return false;
    }
    if (!except.cssVisibility && notVisible(_path)) {
        return false;
    }
    if (!except.detailsElement && collapsedParent(_path)) {
        return false;
    }
    if (!except.browsingContext) {
        // elements within a browsing context are affected by the
        // browsing context host element's visibility and tabindex
        var frameElement = getFrameElement(element);
        var _isVisible = isVisibleRules.except(except);
        if (frameElement && !_isVisible(frameElement)) {
            return false;
        }
    }
    return true;
}
// bind exceptions to an iterator callback
isVisibleRules.except = function() {
    var except = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var isVisible = function isVisible(context) {
        return isVisibleRules({
            context: context,
            except: except
        });
    };
    isVisible.rules = isVisibleRules;
    return isVisible;
};
// provide isVisible(context) as default iterator callback
var isVisible = isVisibleRules.except({});
function getMapByName(name, _document) {
    // apparently getElementsByName() also considers id attribute in IE & opera
    // https://developer.mozilla.org/docs/Web/API/Document/getElementsByName
    var map = _document.querySelector('map[name="' + (0, _cssescape.default)(name) + '"]');
    return map || null;
}
function getImageOfArea(element) {
    var map = element.parentElement;
    if (!map.name || map.nodeName.toLowerCase() !== 'map') {
        return null;
    }
    // NOTE: image maps can also be applied to <object> with image content,
    // but no browser supports this at the moment
    // HTML5 specifies HTMLMapElement.images to be an HTMLCollection of all
    // <img> and <object> referencing the <map> element, but no browser implements this
    //   https://www.w3.org/TR/html5/embedded-content-0.html#the-map-element
    //   https://developer.mozilla.org/docs/Web/API/HTMLMapElement
    // the image must be valid and loaded for the map to take effect
    var _document = getDocument(element);
    return _document.querySelector('img[usemap="#' + (0, _cssescape.default)(map.name) + '"]') || null;
}
var supports$2 = void 0;
// https://developer.mozilla.org/docs/Web/HTML/Element/map
// https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap
// https://github.com/jquery/jquery-ui/blob/master/ui/core.js#L88-L107
function isValidArea(context) {
    if (!supports$2) {
        supports$2 = _supports();
    }
    var element = contextToElement({
        label: 'is/valid-area',
        context: context
    });
    var nodeName = element.nodeName.toLowerCase();
    if (nodeName !== 'area') {
        return false;
    }
    var hasTabindex = element.hasAttribute('tabindex');
    if (!supports$2.focusAreaTabindex && hasTabindex) {
        // Blink and WebKit do not consider <area tabindex="-1" href="#void"> focusable
        return false;
    }
    var img = getImageOfArea(element);
    if (!img || !isVisible(img)) {
        return false;
    }
    // Firefox only allows fully loaded images to reference image maps
    // https://stereochro.me/ideas/detecting-broken-images-js
    if (!supports$2.focusBrokenImageMap && (!img.complete || !img.naturalHeight || img.offsetWidth <= 0 || img.offsetHeight <= 0)) {
        return false;
    }
    // Firefox supports.can focus area elements even if they don't have an href attribute
    if (!supports$2.focusAreaWithoutHref && !element.href) {
        // Internet explorer supports.can focus area elements without href if either
        // the area element or the image element has a tabindex attribute
        return supports$2.focusAreaTabindex && hasTabindex || supports$2.focusAreaImgTabindex && img.hasAttribute('tabindex');
    }
    // https://developer.mozilla.org/docs/Web/HTML/Element/img#attr-usemap
    var childOfInteractive = getParents({
        context: img
    }).slice(1).some(function(_element) {
        var name = _element.nodeName.toLowerCase();
        return name === 'button' || name === 'a';
    });
    if (childOfInteractive) {
        return false;
    }
    return true;
}
var supports$3 = void 0;
// https://www.w3.org/TR/html5/disabled-elements.html#concept-element-disabled
var disabledElementsPattern = void 0;
var disabledElements = {
    input: true,
    select: true,
    textarea: true,
    button: true,
    fieldset: true,
    form: true
};
function isNativeDisabledSupported(context) {
    if (!supports$3) {
        supports$3 = _supports();
        if (supports$3.focusFieldsetDisabled) {
            delete disabledElements.fieldset;
        }
        if (supports$3.focusFormDisabled) {
            delete disabledElements.form;
        }
        disabledElementsPattern = new RegExp('^(' + Object.keys(disabledElements).join('|') + ')$');
    }
    var element = contextToElement({
        label: 'is/native-disabled-supported',
        context: context
    });
    var nodeName = element.nodeName.toLowerCase();
    return Boolean(disabledElementsPattern.test(nodeName));
}
var supports$4 = void 0;
function isDisabledFieldset(element) {
    var nodeName = element.nodeName.toLowerCase();
    return nodeName === 'fieldset' && element.disabled;
}
function isDisabledForm(element) {
    var nodeName = element.nodeName.toLowerCase();
    return nodeName === 'form' && element.disabled;
}
function isDisabled(context) {
    if (!supports$4) {
        supports$4 = _supports();
    }
    var element = contextToElement({
        label: 'is/disabled',
        context: context
    });
    if (element.hasAttribute('data-ally-disabled')) {
        // treat ally's element/disabled like the DOM native element.disabled
        return true;
    }
    if (!isNativeDisabledSupported(element)) {
        // non-form elements do not support the disabled attribute
        return false;
    }
    if (element.disabled) {
        // the element itself is disabled
        return true;
    }
    var parents = getParents({
        context: element
    });
    if (parents.some(isDisabledFieldset)) {
        // a parental <fieldset> is disabld and inherits the state onto this element
        return true;
    }
    if (!supports$4.focusFormDisabled && parents.some(isDisabledForm)) {
        // a parental <form> is disabld and inherits the state onto this element
        return true;
    }
    return false;
}
function isOnlyTabbableRules() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, _ref$except = _ref.except, except = _ref$except === undefined ? {
        onlyFocusableBrowsingContext: false,
        visible: false
    } : _ref$except;
    var element = contextToElement({
        label: 'is/only-tabbable',
        resolveDocument: true,
        context: context
    });
    if (!except.visible && !isVisible(element)) {
        return false;
    }
    if (!except.onlyFocusableBrowsingContext && (platform.is.GECKO || platform.is.TRIDENT || platform.is.EDGE)) {
        var frameElement = getFrameElement(element);
        if (frameElement) {
            if (tabindexValue(frameElement) < 0) {
                // iframe[tabindex="-1"] and object[tabindex="-1"] inherit the
                // tabbable demotion onto elements of their browsing contexts
                return false;
            }
        }
    }
    var nodeName = element.nodeName.toLowerCase();
    var tabindex = tabindexValue(element);
    if (nodeName === 'label' && platform.is.GECKO) {
        // Firefox cannot focus, but tab to: label[tabindex=0]
        return tabindex !== null && tabindex >= 0;
    }
    // SVG Elements were keyboard focusable but not script focusable before Firefox 51.
    // Firefox 51 added the focus management DOM API (.focus and .blur) to SVGElement,
    // see https://bugzilla.mozilla.org/show_bug.cgi?id=778654
    if (platform.is.GECKO && element.ownerSVGElement && !element.focus) {
        if (nodeName === 'a' && element.hasAttribute('xlink:href')) {
            // any focusable child of <svg> cannot be focused, but tabbed to
            if (platform.is.GECKO) {
                return true;
            }
        }
    }
    return false;
}
// bind exceptions to an iterator callback
isOnlyTabbableRules.except = function() {
    var except = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var isOnlyTabbable = function isOnlyTabbable(context) {
        return isOnlyTabbableRules({
            context: context,
            except: except
        });
    };
    isOnlyTabbable.rules = isOnlyTabbableRules;
    return isOnlyTabbable;
};
// provide isOnlyTabbable(context) as default iterator callback
var isOnlyTabbable = isOnlyTabbableRules.except({});
var supports$5 = void 0;
function isOnlyFocusRelevant(element) {
    var nodeName = element.nodeName.toLowerCase();
    if (nodeName === 'embed' || nodeName === 'keygen') {
        // embed is considered focus-relevant but not focusable
        // see https://github.com/medialize/ally.js/issues/82
        return true;
    }
    var _tabindex = tabindexValue(element);
    if (element.shadowRoot && _tabindex === null) {
        // ShadowDOM host elements *may* receive focus
        // even though they are not considered focuable
        return true;
    }
    if (nodeName === 'label') {
        // <label tabindex="0"> is only tabbable in Firefox, not script-focusable
        // there's no way to make an element focusable other than by adding a tabindex,
        // and focus behavior of the label element seems hard-wired to ignore tabindex
        // in some browsers (like Gecko, Blink and WebKit)
        return !supports$5.focusLabelTabindex || _tabindex === null;
    }
    if (nodeName === 'legend') {
        return _tabindex === null;
    }
    if (supports$5.focusSvgFocusableAttribute && (element.ownerSVGElement || nodeName === 'svg')) {
        // Internet Explorer understands the focusable attribute introduced in SVG Tiny 1.2
        var focusableAttribute = element.getAttribute('focusable');
        return focusableAttribute && focusableAttribute === 'false';
    }
    if (nodeName === 'img' && element.hasAttribute('usemap')) {
        // Gecko, Trident and Edge do not allow an image with an image map and tabindex to be focused,
        // it appears the tabindex is overruled so focus is still forwarded to the <map>
        return _tabindex === null || !supports$5.focusImgUsemapTabindex;
    }
    if (nodeName === 'area') {
        // all <area>s are considered relevant,
        // but only the valid <area>s are focusable
        return !isValidArea(element);
    }
    return false;
}
function isFocusableRules() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, _ref$except = _ref.except, except = _ref$except === undefined ? {
        disabled: false,
        visible: false,
        onlyTabbable: false
    } : _ref$except;
    if (!supports$5) {
        supports$5 = _supports();
    }
    var _isOnlyTabbable = isOnlyTabbable.rules.except({
        onlyFocusableBrowsingContext: true,
        visible: except.visible
    });
    var element = contextToElement({
        label: 'is/focusable',
        resolveDocument: true,
        context: context
    });
    var focusRelevant = isFocusRelevant.rules({
        context: element,
        except: except
    });
    if (!focusRelevant || isOnlyFocusRelevant(element)) {
        return false;
    }
    if (!except.disabled && isDisabled(element)) {
        return false;
    }
    if (!except.onlyTabbable && _isOnlyTabbable(element)) {
        // some elements may be keyboard focusable, but not script focusable
        return false;
    }
    // elements that are not rendered, cannot be focused
    if (!except.visible) {
        var visibilityOptions = {
            context: element,
            except: {}
        };
        if (supports$5.focusInHiddenIframe) {
            // WebKit and Blink can focus content in hidden <iframe> and <object>
            visibilityOptions.except.browsingContext = true;
        }
        if (supports$5.focusObjectSvgHidden) {
            // Blink allows focusing the object element, even if it has visibility: hidden;
            // @browser-issue Blink https://code.google.com/p/chromium/issues/detail?id=586191
            var _nodeName2 = element.nodeName.toLowerCase();
            if (_nodeName2 === 'object') {
                visibilityOptions.except.cssVisibility = true;
            }
        }
        if (!isVisible.rules(visibilityOptions)) {
            return false;
        }
    }
    var frameElement = getFrameElement(element);
    if (frameElement) {
        var _nodeName = frameElement.nodeName.toLowerCase();
        if (_nodeName === 'object' && !supports$5.focusInZeroDimensionObject) {
            if (!frameElement.offsetWidth || !frameElement.offsetHeight) {
                // WebKit can not focus content in <object> if it doesn't have dimensions
                return false;
            }
        }
    }
    var nodeName = element.nodeName.toLowerCase();
    if (nodeName === 'svg' && supports$5.focusSvgInIframe && !frameElement && element.getAttribute('tabindex') === null) {
        return false;
    }
    return true;
}
// bind exceptions to an iterator callback
isFocusableRules.except = function() {
    var except = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var isFocusable = function isFocusable(context) {
        return isFocusableRules({
            context: context,
            except: except
        });
    };
    isFocusable.rules = isFocusableRules;
    return isFocusable;
};
// provide isFocusRelevant(context) as default iterator callback
var isFocusable = isFocusableRules.except({});
function createFilter(condition) {
    // see https://developer.mozilla.org/docs/Web/API/NodeFilter
    var filter = function filter(node) {
        if (node.shadowRoot) {
            // return ShadowRoot elements regardless of them being focusable,
            // so they can be walked recursively later
            return NodeFilter.FILTER_ACCEPT;
        }
        if (condition(node)) {
            // finds elements that could have been found by document.querySelectorAll()
            return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
    };
    // IE requires a function, Browsers require {acceptNode: function}
    // see http://www.bennadel.com/blog/2607-finding-html-comment-nodes-in-the-dom-using-treewalker.htm
    filter.acceptNode = filter;
    return filter;
}
var PossiblyFocusableFilter = createFilter(isFocusRelevant);
function queryFocusableStrict() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, includeContext = _ref.includeContext, includeOnlyTabbable = _ref.includeOnlyTabbable, strategy = _ref.strategy;
    if (!context) {
        context = document.documentElement;
    }
    var _isFocusable = isFocusable.rules.except({
        onlyTabbable: includeOnlyTabbable
    });
    var _document = getDocument(context);
    // see https://developer.mozilla.org/docs/Web/API/Document/createTreeWalker
    var walker = _document.createTreeWalker(context, NodeFilter.SHOW_ELEMENT, strategy === 'all' ? PossiblyFocusableFilter : createFilter(_isFocusable), false);
    var list = [];
    while(walker.nextNode()){
        if (walker.currentNode.shadowRoot) {
            if (_isFocusable(walker.currentNode)) {
                list.push(walker.currentNode);
            }
            list = list.concat(queryFocusableStrict({
                context: walker.currentNode.shadowRoot,
                includeOnlyTabbable: includeOnlyTabbable,
                strategy: strategy
            }));
        } else {
            list.push(walker.currentNode);
        }
    }
    // add context if requested and focusable
    if (includeContext) {
        if (strategy === 'all') {
            if (isFocusRelevant(context)) {
                list.unshift(context);
            }
        } else if (_isFocusable(context)) {
            list.unshift(context);
        }
    }
    return list;
}
// NOTE: this selector MUST *never* be used directly,
var supports$6 = void 0;
var selector$1 = void 0;
function selector$2() {
    if (!supports$6) {
        supports$6 = _supports();
    }
    if (typeof selector$1 === 'string') {
        return selector$1;
    }
    // https://www.w3.org/TR/html5/editing.html#sequential-focus-navigation-and-the-tabindex-attribute
    selector$1 = '' + // IE11 supports.can focus <table> and <td>
    (supports$6.focusTable ? 'table, td,' : '') + // IE11 supports.can focus <fieldset>
    (supports$6.focusFieldset ? 'fieldset,' : '') + // Namespace problems of [xlink:href] explained in https://stackoverflow.com/a/23047888/515124
    // svg a[*|href] does not match in IE9, but since we're filtering
    // through is/focusable we can include all <a> from SVG
    'svg a,' + // may behave as 'svg, svg *,' in chrome as *every* svg element with a focus event listener is focusable
    // navigational elements
    'a[href],' + // validity determined by is/valid-area.js
    'area[href],' + // validity determined by is/disabled.js
    'input, select, textarea, button,' + // browsing context containers
    'iframe, object, embed,' + // interactive content
    'keygen,' + (supports$6.focusAudioWithoutControls ? 'audio,' : 'audio[controls],') + (supports$6.focusVideoWithoutControls ? 'video,' : 'video[controls],') + (supports$6.focusSummary ? 'summary,' : '') + // validity determined by is/valid-tabindex.js
    '[tabindex],' + // editing hosts
    '[contenteditable]';
    // where ShadowDOM is supported, we also want the shadowed focusable elements (via ">>>" or "/deep/")
    selector$1 = selectInShadows(selector$1);
    return selector$1;
}
function queryFocusableQuick() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, includeContext = _ref.includeContext, includeOnlyTabbable = _ref.includeOnlyTabbable;
    var _selector = selector$2();
    var elements = context.querySelectorAll(_selector);
    // the selector potentially matches more than really is focusable
    var _isFocusable = isFocusable.rules.except({
        onlyTabbable: includeOnlyTabbable
    });
    var result = [].filter.call(elements, _isFocusable);
    // add context if requested and focusable
    if (includeContext && _isFocusable(context)) {
        result.unshift(context);
    }
    return result;
}
function queryFocusable() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, includeContext = _ref.includeContext, includeOnlyTabbable = _ref.includeOnlyTabbable, _ref$strategy = _ref.strategy, strategy = _ref$strategy === undefined ? 'quick' : _ref$strategy;
    var element = contextToElement({
        label: 'query/focusable',
        resolveDocument: true,
        defaultToDocument: true,
        context: context
    });
    var options = {
        context: element,
        includeContext: includeContext,
        includeOnlyTabbable: includeOnlyTabbable,
        strategy: strategy
    };
    if (strategy === 'quick') {
        return queryFocusableQuick(options);
    } else if (strategy === 'strict' || strategy === 'all') {
        return queryFocusableStrict(options);
    }
    throw new TypeError('query/focusable requires option.strategy to be one of ["quick", "strict", "all"]');
}
var supports$7 = void 0;
// Internet Explorer 11 considers fieldset, table, td focusable, but not tabbable
// Internet Explorer 11 considers body to have [tabindex=0], but does not allow tabbing to it
var focusableElementsPattern = /^(fieldset|table|td|body)$/;
function isTabbableRules() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, _ref$except = _ref.except, except = _ref$except === undefined ? {
        flexbox: false,
        scrollable: false,
        shadow: false,
        visible: false,
        onlyTabbable: false
    } : _ref$except;
    if (!supports$7) {
        supports$7 = _supports();
    }
    var element = contextToElement({
        label: 'is/tabbable',
        resolveDocument: true,
        context: context
    });
    if (platform.is.BLINK && platform.is.ANDROID && platform.majorVersion > 42) {
        // External keyboard support worked fine in CHrome 42, but stopped working in Chrome 45.
        // The on-screen keyboard does not provide a way to focus the next input element (like iOS does).
        // That leaves us with no option to advance focus by keyboard, ergo nothing is tabbable (keyboard focusable).
        return false;
    }
    var frameElement = getFrameElement(element);
    if (frameElement) {
        if (platform.is.WEBKIT && platform.is.IOS) {
            // iOS only does not consider anything from another browsing context keyboard focusable
            return false;
        }
        // iframe[tabindex="-1"] and object[tabindex="-1"] inherit the
        // tabbable demotion onto elements of their browsing contexts
        if (tabindexValue(frameElement) < 0) {
            return false;
        }
        if (!except.visible && (platform.is.BLINK || platform.is.WEBKIT) && !isVisible(frameElement)) {
            // Blink and WebKit consider elements in hidden browsing contexts focusable, but not tabbable
            return false;
        }
        // Webkit and Blink don't consider anything in <object> tabbable
        // Blink fixed that fixed in Chrome 54, Opera 41
        var frameNodeName = frameElement.nodeName.toLowerCase();
        if (frameNodeName === 'object') {
            var isFixedBlink = platform.name === 'Chrome' && platform.majorVersion >= 54 || platform.name === 'Opera' && platform.majorVersion >= 41;
            if (platform.is.WEBKIT || platform.is.BLINK && !isFixedBlink) {
                return false;
            }
        }
    }
    var nodeName = element.nodeName.toLowerCase();
    var _tabindex = tabindexValue(element);
    var tabindex = _tabindex === null ? null : _tabindex >= 0;
    if (platform.is.EDGE && platform.majorVersion >= 14 && frameElement && element.ownerSVGElement && _tabindex < 0) {
        // Edge 14+ considers <a xlink:href="…" tabindex="-1"> keyboard focusable
        // if the element is in a nested browsing context
        return true;
    }
    var hasTabbableTabindexOrNone = tabindex !== false;
    var hasTabbableTabindex = _tabindex !== null && _tabindex >= 0;
    // NOTE: Firefox 31 considers [contenteditable] to have [tabindex=-1], but allows tabbing to it
    // fixed in Firefox 40 the latest - https://bugzilla.mozilla.org/show_bug.cgi?id=1185657
    if (element.hasAttribute('contenteditable')) {
        // tabbing can still be disabled by explicitly providing [tabindex="-1"]
        return hasTabbableTabindexOrNone;
    }
    if (focusableElementsPattern.test(nodeName) && tabindex !== true) {
        return false;
    }
    if (platform.is.WEBKIT && platform.is.IOS) {
        // iOS only considers a hand full of elements tabbable (keyboard focusable)
        // this holds true even with external keyboards
        var potentiallyTabbable = nodeName === 'input' && element.type === 'text' || element.type === 'password' || nodeName === 'select' || nodeName === 'textarea' || element.hasAttribute('contenteditable');
        if (!potentiallyTabbable) {
            var style = window.getComputedStyle(element, null);
            potentiallyTabbable = isUserModifyWritable(style);
        }
        if (!potentiallyTabbable) {
            return false;
        }
    }
    if (nodeName === 'use' && _tabindex !== null) {
        if (platform.is.BLINK || platform.is.WEBKIT && platform.majorVersion === 9) {
            // In Chrome and Safari 9 the <use> element is keyboard focusable even for tabindex="-1"
            return true;
        }
    }
    if (elementMatches(element, 'svg a') && element.hasAttribute('xlink:href')) {
        if (hasTabbableTabindexOrNone) {
            // in Trident and Gecko SVGElement does not handle the tabIndex property properly
            return true;
        }
        if (element.focus && !supports$7.focusSvgNegativeTabindexAttribute) {
            // Firefox 51 and 52 treat any natively tabbable SVG element with
            // tabindex="-1" as tabbable and everything else as inert
            // see https://bugzilla.mozilla.org/show_bug.cgi?id=1302340
            return true;
        }
    }
    if (nodeName === 'svg' && supports$7.focusSvgInIframe && hasTabbableTabindexOrNone) {
        return true;
    }
    if (platform.is.TRIDENT || platform.is.EDGE) {
        if (nodeName === 'svg') {
            if (supports$7.focusSvg) {
                // older Internet Explorers consider <svg> keyboard focusable
                // unless they have focsable="false", but then they wouldn't
                // be focusable and thus not even reach this filter
                return true;
            }
            // elements that have [focusable] are automatically keyboard focusable regardless of the attribute's value
            return element.hasAttribute('focusable') || hasTabbableTabindex;
        }
        if (element.ownerSVGElement) {
            if (supports$7.focusSvgTabindexAttribute && hasTabbableTabindex) {
                return true;
            }
            // elements that have [focusable] are automatically keyboard focusable regardless of the attribute's value
            return element.hasAttribute('focusable');
        }
    }
    if (element.tabIndex === undefined) {
        return Boolean(except.onlyTabbable);
    }
    if (nodeName === 'audio') {
        if (!element.hasAttribute('controls')) {
            // In Internet Explorer the <audio> element is focusable, but not tabbable, and tabIndex property is wrong
            return false;
        } else if (platform.is.BLINK) {
            // In Chrome <audio controls tabindex="-1"> remains keyboard focusable
            return true;
        }
    }
    if (nodeName === 'video') {
        if (!element.hasAttribute('controls')) {
            if (platform.is.TRIDENT || platform.is.EDGE) {
                // In Internet Explorer and Edge the <video> element is focusable, but not tabbable, and tabIndex property is wrong
                return false;
            }
        } else if (platform.is.BLINK || platform.is.GECKO) {
            // In Chrome and Firefox <video controls tabindex="-1"> remains keyboard focusable
            return true;
        }
    }
    if (nodeName === 'object') {
        if (platform.is.BLINK || platform.is.WEBKIT) {
            // In all Blink and WebKit based browsers <embed> and <object> are never keyboard focusable, even with tabindex="0" set
            return false;
        }
    }
    if (nodeName === 'iframe') {
        // In Internet Explorer all iframes are only focusable
        // In WebKit, Blink and Gecko iframes may be tabbable depending on content.
        // Since we can't reliably investigate iframe documents because of the
        // SameOriginPolicy, we're declaring everything only focusable.
        return false;
    }
    if (!except.scrollable && platform.is.GECKO) {
        // Firefox considers scrollable containers keyboard focusable,
        // even though their tabIndex property is -1
        var _style = window.getComputedStyle(element, null);
        if (hasCssOverflowScroll(_style)) {
            return hasTabbableTabindexOrNone;
        }
    }
    if (platform.is.TRIDENT || platform.is.EDGE) {
        // IE and Edge degrade <area> to script focusable, if the image
        // using the <map> has been given tabindex="-1"
        if (nodeName === 'area') {
            var img = getImageOfArea(element);
            if (img && tabindexValue(img) < 0) {
                return false;
            }
        }
        var _style2 = window.getComputedStyle(element, null);
        if (isUserModifyWritable(_style2)) {
            // prevent being swallowed by the overzealous isScrollableContainer() below
            return element.tabIndex >= 0;
        }
        if (!except.flexbox && hasCssDisplayFlex(_style2)) {
            if (_tabindex !== null) {
                return hasTabbableTabindex;
            }
            return isFocusRelevantWithoutFlexbox(element) && isTabbableWithoutFlexbox(element);
        }
        // IE considers scrollable containers script focusable only,
        // even though their tabIndex property is 0
        if (isScrollableContainer(element, nodeName)) {
            return false;
        }
        var parent = element.parentElement;
        if (parent) {
            var parentNodeName = parent.nodeName.toLowerCase();
            var parentStyle = window.getComputedStyle(parent, null);
            // IE considers scrollable bodies script focusable only,
            if (isScrollableContainer(parent, nodeName, parentNodeName, parentStyle)) {
                return false;
            }
            // Children of focusable elements with display:flex are focusable in IE10-11,
            // even though their tabIndex property suggests otherwise
            if (hasCssDisplayFlex(parentStyle)) {
                // value of tabindex takes precedence
                return hasTabbableTabindex;
            }
        }
    }
    // https://www.w3.org/WAI/PF/aria-practices/#focus_tabindex
    return element.tabIndex >= 0;
}
// bind exceptions to an iterator callback
isTabbableRules.except = function() {
    var except = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var isTabbable = function isTabbable(context) {
        return isTabbableRules({
            context: context,
            except: except
        });
    };
    isTabbable.rules = isTabbableRules;
    return isTabbable;
};
var isFocusRelevantWithoutFlexbox = isFocusRelevant.rules.except({
    flexbox: true
});
var isTabbableWithoutFlexbox = isTabbableRules.except({
    flexbox: true
});
// provide isTabbable(context) as default iterator callback
var isTabbable = isTabbableRules.except({});
function queryTabbable() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, includeContext = _ref.includeContext, includeOnlyTabbable = _ref.includeOnlyTabbable, strategy = _ref.strategy;
    var _isTabbable = isTabbable.rules.except({
        onlyTabbable: includeOnlyTabbable
    });
    return queryFocusable({
        context: context,
        includeContext: includeContext,
        includeOnlyTabbable: includeOnlyTabbable,
        strategy: strategy
    }).filter(_isTabbable);
}
// sorts a list of elements according to their order in the DOM
function compareDomPosition(a, b) {
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
function sortDomOrder(elements) {
    return elements.sort(compareDomPosition);
}
function getFirstSuccessorOffset(list, target) {
    // find the first element that comes AFTER the target element
    return findIndex(list, function(element) {
        return target.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
}
function findInsertionOffsets(list, elements, resolveElement) {
    // instead of mutating the elements list directly, remember position and map
    // to inject later, when we can do this more efficiently
    var insertions = [];
    elements.forEach(function(element) {
        var replace = true;
        var offset = list.indexOf(element);
        if (offset === -1) {
            // element is not in target list
            offset = getFirstSuccessorOffset(list, element);
            replace = false;
        }
        if (offset === -1) {
            // there is no successor in the tabsequence,
            // meaning the image must be the last element
            offset = list.length;
        }
        // allow the consumer to replace the injected element
        var injections = nodeArray(resolveElement ? resolveElement(element) : element);
        if (!injections.length) {
            // we can't inject zero elements
            return;
        }
        insertions.push({
            offset: offset,
            replace: replace,
            elements: injections
        });
    });
    return insertions;
}
function insertElementsAtOffsets(list, insertions) {
    // remember the number of elements we have already injected
    // so we account for the caused index offset
    var inserted = 0;
    // make sure that we insert the elements in sequence,
    // otherwise the offset compensation won't work
    insertions.sort(function(a, b) {
        return a.offset - b.offset;
    });
    insertions.forEach(function(insertion) {
        // array.splice has an annoying function signature :(
        var remove = insertion.replace ? 1 : 0;
        var args = [
            insertion.offset + inserted,
            remove
        ].concat(insertion.elements);
        list.splice.apply(list, args);
        inserted += insertion.elements.length - remove;
    });
}
function mergeInDomOrder() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, list = _ref.list, elements = _ref.elements, resolveElement = _ref.resolveElement;
    // operate on a copy so we don't mutate the original array
    var _list = list.slice(0);
    // make sure the elements we're injecting are provided in DOM order
    var _elements = nodeArray(elements).slice(0);
    sortDomOrder(_elements);
    // find the offsets within the target array (list) at which to inject
    // each individual element (from elements)
    var insertions = findInsertionOffsets(_list, _elements, resolveElement);
    // actually inject the elements into the target array at the identified positions
    insertElementsAtOffsets(_list, insertions);
    return _list;
}
var _createClass = function() {
    function defineProperties(target, props) {
        for(var i = 0; i < props.length; i++){
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ('value' in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
        }
    }
    return function(Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);
        if (staticProps) defineProperties(Constructor, staticProps);
        return Constructor;
    };
}();
function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError('Cannot call a class as a function');
    }
}
var Maps = function() {
    function Maps(context) {
        _classCallCheck(this, Maps);
        this._document = getDocument(context);
        this.maps = {};
    }
    _createClass(Maps, [
        {
            key: 'getAreasFor',
            value: function getAreasFor(name) {
                if (!this.maps[name]) {
                    // the map is not defined within the context, so we
                    // have to go find it elsewhere in the document
                    this.addMapByName(name);
                }
                return this.maps[name];
            }
        },
        {
            key: 'addMapByName',
            value: function addMapByName(name) {
                var map = getMapByName(name, this._document);
                if (!map) {
                    // if there is no map, the img[usemap] wasn't doing anything anyway
                    return;
                }
                this.maps[map.name] = queryTabbable({
                    context: map
                });
            }
        },
        {
            key: 'extractAreasFromList',
            value: function extractAreasFromList(elements) {
                // remove all <area> elements from the elements list,
                // but put them the map for later retrieval
                return elements.filter(function(element) {
                    var nodeName = element.nodeName.toLowerCase();
                    if (nodeName !== 'area') {
                        return true;
                    }
                    var map = element.parentNode;
                    if (!this.maps[map.name]) {
                        this.maps[map.name] = [];
                    }
                    this.maps[map.name].push(element);
                    return false;
                }, this);
            }
        }
    ]);
    return Maps;
}();
function sortArea(elements, context) {
    // images - unless they are focusable themselves, likely not
    // part of the elements list, so we'll have to find them and
    // sort them into the elements list manually
    var usemaps = context.querySelectorAll('img[usemap]');
    var maps = new Maps(context);
    // remove all <area> elements from the elements list,
    // but put them the map for later retrieval
    var _elements = maps.extractAreasFromList(elements);
    if (!usemaps.length) {
        // the context does not contain any <area>s so no need
        // to replace anything, just remove any maps
        return _elements;
    }
    return mergeInDomOrder({
        list: _elements,
        elements: usemaps,
        resolveElement: function resolveElement(image) {
            var name = image.getAttribute('usemap').slice(1);
            return maps.getAreasFor(name);
        }
    });
}
var _createClass$1 = function() {
    function defineProperties(target, props) {
        for(var i = 0; i < props.length; i++){
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ('value' in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
        }
    }
    return function(Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);
        if (staticProps) defineProperties(Constructor, staticProps);
        return Constructor;
    };
}();
function _classCallCheck$1(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError('Cannot call a class as a function');
    }
}
var Shadows = function() {
    function Shadows(context, sortElements) {
        _classCallCheck$1(this, Shadows);
        // document context we're working with
        this.context = context;
        // callback that sorts an array of elements
        this.sortElements = sortElements;
        // reference to create unique IDs for each ShadowHost
        this.hostCounter = 1;
        // reference map for child-ShadowHosts of a ShadowHost
        this.inHost = {};
        // reference map for child-ShadowHost of the document
        this.inDocument = [];
        // reference map for ShadowHosts
        this.hosts = {};
        // reference map for tabbable elements of a ShadowHost
        this.elements = {};
    }
    // remember which hosts we have to sort within later
    _createClass$1(Shadows, [
        {
            key: '_registerHost',
            value: function _registerHost(host) {
                if (host._sortingId) {
                    return;
                }
                // make the ShadowHost identifiable (see cleanup() for undo)
                host._sortingId = 'shadow-' + this.hostCounter++;
                this.hosts[host._sortingId] = host;
                // hosts may contain other hosts
                var parentHost = getShadowHost({
                    context: host
                });
                if (parentHost) {
                    this._registerHost(parentHost);
                    this._registerHostParent(host, parentHost);
                } else {
                    this.inDocument.push(host);
                }
            }
        },
        {
            key: '_registerHostParent',
            value: function _registerHostParent(host, parent) {
                if (!this.inHost[parent._sortingId]) {
                    this.inHost[parent._sortingId] = [];
                }
                this.inHost[parent._sortingId].push(host);
            }
        },
        {
            key: '_registerElement',
            value: function _registerElement(element, host) {
                if (!this.elements[host._sortingId]) {
                    this.elements[host._sortingId] = [];
                }
                this.elements[host._sortingId].push(element);
            }
        },
        {
            key: 'extractElements',
            value: function extractElements(elements) {
                return elements.filter(function(element) {
                    var host = getShadowHost({
                        context: element
                    });
                    if (!host) {
                        return true;
                    }
                    this._registerHost(host);
                    this._registerElement(element, host);
                    return false;
                }, this);
            }
        },
        {
            key: 'sort',
            value: function sort(elements) {
                var _elements = this._injectHosts(elements);
                _elements = this._replaceHosts(_elements);
                this._cleanup();
                return _elements;
            }
        },
        {
            key: '_injectHosts',
            value: function _injectHosts(elements) {
                Object.keys(this.hosts).forEach(function(_sortingId) {
                    var _list = this.elements[_sortingId];
                    var _elements = this.inHost[_sortingId];
                    var _context = this.hosts[_sortingId].shadowRoot;
                    this.elements[_sortingId] = this._merge(_list, _elements, _context);
                }, this);
                return this._merge(elements, this.inDocument, this.context);
            }
        },
        {
            key: '_merge',
            value: function _merge(list, elements, context) {
                var merged = mergeInDomOrder({
                    list: list,
                    elements: elements
                });
                return this.sortElements(merged, context);
            }
        },
        {
            key: '_replaceHosts',
            value: function _replaceHosts(elements) {
                return mergeInDomOrder({
                    list: elements,
                    elements: this.inDocument,
                    resolveElement: this._resolveHostElement.bind(this)
                });
            }
        },
        {
            key: '_resolveHostElement',
            value: function _resolveHostElement(host) {
                var merged = mergeInDomOrder({
                    list: this.elements[host._sortingId],
                    elements: this.inHost[host._sortingId],
                    resolveElement: this._resolveHostElement.bind(this)
                });
                var _tabindex = tabindexValue(host);
                if (_tabindex !== null && _tabindex > -1) {
                    return [
                        host
                    ].concat(merged);
                }
                return merged;
            }
        },
        {
            key: '_cleanup',
            value: function _cleanup() {
                // remove those identifers we put on the ShadowHost to avoid using Map()
                Object.keys(this.hosts).forEach(function(key) {
                    delete this.hosts[key]._sortingId;
                }, this);
            }
        }
    ]);
    return Shadows;
}();
function sortShadowed(elements, context, sortElements) {
    var shadows = new Shadows(context, sortElements);
    var _elements = shadows.extractElements(elements);
    if (_elements.length === elements.length) {
        // no shadowed content found, no need to continue
        return sortElements(elements);
    }
    return shadows.sort(_elements);
}
function sortTabindex(elements) {
    // https://developer.mozilla.org/docs/Web/API/HTMLElement.tabIndex
    // elements with tabIndex "0" (including tabbableElements without tabIndex) should be navigated in the order they appear.
    // elements with a positive tabIndex:
    //   Elements that have identical tabIndexes should be navigated in the order they appear.
    //   Navigation proceeds from the lowest tabIndex to the highest tabIndex.
    // NOTE: sort implementation may be unstable and thus mess up DOM order,
    // that's why we build a map that's being sorted instead. If we were able to rely
    // on a stable sorting algorithm, sortTabindex() could be as simple as
    // elements.sort(function(a, b) { return a.tabIndex - b.tabIndex; });
    // at this time Chrome does not use a stable sorting algorithm
    // see http://blog.rodneyrehm.de/archives/14-Sorting-Were-Doing-It-Wrong.html#stability
    // NOTE: compareDocumentPosition seemed like more overhead than just sorting this with buckets
    // https://developer.mozilla.org/docs/Web/API/Node.compareDocumentPosition
    var map = {};
    var indexes = [];
    var normal = elements.filter(function(element) {
        // in Trident and Gecko SVGElement does not know about the tabIndex property
        var tabIndex = element.tabIndex;
        if (tabIndex === undefined) {
            tabIndex = tabindexValue(element);
        }
        // extract elements that don't need sorting
        if (tabIndex <= 0 || tabIndex === null || tabIndex === undefined) {
            return true;
        }
        if (!map[tabIndex]) {
            // create sortable bucket for dom-order-preservation of elements with the same tabIndex
            map[tabIndex] = [];
            // maintain a list of unique tabIndexes
            indexes.push(tabIndex);
        }
        // sort element into the proper bucket
        map[tabIndex].push(element);
        // element moved to sorting map, so not "normal" anymore
        return false;
    });
    // sort the tabindex ascending,
    // then resolve them to their appropriate buckets,
    // then flatten the array of arrays to an array
    var _elements = indexes.sort().map(function(tabIndex) {
        return map[tabIndex];
    }).reduceRight(function(previous, current) {
        return current.concat(previous);
    }, normal);
    return _elements;
}
var supports$8 = void 0;
function moveContextToBeginning(elements, context) {
    var pos = elements.indexOf(context);
    if (pos > 0) {
        var tmp = elements.splice(pos, 1);
        return tmp.concat(elements);
    }
    return elements;
}
function sortElements(elements, _context) {
    if (supports$8.tabsequenceAreaAtImgPosition) {
        // Some browsers sort <area> in DOM order, some place the <area>s
        // where the <img> referecing them would've been in DOM order.
        // https://github.com/medialize/ally.js/issues/5
        elements = sortArea(elements, _context);
    }
    elements = sortTabindex(elements);
    return elements;
}
function queryTabsequence() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, context = _ref.context, includeContext = _ref.includeContext, includeOnlyTabbable = _ref.includeOnlyTabbable, strategy = _ref.strategy;
    if (!supports$8) {
        supports$8 = _supports();
    }
    var _context = nodeArray(context)[0] || document.documentElement;
    var elements = queryTabbable({
        context: _context,
        includeContext: includeContext,
        includeOnlyTabbable: includeOnlyTabbable,
        strategy: strategy
    });
    if (document.body.createShadowRoot && platform.is.BLINK) {
        // sort tabindex localized to shadow dom
        // see https://github.com/medialize/ally.js/issues/6
        elements = sortShadowed(elements, _context, sortElements);
    } else {
        elements = sortElements(elements, _context);
    }
    if (includeContext) {
        // if we include the context itself, it has to be the first
        // element of the sequence
        elements = moveContextToBeginning(elements, _context);
    }
    return elements;
}
// codes mostly cloned from https://github.com/keithamus/jwerty/blob/master/jwerty.js
// deliberately not exposing characters like <,.-#* because they vary *wildly*
// across keyboard layouts and may cause various problems
// (e.g. "*" is "Shift +" on a German Mac keyboard)
// (e.g. "@" is "Alt L" on a German Mac keyboard)
var keycode = {
    // Element Focus
    tab: 9,
    // Navigation
    left: 37,
    up: 38,
    right: 39,
    down: 40,
    pageUp: 33,
    'page-up': 33,
    pageDown: 34,
    'page-down': 34,
    end: 35,
    home: 36,
    // Action
    enter: 13,
    escape: 27,
    space: 32,
    // Modifier
    shift: 16,
    capsLock: 20,
    'caps-lock': 20,
    ctrl: 17,
    alt: 18,
    meta: 91,
    // in firefox: 224
    // on mac (chrome): meta-left=91, meta-right=93
    // on win (IE11): meta-left=91, meta-right=92
    pause: 19,
    // Content Manipulation
    insert: 45,
    delete: 46,
    backspace: 8,
    // the same logical key may be identified through different keyCodes
    _alias: {
        91: [
            92,
            93,
            224
        ]
    }
};
// Function keys (112 - 137)
// NOTE: not every keyboard knows F13+
for(var n = 1; n < 26; n++){
    keycode['f' + n] = n + 111;
}
// Number keys (48-57, numpad 96-105)
// NOTE: not every keyboard knows num-0+
for(var _n = 0; _n < 10; _n++){
    var code = _n + 48;
    var numCode = _n + 96;
    keycode[_n] = code;
    keycode['num-' + _n] = numCode;
    keycode._alias[code] = [
        numCode
    ];
}
// Latin characters (65 - 90)
for(var _n2 = 0; _n2 < 26; _n2++){
    var _code = _n2 + 65;
    var name$1 = String.fromCharCode(_code).toLowerCase();
    keycode[name$1] = _code;
}
var modifier = {
    alt: 'altKey',
    ctrl: 'ctrlKey',
    meta: 'metaKey',
    shift: 'shiftKey'
};
var modifierSequence = Object.keys(modifier).map(function(name) {
    return modifier[name];
});
function createExpectedModifiers(ignoreModifiers) {
    var value = ignoreModifiers ? null : false;
    return {
        altKey: value,
        ctrlKey: value,
        metaKey: value,
        shiftKey: value
    };
}
function resolveModifiers(modifiers) {
    var ignoreModifiers = modifiers.indexOf('*') !== -1;
    var expected = createExpectedModifiers(ignoreModifiers);
    modifiers.forEach(function(token) {
        if (token === '*') {
            // we've already covered the all-in operator
            return;
        }
        // we want the modifier pressed
        var value = true;
        var operator = token.slice(0, 1);
        if (operator === '?') {
            // we don't care if the modifier is pressed
            value = null;
        } else if (operator === '!') {
            // we do not want the modifier pressed
            value = false;
        }
        if (value !== true) {
            // compensate for the modifier's operator
            token = token.slice(1);
        }
        var propertyName = modifier[token];
        if (!propertyName) {
            throw new TypeError('Unknown modifier "' + token + '"');
        }
        expected[propertyName] = value;
    });
    return expected;
}
function resolveKey(key) {
    var code = keycode[key] || parseInt(key, 10);
    if (!code || typeof code !== 'number' || isNaN(code)) {
        throw new TypeError('Unknown key "' + key + '"');
    }
    return [
        code
    ].concat(keycode._alias[code] || []);
}
function matchModifiers(expected, event) {
    // returns true on match
    return !modifierSequence.some(function(prop) {
        // returns true on mismatch
        return typeof expected[prop] === 'boolean' && Boolean(event[prop]) !== expected[prop];
    });
}
function keyBinding(text) {
    return text.split(/\s+/).map(function(_text) {
        var tokens = _text.split('+');
        var _modifiers = resolveModifiers(tokens.slice(0, -1));
        var _keyCodes = resolveKey(tokens.slice(-1));
        return {
            keyCodes: _keyCodes,
            modifiers: _modifiers,
            matchModifiers: matchModifiers.bind(null, _modifiers)
        };
    });
}
// Node.compareDocumentPosition is available since IE9
// see https://developer.mozilla.org/docs/Web/API/Node.compareDocumentPosition
// callback returns true when element is contained by parent or is the parent suited for use with Array.some()
/*
  USAGE:
    var isChildOf = getParentComparator({parent: someNode});
    listOfElements.some(isChildOf)
*/ function getParentComparator() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {}, parent = _ref.parent, element = _ref.element, includeSelf = _ref.includeSelf;
    if (parent) {
        return function isChildOf(node) {
            return Boolean(includeSelf && node === parent || parent.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY);
        };
    } else if (element) {
        return function isParentOf(node) {
            return Boolean(includeSelf && element === node || node.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_CONTAINED_BY);
        };
    }
    throw new TypeError('util/compare-position#getParentComparator required either options.parent or options.element');
}
// Bug 286933 - Key events in the autocomplete popup should be hidden from page scripts
// @browser-issue Gecko https://bugzilla.mozilla.org/show_bug.cgi?id=286933
function whenKey() {
    var map = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var bindings = {};
    var context = nodeArray(map.context)[0] || document.documentElement;
    delete map.context;
    var filter = nodeArray(map.filter);
    delete map.filter;
    var mapKeys = Object.keys(map);
    if (!mapKeys.length) {
        throw new TypeError('when/key requires at least one option key');
    }
    var registerBinding = function registerBinding(event) {
        event.keyCodes.forEach(function(code) {
            if (!bindings[code]) {
                bindings[code] = [];
            }
            bindings[code].push(event);
        });
    };
    mapKeys.forEach(function(text) {
        if (typeof map[text] !== 'function') {
            throw new TypeError('when/key requires option["' + text + '"] to be a function');
        }
        var addCallback = function addCallback(event) {
            event.callback = map[text];
            return event;
        };
        keyBinding(text).map(addCallback).forEach(registerBinding);
    });
    var handleKeyDown = function handleKeyDown(event) {
        if (event.defaultPrevented) {
            return;
        }
        if (filter.length) {
            // ignore elements within the exempted sub-trees
            var isParentOfElement = getParentComparator({
                element: event.target,
                includeSelf: true
            });
            if (filter.some(isParentOfElement)) {
                return;
            }
        }
        var key = event.keyCode || event.which;
        if (!bindings[key]) {
            return;
        }
        bindings[key].forEach(function(_event) {
            if (!_event.matchModifiers(event)) {
                return;
            }
            _event.callback.call(context, event, disengage);
        });
    };
    context.addEventListener('keydown', handleKeyDown, false);
    var disengage = function disengage() {
        context.removeEventListener('keydown', handleKeyDown, false);
    };
    return {
        disengage: disengage
    };
}
function _default(param) {
    let { context } = param === void 0 ? {} : param;
    if (!context) {
        context = document.documentElement;
    }
    // Make sure the supports tests are run before intercepting the Tab key,
    // or IE10 and IE11 will fail to process the first Tab key event. Not
    // limiting this warm-up to IE because it may be a problem elsewhere, too.
    queryTabsequence();
    return whenKey({
        // Safari on OSX may require ALT+TAB to reach links,
        // see https://github.com/medialize/ally.js/issues/146
        '?alt+?shift+tab': function altShiftTab(event) {
            // we're completely taking over the Tab key handling
            event.preventDefault();
            var sequence = queryTabsequence({
                context: context
            });
            var backward = event.shiftKey;
            var first = sequence[0];
            var last = sequence[sequence.length - 1];
            // wrap around first to last, last to first
            var source = backward ? first : last;
            var target = backward ? last : first;
            if (isActiveElement(source)) {
                target.focus();
                return;
            }
            // find current position in tabsequence
            var currentIndex = void 0;
            var found = sequence.some(function(element, index) {
                if (!isActiveElement(element)) {
                    return false;
                }
                currentIndex = index;
                return true;
            });
            if (!found) {
                // redirect to first as we're not in our tabsequence
                first.focus();
                return;
            }
            // shift focus to previous/next element in the sequence
            var offset = backward ? -1 : 1;
            sequence[currentIndex + offset].focus();
        }
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=maintain--tab-focus.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/body-locker.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    lock: null,
    unlock: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    lock: function() {
        return lock;
    },
    unlock: function() {
        return unlock;
    }
});
let previousBodyPaddingRight;
let previousBodyOverflowSetting;
let activeLocks = 0;
function lock() {
    setTimeout(()=>{
        if (activeLocks++ > 0) {
            return;
        }
        const scrollBarGap = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarGap > 0) {
            previousBodyPaddingRight = document.body.style.paddingRight;
            document.body.style.paddingRight = "" + scrollBarGap + "px";
        }
        previousBodyOverflowSetting = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    });
}
function unlock() {
    setTimeout(()=>{
        if (activeLocks === 0 || --activeLocks !== 0) {
            return;
        }
        if (previousBodyPaddingRight !== undefined) {
            document.body.style.paddingRight = previousBodyPaddingRight;
            previousBodyPaddingRight = undefined;
        }
        if (previousBodyOverflowSetting !== undefined) {
            document.body.style.overflow = previousBodyOverflowSetting;
            previousBodyOverflowSetting = undefined;
        }
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=body-locker.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/Overlay.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Overlay", {
    enumerable: true,
    get: function() {
        return Overlay;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _maintaintabfocus = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/maintain--tab-focus.js [app-client] (ecmascript)"));
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _bodylocker = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/body-locker.js [app-client] (ecmascript)");
const Overlay = function Overlay(param) {
    let { className, children, fixed } = param;
    _react.useEffect({
        "Overlay.useEffect": ()=>{
            (0, _bodylocker.lock)();
            return ({
                "Overlay.useEffect": ()=>{
                    (0, _bodylocker.unlock)();
                }
            })["Overlay.useEffect"];
        }
    }["Overlay.useEffect"], []);
    const [overlay, setOverlay] = _react.useState(null);
    const onOverlay = _react.useCallback({
        "Overlay.useCallback[onOverlay]": (el)=>{
            setOverlay(el);
        }
    }["Overlay.useCallback[onOverlay]"], []);
    _react.useEffect({
        "Overlay.useEffect": ()=>{
            if (overlay == null) {
                return;
            }
            const handle2 = (0, _maintaintabfocus.default)({
                context: overlay
            });
            return ({
                "Overlay.useEffect": ()=>{
                    handle2.disengage();
                }
            })["Overlay.useEffect"];
        }
    }["Overlay.useEffect"], [
        overlay
    ]);
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        "data-nextjs-dialog-overlay": true,
        className: className,
        ref: onOverlay,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                "data-nextjs-dialog-backdrop": true,
                "data-nextjs-dialog-backdrop-fixed": fixed ? true : undefined
            }),
            children
        ]
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=Overlay.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Overlay", {
    enumerable: true,
    get: function() {
        return _Overlay.Overlay;
    }
});
const _Overlay = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/Overlay.js [app-client] (ecmascript)");
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/hot-linked-text/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "HotlinkedText", {
    enumerable: true,
    get: function() {
        return HotlinkedText;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _magicidentifier = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/magic-identifier.js [app-client] (ecmascript)");
const linkRegex = /https?:\/\/[^\s/$.?#].[^\s)'"]*/i;
const splitRegexp = new RegExp("(" + _magicidentifier.MAGIC_IDENTIFIER_REGEX.source + "|\\s+)");
const HotlinkedText = function HotlinkedText(props) {
    const { text, matcher } = props;
    const wordsAndWhitespaces = text.split(splitRegexp);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
        children: wordsAndWhitespaces.map((word, index)=>{
            if (linkRegex.test(word)) {
                const link = linkRegex.exec(word);
                const href = link[0];
                // If link matcher is present but the link doesn't match, don't turn it into a link
                if (typeof matcher === 'function' && !matcher(href)) {
                    return word;
                }
                return /*#__PURE__*/ (0, _jsxruntime.jsx)(_react.default.Fragment, {
                    children: /*#__PURE__*/ (0, _jsxruntime.jsx)("a", {
                        href: href,
                        target: "_blank",
                        rel: "noreferrer noopener",
                        children: word
                    })
                }, "link-" + index);
            }
            try {
                const decodedWord = (0, _magicidentifier.decodeMagicIdentifier)(word);
                if (decodedWord !== word) {
                    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("i", {
                        children: [
                            '{',
                            decodedWord,
                            '}'
                        ]
                    }, "ident-" + index);
                }
            } catch (e) {
                return /*#__PURE__*/ (0, _jsxruntime.jsxs)("i", {
                    children: [
                        '{',
                        word,
                        " (decoding failed: ",
                        '' + e,
                        ")",
                        '}'
                    ]
                }, "ident-" + index);
            }
            return /*#__PURE__*/ (0, _jsxruntime.jsx)(_react.default.Fragment, {
                children: word
            }, "text-" + index);
        })
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-open-in-editor.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "useOpenInEditor", {
    enumerable: true,
    get: function() {
        return useOpenInEditor;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
function useOpenInEditor(param) {
    let { file, lineNumber, column } = param === void 0 ? {} : param;
    const openInEditor = (0, _react.useCallback)(()=>{
        if (file == null || lineNumber == null || column == null) return;
        const params = new URLSearchParams();
        params.append('file', file);
        params.append('lineNumber', String(lineNumber));
        params.append('column', String(column));
        self.fetch((("TURBOPACK compile-time value", "") || '') + "/__nextjs_launch-editor?" + params.toString()).then(()=>{}, ()=>{
            console.error('There was an issue opening this code in your editor.');
        });
    }, [
        file,
        lineNumber,
        column
    ]);
    return openInEditor;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=use-open-in-editor.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/EditorLink.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EditorLink", {
    enumerable: true,
    get: function() {
        return EditorLink;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _useopenineditor = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-open-in-editor.js [app-client] (ecmascript)");
function EditorLink(param) {
    let { file, isSourceFile, location } = param;
    var _location_line, _location_column;
    const open = (0, _useopenineditor.useOpenInEditor)({
        file,
        lineNumber: (_location_line = location == null ? void 0 : location.line) != null ? _location_line : 1,
        column: (_location_column = location == null ? void 0 : location.column) != null ? _location_column : 0
    });
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        "data-with-open-in-editor-link": true,
        "data-with-open-in-editor-link-source-file": isSourceFile ? true : undefined,
        "data-with-open-in-editor-link-import-trace": isSourceFile ? undefined : true,
        tabIndex: 10,
        role: 'link',
        onClick: open,
        title: 'Click to open in your editor',
        children: [
            file,
            location ? ":" + location.line + ":" + location.column : null,
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                        d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("polyline", {
                        points: "15 3 21 3 21 9"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("line", {
                        x1: "10",
                        y1: "14",
                        x2: "21",
                        y2: "3"
                    })
                ]
            })
        ]
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=EditorLink.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/Terminal.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Terminal", {
    enumerable: true,
    get: function() {
        return Terminal;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _anser = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/anser/index.js [app-client] (ecmascript)"));
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _hotlinkedtext = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/hot-linked-text/index.js [app-client] (ecmascript)");
const _EditorLink = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/EditorLink.js [app-client] (ecmascript)");
function getFile(lines) {
    const contentFileName = lines.shift();
    if (!contentFileName) return null;
    const [fileName, line, column] = contentFileName.split(':', 3);
    const parsedLine = Number(line);
    const parsedColumn = Number(column);
    const hasLocation = !Number.isNaN(parsedLine) && !Number.isNaN(parsedColumn);
    return {
        fileName: hasLocation ? fileName : contentFileName,
        location: hasLocation ? {
            line: parsedLine,
            column: parsedColumn
        } : undefined
    };
}
function getImportTraceFiles(lines) {
    if (lines.some((line)=>/ReactServerComponentsError:/.test(line)) || lines.some((line)=>/Import trace for requested module:/.test(line))) {
        // Grab the lines at the end containing the files
        const files = [];
        while(/.+\..+/.test(lines[lines.length - 1]) && !lines[lines.length - 1].includes(':')){
            const file = lines.pop().trim();
            files.unshift(file);
        }
        return files;
    }
    return [];
}
function getEditorLinks(content) {
    const lines = content.split('\n');
    const file = getFile(lines);
    const importTraceFiles = getImportTraceFiles(lines);
    return {
        file,
        source: lines.join('\n'),
        importTraceFiles
    };
}
const Terminal = function Terminal(param) {
    let { content } = param;
    const { file, source, importTraceFiles } = _react.useMemo({
        "Terminal.useMemo": ()=>getEditorLinks(content)
    }["Terminal.useMemo"], [
        content
    ]);
    const decoded = _react.useMemo({
        "Terminal.useMemo[decoded]": ()=>{
            return _anser.default.ansiToJson(source, {
                json: true,
                use_classes: true,
                remove_empty: true
            });
        }
    }["Terminal.useMemo[decoded]"], [
        source
    ]);
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        "data-nextjs-terminal": true,
        children: [
            file && /*#__PURE__*/ (0, _jsxruntime.jsx)(_EditorLink.EditorLink, {
                isSourceFile: true,
                file: file.fileName,
                location: file.location
            }, file.fileName),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("pre", {
                children: [
                    decoded.map((entry, index)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                            style: {
                                color: entry.fg ? "var(--color-" + entry.fg + ")" : undefined,
                                ...entry.decoration === 'bold' ? {
                                    fontWeight: 800
                                } : entry.decoration === 'italic' ? {
                                    fontStyle: 'italic'
                                } : undefined
                            },
                            children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_hotlinkedtext.HotlinkedText, {
                                text: entry.content
                            })
                        }, "terminal-entry-" + index)),
                    importTraceFiles.map((importTraceFile)=>/*#__PURE__*/ (0, _jsxruntime.jsx)(_EditorLink.EditorLink, {
                            isSourceFile: false,
                            file: importTraceFile
                        }, importTraceFile))
                ]
            })
        ]
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=Terminal.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Terminal", {
    enumerable: true,
    get: function() {
        return _Terminal.Terminal;
    }
});
const _Terminal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/Terminal.js [app-client] (ecmascript)");
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/styles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "styles", {
    enumerable: true,
    get: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  .nextjs-container-build-error-version-status {\n    flex: 1;\n    text-align: right;\n    font-size: var(--size-font-small);\n  }\n  .nextjs-container-build-error-version-status span {\n    display: inline-block;\n    width: 10px;\n    height: 10px;\n    border-radius: 5px;\n    background: var(--color-ansi-bright-black);\n  }\n  .nextjs-container-build-error-version-status span.fresh {\n    background: var(--color-ansi-green);\n  }\n  .nextjs-container-build-error-version-status span.stale {\n    background: var(--color-ansi-yellow);\n  }\n  .nextjs-container-build-error-version-status span.outdated {\n    background: var(--color-ansi-red);\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=styles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/VersionStalenessInfo.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    VersionStalenessInfo: null,
    getStaleness: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    VersionStalenessInfo: function() {
        return VersionStalenessInfo;
    },
    getStaleness: function() {
        return getStaleness;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
function VersionStalenessInfo(param) {
    let { versionInfo } = param;
    if (!versionInfo) return null;
    const { staleness } = versionInfo;
    let { text, indicatorClass, title } = getStaleness(versionInfo);
    if (!text) return null;
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
        className: "nextjs-container-build-error-version-status",
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                className: indicatorClass
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("small", {
                "data-nextjs-version-checker": true,
                title: title,
                children: text
            }),
            ' ',
            staleness === 'fresh' || staleness === 'newer-than-npm' || staleness === 'unknown' ? null : /*#__PURE__*/ (0, _jsxruntime.jsx)("a", {
                target: "_blank",
                rel: "noopener noreferrer",
                href: "https://nextjs.org/docs/messages/version-staleness",
                children: "(learn more)"
            }),
            ("TURBOPACK compile-time truthy", 1) ? ' (Turbopack)' : ("TURBOPACK unreachable", undefined)
        ]
    });
}
function getStaleness(param) {
    let { installed, staleness, expected } = param;
    let text = '';
    let title = '';
    let indicatorClass = '';
    const versionLabel = "Next.js (" + installed + ")";
    switch(staleness){
        case 'newer-than-npm':
        case 'fresh':
            text = versionLabel;
            title = "Latest available version is detected (" + installed + ").";
            indicatorClass = 'fresh';
            break;
        case 'stale-patch':
        case 'stale-minor':
            text = "" + versionLabel + " out of date";
            title = "There is a newer version (" + expected + ") available, upgrade recommended! ";
            indicatorClass = 'stale';
            break;
        case 'stale-major':
            {
                text = "" + versionLabel + " is outdated";
                title = "An outdated version detected (latest is " + expected + "), upgrade is highly recommended!";
                indicatorClass = 'outdated';
                break;
            }
        case 'stale-prerelease':
            {
                text = "" + versionLabel + " is outdated";
                title = "There is a newer canary version (" + expected + ") available, please upgrade! ";
                indicatorClass = 'stale';
                break;
            }
        case 'unknown':
            break;
        default:
            break;
    }
    return {
        text,
        indicatorClass,
        title
    };
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=VersionStalenessInfo.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    VersionStalenessInfo: null,
    styles: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    VersionStalenessInfo: function() {
        return _VersionStalenessInfo.VersionStalenessInfo;
    },
    styles: function() {
        return _styles.styles;
    }
});
const _styles = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/styles.js [app-client] (ecmascript)");
const _VersionStalenessInfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/VersionStalenessInfo.js [app-client] (ecmascript)");
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/BuildError.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    BuildError: null,
    styles: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    BuildError: function() {
        return BuildError;
    },
    styles: function() {
        return styles;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _Dialog = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/index.js [app-client] (ecmascript)");
const _Overlay = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/index.js [app-client] (ecmascript)");
const _Terminal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/index.js [app-client] (ecmascript)");
const _VersionStalenessInfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/index.js [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  h1.nextjs__container_errors_label {\n    font-size: var(--size-font-big);\n    line-height: var(--size-font-bigger);\n    font-weight: bold;\n    margin: var(--size-gap-double) 0;\n  }\n  .nextjs-container-errors-header p {\n    font-size: var(--size-font-small);\n    line-height: var(--size-font-big);\n    white-space: pre-wrap;\n  }\n  .nextjs-container-errors-body footer {\n    margin-top: var(--size-gap);\n  }\n  .nextjs-container-errors-body footer p {\n    margin: 0;\n  }\n\n  .nextjs-container-errors-body small {\n    color: var(--color-font);\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const BuildError = function BuildError(param) {
    let { message, versionInfo } = param;
    const noop = _react.useCallback({
        "BuildError.useCallback[noop]": ()=>{}
    }["BuildError.useCallback[noop]"], []);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_Overlay.Overlay, {
        fixed: true,
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_Dialog.Dialog, {
            type: "error",
            "aria-labelledby": "nextjs__container_error_label",
            "aria-describedby": "nextjs__container_error_desc",
            onClose: noop,
            children: /*#__PURE__*/ (0, _jsxruntime.jsxs)(_Dialog.DialogContent, {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)(_Dialog.DialogHeader, {
                        className: "nextjs-container-errors-header",
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("h1", {
                                id: "nextjs__container_errors_label",
                                className: "nextjs__container_errors_label",
                                children: 'Build Error'
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)(_VersionStalenessInfo.VersionStalenessInfo, {
                                versionInfo: versionInfo
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("p", {
                                id: "nextjs__container_errors_desc",
                                className: "nextjs__container_errors_desc",
                                children: "Failed to compile"
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)(_Dialog.DialogBody, {
                        className: "nextjs-container-errors-body",
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)(_Terminal.Terminal, {
                                content: message
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("footer", {
                                children: /*#__PURE__*/ (0, _jsxruntime.jsx)("p", {
                                    id: "nextjs__container_build_error_desc",
                                    children: /*#__PURE__*/ (0, _jsxruntime.jsx)("small", {
                                        children: "This error occurred during the build process and can only be dismissed by fixing the error."
                                    })
                                })
                            })
                        ]
                    })
                ]
            })
        })
    });
};
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=BuildError.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/CloseIcon.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CloseIcon", {
    enumerable: true,
    get: function() {
        return CloseIcon;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const CloseIcon = ()=>{
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
        width: "24",
        height: "24",
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                d: "M18 6L6 18",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                d: "M6 6L18 18",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round"
            })
        ]
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=CloseIcon.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/LeftRightDialogHeader/LeftRightDialogHeader.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LeftRightDialogHeader", {
    enumerable: true,
    get: function() {
        return LeftRightDialogHeader;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _CloseIcon = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/CloseIcon.js [app-client] (ecmascript)");
const LeftRightDialogHeader = function LeftRightDialogHeader(param) {
    let { children, className, previous, next, close } = param;
    const buttonLeft = _react.useRef(null);
    const buttonRight = _react.useRef(null);
    const buttonClose = _react.useRef(null);
    const [nav, setNav] = _react.useState(null);
    const onNav = _react.useCallback({
        "LeftRightDialogHeader.useCallback[onNav]": (el)=>{
            setNav(el);
        }
    }["LeftRightDialogHeader.useCallback[onNav]"], []);
    _react.useEffect({
        "LeftRightDialogHeader.useEffect": ()=>{
            if (nav == null) {
                return;
            }
            const root = nav.getRootNode();
            const d = self.document;
            function handler(e) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (buttonLeft.current) {
                        buttonLeft.current.focus();
                    }
                    previous && previous();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (buttonRight.current) {
                        buttonRight.current.focus();
                    }
                    next && next();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (root instanceof ShadowRoot) {
                        const a = root.activeElement;
                        if (a && a !== buttonClose.current && a instanceof HTMLElement) {
                            a.blur();
                            return;
                        }
                    }
                    close == null ? void 0 : close();
                }
            }
            root.addEventListener('keydown', handler);
            if (root !== d) {
                d.addEventListener('keydown', handler);
            }
            return ({
                "LeftRightDialogHeader.useEffect": function() {
                    root.removeEventListener('keydown', handler);
                    if (root !== d) {
                        d.removeEventListener('keydown', handler);
                    }
                }
            })["LeftRightDialogHeader.useEffect"];
        }
    }["LeftRightDialogHeader.useEffect"], [
        close,
        nav,
        next,
        previous
    ]);
    // Unlock focus for browsers like Firefox, that break all user focus if the
    // currently focused item becomes disabled.
    _react.useEffect({
        "LeftRightDialogHeader.useEffect": ()=>{
            if (nav == null) {
                return;
            }
            const root = nav.getRootNode();
            // Always true, but we do this for TypeScript:
            if (root instanceof ShadowRoot) {
                const a = root.activeElement;
                if (previous == null) {
                    if (buttonLeft.current && a === buttonLeft.current) {
                        buttonLeft.current.blur();
                    }
                } else if (next == null) {
                    if (buttonRight.current && a === buttonRight.current) {
                        buttonRight.current.blur();
                    }
                }
            }
        }
    }["LeftRightDialogHeader.useEffect"], [
        nav,
        next,
        previous
    ]);
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        "data-nextjs-dialog-left-right": true,
        className: className,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("nav", {
                ref: onNav,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                        ref: buttonLeft,
                        type: "button",
                        disabled: previous == null ? true : undefined,
                        "aria-disabled": previous == null ? true : undefined,
                        onClick: previous != null ? previous : undefined,
                        children: /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
                            viewBox: "0 0 14 14",
                            fill: "none",
                            xmlns: "http://www.w3.org/2000/svg",
                            children: [
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("title", {
                                    children: "previous"
                                }),
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                                    d: "M6.99996 1.16666L1.16663 6.99999L6.99996 12.8333M12.8333 6.99999H1.99996H12.8333Z",
                                    stroke: "currentColor",
                                    strokeWidth: "2",
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round"
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                        ref: buttonRight,
                        type: "button",
                        disabled: next == null ? true : undefined,
                        "aria-disabled": next == null ? true : undefined,
                        onClick: next != null ? next : undefined,
                        children: /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
                            viewBox: "0 0 14 14",
                            fill: "none",
                            xmlns: "http://www.w3.org/2000/svg",
                            children: [
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("title", {
                                    children: "next"
                                }),
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                                    d: "M6.99996 1.16666L12.8333 6.99999L6.99996 12.8333M1.16663 6.99999H12H1.16663Z",
                                    stroke: "currentColor",
                                    strokeWidth: "2",
                                    strokeLinecap: "round",
                                    strokeLinejoin: "round"
                                })
                            ]
                        })
                    }),
                    children
                ]
            }),
            close ? /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                "data-nextjs-errors-dialog-left-right-close-button": true,
                ref: buttonClose,
                type: "button",
                onClick: close,
                "aria-label": "Close",
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                    "aria-hidden": "true",
                    children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_CloseIcon.CloseIcon, {})
                })
            }) : null
        ]
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=LeftRightDialogHeader.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/LeftRightDialogHeader/styles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "styles", {
    enumerable: true,
    get: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  [data-nextjs-dialog-left-right] {\n    display: flex;\n    flex-direction: row;\n    align-content: center;\n    align-items: center;\n    justify-content: space-between;\n  }\n  [data-nextjs-dialog-left-right] > nav {\n    flex: 1;\n    display: flex;\n    align-items: center;\n    margin-right: var(--size-gap);\n  }\n  [data-nextjs-dialog-left-right] > nav > button {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n\n    width: calc(var(--size-gap-double) + var(--size-gap));\n    height: calc(var(--size-gap-double) + var(--size-gap));\n    font-size: 0;\n    border: none;\n    background-color: rgba(255, 85, 85, 0.1);\n    color: var(--color-ansi-red);\n    cursor: pointer;\n    transition: background-color 0.25s ease;\n  }\n  [data-nextjs-dialog-left-right] > nav > button > svg {\n    width: auto;\n    height: calc(var(--size-gap) + var(--size-gap-half));\n  }\n  [data-nextjs-dialog-left-right] > nav > button:hover {\n    background-color: rgba(255, 85, 85, 0.2);\n  }\n  [data-nextjs-dialog-left-right] > nav > button:disabled {\n    background-color: rgba(255, 85, 85, 0.1);\n    color: rgba(255, 85, 85, 0.4);\n    cursor: not-allowed;\n  }\n\n  [data-nextjs-dialog-left-right] > nav > button:first-of-type {\n    border-radius: var(--size-gap-half) 0 0 var(--size-gap-half);\n    margin-right: 1px;\n  }\n  [data-nextjs-dialog-left-right] > nav > button:last-of-type {\n    border-radius: 0 var(--size-gap-half) var(--size-gap-half) 0;\n  }\n\n  [data-nextjs-dialog-left-right] > button:last-of-type {\n    border: 0;\n    padding: 0;\n\n    background-color: transparent;\n    appearance: none;\n\n    opacity: 0.4;\n    transition: opacity 0.25s ease;\n\n    color: var(--color-font);\n  }\n  [data-nextjs-dialog-left-right] > button:last-of-type:hover {\n    opacity: 0.7;\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=styles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/LeftRightDialogHeader/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    LeftRightDialogHeader: null,
    styles: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    LeftRightDialogHeader: function() {
        return _LeftRightDialogHeader.LeftRightDialogHeader;
    },
    styles: function() {
        return _styles.styles;
    }
});
const _LeftRightDialogHeader = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/LeftRightDialogHeader/LeftRightDialogHeader.js [app-client] (ecmascript)");
const _styles = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/LeftRightDialogHeader/styles.js [app-client] (ecmascript)");
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/styles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "styles", {
    enumerable: true,
    get: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  .nextjs-toast {\n    position: fixed;\n    bottom: var(--size-gap-double);\n    left: var(--size-gap-double);\n    max-width: 420px;\n    z-index: 9000;\n    box-shadow: 0px var(--size-gap-double) var(--size-gap-quad)\n      rgba(0, 0, 0, 0.25);\n  }\n\n  @media (max-width: 440px) {\n    .nextjs-toast {\n      max-width: 90vw;\n      left: 5vw;\n    }\n  }\n\n  .nextjs-toast-errors-parent {\n    padding: 16px;\n    border-radius: var(--size-gap-quad);\n    font-weight: 500;\n    color: var(--color-ansi-bright-white);\n    background-color: var(--color-ansi-red);\n  }\n\n  .nextjs-static-indicator-toast-wrapper {\n    width: 30px;\n    height: 30px;\n    overflow: hidden;\n    border: 0;\n    border-radius: var(--size-gap-triple);\n    background: var(--color-background);\n    color: var(--color-font);\n    transition: all 0.3s ease-in-out;\n    box-shadow:\n      inset 0 0 0 1px var(--color-border-shadow),\n      0 11px 40px 0 rgba(0, 0, 0, 0.25),\n      0 2px 10px 0 rgba(0, 0, 0, 0.12);\n  }\n\n  .nextjs-static-indicator-toast-wrapper:hover {\n    width: 140px;\n  }\n\n  .nextjs-static-indicator-toast-icon {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 30px;\n    height: 30px;\n  }\n\n  .nextjs-static-indicator-toast-text {\n    font-size: 14px;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    opacity: 0;\n    white-space: nowrap;\n    transition: opacity 0.3s ease-in-out;\n    line-height: 30px;\n    position: absolute;\n    left: 30px;\n    top: 0;\n  }\n\n  .nextjs-static-indicator-toast-wrapper:hover\n    .nextjs-static-indicator-toast-text {\n    opacity: 1;\n  }\n\n  .nextjs-static-indicator-toast-wrapper button {\n    color: var(--color-font);\n    opacity: 0.8;\n    background: none;\n    border: none;\n    margin-left: 6px;\n    margin-top: -2px;\n    outline: 0;\n  }\n\n  .nextjs-static-indicator-toast-wrapper button:focus {\n    opacity: 1;\n  }\n\n  .nextjs-static-indicator-toast-wrapper button > svg {\n    width: 16px;\n    height: 16px;\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=styles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/Toast.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Toast", {
    enumerable: true,
    get: function() {
        return Toast;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const Toast = function Toast(param) {
    let { onClick, children, className, ...props } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
        ...props,
        onClick: (e)=>{
            e.preventDefault();
            return onClick == null ? void 0 : onClick();
        },
        className: "nextjs-toast" + (className ? ' ' + className : ''),
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
            "data-nextjs-toast-wrapper": true,
            children: children
        })
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=Toast.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    Toast: null,
    styles: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    Toast: function() {
        return _Toast.Toast;
    },
    styles: function() {
        return _styles.styles;
    }
});
const _styles = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/styles.js [app-client] (ecmascript)");
const _Toast = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/Toast.js [app-client] (ecmascript)");
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/webpack-module-path.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    formatFrameSourceFile: null,
    isWebpackInternalResource: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    formatFrameSourceFile: function() {
        return formatFrameSourceFile;
    },
    isWebpackInternalResource: function() {
        return isWebpackInternalResource;
    }
});
const replacementRegExes = [
    /^(rsc:\/\/React\/[^/]+\/)/,
    /^webpack-internal:\/\/\/(\([\w-]+\)\/)?/,
    /^(webpack:\/\/\/|webpack:\/\/(_N_E\/)?)(\([\w-]+\)\/)?/,
    /\?\w+(\?\d+)?$/,
    /\?\d+$/
];
function isWebpackInternalResource(file) {
    for (const regex of replacementRegExes){
        if (regex.test(file)) return true;
        file = file.replace(regex, '');
    }
    return false;
}
function formatFrameSourceFile(file) {
    if (file === '<anonymous>') return '';
    for (const regex of replacementRegExes){
        file = file.replace(regex, '');
    }
    return file;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=webpack-module-path.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stack-frame.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    getFrameSource: null,
    getOriginalStackFrames: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    getFrameSource: function() {
        return getFrameSource;
    },
    getOriginalStackFrames: function() {
        return getOriginalStackFrames;
    }
});
const _webpackmodulepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/webpack-module-path.js [app-client] (ecmascript)");
function getOriginalStackFrame(source, type, isAppDir, errorMessage) {
    var _source_file, _source_file1;
    async function _getOriginalStackFrame() {
        var /* collapsed */ _source_file, _body_originalStackFrame_file, _body_originalStackFrame, _body_originalStackFrame_file1, _body_originalStackFrame1;
        const params = new URLSearchParams();
        params.append('isServer', String(type === 'server'));
        params.append('isEdgeServer', String(type === 'edge-server'));
        params.append('isAppDirectory', String(isAppDir));
        params.append('errorMessage', errorMessage);
        for(const key in source){
            var _source_key;
            params.append(key, ((_source_key = source[key]) != null ? _source_key : '').toString());
        }
        const controller = new AbortController();
        const tm = setTimeout(()=>controller.abort(), 3000);
        const res = await self.fetch((("TURBOPACK compile-time value", "") || '') + "/__nextjs_original-stack-frame?" + params.toString(), {
            signal: controller.signal
        }).finally(()=>{
            clearTimeout(tm);
        });
        if (!res.ok || res.status === 204) {
            return Promise.reject(new Error(await res.text()));
        }
        const body = await res.json();
        var _ref;
        return {
            error: false,
            reason: null,
            external: false,
            expanded: !Boolean((_ref = ((_source_file = source.file) == null ? void 0 : _source_file.includes('node_modules')) || ((_body_originalStackFrame = body.originalStackFrame) == null ? void 0 : (_body_originalStackFrame_file = _body_originalStackFrame.file) == null ? void 0 : _body_originalStackFrame_file.includes('node_modules')) || ((_body_originalStackFrame1 = body.originalStackFrame) == null ? void 0 : (_body_originalStackFrame_file1 = _body_originalStackFrame1.file) == null ? void 0 : _body_originalStackFrame_file1.startsWith('[turbopack]/'))) != null ? _ref : true),
            sourceStackFrame: source,
            originalStackFrame: body.originalStackFrame,
            originalCodeFrame: body.originalCodeFrame || null,
            sourcePackage: body.sourcePackage
        };
    }
    if (source.file === '<anonymous>' || source.file === 'file://' || ((_source_file = source.file) == null ? void 0 : _source_file.match(/^node:/)) || ((_source_file1 = source.file) == null ? void 0 : _source_file1.match(/https?:\/\//))) {
        return Promise.resolve({
            error: false,
            reason: null,
            external: true,
            expanded: false,
            sourceStackFrame: source,
            originalStackFrame: null,
            originalCodeFrame: null,
            sourcePackage: null
        });
    }
    return _getOriginalStackFrame().catch((err)=>{
        var _err_message, _ref;
        return {
            error: true,
            reason: (_ref = (_err_message = err == null ? void 0 : err.message) != null ? _err_message : err == null ? void 0 : err.toString()) != null ? _ref : 'Unknown Error',
            external: false,
            expanded: false,
            sourceStackFrame: source,
            originalStackFrame: null,
            originalCodeFrame: null,
            sourcePackage: null
        };
    });
}
function getOriginalStackFrames(frames, type, isAppDir, errorMessage) {
    return Promise.all(frames.map((frame)=>getOriginalStackFrame(frame, type, isAppDir, errorMessage)));
}
function getFrameSource(frame) {
    if (!frame.file) return '';
    const isWebpackFrame = (0, _webpackmodulepath.isWebpackInternalResource)(frame.file);
    let str = '';
    // Skip URL parsing for webpack internal file paths.
    if (isWebpackFrame) {
        str = (0, _webpackmodulepath.formatFrameSourceFile)(frame.file);
    } else {
        try {
            var _globalThis_location;
            const u = new URL(frame.file);
            let parsedPath = '';
            // Strip the origin for same-origin scripts.
            if (((_globalThis_location = globalThis.location) == null ? void 0 : _globalThis_location.origin) !== u.origin) {
                // URLs can be valid without an `origin`, so long as they have a
                // `protocol`. However, `origin` is preferred.
                if (u.origin === 'null') {
                    parsedPath += u.protocol;
                } else {
                    parsedPath += u.origin;
                }
            }
            // Strip query string information as it's typically too verbose to be
            // meaningful.
            parsedPath += u.pathname;
            str = (0, _webpackmodulepath.formatFrameSourceFile)(parsedPath);
        } catch (e) {
            str = (0, _webpackmodulepath.formatFrameSourceFile)(frame.file);
        }
    }
    if (!(0, _webpackmodulepath.isWebpackInternalResource)(frame.file) && frame.lineNumber != null) {
        // If the method name is replayed from server, e.g. Page [Server],
        // and it's formatted to empty string, recover it as <anonymous> to display it.
        if (!str && frame.methodName.endsWith(' [Server]')) {
            str = '<anonymous>';
        }
        if (str) {
            if (frame.column != null) {
                str += " (" + frame.lineNumber + ":" + frame.column + ")";
            } else {
                str += " (" + frame.lineNumber + ")";
            }
        }
    }
    return str;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=stack-frame.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/get-error-by-type.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getErrorByType", {
    enumerable: true,
    get: function() {
        return getErrorByType;
    }
});
const _shared = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/shared.js [app-client] (ecmascript)");
const _stackframe = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stack-frame.js [app-client] (ecmascript)");
const _errorsource = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/error-source.js [app-client] (ecmascript)");
async function getErrorByType(ev, isAppDir) {
    const { id, event } = ev;
    switch(event.type){
        case _shared.ACTION_UNHANDLED_ERROR:
        case _shared.ACTION_UNHANDLED_REJECTION:
            {
                const readyRuntimeError = {
                    id,
                    runtime: true,
                    error: event.reason,
                    frames: await (0, _stackframe.getOriginalStackFrames)(event.frames, (0, _errorsource.getErrorSource)(event.reason), isAppDir, event.reason.toString())
                };
                if (event.type === _shared.ACTION_UNHANDLED_ERROR) {
                    readyRuntimeError.componentStackFrames = event.componentStackFrames;
                }
                return readyRuntimeError;
            }
        default:
            {
                break;
            }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = event;
    throw new Error('type system invariant violation');
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=get-error-by-type.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/CodeFrame/CodeFrame.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CodeFrame", {
    enumerable: true,
    get: function() {
        return CodeFrame;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _anser = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/anser/index.js [app-client] (ecmascript)"));
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _stripansi = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/strip-ansi/index.js [app-client] (ecmascript)"));
const _stackframe = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stack-frame.js [app-client] (ecmascript)");
const _useopenineditor = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-open-in-editor.js [app-client] (ecmascript)");
const _hotlinkedtext = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/hot-linked-text/index.js [app-client] (ecmascript)");
const CodeFrame = function CodeFrame(param) {
    let { stackFrame, codeFrame } = param;
    // Strip leading spaces out of the code frame:
    const formattedFrame = _react.useMemo({
        "CodeFrame.useMemo[formattedFrame]": ()=>{
            const lines = codeFrame.split(/\r?\n/g);
            // Find the minimum length of leading spaces after `|` in the code frame
            const miniLeadingSpacesLength = lines.map({
                "CodeFrame.useMemo[formattedFrame].miniLeadingSpacesLength": (line)=>/^>? +\d+ +\| [ ]+/.exec((0, _stripansi.default)(line)) === null ? null : /^>? +\d+ +\| ( *)/.exec((0, _stripansi.default)(line))
            }["CodeFrame.useMemo[formattedFrame].miniLeadingSpacesLength"]).filter(Boolean).map({
                "CodeFrame.useMemo[formattedFrame].miniLeadingSpacesLength": (v)=>v.pop()
            }["CodeFrame.useMemo[formattedFrame].miniLeadingSpacesLength"]).reduce({
                "CodeFrame.useMemo[formattedFrame].miniLeadingSpacesLength": (c, n)=>isNaN(c) ? n.length : Math.min(c, n.length)
            }["CodeFrame.useMemo[formattedFrame].miniLeadingSpacesLength"], NaN);
            // When the minimum length of leading spaces is greater than 1, remove them
            // from the code frame to help the indentation looks better when there's a lot leading spaces.
            if (miniLeadingSpacesLength > 1) {
                return lines.map({
                    "CodeFrame.useMemo[formattedFrame]": (line, a)=>~(a = line.indexOf('|')) ? line.substring(0, a) + line.substring(a).replace("^\\ {" + miniLeadingSpacesLength + "}", '') : line
                }["CodeFrame.useMemo[formattedFrame]"]).join('\n');
            }
            return lines.join('\n');
        }
    }["CodeFrame.useMemo[formattedFrame]"], [
        codeFrame
    ]);
    const decoded = _react.useMemo({
        "CodeFrame.useMemo[decoded]": ()=>{
            return _anser.default.ansiToJson(formattedFrame, {
                json: true,
                use_classes: true,
                remove_empty: true
            });
        }
    }["CodeFrame.useMemo[decoded]"], [
        formattedFrame
    ]);
    const open = (0, _useopenineditor.useOpenInEditor)({
        file: stackFrame.file,
        lineNumber: stackFrame.lineNumber,
        column: stackFrame.column
    });
    // TODO: make the caret absolute
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        "data-nextjs-codeframe": true,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                children: /*#__PURE__*/ (0, _jsxruntime.jsxs)("p", {
                    role: "link",
                    onClick: open,
                    tabIndex: 1,
                    title: "Click to open in your editor",
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                            children: [
                                (0, _stackframe.getFrameSource)(stackFrame),
                                " @",
                                ' ',
                                /*#__PURE__*/ (0, _jsxruntime.jsx)(_hotlinkedtext.HotlinkedText, {
                                    text: stackFrame.methodName
                                })
                            ]
                        }),
                        /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
                            xmlns: "http://www.w3.org/2000/svg",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            children: [
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                                    d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                                }),
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("polyline", {
                                    points: "15 3 21 3 21 9"
                                }),
                                /*#__PURE__*/ (0, _jsxruntime.jsx)("line", {
                                    x1: "10",
                                    y1: "14",
                                    x2: "21",
                                    y2: "3"
                                })
                            ]
                        })
                    ]
                })
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("pre", {
                children: decoded.map((entry, index)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                        style: {
                            color: entry.fg ? "var(--color-" + entry.fg + ")" : undefined,
                            ...entry.decoration === 'bold' ? {
                                fontWeight: 800
                            } : entry.decoration === 'italic' ? {
                                fontStyle: 'italic'
                            } : undefined
                        },
                        children: entry.content
                    }, "frame-" + index))
            })
        ]
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=CodeFrame.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/CodeFrame/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CodeFrame", {
    enumerable: true,
    get: function() {
        return _CodeFrame.CodeFrame;
    }
});
const _CodeFrame = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/CodeFrame/CodeFrame.js [app-client] (ecmascript)");
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/group-stack-frames-by-framework.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "groupStackFramesByFramework", {
    enumerable: true,
    get: function() {
        return groupStackFramesByFramework;
    }
});
function groupStackFramesByFramework(stackFrames) {
    const stackFramesGroupedByFramework = [];
    for (const stackFrame of stackFrames){
        const currentGroup = stackFramesGroupedByFramework[stackFramesGroupedByFramework.length - 1];
        const framework = stackFrame.sourcePackage;
        if (currentGroup && currentGroup.framework === framework) {
            currentGroup.stackFrames.push(stackFrame);
        } else {
            stackFramesGroupedByFramework.push({
                framework: framework,
                stackFrames: [
                    stackFrame
                ]
            });
        }
    }
    return stackFramesGroupedByFramework;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=group-stack-frames-by-framework.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/CallStackFrame.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CallStackFrame", {
    enumerable: true,
    get: function() {
        return CallStackFrame;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _stackframe = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stack-frame.js [app-client] (ecmascript)");
const _useopenineditor = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-open-in-editor.js [app-client] (ecmascript)");
const _hotlinkedtext = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/hot-linked-text/index.js [app-client] (ecmascript)");
const CallStackFrame = function CallStackFrame(param) {
    let { frame } = param;
    var _frame_originalStackFrame;
    // TODO: ability to expand resolved frames
    // TODO: render error or external indicator
    const f = (_frame_originalStackFrame = frame.originalStackFrame) != null ? _frame_originalStackFrame : frame.sourceStackFrame;
    const hasSource = Boolean(frame.originalCodeFrame);
    const open = (0, _useopenineditor.useOpenInEditor)(hasSource ? {
        file: f.file,
        lineNumber: f.lineNumber,
        column: f.column
    } : undefined);
    // Format method to strip out the webpack layer prefix.
    // e.g. (app-pages-browser)/./app/page.tsx -> ./app/page.tsx
    const formattedMethod = f.methodName.replace(/^\([\w-]+\)\//, '');
    // Formatted file source could be empty. e.g. <anonymous> will be formatted to empty string,
    // we'll skip rendering the frame in this case.
    const fileSource = (0, _stackframe.getFrameSource)(f);
    if (!fileSource) {
        return null;
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        "data-nextjs-call-stack-frame": true,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("h3", {
                "data-nextjs-frame-expanded": Boolean(frame.expanded),
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_hotlinkedtext.HotlinkedText, {
                    text: formattedMethod
                })
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                "data-has-source": hasSource ? 'true' : undefined,
                tabIndex: hasSource ? 10 : undefined,
                role: hasSource ? 'link' : undefined,
                onClick: open,
                title: hasSource ? 'Click to open in your editor' : undefined,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                        children: fileSource
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                                d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("polyline", {
                                points: "15 3 21 3 21 9"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("line", {
                                x1: "10",
                                y1: "14",
                                x2: "21",
                                y2: "3"
                            })
                        ]
                    })
                ]
            })
        ]
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=CallStackFrame.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/CollapseIcon.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CollapseIcon", {
    enumerable: true,
    get: function() {
        return CollapseIcon;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
function CollapseIcon(param) {
    let { collapsed } = param === void 0 ? {} : param;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("svg", {
        "data-nextjs-call-stack-chevron-icon": true,
        "data-collapsed": collapsed,
        fill: "none",
        height: "20",
        width: "20",
        shapeRendering: "geometricPrecision",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        viewBox: "0 0 24 24",
        ...typeof collapsed === 'boolean' ? {
            style: {
                transform: collapsed ? undefined : 'rotate(90deg)'
            }
        } : {},
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
            d: "M9 18l6-6-6-6"
        })
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=CollapseIcon.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/FrameworkIcon.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FrameworkIcon", {
    enumerable: true,
    get: function() {
        return FrameworkIcon;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
function FrameworkIcon(param) {
    let { framework } = param;
    if (framework === 'react') {
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
            "data-nextjs-call-stack-framework-icon": "react",
            xmlns: "http://www.w3.org/2000/svg",
            width: "20",
            height: "20",
            viewBox: "0 0 410 369",
            fill: "none",
            shapeRendering: "geometricPrecision",
            stroke: "currentColor",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: "5",
            children: [
                /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                    d: "M204.995 224.552C226.56 224.552 244.042 207.07 244.042 185.506C244.042 163.941 226.56 146.459 204.995 146.459C183.43 146.459 165.948 163.941 165.948 185.506C165.948 207.07 183.43 224.552 204.995 224.552Z",
                    fill: "currentColor"
                }),
                /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                    d: "M409.99 184.505C409.99 153.707 381.437 126.667 335.996 108.925C343.342 60.6535 334.19 22.3878 307.492 6.98883C283.649 -6.77511 250.631 -0.0395641 214.512 25.9753C211.316 28.2692 208.143 30.7097 204.97 33.2477C201.822 30.7097 198.65 28.2692 195.477 25.9753C159.359 -0.0395641 126.34 -6.79951 102.497 6.98883C75.8237 22.3878 66.6721 60.6291 74.0422 108.852C28.5529 126.618 0 153.682 0 184.505C0 215.303 28.5528 242.342 73.9934 260.084C66.6477 308.356 75.7993 346.621 102.497 362.02C110.575 366.682 119.727 369 129.684 369C149.085 369 171.61 360.215 195.477 343.034C198.674 340.74 201.847 338.3 205.019 335.762C208.167 338.3 211.34 340.74 214.512 343.034C238.38 360.239 260.905 369 280.306 369C290.263 369 299.415 366.682 307.492 362.02C331.335 348.256 342 316.287 337.534 271.993C337.143 268.089 336.631 264.135 335.996 260.109C381.461 242.367 409.99 215.327 409.99 184.505ZM225.934 41.8136C246.238 27.1955 265.127 19.5814 280.306 19.5814C286.871 19.5814 292.728 20.9968 297.731 23.8765C315.204 33.9798 322.672 62.9475 317.327 102.433C299.756 97.0401 280.306 92.9158 259.392 90.2802C246.872 73.8074 233.597 58.9453 220.003 46.2551C221.98 44.7421 223.957 43.229 225.934 41.8136ZM112.259 23.8765C117.262 20.9968 123.119 19.5814 129.684 19.5814C144.863 19.5814 163.752 27.1711 184.056 41.8136C186.033 43.229 188.01 44.7176 189.986 46.2551C176.393 58.9453 163.142 73.783 150.622 90.2558C129.732 92.8914 110.258 97.0401 92.687 102.409C87.3424 62.9475 94.7857 33.9798 112.259 23.8765ZM19.5233 184.505C19.5233 164.322 40.9014 143.359 77.776 128.253C81.9003 146.141 88.0502 165.054 96.1768 184.456C88.0014 203.881 81.8515 222.819 77.7272 240.732C40.9014 225.626 19.5233 204.687 19.5233 184.505ZM184.056 327.196C154.966 348.134 128.805 354.675 112.259 345.133C94.7857 335.029 87.3181 306.062 92.6626 266.576C110.234 271.969 129.684 276.093 150.598 278.729C163.117 295.202 176.393 310.064 189.986 322.754C188.01 324.292 186.033 325.78 184.056 327.196ZM204.995 310.04C180.591 287.685 157.138 257.815 137.347 223.551C132.051 214.4 121.344 191.396 117 182.489C113.535 190.786 110.112 198.398 107.427 206.5C109.623 210.575 118.092 229.213 120.434 233.288C125.071 241.317 129.928 249.127 134.931 256.692C120.898 254.227 107.915 251.055 96.1035 247.321C102.815 217.011 116.213 182.064 137.347 145.458C142.545 136.453 153.838 116.346 159.5 108C150.568 109.147 143.395 108.767 135 110.5C132.56 114.453 122.777 131.645 120.434 135.721C115.749 143.823 111.454 151.925 107.427 159.978C102.546 146.581 98.8124 133.744 96.1524 121.64C125.755 112.293 162.727 106.411 204.995 106.411C215.562 106.411 237.63 106.197 247.49 106.905C242.048 99.7544 237.38 93.2819 231.694 86.888C227.082 86.7416 209.705 86.888 204.995 86.888C195.672 86.888 186.545 87.2053 177.589 87.7422C186.472 77.1752 195.672 67.5111 204.995 58.9697C229.375 81.3239 252.851 111.195 272.643 145.458C277.841 154.463 289.073 175.426 293.49 184.505C296.98 176.207 300.281 168.64 302.99 160.489C300.793 156.389 291.898 139.747 289.555 135.696C284.918 127.667 280.062 119.858 275.059 112.317C289.092 114.782 302.075 117.954 313.886 121.688C307.175 151.998 293.777 186.945 272.643 223.551C267.445 232.556 252.651 253.178 246.99 261.524C255.922 260.377 265.595 258.663 273.99 256.93C276.43 252.976 287.212 237.364 289.555 233.288C294.216 225.235 298.512 217.182 302.489 209.153C307.224 222.185 310.982 234.997 313.715 247.394C284.138 256.741 247.214 262.598 204.995 262.598C194.428 262.598 169.859 261.208 160 260.5C165.442 267.65 171.304 275.095 176.99 281.489C181.602 281.635 200.285 282.121 204.995 282.121C214.317 282.121 223.444 281.804 232.401 281.267C223.493 291.834 214.317 301.498 204.995 310.04ZM297.731 345.133C281.185 354.699 254.999 348.159 225.934 327.196C223.957 325.78 221.98 324.292 220.003 322.754C233.597 310.064 246.848 295.226 259.367 278.753C280.233 276.118 299.659 271.993 317.205 266.625C317.547 269.089 317.888 271.554 318.132 273.97C321.72 309.649 314.277 335.566 297.731 345.133ZM332.262 240.756C328.065 222.599 321.842 203.686 313.813 184.578C321.988 165.152 328.138 146.215 332.262 128.302C369.088 143.408 390.466 164.322 390.466 184.505C390.466 204.687 369.113 225.626 332.262 240.756Z",
                    fill: "currentColor"
                })
            ]
        });
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
        "data-nextjs-call-stack-framework-icon": "next",
        xmlns: "http://www.w3.org/2000/svg",
        width: "20",
        height: "20",
        viewBox: "0 0 180 180",
        fill: "none",
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("mask", {
                id: "mask0_408_139",
                maskUnits: "userSpaceOnUse",
                x: "0",
                y: "0",
                width: "180",
                height: "180",
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)("circle", {
                    cx: "90",
                    cy: "90",
                    r: "90",
                    fill: "black"
                })
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("g", {
                mask: "url(#mask0_408_139)",
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("circle", {
                        cx: "90",
                        cy: "90",
                        r: "87",
                        fill: "black",
                        stroke: "white",
                        strokeWidth: "6"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                        d: "M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z",
                        fill: "url(#paint0_linear_408_139)"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("rect", {
                        x: "115",
                        y: "54",
                        width: "12",
                        height: "72",
                        fill: "url(#paint1_linear_408_139)"
                    })
                ]
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("defs", {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("linearGradient", {
                        id: "paint0_linear_408_139",
                        x1: "109",
                        y1: "116.5",
                        x2: "144.5",
                        y2: "160.5",
                        gradientUnits: "userSpaceOnUse",
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("stop", {
                                stopColor: "white"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("stop", {
                                offset: "1",
                                stopColor: "white",
                                stopOpacity: "0"
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("linearGradient", {
                        id: "paint1_linear_408_139",
                        x1: "121",
                        y1: "54",
                        x2: "120.799",
                        y2: "106.875",
                        gradientUnits: "userSpaceOnUse",
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("stop", {
                                stopColor: "white"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("stop", {
                                offset: "1",
                                stopColor: "white",
                                stopOpacity: "0"
                            })
                        ]
                    })
                ]
            })
        ]
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=FrameworkIcon.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/GroupedStackFrames.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GroupedStackFrames", {
    enumerable: true,
    get: function() {
        return GroupedStackFrames;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _CallStackFrame = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/CallStackFrame.js [app-client] (ecmascript)");
const _CollapseIcon = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/CollapseIcon.js [app-client] (ecmascript)");
const _FrameworkIcon = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/FrameworkIcon.js [app-client] (ecmascript)");
function FrameworkGroup(param) {
    let { framework, stackFrames } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("details", {
        "data-nextjs-collapsed-call-stack-details": true,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("summary", {
                tabIndex: 10,
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(_CollapseIcon.CollapseIcon, {}),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(_FrameworkIcon.FrameworkIcon, {
                        framework: framework
                    }),
                    framework === 'react' ? 'React' : 'Next.js'
                ]
            }),
            stackFrames.map((frame, index)=>/*#__PURE__*/ (0, _jsxruntime.jsx)(_CallStackFrame.CallStackFrame, {
                    frame: frame
                }, "call-stack-" + index))
        ]
    });
}
function GroupedStackFrames(param) {
    let { groupedStackFrames } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
        children: groupedStackFrames.map((stackFramesGroup, groupIndex)=>{
            // Collapse React and Next.js frames
            if (stackFramesGroup.framework) {
                return /*#__PURE__*/ (0, _jsxruntime.jsx)(FrameworkGroup, {
                    framework: stackFramesGroup.framework,
                    stackFrames: stackFramesGroup.stackFrames
                }, "call-stack-framework-group-" + groupIndex);
            }
            return stackFramesGroup.stackFrames.map((frame, frameIndex)=>/*#__PURE__*/ (0, _jsxruntime.jsx)(_CallStackFrame.CallStackFrame, {
                    frame: frame
                }, "call-stack-" + groupIndex + "-" + frameIndex));
        })
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=GroupedStackFrames.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    RuntimeError: null,
    styles: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    RuntimeError: function() {
        return RuntimeError;
    },
    styles: function() {
        return styles;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _CodeFrame = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/CodeFrame/index.js [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
const _groupstackframesbyframework = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/group-stack-frames-by-framework.js [app-client] (ecmascript)");
const _GroupedStackFrames = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/GroupedStackFrames.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  [data-nextjs-call-stack-frame]:not(:last-child),\n  [data-nextjs-component-stack-frame]:not(:last-child) {\n    margin-bottom: var(--size-gap-double);\n  }\n\n  [data-nextjs-data-runtime-error-copy-button],\n  [data-nextjs-data-runtime-error-copy-button]:focus:not(:focus-visible) {\n    position: relative;\n    margin-left: var(--size-gap);\n    padding: 0;\n    border: none;\n    background: none;\n    outline: none;\n  }\n  [data-nextjs-data-runtime-error-copy-button] > svg {\n    vertical-align: middle;\n  }\n  .nextjs-data-runtime-error-copy-button {\n    color: inherit;\n  }\n  .nextjs-data-runtime-error-copy-button--initial:hover {\n    cursor: pointer;\n  }\n  .nextjs-data-runtime-error-copy-button[aria-disabled='true'] {\n    opacity: 0.3;\n    cursor: not-allowed;\n  }\n  .nextjs-data-runtime-error-copy-button--error,\n  .nextjs-data-runtime-error-copy-button--error:hover {\n    color: var(--color-ansi-red);\n  }\n  .nextjs-data-runtime-error-copy-button--success {\n    color: var(--color-ansi-green);\n  }\n\n  [data-nextjs-call-stack-frame] > h3,\n  [data-nextjs-component-stack-frame] > h3 {\n    margin-top: 0;\n    margin-bottom: var(--size-gap);\n    font-family: var(--font-stack-monospace);\n    font-size: var(--size-font);\n    color: #666;\n  }\n  [data-nextjs-call-stack-frame] > h3[data-nextjs-frame-expanded='false'] {\n    color: #666;\n  }\n  [data-nextjs-call-stack-frame] > div,\n  [data-nextjs-component-stack-frame] > div {\n    display: flex;\n    align-items: center;\n    padding-left: calc(var(--size-gap) + var(--size-gap-half));\n    font-size: var(--size-font-small);\n    color: #999;\n  }\n  [data-nextjs-call-stack-frame] > div > svg,\n  [data-nextjs-component-stack-frame] > [role='link'] > svg {\n    width: auto;\n    height: var(--size-font-small);\n    margin-left: var(--size-gap);\n    flex-shrink: 0;\n    display: none;\n  }\n\n  [data-nextjs-call-stack-frame] > div[data-has-source],\n  [data-nextjs-component-stack-frame] > [role='link'] {\n    cursor: pointer;\n  }\n  [data-nextjs-call-stack-frame] > div[data-has-source]:hover,\n  [data-nextjs-component-stack-frame] > [role='link']:hover {\n    text-decoration: underline dotted;\n  }\n  [data-nextjs-call-stack-frame] > div[data-has-source] > svg,\n  [data-nextjs-component-stack-frame] > [role='link'] > svg {\n    display: unset;\n  }\n\n  [data-nextjs-call-stack-framework-icon] {\n    margin-right: var(--size-gap);\n  }\n  [data-nextjs-call-stack-framework-icon='next'] > mask {\n    mask-type: alpha;\n  }\n  [data-nextjs-call-stack-framework-icon='react'] {\n    color: rgb(20, 158, 202);\n  }\n  [data-nextjs-collapsed-call-stack-details][open]\n    [data-nextjs-call-stack-chevron-icon] {\n    transform: rotate(90deg);\n  }\n  [data-nextjs-collapsed-call-stack-details] summary {\n    display: flex;\n    align-items: center;\n    margin-bottom: var(--size-gap);\n    list-style: none;\n  }\n  [data-nextjs-collapsed-call-stack-details] summary::-webkit-details-marker {\n    display: none;\n  }\n\n  [data-nextjs-collapsed-call-stack-details] h3 {\n    color: #666;\n  }\n  [data-nextjs-collapsed-call-stack-details] [data-nextjs-call-stack-frame] {\n    margin-bottom: var(--size-gap-double);\n  }\n\n  [data-nextjs-container-errors-pseudo-html] {\n    position: relative;\n  }\n  [data-nextjs-container-errors-pseudo-html-collapse] {\n    position: absolute;\n    left: 10px;\n    top: 10px;\n    color: inherit;\n    background: none;\n    border: none;\n    padding: 0;\n  }\n  [data-nextjs-container-errors-pseudo-html--diff='add'] {\n    color: var(--color-ansi-green);\n  }\n  [data-nextjs-container-errors-pseudo-html--diff='remove'] {\n    color: var(--color-ansi-red);\n  }\n  [data-nextjs-container-errors-pseudo-html--tag-error] {\n    color: var(--color-ansi-red);\n    font-weight: bold;\n  }\n  /* hide but text are still accessible in DOM */\n  [data-nextjs-container-errors-pseudo-html--hint] {\n    display: inline-block;\n    font-size: 0;\n  }\n  [data-nextjs-container-errors-pseudo-html--tag-adjacent='false'] {\n    color: var(--color-accents-1);\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
function RuntimeError(param) {
    let { error } = param;
    const { firstFrame, allLeadingFrames, allCallStackFrames } = _react.useMemo({
        "RuntimeError.useMemo": ()=>{
            const filteredFrames = error.frames // Filter out nodejs internal frames since you can't do anything about them.
            // e.g. node:internal/timers shows up pretty often due to timers, but not helpful to users.
            // Only present the last line before nodejs internal trace.
            .filter({
                "RuntimeError.useMemo.filteredFrames": (f)=>{
                    var _f_sourceStackFrame_file;
                    return !((_f_sourceStackFrame_file = f.sourceStackFrame.file) == null ? void 0 : _f_sourceStackFrame_file.startsWith('node:'));
                }
            }["RuntimeError.useMemo.filteredFrames"]);
            const firstFirstPartyFrameIndex = filteredFrames.findIndex({
                "RuntimeError.useMemo.firstFirstPartyFrameIndex": (entry)=>entry.expanded && Boolean(entry.originalCodeFrame) && Boolean(entry.originalStackFrame)
            }["RuntimeError.useMemo.firstFirstPartyFrameIndex"]);
            var _filteredFrames_firstFirstPartyFrameIndex;
            return {
                firstFrame: (_filteredFrames_firstFirstPartyFrameIndex = filteredFrames[firstFirstPartyFrameIndex]) != null ? _filteredFrames_firstFirstPartyFrameIndex : null,
                allLeadingFrames: firstFirstPartyFrameIndex < 0 ? [] : filteredFrames.slice(0, firstFirstPartyFrameIndex),
                allCallStackFrames: filteredFrames.slice(firstFirstPartyFrameIndex + 1)
            };
        }
    }["RuntimeError.useMemo"], [
        error.frames
    ]);
    const { leadingFramesGroupedByFramework, stackFramesGroupedByFramework } = _react.useMemo({
        "RuntimeError.useMemo": ()=>{
            const leadingFrames = allLeadingFrames.filter({
                "RuntimeError.useMemo.leadingFrames": (f)=>f.expanded
            }["RuntimeError.useMemo.leadingFrames"]);
            return {
                stackFramesGroupedByFramework: (0, _groupstackframesbyframework.groupStackFramesByFramework)(allCallStackFrames),
                leadingFramesGroupedByFramework: (0, _groupstackframesbyframework.groupStackFramesByFramework)(leadingFrames)
            };
        }
    }["RuntimeError.useMemo"], [
        allCallStackFrames,
        allLeadingFrames
    ]);
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_react.Fragment, {
        children: [
            firstFrame ? /*#__PURE__*/ (0, _jsxruntime.jsxs)(_react.Fragment, {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("h2", {
                        children: "Source"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(_GroupedStackFrames.GroupedStackFrames, {
                        groupedStackFrames: leadingFramesGroupedByFramework
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(_CodeFrame.CodeFrame, {
                        stackFrame: firstFrame.originalStackFrame,
                        codeFrame: firstFrame.originalCodeFrame
                    })
                ]
            }) : undefined,
            stackFramesGroupedByFramework.length ? /*#__PURE__*/ (0, _jsxruntime.jsxs)(_react.Fragment, {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("h2", {
                        children: "Call Stack"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(_GroupedStackFrames.GroupedStackFrames, {
                        groupedStackFrames: stackFramesGroupedByFramework
                    })
                ]
            }) : undefined
        ]
    });
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/component-stack-pseudo-html.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PseudoHtmlDiff", {
    enumerable: true,
    get: function() {
        return PseudoHtmlDiff;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _CollapseIcon = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/CollapseIcon.js [app-client] (ecmascript)");
function getAdjacentProps(isAdj) {
    return {
        'data-nextjs-container-errors-pseudo-html--tag-adjacent': isAdj
    };
}
function PseudoHtmlDiff(param) {
    let { componentStackFrames, firstContent, secondContent, hydrationMismatchType, reactOutputComponentDiff, ...props } = param;
    const isHtmlTagsWarning = hydrationMismatchType === 'tag';
    const isReactHydrationDiff = !!reactOutputComponentDiff;
    // For text mismatch, mismatched text will take 2 rows, so we display 4 rows of component stack
    const MAX_NON_COLLAPSED_FRAMES = isHtmlTagsWarning ? 6 : 4;
    const [isHtmlCollapsed, toggleCollapseHtml] = (0, _react.useState)(true);
    const htmlComponents = (0, _react.useMemo)(()=>{
        const componentStacks = [];
        // React 19 unified mismatch
        if (isReactHydrationDiff) {
            let currentComponentIndex = componentStackFrames.length - 1;
            const reactComponentDiffLines = reactOutputComponentDiff.split('\n');
            const diffHtmlStack = [];
            reactComponentDiffLines.forEach((line, index)=>{
                let trimmedLine = line.trim();
                const isDiffLine = trimmedLine[0] === '+' || trimmedLine[0] === '-';
                const spaces = ' '.repeat(Math.max(componentStacks.length * 2, 1));
                if (isDiffLine) {
                    const sign = trimmedLine[0];
                    trimmedLine = trimmedLine.slice(1).trim() // trim spaces after sign
                    ;
                    diffHtmlStack.push(/*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                        "data-nextjs-container-errors-pseudo-html--diff": sign === '+' ? 'add' : 'remove',
                        children: [
                            sign,
                            spaces,
                            trimmedLine,
                            '\n'
                        ]
                    }, 'comp-diff' + index));
                } else if (currentComponentIndex >= 0) {
                    const isUserLandComponent = trimmedLine.startsWith('<' + componentStackFrames[currentComponentIndex].component);
                    // If it's matched userland component or it's ... we will keep the component stack in diff
                    if (isUserLandComponent || trimmedLine === '...') {
                        currentComponentIndex--;
                        componentStacks.push(/*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                            children: [
                                spaces,
                                trimmedLine,
                                '\n'
                            ]
                        }, 'comp-diff' + index));
                    } else if (!isHtmlCollapsed) {
                        componentStacks.push(/*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                            children: [
                                spaces,
                                trimmedLine,
                                '\n'
                            ]
                        }, 'comp-diff' + index));
                    }
                } else if (!isHtmlCollapsed) {
                    // In general, if it's not collapsed, show the whole diff
                    componentStacks.push(/*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                        children: [
                            spaces,
                            trimmedLine,
                            '\n'
                        ]
                    }, 'comp-diff' + index));
                }
            });
            return componentStacks.concat(diffHtmlStack);
        }
        const nestedHtmlStack = [];
        const tagNames = isHtmlTagsWarning ? [
            firstContent.replace(/<|>/g, ''),
            secondContent.replace(/<|>/g, '')
        ] : [];
        let lastText = '';
        const componentStack = componentStackFrames.map((frame)=>frame.component).reverse();
        // [child index, parent index]
        const matchedIndex = [
            -1,
            -1
        ];
        if (isHtmlTagsWarning) {
            // Reverse search for the child tag
            for(let i = componentStack.length - 1; i >= 0; i--){
                if (componentStack[i] === tagNames[0]) {
                    matchedIndex[0] = i;
                    break;
                }
            }
            // Start searching parent tag from child tag above
            for(let i = matchedIndex[0] - 1; i >= 0; i--){
                if (componentStack[i] === tagNames[1]) {
                    matchedIndex[1] = i;
                    break;
                }
            }
        }
        componentStack.forEach((component, index, componentList)=>{
            const spaces = ' '.repeat(nestedHtmlStack.length * 2);
            // When component is the server or client tag name, highlight it
            const isHighlightedTag = isHtmlTagsWarning ? index === matchedIndex[0] || index === matchedIndex[1] : tagNames.includes(component);
            const isAdjacentTag = isHighlightedTag || Math.abs(index - matchedIndex[0]) <= 1 || Math.abs(index - matchedIndex[1]) <= 1;
            const isLastFewFrames = !isHtmlTagsWarning && index >= componentList.length - 6;
            const adjProps = getAdjacentProps(isAdjacentTag);
            if (isHtmlTagsWarning && isAdjacentTag || isLastFewFrames) {
                const codeLine = /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                    children: [
                        spaces,
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                            ...adjProps,
                            ...isHighlightedTag ? {
                                'data-nextjs-container-errors-pseudo-html--tag-error': true
                            } : undefined,
                            children: "<" + component + ">\n"
                        })
                    ]
                });
                lastText = component;
                const wrappedCodeLine = /*#__PURE__*/ (0, _jsxruntime.jsxs)(_react.Fragment, {
                    children: [
                        codeLine,
                        isHighlightedTag && /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                            "data-nextjs-container-errors-pseudo-html--hint": true,
                            children: spaces + '^'.repeat(component.length + 2) + '\n'
                        })
                    ]
                }, nestedHtmlStack.length);
                nestedHtmlStack.push(wrappedCodeLine);
            } else {
                if (nestedHtmlStack.length >= MAX_NON_COLLAPSED_FRAMES && isHtmlCollapsed) {
                    return;
                }
                if (!isHtmlCollapsed || isLastFewFrames) {
                    nestedHtmlStack.push(/*#__PURE__*/ (0, _react.createElement)("span", {
                        ...adjProps,
                        key: nestedHtmlStack.length,
                        children: [
                            spaces,
                            '<' + component + '>\n'
                        ]
                    }));
                } else if (isHtmlCollapsed && lastText !== '...') {
                    lastText = '...';
                    nestedHtmlStack.push(/*#__PURE__*/ (0, _react.createElement)("span", {
                        ...adjProps,
                        key: nestedHtmlStack.length,
                        children: [
                            spaces,
                            '...\n'
                        ]
                    }));
                }
            }
        });
        // Hydration mismatch: text or text-tag
        if (!isHtmlTagsWarning) {
            const spaces = ' '.repeat(nestedHtmlStack.length * 2);
            let wrappedCodeLine;
            if (hydrationMismatchType === 'text') {
                // hydration type is "text", represent [server content, client content]
                wrappedCodeLine = /*#__PURE__*/ (0, _jsxruntime.jsxs)(_react.Fragment, {
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                            "data-nextjs-container-errors-pseudo-html--diff": "remove",
                            children: spaces + ('"' + firstContent + '"\n')
                        }),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                            "data-nextjs-container-errors-pseudo-html--diff": "add",
                            children: spaces + ('"' + secondContent + '"\n')
                        })
                    ]
                }, nestedHtmlStack.length);
            } else if (hydrationMismatchType === 'text-in-tag') {
                // hydration type is "text-in-tag", represent [parent tag, mismatch content]
                wrappedCodeLine = /*#__PURE__*/ (0, _jsxruntime.jsxs)(_react.Fragment, {
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                            "data-nextjs-container-errors-pseudo-html--tag-adjacent": true,
                            children: spaces + ("<" + secondContent + ">\n")
                        }),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                            "data-nextjs-container-errors-pseudo-html--diff": "remove",
                            children: spaces + ('  "' + firstContent + '"\n')
                        })
                    ]
                }, nestedHtmlStack.length);
            }
            nestedHtmlStack.push(wrappedCodeLine);
        }
        return nestedHtmlStack;
    }, [
        componentStackFrames,
        isHtmlCollapsed,
        firstContent,
        secondContent,
        isHtmlTagsWarning,
        hydrationMismatchType,
        MAX_NON_COLLAPSED_FRAMES,
        isReactHydrationDiff,
        reactOutputComponentDiff
    ]);
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
        "data-nextjs-container-errors-pseudo-html": true,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                tabIndex: 10,
                "data-nextjs-container-errors-pseudo-html-collapse": true,
                onClick: ()=>toggleCollapseHtml(!isHtmlCollapsed),
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_CollapseIcon.CollapseIcon, {
                    collapsed: isHtmlCollapsed
                })
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("pre", {
                ...props,
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)("code", {
                    children: htmlComponents
                })
            })
        ]
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=component-stack-pseudo-html.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/copy-button/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CopyButton", {
    enumerable: true,
    get: function() {
        return CopyButton;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
function useCopyLegacy(content) {
    // This would be simpler with useActionState but we need to support React 18 here.
    // React 18 also doesn't have async transitions.
    const [copyState, dispatch] = _react.useReducer({
        "useCopyLegacy.useReducer": (state, action)=>{
            if (action.type === 'reset') {
                return {
                    state: 'initial'
                };
            }
            if (action.type === 'copied') {
                return {
                    state: 'success'
                };
            }
            if (action.type === 'copying') {
                return {
                    state: 'pending'
                };
            }
            if (action.type === 'error') {
                return {
                    state: 'error',
                    error: action.error
                };
            }
            return state;
        }
    }["useCopyLegacy.useReducer"], {
        state: 'initial'
    });
    function copy() {
        if (isPending) {
            return;
        }
        if (!navigator.clipboard) {
            dispatch({
                type: 'error',
                error: new Error('Copy to clipboard is not supported in this browser')
            });
        } else {
            dispatch({
                type: 'copying'
            });
            navigator.clipboard.writeText(content).then(()=>{
                dispatch({
                    type: 'copied'
                });
            }, (error)=>{
                dispatch({
                    type: 'error',
                    error
                });
            });
        }
    }
    const reset = _react.useCallback({
        "useCopyLegacy.useCallback[reset]": ()=>{
            dispatch({
                type: 'reset'
            });
        }
    }["useCopyLegacy.useCallback[reset]"], []);
    const isPending = copyState.state === 'pending';
    return [
        copyState,
        copy,
        reset,
        isPending
    ];
}
function useCopyModern(content) {
    const [copyState, dispatch, isPending] = _react.useActionState({
        "useCopyModern.useActionState": (state, action)=>{
            if (action === 'reset') {
                return {
                    state: 'initial'
                };
            }
            if (action === 'copy') {
                if (!navigator.clipboard) {
                    return {
                        state: 'error',
                        error: new Error('Copy to clipboard is not supported in this browser')
                    };
                }
                return navigator.clipboard.writeText(content).then({
                    "useCopyModern.useActionState": ()=>{
                        return {
                            state: 'success'
                        };
                    }
                }["useCopyModern.useActionState"], {
                    "useCopyModern.useActionState": (error)=>{
                        return {
                            state: 'error',
                            error
                        };
                    }
                }["useCopyModern.useActionState"]);
            }
            return state;
        }
    }["useCopyModern.useActionState"], {
        state: 'initial'
    });
    function copy() {
        _react.startTransition(()=>{
            dispatch('copy');
        });
    }
    const reset = _react.useCallback({
        "useCopyModern.useCallback[reset]": ()=>{
            dispatch('reset');
        }
    }["useCopyModern.useCallback[reset]"], [
        // TODO: `dispatch` from `useActionState` is not reactive.
        // Remove from dependencies once https://github.com/facebook/react/pull/29665 is released.
        dispatch
    ]);
    return [
        copyState,
        copy,
        reset,
        isPending
    ];
}
const useCopy = typeof _react.useActionState === 'function' ? useCopyModern : useCopyLegacy;
function CopyButton(param) {
    let { actionLabel, successLabel, content, icon, disabled, ...props } = param;
    const [copyState, copy, reset, isPending] = useCopy(content);
    const error = copyState.state === 'error' ? copyState.error : null;
    _react.useEffect({
        "CopyButton.useEffect": ()=>{
            if (error !== null) {
                // Additional console.error to get the stack.
                console.error(error);
            }
        }
    }["CopyButton.useEffect"], [
        error
    ]);
    _react.useEffect({
        "CopyButton.useEffect": ()=>{
            if (copyState.state === 'success') {
                const timeoutId = setTimeout({
                    "CopyButton.useEffect.timeoutId": ()=>{
                        reset();
                    }
                }["CopyButton.useEffect.timeoutId"], 2000);
                return ({
                    "CopyButton.useEffect": ()=>{
                        clearTimeout(timeoutId);
                    }
                })["CopyButton.useEffect"];
            }
        }
    }["CopyButton.useEffect"], [
        isPending,
        copyState.state,
        reset
    ]);
    const isDisabled = isPending || disabled;
    const label = copyState.state === 'success' ? successLabel : actionLabel;
    // Assign default icon
    const renderedIcon = copyState.state === 'success' ? /*#__PURE__*/ (0, _jsxruntime.jsx)(CopySuccessIcon, {}) : icon || /*#__PURE__*/ (0, _jsxruntime.jsx)(CopyIcon, {});
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("button", {
        ...props,
        type: "button",
        title: label,
        "aria-label": label,
        "aria-disabled": isDisabled,
        "data-nextjs-data-runtime-error-copy-button": true,
        className: "nextjs-data-runtime-error-copy-button nextjs-data-runtime-error-copy-button--" + copyState.state,
        onClick: ()=>{
            if (!isDisabled) {
                copy();
            }
        },
        children: [
            renderedIcon,
            copyState.state === 'error' ? " " + copyState.error : null
        ]
    });
}
function CopyIcon() {
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "transparent",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("rect", {
                width: "14",
                height: "14",
                x: "8",
                y: "8",
                rx: "2",
                ry: "2"
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
            })
        ]
    });
}
function CopySuccessIcon() {
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("svg", {
        height: "16",
        xlinkTitle: "copied",
        viewBox: "0 0 16 16",
        width: "16",
        stroke: "currentColor",
        fill: "currentColor",
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
            d: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
        })
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/nodejs-inspector.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NodejsInspectorCopyButton", {
    enumerable: true,
    get: function() {
        return NodejsInspectorCopyButton;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _copybutton = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/copy-button/index.js [app-client] (ecmascript)");
// Inline this helper to avoid widely used across the codebase,
// as for this feature the Chrome detector doesn't need to be super accurate.
function isChrome() {
    if (typeof window === 'undefined') return false;
    const isChromium = 'chrome' in window && window.chrome;
    const vendorName = window.navigator.vendor;
    return isChromium !== null && isChromium !== undefined && vendorName === 'Google Inc.';
}
const isChromeBrowser = isChrome();
function NodeJsIcon(props) {
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
        width: "44",
        height: "44",
        viewBox: "0 0 44 44",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        ...props,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("g", {
                clipPath: "url(#clip0_1546_2)",
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                        d: "M22 0L41.0526 11V33L22 44L2.94744 33V11L22 0Z",
                        fill: "#71BD55"
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                        d: "M41.0493 11.0001L41.0493 33L22 1.5583e-07L41.0493 11.0001Z",
                        fill: "#A1DF83"
                    })
                ]
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("defs", {
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)("clipPath", {
                    id: "clip0_1546_2",
                    children: /*#__PURE__*/ (0, _jsxruntime.jsx)("rect", {
                        width: "44",
                        height: "44",
                        fill: "white"
                    })
                })
            })
        ]
    });
}
function NodeJsDisabledIcon(props) {
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
        width: "44",
        height: "44",
        viewBox: "0 0 44 44",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        ...props,
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                d: "M4.44744 11.866L22 1.73205L39.5526 11.866V32.134L22 42.2679L4.44744 32.134V11.866Z",
                stroke: "currentColor",
                fill: "transparent",
                strokeWidth: "3",
                strokeLinejoin: "round"
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
                d: "M22 2L39 32",
                stroke: "currentColor",
                strokeWidth: "3",
                strokeLinecap: "round"
            })
        ]
    });
}
const label = 'Learn more about enabling Node.js inspector for server code with Chrome DevTools';
function NodejsInspectorCopyButton(param) {
    let { devtoolsFrontendUrl } = param;
    const content = devtoolsFrontendUrl || '';
    const disabled = !content || !isChromeBrowser;
    if (disabled) {
        return /*#__PURE__*/ (0, _jsxruntime.jsx)("a", {
            title: label,
            "aria-label": label,
            className: "nextjs-data-runtime-error-inspect-link",
            href: "https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code",
            target: "_blank",
            rel: "noopener noreferrer",
            children: /*#__PURE__*/ (0, _jsxruntime.jsx)(NodeJsDisabledIcon, {
                width: 16,
                height: 16
            })
        });
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_copybutton.CopyButton, {
        "data-nextjs-data-runtime-error-copy-devtools-url": true,
        actionLabel: 'Copy Chrome DevTools URL',
        successLabel: "Copied",
        content: content,
        icon: /*#__PURE__*/ (0, _jsxruntime.jsx)(NodeJsIcon, {
            width: 16,
            height: 16
        })
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=nodejs-inspector.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/Errors.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    Errors: null,
    styles: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    Errors: function() {
        return Errors;
    },
    styles: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _shared = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/shared.js [app-client] (ecmascript)");
const _Dialog = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/index.js [app-client] (ecmascript)");
const _LeftRightDialogHeader = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/LeftRightDialogHeader/index.js [app-client] (ecmascript)");
const _Overlay = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/index.js [app-client] (ecmascript)");
const _Toast = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/index.js [app-client] (ecmascript)");
const _geterrorbytype = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/get-error-by-type.js [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
const _CloseIcon = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/CloseIcon.js [app-client] (ecmascript)");
const _RuntimeError = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/index.js [app-client] (ecmascript)");
const _VersionStalenessInfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/index.js [app-client] (ecmascript)");
const _errorsource = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/error-source.js [app-client] (ecmascript)");
const _hotlinkedtext = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/hot-linked-text/index.js [app-client] (ecmascript)");
const _componentstackpseudohtml = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/component-stack-pseudo-html.js [app-client] (ecmascript)");
const _hydrationerrorinfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/hydration-error-info.js [app-client] (ecmascript)");
const _nodejsinspector = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/nodejs-inspector.js [app-client] (ecmascript)");
const _copybutton = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/copy-button/index.js [app-client] (ecmascript)");
const _consoleerror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/console-error.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  .nextjs-error-with-static {\n    bottom: calc(var(--size-gap-double) * 4.5);\n  }\n  .nextjs-container-errors-header {\n    position: relative;\n  }\n  .nextjs-container-errors-header > h1 {\n    font-size: var(--size-font-big);\n    line-height: var(--size-font-bigger);\n    font-weight: bold;\n    margin: calc(var(--size-gap-double) * 1.5) 0;\n    color: var(--color-title-h1);\n  }\n  .nextjs-container-errors-header small {\n    font-size: var(--size-font-small);\n    color: var(--color-accents-1);\n    margin-left: var(--size-gap-double);\n  }\n  .nextjs-container-errors-header small > span {\n    font-family: var(--font-stack-monospace);\n  }\n  .nextjs-container-errors-header p {\n    font-size: var(--size-font-small);\n    line-height: var(--size-font-big);\n    white-space: pre-wrap;\n  }\n  .nextjs__container_errors_desc {\n    font-family: var(--font-stack-monospace);\n    padding: var(--size-gap) var(--size-gap-double);\n    border-left: 2px solid var(--color-text-color-red-1);\n    margin-top: var(--size-gap);\n    font-weight: bold;\n    color: var(--color-text-color-red-1);\n    background-color: var(--color-text-background-red-1);\n  }\n  p.nextjs__container_errors__link {\n    margin: var(--size-gap-double) auto;\n    color: var(--color-text-color-red-1);\n    font-weight: 600;\n    font-size: 15px;\n  }\n  p.nextjs__container_errors__notes {\n    margin: var(--size-gap-double) auto;\n    color: var(--color-stack-notes);\n    font-weight: 600;\n    font-size: 15px;\n  }\n  .nextjs-container-errors-header > div > small {\n    margin: 0;\n    margin-top: var(--size-gap-half);\n  }\n  .nextjs-container-errors-header > p > a {\n    color: inherit;\n    font-weight: bold;\n  }\n  .nextjs-container-errors-body > h2:not(:first-child) {\n    margin-top: calc(var(--size-gap-double) + var(--size-gap));\n  }\n  .nextjs-container-errors-body > h2 {\n    color: var(--color-title-color);\n    margin-bottom: var(--size-gap);\n    font-size: var(--size-font-big);\n  }\n  .nextjs__container_errors__component-stack {\n    padding: 12px 32px;\n    color: var(--color-ansi-fg);\n    background: var(--color-ansi-bg);\n  }\n  .nextjs-toast-errors-parent {\n    cursor: pointer;\n    transition: transform 0.2s ease;\n  }\n  .nextjs-toast-errors-parent:hover {\n    transform: scale(1.1);\n  }\n  .nextjs-toast-errors {\n    display: flex;\n    align-items: center;\n    justify-content: flex-start;\n  }\n  .nextjs-toast-errors > svg {\n    margin-right: var(--size-gap);\n  }\n  .nextjs-toast-hide-button {\n    margin-left: var(--size-gap-triple);\n    border: none;\n    background: none;\n    color: var(--color-ansi-bright-white);\n    padding: 0;\n    transition: opacity 0.25s ease;\n    opacity: 0.7;\n  }\n  .nextjs-toast-hide-button:hover {\n    opacity: 1;\n  }\n  .nextjs-container-errors-header\n    > .nextjs-container-build-error-version-status {\n    position: absolute;\n    top: 0;\n    right: 0;\n  }\n  .nextjs__container_errors_inspect_copy_button {\n    cursor: pointer;\n    background: none;\n    border: none;\n    color: var(--color-ansi-bright-white);\n    font-size: 1.5rem;\n    padding: 0;\n    margin: 0;\n    margin-left: var(--size-gap);\n    transition: opacity 0.25s ease;\n  }\n  .nextjs__container_errors__error_title {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n  }\n  .nextjs-data-runtime-error-inspect-link,\n  .nextjs-data-runtime-error-inspect-link:hover {\n    margin: 0 8px;\n    color: inherit;\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
function isNextjsLink(text) {
    return text.startsWith('https://nextjs.org');
}
function ErrorDescription(param) {
    let { error, hydrationWarning } = param;
    const isUnhandledOrReplayError = (0, _consoleerror.isUnhandledConsoleOrRejection)(error);
    // If the error is:
    // - hydration warning
    // - captured console error or unhandled rejection
    // skip displaying the error name
    const title = isUnhandledOrReplayError || hydrationWarning ? '' : error.name + ': ';
    // If it's replayed error, display the environment name
    const environmentName = 'environmentName' in error ? error['environmentName'] : '';
    const envPrefix = environmentName ? "[ " + environmentName + " ] " : '';
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
        children: [
            envPrefix,
            title,
            /*#__PURE__*/ (0, _jsxruntime.jsx)(_hotlinkedtext.HotlinkedText, {
                text: hydrationWarning || error.message,
                matcher: isNextjsLink
            })
        ]
    });
}
function getErrorSignature(ev) {
    const { event } = ev;
    switch(event.type){
        case _shared.ACTION_UNHANDLED_ERROR:
        case _shared.ACTION_UNHANDLED_REJECTION:
            {
                return event.reason.name + "::" + event.reason.message + "::" + event.reason.stack;
            }
        default:
            {}
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = event;
    return '';
}
function Errors(param) {
    let { isAppDir, errors, initialDisplayState, versionInfo, hasStaticIndicator, debugInfo } = param;
    var _activeError_componentStackFrames;
    const [lookups, setLookups] = (0, _react.useState)({});
    const [readyErrors, nextError] = (0, _react.useMemo)(()=>{
        let ready = [];
        let next = null;
        // Ensure errors are displayed in the order they occurred in:
        for(let idx = 0; idx < errors.length; ++idx){
            const e = errors[idx];
            const { id } = e;
            if (id in lookups) {
                ready.push(lookups[id]);
                continue;
            }
            // Check for duplicate errors
            if (idx > 0) {
                const prev = errors[idx - 1];
                if (getErrorSignature(prev) === getErrorSignature(e)) {
                    continue;
                }
            }
            next = e;
            break;
        }
        return [
            ready,
            next
        ];
    }, [
        errors,
        lookups
    ]);
    const isLoading = (0, _react.useMemo)(()=>{
        return readyErrors.length < 1 && Boolean(errors.length);
    }, [
        errors.length,
        readyErrors.length
    ]);
    (0, _react.useEffect)(()=>{
        if (nextError == null) {
            return;
        }
        let mounted = true;
        (0, _geterrorbytype.getErrorByType)(nextError, isAppDir).then((resolved)=>{
            // We don't care if the desired error changed while we were resolving,
            // thus we're not tracking it using a ref. Once the work has been done,
            // we'll store it.
            if (mounted) {
                setLookups((m)=>({
                        ...m,
                        [resolved.id]: resolved
                    }));
            }
        }, ()=>{
        // TODO: handle this, though an edge case
        });
        return ()=>{
            mounted = false;
        };
    }, [
        nextError,
        isAppDir
    ]);
    const [displayState, setDisplayState] = (0, _react.useState)(initialDisplayState);
    const [activeIdx, setActiveIndex] = (0, _react.useState)(0);
    const previous = (0, _react.useCallback)(()=>setActiveIndex((v)=>Math.max(0, v - 1)), []);
    const next = (0, _react.useCallback)(()=>setActiveIndex((v)=>Math.max(0, Math.min(readyErrors.length - 1, v + 1))), [
        readyErrors.length
    ]);
    const activeError = (0, _react.useMemo)(()=>{
        var _readyErrors_activeIdx;
        return (_readyErrors_activeIdx = readyErrors[activeIdx]) != null ? _readyErrors_activeIdx : null;
    }, [
        activeIdx,
        readyErrors
    ]);
    // Reset component state when there are no errors to be displayed.
    // This should never happen, but lets handle it.
    (0, _react.useEffect)(()=>{
        if (errors.length < 1) {
            setLookups({});
            setDisplayState('hidden');
            setActiveIndex(0);
        }
    }, [
        errors.length
    ]);
    const minimize = (0, _react.useCallback)(()=>setDisplayState('minimized'), []);
    const hide = (0, _react.useCallback)(()=>setDisplayState('hidden'), []);
    const fullscreen = (0, _react.useCallback)(()=>setDisplayState('fullscreen'), []);
    // This component shouldn't be rendered with no errors, but if it is, let's
    // handle it gracefully by rendering nothing.
    if (errors.length < 1 || activeError == null) {
        return null;
    }
    if (isLoading) {
        // TODO: better loading state
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(_Overlay.Overlay, {});
    }
    if (displayState === 'hidden') {
        return null;
    }
    if (displayState === 'minimized') {
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(_Toast.Toast, {
            "data-nextjs-toast": true,
            className: "nextjs-toast-errors-parent" + (hasStaticIndicator ? ' nextjs-error-with-static' : ''),
            onClick: fullscreen,
            children: /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                className: "nextjs-toast-errors",
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("svg", {
                        xmlns: "http://www.w3.org/2000/svg",
                        width: "24",
                        height: "24",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("circle", {
                                cx: "12",
                                cy: "12",
                                r: "10"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("line", {
                                x1: "12",
                                y1: "8",
                                x2: "12",
                                y2: "12"
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("line", {
                                x1: "12",
                                y1: "16",
                                x2: "12.01",
                                y2: "16"
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                        children: [
                            readyErrors.length,
                            " error",
                            readyErrors.length > 1 ? 's' : ''
                        ]
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                        "data-nextjs-toast-errors-hide-button": true,
                        className: "nextjs-toast-hide-button",
                        type: "button",
                        onClick: (e)=>{
                            e.stopPropagation();
                            hide();
                        },
                        "aria-label": "Hide Errors",
                        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_CloseIcon.CloseIcon, {})
                    })
                ]
            })
        });
    }
    const error = activeError.error;
    const isServerError = [
        'server',
        'edge-server'
    ].includes((0, _errorsource.getErrorSource)(error) || '');
    const isUnhandledError = (0, _consoleerror.isUnhandledConsoleOrRejection)(error);
    const errorDetails = error.details || {};
    const notes = errorDetails.notes || '';
    const [warningTemplate, serverContent, clientContent] = errorDetails.warning || [
        null,
        '',
        ''
    ];
    const hydrationErrorType = (0, _hydrationerrorinfo.getHydrationWarningType)(warningTemplate);
    const hydrationWarning = warningTemplate ? warningTemplate.replace('%s', serverContent).replace('%s', clientContent).replace('%s', '') // remove the %s for stack
    .replace(/%s$/, '') // If there's still a %s at the end, remove it
    .replace(/^Warning: /, '').replace(/^Error: /, '') : null;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_Overlay.Overlay, {
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_Dialog.Dialog, {
            type: "error",
            "aria-labelledby": "nextjs__container_errors_label",
            "aria-describedby": "nextjs__container_errors_desc",
            onClose: isServerError ? undefined : minimize,
            children: /*#__PURE__*/ (0, _jsxruntime.jsxs)(_Dialog.DialogContent, {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsxs)(_Dialog.DialogHeader, {
                        className: "nextjs-container-errors-header",
                        children: [
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)(_LeftRightDialogHeader.LeftRightDialogHeader, {
                                previous: activeIdx > 0 ? previous : null,
                                next: activeIdx < readyErrors.length - 1 ? next : null,
                                close: isServerError ? undefined : minimize,
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("small", {
                                        children: [
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                                children: activeIdx + 1
                                            }),
                                            " of",
                                            ' ',
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)("span", {
                                                "data-nextjs-dialog-header-total-count": true,
                                                children: readyErrors.length
                                            }),
                                            ' error',
                                            readyErrors.length < 2 ? '' : 's'
                                        ]
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)(_VersionStalenessInfo.VersionStalenessInfo, {
                                        versionInfo: versionInfo
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                                className: "nextjs__container_errors__error_title",
                                children: [
                                    /*#__PURE__*/ (0, _jsxruntime.jsx)("h1", {
                                        id: "nextjs__container_errors_label",
                                        className: "nextjs__container_errors_label",
                                        children: isServerError ? 'Server Error' : isUnhandledError ? 'Console Error' : 'Unhandled Runtime Error'
                                    }),
                                    /*#__PURE__*/ (0, _jsxruntime.jsxs)("span", {
                                        children: [
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)(_copybutton.CopyButton, {
                                                "data-nextjs-data-runtime-error-copy-stack": true,
                                                actionLabel: "Copy error stack",
                                                successLabel: "Copied",
                                                content: error.stack || '',
                                                disabled: !error.stack
                                            }),
                                            /*#__PURE__*/ (0, _jsxruntime.jsx)(_nodejsinspector.NodejsInspectorCopyButton, {
                                                devtoolsFrontendUrl: debugInfo == null ? void 0 : debugInfo.devtoolsFrontendUrl
                                            })
                                        ]
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, _jsxruntime.jsx)("p", {
                                id: "nextjs__container_errors_desc",
                                className: "nextjs__container_errors_desc",
                                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(ErrorDescription, {
                                    error: error,
                                    hydrationWarning: hydrationWarning
                                })
                            }),
                            notes ? /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
                                children: /*#__PURE__*/ (0, _jsxruntime.jsx)("p", {
                                    id: "nextjs__container_errors__notes",
                                    className: "nextjs__container_errors__notes",
                                    children: notes
                                })
                            }) : null,
                            hydrationWarning ? /*#__PURE__*/ (0, _jsxruntime.jsx)("p", {
                                id: "nextjs__container_errors__link",
                                className: "nextjs__container_errors__link",
                                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_hotlinkedtext.HotlinkedText, {
                                    text: "See more info here: https://nextjs.org/docs/messages/react-hydration-error"
                                })
                            }) : null,
                            hydrationWarning && (((_activeError_componentStackFrames = activeError.componentStackFrames) == null ? void 0 : _activeError_componentStackFrames.length) || !!errorDetails.reactOutputComponentDiff) ? /*#__PURE__*/ (0, _jsxruntime.jsx)(_componentstackpseudohtml.PseudoHtmlDiff, {
                                className: "nextjs__container_errors__component-stack",
                                hydrationMismatchType: hydrationErrorType,
                                componentStackFrames: activeError.componentStackFrames || [],
                                firstContent: serverContent,
                                secondContent: clientContent,
                                reactOutputComponentDiff: errorDetails.reactOutputComponentDiff
                            }) : null,
                            isServerError ? /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                                children: /*#__PURE__*/ (0, _jsxruntime.jsx)("small", {
                                    children: "This error happened while generating the page. Any console logs will be displayed in the terminal window."
                                })
                            }) : undefined
                        ]
                    }),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(_Dialog.DialogBody, {
                        className: "nextjs-container-errors-body",
                        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_RuntimeError.RuntimeError, {
                            error: activeError
                        }, activeError.id.toString())
                    })
                ]
            })
        })
    });
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=Errors.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/LightningBolt.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LightningBolt", {
    enumerable: true,
    get: function() {
        return LightningBolt;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const LightningBolt = (props)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        width: 16,
        height: 16,
        fill: "none",
        ...props,
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)("path", {
            style: {
                fill: 'var(--color-font)'
            },
            fillRule: "evenodd",
            d: "M7.157 0 2.333 9.408l-.56 1.092H7a.25.25 0 0 1 .25.25V16h1.593l4.824-9.408.56-1.092H9a.25.25 0 0 1-.25-.25V0H7.157ZM7 9H4.227L7.25 3.106V5.25C7.25 6.216 8.034 7 9 7h2.773L8.75 12.894V10.75A1.75 1.75 0 0 0 7 9Z",
            clipRule: "evenodd"
        })
    });
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=LightningBolt.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/StaticIndicator.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "StaticIndicator", {
    enumerable: true,
    get: function() {
        return StaticIndicator;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _Toast = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/index.js [app-client] (ecmascript)");
const _LightningBolt = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/LightningBolt.js [app-client] (ecmascript)");
const _CloseIcon = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/icons/CloseIcon.js [app-client] (ecmascript)");
function StaticIndicator(param) {
    let { dispatcher } = param;
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_Toast.Toast, {
        role: "status",
        className: "nextjs-static-indicator-toast-wrapper",
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)("div", {
                className: "nextjs-static-indicator-toast-icon",
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_LightningBolt.LightningBolt, {})
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("div", {
                className: "nextjs-static-indicator-toast-text",
                children: [
                    "Static route",
                    /*#__PURE__*/ (0, _jsxruntime.jsx)("button", {
                        onClick: ()=>{
                            var _localStorage;
                            // When dismissed, we hide the indicator for 1 hour. Store the
                            // timestamp for when to show it again.
                            const oneHourAway = Date.now() + 1 * 60 * 60 * 1000;
                            (_localStorage = localStorage) == null ? void 0 : _localStorage.setItem('__NEXT_DISMISS_PRERENDER_INDICATOR', oneHourAway.toString());
                            dispatcher == null ? void 0 : dispatcher.onStaticIndicator(false);
                        },
                        className: "nextjs-toast-hide-button",
                        "aria-label": "Hide static indicator",
                        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_CloseIcon.CloseIcon, {})
                    })
                ]
            })
        ]
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=StaticIndicator.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/styles/Base.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Base", {
    enumerable: true,
    get: function() {
        return Base;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n        :host {\n          --size-gap-half: 4px;\n          --size-gap: 8px;\n          --size-gap-double: 16px;\n          --size-gap-triple: 24px;\n          --size-gap-quad: 32px;\n\n          --size-font-small: 14px;\n          --size-font: 16px;\n          --size-font-big: 20px;\n          --size-font-bigger: 24px;\n\n          --color-background: white;\n          --color-font: #757575;\n          --color-backdrop: rgba(17, 17, 17, 0.2);\n          --color-border-shadow: rgba(0, 0, 0, 0.145);\n\n          --color-title-color: #1f1f1f;\n          --color-stack-h6: #222;\n          --color-stack-headline: #666;\n          --color-stack-subline: #999;\n          --color-stack-notes: #777;\n\n          --color-accents-1: #808080;\n          --color-accents-2: #222222;\n          --color-accents-3: #404040;\n\n          --color-text-color-red-1: #ff5555;\n          --color-text-background-red-1: #fff9f9;\n\n          --font-stack-monospace: 'SFMono-Regular', Consolas, 'Liberation Mono',\n            Menlo, Courier, monospace;\n          --font-stack-sans: -apple-system, 'Source Sans Pro', sans-serif;\n\n          --color-ansi-selection: rgba(95, 126, 151, 0.48);\n          --color-ansi-bg: #111111;\n          --color-ansi-fg: #cccccc;\n\n          --color-ansi-white: #777777;\n          --color-ansi-black: #141414;\n          --color-ansi-blue: #00aaff;\n          --color-ansi-cyan: #88ddff;\n          --color-ansi-green: #98ec65;\n          --color-ansi-magenta: #aa88ff;\n          --color-ansi-red: #ff5555;\n          --color-ansi-yellow: #ffcc33;\n          --color-ansi-bright-white: #ffffff;\n          --color-ansi-bright-black: #777777;\n          --color-ansi-bright-blue: #33bbff;\n          --color-ansi-bright-cyan: #bbecff;\n          --color-ansi-bright-green: #b6f292;\n          --color-ansi-bright-magenta: #cebbff;\n          --color-ansi-bright-red: #ff8888;\n          --color-ansi-bright-yellow: #ffd966;\n        }\n\n        @media (prefers-color-scheme: dark) {\n          :host {\n            --color-background: rgb(28, 28, 30);\n            --color-font: white;\n            --color-backdrop: rgb(44, 44, 46);\n            --color-border-shadow: rgba(255, 255, 255, 0.145);\n\n            --color-title-color: #fafafa;\n            --color-stack-h6: rgb(200, 200, 204);\n            --color-stack-headline: rgb(99, 99, 102);\n            --color-stack-notes: #a9a9a9;\n            --color-stack-subline: rgb(121, 121, 121);\n\n            --color-accents-3: rgb(118, 118, 118);\n\n            --color-text-background-red-1: #2a1e1e;\n          }\n        }\n\n        .mono {\n          font-family: var(--font-stack-monospace);\n        }\n\n        h1,\n        h2,\n        h3,\n        h4,\n        h5,\n        h6 {\n          margin-bottom: var(--size-gap);\n          font-weight: 500;\n          line-height: 1.5;\n        }\n      "
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
function Base() {
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("style", {
        children: (0, _nooptemplate.noop)(_templateObject())
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=Base.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/CodeFrame/styles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "styles", {
    enumerable: true,
    get: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  [data-nextjs-codeframe] {\n    overflow: auto;\n    border-radius: var(--size-gap-half);\n    background-color: var(--color-ansi-bg);\n    color: var(--color-ansi-fg);\n  }\n  [data-nextjs-codeframe]::selection,\n  [data-nextjs-codeframe] *::selection {\n    background-color: var(--color-ansi-selection);\n  }\n  [data-nextjs-codeframe] * {\n    color: inherit;\n    background-color: transparent;\n    font-family: var(--font-stack-monospace);\n  }\n\n  [data-nextjs-codeframe] > * {\n    margin: 0;\n    padding: calc(var(--size-gap) + var(--size-gap-half))\n      calc(var(--size-gap-double) + var(--size-gap-half));\n  }\n  [data-nextjs-codeframe] > div {\n    display: inline-block;\n    width: auto;\n    min-width: 100%;\n    border-bottom: 1px solid var(--color-ansi-bright-black);\n  }\n  [data-nextjs-codeframe] > div > p {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    cursor: pointer;\n    margin: 0;\n  }\n  [data-nextjs-codeframe] > div > p:hover {\n    text-decoration: underline dotted;\n  }\n  [data-nextjs-codeframe] div > p > svg {\n    width: auto;\n    height: 1em;\n    margin-left: 8px;\n  }\n  [data-nextjs-codeframe] div > pre {\n    overflow: hidden;\n    display: inline-block;\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=styles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/styles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "styles", {
    enumerable: true,
    get: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  [data-nextjs-dialog-overlay] {\n    position: fixed;\n    top: 0;\n    right: 0;\n    bottom: 0;\n    left: 0;\n    overflow: auto;\n    z-index: 9000;\n\n    display: flex;\n    align-content: center;\n    align-items: center;\n    flex-direction: column;\n    padding: 10vh 15px 0;\n  }\n\n  @media (max-height: 812px) {\n    [data-nextjs-dialog-overlay] {\n      padding: 15px 15px 0;\n    }\n  }\n\n  [data-nextjs-dialog-backdrop] {\n    position: fixed;\n    top: 0;\n    right: 0;\n    bottom: 0;\n    left: 0;\n    background-color: var(--color-backdrop);\n    pointer-events: all;\n    z-index: -1;\n  }\n\n  [data-nextjs-dialog-backdrop-fixed] {\n    cursor: not-allowed;\n    -webkit-backdrop-filter: blur(8px);\n    backdrop-filter: blur(8px);\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=styles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/styles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "styles", {
    enumerable: true,
    get: function() {
        return styles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n  [data-nextjs-terminal] {\n    border-radius: var(--size-gap-half);\n    background-color: var(--color-ansi-bg);\n    color: var(--color-ansi-fg);\n  }\n  [data-nextjs-terminal]::selection,\n  [data-nextjs-terminal] *::selection {\n    background-color: var(--color-ansi-selection);\n  }\n  [data-nextjs-terminal] * {\n    color: inherit;\n    background-color: transparent;\n    font-family: var(--font-stack-monospace);\n  }\n  [data-nextjs-terminal] > * {\n    margin: 0;\n    padding: calc(var(--size-gap) + var(--size-gap-half))\n      calc(var(--size-gap-double) + var(--size-gap-half));\n  }\n\n  [data-nextjs-terminal] pre {\n    white-space: pre-wrap;\n    word-break: break-word;\n  }\n\n  [data-with-open-in-editor-link] svg {\n    width: auto;\n    height: var(--size-font-small);\n    margin-left: var(--size-gap);\n  }\n  [data-with-open-in-editor-link] {\n    cursor: pointer;\n  }\n  [data-with-open-in-editor-link]:hover {\n    text-decoration: underline dotted;\n  }\n  [data-with-open-in-editor-link-source-file] {\n    border-bottom: 1px solid var(--color-ansi-bright-black);\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    line-break: anywhere;\n  }\n  [data-with-open-in-editor-link-import-trace] {\n    margin-left: var(--size-gap-double);\n  }\n  [data-nextjs-terminal] a {\n    color: inherit;\n  }\n"
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
const styles = (0, _nooptemplate.noop)(_templateObject());
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=styles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/styles/ComponentStyles.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ComponentStyles", {
    enumerable: true,
    get: function() {
        return ComponentStyles;
    }
});
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _styles = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/CodeFrame/styles.js [app-client] (ecmascript)");
const _Dialog = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/index.js [app-client] (ecmascript)");
const _styles1 = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/LeftRightDialogHeader/styles.js [app-client] (ecmascript)");
const _styles2 = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/styles.js [app-client] (ecmascript)");
const _styles3 = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Terminal/styles.js [app-client] (ecmascript)");
const _Toast = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Toast/index.js [app-client] (ecmascript)");
const _VersionStalenessInfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/index.js [app-client] (ecmascript)");
const _BuildError = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/BuildError.js [app-client] (ecmascript)");
const _Errors = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/Errors.js [app-client] (ecmascript)");
const _RuntimeError = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/RuntimeError/index.js [app-client] (ecmascript)");
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n        ",
        "\n        ",
        "\n        ",
        "\n        ",
        "\n        ",
        "\n        ",
        "\n        ",
        "\n        ",
        "\n        ",
        "\n        ",
        "\n      "
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
function ComponentStyles() {
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("style", {
        children: (0, _nooptemplate.noop)(_templateObject(), _styles2.styles, _Toast.styles, _Dialog.styles, _styles1.styles, _styles.styles, _styles3.styles, _BuildError.styles, _Errors.styles, _RuntimeError.styles, _VersionStalenessInfo.styles)
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=ComponentStyles.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/styles/CssReset.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CssReset", {
    enumerable: true,
    get: function() {
        return CssReset;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _tagged_template_literal_loose = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_tagged_template_literal_loose.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _nooptemplate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/noop-template.js [app-client] (ecmascript)");
function _templateObject() {
    const data = _tagged_template_literal_loose._([
        "\n        :host {\n          all: initial;\n\n          /* the direction property is not reset by 'all' */\n          direction: ltr;\n        }\n\n        /*!\n         * Bootstrap Reboot v4.4.1 (https://getbootstrap.com/)\n         * Copyright 2011-2019 The Bootstrap Authors\n         * Copyright 2011-2019 Twitter, Inc.\n         * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)\n         * Forked from Normalize.css, licensed MIT (https://github.com/necolas/normalize.css/blob/master/LICENSE.md)\n         */\n        *,\n        *::before,\n        *::after {\n          box-sizing: border-box;\n        }\n\n        :host {\n          font-family: sans-serif;\n          line-height: 1.15;\n          -webkit-text-size-adjust: 100%;\n          -webkit-tap-highlight-color: rgba(0, 0, 0, 0);\n        }\n\n        article,\n        aside,\n        figcaption,\n        figure,\n        footer,\n        header,\n        hgroup,\n        main,\n        nav,\n        section {\n          display: block;\n        }\n\n        :host {\n          margin: 0;\n          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,\n            'Helvetica Neue', Arial, 'Noto Sans', sans-serif,\n            'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',\n            'Noto Color Emoji';\n          font-size: 16px;\n          font-weight: 400;\n          line-height: 1.5;\n          color: var(--color-font);\n          text-align: left;\n          background-color: #fff;\n        }\n\n        [tabindex='-1']:focus:not(:focus-visible) {\n          outline: 0 !important;\n        }\n\n        hr {\n          box-sizing: content-box;\n          height: 0;\n          overflow: visible;\n        }\n\n        h1,\n        h2,\n        h3,\n        h4,\n        h5,\n        h6 {\n          margin-top: 0;\n          margin-bottom: 8px;\n        }\n\n        p {\n          margin-top: 0;\n          margin-bottom: 16px;\n        }\n\n        abbr[title],\n        abbr[data-original-title] {\n          text-decoration: underline;\n          -webkit-text-decoration: underline dotted;\n          text-decoration: underline dotted;\n          cursor: help;\n          border-bottom: 0;\n          -webkit-text-decoration-skip-ink: none;\n          text-decoration-skip-ink: none;\n        }\n\n        address {\n          margin-bottom: 16px;\n          font-style: normal;\n          line-height: inherit;\n        }\n\n        ol,\n        ul,\n        dl {\n          margin-top: 0;\n          margin-bottom: 16px;\n        }\n\n        ol ol,\n        ul ul,\n        ol ul,\n        ul ol {\n          margin-bottom: 0;\n        }\n\n        dt {\n          font-weight: 700;\n        }\n\n        dd {\n          margin-bottom: 8px;\n          margin-left: 0;\n        }\n\n        blockquote {\n          margin: 0 0 16px;\n        }\n\n        b,\n        strong {\n          font-weight: bolder;\n        }\n\n        small {\n          font-size: 80%;\n        }\n\n        sub,\n        sup {\n          position: relative;\n          font-size: 75%;\n          line-height: 0;\n          vertical-align: baseline;\n        }\n\n        sub {\n          bottom: -0.25em;\n        }\n\n        sup {\n          top: -0.5em;\n        }\n\n        a {\n          color: #007bff;\n          text-decoration: none;\n          background-color: transparent;\n        }\n\n        a:hover {\n          color: #0056b3;\n          text-decoration: underline;\n        }\n\n        a:not([href]) {\n          color: inherit;\n          text-decoration: none;\n        }\n\n        a:not([href]):hover {\n          color: inherit;\n          text-decoration: none;\n        }\n\n        pre,\n        code,\n        kbd,\n        samp {\n          font-family: SFMono-Regular, Menlo, Monaco, Consolas,\n            'Liberation Mono', 'Courier New', monospace;\n          font-size: 1em;\n        }\n\n        pre {\n          margin-top: 0;\n          margin-bottom: 16px;\n          overflow: auto;\n        }\n\n        figure {\n          margin: 0 0 16px;\n        }\n\n        img {\n          vertical-align: middle;\n          border-style: none;\n        }\n\n        svg {\n          overflow: hidden;\n          vertical-align: middle;\n        }\n\n        table {\n          border-collapse: collapse;\n        }\n\n        caption {\n          padding-top: 12px;\n          padding-bottom: 12px;\n          color: #6c757d;\n          text-align: left;\n          caption-side: bottom;\n        }\n\n        th {\n          text-align: inherit;\n        }\n\n        label {\n          display: inline-block;\n          margin-bottom: 8px;\n        }\n\n        button {\n          border-radius: 0;\n        }\n\n        button:focus {\n          outline: 1px dotted;\n          outline: 5px auto -webkit-focus-ring-color;\n        }\n\n        input,\n        button,\n        select,\n        optgroup,\n        textarea {\n          margin: 0;\n          font-family: inherit;\n          font-size: inherit;\n          line-height: inherit;\n        }\n\n        button,\n        input {\n          overflow: visible;\n        }\n\n        button,\n        select {\n          text-transform: none;\n        }\n\n        select {\n          word-wrap: normal;\n        }\n\n        button,\n        [type='button'],\n        [type='reset'],\n        [type='submit'] {\n          -webkit-appearance: button;\n        }\n\n        button:not(:disabled),\n        [type='button']:not(:disabled),\n        [type='reset']:not(:disabled),\n        [type='submit']:not(:disabled) {\n          cursor: pointer;\n        }\n\n        button::-moz-focus-inner,\n        [type='button']::-moz-focus-inner,\n        [type='reset']::-moz-focus-inner,\n        [type='submit']::-moz-focus-inner {\n          padding: 0;\n          border-style: none;\n        }\n\n        input[type='radio'],\n        input[type='checkbox'] {\n          box-sizing: border-box;\n          padding: 0;\n        }\n\n        input[type='date'],\n        input[type='time'],\n        input[type='datetime-local'],\n        input[type='month'] {\n          -webkit-appearance: listbox;\n        }\n\n        textarea {\n          overflow: auto;\n          resize: vertical;\n        }\n\n        fieldset {\n          min-width: 0;\n          padding: 0;\n          margin: 0;\n          border: 0;\n        }\n\n        legend {\n          display: block;\n          width: 100%;\n          max-width: 100%;\n          padding: 0;\n          margin-bottom: 8px;\n          font-size: 24px;\n          line-height: inherit;\n          color: inherit;\n          white-space: normal;\n        }\n\n        progress {\n          vertical-align: baseline;\n        }\n\n        [type='number']::-webkit-inner-spin-button,\n        [type='number']::-webkit-outer-spin-button {\n          height: auto;\n        }\n\n        [type='search'] {\n          outline-offset: -2px;\n          -webkit-appearance: none;\n        }\n\n        [type='search']::-webkit-search-decoration {\n          -webkit-appearance: none;\n        }\n\n        ::-webkit-file-upload-button {\n          font: inherit;\n          -webkit-appearance: button;\n        }\n\n        output {\n          display: inline-block;\n        }\n\n        summary {\n          display: list-item;\n          cursor: pointer;\n        }\n\n        template {\n          display: none;\n        }\n\n        [hidden] {\n          display: none !important;\n        }\n      "
    ]);
    _templateObject = function() {
        return data;
    };
    return data;
}
function CssReset() {
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("style", {
        children: (0, _nooptemplate.noop)(_templateObject())
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=CssReset.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/root-layout-missing-tags-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RootLayoutMissingTagsError", {
    enumerable: true,
    get: function() {
        return RootLayoutMissingTagsError;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _Dialog = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Dialog/index.js [app-client] (ecmascript)");
const _Overlay = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/Overlay/index.js [app-client] (ecmascript)");
const _VersionStalenessInfo = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/VersionStalenessInfo/index.js [app-client] (ecmascript)");
const _hotlinkedtext = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/hot-linked-text/index.js [app-client] (ecmascript)");
const RootLayoutMissingTagsError = function RootLayoutMissingTagsError(param) {
    let { missingTags, versionInfo } = param;
    const noop = _react.useCallback({
        "RootLayoutMissingTagsError.useCallback[noop]": ()=>{}
    }["RootLayoutMissingTagsError.useCallback[noop]"], []);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_Overlay.Overlay, {
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_Dialog.Dialog, {
            type: "error",
            "aria-labelledby": "nextjs__container_errors_label",
            "aria-describedby": "nextjs__container_errors_desc",
            onClose: noop,
            children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_Dialog.DialogContent, {
                children: /*#__PURE__*/ (0, _jsxruntime.jsxs)(_Dialog.DialogHeader, {
                    className: "nextjs-container-errors-header",
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsx)(_VersionStalenessInfo.VersionStalenessInfo, {
                            versionInfo: versionInfo
                        }),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("h1", {
                            id: "nextjs__container_errors_label",
                            className: "nextjs__container_errors_label",
                            children: "Missing required html tags"
                        }),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("p", {
                            id: "nextjs__container_errors_desc",
                            className: "nextjs__container_errors_desc",
                            children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_hotlinkedtext.HotlinkedText, {
                                text: "The following tags are missing in the Root Layout: " + missingTags.map((tagName)=>"<" + tagName + ">").join(', ') + ".\nRead more at https://nextjs.org/docs/messages/missing-root-layout-tags"
                            })
                        })
                    ]
                })
            })
        })
    });
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=root-layout-missing-tags-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/runtime-error-handler.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RuntimeErrorHandler", {
    enumerable: true,
    get: function() {
        return RuntimeErrorHandler;
    }
});
const RuntimeErrorHandler = {
    hadRuntimeError: false
};
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=runtime-error-handler.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return ReactDevOverlay;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _ShadowPortal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/components/ShadowPortal.js [app-client] (ecmascript)");
const _BuildError = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/BuildError.js [app-client] (ecmascript)");
const _Errors = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/Errors.js [app-client] (ecmascript)");
const _StaticIndicator = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/StaticIndicator.js [app-client] (ecmascript)");
const _Base = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/styles/Base.js [app-client] (ecmascript)");
const _ComponentStyles = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/styles/ComponentStyles.js [app-client] (ecmascript)");
const _CssReset = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/styles/CssReset.js [app-client] (ecmascript)");
const _rootlayoutmissingtagserror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/container/root-layout-missing-tags-error.js [app-client] (ecmascript)");
const _runtimeerrorhandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/runtime-error-handler.js [app-client] (ecmascript)");
class ReactDevOverlay extends _react.default.PureComponent {
    static getDerivedStateFromError(error) {
        if (!error.stack) return {
            isReactError: false
        };
        _runtimeerrorhandler.RuntimeErrorHandler.hadRuntimeError = true;
        return {
            isReactError: true
        };
    }
    render() {
        var _state_rootLayoutMissingTags;
        const { state, children, dispatcher } = this.props;
        const { isReactError } = this.state;
        const hasBuildError = state.buildError != null;
        const hasRuntimeErrors = Boolean(state.errors.length);
        const hasStaticIndicator = state.staticIndicator;
        const debugInfo = state.debugInfo;
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
            children: [
                isReactError ? /*#__PURE__*/ (0, _jsxruntime.jsxs)("html", {
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("head", {}),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("body", {})
                    ]
                }) : children,
                /*#__PURE__*/ (0, _jsxruntime.jsxs)(_ShadowPortal.ShadowPortal, {
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsx)(_CssReset.CssReset, {}),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)(_Base.Base, {}),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)(_ComponentStyles.ComponentStyles, {}),
                        ((_state_rootLayoutMissingTags = state.rootLayoutMissingTags) == null ? void 0 : _state_rootLayoutMissingTags.length) ? /*#__PURE__*/ (0, _jsxruntime.jsx)(_rootlayoutmissingtagserror.RootLayoutMissingTagsError, {
                            missingTags: state.rootLayoutMissingTags
                        }) : hasBuildError ? /*#__PURE__*/ (0, _jsxruntime.jsx)(_BuildError.BuildError, {
                            message: state.buildError,
                            versionInfo: state.versionInfo
                        }) : /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                            children: [
                                hasRuntimeErrors ? /*#__PURE__*/ (0, _jsxruntime.jsx)(_Errors.Errors, {
                                    isAppDir: true,
                                    initialDisplayState: isReactError ? 'fullscreen' : 'minimized',
                                    errors: state.errors,
                                    versionInfo: state.versionInfo,
                                    hasStaticIndicator: hasStaticIndicator,
                                    debugInfo: debugInfo
                                }) : null,
                                hasStaticIndicator && /*#__PURE__*/ (0, _jsxruntime.jsx)(_StaticIndicator.StaticIndicator, {
                                    dispatcher: dispatcher
                                })
                            ]
                        })
                    ]
                })
            ]
        });
    }
    constructor(...args){
        super(...args);
        this.state = {
            isReactError: false
        };
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=ReactDevOverlay.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/get-socket-url.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getSocketUrl", {
    enumerable: true,
    get: function() {
        return getSocketUrl;
    }
});
const _normalizedassetprefix = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/normalized-asset-prefix.js [app-client] (ecmascript)");
function getSocketProtocol(assetPrefix) {
    let protocol = window.location.protocol;
    try {
        // assetPrefix is a url
        protocol = new URL(assetPrefix).protocol;
    } catch (e) {}
    return protocol === 'http:' ? 'ws:' : 'wss:';
}
function getSocketUrl(assetPrefix) {
    const prefix = (0, _normalizedassetprefix.normalizedAssetPrefix)(assetPrefix);
    const protocol = getSocketProtocol(assetPrefix || '');
    if (URL.canParse(prefix)) {
        // since normalized asset prefix is ensured to be a URL format,
        // we can safely replace the protocol
        return prefix.replace(/^http/, 'ws');
    }
    const { hostname, port } = window.location;
    return protocol + "//" + hostname + (port ? ":" + port : '') + prefix;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=get-socket-url.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-websocket.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    useSendMessage: null,
    useTurbopack: null,
    useWebsocket: null,
    useWebsocketPing: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    useSendMessage: function() {
        return useSendMessage;
    },
    useTurbopack: function() {
        return useTurbopack;
    },
    useWebsocket: function() {
        return useWebsocket;
    },
    useWebsocketPing: function() {
        return useWebsocketPing;
    }
});
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _approutercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
const _getsocketurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/get-socket-url.js [app-client] (ecmascript)");
function useWebsocket(assetPrefix) {
    const webSocketRef = (0, _react.useRef)(undefined);
    (0, _react.useEffect)(()=>{
        if (webSocketRef.current) {
            return;
        }
        const url = (0, _getsocketurl.getSocketUrl)(assetPrefix);
        webSocketRef.current = new window.WebSocket("" + url + "/_next/webpack-hmr");
    }, [
        assetPrefix
    ]);
    return webSocketRef;
}
function useSendMessage(webSocketRef) {
    const sendMessage = (0, _react.useCallback)((data)=>{
        const socket = webSocketRef.current;
        if (!socket || socket.readyState !== socket.OPEN) {
            return;
        }
        return socket.send(data);
    }, [
        webSocketRef
    ]);
    return sendMessage;
}
function useTurbopack(sendMessage, onUpdateError) {
    const turbopackState = (0, _react.useRef)({
        init: false,
        // Until the dynamic import resolves, queue any turbopack messages which will be replayed.
        queue: [],
        callback: undefined
    });
    const processTurbopackMessage = (0, _react.useCallback)((msg)=>{
        const { callback, queue } = turbopackState.current;
        if (callback) {
            callback(msg);
        } else {
            queue.push(msg);
        }
    }, []);
    (0, _react.useEffect)(()=>{
        const { current: initCurrent } = turbopackState;
        // TODO(WEB-1589): only install if `process.turbopack` set.
        if (initCurrent.init) {
            return;
        }
        initCurrent.init = true;
        __turbopack_require__("[turbopack]/browser/dev/hmr-client/hmr-client.ts [app-client] (ecmascript, async loader)")(__turbopack_import__).then((param)=>{
            let { connect } = param;
            const { current } = turbopackState;
            connect({
                addMessageListener (cb) {
                    current.callback = cb;
                    // Replay all Turbopack messages before we were able to establish the HMR client.
                    for (const msg of current.queue){
                        cb(msg);
                    }
                    current.queue = undefined;
                },
                sendMessage,
                onUpdateError
            });
        });
    }, [
        sendMessage,
        onUpdateError
    ]);
    return processTurbopackMessage;
}
function useWebsocketPing(websocketRef) {
    const sendMessage = useSendMessage(websocketRef);
    const { tree } = (0, _react.useContext)(_approutercontextsharedruntime.GlobalLayoutRouterContext);
    (0, _react.useEffect)(()=>{
        // Taken from on-demand-entries-client.js
        const interval = setInterval(()=>{
            sendMessage(JSON.stringify({
                event: 'ping',
                tree,
                appDirRoute: true
            }));
        }, 2500);
        return ()=>clearInterval(interval);
    }, [
        tree,
        sendMessage
    ]);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=use-websocket.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/parse-component-stack.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "parseComponentStack", {
    enumerable: true,
    get: function() {
        return parseComponentStack;
    }
});
var LocationType;
(function(LocationType) {
    LocationType["FILE"] = "file";
    LocationType["WEBPACK_INTERNAL"] = "webpack-internal";
    LocationType["HTTP"] = "http";
    LocationType["PROTOCOL_RELATIVE"] = "protocol-relative";
    LocationType["UNKNOWN"] = "unknown";
})(LocationType || (LocationType = {}));
/**
 * Get the type of frame line based on the location
 */ function getLocationType(location) {
    if (location.startsWith('file://')) {
        return "file";
    }
    if (location.includes('webpack-internal://')) {
        return "webpack-internal";
    }
    if (location.startsWith('http://') || location.startsWith('https://')) {
        return "http";
    }
    if (location.startsWith('//')) {
        return "protocol-relative";
    }
    return "unknown";
}
function parseStackFrameLocation(location) {
    const locationType = getLocationType(location);
    const modulePath = location == null ? void 0 : location.replace(/^(webpack-internal:\/\/\/|file:\/\/)(\(.*\)\/)?/, '');
    var _modulePath_match;
    const [, file, lineNumber, column] = (_modulePath_match = modulePath == null ? void 0 : modulePath.match(/^(.+):(\d+):(\d+)/)) != null ? _modulePath_match : [];
    switch(locationType){
        case "file":
        case "webpack-internal":
            return {
                canOpenInEditor: true,
                file,
                lineNumber: lineNumber ? Number(lineNumber) : undefined,
                column: column ? Number(column) : undefined
            };
        // When the location is a URL we only show the file
        // TODO: Resolve http(s) URLs through sourcemaps
        case "http":
        case "protocol-relative":
        case "unknown":
        default:
            {
                return {
                    canOpenInEditor: false
                };
            }
    }
}
function parseComponentStack(componentStack) {
    const componentStackFrames = [];
    for (const line of componentStack.trim().split('\n')){
        // TODO: support safari stack trace
        // Get component and file from the component stack line
        const match = /at ([^ ]+)( \((.*)\))?/.exec(line);
        if (match == null ? void 0 : match[1]) {
            const component = match[1];
            const location = match[3];
            if (!location) {
                componentStackFrames.push({
                    canOpenInEditor: false,
                    component
                });
                continue;
            }
            // Stop parsing the component stack if we reach a Next.js component
            if (location == null ? void 0 : location.includes('next/dist')) {
                break;
            }
            const frameLocation = parseStackFrameLocation(location);
            componentStackFrames.push({
                component,
                ...frameLocation
            });
        }
    }
    return componentStackFrames;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=parse-component-stack.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    default: null,
    waitForWebpackRuntimeHotUpdate: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    default: function() {
        return HotReload;
    },
    waitForWebpackRuntimeHotUpdate: function() {
        return waitForWebpackRuntimeHotUpdate;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _stripansi = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/strip-ansi/index.js [app-client] (ecmascript)"));
const _formatwebpackmessages = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/format-webpack-messages.js [app-client] (ecmascript)"));
const _navigation = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)");
const _shared = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/shared.js [app-client] (ecmascript)");
const _parsestack = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/parse-stack.js [app-client] (ecmascript)");
const _ReactDevOverlay = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js [app-client] (ecmascript)"));
const _useerrorhandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-error-handler.js [app-client] (ecmascript)");
const _runtimeerrorhandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/runtime-error-handler.js [app-client] (ecmascript)");
const _usewebsocket = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/use-websocket.js [app-client] (ecmascript)");
const _parsecomponentstack = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/parse-component-stack.js [app-client] (ecmascript)");
const _hotreloadertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/dev/hot-reloader-types.js [app-client] (ecmascript)");
const _extractmodulesfromturbopackmessage = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/dev/extract-modules-from-turbopack-message.js [app-client] (ecmascript)");
const _navigationuntracked = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/navigation-untracked.js [app-client] (ecmascript)");
const _stitchederror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/stitched-error.js [app-client] (ecmascript)");
let mostRecentCompilationHash = null;
let __nextDevClientId = Math.round(Math.random() * 100 + Date.now());
let reloading = false;
let startLatency = null;
let pendingHotUpdateWebpack = Promise.resolve();
let resolvePendingHotUpdateWebpack = ()=>{};
function setPendingHotUpdateWebpack() {
    pendingHotUpdateWebpack = new Promise((resolve)=>{
        resolvePendingHotUpdateWebpack = ()=>{
            resolve();
        };
    });
}
function waitForWebpackRuntimeHotUpdate() {
    return pendingHotUpdateWebpack;
}
function handleBeforeHotUpdateWebpack(dispatcher, hasUpdates) {
    if (hasUpdates) {
        dispatcher.onBeforeRefresh();
    }
}
function handleSuccessfulHotUpdateWebpack(dispatcher, sendMessage, updatedModules) {
    resolvePendingHotUpdateWebpack();
    dispatcher.onBuildOk();
    reportHmrLatency(sendMessage, updatedModules);
    dispatcher.onRefresh();
}
function reportHmrLatency(sendMessage, updatedModules) {
    if (!startLatency) return;
    let endLatency = Date.now();
    const latency = endLatency - startLatency;
    console.log("[Fast Refresh] done in " + latency + "ms");
    sendMessage(JSON.stringify({
        event: 'client-hmr-latency',
        id: window.__nextDevClientId,
        startTime: startLatency,
        endTime: endLatency,
        page: window.location.pathname,
        updatedModules,
        // Whether the page (tab) was hidden at the time the event occurred.
        // This can impact the accuracy of the event's timing.
        isPageHidden: document.visibilityState === 'hidden'
    }));
}
// There is a newer version of the code available.
function handleAvailableHash(hash) {
    // Update last known compilation hash.
    mostRecentCompilationHash = hash;
}
/**
 * Is there a newer version of this code available?
 * For webpack: Check if the hash changed compared to __webpack_hash__
 * For Turbopack: Always true because it doesn't have __webpack_hash__
 */ function isUpdateAvailable() {
    if ("TURBOPACK compile-time truthy", 1) {
        return true;
    }
    "TURBOPACK unreachable";
}
// Webpack disallows updates in other states.
function canApplyUpdates() {
    // @ts-expect-error module.hot exists
    return module.hot.status() === 'idle';
}
function afterApplyUpdates(fn) {
    if (canApplyUpdates()) {
        fn();
    } else {
        function handler(status) {
            if (status === 'idle') {
                // @ts-expect-error module.hot exists
                module.hot.removeStatusHandler(handler);
                fn();
            }
        }
        // @ts-expect-error module.hot exists
        module.hot.addStatusHandler(handler);
    }
}
function performFullReload(err, sendMessage) {
    const stackTrace = err && (err.stack && err.stack.split('\n').slice(0, 5).join('\n') || err.message || err + '');
    sendMessage(JSON.stringify({
        event: 'client-full-reload',
        stackTrace,
        hadRuntimeError: !!_runtimeerrorhandler.RuntimeErrorHandler.hadRuntimeError,
        dependencyChain: err ? err.dependencyChain : undefined
    }));
    if (reloading) return;
    reloading = true;
    window.location.reload();
}
// Attempt to update code on the fly, fall back to a hard reload.
function tryApplyUpdates(onBeforeUpdate, onHotUpdateSuccess, sendMessage, dispatcher) {
    if (!isUpdateAvailable() || !canApplyUpdates()) {
        resolvePendingHotUpdateWebpack();
        dispatcher.onBuildOk();
        reportHmrLatency(sendMessage, []);
        return;
    }
    function handleApplyUpdates(err, updatedModules) {
        if (err || _runtimeerrorhandler.RuntimeErrorHandler.hadRuntimeError || !updatedModules) {
            if (err) {
                console.warn('[Fast Refresh] performing full reload\n\n' + "Fast Refresh will perform a full reload when you edit a file that's imported by modules outside of the React rendering tree.\n" + 'You might have a file which exports a React component but also exports a value that is imported by a non-React component file.\n' + 'Consider migrating the non-React component export to a separate file and importing it into both files.\n\n' + 'It is also possible the parent component of the component you edited is a class component, which disables Fast Refresh.\n' + 'Fast Refresh requires at least one parent function component in your React tree.');
            } else if (_runtimeerrorhandler.RuntimeErrorHandler.hadRuntimeError) {
                console.warn(_shared.REACT_REFRESH_FULL_RELOAD_FROM_ERROR);
            }
            performFullReload(err, sendMessage);
            return;
        }
        const hasUpdates = Boolean(updatedModules.length);
        if (typeof onHotUpdateSuccess === 'function') {
            // Maybe we want to do something.
            onHotUpdateSuccess(updatedModules);
        }
        if (isUpdateAvailable()) {
            // While we were updating, there was a new update! Do it again.
            tryApplyUpdates(hasUpdates ? ()=>{} : onBeforeUpdate, hasUpdates ? ()=>dispatcher.onBuildOk() : onHotUpdateSuccess, sendMessage, dispatcher);
        } else {
            dispatcher.onBuildOk();
            if ("TURBOPACK compile-time falsy", 0) {
                "TURBOPACK unreachable";
            }
        }
    }
    // https://webpack.js.org/api/hot-module-replacement/#check
    // @ts-expect-error module.hot exists
    module.hot.check(/* autoApply */ false).then((updatedModules)=>{
        if (!updatedModules) {
            return null;
        }
        if (typeof onBeforeUpdate === 'function') {
            const hasUpdates = Boolean(updatedModules.length);
            onBeforeUpdate(hasUpdates);
        }
        // https://webpack.js.org/api/hot-module-replacement/#apply
        // @ts-expect-error module.hot exists
        return module.hot.apply();
    }).then((updatedModules)=>{
        handleApplyUpdates(null, updatedModules);
    }, (err)=>{
        handleApplyUpdates(err, null);
    });
}
/** Handles messages from the sevrer for the App Router. */ function processMessage(obj, sendMessage, processTurbopackMessage, router, dispatcher, appIsrManifestRef, pathnameRef) {
    if (!('action' in obj)) {
        return;
    }
    function handleErrors(errors) {
        // "Massage" webpack messages.
        const formatted = (0, _formatwebpackmessages.default)({
            errors: errors,
            warnings: []
        });
        // Only show the first error.
        dispatcher.onBuildError(formatted.errors[0]);
        // Also log them to the console.
        for(let i = 0; i < formatted.errors.length; i++){
            console.error((0, _stripansi.default)(formatted.errors[i]));
        }
        // Do not attempt to reload now.
        // We will reload on next success instead.
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
    }
    function handleHotUpdate() {
        if ("TURBOPACK compile-time truthy", 1) {
            dispatcher.onBuildOk();
        } else {
            "TURBOPACK unreachable";
        }
    }
    switch(obj.action){
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.APP_ISR_MANIFEST:
            {
                if ("TURBOPACK compile-time truthy", 1) {
                    if (appIsrManifestRef) {
                        appIsrManifestRef.current = obj.data;
                        // handle initial status on receiving manifest
                        // navigation is handled in useEffect for pathname changes
                        // as we'll receive the updated manifest before usePathname
                        // triggers for new value
                        if (pathnameRef.current in obj.data) {
                            var _localStorage;
                            // the indicator can be hidden for an hour.
                            // check if it's still hidden
                            const indicatorHiddenAt = Number((_localStorage = localStorage) == null ? void 0 : _localStorage.getItem('__NEXT_DISMISS_PRERENDER_INDICATOR'));
                            const isHidden = indicatorHiddenAt && !isNaN(indicatorHiddenAt) && Date.now() < indicatorHiddenAt;
                            if (!isHidden) {
                                dispatcher.onStaticIndicator(true);
                            }
                        } else {
                            dispatcher.onStaticIndicator(false);
                        }
                    }
                }
                break;
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.BUILDING:
            {
                startLatency = Date.now();
                if ("TURBOPACK compile-time falsy", 0) {
                    "TURBOPACK unreachable";
                }
                console.log('[Fast Refresh] rebuilding');
                break;
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.BUILT:
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.SYNC:
            {
                if (obj.hash) {
                    handleAvailableHash(obj.hash);
                }
                const { errors, warnings } = obj;
                // Is undefined when it's a 'built' event
                if ('versionInfo' in obj) dispatcher.onVersionInfo(obj.versionInfo);
                if ('debug' in obj && obj.debug) dispatcher.onDebugInfo(obj.debug);
                const hasErrors = Boolean(errors && errors.length);
                // Compilation with errors (e.g. syntax error or missing modules).
                if (hasErrors) {
                    sendMessage(JSON.stringify({
                        event: 'client-error',
                        errorCount: errors.length,
                        clientId: __nextDevClientId
                    }));
                    handleErrors(errors);
                    return;
                }
                const hasWarnings = Boolean(warnings && warnings.length);
                if (hasWarnings) {
                    sendMessage(JSON.stringify({
                        event: 'client-warning',
                        warningCount: warnings.length,
                        clientId: __nextDevClientId
                    }));
                    // Print warnings to the console.
                    const formattedMessages = (0, _formatwebpackmessages.default)({
                        warnings: warnings,
                        errors: []
                    });
                    for(let i = 0; i < formattedMessages.warnings.length; i++){
                        if (i === 5) {
                            console.warn('There were more warnings in other files.\n' + 'You can find a complete log in the terminal.');
                            break;
                        }
                        console.warn((0, _stripansi.default)(formattedMessages.warnings[i]));
                    }
                // No early return here as we need to apply modules in the same way between warnings only and compiles without warnings
                }
                sendMessage(JSON.stringify({
                    event: 'client-success',
                    clientId: __nextDevClientId
                }));
                if (obj.action === _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.BUILT) {
                    // Handle hot updates
                    handleHotUpdate();
                }
                return;
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.TURBOPACK_CONNECTED:
            {
                processTurbopackMessage({
                    type: _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.TURBOPACK_CONNECTED,
                    data: {
                        sessionId: obj.data.sessionId
                    }
                });
                break;
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.TURBOPACK_MESSAGE:
            {
                const updatedModules = (0, _extractmodulesfromturbopackmessage.extractModulesFromTurbopackMessage)(obj.data);
                dispatcher.onBeforeRefresh();
                processTurbopackMessage({
                    type: _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.TURBOPACK_MESSAGE,
                    data: obj.data
                });
                dispatcher.onRefresh();
                if (_runtimeerrorhandler.RuntimeErrorHandler.hadRuntimeError) {
                    console.warn(_shared.REACT_REFRESH_FULL_RELOAD_FROM_ERROR);
                    performFullReload(null, sendMessage);
                }
                reportHmrLatency(sendMessage, updatedModules);
                break;
            }
        // TODO-APP: make server component change more granular
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.SERVER_COMPONENT_CHANGES:
            {
                sendMessage(JSON.stringify({
                    event: 'server-component-reload-page',
                    clientId: __nextDevClientId
                }));
                if (_runtimeerrorhandler.RuntimeErrorHandler.hadRuntimeError) {
                    if (reloading) return;
                    reloading = true;
                    return window.location.reload();
                }
                (0, _react.startTransition)(()=>{
                    router.hmrRefresh();
                    dispatcher.onRefresh();
                });
                if ("TURBOPACK compile-time falsy", 0) {
                    "TURBOPACK unreachable";
                }
                return;
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.RELOAD_PAGE:
            {
                sendMessage(JSON.stringify({
                    event: 'client-reload-page',
                    clientId: __nextDevClientId
                }));
                if (reloading) return;
                reloading = true;
                return window.location.reload();
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.ADDED_PAGE:
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.REMOVED_PAGE:
            {
                // TODO-APP: potentially only refresh if the currently viewed page was added/removed.
                return router.hmrRefresh();
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.SERVER_ERROR:
            {
                const { errorJSON } = obj;
                if (errorJSON) {
                    const { message, stack } = JSON.parse(errorJSON);
                    const error = new Error(message);
                    error.stack = stack;
                    handleErrors([
                        error
                    ]);
                }
                return;
            }
        case _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.DEV_PAGES_MANIFEST_UPDATE:
            {
                return;
            }
        default:
            {}
    }
}
function HotReload(param) {
    let { assetPrefix, children } = param;
    const [state, dispatch] = (0, _shared.useErrorOverlayReducer)();
    const dispatcher = (0, _react.useMemo)(()=>{
        return {
            onBuildOk () {
                dispatch({
                    type: _shared.ACTION_BUILD_OK
                });
            },
            onBuildError (message) {
                dispatch({
                    type: _shared.ACTION_BUILD_ERROR,
                    message
                });
            },
            onBeforeRefresh () {
                dispatch({
                    type: _shared.ACTION_BEFORE_REFRESH
                });
            },
            onRefresh () {
                dispatch({
                    type: _shared.ACTION_REFRESH
                });
            },
            onVersionInfo (versionInfo) {
                dispatch({
                    type: _shared.ACTION_VERSION_INFO,
                    versionInfo
                });
            },
            onStaticIndicator (status) {
                dispatch({
                    type: _shared.ACTION_STATIC_INDICATOR,
                    staticIndicator: status
                });
            },
            onDebugInfo (debugInfo) {
                dispatch({
                    type: _shared.ACTION_DEBUG_INFO,
                    debugInfo
                });
            }
        };
    }, [
        dispatch
    ]);
    const handleOnUnhandledError = (0, _react.useCallback)((error)=>{
        const errorDetails = error.details;
        // Component stack is added to the error in use-error-handler in case there was a hydration error
        const componentStackTrace = error._componentStack || (errorDetails == null ? void 0 : errorDetails.componentStack);
        const warning = errorDetails == null ? void 0 : errorDetails.warning;
        const stitchedError = (0, _stitchederror.getReactStitchedError)(error);
        dispatch({
            type: _shared.ACTION_UNHANDLED_ERROR,
            reason: stitchedError,
            frames: (0, _parsestack.parseStack)(stitchedError.stack || ''),
            componentStackFrames: typeof componentStackTrace === 'string' ? (0, _parsecomponentstack.parseComponentStack)(componentStackTrace) : undefined,
            warning
        });
    }, [
        dispatch
    ]);
    const handleOnUnhandledRejection = (0, _react.useCallback)((reason)=>{
        const stitchedError = (0, _stitchederror.getReactStitchedError)(reason);
        dispatch({
            type: _shared.ACTION_UNHANDLED_REJECTION,
            reason: stitchedError,
            frames: (0, _parsestack.parseStack)(stitchedError.stack || '')
        });
    }, [
        dispatch
    ]);
    (0, _useerrorhandler.useErrorHandler)(handleOnUnhandledError, handleOnUnhandledRejection);
    const webSocketRef = (0, _usewebsocket.useWebsocket)(assetPrefix);
    (0, _usewebsocket.useWebsocketPing)(webSocketRef);
    const sendMessage = (0, _usewebsocket.useSendMessage)(webSocketRef);
    const processTurbopackMessage = (0, _usewebsocket.useTurbopack)(sendMessage, (err)=>performFullReload(err, sendMessage));
    const router = (0, _navigation.useRouter)();
    // We don't want access of the pathname for the dev tools to trigger a dynamic
    // access (as the dev overlay will never be present in production).
    const pathname = (0, _navigationuntracked.useUntrackedPathname)();
    const appIsrManifestRef = (0, _react.useRef)({});
    const pathnameRef = (0, _react.useRef)(pathname);
    if ("TURBOPACK compile-time truthy", 1) {
        // this conditional is only for dead-code elimination which
        // isn't a runtime conditional only build-time so ignore hooks rule
        // eslint-disable-next-line react-hooks/rules-of-hooks
        (0, _react.useEffect)(()=>{
            pathnameRef.current = pathname;
            const appIsrManifest = appIsrManifestRef.current;
            if (appIsrManifest) {
                if (pathname && pathname in appIsrManifest) {
                    var _localStorage;
                    const indicatorHiddenAt = Number((_localStorage = localStorage) == null ? void 0 : _localStorage.getItem('__NEXT_DISMISS_PRERENDER_INDICATOR'));
                    const isHidden = indicatorHiddenAt && !isNaN(indicatorHiddenAt) && Date.now() < indicatorHiddenAt;
                    if (!isHidden) {
                        dispatcher.onStaticIndicator(true);
                    }
                } else {
                    dispatcher.onStaticIndicator(false);
                }
            }
        }, [
            pathname,
            dispatcher
        ]);
    }
    (0, _react.useEffect)(()=>{
        const websocket = webSocketRef.current;
        if (!websocket) return;
        const handler = (event)=>{
            try {
                const obj = JSON.parse(event.data);
                processMessage(obj, sendMessage, processTurbopackMessage, router, dispatcher, appIsrManifestRef, pathnameRef);
            } catch (err) {
                var _err_stack;
                console.warn('[HMR] Invalid message: ' + JSON.stringify(event.data) + '\n' + ((_err_stack = err == null ? void 0 : err.stack) != null ? _err_stack : ''));
            }
        };
        websocket.addEventListener('message', handler);
        return ()=>websocket.removeEventListener('message', handler);
    }, [
        sendMessage,
        router,
        webSocketRef,
        dispatcher,
        processTurbopackMessage,
        appIsrManifestRef
    ]);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_ReactDevOverlay.default, {
        state: state,
        dispatcher: dispatcher,
        children: children
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=hot-reloader-client.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    createEmptyCacheNode: null,
    default: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    createEmptyCacheNode: function() {
        return createEmptyCacheNode;
    },
    default: function() {
        return AppRouter;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _approutercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _hooksclientcontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/hooks-client-context.shared-runtime.js [app-client] (ecmascript)");
const _usereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/use-reducer.js [app-client] (ecmascript)");
const _errorboundary = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/error-boundary.js [app-client] (ecmascript)");
const _isbot = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/utils/is-bot.js [app-client] (ecmascript)");
const _addbasepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/add-base-path.js [app-client] (ecmascript)");
const _approuterannouncer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router-announcer.js [app-client] (ecmascript)");
const _redirectboundary = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect-boundary.js [app-client] (ecmascript)");
const _findheadincache = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/find-head-in-cache.js [app-client] (ecmascript)");
const _unresolvedthenable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/unresolved-thenable.js [app-client] (ecmascript)");
const _removebasepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/remove-base-path.js [app-client] (ecmascript)");
const _hasbasepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/has-base-path.js [app-client] (ecmascript)");
const _computechangedpath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/compute-changed-path.js [app-client] (ecmascript)");
const _navfailurehandler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/nav-failure-handler.js [app-client] (ecmascript)");
const _appcallserver = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-call-server.js [app-client] (ecmascript)");
const _redirect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect.js [app-client] (ecmascript)");
const globalMutable = {};
function isExternalURL(url) {
    return url.origin !== window.location.origin;
}
function HistoryUpdater(param) {
    let { appRouterState } = param;
    (0, _react.useInsertionEffect)(()=>{
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
        const { tree, pushRef, canonicalUrl } = appRouterState;
        const historyState = {
            ...pushRef.preserveCustomHistoryState ? window.history.state : {},
            // Identifier is shortened intentionally.
            // __NA is used to identify if the history entry can be handled by the app-router.
            // __N is used to identify if the history entry can be handled by the old router.
            __NA: true,
            __PRIVATE_NEXTJS_INTERNALS_TREE: tree
        };
        if (pushRef.pendingPush && // Skip pushing an additional history entry if the canonicalUrl is the same as the current url.
        // This mirrors the browser behavior for normal navigation.
        (0, _createhreffromurl.createHrefFromUrl)(new URL(window.location.href)) !== canonicalUrl) {
            // This intentionally mutates React state, pushRef is overwritten to ensure additional push/replace calls do not trigger an additional history entry.
            pushRef.pendingPush = false;
            window.history.pushState(historyState, '', canonicalUrl);
        } else {
            window.history.replaceState(historyState, '', canonicalUrl);
        }
    }, [
        appRouterState
    ]);
    return null;
}
function createEmptyCacheNode() {
    return {
        lazyData: null,
        rsc: null,
        prefetchRsc: null,
        head: null,
        prefetchHead: null,
        parallelRoutes: new Map(),
        loading: null
    };
}
/**
 * Server response that only patches the cache and tree.
 */ function useChangeByServerResponse(dispatch) {
    return (0, _react.useCallback)((param)=>{
        let { previousTree, serverResponse } = param;
        (0, _react.startTransition)(()=>{
            dispatch({
                type: _routerreducertypes.ACTION_SERVER_PATCH,
                previousTree,
                serverResponse
            });
        });
    }, [
        dispatch
    ]);
}
function useNavigate(dispatch) {
    return (0, _react.useCallback)((href, navigateType, shouldScroll)=>{
        const url = new URL((0, _addbasepath.addBasePath)(href), location.href);
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        }
        return dispatch({
            type: _routerreducertypes.ACTION_NAVIGATE,
            url,
            isExternalUrl: isExternalURL(url),
            locationSearch: location.search,
            shouldScroll: shouldScroll != null ? shouldScroll : true,
            navigateType,
            allowAliasing: true
        });
    }, [
        dispatch
    ]);
}
function copyNextJsInternalHistoryState(data) {
    if (data == null) data = {};
    const currentState = window.history.state;
    const __NA = currentState == null ? void 0 : currentState.__NA;
    if (__NA) {
        data.__NA = __NA;
    }
    const __PRIVATE_NEXTJS_INTERNALS_TREE = currentState == null ? void 0 : currentState.__PRIVATE_NEXTJS_INTERNALS_TREE;
    if (__PRIVATE_NEXTJS_INTERNALS_TREE) {
        data.__PRIVATE_NEXTJS_INTERNALS_TREE = __PRIVATE_NEXTJS_INTERNALS_TREE;
    }
    return data;
}
function Head(param) {
    let { headCacheNode } = param;
    // If this segment has a `prefetchHead`, it's the statically prefetched data.
    // We should use that on initial render instead of `head`. Then we'll switch
    // to `head` when the dynamic response streams in.
    const head = headCacheNode !== null ? headCacheNode.head : null;
    const prefetchHead = headCacheNode !== null ? headCacheNode.prefetchHead : null;
    // If no prefetch data is available, then we go straight to rendering `head`.
    const resolvedPrefetchRsc = prefetchHead !== null ? prefetchHead : head;
    // We use `useDeferredValue` to handle switching between the prefetched and
    // final values. The second argument is returned on initial render, then it
    // re-renders with the first argument.
    //
    // @ts-expect-error The second argument to `useDeferredValue` is only
    // available in the experimental builds. When its disabled, it will always
    // return `head`.
    return (0, _react.useDeferredValue)(head, resolvedPrefetchRsc);
}
/**
 * The global router that wraps the application components.
 */ function Router(param) {
    let { actionQueue, assetPrefix } = param;
    const [state, dispatch] = (0, _usereducer.useReducer)(actionQueue);
    const { canonicalUrl } = (0, _usereducer.useUnwrapState)(state);
    // Add memoized pathname/query for useSearchParams and usePathname.
    const { searchParams, pathname } = (0, _react.useMemo)(()=>{
        const url = new URL(canonicalUrl, typeof window === 'undefined' ? 'http://n' : window.location.href);
        return {
            // This is turned into a readonly class in `useSearchParams`
            searchParams: url.searchParams,
            pathname: (0, _hasbasepath.hasBasePath)(url.pathname) ? (0, _removebasepath.removeBasePath)(url.pathname) : url.pathname
        };
    }, [
        canonicalUrl
    ]);
    const changeByServerResponse = useChangeByServerResponse(dispatch);
    const navigate = useNavigate(dispatch);
    (0, _appcallserver.useServerActionDispatcher)(dispatch);
    /**
   * The app router that is exposed through `useRouter`. It's only concerned with dispatching actions to the reducer, does not hold state.
   */ const appRouter = (0, _react.useMemo)(()=>{
        const routerInstance = {
            back: ()=>window.history.back(),
            forward: ()=>window.history.forward(),
            prefetch: (href, options)=>{
                // Don't prefetch for bots as they don't navigate.
                if ((0, _isbot.isBot)(window.navigator.userAgent)) {
                    return;
                }
                let url;
                try {
                    url = new URL((0, _addbasepath.addBasePath)(href), window.location.href);
                } catch (_) {
                    throw new Error("Cannot prefetch '" + href + "' because it cannot be converted to a URL.");
                }
                // Don't prefetch during development (improves compilation performance)
                if ("TURBOPACK compile-time truthy", 1) {
                    return;
                }
                "TURBOPACK unreachable";
            },
            replace: (href, options)=>{
                if (options === void 0) options = {};
                (0, _react.startTransition)(()=>{
                    var _options_scroll;
                    navigate(href, 'replace', (_options_scroll = options.scroll) != null ? _options_scroll : true);
                });
            },
            push: (href, options)=>{
                if (options === void 0) options = {};
                (0, _react.startTransition)(()=>{
                    var _options_scroll;
                    navigate(href, 'push', (_options_scroll = options.scroll) != null ? _options_scroll : true);
                });
            },
            refresh: ()=>{
                (0, _react.startTransition)(()=>{
                    dispatch({
                        type: _routerreducertypes.ACTION_REFRESH,
                        origin: window.location.origin
                    });
                });
            },
            hmrRefresh: ()=>{
                if ("TURBOPACK compile-time falsy", 0) {
                    "TURBOPACK unreachable";
                } else {
                    (0, _react.startTransition)(()=>{
                        dispatch({
                            type: _routerreducertypes.ACTION_HMR_REFRESH,
                            origin: window.location.origin
                        });
                    });
                }
            }
        };
        return routerInstance;
    }, [
        dispatch,
        navigate
    ]);
    (0, _react.useEffect)(()=>{
        // Exists for debugging purposes. Don't use in application code.
        if (window.next) {
            window.next.router = appRouter;
        }
    }, [
        appRouter
    ]);
    if ("TURBOPACK compile-time truthy", 1) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { cache, prefetchCache, tree } = (0, _usereducer.useUnwrapState)(state);
        // This hook is in a conditional but that is ok because `process.env.NODE_ENV` never changes
        // eslint-disable-next-line react-hooks/rules-of-hooks
        (0, _react.useEffect)(()=>{
            // Add `window.nd` for debugging purposes.
            // This is not meant for use in applications as concurrent rendering will affect the cache/tree/router.
            // @ts-ignore this is for debugging
            window.nd = {
                router: appRouter,
                cache,
                prefetchCache,
                tree
            };
        }, [
            appRouter,
            cache,
            prefetchCache,
            tree
        ]);
    }
    (0, _react.useEffect)(()=>{
        // If the app is restored from bfcache, it's possible that
        // pushRef.mpaNavigation is true, which would mean that any re-render of this component
        // would trigger the mpa navigation logic again from the lines below.
        // This will restore the router to the initial state in the event that the app is restored from bfcache.
        function handlePageShow(event) {
            var _window_history_state;
            if (!event.persisted || !((_window_history_state = window.history.state) == null ? void 0 : _window_history_state.__PRIVATE_NEXTJS_INTERNALS_TREE)) {
                return;
            }
            // Clear the pendingMpaPath value so that a subsequent MPA navigation to the same URL can be triggered.
            // This is necessary because if the browser restored from bfcache, the pendingMpaPath would still be set to the value
            // of the last MPA navigation.
            globalMutable.pendingMpaPath = undefined;
            dispatch({
                type: _routerreducertypes.ACTION_RESTORE,
                url: new URL(window.location.href),
                tree: window.history.state.__PRIVATE_NEXTJS_INTERNALS_TREE
            });
        }
        window.addEventListener('pageshow', handlePageShow);
        return ()=>{
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [
        dispatch
    ]);
    (0, _react.useEffect)(()=>{
        // Ensure that any redirect errors that bubble up outside of the RedirectBoundary
        // are caught and handled by the router.
        function handleUnhandledRedirect(event) {
            const error = 'reason' in event ? event.reason : event.error;
            if ((0, _redirect.isRedirectError)(error)) {
                event.preventDefault();
                const url = (0, _redirect.getURLFromRedirectError)(error);
                const redirectType = (0, _redirect.getRedirectTypeFromError)(error);
                if (redirectType === _redirect.RedirectType.push) {
                    appRouter.push(url, {});
                } else {
                    appRouter.replace(url, {});
                }
            }
        }
        window.addEventListener('error', handleUnhandledRedirect);
        window.addEventListener('unhandledrejection', handleUnhandledRedirect);
        return ()=>{
            window.removeEventListener('error', handleUnhandledRedirect);
            window.removeEventListener('unhandledrejection', handleUnhandledRedirect);
        };
    }, [
        appRouter
    ]);
    // When mpaNavigation flag is set do a hard navigation to the new url.
    // Infinitely suspend because we don't actually want to rerender any child
    // components with the new URL and any entangled state updates shouldn't
    // commit either (eg: useTransition isPending should stay true until the page
    // unloads).
    //
    // This is a side effect in render. Don't try this at home, kids. It's
    // probably safe because we know this is a singleton component and it's never
    // in <Offscreen>. At least I hope so. (It will run twice in dev strict mode,
    // but that's... fine?)
    const { pushRef } = (0, _usereducer.useUnwrapState)(state);
    if (pushRef.mpaNavigation) {
        // if there's a re-render, we don't want to trigger another redirect if one is already in flight to the same URL
        if (globalMutable.pendingMpaPath !== canonicalUrl) {
            const location1 = window.location;
            if (pushRef.pendingPush) {
                location1.assign(canonicalUrl);
            } else {
                location1.replace(canonicalUrl);
            }
            globalMutable.pendingMpaPath = canonicalUrl;
        }
        // TODO-APP: Should we listen to navigateerror here to catch failed
        // navigations somehow? And should we call window.stop() if a SPA navigation
        // should interrupt an MPA one?
        (0, _react.use)(_unresolvedthenable.unresolvedThenable);
    }
    (0, _react.useEffect)(()=>{
        const originalPushState = window.history.pushState.bind(window.history);
        const originalReplaceState = window.history.replaceState.bind(window.history);
        // Ensure the canonical URL in the Next.js Router is updated when the URL is changed so that `usePathname` and `useSearchParams` hold the pushed values.
        const applyUrlFromHistoryPushReplace = (url)=>{
            var _window_history_state;
            const href = window.location.href;
            const tree = (_window_history_state = window.history.state) == null ? void 0 : _window_history_state.__PRIVATE_NEXTJS_INTERNALS_TREE;
            (0, _react.startTransition)(()=>{
                dispatch({
                    type: _routerreducertypes.ACTION_RESTORE,
                    url: new URL(url != null ? url : href, href),
                    tree
                });
            });
        };
        /**
     * Patch pushState to ensure external changes to the history are reflected in the Next.js Router.
     * Ensures Next.js internal history state is copied to the new history entry.
     * Ensures usePathname and useSearchParams hold the newly provided url.
     */ window.history.pushState = function pushState(data, _unused, url) {
            // Avoid a loop when Next.js internals trigger pushState/replaceState
            if ((data == null ? void 0 : data.__NA) || (data == null ? void 0 : data._N)) {
                return originalPushState(data, _unused, url);
            }
            data = copyNextJsInternalHistoryState(data);
            if (url) {
                applyUrlFromHistoryPushReplace(url);
            }
            return originalPushState(data, _unused, url);
        };
        /**
     * Patch replaceState to ensure external changes to the history are reflected in the Next.js Router.
     * Ensures Next.js internal history state is copied to the new history entry.
     * Ensures usePathname and useSearchParams hold the newly provided url.
     */ window.history.replaceState = function replaceState(data, _unused, url) {
            // Avoid a loop when Next.js internals trigger pushState/replaceState
            if ((data == null ? void 0 : data.__NA) || (data == null ? void 0 : data._N)) {
                return originalReplaceState(data, _unused, url);
            }
            data = copyNextJsInternalHistoryState(data);
            if (url) {
                applyUrlFromHistoryPushReplace(url);
            }
            return originalReplaceState(data, _unused, url);
        };
        /**
     * Handle popstate event, this is used to handle back/forward in the browser.
     * By default dispatches ACTION_RESTORE, however if the history entry was not pushed/replaced by app-router it will reload the page.
     * That case can happen when the old router injected the history entry.
     */ const onPopState = (event)=>{
            if (!event.state) {
                // TODO-APP: this case only happens when pushState/replaceState was called outside of Next.js. It should probably reload the page in this case.
                return;
            }
            // This case happens when the history entry was pushed by the `pages` router.
            if (!event.state.__NA) {
                window.location.reload();
                return;
            }
            // TODO-APP: Ideally the back button should not use startTransition as it should apply the updates synchronously
            // Without startTransition works if the cache is there for this path
            (0, _react.startTransition)(()=>{
                dispatch({
                    type: _routerreducertypes.ACTION_RESTORE,
                    url: new URL(window.location.href),
                    tree: event.state.__PRIVATE_NEXTJS_INTERNALS_TREE
                });
            });
        };
        // Register popstate event to call onPopstate.
        window.addEventListener('popstate', onPopState);
        return ()=>{
            window.history.pushState = originalPushState;
            window.history.replaceState = originalReplaceState;
            window.removeEventListener('popstate', onPopState);
        };
    }, [
        dispatch
    ]);
    const { cache, tree, nextUrl, focusAndScrollRef, buildId } = (0, _usereducer.useUnwrapState)(state);
    const matchingHead = (0, _react.useMemo)(()=>{
        return (0, _findheadincache.findHeadInCache)(cache, tree[1]);
    }, [
        cache,
        tree
    ]);
    // Add memoized pathParams for useParams.
    const pathParams = (0, _react.useMemo)(()=>{
        return (0, _computechangedpath.getSelectedParams)(tree);
    }, [
        tree
    ]);
    const layoutRouterContext = (0, _react.useMemo)(()=>{
        return {
            childNodes: cache.parallelRoutes,
            tree,
            // Root node always has `url`
            // Provided in AppTreeContext to ensure it can be overwritten in layout-router
            url: canonicalUrl,
            loading: cache.loading
        };
    }, [
        cache.parallelRoutes,
        tree,
        canonicalUrl,
        cache.loading
    ]);
    const globalLayoutRouterContext = (0, _react.useMemo)(()=>{
        return {
            buildId,
            changeByServerResponse,
            tree,
            focusAndScrollRef,
            nextUrl
        };
    }, [
        buildId,
        changeByServerResponse,
        tree,
        focusAndScrollRef,
        nextUrl
    ]);
    let head;
    if (matchingHead !== null) {
        // The head is wrapped in an extra component so we can use
        // `useDeferredValue` to swap between the prefetched and final versions of
        // the head. (This is what LayoutRouter does for segment data, too.)
        //
        // The `key` is used to remount the component whenever the head moves to
        // a different segment.
        const [headCacheNode, headKey] = matchingHead;
        head = /*#__PURE__*/ (0, _jsxruntime.jsx)(Head, {
            headCacheNode: headCacheNode
        }, headKey);
    } else {
        head = null;
    }
    let content = /*#__PURE__*/ (0, _jsxruntime.jsxs)(_redirectboundary.RedirectBoundary, {
        children: [
            head,
            cache.rsc,
            /*#__PURE__*/ (0, _jsxruntime.jsx)(_approuterannouncer.AppRouterAnnouncer, {
                tree: tree
            })
        ]
    });
    if ("TURBOPACK compile-time truthy", 1) {
        if (typeof window !== 'undefined') {
            const DevRootNotFoundBoundary = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/dev-root-not-found-boundary.js [app-client] (ecmascript)").DevRootNotFoundBoundary;
            content = /*#__PURE__*/ (0, _jsxruntime.jsx)(DevRootNotFoundBoundary, {
                children: content
            });
        }
        const HotReloader = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js [app-client] (ecmascript)").default;
        content = /*#__PURE__*/ (0, _jsxruntime.jsx)(HotReloader, {
            assetPrefix: assetPrefix,
            children: content
        });
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)(HistoryUpdater, {
                appRouterState: (0, _usereducer.useUnwrapState)(state)
            }),
            /*#__PURE__*/ (0, _jsxruntime.jsx)(RuntimeStyles, {}),
            /*#__PURE__*/ (0, _jsxruntime.jsx)(_hooksclientcontextsharedruntime.PathParamsContext.Provider, {
                value: pathParams,
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_hooksclientcontextsharedruntime.PathnameContext.Provider, {
                    value: pathname,
                    children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_hooksclientcontextsharedruntime.SearchParamsContext.Provider, {
                        value: searchParams,
                        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_approutercontextsharedruntime.GlobalLayoutRouterContext.Provider, {
                            value: globalLayoutRouterContext,
                            children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_approutercontextsharedruntime.AppRouterContext.Provider, {
                                value: appRouter,
                                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_approutercontextsharedruntime.LayoutRouterContext.Provider, {
                                    value: layoutRouterContext,
                                    children: content
                                })
                            })
                        })
                    })
                })
            })
        ]
    });
}
function AppRouter(param) {
    let { actionQueue, globalErrorComponentAndStyles: [globalErrorComponent, globalErrorStyles], assetPrefix } = param;
    (0, _navfailurehandler.useNavFailureHandler)();
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_errorboundary.ErrorBoundary, {
        errorComponent: globalErrorComponent,
        errorStyles: globalErrorStyles,
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(Router, {
            actionQueue: actionQueue,
            assetPrefix: assetPrefix
        })
    });
}
const runtimeStyles = new Set();
let runtimeStyleChanged = new Set();
globalThis._N_E_STYLE_LOAD = function(href) {
    let len = runtimeStyles.size;
    runtimeStyles.add(href);
    if (runtimeStyles.size !== len) {
        runtimeStyleChanged.forEach((cb)=>cb());
    }
    // TODO figure out how to get a promise here
    // But maybe it's not necessary as react would block rendering until it's loaded
    return Promise.resolve();
};
function RuntimeStyles() {
    const [, forceUpdate] = _react.default.useState(0);
    const renderedStylesSize = runtimeStyles.size;
    (0, _react.useEffect)(()=>{
        const changed = ()=>forceUpdate((c)=>c + 1);
        runtimeStyleChanged.add(changed);
        if (renderedStylesSize !== runtimeStyles.size) {
            changed();
        }
        return ()=>{
            runtimeStyleChanged.delete(changed);
        };
    }, [
        renderedStylesSize,
        forceUpdate
    ]);
    const dplId = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : '';
    return [
        ...runtimeStyles
    ].map((href, i)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
            rel: "stylesheet",
            href: "" + href + dplId,
            // @ts-ignore
            precedence: "next"
        }, i));
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-router.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/ppr-navigations.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    abortTask: null,
    listenForDynamicRequest: null,
    updateCacheNodeOnNavigation: null,
    updateCacheNodeOnPopstateRestoration: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    abortTask: function() {
        return abortTask;
    },
    listenForDynamicRequest: function() {
        return listenForDynamicRequest;
    },
    updateCacheNodeOnNavigation: function() {
        return updateCacheNodeOnNavigation;
    },
    updateCacheNodeOnPopstateRestoration: function() {
        return updateCacheNodeOnPopstateRestoration;
    }
});
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
const _matchsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/match-segments.js [app-client] (ecmascript)");
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
function updateCacheNodeOnNavigation(oldCacheNode, oldRouterState, newRouterState, prefetchData, prefetchHead) {
    // Diff the old and new trees to reuse the shared layouts.
    const oldRouterStateChildren = oldRouterState[1];
    const newRouterStateChildren = newRouterState[1];
    const prefetchDataChildren = prefetchData[2];
    const oldParallelRoutes = oldCacheNode.parallelRoutes;
    // Clone the current set of segment children, even if they aren't active in
    // the new tree.
    // TODO: We currently retain all the inactive segments indefinitely, until
    // there's an explicit refresh, or a parent layout is lazily refreshed. We
    // rely on this for popstate navigations, which update the Router State Tree
    // but do not eagerly perform a data fetch, because they expect the segment
    // data to already be in the Cache Node tree. For highly static sites that
    // are mostly read-only, this may happen only rarely, causing memory to
    // leak. We should figure out a better model for the lifetime of inactive
    // segments, so we can maintain instant back/forward navigations without
    // leaking memory indefinitely.
    const prefetchParallelRoutes = new Map(oldParallelRoutes);
    // As we diff the trees, we may sometimes modify (copy-on-write, not mutate)
    // the Route Tree that was returned by the server — for example, in the case
    // of default parallel routes, we preserve the currently active segment. To
    // avoid mutating the original tree, we clone the router state children along
    // the return path.
    let patchedRouterStateChildren = {};
    let taskChildren = null;
    // For most navigations, we need to issue a "dynamic" request to fetch the
    // full RSC data from the server since during rendering, we'll only serve
    // the prefetch shell. For some navigations, we re-use the existing cache node
    // (via `spawnReusedTask`), and don't actually need fresh data from the server.
    // In those cases, we use this `needsDynamicRequest` flag to return a `null`
    // cache node, which signals to the caller that we don't need to issue a
    // dynamic request. We start off with a `false` value, and then for each parallel
    // route, we set it to `true` if we encounter a segment that needs a dynamic request.
    let needsDynamicRequest = false;
    for(let parallelRouteKey in newRouterStateChildren){
        const newRouterStateChild = newRouterStateChildren[parallelRouteKey];
        const oldRouterStateChild = oldRouterStateChildren[parallelRouteKey];
        const oldSegmentMapChild = oldParallelRoutes.get(parallelRouteKey);
        const prefetchDataChild = prefetchDataChildren[parallelRouteKey];
        const newSegmentChild = newRouterStateChild[0];
        const newSegmentKeyChild = (0, _createroutercachekey.createRouterCacheKey)(newSegmentChild);
        const oldSegmentChild = oldRouterStateChild !== undefined ? oldRouterStateChild[0] : undefined;
        const oldCacheNodeChild = oldSegmentMapChild !== undefined ? oldSegmentMapChild.get(newSegmentKeyChild) : undefined;
        let taskChild;
        if (newSegmentChild === _segment.DEFAULT_SEGMENT_KEY) {
            // This is another kind of leaf segment — a default route.
            //
            // Default routes have special behavior. When there's no matching segment
            // for a parallel route, Next.js preserves the currently active segment
            // during a client navigation — but not for initial render. The server
            // leaves it to the client to account for this. So we need to handle
            // it here.
            if (oldRouterStateChild !== undefined) {
                // Reuse the existing Router State for this segment. We spawn a "task"
                // just to keep track of the updated router state; unlike most, it's
                // already fulfilled and won't be affected by the dynamic response.
                taskChild = spawnReusedTask(oldRouterStateChild);
            } else {
                // There's no currently active segment. Switch to the "create" path.
                taskChild = spawnPendingTask(newRouterStateChild, prefetchDataChild !== undefined ? prefetchDataChild : null, prefetchHead);
            }
        } else if (oldSegmentChild !== undefined && (0, _matchsegments.matchSegment)(newSegmentChild, oldSegmentChild)) {
            if (oldCacheNodeChild !== undefined && oldRouterStateChild !== undefined) {
                // This segment exists in both the old and new trees.
                if (prefetchDataChild !== undefined && prefetchDataChild !== null) {
                    // Recursively update the children.
                    taskChild = updateCacheNodeOnNavigation(oldCacheNodeChild, oldRouterStateChild, newRouterStateChild, prefetchDataChild, prefetchHead);
                } else {
                    // The server didn't send any prefetch data for this segment. This
                    // shouldn't happen because the Route Tree and the Seed Data tree
                    // should always be the same shape, but until we unify those types
                    // it's still possible. For now we're going to deopt and trigger a
                    // lazy fetch during render.
                    taskChild = spawnTaskForMissingData(newRouterStateChild);
                }
            } else {
                // Either there's no existing Cache Node for this segment, or this
                // segment doesn't exist in the old Router State tree. Switch to the
                // "create" path.
                taskChild = spawnPendingTask(newRouterStateChild, prefetchDataChild !== undefined ? prefetchDataChild : null, prefetchHead);
            }
        } else {
            // This is a new tree. Switch to the "create" path.
            taskChild = spawnPendingTask(newRouterStateChild, prefetchDataChild !== undefined ? prefetchDataChild : null, prefetchHead);
        }
        if (taskChild !== null) {
            // Something changed in the child tree. Keep track of the child task.
            if (taskChildren === null) {
                taskChildren = new Map();
            }
            taskChildren.set(parallelRouteKey, taskChild);
            const newCacheNodeChild = taskChild.node;
            if (newCacheNodeChild !== null) {
                const newSegmentMapChild = new Map(oldSegmentMapChild);
                newSegmentMapChild.set(newSegmentKeyChild, newCacheNodeChild);
                prefetchParallelRoutes.set(parallelRouteKey, newSegmentMapChild);
                // a non-null taskChild.node means we're waiting for a dynamic request to
                // fill in the missing data
                needsDynamicRequest = true;
            }
            // The child tree's route state may be different from the prefetched
            // route sent by the server. We need to clone it as we traverse back up
            // the tree.
            patchedRouterStateChildren[parallelRouteKey] = taskChild.route;
        } else {
            // The child didn't change. We can use the prefetched router state.
            patchedRouterStateChildren[parallelRouteKey] = newRouterStateChild;
        }
    }
    if (taskChildren === null) {
        // No new tasks were spawned.
        return null;
    }
    const newCacheNode = {
        lazyData: null,
        rsc: oldCacheNode.rsc,
        // We intentionally aren't updating the prefetchRsc field, since this node
        // is already part of the current tree, because it would be weird for
        // prefetch data to be newer than the final data. It probably won't ever be
        // observable anyway, but it could happen if the segment is unmounted then
        // mounted again, because LayoutRouter will momentarily switch to rendering
        // prefetchRsc, via useDeferredValue.
        prefetchRsc: oldCacheNode.prefetchRsc,
        head: oldCacheNode.head,
        prefetchHead: oldCacheNode.prefetchHead,
        loading: oldCacheNode.loading,
        // Everything is cloned except for the children, which we computed above.
        parallelRoutes: prefetchParallelRoutes
    };
    return {
        // Return a cloned copy of the router state with updated children.
        route: patchRouterStateWithNewChildren(newRouterState, patchedRouterStateChildren),
        // Only return the new cache node if there are pending tasks that need to be resolved
        // by the dynamic data from the server. If they don't, we don't need to trigger a dynamic request.
        node: needsDynamicRequest ? newCacheNode : null,
        children: taskChildren
    };
}
function patchRouterStateWithNewChildren(baseRouterState, newChildren) {
    const clone = [
        baseRouterState[0],
        newChildren
    ];
    // Based on equivalent logic in apply-router-state-patch-to-tree, but should
    // confirm whether we need to copy all of these fields. Not sure the server
    // ever sends, e.g. the refetch marker.
    if (2 in baseRouterState) {
        clone[2] = baseRouterState[2];
    }
    if (3 in baseRouterState) {
        clone[3] = baseRouterState[3];
    }
    if (4 in baseRouterState) {
        clone[4] = baseRouterState[4];
    }
    return clone;
}
function spawnPendingTask(routerState, prefetchData, prefetchHead) {
    // Create a task that will later be fulfilled by data from the server.
    const pendingCacheNode = createPendingCacheNode(routerState, prefetchData, prefetchHead);
    return {
        route: routerState,
        node: pendingCacheNode,
        children: null
    };
}
function spawnReusedTask(reusedRouterState) {
    // Create a task that reuses an existing segment, e.g. when reusing
    // the current active segment in place of a default route.
    return {
        route: reusedRouterState,
        node: null,
        children: null
    };
}
function spawnTaskForMissingData(routerState) {
    // Create a task for a new subtree that wasn't prefetched by the server.
    // This shouldn't really ever happen but it's here just in case the Seed Data
    // Tree and the Router State Tree disagree unexpectedly.
    const pendingCacheNode = createPendingCacheNode(routerState, null, null);
    return {
        route: routerState,
        node: pendingCacheNode,
        children: null
    };
}
function listenForDynamicRequest(task, responsePromise) {
    responsePromise.then((param)=>{
        let { flightData } = param;
        for (const normalizedFlightData of flightData){
            if (typeof normalizedFlightData === 'string') {
                continue;
            }
            const { segmentPath, tree: serverRouterState, seedData: dynamicData, head: dynamicHead } = normalizedFlightData;
            if (!dynamicData) {
                continue;
            }
            writeDynamicDataIntoPendingTask(task, segmentPath, serverRouterState, dynamicData, dynamicHead);
        }
        // Now that we've exhausted all the data we received from the server, if
        // there are any remaining pending tasks in the tree, abort them now.
        // If there's any missing data, it will trigger a lazy fetch.
        abortTask(task, null);
    }, (error)=>{
        // This will trigger an error during render
        abortTask(task, error);
    });
}
function writeDynamicDataIntoPendingTask(rootTask, segmentPath, serverRouterState, dynamicData, dynamicHead) {
    // The data sent by the server represents only a subtree of the app. We need
    // to find the part of the task tree that matches the server response, and
    // fulfill it using the dynamic data.
    //
    // segmentPath represents the parent path of subtree. It's a repeating pattern
    // of parallel route key and segment:
    //
    //   [string, Segment, string, Segment, string, Segment, ...]
    //
    // Iterate through the path and finish any tasks that match this payload.
    let task = rootTask;
    for(let i = 0; i < segmentPath.length; i += 2){
        const parallelRouteKey = segmentPath[i];
        const segment = segmentPath[i + 1];
        const taskChildren = task.children;
        if (taskChildren !== null) {
            const taskChild = taskChildren.get(parallelRouteKey);
            if (taskChild !== undefined) {
                const taskSegment = taskChild.route[0];
                if ((0, _matchsegments.matchSegment)(segment, taskSegment)) {
                    // Found a match for this task. Keep traversing down the task tree.
                    task = taskChild;
                    continue;
                }
            }
        }
        // We didn't find a child task that matches the server data. Exit. We won't
        // abort the task, though, because a different FlightDataPath may be able to
        // fulfill it (see loop in listenForDynamicRequest). We only abort tasks
        // once we've run out of data.
        return;
    }
    finishTaskUsingDynamicDataPayload(task, serverRouterState, dynamicData, dynamicHead);
}
function finishTaskUsingDynamicDataPayload(task, serverRouterState, dynamicData, dynamicHead) {
    // dynamicData may represent a larger subtree than the task. Before we can
    // finish the task, we need to line them up.
    const taskChildren = task.children;
    const taskNode = task.node;
    if (taskChildren === null) {
        // We've reached the leaf node of the pending task. The server data tree
        // lines up the pending Cache Node tree. We can now switch to the
        // normal algorithm.
        if (taskNode !== null) {
            finishPendingCacheNode(taskNode, task.route, serverRouterState, dynamicData, dynamicHead);
            // Null this out to indicate that the task is complete.
            task.node = null;
        }
        return;
    }
    // The server returned more data than we need to finish the task. Skip over
    // the extra segments until we reach the leaf task node.
    const serverChildren = serverRouterState[1];
    const dynamicDataChildren = dynamicData[2];
    for(const parallelRouteKey in serverRouterState){
        const serverRouterStateChild = serverChildren[parallelRouteKey];
        const dynamicDataChild = dynamicDataChildren[parallelRouteKey];
        const taskChild = taskChildren.get(parallelRouteKey);
        if (taskChild !== undefined) {
            const taskSegment = taskChild.route[0];
            if ((0, _matchsegments.matchSegment)(serverRouterStateChild[0], taskSegment) && dynamicDataChild !== null && dynamicDataChild !== undefined) {
                // Found a match for this task. Keep traversing down the task tree.
                return finishTaskUsingDynamicDataPayload(taskChild, serverRouterStateChild, dynamicDataChild, dynamicHead);
            }
        }
    // We didn't find a child task that matches the server data. We won't abort
    // the task, though, because a different FlightDataPath may be able to
    // fulfill it (see loop in listenForDynamicRequest). We only abort tasks
    // once we've run out of data.
    }
}
function createPendingCacheNode(routerState, prefetchData, prefetchHead) {
    const routerStateChildren = routerState[1];
    const prefetchDataChildren = prefetchData !== null ? prefetchData[2] : null;
    const parallelRoutes = new Map();
    for(let parallelRouteKey in routerStateChildren){
        const routerStateChild = routerStateChildren[parallelRouteKey];
        const prefetchDataChild = prefetchDataChildren !== null ? prefetchDataChildren[parallelRouteKey] : null;
        const segmentChild = routerStateChild[0];
        const segmentKeyChild = (0, _createroutercachekey.createRouterCacheKey)(segmentChild);
        const newCacheNodeChild = createPendingCacheNode(routerStateChild, prefetchDataChild === undefined ? null : prefetchDataChild, prefetchHead);
        const newSegmentMapChild = new Map();
        newSegmentMapChild.set(segmentKeyChild, newCacheNodeChild);
        parallelRoutes.set(parallelRouteKey, newSegmentMapChild);
    }
    // The head is assigned to every leaf segment delivered by the server. Based
    // on corresponding logic in fill-lazy-items-till-leaf-with-head.ts
    const isLeafSegment = parallelRoutes.size === 0;
    const maybePrefetchRsc = prefetchData !== null ? prefetchData[1] : null;
    const maybePrefetchLoading = prefetchData !== null ? prefetchData[3] : null;
    return {
        lazyData: null,
        parallelRoutes: parallelRoutes,
        prefetchRsc: maybePrefetchRsc !== undefined ? maybePrefetchRsc : null,
        prefetchHead: isLeafSegment ? prefetchHead : null,
        loading: maybePrefetchLoading !== undefined ? maybePrefetchLoading : null,
        // Create a deferred promise. This will be fulfilled once the dynamic
        // response is received from the server.
        rsc: createDeferredRsc(),
        head: isLeafSegment ? createDeferredRsc() : null
    };
}
function finishPendingCacheNode(cacheNode, taskState, serverState, dynamicData, dynamicHead) {
    // Writes a dynamic response into an existing Cache Node tree. This does _not_
    // create a new tree, it updates the existing tree in-place. So it must follow
    // the Suspense rules of cache safety — it can resolve pending promises, but
    // it cannot overwrite existing data. It can add segments to the tree (because
    // a missing segment will cause the layout router to suspend).
    // but it cannot delete them.
    //
    // We must resolve every promise in the tree, or else it will suspend
    // indefinitely. If we did not receive data for a segment, we will resolve its
    // data promise to `null` to trigger a lazy fetch during render.
    const taskStateChildren = taskState[1];
    const serverStateChildren = serverState[1];
    const dataChildren = dynamicData[2];
    // The router state that we traverse the tree with (taskState) is the same one
    // that we used to construct the pending Cache Node tree. That way we're sure
    // to resolve all the pending promises.
    const parallelRoutes = cacheNode.parallelRoutes;
    for(let parallelRouteKey in taskStateChildren){
        const taskStateChild = taskStateChildren[parallelRouteKey];
        const serverStateChild = serverStateChildren[parallelRouteKey];
        const dataChild = dataChildren[parallelRouteKey];
        const segmentMapChild = parallelRoutes.get(parallelRouteKey);
        const taskSegmentChild = taskStateChild[0];
        const taskSegmentKeyChild = (0, _createroutercachekey.createRouterCacheKey)(taskSegmentChild);
        const cacheNodeChild = segmentMapChild !== undefined ? segmentMapChild.get(taskSegmentKeyChild) : undefined;
        if (cacheNodeChild !== undefined) {
            if (serverStateChild !== undefined && (0, _matchsegments.matchSegment)(taskSegmentChild, serverStateChild[0])) {
                if (dataChild !== undefined && dataChild !== null) {
                    // This is the happy path. Recursively update all the children.
                    finishPendingCacheNode(cacheNodeChild, taskStateChild, serverStateChild, dataChild, dynamicHead);
                } else {
                    // The server never returned data for this segment. Trigger a lazy
                    // fetch during render. This shouldn't happen because the Route Tree
                    // and the Seed Data tree sent by the server should always be the same
                    // shape when part of the same server response.
                    abortPendingCacheNode(taskStateChild, cacheNodeChild, null);
                }
            } else {
                // The server never returned data for this segment. Trigger a lazy
                // fetch during render.
                abortPendingCacheNode(taskStateChild, cacheNodeChild, null);
            }
        } else {
        // The server response matches what was expected to receive, but there's
        // no matching Cache Node in the task tree. This is a bug in the
        // implementation because we should have created a node for every
        // segment in the tree that's associated with this task.
        }
    }
    // Use the dynamic data from the server to fulfill the deferred RSC promise
    // on the Cache Node.
    const rsc = cacheNode.rsc;
    const dynamicSegmentData = dynamicData[1];
    if (rsc === null) {
        // This is a lazy cache node. We can overwrite it. This is only safe
        // because we know that the LayoutRouter suspends if `rsc` is `null`.
        cacheNode.rsc = dynamicSegmentData;
    } else if (isDeferredRsc(rsc)) {
        // This is a deferred RSC promise. We can fulfill it with the data we just
        // received from the server. If it was already resolved by a different
        // navigation, then this does nothing because we can't overwrite data.
        rsc.resolve(dynamicSegmentData);
    } else {
    // This is not a deferred RSC promise, nor is it empty, so it must have
    // been populated by a different navigation. We must not overwrite it.
    }
    // Check if this is a leaf segment. If so, it will have a `head` property with
    // a pending promise that needs to be resolved with the dynamic head from
    // the server.
    const head = cacheNode.head;
    if (isDeferredRsc(head)) {
        head.resolve(dynamicHead);
    }
}
function abortTask(task, error) {
    const cacheNode = task.node;
    if (cacheNode === null) {
        // This indicates the task is already complete.
        return;
    }
    const taskChildren = task.children;
    if (taskChildren === null) {
        // Reached the leaf task node. This is the root of a pending cache
        // node tree.
        abortPendingCacheNode(task.route, cacheNode, error);
    } else {
        // This is an intermediate task node. Keep traversing until we reach a
        // task node with no children. That will be the root of the cache node tree
        // that needs to be resolved.
        for (const taskChild of taskChildren.values()){
            abortTask(taskChild, error);
        }
    }
    // Null this out to indicate that the task is complete.
    task.node = null;
}
function abortPendingCacheNode(routerState, cacheNode, error) {
    // For every pending segment in the tree, resolve its `rsc` promise to `null`
    // to trigger a lazy fetch during render.
    //
    // Or, if an error object is provided, it will error instead.
    const routerStateChildren = routerState[1];
    const parallelRoutes = cacheNode.parallelRoutes;
    for(let parallelRouteKey in routerStateChildren){
        const routerStateChild = routerStateChildren[parallelRouteKey];
        const segmentMapChild = parallelRoutes.get(parallelRouteKey);
        if (segmentMapChild === undefined) {
            continue;
        }
        const segmentChild = routerStateChild[0];
        const segmentKeyChild = (0, _createroutercachekey.createRouterCacheKey)(segmentChild);
        const cacheNodeChild = segmentMapChild.get(segmentKeyChild);
        if (cacheNodeChild !== undefined) {
            abortPendingCacheNode(routerStateChild, cacheNodeChild, error);
        } else {
        // This shouldn't happen because we're traversing the same tree that was
        // used to construct the cache nodes in the first place.
        }
    }
    const rsc = cacheNode.rsc;
    if (isDeferredRsc(rsc)) {
        if (error === null) {
            // This will trigger a lazy fetch during render.
            rsc.resolve(null);
        } else {
            // This will trigger an error during rendering.
            rsc.reject(error);
        }
    }
    // Check if this is a leaf segment. If so, it will have a `head` property with
    // a pending promise that needs to be resolved. If an error was provided, we
    // will not resolve it with an error, since this is rendered at the root of
    // the app. We want the segment to error, not the entire app.
    const head = cacheNode.head;
    if (isDeferredRsc(head)) {
        head.resolve(null);
    }
}
function updateCacheNodeOnPopstateRestoration(oldCacheNode, routerState) {
    // A popstate navigation reads data from the local cache. It does not issue
    // new network requests (unless the cache entries have been evicted). So, we
    // update the cache to drop the prefetch data for any segment whose dynamic
    // data was already received. This prevents an unnecessary flash back to PPR
    // state during a back/forward navigation.
    //
    // This function clones the entire cache node tree and sets the `prefetchRsc`
    // field to `null` to prevent it from being rendered. We can't mutate the node
    // in place because this is a concurrent data structure.
    const routerStateChildren = routerState[1];
    const oldParallelRoutes = oldCacheNode.parallelRoutes;
    const newParallelRoutes = new Map(oldParallelRoutes);
    for(let parallelRouteKey in routerStateChildren){
        const routerStateChild = routerStateChildren[parallelRouteKey];
        const segmentChild = routerStateChild[0];
        const segmentKeyChild = (0, _createroutercachekey.createRouterCacheKey)(segmentChild);
        const oldSegmentMapChild = oldParallelRoutes.get(parallelRouteKey);
        if (oldSegmentMapChild !== undefined) {
            const oldCacheNodeChild = oldSegmentMapChild.get(segmentKeyChild);
            if (oldCacheNodeChild !== undefined) {
                const newCacheNodeChild = updateCacheNodeOnPopstateRestoration(oldCacheNodeChild, routerStateChild);
                const newSegmentMapChild = new Map(oldSegmentMapChild);
                newSegmentMapChild.set(segmentKeyChild, newCacheNodeChild);
                newParallelRoutes.set(parallelRouteKey, newSegmentMapChild);
            }
        }
    }
    // Only show prefetched data if the dynamic data is still pending.
    //
    // Tehnically, what we're actually checking is whether the dynamic network
    // response was received. But since it's a streaming response, this does not
    // mean that all the dynamic data has fully streamed in. It just means that
    // _some_ of the dynamic data was received. But as a heuristic, we assume that
    // the rest dynamic data will stream in quickly, so it's still better to skip
    // the prefetch state.
    const rsc = oldCacheNode.rsc;
    const shouldUsePrefetch = isDeferredRsc(rsc) && rsc.status === 'pending';
    return {
        lazyData: null,
        rsc,
        head: oldCacheNode.head,
        prefetchHead: shouldUsePrefetch ? oldCacheNode.prefetchHead : null,
        prefetchRsc: shouldUsePrefetch ? oldCacheNode.prefetchRsc : null,
        loading: oldCacheNode.loading,
        // These are the cloned children we computed above
        parallelRoutes: newParallelRoutes
    };
}
const DEFERRED = Symbol();
// This type exists to distinguish a DeferredRsc from a Flight promise. It's a
// compromise to avoid adding an extra field on every Cache Node, which would be
// awkward because the pre-PPR parts of codebase would need to account for it,
// too. We can remove it once type Cache Node type is more settled.
function isDeferredRsc(value) {
    return value && value.tag === DEFERRED;
}
function createDeferredRsc() {
    let resolve;
    let reject;
    const pendingRsc = new Promise((res, rej)=>{
        resolve = res;
        reject = rej;
    });
    pendingRsc.status = 'pending';
    pendingRsc.resolve = (value)=>{
        if (pendingRsc.status === 'pending') {
            const fulfilledRsc = pendingRsc;
            fulfilledRsc.status = 'fulfilled';
            fulfilledRsc.value = value;
            resolve(value);
        }
    };
    pendingRsc.reject = (error)=>{
        if (pendingRsc.status === 'pending') {
            const rejectedRsc = pendingRsc;
            rejectedRsc.status = 'rejected';
            rejectedRsc.reason = error;
            reject(error);
        }
    };
    pendingRsc.tag = DEFERRED;
    return pendingRsc;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=ppr-navigations.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/clear-cache-node-data-for-segment-path.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "clearCacheNodeDataForSegmentPath", {
    enumerable: true,
    get: function() {
        return clearCacheNodeDataForSegmentPath;
    }
});
const _flightdatahelpers = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)");
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
function clearCacheNodeDataForSegmentPath(newCache, existingCache, flightSegmentPath) {
    const isLastEntry = flightSegmentPath.length <= 2;
    const [parallelRouteKey, segment] = flightSegmentPath;
    const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(segment);
    const existingChildSegmentMap = existingCache.parallelRoutes.get(parallelRouteKey);
    let childSegmentMap = newCache.parallelRoutes.get(parallelRouteKey);
    if (!childSegmentMap || childSegmentMap === existingChildSegmentMap) {
        childSegmentMap = new Map(existingChildSegmentMap);
        newCache.parallelRoutes.set(parallelRouteKey, childSegmentMap);
    }
    const existingChildCacheNode = existingChildSegmentMap == null ? void 0 : existingChildSegmentMap.get(cacheKey);
    let childCacheNode = childSegmentMap.get(cacheKey);
    // In case of last segment start off the fetch at this level and don't copy further down.
    if (isLastEntry) {
        if (!childCacheNode || !childCacheNode.lazyData || childCacheNode === existingChildCacheNode) {
            childSegmentMap.set(cacheKey, {
                lazyData: null,
                rsc: null,
                prefetchRsc: null,
                head: null,
                prefetchHead: null,
                parallelRoutes: new Map(),
                loading: null
            });
        }
        return;
    }
    if (!childCacheNode || !existingChildCacheNode) {
        // Start fetch in the place where the existing cache doesn't have the data yet.
        if (!childCacheNode) {
            childSegmentMap.set(cacheKey, {
                lazyData: null,
                rsc: null,
                prefetchRsc: null,
                head: null,
                prefetchHead: null,
                parallelRoutes: new Map(),
                loading: null
            });
        }
        return;
    }
    if (childCacheNode === existingChildCacheNode) {
        childCacheNode = {
            lazyData: childCacheNode.lazyData,
            rsc: childCacheNode.rsc,
            prefetchRsc: childCacheNode.prefetchRsc,
            head: childCacheNode.head,
            prefetchHead: childCacheNode.prefetchHead,
            parallelRoutes: new Map(childCacheNode.parallelRoutes),
            loading: childCacheNode.loading
        };
        childSegmentMap.set(cacheKey, childCacheNode);
    }
    return clearCacheNodeDataForSegmentPath(childCacheNode, existingChildCacheNode, (0, _flightdatahelpers.getNextFlightSegmentPath)(flightSegmentPath));
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=clear-cache-node-data-for-segment-path.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/aliased-prefetch-navigations.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    addSearchParamsToPageSegments: null,
    handleAliasedPrefetchEntry: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    addSearchParamsToPageSegments: function() {
        return addSearchParamsToPageSegments;
    },
    handleAliasedPrefetchEntry: function() {
        return handleAliasedPrefetchEntry;
    }
});
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
const _approuter = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)");
const _applyrouterstatepatchtotree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-router-state-patch-to-tree.js [app-client] (ecmascript)");
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
const _fillcachewithnewsubtreedata = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-cache-with-new-subtree-data.js [app-client] (ecmascript)");
const _handlemutable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-mutable.js [app-client] (ecmascript)");
function handleAliasedPrefetchEntry(state, flightData, url, mutable) {
    let currentTree = state.tree;
    let currentCache = state.cache;
    const href = (0, _createhreffromurl.createHrefFromUrl)(url);
    let applied;
    for (const normalizedFlightData of flightData){
        // If the segment doesn't have a loading component, we don't need to do anything.
        if (!hasLoadingComponentInSeedData(normalizedFlightData.seedData)) {
            continue;
        }
        let treePatch = normalizedFlightData.tree;
        // Segments are keyed by searchParams (e.g. __PAGE__?{"foo":"bar"}). We might return a less specific, param-less entry,
        // so we ensure that the final tree contains the correct searchParams (reflected in the URL) are provided in the updated FlightRouterState tree.
        // We only do this on the first read, as otherwise we'd be overwriting the searchParams that may have already been set
        treePatch = addSearchParamsToPageSegments(treePatch, Object.fromEntries(url.searchParams));
        const { seedData, isRootRender, pathToSegment } = normalizedFlightData;
        // TODO-APP: remove ''
        const flightSegmentPathWithLeadingEmpty = [
            '',
            ...pathToSegment
        ];
        // Segments are keyed by searchParams (e.g. __PAGE__?{"foo":"bar"}). We might return a less specific, param-less entry,
        // so we ensure that the final tree contains the correct searchParams (reflected in the URL) are provided in the updated FlightRouterState tree.
        // We only do this on the first read, as otherwise we'd be overwriting the searchParams that may have already been set
        treePatch = addSearchParamsToPageSegments(treePatch, Object.fromEntries(url.searchParams));
        let newTree = (0, _applyrouterstatepatchtotree.applyRouterStatePatchToTree)(flightSegmentPathWithLeadingEmpty, currentTree, treePatch, href);
        const newCache = (0, _approuter.createEmptyCacheNode)();
        // The prefetch cache entry was aliased -- this signals that we only fill in the cache with the
        // loading state and not the actual parallel route seed data.
        if (isRootRender && seedData) {
            // Fill in the cache with the new loading / rsc data
            const rsc = seedData[1];
            const loading = seedData[3];
            newCache.loading = loading;
            newCache.rsc = rsc;
            // Construct a new tree and apply the aliased loading state for each parallel route
            fillNewTreeWithOnlyLoadingSegments(newCache, currentCache, treePatch, seedData);
        } else {
            // Copy rsc for the root node of the cache.
            newCache.rsc = currentCache.rsc;
            newCache.prefetchRsc = currentCache.prefetchRsc;
            newCache.loading = currentCache.loading;
            newCache.parallelRoutes = new Map(currentCache.parallelRoutes);
            // copy the loading state only into the leaf node (the part that changed)
            (0, _fillcachewithnewsubtreedata.fillCacheWithNewSubTreeDataButOnlyLoading)(newCache, currentCache, normalizedFlightData);
        }
        // If we don't have an updated tree, there's no reason to update the cache, as the tree
        // dictates what cache nodes to render.
        if (newTree) {
            currentTree = newTree;
            currentCache = newCache;
            applied = true;
        }
    }
    if (!applied) {
        return false;
    }
    mutable.patchedTree = currentTree;
    mutable.cache = currentCache;
    mutable.canonicalUrl = href;
    mutable.hashFragment = url.hash;
    return (0, _handlemutable.handleMutable)(state, mutable);
}
function hasLoadingComponentInSeedData(seedData) {
    if (!seedData) return false;
    const parallelRoutes = seedData[2];
    const loading = seedData[3];
    if (loading) {
        return true;
    }
    for(const key in parallelRoutes){
        if (hasLoadingComponentInSeedData(parallelRoutes[key])) {
            return true;
        }
    }
    return false;
}
function fillNewTreeWithOnlyLoadingSegments(newCache, existingCache, routerState, cacheNodeSeedData) {
    const isLastSegment = Object.keys(routerState[1]).length === 0;
    if (isLastSegment) {
        return;
    }
    for(const key in routerState[1]){
        const parallelRouteState = routerState[1][key];
        const segmentForParallelRoute = parallelRouteState[0];
        const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(segmentForParallelRoute);
        const parallelSeedData = cacheNodeSeedData !== null && cacheNodeSeedData[2][key] !== undefined ? cacheNodeSeedData[2][key] : null;
        let newCacheNode;
        if (parallelSeedData !== null) {
            // New data was sent from the server.
            const rsc = parallelSeedData[1];
            const loading = parallelSeedData[3];
            newCacheNode = {
                lazyData: null,
                // copy the layout but null the page segment as that's not meant to be used
                rsc: segmentForParallelRoute.includes(_segment.PAGE_SEGMENT_KEY) ? null : rsc,
                prefetchRsc: null,
                head: null,
                prefetchHead: null,
                parallelRoutes: new Map(),
                loading
            };
        } else {
            // No data available for this node. This will trigger a lazy fetch
            // during render.
            newCacheNode = {
                lazyData: null,
                rsc: null,
                prefetchRsc: null,
                head: null,
                prefetchHead: null,
                parallelRoutes: new Map(),
                loading: null
            };
        }
        const existingParallelRoutes = newCache.parallelRoutes.get(key);
        if (existingParallelRoutes) {
            existingParallelRoutes.set(cacheKey, newCacheNode);
        } else {
            newCache.parallelRoutes.set(key, new Map([
                [
                    cacheKey,
                    newCacheNode
                ]
            ]));
        }
        fillNewTreeWithOnlyLoadingSegments(newCacheNode, existingCache, parallelRouteState, parallelSeedData);
    }
}
function addSearchParamsToPageSegments(flightRouterState, searchParams) {
    const [segment, parallelRoutes, ...rest] = flightRouterState;
    // If it's a page segment, modify the segment by adding search params
    if (segment.includes(_segment.PAGE_SEGMENT_KEY)) {
        const newSegment = (0, _segment.addSearchParamsIfPageSegment)(segment, searchParams);
        return [
            newSegment,
            parallelRoutes,
            ...rest
        ];
    }
    // Otherwise, recurse through the parallel routes and return a new tree
    const updatedParallelRoutes = {};
    for (const [key, parallelRoute] of Object.entries(parallelRoutes)){
        updatedParallelRoutes[key] = addSearchParamsToPageSegments(parallelRoute, searchParams);
    }
    return [
        segment,
        updatedParallelRoutes,
        ...rest
    ];
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=aliased-prefetch-navigations.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/navigate-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    handleExternalUrl: null,
    navigateReducer: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    handleExternalUrl: function() {
        return handleExternalUrl;
    },
    navigateReducer: function() {
        return navigateReducer;
    }
});
const _fetchserverresponse = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js [app-client] (ecmascript)");
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _invalidatecachebelowflightsegmentpath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/invalidate-cache-below-flight-segmentpath.js [app-client] (ecmascript)");
const _applyrouterstatepatchtotree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-router-state-patch-to-tree.js [app-client] (ecmascript)");
const _shouldhardnavigate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/should-hard-navigate.js [app-client] (ecmascript)");
const _isnavigatingtonewrootlayout = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/is-navigating-to-new-root-layout.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _handlemutable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-mutable.js [app-client] (ecmascript)");
const _applyflightdata = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-flight-data.js [app-client] (ecmascript)");
const _prefetchreducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/prefetch-reducer.js [app-client] (ecmascript)");
const _approuter = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)");
const _segment = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/segment.js [app-client] (ecmascript)");
const _pprnavigations = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/ppr-navigations.js [app-client] (ecmascript)");
const _prefetchcacheutils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/prefetch-cache-utils.js [app-client] (ecmascript)");
const _clearcachenodedataforsegmentpath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/clear-cache-node-data-for-segment-path.js [app-client] (ecmascript)");
const _aliasedprefetchnavigations = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/aliased-prefetch-navigations.js [app-client] (ecmascript)");
function handleExternalUrl(state, mutable, url, pendingPush) {
    mutable.mpaNavigation = true;
    mutable.canonicalUrl = url;
    mutable.pendingPush = pendingPush;
    mutable.scrollableSegments = undefined;
    return (0, _handlemutable.handleMutable)(state, mutable);
}
function generateSegmentsFromPatch(flightRouterPatch) {
    const segments = [];
    const [segment, parallelRoutes] = flightRouterPatch;
    if (Object.keys(parallelRoutes).length === 0) {
        return [
            [
                segment
            ]
        ];
    }
    for (const [parallelRouteKey, parallelRoute] of Object.entries(parallelRoutes)){
        for (const childSegment of generateSegmentsFromPatch(parallelRoute)){
            // If the segment is empty, it means we are at the root of the tree
            if (segment === '') {
                segments.push([
                    parallelRouteKey,
                    ...childSegment
                ]);
            } else {
                segments.push([
                    segment,
                    parallelRouteKey,
                    ...childSegment
                ]);
            }
        }
    }
    return segments;
}
function triggerLazyFetchForLeafSegments(newCache, currentCache, flightSegmentPath, treePatch) {
    let appliedPatch = false;
    newCache.rsc = currentCache.rsc;
    newCache.prefetchRsc = currentCache.prefetchRsc;
    newCache.loading = currentCache.loading;
    newCache.parallelRoutes = new Map(currentCache.parallelRoutes);
    const segmentPathsToFill = generateSegmentsFromPatch(treePatch).map((segment)=>[
            ...flightSegmentPath,
            ...segment
        ]);
    for (const segmentPaths of segmentPathsToFill){
        (0, _clearcachenodedataforsegmentpath.clearCacheNodeDataForSegmentPath)(newCache, currentCache, segmentPaths);
        appliedPatch = true;
    }
    return appliedPatch;
}
function navigateReducer(state, action) {
    const { url, isExternalUrl, navigateType, shouldScroll, allowAliasing } = action;
    const mutable = {};
    const { hash } = url;
    const href = (0, _createhreffromurl.createHrefFromUrl)(url);
    const pendingPush = navigateType === 'push';
    // we want to prune the prefetch cache on every navigation to avoid it growing too large
    (0, _prefetchcacheutils.prunePrefetchCache)(state.prefetchCache);
    mutable.preserveCustomHistoryState = false;
    mutable.pendingPush = pendingPush;
    if (isExternalUrl) {
        return handleExternalUrl(state, mutable, url.toString(), pendingPush);
    }
    // Handles case where `<meta http-equiv="refresh">` tag is present,
    // which will trigger an MPA navigation.
    if (document.getElementById('__next-page-redirect')) {
        return handleExternalUrl(state, mutable, href, pendingPush);
    }
    const prefetchValues = (0, _prefetchcacheutils.getOrCreatePrefetchCacheEntry)({
        url,
        nextUrl: state.nextUrl,
        tree: state.tree,
        buildId: state.buildId,
        prefetchCache: state.prefetchCache,
        allowAliasing
    });
    const { treeAtTimeOfPrefetch, data } = prefetchValues;
    _prefetchreducer.prefetchQueue.bump(data);
    return data.then((param)=>{
        let { flightData, canonicalUrl: canonicalUrlOverride, postponed } = param;
        let isFirstRead = false;
        // we only want to mark this once
        if (!prefetchValues.lastUsedTime) {
            // important: we should only mark the cache node as dirty after we unsuspend from the call above
            prefetchValues.lastUsedTime = Date.now();
            isFirstRead = true;
        }
        // Handle case when navigating to page in `pages` from `app`
        if (typeof flightData === 'string') {
            return handleExternalUrl(state, mutable, flightData, pendingPush);
        }
        const updatedCanonicalUrl = canonicalUrlOverride ? (0, _createhreffromurl.createHrefFromUrl)(canonicalUrlOverride) : href;
        const onlyHashChange = !!hash && state.canonicalUrl.split('#', 1)[0] === updatedCanonicalUrl.split('#', 1)[0];
        // If only the hash has changed, the server hasn't sent us any new data. We can just update
        // the mutable properties responsible for URL and scroll handling and return early.
        if (onlyHashChange) {
            mutable.onlyHashChange = true;
            mutable.canonicalUrl = updatedCanonicalUrl;
            mutable.shouldScroll = shouldScroll;
            mutable.hashFragment = hash;
            mutable.scrollableSegments = [];
            return (0, _handlemutable.handleMutable)(state, mutable);
        }
        if (prefetchValues.aliased) {
            const result = (0, _aliasedprefetchnavigations.handleAliasedPrefetchEntry)(state, flightData, url, mutable);
            // We didn't return new router state because we didn't apply the aliased entry for some reason.
            // We'll re-invoke the navigation handler but ensure that we don't attempt to use the aliased entry. This
            // will create an on-demand prefetch entry.
            if (result === false) {
                return navigateReducer(state, {
                    ...action,
                    allowAliasing: false
                });
            }
            return result;
        }
        let currentTree = state.tree;
        let currentCache = state.cache;
        let scrollableSegments = [];
        for (const normalizedFlightData of flightData){
            const { pathToSegment: flightSegmentPath, seedData, head, isRootRender } = normalizedFlightData;
            let treePatch = normalizedFlightData.tree;
            // TODO-APP: remove ''
            const flightSegmentPathWithLeadingEmpty = [
                '',
                ...flightSegmentPath
            ];
            // Create new tree based on the flightSegmentPath and router state patch
            let newTree = (0, _applyrouterstatepatchtotree.applyRouterStatePatchToTree)(flightSegmentPathWithLeadingEmpty, currentTree, treePatch, href);
            // If the tree patch can't be applied to the current tree then we use the tree at time of prefetch
            // TODO-APP: This should instead fill in the missing pieces in `currentTree` with the data from `treeAtTimeOfPrefetch`, then apply the patch.
            if (newTree === null) {
                newTree = (0, _applyrouterstatepatchtotree.applyRouterStatePatchToTree)(flightSegmentPathWithLeadingEmpty, treeAtTimeOfPrefetch, treePatch, href);
            }
            if (newTree !== null) {
                if ((0, _isnavigatingtonewrootlayout.isNavigatingToNewRootLayout)(currentTree, newTree)) {
                    return handleExternalUrl(state, mutable, href, pendingPush);
                }
                if (// will send back a static response that's rendered from
                // the root. If for some reason it doesn't, we fall back to the
                // non-PPR implementation.
                // TODO: We should get rid of the else branch and do all navigations
                // via updateCacheNodeOnNavigation. The current structure is just
                // an incremental step.
                seedData && isRootRender && postponed) {
                    const task = (0, _pprnavigations.updateCacheNodeOnNavigation)(currentCache, currentTree, treePatch, seedData, head);
                    if (task !== null) {
                        // We've created a new Cache Node tree that contains a prefetched
                        // version of the next page. This can be rendered instantly.
                        // Use the tree computed by updateCacheNodeOnNavigation instead
                        // of the one computed by applyRouterStatePatchToTree.
                        // TODO: We should remove applyRouterStatePatchToTree
                        // from the PPR path entirely.
                        const patchedRouterState = task.route;
                        newTree = patchedRouterState;
                        // It's possible that `updateCacheNodeOnNavigation` only spawned tasks to reuse the existing cache,
                        // in which case `task.node` will be null, signaling we don't need to wait for a dynamic request
                        // and can simply apply the patched `FlightRouterState`.
                        if (task.node !== null) {
                            const newCache = task.node;
                            // The prefetched tree has dynamic holes in it. We initiate a
                            // dynamic request to fill them in.
                            //
                            // Do not block on the result. We'll immediately render the Cache
                            // Node tree and suspend on the dynamic parts. When the request
                            // comes in, we'll fill in missing data and ping React to
                            // re-render. Unlike the lazy fetching model in the non-PPR
                            // implementation, this is modeled as a single React update +
                            // streaming, rather than multiple top-level updates. (However,
                            // even in the new model, we'll still need to sometimes update the
                            // root multiple times per navigation, like if the server sends us
                            // a different response than we expected. For now, we revert back
                            // to the lazy fetching mechanism in that case.)
                            const dynamicRequest = (0, _fetchserverresponse.fetchServerResponse)(url, {
                                flightRouterState: currentTree,
                                nextUrl: state.nextUrl,
                                buildId: state.buildId
                            });
                            (0, _pprnavigations.listenForDynamicRequest)(task, dynamicRequest);
                            // We store the dynamic request on the `lazyData` property of the CacheNode
                            // because we're not going to await the dynamic request here. Since we're not blocking
                            // on the dynamic request, `layout-router` will
                            // task.node.lazyData = dynamicRequest
                            mutable.cache = newCache;
                        }
                    } else {
                        // Nothing changed, so reuse the old cache.
                        // TODO: What if the head changed but not any of the segment data?
                        // Is that possible? If so, we should clone the whole tree and
                        // update the head.
                        newTree = treePatch;
                    }
                } else {
                    // The static response does not include any dynamic holes, so
                    // there's no need to do a second request.
                    // TODO: As an incremental step this just reverts back to the
                    // non-PPR implementation. We can simplify this branch further,
                    // given that PPR prefetches are always static and return the whole
                    // tree. Or in the meantime we could factor it out into a
                    // separate function.
                    const cache = (0, _approuter.createEmptyCacheNode)();
                    let applied = false;
                    if (prefetchValues.status === _routerreducertypes.PrefetchCacheEntryStatus.stale && !isFirstRead) {
                        // When we have a stale prefetch entry, we only want to re-use the loading state of the route we're navigating to, to support instant loading navigations
                        // this will trigger a lazy fetch for the actual page data by nulling the `rsc` and `prefetchRsc` values for page data,
                        // while copying over the `loading` for the segment that contains the page data.
                        // We only do this on subsequent reads, as otherwise there'd be no loading data to re-use.
                        // We skip this branch if only the hash fragment has changed, as we don't want to trigger a lazy fetch in that case
                        applied = triggerLazyFetchForLeafSegments(cache, currentCache, flightSegmentPath, treePatch);
                        // since we re-used the stale cache's loading state & refreshed the data,
                        // update the `lastUsedTime` so that it can continue to be re-used for the next 30s
                        prefetchValues.lastUsedTime = Date.now();
                    } else {
                        applied = (0, _applyflightdata.applyFlightData)(currentCache, cache, normalizedFlightData, prefetchValues);
                    }
                    const hardNavigate = (0, _shouldhardnavigate.shouldHardNavigate)(flightSegmentPathWithLeadingEmpty, currentTree);
                    if (hardNavigate) {
                        // Copy rsc for the root node of the cache.
                        cache.rsc = currentCache.rsc;
                        cache.prefetchRsc = currentCache.prefetchRsc;
                        (0, _invalidatecachebelowflightsegmentpath.invalidateCacheBelowFlightSegmentPath)(cache, currentCache, flightSegmentPath);
                        // Ensure the existing cache value is used when the cache was not invalidated.
                        mutable.cache = cache;
                    } else if (applied) {
                        mutable.cache = cache;
                        // If we applied the cache, we update the "current cache" value so any other
                        // segments in the FlightDataPath will be able to reference the updated cache.
                        currentCache = cache;
                    }
                }
                currentTree = newTree;
                for (const subSegment of generateSegmentsFromPatch(treePatch)){
                    const scrollableSegmentPath = [
                        ...flightSegmentPath,
                        ...subSegment
                    ];
                    // Filter out the __DEFAULT__ paths as they shouldn't be scrolled to in this case.
                    if (scrollableSegmentPath[scrollableSegmentPath.length - 1] !== _segment.DEFAULT_SEGMENT_KEY) {
                        scrollableSegments.push(scrollableSegmentPath);
                    }
                }
            }
        }
        mutable.patchedTree = currentTree;
        mutable.canonicalUrl = updatedCanonicalUrl;
        mutable.scrollableSegments = scrollableSegments;
        mutable.hashFragment = hash;
        mutable.shouldScroll = shouldScroll;
        return (0, _handlemutable.handleMutable)(state, mutable);
    }, ()=>state);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=navigate-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/server-patch-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "serverPatchReducer", {
    enumerable: true,
    get: function() {
        return serverPatchReducer;
    }
});
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _applyrouterstatepatchtotree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-router-state-patch-to-tree.js [app-client] (ecmascript)");
const _isnavigatingtonewrootlayout = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/is-navigating-to-new-root-layout.js [app-client] (ecmascript)");
const _navigatereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/navigate-reducer.js [app-client] (ecmascript)");
const _applyflightdata = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-flight-data.js [app-client] (ecmascript)");
const _handlemutable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-mutable.js [app-client] (ecmascript)");
const _approuter = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)");
function serverPatchReducer(state, action) {
    const { serverResponse: { flightData, canonicalUrl: canonicalUrlOverride } } = action;
    const mutable = {};
    mutable.preserveCustomHistoryState = false;
    // Handle case when navigating to page in `pages` from `app`
    if (typeof flightData === 'string') {
        return (0, _navigatereducer.handleExternalUrl)(state, mutable, flightData, state.pushRef.pendingPush);
    }
    let currentTree = state.tree;
    let currentCache = state.cache;
    for (const normalizedFlightData of flightData){
        const { segmentPath: flightSegmentPath, tree: treePatch } = normalizedFlightData;
        const newTree = (0, _applyrouterstatepatchtotree.applyRouterStatePatchToTree)([
            '',
            ...flightSegmentPath
        ], currentTree, treePatch, state.canonicalUrl);
        // `applyRouterStatePatchToTree` returns `null` when it determined that the server response is not applicable to the current tree.
        // In other words, the server responded with a tree that doesn't match what the client is currently rendering.
        // This can happen if the server patch action took longer to resolve than a subsequent navigation which would have changed the tree.
        // Previously this case triggered an MPA navigation but it should be safe to simply discard the server response rather than forcing
        // the entire page to reload.
        if (newTree === null) {
            return state;
        }
        if ((0, _isnavigatingtonewrootlayout.isNavigatingToNewRootLayout)(currentTree, newTree)) {
            return (0, _navigatereducer.handleExternalUrl)(state, mutable, state.canonicalUrl, state.pushRef.pendingPush);
        }
        const canonicalUrlOverrideHref = canonicalUrlOverride ? (0, _createhreffromurl.createHrefFromUrl)(canonicalUrlOverride) : undefined;
        if (canonicalUrlOverrideHref) {
            mutable.canonicalUrl = canonicalUrlOverrideHref;
        }
        const cache = (0, _approuter.createEmptyCacheNode)();
        (0, _applyflightdata.applyFlightData)(currentCache, cache, normalizedFlightData);
        mutable.patchedTree = newTree;
        mutable.cache = cache;
        currentCache = cache;
        currentTree = newTree;
    }
    return (0, _handlemutable.handleMutable)(state, mutable);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=server-patch-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/restore-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "restoreReducer", {
    enumerable: true,
    get: function() {
        return restoreReducer;
    }
});
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _computechangedpath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/compute-changed-path.js [app-client] (ecmascript)");
const _pprnavigations = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/ppr-navigations.js [app-client] (ecmascript)");
function restoreReducer(state, action) {
    const { url, tree } = action;
    const href = (0, _createhreffromurl.createHrefFromUrl)(url);
    // This action is used to restore the router state from the history state.
    // However, it's possible that the history state no longer contains the `FlightRouterState`.
    // We will copy over the internal state on pushState/replaceState events, but if a history entry
    // occurred before hydration, or if the user navigated to a hash using a regular anchor link,
    // the history state will not contain the `FlightRouterState`.
    // In this case, we'll continue to use the existing tree so the router doesn't get into an invalid state.
    const treeToRestore = tree || state.tree;
    const oldCache = state.cache;
    const newCache = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : oldCache;
    var _extractPathFromFlightRouterState;
    return {
        buildId: state.buildId,
        // Set canonical url
        canonicalUrl: href,
        pushRef: {
            pendingPush: false,
            mpaNavigation: false,
            // Ensures that the custom history state that was set is preserved when applying this update.
            preserveCustomHistoryState: true
        },
        focusAndScrollRef: state.focusAndScrollRef,
        cache: newCache,
        prefetchCache: state.prefetchCache,
        // Restore provided tree
        tree: treeToRestore,
        nextUrl: (_extractPathFromFlightRouterState = (0, _computechangedpath.extractPathFromFlightRouterState)(treeToRestore)) != null ? _extractPathFromFlightRouterState : url.pathname
    };
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=restore-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-segment-mismatch.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "handleSegmentMismatch", {
    enumerable: true,
    get: function() {
        return handleSegmentMismatch;
    }
});
const _navigatereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/navigate-reducer.js [app-client] (ecmascript)");
function handleSegmentMismatch(state, action, treePatch) {
    if ("TURBOPACK compile-time truthy", 1) {
        console.warn('Performing hard navigation because your application experienced an unrecoverable error. If this keeps occurring, please file a Next.js issue.\n\n' + 'Reason: Segment mismatch\n' + ("Last Action: " + action.type + "\n\n") + ("Current Tree: " + JSON.stringify(state.tree) + "\n\n") + ("Tree Patch Payload: " + JSON.stringify(treePatch)));
    }
    return (0, _navigatereducer.handleExternalUrl)(state, {}, state.canonicalUrl, true);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=handle-segment-mismatch.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/has-interception-route-in-current-tree.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "hasInterceptionRouteInCurrentTree", {
    enumerable: true,
    get: function() {
        return hasInterceptionRouteInCurrentTree;
    }
});
const _interceptionroutes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/lib/interception-routes.js [app-client] (ecmascript)");
function hasInterceptionRouteInCurrentTree(param) {
    let [segment, parallelRoutes] = param;
    // If we have a dynamic segment, it's marked as an interception route by the presence of the `i` suffix.
    if (Array.isArray(segment) && (segment[2] === 'di' || segment[2] === 'ci')) {
        return true;
    }
    // If segment is not an array, apply the existing string-based check
    if (typeof segment === 'string' && (0, _interceptionroutes.isInterceptionRouteAppPath)(segment)) {
        return true;
    }
    // Iterate through parallelRoutes if they exist
    if (parallelRoutes) {
        for(const key in parallelRoutes){
            if (hasInterceptionRouteInCurrentTree(parallelRoutes[key])) {
                return true;
            }
        }
    }
    return false;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=has-interception-route-in-current-tree.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/refresh-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "refreshReducer", {
    enumerable: true,
    get: function() {
        return refreshReducer;
    }
});
const _fetchserverresponse = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js [app-client] (ecmascript)");
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _applyrouterstatepatchtotree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-router-state-patch-to-tree.js [app-client] (ecmascript)");
const _isnavigatingtonewrootlayout = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/is-navigating-to-new-root-layout.js [app-client] (ecmascript)");
const _navigatereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/navigate-reducer.js [app-client] (ecmascript)");
const _handlemutable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-mutable.js [app-client] (ecmascript)");
const _filllazyitemstillleafwithhead = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-lazy-items-till-leaf-with-head.js [app-client] (ecmascript)");
const _approuter = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)");
const _handlesegmentmismatch = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-segment-mismatch.js [app-client] (ecmascript)");
const _hasinterceptionrouteincurrenttree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/has-interception-route-in-current-tree.js [app-client] (ecmascript)");
const _refetchinactiveparallelsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/refetch-inactive-parallel-segments.js [app-client] (ecmascript)");
function refreshReducer(state, action) {
    const { origin } = action;
    const mutable = {};
    const href = state.canonicalUrl;
    let currentTree = state.tree;
    mutable.preserveCustomHistoryState = false;
    const cache = (0, _approuter.createEmptyCacheNode)();
    // If the current tree was intercepted, the nextUrl should be included in the request.
    // This is to ensure that the refresh request doesn't get intercepted, accidentally triggering the interception route.
    const includeNextUrl = (0, _hasinterceptionrouteincurrenttree.hasInterceptionRouteInCurrentTree)(state.tree);
    // TODO-APP: verify that `href` is not an external url.
    // Fetch data from the root of the tree.
    cache.lazyData = (0, _fetchserverresponse.fetchServerResponse)(new URL(href, origin), {
        flightRouterState: [
            currentTree[0],
            currentTree[1],
            currentTree[2],
            'refetch'
        ],
        nextUrl: includeNextUrl ? state.nextUrl : null,
        buildId: state.buildId
    });
    return cache.lazyData.then(async (param)=>{
        let { flightData, canonicalUrl: canonicalUrlOverride } = param;
        // Handle case when navigating to page in `pages` from `app`
        if (typeof flightData === 'string') {
            return (0, _navigatereducer.handleExternalUrl)(state, mutable, flightData, state.pushRef.pendingPush);
        }
        // Remove cache.lazyData as it has been resolved at this point.
        cache.lazyData = null;
        for (const normalizedFlightData of flightData){
            const { tree: treePatch, seedData: cacheNodeSeedData, head, isRootRender } = normalizedFlightData;
            if (!isRootRender) {
                // TODO-APP: handle this case better
                console.log('REFRESH FAILED');
                return state;
            }
            const newTree = (0, _applyrouterstatepatchtotree.applyRouterStatePatchToTree)([
                ''
            ], currentTree, treePatch, state.canonicalUrl);
            if (newTree === null) {
                return (0, _handlesegmentmismatch.handleSegmentMismatch)(state, action, treePatch);
            }
            if ((0, _isnavigatingtonewrootlayout.isNavigatingToNewRootLayout)(currentTree, newTree)) {
                return (0, _navigatereducer.handleExternalUrl)(state, mutable, href, state.pushRef.pendingPush);
            }
            const canonicalUrlOverrideHref = canonicalUrlOverride ? (0, _createhreffromurl.createHrefFromUrl)(canonicalUrlOverride) : undefined;
            if (canonicalUrlOverride) {
                mutable.canonicalUrl = canonicalUrlOverrideHref;
            }
            // Handles case where prefetch only returns the router tree patch without rendered components.
            if (cacheNodeSeedData !== null) {
                const rsc = cacheNodeSeedData[1];
                const loading = cacheNodeSeedData[3];
                cache.rsc = rsc;
                cache.prefetchRsc = null;
                cache.loading = loading;
                (0, _filllazyitemstillleafwithhead.fillLazyItemsTillLeafWithHead)(cache, undefined, treePatch, cacheNodeSeedData, head);
                mutable.prefetchCache = new Map();
            }
            await (0, _refetchinactiveparallelsegments.refreshInactiveParallelSegments)({
                state,
                updatedTree: newTree,
                updatedCache: cache,
                includeNextUrl,
                canonicalUrl: mutable.canonicalUrl || state.canonicalUrl
            });
            mutable.cache = cache;
            mutable.patchedTree = newTree;
            currentTree = newTree;
        }
        return (0, _handlemutable.handleMutable)(state, mutable);
    }, ()=>state);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=refresh-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/hmr-refresh-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "hmrRefreshReducer", {
    enumerable: true,
    get: function() {
        return hmrRefreshReducer;
    }
});
const _fetchserverresponse = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js [app-client] (ecmascript)");
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _applyrouterstatepatchtotree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-router-state-patch-to-tree.js [app-client] (ecmascript)");
const _isnavigatingtonewrootlayout = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/is-navigating-to-new-root-layout.js [app-client] (ecmascript)");
const _navigatereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/navigate-reducer.js [app-client] (ecmascript)");
const _handlemutable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-mutable.js [app-client] (ecmascript)");
const _applyflightdata = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-flight-data.js [app-client] (ecmascript)");
const _approuter = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)");
const _handlesegmentmismatch = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-segment-mismatch.js [app-client] (ecmascript)");
const _hasinterceptionrouteincurrenttree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/has-interception-route-in-current-tree.js [app-client] (ecmascript)");
// A version of refresh reducer that keeps the cache around instead of wiping all of it.
function hmrRefreshReducerImpl(state, action) {
    const { origin } = action;
    const mutable = {};
    const href = state.canonicalUrl;
    mutable.preserveCustomHistoryState = false;
    const cache = (0, _approuter.createEmptyCacheNode)();
    // If the current tree was intercepted, the nextUrl should be included in the request.
    // This is to ensure that the refresh request doesn't get intercepted, accidentally triggering the interception route.
    const includeNextUrl = (0, _hasinterceptionrouteincurrenttree.hasInterceptionRouteInCurrentTree)(state.tree);
    // TODO-APP: verify that `href` is not an external url.
    // Fetch data from the root of the tree.
    cache.lazyData = (0, _fetchserverresponse.fetchServerResponse)(new URL(href, origin), {
        flightRouterState: [
            state.tree[0],
            state.tree[1],
            state.tree[2],
            'refetch'
        ],
        nextUrl: includeNextUrl ? state.nextUrl : null,
        buildId: state.buildId,
        isHmrRefresh: true
    });
    return cache.lazyData.then((param)=>{
        let { flightData, canonicalUrl: canonicalUrlOverride } = param;
        // Handle case when navigating to page in `pages` from `app`
        if (typeof flightData === 'string') {
            return (0, _navigatereducer.handleExternalUrl)(state, mutable, flightData, state.pushRef.pendingPush);
        }
        // Remove cache.lazyData as it has been resolved at this point.
        cache.lazyData = null;
        let currentTree = state.tree;
        let currentCache = state.cache;
        for (const normalizedFlightData of flightData){
            const { tree: treePatch, isRootRender } = normalizedFlightData;
            if (!isRootRender) {
                // TODO-APP: handle this case better
                console.log('REFRESH FAILED');
                return state;
            }
            const newTree = (0, _applyrouterstatepatchtotree.applyRouterStatePatchToTree)([
                ''
            ], currentTree, treePatch, state.canonicalUrl);
            if (newTree === null) {
                return (0, _handlesegmentmismatch.handleSegmentMismatch)(state, action, treePatch);
            }
            if ((0, _isnavigatingtonewrootlayout.isNavigatingToNewRootLayout)(currentTree, newTree)) {
                return (0, _navigatereducer.handleExternalUrl)(state, mutable, href, state.pushRef.pendingPush);
            }
            const canonicalUrlOverrideHref = canonicalUrlOverride ? (0, _createhreffromurl.createHrefFromUrl)(canonicalUrlOverride) : undefined;
            if (canonicalUrlOverride) {
                mutable.canonicalUrl = canonicalUrlOverrideHref;
            }
            const applied = (0, _applyflightdata.applyFlightData)(currentCache, cache, normalizedFlightData);
            if (applied) {
                mutable.cache = cache;
                currentCache = cache;
            }
            mutable.patchedTree = newTree;
            mutable.canonicalUrl = href;
            currentTree = newTree;
        }
        return (0, _handlemutable.handleMutable)(state, mutable);
    }, ()=>state);
}
function hmrRefreshReducerNoop(state, _action) {
    return state;
}
const hmrRefreshReducer = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : hmrRefreshReducerImpl;
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=hmr-refresh-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/assign-location.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "assignLocation", {
    enumerable: true,
    get: function() {
        return assignLocation;
    }
});
const _addbasepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/add-base-path.js [app-client] (ecmascript)");
function assignLocation(location, url) {
    if (location.startsWith('.')) {
        const urlBase = url.origin + url.pathname;
        return new URL(// new URL('./relative', 'https://example.com/subdir').href -> 'https://example.com/relative'
        // new URL('./relative', 'https://example.com/subdir/').href -> 'https://example.com/subdir/relative'
        (urlBase.endsWith('/') ? urlBase : urlBase + '/') + location);
    }
    return new URL((0, _addbasepath.addBasePath)(location), url.href);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=assign-location.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "serverActionReducer", {
    enumerable: true,
    get: function() {
        return serverActionReducer;
    }
});
const _appcallserver = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-call-server.js [app-client] (ecmascript)");
const _appfindsourcemapurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-find-source-map-url.js [app-client] (ecmascript)");
const _approuterheaders = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router-headers.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _assignlocation = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/assign-location.js [app-client] (ecmascript)");
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _navigatereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/navigate-reducer.js [app-client] (ecmascript)");
const _applyrouterstatepatchtotree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/apply-router-state-patch-to-tree.js [app-client] (ecmascript)");
const _isnavigatingtonewrootlayout = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/is-navigating-to-new-root-layout.js [app-client] (ecmascript)");
const _handlemutable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-mutable.js [app-client] (ecmascript)");
const _filllazyitemstillleafwithhead = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-lazy-items-till-leaf-with-head.js [app-client] (ecmascript)");
const _approuter = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)");
const _hasinterceptionrouteincurrenttree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/has-interception-route-in-current-tree.js [app-client] (ecmascript)");
const _handlesegmentmismatch = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/handle-segment-mismatch.js [app-client] (ecmascript)");
const _refetchinactiveparallelsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/refetch-inactive-parallel-segments.js [app-client] (ecmascript)");
const _flightdatahelpers = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)");
const _redirect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect.js [app-client] (ecmascript)");
const _prefetchcacheutils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/prefetch-cache-utils.js [app-client] (ecmascript)");
const _removebasepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/remove-base-path.js [app-client] (ecmascript)");
const _hasbasepath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/has-base-path.js [app-client] (ecmascript)");
// // eslint-disable-next-line import/no-extraneous-dependencies
// import { createFromFetch } from 'react-server-dom-webpack/client'
// // eslint-disable-next-line import/no-extraneous-dependencies
// import { encodeReply } from 'react-server-dom-webpack/client'
const { createFromFetch, createTemporaryReferenceSet, encodeReply } = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/client.js [app-client] (ecmascript)");
async function fetchServerAction(state, nextUrl, param) {
    let { actionId, actionArgs } = param;
    const temporaryReferences = createTemporaryReferenceSet();
    const body = await encodeReply(actionArgs, {
        temporaryReferences
    });
    const res = await fetch('', {
        method: 'POST',
        headers: {
            Accept: _approuterheaders.RSC_CONTENT_TYPE_HEADER,
            [_approuterheaders.ACTION_HEADER]: actionId,
            [_approuterheaders.NEXT_ROUTER_STATE_TREE_HEADER]: encodeURIComponent(JSON.stringify(state.tree)),
            ...("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : {},
            ...nextUrl ? {
                [_approuterheaders.NEXT_URL]: nextUrl
            } : {}
        },
        body
    });
    const redirectHeader = res.headers.get('x-action-redirect');
    const [location, _redirectType] = (redirectHeader == null ? void 0 : redirectHeader.split(';')) || [];
    let redirectType;
    switch(_redirectType){
        case 'push':
            redirectType = _redirect.RedirectType.push;
            break;
        case 'replace':
            redirectType = _redirect.RedirectType.replace;
            break;
        default:
            redirectType = undefined;
    }
    const isPrerender = !!res.headers.get(_approuterheaders.NEXT_IS_PRERENDER_HEADER);
    let revalidatedParts;
    try {
        const revalidatedHeader = JSON.parse(res.headers.get('x-action-revalidated') || '[[],0,0]');
        revalidatedParts = {
            paths: revalidatedHeader[0] || [],
            tag: !!revalidatedHeader[1],
            cookie: revalidatedHeader[2]
        };
    } catch (e) {
        revalidatedParts = {
            paths: [],
            tag: false,
            cookie: false
        };
    }
    const redirectLocation = location ? (0, _assignlocation.assignLocation)(location, new URL(state.canonicalUrl, window.location.href)) : undefined;
    const contentType = res.headers.get('content-type');
    if (contentType == null ? void 0 : contentType.startsWith(_approuterheaders.RSC_CONTENT_TYPE_HEADER)) {
        const response = await createFromFetch(Promise.resolve(res), {
            callServer: _appcallserver.callServer,
            findSourceMapURL: _appfindsourcemapurl.findSourceMapURL,
            temporaryReferences
        });
        if (location) {
            // if it was a redirection, then result is just a regular RSC payload
            return {
                actionFlightData: (0, _flightdatahelpers.normalizeFlightData)(response.f),
                redirectLocation,
                redirectType,
                revalidatedParts,
                isPrerender
            };
        }
        return {
            actionResult: response.a,
            actionFlightData: (0, _flightdatahelpers.normalizeFlightData)(response.f),
            redirectLocation,
            redirectType,
            revalidatedParts,
            isPrerender
        };
    }
    // Handle invalid server action responses
    if (res.status >= 400) {
        // The server can respond with a text/plain error message, but we'll fallback to something generic
        // if there isn't one.
        const error = contentType === 'text/plain' ? await res.text() : 'An unexpected response was received from the server.';
        throw new Error(error);
    }
    return {
        redirectLocation,
        redirectType,
        revalidatedParts,
        isPrerender
    };
}
function serverActionReducer(state, action) {
    const { resolve, reject } = action;
    const mutable = {};
    const href = state.canonicalUrl;
    let currentTree = state.tree;
    mutable.preserveCustomHistoryState = false;
    // only pass along the `nextUrl` param (used for interception routes) if the current route was intercepted.
    // If the route has been intercepted, the action should be as well.
    // Otherwise the server action might be intercepted with the wrong action id
    // (ie, one that corresponds with the intercepted route)
    const nextUrl = state.nextUrl && (0, _hasinterceptionrouteincurrenttree.hasInterceptionRouteInCurrentTree)(state.tree) ? state.nextUrl : null;
    return fetchServerAction(state, nextUrl, action).then(async (param)=>{
        let { actionResult, actionFlightData: flightData, redirectLocation, redirectType, isPrerender, revalidatedParts } = param;
        // honor the redirect type instead of defaulting to push in case of server actions.
        if (redirectLocation) {
            if (redirectType === _redirect.RedirectType.replace) {
                state.pushRef.pendingPush = false;
                mutable.pendingPush = false;
            } else {
                state.pushRef.pendingPush = true;
                mutable.pendingPush = true;
            }
        }
        if (!flightData) {
            resolve(actionResult);
            // If there is a redirect but no flight data we need to do a mpaNavigation.
            if (redirectLocation) {
                return (0, _navigatereducer.handleExternalUrl)(state, mutable, redirectLocation.href, state.pushRef.pendingPush);
            }
            return state;
        }
        if (typeof flightData === 'string') {
            // Handle case when navigating to page in `pages` from `app`
            return (0, _navigatereducer.handleExternalUrl)(state, mutable, flightData, state.pushRef.pendingPush);
        }
        const actionRevalidated = revalidatedParts.paths.length > 0 || revalidatedParts.tag || revalidatedParts.cookie;
        for (const normalizedFlightData of flightData){
            const { tree: treePatch, seedData: cacheNodeSeedData, head, isRootRender } = normalizedFlightData;
            if (!isRootRender) {
                // TODO-APP: handle this case better
                console.log('SERVER ACTION APPLY FAILED');
                return state;
            }
            // Given the path can only have two items the items are only the router state and rsc for the root.
            const newTree = (0, _applyrouterstatepatchtotree.applyRouterStatePatchToTree)([
                ''
            ], currentTree, treePatch, redirectLocation ? (0, _createhreffromurl.createHrefFromUrl)(redirectLocation) : state.canonicalUrl);
            if (newTree === null) {
                return (0, _handlesegmentmismatch.handleSegmentMismatch)(state, action, treePatch);
            }
            if ((0, _isnavigatingtonewrootlayout.isNavigatingToNewRootLayout)(currentTree, newTree)) {
                return (0, _navigatereducer.handleExternalUrl)(state, mutable, href, state.pushRef.pendingPush);
            }
            // The server sent back RSC data for the server action, so we need to apply it to the cache.
            if (cacheNodeSeedData !== null) {
                const rsc = cacheNodeSeedData[1];
                const cache = (0, _approuter.createEmptyCacheNode)();
                cache.rsc = rsc;
                cache.prefetchRsc = null;
                cache.loading = cacheNodeSeedData[3];
                (0, _filllazyitemstillleafwithhead.fillLazyItemsTillLeafWithHead)(cache, undefined, treePatch, cacheNodeSeedData, head);
                mutable.cache = cache;
                mutable.prefetchCache = new Map();
                if (actionRevalidated) {
                    await (0, _refetchinactiveparallelsegments.refreshInactiveParallelSegments)({
                        state,
                        updatedTree: newTree,
                        updatedCache: cache,
                        includeNextUrl: Boolean(nextUrl),
                        canonicalUrl: mutable.canonicalUrl || state.canonicalUrl
                    });
                }
            }
            mutable.patchedTree = newTree;
            currentTree = newTree;
        }
        if (redirectLocation) {
            const newHref = (0, _createhreffromurl.createHrefFromUrl)(redirectLocation, false);
            mutable.canonicalUrl = newHref;
            // Because the RedirectBoundary will trigger a navigation, we need to seed the prefetch cache
            // with the FlightData that we got from the server action for the target page, so that it's
            // available when the page is navigated to and doesn't need to be re-fetched.
            // We only do this if the server action didn't revalidate any data, as in that case the
            // client cache will be cleared and the data will be re-fetched anyway.
            if (!actionRevalidated) {
                (0, _prefetchcacheutils.createSeededPrefetchCacheEntry)({
                    url: redirectLocation,
                    data: {
                        flightData,
                        canonicalUrl: undefined,
                        couldBeIntercepted: false,
                        prerendered: false,
                        postponed: false,
                        // TODO: We should be able to set this if the server action
                        // returned a fully static response.
                        staleTime: -1
                    },
                    tree: state.tree,
                    prefetchCache: state.prefetchCache,
                    nextUrl: state.nextUrl,
                    kind: isPrerender ? _routerreducertypes.PrefetchKind.FULL : _routerreducertypes.PrefetchKind.AUTO
                });
                mutable.prefetchCache = state.prefetchCache;
            }
            // If the action triggered a redirect, the action promise promise will be rejected with
            // a redirect so that it's handled by RedirectBoundary as we won't have a valid
            // action result to resolve the promise with. This will effectively reset the state of
            // the component that called the action as the error boundary will remount the tree.
            // The status code doesn't matter here as the action handler will have already sent
            // a response with the correct status code.
            reject((0, _redirect.getRedirectError)((0, _hasbasepath.hasBasePath)(newHref) ? (0, _removebasepath.removeBasePath)(newHref) : newHref, redirectType || _redirect.RedirectType.push));
        } else {
            resolve(actionResult);
        }
        return (0, _handlemutable.handleMutable)(state, mutable);
    }, (e)=>{
        // When the server action is rejected we don't update the state and instead call the reject handler of the promise.
        reject(e);
        return state;
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=server-action-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "reducer", {
    enumerable: true,
    get: function() {
        return reducer;
    }
});
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _navigatereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/navigate-reducer.js [app-client] (ecmascript)");
const _serverpatchreducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/server-patch-reducer.js [app-client] (ecmascript)");
const _restorereducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/restore-reducer.js [app-client] (ecmascript)");
const _refreshreducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/refresh-reducer.js [app-client] (ecmascript)");
const _prefetchreducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/prefetch-reducer.js [app-client] (ecmascript)");
const _hmrrefreshreducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/hmr-refresh-reducer.js [app-client] (ecmascript)");
const _serveractionreducer = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js [app-client] (ecmascript)");
/**
 * Reducer that handles the app-router state updates.
 */ function clientReducer(state, action) {
    switch(action.type){
        case _routerreducertypes.ACTION_NAVIGATE:
            {
                return (0, _navigatereducer.navigateReducer)(state, action);
            }
        case _routerreducertypes.ACTION_SERVER_PATCH:
            {
                return (0, _serverpatchreducer.serverPatchReducer)(state, action);
            }
        case _routerreducertypes.ACTION_RESTORE:
            {
                return (0, _restorereducer.restoreReducer)(state, action);
            }
        case _routerreducertypes.ACTION_REFRESH:
            {
                return (0, _refreshreducer.refreshReducer)(state, action);
            }
        case _routerreducertypes.ACTION_HMR_REFRESH:
            {
                return (0, _hmrrefreshreducer.hmrRefreshReducer)(state, action);
            }
        case _routerreducertypes.ACTION_PREFETCH:
            {
                return (0, _prefetchreducer.prefetchReducer)(state, action);
            }
        case _routerreducertypes.ACTION_SERVER_ACTION:
            {
                return (0, _serveractionreducer.serverActionReducer)(state, action);
            }
        // This case should never be hit as dispatch is strongly typed.
        default:
            throw new Error('Unknown action');
    }
}
function serverReducer(state, _action) {
    return state;
}
const reducer = typeof window === 'undefined' ? serverReducer : clientReducer;
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=router-reducer.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-initial-router-state.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createInitialRouterState", {
    enumerable: true,
    get: function() {
        return createInitialRouterState;
    }
});
const _createhreffromurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-href-from-url.js [app-client] (ecmascript)");
const _filllazyitemstillleafwithhead = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fill-lazy-items-till-leaf-with-head.js [app-client] (ecmascript)");
const _computechangedpath = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/compute-changed-path.js [app-client] (ecmascript)");
const _prefetchcacheutils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/prefetch-cache-utils.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _refetchinactiveparallelsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/refetch-inactive-parallel-segments.js [app-client] (ecmascript)");
const _flightdatahelpers = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/flight-data-helpers.js [app-client] (ecmascript)");
function createInitialRouterState(param) {
    let { buildId, initialFlightData, initialCanonicalUrlParts, initialParallelRoutes, location, couldBeIntercepted, postponed, prerendered } = param;
    // When initialized on the server, the canonical URL is provided as an array of parts.
    // This is to ensure that when the RSC payload streamed to the client, crawlers don't interpret it
    // as a URL that should be crawled.
    const initialCanonicalUrl = initialCanonicalUrlParts.join('/');
    const normalizedFlightData = (0, _flightdatahelpers.getFlightDataPartsFromPath)(initialFlightData[0]);
    const { tree: initialTree, seedData: initialSeedData, head: initialHead } = normalizedFlightData;
    const isServer = !location;
    // For the SSR render, seed data should always be available (we only send back a `null` response
    // in the case of a `loading` segment, pre-PPR.)
    const rsc = initialSeedData == null ? void 0 : initialSeedData[1];
    var _initialSeedData_;
    const loading = (_initialSeedData_ = initialSeedData == null ? void 0 : initialSeedData[3]) != null ? _initialSeedData_ : null;
    const cache = {
        lazyData: null,
        rsc,
        prefetchRsc: null,
        head: null,
        prefetchHead: null,
        // The cache gets seeded during the first render. `initialParallelRoutes` ensures the cache from the first render is there during the second render.
        parallelRoutes: isServer ? new Map() : initialParallelRoutes,
        loading
    };
    const canonicalUrl = // This is safe to do as canonicalUrl can't be rendered, it's only used to control the history updates in the useEffect further down in this file.
    location ? (0, _createhreffromurl.createHrefFromUrl)(location) : initialCanonicalUrl;
    (0, _refetchinactiveparallelsegments.addRefreshMarkerToActiveParallelSegments)(initialTree, canonicalUrl);
    const prefetchCache = new Map();
    // When the cache hasn't been seeded yet we fill the cache with the head.
    if (initialParallelRoutes === null || initialParallelRoutes.size === 0) {
        (0, _filllazyitemstillleafwithhead.fillLazyItemsTillLeafWithHead)(cache, undefined, initialTree, initialSeedData, initialHead);
    }
    var _ref;
    const initialState = {
        buildId,
        tree: initialTree,
        cache,
        prefetchCache,
        pushRef: {
            pendingPush: false,
            mpaNavigation: false,
            // First render needs to preserve the previous window.history.state
            // to avoid it being overwritten on navigation back/forward with MPA Navigation.
            preserveCustomHistoryState: true
        },
        focusAndScrollRef: {
            apply: false,
            onlyHashChange: false,
            hashFragment: null,
            segmentPaths: []
        },
        canonicalUrl,
        nextUrl: (_ref = (0, _computechangedpath.extractPathFromFlightRouterState)(initialTree) || (location == null ? void 0 : location.pathname)) != null ? _ref : null
    };
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    return initialState;
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=create-initial-router-state.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/client-entry.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createDevOverlayElement", {
    enumerable: true,
    get: function() {
        return createDevOverlayElement;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _ReactDevOverlay = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js [app-client] (ecmascript)"));
const _getsocketurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/internal/helpers/get-socket-url.js [app-client] (ecmascript)");
const _shared = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/shared.js [app-client] (ecmascript)");
const _hotreloadertypes = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/dev/hot-reloader-types.js [app-client] (ecmascript)");
function createDevOverlayElement(reactEl) {
    const rootLayoutMissingTags = window.__next_root_layout_missing_tags;
    const hasMissingTags = !!(rootLayoutMissingTags == null ? void 0 : rootLayoutMissingTags.length);
    const socketUrl = (0, _getsocketurl.getSocketUrl)(("TURBOPACK compile-time value", "") || '');
    const socket = new window.WebSocket("" + socketUrl + "/_next/webpack-hmr");
    // add minimal "hot reload" support for RSC errors
    const handler = (event)=>{
        let obj;
        try {
            obj = JSON.parse(event.data);
        } catch (e) {}
        if (!obj || !('action' in obj)) {
            return;
        }
        if (obj.action === _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.SERVER_COMPONENT_CHANGES) {
            window.location.reload();
        }
    };
    socket.addEventListener('message', handler);
    const FallbackLayout = hasMissingTags ? (param)=>{
        let { children } = param;
        return /*#__PURE__*/ (0, _jsxruntime.jsx)("html", {
            id: "__next_error__",
            children: /*#__PURE__*/ (0, _jsxruntime.jsx)("body", {
                children: children
            })
        });
    } : _react.default.Fragment;
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(FallbackLayout, {
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_ReactDevOverlay.default, {
            state: {
                ..._shared.INITIAL_OVERLAY_STATE,
                rootLayoutMissingTags
            },
            children: reactEl
        })
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=client-entry.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-link-gc.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "linkGc", {
    enumerable: true,
    get: function() {
        return linkGc;
    }
});
function linkGc() {
    // TODO-APP: Remove this logic when Float has GC built-in in development.
    if ("TURBOPACK compile-time truthy", 1) {
        const callback = (mutationList)=>{
            for (const mutation of mutationList){
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes){
                        if ('tagName' in node && node.tagName === 'LINK') {
                            var _link_dataset_precedence;
                            const link = node;
                            if ((_link_dataset_precedence = link.dataset.precedence) == null ? void 0 : _link_dataset_precedence.startsWith('next')) {
                                const href = link.getAttribute('href');
                                if (href) {
                                    const [resource, version] = href.split('?v=', 2);
                                    if (version) {
                                        const currentOrigin = window.location.origin;
                                        const allLinks = [
                                            ...document.querySelectorAll('link[href^="' + resource + '"]'),
                                            // It's possible that the resource is a full URL or only pathname,
                                            // so we need to remove the alternative href as well.
                                            ...document.querySelectorAll('link[href^="' + (resource.startsWith(currentOrigin) ? resource.slice(currentOrigin.length) : currentOrigin + resource) + '"]')
                                        ];
                                        for (const otherLink of allLinks){
                                            var _otherLink_dataset_precedence;
                                            if ((_otherLink_dataset_precedence = otherLink.dataset.precedence) == null ? void 0 : _otherLink_dataset_precedence.startsWith('next')) {
                                                const otherHref = otherLink.getAttribute('href');
                                                if (otherHref) {
                                                    const [, otherVersion] = otherHref.split('?v=', 2);
                                                    if (!otherVersion || +otherVersion < +version) {
                                                        // Delay the removal of the stylesheet to avoid FOUC
                                                        // caused by `@font-face` rules, as they seem to be
                                                        // a couple of ticks delayed between the old and new
                                                        // styles being swapped even if the font is cached.
                                                        setTimeout(()=>{
                                                            otherLink.remove();
                                                        }, 5);
                                                        const preloadLink = document.querySelector('link[rel="preload"][as="style"][href="' + otherHref + '"]');
                                                        if (preloadLink) {
                                                            preloadLink.remove();
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(callback);
        observer.observe(document.head, {
            childList: true
        });
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-link-gc.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
// imports polyfill from `@next/polyfill-module` after build.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "hydrate", {
    enumerable: true,
    get: function() {
        return hydrate;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/polyfill-module.js [app-client] (ecmascript)");
__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/globals/patch-console.js [app-client] (ecmascript)");
__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/globals/handle-global-errors.js [app-client] (ecmascript)");
const _client = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-dom/client.js [app-client] (ecmascript)"));
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _client1 = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/client.js [app-client] (ecmascript)");
const _headmanagercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/head-manager-context.shared-runtime.js [app-client] (ecmascript)");
const _shared = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/react-client-callbacks/shared.js [app-client] (ecmascript)");
const _approuter = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/react-client-callbacks/app-router.js [app-client] (ecmascript)");
const _appcallserver = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-call-server.js [app-client] (ecmascript)");
const _appfindsourcemapurl = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-find-source-map-url.js [app-client] (ecmascript)");
const _actionqueue = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/action-queue.js [app-client] (ecmascript)");
const _approuter1 = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/app-router.js [app-client] (ecmascript)"));
const _createinitialrouterstate = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-initial-router-state.js [app-client] (ecmascript)");
const _approutercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
/// <reference types="react-dom/experimental" />
const appElement = document;
const encoder = new TextEncoder();
let initialServerDataBuffer = undefined;
let initialServerDataWriter = undefined;
let initialServerDataLoaded = false;
let initialServerDataFlushed = false;
let initialFormStateData = null;
function nextServerDataCallback(seg) {
    if (seg[0] === 0) {
        initialServerDataBuffer = [];
    } else if (seg[0] === 1) {
        if (!initialServerDataBuffer) throw new Error('Unexpected server data: missing bootstrap script.');
        if (initialServerDataWriter) {
            initialServerDataWriter.enqueue(encoder.encode(seg[1]));
        } else {
            initialServerDataBuffer.push(seg[1]);
        }
    } else if (seg[0] === 2) {
        initialFormStateData = seg[1];
    } else if (seg[0] === 3) {
        if (!initialServerDataBuffer) throw new Error('Unexpected server data: missing bootstrap script.');
        // Decode the base64 string back to binary data.
        const binaryString = atob(seg[1]);
        const decodedChunk = new Uint8Array(binaryString.length);
        for(var i = 0; i < binaryString.length; i++){
            decodedChunk[i] = binaryString.charCodeAt(i);
        }
        if (initialServerDataWriter) {
            initialServerDataWriter.enqueue(decodedChunk);
        } else {
            initialServerDataBuffer.push(decodedChunk);
        }
    }
}
function isStreamErrorOrUnfinished(ctr) {
    // If `desiredSize` is null, it means the stream is closed or errored. If it is lower than 0, the stream is still unfinished.
    return ctr.desiredSize === null || ctr.desiredSize < 0;
}
// There might be race conditions between `nextServerDataRegisterWriter` and
// `DOMContentLoaded`. The former will be called when React starts to hydrate
// the root, the latter will be called when the DOM is fully loaded.
// For streaming, the former is called first due to partial hydration.
// For non-streaming, the latter can be called first.
// Hence, we use two variables `initialServerDataLoaded` and
// `initialServerDataFlushed` to make sure the writer will be closed and
// `initialServerDataBuffer` will be cleared in the right time.
function nextServerDataRegisterWriter(ctr) {
    if (initialServerDataBuffer) {
        initialServerDataBuffer.forEach((val)=>{
            ctr.enqueue(typeof val === 'string' ? encoder.encode(val) : val);
        });
        if (initialServerDataLoaded && !initialServerDataFlushed) {
            if (isStreamErrorOrUnfinished(ctr)) {
                ctr.error(new Error('The connection to the page was unexpectedly closed, possibly due to the stop button being clicked, loss of Wi-Fi, or an unstable internet connection.'));
            } else {
                ctr.close();
            }
            initialServerDataFlushed = true;
            initialServerDataBuffer = undefined;
        }
    }
    initialServerDataWriter = ctr;
}
// When `DOMContentLoaded`, we can close all pending writers to finish hydration.
const DOMContentLoaded = function() {
    if (initialServerDataWriter && !initialServerDataFlushed) {
        initialServerDataWriter.close();
        initialServerDataFlushed = true;
        initialServerDataBuffer = undefined;
    }
    initialServerDataLoaded = true;
};
// It's possible that the DOM is already loaded.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', DOMContentLoaded, false);
} else {
    // Delayed in marco task to ensure it's executed later than hydration
    setTimeout(DOMContentLoaded);
}
const nextServerDataLoadingGlobal = self.__next_f = self.__next_f || [];
nextServerDataLoadingGlobal.forEach(nextServerDataCallback);
nextServerDataLoadingGlobal.push = nextServerDataCallback;
const readable = new ReadableStream({
    start (controller) {
        nextServerDataRegisterWriter(controller);
    }
});
const initialServerResponse = (0, _client1.createFromReadableStream)(readable, {
    callServer: _appcallserver.callServer,
    findSourceMapURL: _appfindsourcemapurl.findSourceMapURL
});
// React overrides `.then` and doesn't return a new promise chain,
// so we wrap the action queue in a promise to ensure that its value
// is defined when the promise resolves.
// https://github.com/facebook/react/blob/163365a07872337e04826c4f501565d43dbd2fd4/packages/react-client/src/ReactFlightClient.js#L189-L190
const pendingActionQueue = new Promise((resolve, reject)=>{
    initialServerResponse.then((initialRSCPayload)=>{
        resolve((0, _actionqueue.createMutableActionQueue)((0, _createinitialrouterstate.createInitialRouterState)({
            buildId: initialRSCPayload.b,
            initialFlightData: initialRSCPayload.f,
            initialCanonicalUrlParts: initialRSCPayload.c,
            initialParallelRoutes: new Map(),
            location: window.location,
            couldBeIntercepted: initialRSCPayload.i,
            postponed: initialRSCPayload.s,
            prerendered: initialRSCPayload.S
        })));
    }, (err)=>reject(err));
});
function ServerRoot() {
    const initialRSCPayload = (0, _react.use)(initialServerResponse);
    const actionQueue = (0, _react.use)(pendingActionQueue);
    const router = /*#__PURE__*/ (0, _jsxruntime.jsx)(_approuter1.default, {
        actionQueue: actionQueue,
        globalErrorComponentAndStyles: initialRSCPayload.G,
        assetPrefix: initialRSCPayload.p
    });
    if (("TURBOPACK compile-time value", "development") === 'development' && initialRSCPayload.m) {
        // We provide missing slot information in a context provider only during development
        // as we log some additional information about the missing slots in the console.
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(_approutercontextsharedruntime.MissingSlotContext, {
            value: initialRSCPayload.m,
            children: router
        });
    }
    return router;
}
const StrictModeIfEnabled = ("TURBOPACK compile-time truthy", 1) ? _react.default.StrictMode : ("TURBOPACK unreachable", undefined);
function Root(param) {
    let { children } = param;
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    return children;
}
const reactRootOptions = {
    onRecoverableError: _shared.onRecoverableError,
    onCaughtError: _approuter.onCaughtError,
    onUncaughtError: _approuter.onUncaughtError
};
function hydrate() {
    const reactEl = /*#__PURE__*/ (0, _jsxruntime.jsx)(StrictModeIfEnabled, {
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_headmanagercontextsharedruntime.HeadManagerContext.Provider, {
            value: {
                appDir: true
            },
            children: /*#__PURE__*/ (0, _jsxruntime.jsx)(Root, {
                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(ServerRoot, {})
            })
        })
    });
    const rootLayoutMissingTags = window.__next_root_layout_missing_tags;
    const hasMissingTags = !!(rootLayoutMissingTags == null ? void 0 : rootLayoutMissingTags.length);
    const isError = document.documentElement.id === '__next_error__' || hasMissingTags;
    if (isError) {
        if ("TURBOPACK compile-time truthy", 1) {
            const createDevOverlayElement = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/react-dev-overlay/client-entry.js [app-client] (ecmascript)").createDevOverlayElement;
            const errorTree = createDevOverlayElement(reactEl);
            _client.default.createRoot(appElement, reactRootOptions).render(errorTree);
        } else {
            "TURBOPACK unreachable";
        }
    } else {
        _react.default.startTransition(()=>_client.default.hydrateRoot(appElement, reactEl, {
                ...reactRootOptions,
                formState: initialFormStateData
            }));
    }
    // TODO-APP: Remove this logic when Float has GC built-in in development.
    if ("TURBOPACK compile-time truthy", 1) {
        const { linkGc } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-link-gc.js [app-client] (ecmascript)");
        linkGc();
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-index.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-next-turbopack.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
// TODO-APP: hydration warning
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _appbootstrap = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-bootstrap.js [app-client] (ecmascript)");
window.next.version += '-turbo';
self.__webpack_hash__ = '';
(0, _appbootstrap.appBootstrap)(()=>{
    const { hydrate } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/app-index.js [app-client] (ecmascript)");
    hydrate();
}) // TODO-APP: build indicator
;
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=app-next-turbopack.js.map
}}),
}]);

//# sourceMappingURL=78671_next_dist_client_4faed6._.js.map
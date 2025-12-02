"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRedirectionMethodError = exports.makeRedirectionError = exports.makeIllegalRedirectError = exports.makeTimeoutError = exports.makeAbortedError = exports.make100Error = exports.handleSignalAndTimeout = exports.setupFetch = void 0;
const http2_1 = require("http2");
const url_1 = require("url");
const already_1 = require("already");
const body_1 = require("./body");
const core_1 = require("./core");
const headers_1 = require("./headers");
const utils_1 = require("./utils");
const { 
// Required for a request
HTTP2_HEADER_METHOD, HTTP2_HEADER_SCHEME, HTTP2_HEADER_PATH, HTTP2_HEADER_AUTHORITY, 
// Methods
HTTP2_METHOD_GET, HTTP2_METHOD_HEAD, 
// Requests
HTTP2_HEADER_USER_AGENT, HTTP2_HEADER_ACCEPT, HTTP2_HEADER_COOKIE, HTTP2_HEADER_CONTENT_TYPE, HTTP2_HEADER_CONTENT_LENGTH, HTTP2_HEADER_ACCEPT_ENCODING, } = http2_1.constants;
function ensureNotCircularRedirection(redirections) {
    const urls = [...redirections];
    const last = urls.pop();
    for (let i = 0; i < urls.length; ++i)
        if (urls[i] === last) {
            const err = new Error("Redirection loop detected");
            err.urls = urls.slice(i);
            throw err;
        }
}
const makeDefaultEncodings = (mul = 1) => (0, utils_1.hasBuiltinBrotli)()
    ? [
        { name: "br", score: 1.0 * mul },
        { name: "gzip", score: 0.8 * mul },
        { name: "deflate", score: 0.5 * mul },
    ]
    : [
        { name: "gzip", score: 1.0 * mul },
        { name: "deflate", score: 0.5 * mul },
    ];
const defaultEncodings = makeDefaultEncodings();
const fallbackEncodings = makeDefaultEncodings(0.8);
const stringifyEncoding = (acceptEncoding) => `${acceptEncoding.name};q=${acceptEncoding.score}`;
const stringifyEncodings = (accepts) => accepts
    .map(acceptEncoding => stringifyEncoding(acceptEncoding))
    .join(", ");
function getEncodings(contentDecoders) {
    if (contentDecoders.length === 0)
        return stringifyEncodings(defaultEncodings);
    const makeScore = (index) => 1 - (index / (contentDecoders.length)) * 0.2;
    return stringifyEncodings([
        ...contentDecoders.map(({ name }, index) => ({ name, score: makeScore(index) })),
        ...fallbackEncodings,
    ]);
}
async function setupFetch(session, request, init = {}, extra) {
    const { redirected } = extra;
    ensureNotCircularRedirection(redirected);
    const { url, method, redirect, integrity } = request;
    const { signal, onTrailers } = init;
    const { origin, protocol, host, pathname, search, hash, } = new url_1.URL(url);
    const path = pathname + search + hash;
    const endStream = method === HTTP2_METHOD_GET || method === HTTP2_METHOD_HEAD;
    const headers = new headers_1.Headers(request.headers);
    const cookies = (await session.cookieJar.getCookies(url))
        .map(cookie => cookie.cookieString());
    const contentDecoders = session.contentDecoders();
    const acceptEncoding = getEncodings(contentDecoders);
    if (headers.has(HTTP2_HEADER_COOKIE))
        cookies.push(...(0, utils_1.arrayify)(headers.get(HTTP2_HEADER_COOKIE)));
    if (!headers.has("host"))
        headers.set("host", host);
    const headersToSend = {
        // Set required headers
        ...(session.protocol === "http1" ? {} : {
            [HTTP2_HEADER_METHOD]: method,
            [HTTP2_HEADER_SCHEME]: protocol.replace(/:.*/, ""),
            [HTTP2_HEADER_PATH]: path,
        }),
        // Set default headers
        [HTTP2_HEADER_ACCEPT]: session.accept(),
        [HTTP2_HEADER_USER_AGENT]: session.userAgent(),
        [HTTP2_HEADER_ACCEPT_ENCODING]: acceptEncoding,
    };
    if (cookies.length > 0)
        headersToSend[HTTP2_HEADER_COOKIE] = cookies.join("; ");
    for (const [key, val] of headers.entries()) {
        if (key === "host" && session.protocol === "http2")
            // Convert to :authority like curl does:
            // https://github.com/grantila/fetch-h2/issues/9
            headersToSend[HTTP2_HEADER_AUTHORITY] = val;
        else if (key !== HTTP2_HEADER_COOKIE)
            headersToSend[key] = val;
    }
    const inspector = new body_1.BodyInspector(request);
    if (!endStream &&
        inspector.length != null &&
        !request.headers.has(HTTP2_HEADER_CONTENT_LENGTH))
        headersToSend[HTTP2_HEADER_CONTENT_LENGTH] = "" + inspector.length;
    if (!endStream &&
        !request.headers.has("content-type") &&
        inspector.mime)
        headersToSend[HTTP2_HEADER_CONTENT_TYPE] = inspector.mime;
    function timeoutError() {
        return new core_1.TimeoutError(`${method} ${url} timed out after ${init.timeout} ms`);
    }
    const timeoutAt = extra.timeoutAt || (("timeout" in init && typeof init.timeout === "number")
        // Setting the timeoutAt here at first time allows async cookie
        // jar to not take part of timeout for at least the first request
        // (in a potential redirect chain)
        ? Date.now() + init.timeout
        : void 0);
    function setupTimeout() {
        if (!timeoutAt)
            return null;
        const now = Date.now();
        if (now >= timeoutAt)
            throw timeoutError();
        let timerId;
        return {
            clear: () => {
                if (timerId)
                    clearTimeout(timerId);
            },
            promise: new Promise((_resolve, reject) => {
                timerId = setTimeout(() => {
                    timerId = null;
                    reject(timeoutError());
                }, timeoutAt - now);
            }),
        };
    }
    const timeoutInfo = setupTimeout();
    function abortError() {
        return new core_1.AbortError(`${method} ${url} aborted`);
    }
    if (signal && signal.aborted)
        throw abortError();
    let abortHandler;
    const signalPromise = signal
        ?
            new Promise((_resolve, reject) => {
                signal.once("abort", abortHandler = () => {
                    reject(abortError());
                });
            })
        : null;
    function cleanup() {
        var _a, _b;
        (_a = timeoutInfo === null || timeoutInfo === void 0 ? void 0 : timeoutInfo.clear) === null || _a === void 0 ? void 0 : _a.call(timeoutInfo);
        (_b = timeoutInfo === null || timeoutInfo === void 0 ? void 0 : timeoutInfo.promise) === null || _b === void 0 ? void 0 : _b.catch(_err => { });
        if (signal && abortHandler)
            signal.removeListener("abort", abortHandler);
    }
    return {
        cleanup,
        contentDecoders,
        endStream,
        headersToSend,
        integrity,
        method,
        onTrailers,
        origin,
        redirect,
        redirected,
        request,
        signal,
        signalPromise,
        timeoutAt,
        timeoutInfo,
        url,
    };
}
exports.setupFetch = setupFetch;
function handleSignalAndTimeout(signalPromise, timeoutInfo, cleanup, fetcher, onError) {
    return Promise.race([
        signalPromise,
        (timeoutInfo && timeoutInfo.promise),
        fetcher().catch((0, already_1.rethrow)(onError)),
    ]
        .filter(promise => promise))
        .finally(cleanup);
}
exports.handleSignalAndTimeout = handleSignalAndTimeout;
function make100Error() {
    return new Error("Request failed with 100 continue. " +
        "This can't happen unless a server failure");
}
exports.make100Error = make100Error;
function makeAbortedError() {
    return new core_1.AbortError("Request aborted");
}
exports.makeAbortedError = makeAbortedError;
function makeTimeoutError() {
    return new core_1.TimeoutError("Request timed out");
}
exports.makeTimeoutError = makeTimeoutError;
function makeIllegalRedirectError() {
    return new Error("Server responded illegally with a " +
        "redirect code but missing 'location' header");
}
exports.makeIllegalRedirectError = makeIllegalRedirectError;
function makeRedirectionError(location) {
    return new Error(`URL got redirected to ${location}`);
}
exports.makeRedirectionError = makeRedirectionError;
function makeRedirectionMethodError(location, method) {
    return new Error(`URL got redirected to ${location}, which ` +
        `'fetch-h2' doesn't support for ${method}`);
}
exports.makeRedirectionMethodError = makeRedirectionMethodError;
//# sourceMappingURL=fetch-common.js.map
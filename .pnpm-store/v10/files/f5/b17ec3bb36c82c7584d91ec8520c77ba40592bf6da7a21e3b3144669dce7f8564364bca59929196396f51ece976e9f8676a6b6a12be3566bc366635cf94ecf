"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = void 0;
const http2_1 = require("http2");
const callguard_1 = require("callguard");
const abort_1 = require("./abort");
const core_1 = require("./core");
const fetch_common_1 = require("./fetch-common");
const headers_1 = require("./headers");
const response_1 = require("./response");
const utils_1 = require("./utils");
const utils_http2_1 = require("./utils-http2");
const { 
// Responses
HTTP2_HEADER_STATUS, HTTP2_HEADER_LOCATION, HTTP2_HEADER_SET_COOKIE, 
// Error codes
NGHTTP2_NO_ERROR, } = http2_1.constants;
// This is from nghttp2.h, but undocumented in Node.js
const NGHTTP2_ERR_START_STREAM_NOT_ALLOWED = -516;
async function fetchImpl(session, input, init = {}, extra) {
    const { cleanup, contentDecoders, endStream, headersToSend, integrity, method, onTrailers, origin, redirect, redirected, request, signal, signalPromise, timeoutAt, timeoutInfo, url, } = await (0, fetch_common_1.setupFetch)(session, input, init, extra);
    const { raceConditionedGoaway } = extra;
    const streamPromise = session.get();
    async function doFetch() {
        const { session: ph2session, cleanup: socketCleanup } = streamPromise;
        const h2session = await ph2session;
        const tryRetryOnGoaway = (resolve) => {
            // This could be due to a race-condition in GOAWAY.
            // As of current Node.js, the 'goaway' event is emitted on the
            // session before this event (at least frameError, probably
            // 'error' too) is emitted, so we will know if we got it.
            if (!raceConditionedGoaway.has(origin) &&
                (0, utils_http2_1.hasGotGoaway)(h2session)) {
                // Don't retry again due to potential GOAWAY
                raceConditionedGoaway.add(origin);
                // Since we've got the 'goaway' event, the
                // context has already released the session,
                // so a retry will create a new session.
                resolve(fetchImpl(session, request, { signal, onTrailers }, {
                    raceConditionedGoaway,
                    redirected,
                    timeoutAt,
                }));
                return true;
            }
            return false;
        };
        let stream;
        let shouldCleanupSocket = true;
        try {
            stream = h2session.request(headersToSend, { endStream });
        }
        catch (err) {
            if (err.code === "ERR_HTTP2_GOAWAY_SESSION") {
                // Retry with new session
                throw new core_1.RetryError(err.code);
            }
            throw err;
        }
        const response = new Promise((resolve, reject) => {
            const guard = (0, callguard_1.syncGuard)(reject, { catchAsync: true });
            stream.on("aborted", guard((..._whatever) => {
                reject((0, fetch_common_1.makeAbortedError)());
            }));
            stream.on("error", guard((err) => {
                if (err &&
                    err.code === "ERR_HTTP2_STREAM_ERROR" &&
                    err.message &&
                    err.message.includes("NGHTTP2_REFUSED_STREAM")) {
                    if (tryRetryOnGoaway(resolve))
                        return;
                }
                reject(err);
            }));
            stream.on("frameError", guard((_type, code, _streamId) => {
                if (code === NGHTTP2_ERR_START_STREAM_NOT_ALLOWED &&
                    endStream) {
                    if (tryRetryOnGoaway(resolve))
                        return;
                }
                reject(new Error("Request failed"));
            }));
            stream.on("close", guard(() => {
                if (shouldCleanupSocket)
                    socketCleanup();
                // We'll get an 'error' event if there actually is an
                // error, but not if we got NGHTTP2_NO_ERROR.
                // In case of an error, the 'error' event will be awaited
                // instead, to get (and propagate) the error object.
                if (stream.rstCode === NGHTTP2_NO_ERROR)
                    reject(new core_1.AbortError("Stream prematurely closed"));
            }));
            stream.on("timeout", guard((..._whatever) => {
                reject((0, fetch_common_1.makeTimeoutError)());
            }));
            stream.on("trailers", guard((_headers, _flags) => {
                if (!onTrailers)
                    return;
                try {
                    const headers = new headers_1.GuardedHeaders("response");
                    Object.keys(_headers).forEach(key => {
                        if (Array.isArray(_headers[key]))
                            _headers[key]
                                .forEach(value => headers.append(key, value));
                        else
                            headers.set(key, "" + _headers[key]);
                    });
                    onTrailers(headers);
                }
                catch (err) {
                    // TODO: Implement #8
                    // tslint:disable-next-line
                    console.warn("Trailer handling failed", err);
                }
            }));
            // ClientHttp2Stream events
            stream.on("continue", guard((..._whatever) => {
                reject((0, fetch_common_1.make100Error)());
            }));
            stream.on("response", guard((headers) => {
                const { signal: bodySignal = void 0, abort: bodyAbort = void 0, } = signal ? new abort_1.AbortController() : {};
                if (signal) {
                    const abortHandler = () => {
                        bodyAbort();
                        stream.destroy();
                    };
                    if (signal.aborted) {
                        // No reason to continue, the request is aborted
                        abortHandler();
                        return;
                    }
                    signal.once("abort", abortHandler);
                    stream.once("close", () => {
                        signal.removeListener("abort", abortHandler);
                    });
                }
                const status = "" + headers[HTTP2_HEADER_STATUS];
                const location = (0, utils_1.parseLocation)(headers[HTTP2_HEADER_LOCATION], url);
                const isRedirected = utils_1.isRedirectStatus[status];
                if (headers[HTTP2_HEADER_SET_COOKIE]) {
                    const setCookies = (0, utils_1.arrayify)(headers[HTTP2_HEADER_SET_COOKIE]);
                    session.cookieJar.setCookies(setCookies, url);
                }
                if (!input.allowForbiddenHeaders) {
                    delete headers["set-cookie"];
                    delete headers["set-cookie2"];
                }
                if (isRedirected && !location)
                    return reject((0, fetch_common_1.makeIllegalRedirectError)());
                if (!isRedirected || redirect === "manual")
                    return resolve(new response_1.StreamResponse(contentDecoders, url, stream, headers, redirect === "manual"
                        ? false
                        : extra.redirected.length > 0, {}, bodySignal, 2, input.allowForbiddenHeaders, integrity));
                const { url: locationUrl, isRelative } = location;
                if (redirect === "error")
                    return reject((0, fetch_common_1.makeRedirectionError)(locationUrl));
                // redirect is 'follow'
                // We don't support re-sending a non-GET/HEAD request (as
                // we don't want to [can't, if its' streamed] re-send the
                // body). The concept is fundementally broken anyway...
                if (!endStream)
                    return reject((0, fetch_common_1.makeRedirectionMethodError)(locationUrl, method));
                if (!location)
                    return reject((0, fetch_common_1.makeIllegalRedirectError)());
                if (isRelative) {
                    shouldCleanupSocket = false;
                    stream.destroy();
                    resolve(fetchImpl(session, request.clone(locationUrl), init, {
                        raceConditionedGoaway,
                        redirected: redirected.concat(url),
                        timeoutAt,
                    }));
                }
                else {
                    resolve(session.newFetch(request.clone(locationUrl), init, {
                        timeoutAt,
                        redirected: redirected.concat(url),
                    }));
                }
            }));
        });
        if (!endStream)
            await request.readable()
                .then(readable => {
                (0, utils_1.pipeline)(readable, stream)
                    .catch(_err => {
                    // TODO: Implement error handling
                });
            });
        return response;
    }
    return (0, fetch_common_1.handleSignalAndTimeout)(signalPromise, timeoutInfo, cleanup, doFetch, streamPromise.cleanup);
}
function fetch(session, input, init, extra) {
    var _a;
    const http2Extra = {
        timeoutAt: extra === null || extra === void 0 ? void 0 : extra.timeoutAt,
        redirected: (_a = extra === null || extra === void 0 ? void 0 : extra.redirected) !== null && _a !== void 0 ? _a : [],
        raceConditionedGoaway: new Set(),
    };
    return fetchImpl(session, input, init, http2Extra);
}
exports.fetch = fetch;
//# sourceMappingURL=fetch-http2.js.map
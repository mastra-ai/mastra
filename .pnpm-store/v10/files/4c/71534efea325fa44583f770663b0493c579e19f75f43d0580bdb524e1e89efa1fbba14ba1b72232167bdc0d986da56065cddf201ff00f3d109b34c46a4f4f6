"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = exports.fetchImpl = void 0;
const http2_1 = require("http2");
const callguard_1 = require("callguard");
const abort_1 = require("./abort");
const fetch_common_1 = require("./fetch-common");
const headers_1 = require("./headers");
const response_1 = require("./response");
const utils_1 = require("./utils");
const { 
// Responses, these are the same in HTTP/1.1 and HTTP/2
HTTP2_HEADER_LOCATION: HTTP1_HEADER_LOCATION, HTTP2_HEADER_SET_COOKIE: HTTP1_HEADER_SET_COOKIE, } = http2_1.constants;
async function fetchImpl(session, input, init = {}, extra) {
    const { cleanup, contentDecoders, endStream, headersToSend, integrity, method, onTrailers, redirect, redirected, request, signal, signalPromise, timeoutAt, timeoutInfo, url, } = await (0, fetch_common_1.setupFetch)(session, input, init, extra);
    const { req, cleanup: socketCleanup } = session.get(url);
    const doFetch = async () => {
        for (const [key, value] of Object.entries(headersToSend)) {
            if (value != null)
                req.setHeader(key, value);
        }
        const response = new Promise((resolve, reject) => {
            const guard = (0, callguard_1.syncGuard)(reject, { catchAsync: true });
            req.once("error", reject);
            req.once("aborted", guard(() => {
                reject((0, fetch_common_1.makeAbortedError)());
            }));
            req.once("continue", guard(() => {
                reject((0, fetch_common_1.make100Error)());
            }));
            req.once("information", guard((res) => {
                resolve(new response_1.Response(null, // No body
                { status: res.statusCode }));
            }));
            req.once("timeout", guard(() => {
                reject((0, fetch_common_1.makeTimeoutError)());
                req.abort();
            }));
            req.once("upgrade", guard((_res, _socket, _upgradeHead) => {
                reject(new Error("Upgrade not implemented!"));
                req.abort();
            }));
            req.once("response", guard((res) => {
                res.once("end", socketCleanup);
                const { signal: bodySignal = void 0, abort: bodyAbort = void 0, } = signal ? new abort_1.AbortController() : {};
                if (signal) {
                    const abortHandler = () => {
                        bodyAbort();
                        req.abort();
                        res.destroy();
                    };
                    if (signal.aborted) {
                        // No reason to continue, the request is aborted
                        abortHandler();
                        return;
                    }
                    signal.once("abort", abortHandler);
                    res.once("end", () => {
                        signal.removeListener("abort", abortHandler);
                    });
                }
                const { headers, statusCode } = res;
                res.once("end", guard(() => {
                    if (!onTrailers)
                        return;
                    try {
                        const { trailers } = res;
                        const headers = new headers_1.GuardedHeaders("response");
                        Object.keys(trailers).forEach(key => {
                            if (trailers[key] != null)
                                headers.set(key, "" + trailers[key]);
                        });
                        onTrailers(headers);
                    }
                    catch (err) {
                        // TODO: Implement #8
                        // tslint:disable-next-line
                        console.warn("Trailer handling failed", err);
                    }
                }));
                const location = (0, utils_1.parseLocation)(headers[HTTP1_HEADER_LOCATION], url);
                const isRedirected = utils_1.isRedirectStatus["" + statusCode];
                if (headers[HTTP1_HEADER_SET_COOKIE]) {
                    const setCookies = (0, utils_1.arrayify)(headers[HTTP1_HEADER_SET_COOKIE]);
                    session.cookieJar.setCookies(setCookies, url);
                }
                if (!input.allowForbiddenHeaders) {
                    delete headers["set-cookie"];
                    delete headers["set-cookie2"];
                }
                if (isRedirected && !location)
                    return reject((0, fetch_common_1.makeIllegalRedirectError)());
                if (!isRedirected || redirect === "manual")
                    return resolve(new response_1.StreamResponse(contentDecoders, url, res, headers, redirect === "manual"
                        ? false
                        : extra.redirected.length > 0, {
                        status: res.statusCode,
                        statusText: res.statusMessage,
                    }, bodySignal, 1, input.allowForbiddenHeaders, integrity));
                const { url: locationUrl, isRelative } = location;
                if (redirect === "error")
                    return reject((0, fetch_common_1.makeRedirectionError)(locationUrl));
                // redirect is 'follow'
                // We don't support re-sending a non-GET/HEAD request (as
                // we don't want to [can't, if its' streamed] re-send the
                // body). The concept is fundementally broken anyway...
                if (!endStream)
                    return reject((0, fetch_common_1.makeRedirectionMethodError)(locationUrl, method));
                res.destroy();
                if (isRelative) {
                    resolve(fetchImpl(session, request.clone(locationUrl), { signal, onTrailers }, {
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
        if (endStream)
            req.end();
        else
            await request.readable()
                .then(readable => {
                (0, utils_1.pipeline)(readable, req)
                    .catch(_err => {
                    // TODO: Implement error handling
                });
            });
        return response;
    };
    return (0, fetch_common_1.handleSignalAndTimeout)(signalPromise, timeoutInfo, cleanup, doFetch, socketCleanup);
}
exports.fetchImpl = fetchImpl;
function fetch(session, input, init, extra) {
    var _a;
    extra = {
        timeoutAt: extra === null || extra === void 0 ? void 0 : extra.timeoutAt,
        redirected: (_a = extra === null || extra === void 0 ? void 0 : extra.redirected) !== null && _a !== void 0 ? _a : [],
    };
    return fetchImpl(session, input, init, extra);
}
exports.fetch = fetch;
//# sourceMappingURL=fetch-http1.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamResponse = exports.Response = void 0;
const http2_1 = require("http2");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const { HTTP2_HEADER_LOCATION, HTTP2_HEADER_STATUS, HTTP2_HEADER_CONTENT_TYPE, HTTP2_HEADER_CONTENT_ENCODING, HTTP2_HEADER_CONTENT_LENGTH, } = http2_1.constants;
const utils_1 = require("./utils");
const headers_1 = require("./headers");
const body_1 = require("./body");
class Response extends body_1.Body {
    constructor(body = null, init = {}, extra) {
        super();
        const headers = (0, headers_1.ensureHeaders)(init.allowForbiddenHeaders
            ? new headers_1.GuardedHeaders("none", init.headers)
            : init.headers);
        const _extra = (extra || {});
        const type = _extra.type || "basic";
        const redirected = !!_extra.redirected || false;
        const url = _extra.url || "";
        const integrity = _extra.integrity || null;
        this.setSignal(_extra.signal);
        if (body) {
            const contentType = headers.get(HTTP2_HEADER_CONTENT_TYPE);
            const contentLength = headers.get(HTTP2_HEADER_CONTENT_LENGTH);
            const contentEncoding = headers.get(HTTP2_HEADER_CONTENT_ENCODING);
            const length = (contentLength == null || contentEncoding != null)
                ? null
                : parseInt(contentLength, 10);
            if (contentType)
                this.setBody(body, contentType, integrity, length);
            else
                this.setBody(body, null, integrity, length);
        }
        Object.defineProperties(this, {
            headers: {
                enumerable: true,
                value: headers,
            },
            httpVersion: {
                enumerable: true,
                value: _extra.httpVersion,
            },
            ok: {
                enumerable: true,
                get: () => this.status >= 200 && this.status < 300,
            },
            redirected: {
                enumerable: true,
                value: redirected,
            },
            status: {
                enumerable: true,
                value: init.status || 200,
            },
            statusText: {
                enumerable: true,
                value: init.statusText || "",
            },
            type: {
                enumerable: true,
                value: type,
            },
            url: {
                enumerable: true,
                value: url,
            },
            useFinalURL: {
                enumerable: true,
                value: undefined,
            },
        });
    }
    // Returns a new Response object associated with a network error.
    static error() {
        const headers = new headers_1.GuardedHeaders("immutable");
        const status = 521;
        const statusText = "Web Server Is Down";
        return new Response(null, { headers, status, statusText }, { type: "error" });
    }
    // Creates a new response with a different URL.
    static redirect(url, status) {
        status = status || 302;
        const headers = {
            [HTTP2_HEADER_LOCATION]: url,
        };
        return new Response(null, { headers, status });
    }
    // Creates a clone of a Response object.
    clone() {
        const { headers, status, statusText } = this;
        return new Response(this, { headers, status, statusText });
    }
}
exports.Response = Response;
function makeHeadersFromH2Headers(headers, allowForbiddenHeaders) {
    const out = new headers_1.GuardedHeaders(allowForbiddenHeaders ? "none" : "response");
    for (const key of Object.keys(headers)) {
        if (key.startsWith(":"))
            // We ignore pseudo-headers
            continue;
        const value = headers[key];
        if (Array.isArray(value))
            value.forEach(val => out.append(key, val));
        else if (value != null)
            out.set(key, value);
    }
    return out;
}
function makeInitHttp1(inHeaders, allowForbiddenHeaders) {
    // Headers in HTTP/2 are compatible with HTTP/1 (colon illegal in HTTP/1)
    const headers = makeHeadersFromH2Headers(inHeaders, allowForbiddenHeaders);
    return { headers };
}
function makeInitHttp2(inHeaders, allowForbiddenHeaders) {
    const status = parseInt("" + inHeaders[HTTP2_HEADER_STATUS], 10);
    const statusText = ""; // Not supported in H2
    const headers = makeHeadersFromH2Headers(inHeaders, allowForbiddenHeaders);
    return { status, statusText, headers };
}
function makeExtra(httpVersion, url, redirected, signal, integrity) {
    const type = "basic"; // TODO: Implement CORS
    return { httpVersion, redirected, integrity, signal, type, url };
}
function handleEncoding(contentDecoders, stream, headers) {
    const contentEncoding = headers[HTTP2_HEADER_CONTENT_ENCODING];
    if (!contentEncoding)
        return stream;
    const handleStreamResult = (_err) => {
        // TODO: Add error handling
    };
    const zlibOpts = {
        flush: zlib_1.constants.Z_SYNC_FLUSH,
        finishFlush: zlib_1.constants.Z_SYNC_FLUSH,
    };
    const decoders = {
        deflate: (stream) => (0, stream_1.pipeline)(stream, (0, zlib_1.createInflate)(), handleStreamResult),
        gzip: (stream) => (0, stream_1.pipeline)(stream, (0, zlib_1.createGunzip)(zlibOpts), handleStreamResult),
    };
    if ((0, utils_1.hasBuiltinBrotli)()) {
        decoders.br = (stream) => (0, stream_1.pipeline)(stream, (0, zlib_1.createBrotliDecompress)(), handleStreamResult);
    }
    contentDecoders.forEach(decoder => {
        decoders[decoder.name] = decoder.decode;
    });
    const decoder = decoders[contentEncoding];
    if (!decoder)
        // We haven't asked for this encoding, and we can't handle it.
        // Pushing raw encoded stream through...
        return stream;
    return decoder(stream);
}
class StreamResponse extends Response {
    constructor(contentDecoders, url, stream, headers, redirected, init, signal, httpVersion, allowForbiddenHeaders, integrity) {
        super(handleEncoding(contentDecoders, stream, headers), {
            ...init,
            allowForbiddenHeaders,
            ...(httpVersion === 1
                ? makeInitHttp1(headers, allowForbiddenHeaders)
                : makeInitHttp2(headers, allowForbiddenHeaders)),
        }, makeExtra(httpVersion, url, redirected, signal, integrity));
    }
}
exports.StreamResponse = StreamResponse;
//# sourceMappingURL=response.js.map
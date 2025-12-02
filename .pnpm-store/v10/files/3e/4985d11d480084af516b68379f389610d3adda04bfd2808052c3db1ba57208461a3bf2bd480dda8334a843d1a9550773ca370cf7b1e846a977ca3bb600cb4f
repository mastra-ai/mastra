/*
 * Copyright Michael Hart
 * Licensed under the MIT license. See LICENSE file for details.
 *
 * Portions of this file Copyright Fastly, Inc. See LICENSE file for details.
 * Portions of this file Copyright Joyent, Inc. and other Node contributors. See LICENSE file for details.
 */
import { Buffer } from "node:buffer";
import { ERR_HTTP_HEADERS_SENT, ERR_HTTP_INVALID_STATUS_CODE, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_INVALID_CHAR, ERR_METHOD_NOT_IMPLEMENTED, } from "../utils/errors.js";
import { FetchOutgoingMessage, } from "./http-outgoing.js";
import { chunkExpression } from "./http-common.js";
import { FetchIncomingMessage } from "./http-incoming.js";
import { kOutHeaders } from "./internal-http.js";
import { validateLinkHeaderValue } from "../utils/types.js";
/* These items copied from Node.js: node/lib/_http_common.js. */
const headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/;
/**
 * True if val contains an invalid field-vchar
 *  field-value    = *( field-content / obs-fold )
 *  field-content  = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 *  field-vchar    = VCHAR / obs-text
 */
function checkInvalidHeaderChar(val) {
    return headerCharRegex.test(val);
}
// This file modeled after Node.js - node/lib/_http_server.js
export const STATUS_CODES = {
    100: "Continue", // RFC 7231 6.2.1
    101: "Switching Protocols", // RFC 7231 6.2.2
    102: "Processing", // RFC 2518 10.1 (obsoleted by RFC 4918)
    103: "Early Hints", // RFC 8297 2
    200: "OK", // RFC 7231 6.3.1
    201: "Created", // RFC 7231 6.3.2
    202: "Accepted", // RFC 7231 6.3.3
    203: "Non-Authoritative Information", // RFC 7231 6.3.4
    204: "No Content", // RFC 7231 6.3.5
    205: "Reset Content", // RFC 7231 6.3.6
    206: "Partial Content", // RFC 7233 4.1
    207: "Multi-Status", // RFC 4918 11.1
    208: "Already Reported", // RFC 5842 7.1
    226: "IM Used", // RFC 3229 10.4.1
    300: "Multiple Choices", // RFC 7231 6.4.1
    301: "Moved Permanently", // RFC 7231 6.4.2
    302: "Found", // RFC 7231 6.4.3
    303: "See Other", // RFC 7231 6.4.4
    304: "Not Modified", // RFC 7232 4.1
    305: "Use Proxy", // RFC 7231 6.4.5
    307: "Temporary Redirect", // RFC 7231 6.4.7
    308: "Permanent Redirect", // RFC 7238 3
    400: "Bad Request", // RFC 7231 6.5.1
    401: "Unauthorized", // RFC 7235 3.1
    402: "Payment Required", // RFC 7231 6.5.2
    403: "Forbidden", // RFC 7231 6.5.3
    404: "Not Found", // RFC 7231 6.5.4
    405: "Method Not Allowed", // RFC 7231 6.5.5
    406: "Not Acceptable", // RFC 7231 6.5.6
    407: "Proxy Authentication Required", // RFC 7235 3.2
    408: "Request Timeout", // RFC 7231 6.5.7
    409: "Conflict", // RFC 7231 6.5.8
    410: "Gone", // RFC 7231 6.5.9
    411: "Length Required", // RFC 7231 6.5.10
    412: "Precondition Failed", // RFC 7232 4.2
    413: "Payload Too Large", // RFC 7231 6.5.11
    414: "URI Too Long", // RFC 7231 6.5.12
    415: "Unsupported Media Type", // RFC 7231 6.5.13
    416: "Range Not Satisfiable", // RFC 7233 4.4
    417: "Expectation Failed", // RFC 7231 6.5.14
    418: "I'm a Teapot", // RFC 7168 2.3.3
    421: "Misdirected Request", // RFC 7540 9.1.2
    422: "Unprocessable Entity", // RFC 4918 11.2
    423: "Locked", // RFC 4918 11.3
    424: "Failed Dependency", // RFC 4918 11.4
    425: "Too Early", // RFC 8470 5.2
    426: "Upgrade Required", // RFC 2817 and RFC 7231 6.5.15
    428: "Precondition Required", // RFC 6585 3
    429: "Too Many Requests", // RFC 6585 4
    431: "Request Header Fields Too Large", // RFC 6585 5
    451: "Unavailable For Legal Reasons", // RFC 7725 3
    500: "Internal Server Error", // RFC 7231 6.6.1
    501: "Not Implemented", // RFC 7231 6.6.2
    502: "Bad Gateway", // RFC 7231 6.6.3
    503: "Service Unavailable", // RFC 7231 6.6.4
    504: "Gateway Timeout", // RFC 7231 6.6.5
    505: "HTTP Version Not Supported", // RFC 7231 6.6.6
    506: "Variant Also Negotiates", // RFC 2295 8.1
    507: "Insufficient Storage", // RFC 4918 11.5
    508: "Loop Detected", // RFC 5842 7.2
    509: "Bandwidth Limit Exceeded",
    510: "Not Extended", // RFC 2774 7
    511: "Network Authentication Required", // RFC 6585 6
};
/**
 * This is an implementation of ServerResponse from Node.js intended to run in
 * a WinterTC runtime. The 'Writable' interface of this class is wired to an in-memory
 * buffer. This class also provides a method that creates a Response object that
 * can be handled by the runtime.
 *
 * This instance can be used in normal ways, but it does not give access to the
 * underlying socket (because there isn't one. req.socket will always return null).
 *
 * Some code in this class is transplanted/adapted from node/lib/_httpserver.js
 *
 * NOTE: Node.js doesn't really separate the body from headers, the entire "stream"
 * contains the headers and the body. So we provide functions that lets us pull
 * the headers and body out individually at a later time.
 */
export class FetchServerResponse extends FetchOutgoingMessage {
    static encoder = new TextEncoder();
    statusCode = 200;
    statusMessage;
    _sent100;
    _expect_continue;
    [kOutHeaders] = null;
    constructor(req, options) {
        super(req, options);
        if (req.method === "HEAD") {
            this._hasBody = false;
        }
        // this.req = req; // super() actually does this
        this.sendDate = true;
        this._sent100 = false;
        this._expect_continue = false;
        if (req.httpVersionMajor < 1 || req.httpVersionMinor < 1) {
            this.useChunkedEncodingByDefault =
                chunkExpression.exec(String(req.headers.te)) !== null;
            this.shouldKeepAlive = false;
        }
        // Difference from Node.js -
        // In Node.js, in addition to the above, we would check if an observer is enabled for
        // http, and if it is, we would start performance measurement of server response statistics.
        this.fetchResponse = new Promise((resolve) => {
            let finished = false;
            this.on("finish", () => {
                finished = true;
            });
            const initialDataChunks = [];
            const initialDataWrittenHandler = (e) => {
                if (finished) {
                    return;
                }
                initialDataChunks[e.index] = this.dataFromDataWrittenEvent(e);
            };
            this.on("_dataWritten", initialDataWrittenHandler);
            this.on("_headersSent", (e) => {
                this.off("_dataWritten", initialDataWrittenHandler);
                // Convert the response object to a Response object and return it
                const { statusCode, statusMessage, headers } = e;
                resolve(this._toFetchResponse(statusCode, statusMessage, headers, initialDataChunks, finished));
            });
        });
    }
    dataFromDataWrittenEvent(e) {
        const { index, entry } = e;
        let { data, encoding } = entry;
        if (index === 0) {
            if (typeof data !== "string") {
                console.error("First chunk should be string, not sure what happened.");
                throw new ERR_INVALID_ARG_TYPE("packet.data", ["string", "Buffer", "Uint8Array"], data);
            }
            // The first X bytes are header material, so we remove it.
            data = data.slice(this.writtenHeaderBytes);
        }
        if (typeof data === "string") {
            if (encoding === undefined ||
                encoding === "utf8" ||
                encoding === "utf-8") {
                data = FetchServerResponse.encoder.encode(data);
            }
            else {
                data = Buffer.from(data, encoding ?? undefined);
            }
        }
        return data ?? Buffer.from([]);
    }
    _finish() {
        // Difference from Node.js -
        // In Node.js, if server response statistics performance is being measured, we would stop it.
        super._finish();
    }
    assignSocket(socket) {
        // Difference from Node.js -
        // Socket is not supported
        throw new ERR_METHOD_NOT_IMPLEMENTED("assignSocket");
    }
    detachSocket(socket) {
        // Difference from Node.js -
        // Socket is not supported
        throw new ERR_METHOD_NOT_IMPLEMENTED("detachSocket");
    }
    writeContinue(callback) {
        this._writeRaw("HTTP/1.1 100 Continue\r\n\r\n", "ascii", callback);
        this._sent100 = true;
    }
    writeProcessing(callback) {
        this._writeRaw("HTTP/1.1 102 Processing\r\n\r\n", "ascii", callback);
    }
    writeEarlyHints(hints, callback) {
        let head = "HTTP/1.1 103 Early Hints\r\n";
        // Difference from Node.js -
        // In Node.js, we would validate the hints object here.
        // validateObject(hints, 'hints');
        if (hints.link === null || hints.link === undefined) {
            return;
        }
        const link = validateLinkHeaderValue(hints.link);
        if (link.length === 0) {
            return;
        }
        head += "Link: " + link + "\r\n";
        for (const key of Object.keys(hints)) {
            if (key !== "link") {
                head += key + ": " + hints[key] + "\r\n";
            }
        }
        head += "\r\n";
        this._writeRaw(head, "ascii", callback);
    }
    _implicitHeader() {
        this.writeHead(this.statusCode);
    }
    writeHead(statusCode, reason, obj) {
        if (this._header) {
            throw new ERR_HTTP_HEADERS_SENT("write");
        }
        const originalStatusCode = statusCode;
        statusCode |= 0;
        if (statusCode < 100 || statusCode > 999) {
            throw new ERR_HTTP_INVALID_STATUS_CODE(originalStatusCode);
        }
        if (typeof reason === "string") {
            // writeHead(statusCode, reasonPhrase[, headers])
            this.statusMessage = reason;
        }
        else {
            // writeHead(statusCode[, headers])
            this.statusMessage ||= STATUS_CODES[statusCode] || "unknown";
            obj ??= reason;
        }
        this.statusCode = statusCode;
        let headers;
        if (this[kOutHeaders]) {
            // Slow-case: when progressive API and header fields are passed.
            let k;
            if (Array.isArray(obj)) {
                if (obj.length % 2 !== 0) {
                    throw new ERR_INVALID_ARG_VALUE("headers", obj);
                }
                // Headers in obj should override previous headers but still
                // allow explicit duplicates. To do so, we first remove any
                // existing conflicts, then use appendHeader.
                for (let n = 0; n < obj.length; n += 2) {
                    k = obj[n + 0];
                    this.removeHeader(String(k));
                }
                for (let n = 0; n < obj.length; n += 2) {
                    k = obj[n];
                    if (k) {
                        this.appendHeader(String(k), obj[n + 1]);
                    }
                }
            }
            else if (obj) {
                const keys = Object.keys(obj);
                // Retain for(;;) loop for performance reasons
                // Refs: https://github.com/nodejs/node/pull/30958
                for (let i = 0; i < keys.length; i++) {
                    k = keys[i];
                    if (k) {
                        this.setHeader(k, obj[k]);
                    }
                }
            }
            // Only progressive api is used
            headers = this[kOutHeaders];
        }
        else {
            // Only writeHead() called
            headers = obj;
        }
        if (checkInvalidHeaderChar(this.statusMessage)) {
            throw new ERR_INVALID_CHAR("statusMessage");
        }
        const statusLine = `HTTP/1.1 ${statusCode} ${this.statusMessage}\r\n`;
        if (statusCode === 204 ||
            statusCode === 304 ||
            (statusCode >= 100 && statusCode <= 199)) {
            // RFC 2616, 10.2.5:
            // The 204 response MUST NOT include a message-body, and thus is always
            // terminated by the first empty line after the header fields.
            // RFC 2616, 10.3.5:
            // The 304 response MUST NOT contain a message-body, and thus is always
            // terminated by the first empty line after the header fields.
            // RFC 2616, 10.1 Informational 1xx:
            // This class of status code indicates a provisional response,
            // consisting only of the Status-Line and optional headers, and is
            // terminated by an empty line.
            this._hasBody = false;
        }
        // Don't keep alive connections where the client expects 100 Continue
        // but we sent a final status; they may put extra bytes on the wire.
        if (this._expect_continue && !this._sent100) {
            this.shouldKeepAlive = false;
        }
        // Convert headers to a compatible type for _storeHeader
        const convertedHeaders = headers && !Array.isArray(headers)
            ? headers
            : headers;
        this._storeHeader(statusLine, convertedHeaders ?? null);
        return this;
    }
    // Docs-only deprecated: DEP0063
    writeHeader = this.writeHead;
    fetchResponse;
    _toFetchResponse(status, statusText, sentHeaders, initialDataChunks, finished) {
        const headers = new Headers();
        for (const [header, value] of sentHeaders) {
            headers.append(header, value);
        }
        const _this = this;
        let body = this._hasBody
            ? new ReadableStream({
                start(controller) {
                    for (const dataChunk of initialDataChunks) {
                        controller.enqueue(dataChunk);
                    }
                    if (finished) {
                        controller.close();
                    }
                    else {
                        _this.on("finish", () => {
                            finished = true;
                            controller.close();
                        });
                        _this.on("_dataWritten", (e) => {
                            if (finished) {
                                return;
                            }
                            const data = _this.dataFromDataWrittenEvent(e);
                            controller.enqueue(data);
                        });
                    }
                },
            })
            : null;
        // @ts-expect-error this is (currently) a cloudflare-specific class
        if (body != null && typeof FixedLengthStream !== "undefined") {
            const contentLength = parseInt(headers.get("content-length") ?? "", 10); // will be NaN if not set
            if (contentLength >= 0) {
                // @ts-expect-error this is (currently) a cloudflare-specific class
                body = body.pipeThrough(new FixedLengthStream(contentLength));
            }
        }
        return new Response(body, {
            status,
            statusText,
            headers,
        });
    }
}
export function toReqRes(req, options) {
    const { createIncomingMessage = () => new FetchIncomingMessage(), createServerResponse = (incoming) => new FetchServerResponse(incoming), ctx, } = options ?? {};
    const incoming = createIncomingMessage(ctx);
    const serverResponse = createServerResponse(incoming, ctx);
    const reqUrl = new URL(req.url);
    const versionMajor = 1;
    const versionMinor = 1;
    incoming.httpVersionMajor = versionMajor;
    incoming.httpVersionMinor = versionMinor;
    incoming.httpVersion = `${versionMajor}.${versionMinor}`;
    incoming.url = reqUrl.pathname + reqUrl.search;
    incoming.upgrade = false;
    const headers = [];
    for (const [headerName, headerValue] of req.headers) {
        headers.push(headerName);
        headers.push(headerValue);
    }
    incoming._addHeaderLines(headers, headers.length);
    incoming.method = req.method;
    incoming._stream = req.body;
    return {
        req: incoming,
        res: serverResponse,
    };
}
export function toFetchResponse(res) {
    if (!(res instanceof FetchServerResponse)) {
        throw new Error("toFetchResponse must be called on a ServerResponse generated by toReqRes");
    }
    return res.fetchResponse;
}

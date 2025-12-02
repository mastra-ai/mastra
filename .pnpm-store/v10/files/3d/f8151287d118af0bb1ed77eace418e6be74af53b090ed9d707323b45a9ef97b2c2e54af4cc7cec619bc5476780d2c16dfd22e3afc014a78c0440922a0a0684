/*
 * Copyright Michael Hart
 * Licensed under the MIT license. See LICENSE file for details.
 *
 * Portions of this file Copyright Fastly, Inc. See LICENSE file for details.
 * Portions of this file Copyright Joyent, Inc. and other Node contributors. See LICENSE file for details.
 */
// This file modeled after Node.js - node/lib/_http_outgoing.js
import { Buffer } from "node:buffer";
import { Writable } from "node:stream";
import { ERR_HTTP_BODY_NOT_ALLOWED, ERR_HTTP_CONTENT_LENGTH_MISMATCH, ERR_HTTP_HEADERS_SENT, ERR_HTTP_INVALID_HEADER_VALUE, ERR_HTTP_TRAILER_INVALID, ERR_INVALID_ARG_TYPE, ERR_INVALID_ARG_VALUE, ERR_INVALID_CHAR, ERR_INVALID_HTTP_TOKEN, ERR_METHOD_NOT_IMPLEMENTED, ERR_STREAM_ALREADY_FINISHED, ERR_STREAM_CANNOT_PIPE, ERR_STREAM_DESTROYED, ERR_STREAM_NULL_VALUES, ERR_STREAM_WRITE_AFTER_END, } from "../utils/errors.js";
import { isUint8Array, validateString } from "../utils/types.js";
import { kNeedDrain, kOutHeaders, utcDate } from "./internal-http.js";
import { getDefaultHighWaterMark } from "./internal-streams-state.js";
import { checkInvalidHeaderChar, checkIsHttpToken, chunkExpression as RE_TE_CHUNKED, } from "./http-common.js";
/* These items copied from Node.js: node/lib/_http_outgoing.js. */
function debug(format) {
    // console.log("http " + format);
}
const kCorked = Symbol("corked");
const kChunkedBuffer = Symbol("kChunkedBuffer");
const kChunkedLength = Symbol("kChunkedLength");
const kUniqueHeaders = Symbol("kUniqueHeaders");
const kBytesWritten = Symbol("kBytesWritten");
const kErrored = Symbol("errored");
const kHighWaterMark = Symbol("kHighWaterMark");
const kRejectNonStandardBodyWrites = Symbol("kRejectNonStandardBodyWrites");
const nop = () => { };
const RE_CONN_CLOSE = /(?:^|\W)close(?:$|\W)/i;
// isCookieField performs a case-insensitive comparison of a provided string
// against the word "cookie." As of V8 6.6 this is faster than handrolling or
// using a case-insensitive RegExp.
function isCookieField(s) {
    return s.length === 6 && s.toLowerCase() === "cookie";
}
function isContentDispositionField(s) {
    return s.length === 19 && s.toLowerCase() === "content-disposition";
}
/**
 * An in-memory buffer that stores the chunks that have been streamed to an
 * OutgoingMessage instance.
 */
export class WrittenDataBuffer {
    [kCorked] = 0;
    [kHighWaterMark] = getDefaultHighWaterMark();
    entries = [];
    onWrite;
    constructor(params = {}) {
        this.onWrite = params.onWrite;
    }
    write(data, encoding, callback) {
        this.entries.push({
            data,
            length: data.length,
            encoding,
            callback,
            written: false,
        });
        this._flush();
        return true;
    }
    cork() {
        this[kCorked]++;
    }
    uncork() {
        this[kCorked]--;
        this._flush();
    }
    _flush() {
        if (this[kCorked] <= 0) {
            for (const [index, entry] of this.entries.entries()) {
                if (!entry.written) {
                    entry.written = true;
                    if (this.onWrite != null) {
                        this.onWrite(index, entry);
                    }
                    if (entry.callback != null) {
                        entry.callback.call(undefined);
                    }
                }
            }
        }
    }
    get writableLength() {
        return this.entries.reduce((acc, entry) => {
            return acc + (entry.written && entry.length ? entry.length : 0);
        }, 0);
    }
    get writableHighWaterMark() {
        return this[kHighWaterMark];
    }
    get writableCorked() {
        return this[kCorked];
    }
}
/**
 * This is an implementation of OutgoingMessage from Node.js intended to run in
 * a WinterTC runtime. The 'Writable' interface of this class is wired to an in-memory
 * buffer.
 *
 * This instance can be used in normal ways, but it does not give access to the
 * underlying socket (because there isn't one. req.socket will always return null).
 *
 * Some code in this class is transplanted/adapted from node/lib/_http_outgoing.js
 */
export class FetchOutgoingMessage extends Writable {
    req;
    outputData;
    outputSize;
    // Difference from Node.js -
    // `writtenHeaderBytes` is the number of bytes the header has taken.
    // Since Node.js writes both the headers and body into the same outgoing
    // stream, it helps to keep track of this so that we can skip that many bytes
    // from the beginning of the stream when providing the outgoing stream.
    writtenHeaderBytes = 0;
    _last;
    chunkedEncoding;
    shouldKeepAlive;
    maxRequestsOnConnectionReached;
    _defaultKeepAlive;
    useChunkedEncodingByDefault;
    sendDate;
    _removedConnection;
    _removedContLen;
    _removedTE;
    strictContentLength;
    [kBytesWritten];
    _contentLength;
    _hasBody;
    _trailer;
    [kNeedDrain];
    finished;
    _headerSent;
    [kCorked];
    [kChunkedBuffer];
    [kChunkedLength];
    _closed;
    // Difference from Node.js -
    // In Node.js, this is a socket object.
    // [kSocket]: null;
    _header;
    [kOutHeaders];
    _keepAliveTimeout;
    _maxRequestsPerSocket;
    _onPendingData;
    [kUniqueHeaders];
    [kErrored];
    [kHighWaterMark];
    [kRejectNonStandardBodyWrites];
    _writtenDataBuffer = new WrittenDataBuffer({
        onWrite: this._onDataWritten.bind(this),
    });
    constructor(req, options) {
        super();
        this.req = req;
        // Queue that holds all currently pending data, until the response will be
        // assigned to the socket (until it will its turn in the HTTP pipeline).
        this.outputData = [];
        // `outputSize` is an approximate measure of how much data is queued on this
        // response. `_onPendingData` will be invoked to update similar global
        // per-connection counter. That counter will be used to pause/unpause the
        // TCP socket and HTTP Parser and thus handle the backpressure.
        this.outputSize = 0;
        // Cannot assign to this.writable because it is a readonly property
        // this.writable = true;
        this.destroyed = false;
        this._last = false;
        this.chunkedEncoding = false;
        this.shouldKeepAlive = true;
        this.maxRequestsOnConnectionReached = false;
        this._defaultKeepAlive = true;
        this.useChunkedEncodingByDefault = true;
        this.sendDate = false;
        this._removedConnection = false;
        this._removedContLen = false;
        this._removedTE = false;
        this.strictContentLength = false;
        this[kBytesWritten] = 0;
        this._contentLength = null;
        this._hasBody = true;
        this._trailer = "";
        this[kNeedDrain] = false;
        this.finished = false;
        this._headerSent = false;
        this[kCorked] = 0;
        this[kChunkedBuffer] = [];
        this[kChunkedLength] = 0;
        this._closed = false;
        this._header = null;
        this[kOutHeaders] = null;
        this._keepAliveTimeout = 0;
        this._onPendingData = nop;
        this[kErrored] = null;
        this[kHighWaterMark] = options?.highWaterMark ?? getDefaultHighWaterMark();
        this[kRejectNonStandardBodyWrites] =
            options?.rejectNonStandardBodyWrites ?? false;
        this[kUniqueHeaders] = null;
    }
    _renderHeaders() {
        if (this._header) {
            throw new ERR_HTTP_HEADERS_SENT("render");
        }
        const headersMap = this[kOutHeaders];
        const headers = {};
        if (headersMap !== null) {
            const keys = Object.keys(headersMap);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for (let i = 0, l = keys.length; i < l; i++) {
                const key = keys[i];
                headers[headersMap[key][0]] = headersMap[key][1];
            }
        }
        return headers;
    }
    cork() {
        // Difference from Node.js -
        // In Node.js, if a socket exists, we would call cork() on the socket instead
        // In our implementation, we do the same to the "written data buffer" instead.
        this[kCorked]++;
        if (this._writtenDataBuffer != null) {
            this._writtenDataBuffer.cork();
        }
    }
    uncork() {
        // Difference from Node.js -
        // In Node.js, if a socket exists, we would call uncork() on the socket instead
        // In our implementation, we do the same to the "written data buffer" instead.
        this[kCorked]--;
        if (this._writtenDataBuffer != null) {
            this._writtenDataBuffer.uncork();
        }
        if (this[kCorked] || this[kChunkedBuffer].length === 0) {
            return;
        }
        // Difference from Node.js -
        // Chunked transfer encoding doesn't need to use the low-level protocol
        // (with each chunk preceded by its length)
        // All commented out code below is from Node.js used for this purpose.
        // const len = this[kChunkedLength];
        const buf = this[kChunkedBuffer];
        // assert(this.chunkedEncoding);
        // let callbacks: (WriteCallback | undefined)[] | undefined;
        // this._send(len.toString(16), "latin1", null);
        // this._send(crlf_buf, null, null);
        for (const { data, encoding, callback } of buf) {
            // this._send(data ?? "", encoding, null);
            // if (callback) {
            //   callbacks ??= [];
            //   callbacks.push(callback);
            // }
            this._send(data ?? "", encoding, callback);
        }
        // this._send(
        //   crlf_buf,
        //   null,
        //   callbacks?.length
        //     ? (err) => {
        //         for (const callback of callbacks) {
        //           callback?.(err);
        //         }
        //       }
        //     : null
        // );
        this[kChunkedBuffer].length = 0;
        this[kChunkedLength] = 0;
    }
    setTimeout(msecs, callback) {
        // Difference from Node.js -
        // In Node.js, this is supposed to set the underlying socket to time out
        // after some time and then run a callback.
        // We do nothing here since we don't really have a way to support direct
        // access to the socket.
        return this;
    }
    destroy(error) {
        if (this.destroyed) {
            return this;
        }
        this.destroyed = true;
        this[kErrored] = error;
        // Difference from Node.js -
        // In Node.js, we would also attempt to destroy the underlying socket.
        return this;
    }
    _send(data, encoding, callback, byteLength) {
        // This is a shameful hack to get the headers and first body chunk onto
        // the same packet. Future versions of Node are going to take care of
        // this at a lower level and in a more general way.
        if (!this._headerSent) {
            const header = this._header;
            if (typeof data === "string" &&
                (encoding === "utf8" || encoding === "latin1" || !encoding)) {
                data = header + data;
            }
            else {
                this.outputData.unshift({
                    data: header,
                    encoding: "latin1",
                    callback: undefined,
                });
                this.outputSize += header.length;
                this._onPendingData(header.length);
            }
            this._headerSent = true;
            // Difference from Node.js -
            // Parse headers here and trigger _headersSent
            this.writtenHeaderBytes = header.length;
            // Save written headers as object
            const [statusLine, ...headerLines] = this._header.split("\r\n");
            const STATUS_LINE_REGEXP = /^HTTP\/1\.1 (?<statusCode>\d+) (?<statusMessage>.*)$/;
            const statusLineResult = STATUS_LINE_REGEXP.exec(statusLine);
            if (statusLineResult == null) {
                throw new Error("Unexpected! Status line was " + statusLine);
            }
            const { statusCode: statusCodeText, statusMessage } = statusLineResult.groups ?? {};
            const statusCode = parseInt(statusCodeText, 10);
            const headers = [];
            for (const headerLine of headerLines) {
                if (headerLine !== "") {
                    const pos = headerLine.indexOf(": ");
                    const k = headerLine.slice(0, pos);
                    const v = headerLine.slice(pos + 2); // Skip the colon and the space
                    headers.push([k, v]);
                }
            }
            const event = {
                statusCode,
                statusMessage,
                headers,
            };
            this.emit("_headersSent", event);
        }
        return this._writeRaw(data, encoding, callback, byteLength);
    }
    _writeRaw(data, encoding, callback, size) {
        // Difference from Node.js -
        // In Node.js, we would check for an underlying socket, and if that socket
        // exists and is already destroyed, simply return false.
        if (typeof encoding === "function") {
            callback = encoding;
            encoding = null;
        }
        // Difference from Node.js -
        // In Node.js, we would check for an underlying socket, and if that socket
        // exists and is currently writable, it would flush any pending data to the socket and then
        // write the current chunk's data directly into the socket. Afterwards, it would return with the
        // value returned from socket.write().
        // In our implementation, instead we do the same for the "written data buffer".
        if (this._writtenDataBuffer != null) {
            // There might be pending data in the this.output buffer.
            if (this.outputData.length) {
                this._flushOutput(this._writtenDataBuffer);
            }
            // Directly write to the buffer.
            return this._writtenDataBuffer.write(data, encoding, callback);
        }
        // Buffer, as long as we're not destroyed.
        this.outputData.push({ data, encoding, callback });
        this.outputSize += data.length;
        this._onPendingData(data.length);
        return this.outputSize < this[kHighWaterMark];
    }
    _onDataWritten(index, entry) {
        const event = { index, entry };
        this.emit("_dataWritten", event);
    }
    _storeHeader(firstLine, headers) {
        // firstLine in the case of request is: 'GET /index.html HTTP/1.1\r\n'
        // in the case of response it is: 'HTTP/1.1 200 OK\r\n'
        const state = {
            connection: false,
            contLen: false,
            te: false,
            date: false,
            expect: false,
            trailer: false,
            header: firstLine,
        };
        if (headers) {
            if (headers === this[kOutHeaders]) {
                for (const key in headers) {
                    const entry = headers[key];
                    processHeader(this, state, entry[0], entry[1], false);
                }
            }
            else if (Array.isArray(headers)) {
                if (headers.length && Array.isArray(headers[0])) {
                    for (let i = 0; i < headers.length; i++) {
                        const entry = headers[i];
                        processHeader(this, state, entry[0], entry[1], true);
                    }
                }
                else {
                    if (headers.length % 2 !== 0) {
                        throw new ERR_INVALID_ARG_VALUE("headers", headers);
                    }
                    for (let n = 0; n < headers.length; n += 2) {
                        processHeader(this, state, headers[n], headers[n + 1], true);
                    }
                }
            }
            else {
                for (const key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        const _headers = headers;
                        processHeader(this, state, key, _headers[key], true);
                    }
                }
            }
        }
        let { header } = state;
        // Date header
        if (this.sendDate && !state.date) {
            header += "Date: " + utcDate() + "\r\n";
        }
        // Force the connection to close when the response is a 204 No Content or
        // a 304 Not Modified and the user has set a "Transfer-Encoding: chunked"
        // header.
        //
        // RFC 2616 mandates that 204 and 304 responses MUST NOT have a body but
        // node.js used to send out a zero chunk anyway to accommodate clients
        // that don't have special handling for those responses.
        //
        // It was pointed out that this might confuse reverse proxies to the point
        // of creating security liabilities, so suppress the zero chunk and force
        // the connection to close.
        // NOTE: the "as any" here is needed because 'statusCode' is only
        // defined on the subclass but is used here.
        if (this.chunkedEncoding &&
            (this.statusCode === 204 || this.statusCode === 304)) {
            debug(this.statusCode +
                " response should not use chunked encoding," +
                " closing connection.");
            this.chunkedEncoding = false;
            this.shouldKeepAlive = false;
        }
        // keep-alive logic
        if (this._removedConnection) {
            // shouldKeepAlive is generally true for HTTP/1.1. In that common case,
            // even if the connection header isn't sent, we still persist by default.
            this._last = !this.shouldKeepAlive;
        }
        else if (!state.connection) {
            // this.agent would only exist on class ClientRequest
            const shouldSendKeepAlive = this.shouldKeepAlive &&
                (state.contLen || this.useChunkedEncodingByDefault); /* || this.agent */
            if (shouldSendKeepAlive && this.maxRequestsOnConnectionReached) {
                header += "Connection: close\r\n";
            }
            else if (shouldSendKeepAlive) {
                header += "Connection: keep-alive\r\n";
                if (this._keepAliveTimeout && this._defaultKeepAlive) {
                    const timeoutSeconds = Math.floor(this._keepAliveTimeout / 1000);
                    let max = "";
                    if (this._maxRequestsPerSocket && ~~this._maxRequestsPerSocket > 0) {
                        max = `, max=${this._maxRequestsPerSocket}`;
                    }
                    header += `Keep-Alive: timeout=${timeoutSeconds}${max}\r\n`;
                }
            }
            else {
                this._last = true;
                header += "Connection: close\r\n";
            }
        }
        if (!state.contLen && !state.te) {
            if (!this._hasBody) {
                // Make sure we don't end the 0\r\n\r\n at the end of the message.
                this.chunkedEncoding = false;
            }
            else if (!this.useChunkedEncodingByDefault) {
                this._last = true;
            }
            else if (!state.trailer &&
                !this._removedContLen &&
                typeof this._contentLength === "number") {
                header += "Content-Length: " + this._contentLength + "\r\n";
            }
            else if (!this._removedTE) {
                header += "Transfer-Encoding: chunked\r\n";
                this.chunkedEncoding = true;
            }
            else {
                // We should only be able to get here if both Content-Length and
                // Transfer-Encoding are removed by the user.
                // See: test/parallel/test-http-remove-header-stays-removed.js
                debug("Both Content-Length and Transfer-Encoding are removed");
                // We can't keep alive in this case, because with no header info the body
                // is defined as all data until the connection is closed.
                this._last = true;
            }
        }
        // Test non-chunked message does not have trailer header set,
        // message will be terminated by the first empty line after the
        // header fields, regardless of the header fields present in the
        // message, and thus cannot contain a message body or 'trailers'.
        if (this.chunkedEncoding !== true && state.trailer) {
            throw new ERR_HTTP_TRAILER_INVALID();
        }
        this._header = header + "\r\n";
        this._headerSent = false;
        // Wait until the first body chunk, or close(), is sent to flush,
        // UNLESS we're sending Expect: 100-continue.
        if (state.expect) {
            this._send("");
        }
    }
    get _headers() {
        console.warn("DEP0066: OutgoingMessage.prototype._headers is deprecated");
        return this.getHeaders();
    }
    set _headers(val) {
        console.warn("DEP0066: OutgoingMessage.prototype._headers is deprecated");
        if (val == null) {
            this[kOutHeaders] = null;
        }
        else if (typeof val === "object") {
            const headers = (this[kOutHeaders] = Object.create(null));
            const keys = Object.keys(val);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for (let i = 0; i < keys.length; ++i) {
                const name = keys[i];
                headers[name.toLowerCase()] = [name, val[name]];
            }
        }
    }
    get connection() {
        // Difference from Node.js -
        // Connection is not supported
        return null;
    }
    set connection(_socket) {
        // Difference from Node.js -
        // Connection is not supported
        console.error("No support for OutgoingMessage.connection");
    }
    get socket() {
        // Difference from Node.js -
        // socket is not supported
        return null;
    }
    set socket(_socket) {
        // Difference from Node.js -
        // socket is not supported
        console.error("No support for OutgoingMessage.socket");
    }
    get _headerNames() {
        console.warn("DEP0066: OutgoingMessage.prototype._headerNames is deprecated");
        const headers = this[kOutHeaders];
        if (headers !== null) {
            const out = Object.create(null);
            const keys = Object.keys(headers);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for (let i = 0; i < keys.length; ++i) {
                const key = keys[i];
                const val = headers[key][0];
                out[key] = val;
            }
            return out;
        }
        return null;
    }
    set _headerNames(val) {
        console.warn("DEP0066: OutgoingMessage.prototype._headerNames is deprecated");
        if (typeof val === "object" && val !== null) {
            const headers = this[kOutHeaders];
            if (!headers)
                return;
            const keys = Object.keys(val);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for (let i = 0; i < keys.length; ++i) {
                const header = headers[keys[i]];
                if (header)
                    header[0] = val[keys[i]];
            }
        }
    }
    setHeader(name, value) {
        if (this._header) {
            throw new ERR_HTTP_HEADERS_SENT("set");
        }
        validateHeaderName(name);
        validateHeaderValue(name, value);
        let headers = this[kOutHeaders];
        if (headers === null) {
            this[kOutHeaders] = headers = { __proto__: null };
        }
        headers[name.toLowerCase()] = [name, value];
        return this;
    }
    setHeaders(headers) {
        if (this._header) {
            throw new ERR_HTTP_HEADERS_SENT("set");
        }
        if (!headers ||
            Array.isArray(headers) ||
            typeof headers.keys !== "function" ||
            typeof headers.get !== "function") {
            throw new ERR_INVALID_ARG_TYPE("headers", ["Headers", "Map"], headers);
        }
        // Headers object joins multiple cookies with a comma when using
        // the getter to retrieve the value,
        // unless iterating over the headers directly.
        // We also cannot safely split by comma.
        // To avoid setHeader overwriting the previous value we push
        // set-cookie values in array and set them all at once.
        const cookies = [];
        for (const { 0: key, 1: value } of headers) {
            if (key === "set-cookie") {
                if (Array.isArray(value)) {
                    cookies.push(...value);
                }
                else {
                    cookies.push(value);
                }
                continue;
            }
            this.setHeader(key, value);
        }
        if (cookies.length) {
            this.setHeader("set-cookie", cookies);
        }
        return this;
    }
    appendHeader(name, value) {
        if (this._header) {
            throw new ERR_HTTP_HEADERS_SENT("append");
        }
        validateHeaderName(name);
        validateHeaderValue(name, value);
        const field = name.toLowerCase();
        const headers = this[kOutHeaders];
        if (headers === null || !headers[field]) {
            return this.setHeader(name, value);
        }
        // Prepare the field for appending, if required
        if (!Array.isArray(headers[field][1])) {
            headers[field][1] = [headers[field][1]];
        }
        const existingValues = headers[field][1];
        if (Array.isArray(value)) {
            for (let i = 0, length = value.length; i < length; i++) {
                existingValues.push(value[i]);
            }
        }
        else {
            existingValues.push(value);
        }
        return this;
    }
    getHeader(name) {
        validateString(name, "name");
        const headers = this[kOutHeaders];
        if (headers === null) {
            return;
        }
        const entry = headers[name.toLowerCase()];
        return entry?.[1];
    }
    getHeaderNames() {
        return this[kOutHeaders] !== null ? Object.keys(this[kOutHeaders]) : [];
    }
    getRawHeaderNames() {
        const headersMap = this[kOutHeaders];
        if (headersMap === null)
            return [];
        const values = Object.values(headersMap);
        const headers = Array(values.length);
        // Retain for(;;) loop for performance reasons
        // Refs: https://github.com/nodejs/node/pull/30958
        for (let i = 0, l = values.length; i < l; i++) {
            headers[i] = values[i][0];
        }
        return headers;
    }
    getHeaders() {
        const headers = this[kOutHeaders];
        const ret = { __proto__: null };
        if (headers) {
            const keys = Object.keys(headers);
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for (let i = 0; i < keys.length; ++i) {
                const key = keys[i];
                const val = headers[key][1];
                ret[key] = val;
            }
        }
        return ret;
    }
    hasHeader(name) {
        validateString(name, "name");
        return (this[kOutHeaders] !== null && !!this[kOutHeaders][name.toLowerCase()]);
    }
    removeHeader(name) {
        validateString(name, "name");
        if (this._header) {
            throw new ERR_HTTP_HEADERS_SENT("remove");
        }
        const key = name.toLowerCase();
        switch (key) {
            case "connection":
                this._removedConnection = true;
                break;
            case "content-length":
                this._removedContLen = true;
                break;
            case "transfer-encoding":
                this._removedTE = true;
                break;
            case "date":
                this.sendDate = false;
                break;
        }
        if (this[kOutHeaders] !== null) {
            delete this[kOutHeaders][key];
        }
    }
    _implicitHeader() {
        throw new ERR_METHOD_NOT_IMPLEMENTED("_implicitHeader()");
    }
    get headersSent() {
        return !!this._header;
    }
    write(chunk, encoding, callback) {
        if (typeof encoding === "function") {
            callback = encoding;
            encoding = null;
        }
        const ret = write_(this, chunk, encoding, callback, false);
        if (!ret) {
            this[kNeedDrain] = true;
        }
        return ret;
    }
    addTrailers(headers) {
        this._trailer = "";
        const isArray = Array.isArray(headers);
        const keys = isArray ? [...headers.keys()] : Object.keys(headers);
        // Retain for(;;) loop for performance reasons
        // Refs: https://github.com/nodejs/node/pull/30958
        for (let i = 0, l = keys.length; i < l; i++) {
            let field, value;
            if (isArray) {
                const _headers = headers;
                const key = keys[i];
                field = _headers[key][0];
                value = _headers[key][1];
            }
            else {
                const _headers = headers;
                const key = keys[i];
                field = key;
                value = _headers[key];
            }
            validateHeaderName(field, "Trailer name");
            // Check if the field must be sent several times
            if (Array.isArray(value) &&
                value.length > 1 &&
                (!this[kUniqueHeaders] ||
                    !this[kUniqueHeaders].has(field.toLowerCase()))) {
                for (let j = 0, l = value.length; j < l; j++) {
                    if (checkInvalidHeaderChar(value[j])) {
                        debug(`Trailer "${field}"[${j}] contains invalid characters`);
                        throw new ERR_INVALID_CHAR("trailer content", field);
                    }
                    this._trailer += field + ": " + value[j] + "\r\n";
                }
            }
            else {
                if (Array.isArray(value)) {
                    value = value.join("; ");
                }
                if (checkInvalidHeaderChar(String(value))) {
                    debug(`Trailer "${field}" contains invalid characters`);
                    throw new ERR_INVALID_CHAR("trailer content", field);
                }
                this._trailer += field + ": " + value + "\r\n";
            }
        }
    }
    end(chunk, encoding, callback) {
        if (typeof chunk === "function") {
            callback = chunk;
            chunk = null;
            encoding = null;
        }
        else if (typeof encoding === "function") {
            callback = encoding;
            encoding = null;
        }
        if (chunk) {
            if (this.finished) {
                onError(this, new ERR_STREAM_WRITE_AFTER_END(), typeof callback !== "function" ? nop : callback);
                return this;
            }
            // Difference from Node.js -
            // In Node.js, if a socket exists, we would also call socket.cork() at this point.
            // For our implementation we do the same for the "written data buffer"
            if (this._writtenDataBuffer != null) {
                this._writtenDataBuffer.cork();
            }
            write_(this, chunk, encoding, null, true);
        }
        else if (this.finished) {
            if (typeof callback === "function") {
                if (!this.writableFinished) {
                    this.on("finish", callback);
                }
                else {
                    callback(new ERR_STREAM_ALREADY_FINISHED("end"));
                }
            }
            return this;
        }
        else if (!this._header) {
            // Difference from Node.js -
            // In Node.js, if a socket exists, we would also call socket.cork() at this point.
            // For our implementation we do the same for the "written data buffer"
            if (this._writtenDataBuffer != null) {
                this._writtenDataBuffer.cork();
            }
            this._contentLength = 0;
            this._implicitHeader();
        }
        if (typeof callback === "function")
            this.once("finish", callback);
        if (strictContentLength(this) &&
            this[kBytesWritten] !== this._contentLength) {
            throw new ERR_HTTP_CONTENT_LENGTH_MISMATCH(this[kBytesWritten], this._contentLength);
        }
        const finish = onFinish.bind(undefined, this);
        if (this._hasBody && this.chunkedEncoding) {
            // Difference from Node.js -
            // Chunked transfer encoding doesn't need to use the low-level protocol
            // (with each chunk preceded by its length)
            // So here we just send an empty chunk. Trailers are not supported
            // this._send("0\r\n" + this._trailer + "\r\n", "latin1", finish);
            this._send("", "latin1", finish);
        }
        else if (!this._headerSent || this.writableLength || chunk) {
            this._send("", "latin1", finish);
        }
        else {
            setTimeout(finish, 0);
        }
        // Difference from Node.js -
        // In Node.js, if a socket exists, we would also call socket.uncork() at this point.
        // For our implementation we do the same for the "written data buffer"
        if (this._writtenDataBuffer != null) {
            this._writtenDataBuffer.uncork();
        }
        this[kCorked] = 1;
        this.uncork();
        this.finished = true;
        // There is the first message on the outgoing queue, and we've sent
        // everything to the socket.
        debug("outgoing message end.");
        // Difference from Node.js -
        // In Node.js, if a socket exists, and there is no pending output data,
        // we would also call this._finish() at this point.
        // For our implementation we do the same for the "written data buffer"
        if (this.outputData.length === 0 && this._writtenDataBuffer != null) {
            this._finish();
        }
        return this;
    }
    _finish() {
        // Difference from Node.js -
        // In Node.js, this function is only called if a socket exists.
        // This function would assert() for a socket and then emit 'prefinish'.
        // For our implementation we do the same for the "written data buffer"
        this.emit("prefinish");
    }
    // No _flush() implementation?
    _flush() {
        // Difference from Node.js -
        // In Node.js, this function is only called if a socket exists.
        // For our implementation we do the same for the "written data buffer"
        if (this._writtenDataBuffer != null) {
            // There might be remaining data in this.output; write it out
            const ret = this._flushOutput(this._writtenDataBuffer);
            if (this.finished) {
                // This is a queue to the server or client to bring in the next this.
                this._finish();
            }
            else if (ret && this[kNeedDrain]) {
                this[kNeedDrain] = false;
                this.emit("drain");
            }
        }
    }
    _flushOutput(dataBuffer) {
        while (this[kCorked]) {
            this[kCorked]--;
            dataBuffer.cork();
        }
        const outputLength = this.outputData.length;
        if (outputLength <= 0) {
            return undefined;
        }
        const outputData = this.outputData;
        dataBuffer.cork();
        let ret;
        // Retain for(;;) loop for performance reasons
        // Refs: https://github.com/nodejs/node/pull/30958
        for (let i = 0; i < outputLength; i++) {
            const { data, encoding, callback } = outputData[i]; // Avoid any potential ref to Buffer in new generation from old generation
            outputData[i].data = null;
            ret = dataBuffer.write(data ?? "", encoding, callback);
        }
        dataBuffer.uncork();
        this.outputData = [];
        this._onPendingData(-this.outputSize);
        this.outputSize = 0;
        return ret;
    }
    flushHeaders() {
        if (!this._header) {
            this._implicitHeader();
        }
        // Force-flush the headers.
        this._send("");
    }
    pipe(destination) {
        // OutgoingMessage should be write-only. Piping from it is disabled.
        this.emit("error", new ERR_STREAM_CANNOT_PIPE());
        return destination;
    }
}
function processHeader(self, state, key, value, validate) {
    if (validate) {
        validateHeaderName(key);
    }
    // If key is content-disposition and there is content-length
    // encode the value in latin1
    // https://www.rfc-editor.org/rfc/rfc6266#section-4.3
    // Refs: https://github.com/nodejs/node/pull/46528
    if (isContentDispositionField(key) && self._contentLength) {
        // The value could be an array here
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                value[i] = String(Buffer.from(String(value[i]), "latin1"));
            }
        }
        else {
            value = String(Buffer.from(String(value), "latin1"));
        }
    }
    if (Array.isArray(value)) {
        if ((value.length < 2 || !isCookieField(key)) &&
            (!self[kUniqueHeaders] || !self[kUniqueHeaders].has(key.toLowerCase()))) {
            // Retain for(;;) loop for performance reasons
            // Refs: https://github.com/nodejs/node/pull/30958
            for (let i = 0; i < value.length; i++) {
                storeHeader(self, state, key, value[i], validate);
            }
            return;
        }
        value = value.join("; ");
    }
    storeHeader(self, state, key, String(value), validate);
}
function storeHeader(self, state, key, value, validate) {
    if (validate) {
        validateHeaderValue(key, value);
    }
    state.header += key + ": " + value + "\r\n";
    matchHeader(self, state, key, value);
}
function validateHeaderName(name, label) {
    if (typeof name !== "string" || !name || !checkIsHttpToken(name)) {
        throw new ERR_INVALID_HTTP_TOKEN(label || "Header name", name);
    }
}
function validateHeaderValue(name, value) {
    if (value === undefined) {
        throw new ERR_HTTP_INVALID_HEADER_VALUE(String(value), name);
    }
    if (checkInvalidHeaderChar(String(value))) {
        debug(`Header "${name}" contains invalid characters`);
        throw new ERR_INVALID_CHAR("header content", name);
    }
}
function matchHeader(self, state, field, value) {
    if (field.length < 4 || field.length > 17)
        return;
    field = field.toLowerCase();
    switch (field) {
        case "connection":
            state.connection = true;
            self._removedConnection = false;
            if (RE_CONN_CLOSE.exec(value) !== null)
                self._last = true;
            else
                self.shouldKeepAlive = true;
            break;
        case "transfer-encoding":
            state.te = true;
            self._removedTE = false;
            if (RE_TE_CHUNKED.exec(value) !== null)
                self.chunkedEncoding = true;
            break;
        case "content-length":
            state.contLen = true;
            self._contentLength = +value;
            self._removedContLen = false;
            break;
        case "date":
        case "expect":
        case "trailer":
            state[field] = true;
            break;
        case "keep-alive":
            self._defaultKeepAlive = false;
            break;
    }
}
// const crlf_buf = Buffer.from("\r\n");
function onError(msg, err, callback) {
    if (msg.destroyed) {
        return;
    }
    // Difference from Node.js -
    // In Node.js, we would check for the existence of a socket. If one exists, we would
    // use that async ID to scope the error.
    // Instead, we do this.
    setTimeout(emitErrorNt, 0, msg, err, callback);
}
function emitErrorNt(msg, err, callback) {
    callback(err);
    if (typeof msg.emit === "function" && !msg.destroyed) {
        msg.emit("error", err);
    }
}
function strictContentLength(msg) {
    return (msg.strictContentLength &&
        msg._contentLength != null &&
        msg._hasBody &&
        !msg._removedContLen &&
        !msg.chunkedEncoding &&
        !msg.hasHeader("transfer-encoding"));
}
function write_(msg, chunk, encoding, callback, fromEnd) {
    if (typeof callback !== "function") {
        callback = nop;
    }
    if (chunk === null) {
        throw new ERR_STREAM_NULL_VALUES();
    }
    else if (typeof chunk !== "string" && !isUint8Array(chunk)) {
        throw new ERR_INVALID_ARG_TYPE("chunk", ["string", "Buffer", "Uint8Array"], chunk);
    }
    let err = undefined;
    if (msg.finished) {
        err = new ERR_STREAM_WRITE_AFTER_END();
    }
    else if (msg.destroyed) {
        err = new ERR_STREAM_DESTROYED("write");
    }
    if (err) {
        if (!msg.destroyed) {
            onError(msg, err, callback);
        }
        else {
            setTimeout(callback, 0, err);
        }
        return false;
    }
    let len = undefined;
    if (msg.strictContentLength) {
        len ??=
            typeof chunk === "string"
                ? Buffer.byteLength(chunk, encoding ?? undefined)
                : chunk.byteLength;
        if (strictContentLength(msg) &&
            (fromEnd
                ? msg[kBytesWritten] + len !== msg._contentLength
                : msg[kBytesWritten] + len > (msg._contentLength ?? 0))) {
            throw new ERR_HTTP_CONTENT_LENGTH_MISMATCH(len + msg[kBytesWritten], msg._contentLength);
        }
        msg[kBytesWritten] += len;
    }
    if (!msg._header) {
        if (fromEnd) {
            len ??=
                typeof chunk === "string"
                    ? Buffer.byteLength(chunk, encoding ?? undefined)
                    : chunk.byteLength;
            msg._contentLength = len;
        }
        msg._implicitHeader();
    }
    if (!msg._hasBody) {
        if (msg[kRejectNonStandardBodyWrites]) {
            throw new ERR_HTTP_BODY_NOT_ALLOWED();
        }
        else {
            debug("This type of response MUST NOT have a body. " +
                "Ignoring write() calls.");
            setTimeout(callback, 0);
            return true;
        }
    }
    // Difference from Node.js -
    // In Node.js, we would also check at this point if a socket exists and is not corked.
    // If so, we'd cork the socket and then queue up an 'uncork' for the next tick.
    // In our implementation we do the same for "written data buffer"
    if (!fromEnd &&
        msg._writtenDataBuffer != null &&
        !msg._writtenDataBuffer.writableCorked) {
        msg._writtenDataBuffer.cork();
        setTimeout(connectionCorkNT, 0, msg._writtenDataBuffer);
    }
    let ret;
    if (msg.chunkedEncoding && chunk.length !== 0) {
        len ??=
            typeof chunk === "string"
                ? Buffer.byteLength(chunk, encoding ?? undefined)
                : chunk.byteLength;
        if (msg[kCorked] && msg._headerSent) {
            msg[kChunkedBuffer].push({ data: chunk, encoding, callback });
            msg[kChunkedLength] += len;
            ret = msg[kChunkedLength] < msg[kHighWaterMark];
        }
        else {
            // Difference from Node.js -
            // Chunked transfer encoding doesn't need to use the low-level protocol
            // (with each chunk preceded by its length)
            // msg._send(len.toString(16), "latin1", null);
            // msg._send(crlf_buf, null, null);
            // msg._send(chunk, encoding, null, len);
            // ret = msg._send(crlf_buf, null, callback);
            ret = msg._send(chunk, encoding, callback, len);
        }
    }
    else {
        ret = msg._send(chunk, encoding, callback, len);
    }
    debug("write ret = " + ret);
    return ret;
}
function connectionCorkNT(dataBuffer) {
    dataBuffer.uncork();
}
function onFinish(outmsg) {
    // Difference from Node.js -
    // In Node.js, if a socket exists and already had an error, we would simply return.
    outmsg.emit("finish");
}
// Override some properties this way, because TypeScript won't let us override
// properties with accessors.
Object.defineProperties(FetchOutgoingMessage.prototype, {
    errored: {
        get() {
            return this[kErrored];
        },
    },
    closed: {
        get() {
            return this._closed;
        },
    },
    writableFinished: {
        get() {
            // Difference from Node.js -
            // In Node.js, there is one additional requirement --
            //   there must be no underlying socket (or its writableLength must be 0).
            // In this implementation we will do the same against "written data buffer".
            return (this.finished &&
                this.outputSize === 0 &&
                (this._writtenDataBuffer == null ||
                    this._writtenDataBuffer.writableLength === 0));
        },
    },
    writableObjectMode: {
        get() {
            return false;
        },
    },
    writableLength: {
        get() {
            // Difference from Node.js -
            // In Node.js, if a socket exists then that socket's writableLength is added to
            // this value.
            // In this implementation we will do the same against "written data buffer".
            return (this.outputSize +
                this[kChunkedLength] +
                (this._writtenDataBuffer != null
                    ? this._writtenDataBuffer.writableLength
                    : 0));
        },
    },
    writableHighWaterMark: {
        get() {
            // Difference from Node.js -
            // In Node.js, if a socket exists then use that socket's writableHighWaterMark
            // In this implementation we will do the same against "written data buffer".
            return this._writtenDataBuffer != null
                ? this._writtenDataBuffer.writableHighWaterMark
                : this[kHighWaterMark];
        },
    },
    writableCorked: {
        get() {
            return this[kCorked];
        },
    },
    writableEnded: {
        get() {
            return this.finished;
        },
    },
    writableNeedDrain: {
        get() {
            return !this.destroyed && !this.finished && this[kNeedDrain];
        },
    },
});

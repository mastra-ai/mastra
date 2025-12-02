/*
 * Copyright Michael Hart
 * Licensed under the MIT license. See LICENSE file for details.
 *
 * Portions of this file Copyright Fastly, Inc. See LICENSE file for details.
 * Portions of this file Copyright Joyent, Inc. and other Node contributors. See LICENSE file for details.
 */
// This file modeled after Node.js - node/lib/_http_incoming.js
import { Readable } from "node:stream";
import { ERR_METHOD_NOT_IMPLEMENTED } from "../utils/errors.js";
const kHeaders = Symbol("kHeaders");
const kHeadersDistinct = Symbol("kHeadersDistinct");
const kHeadersCount = Symbol("kHeadersCount");
const kTrailers = Symbol("kTrailers");
const kTrailersDistinct = Symbol("kTrailersDistinct");
const kTrailersCount = Symbol("kTrailersCount");
/**
 * This is an implementation of IncomingMessage from Node.js intended to run in
 * a WinterTC runtime. The 'Readable' interface of this class is wired to a 'Request'
 * object's 'body'.
 *
 * This instance can be used in normal ways, but it does not give access to the
 * underlying socket (because there isn't one. req.socket will always return null).
 *
 * Some code in this class is transplanted/adapted from node/lib/_http_incoming.js
 */
export class FetchIncomingMessage extends Readable {
    get socket() {
        // Difference from Node.js -
        // We don't really have a way to support direct access to the socket
        return null;
    }
    set socket(_val) {
        // Difference from Node.js -
        // We don't really have a way to support direct access to the socket
        throw new ERR_METHOD_NOT_IMPLEMENTED("socket");
    }
    httpVersionMajor;
    httpVersionMinor;
    httpVersion;
    complete = false;
    [kHeaders] = null;
    [kHeadersDistinct] = null;
    [kHeadersCount] = 0;
    rawHeaders = [];
    [kTrailers] = null;
    [kTrailersDistinct] = null;
    [kTrailersCount] = 0;
    rawTrailers = [];
    joinDuplicateHeaders = false;
    aborted = false;
    upgrade = false;
    // request (server) only
    url = "";
    method;
    // TODO: Support ClientRequest
    // statusCode = null;
    // statusMessage = null;
    // client = socket;
    _consuming;
    _dumped;
    // The underlying ReadableStream
    _stream = null;
    constructor() {
        const streamOptions = {};
        // Difference from Node.js -
        // In Node.js, if the IncomingMessages is associated with a socket then
        // that socket's 'readableHighWaterMark' would be used to set
        // streamOptions.highWaterMark before calling parent constructor.
        super(streamOptions);
        this._readableState.readingMore = true;
        this._consuming = false;
        // Flag for when we decide that this message cannot possibly be
        // read by the user, so there's no point continuing to handle it.
        this._dumped = false;
    }
    get connection() {
        // Difference from Node.js -
        // We don't really have a way to support direct access to the socket
        return null;
    }
    set connection(_socket) {
        // Difference from Node.js -
        // We don't really have a way to support direct access to the socket
        console.error("No support for IncomingMessage.connection");
    }
    get headers() {
        if (!this[kHeaders]) {
            this[kHeaders] = {};
            const src = this.rawHeaders;
            const dst = this[kHeaders];
            for (let n = 0; n < this[kHeadersCount]; n += 2) {
                this._addHeaderLine(src[n], src[n + 1], dst);
            }
        }
        return this[kHeaders];
    }
    set headers(val) {
        this[kHeaders] = val;
    }
    get headersDistinct() {
        if (!this[kHeadersDistinct]) {
            this[kHeadersDistinct] = {};
            const src = this.rawHeaders;
            const dst = this[kHeadersDistinct];
            for (let n = 0; n < this[kHeadersCount]; n += 2) {
                this._addHeaderLineDistinct(src[n], src[n + 1], dst);
            }
        }
        return this[kHeadersDistinct];
    }
    set headersDistinct(val) {
        this[kHeadersDistinct] = val;
    }
    get trailers() {
        if (!this[kTrailers]) {
            this[kTrailers] = {};
            const src = this.rawTrailers;
            const dst = this[kTrailers];
            for (let n = 0; n < this[kTrailersCount]; n += 2) {
                this._addHeaderLine(src[n], src[n + 1], dst);
            }
        }
        return this[kTrailers];
    }
    set trailers(val) {
        this[kTrailers] = val;
    }
    get trailersDistinct() {
        if (!this[kTrailersDistinct]) {
            this[kTrailersDistinct] = {};
            const src = this.rawTrailers;
            const dst = this[kTrailersDistinct];
            for (let n = 0; n < this[kTrailersCount]; n += 2) {
                this._addHeaderLineDistinct(src[n], src[n + 1], dst);
            }
        }
        return this[kTrailersDistinct];
    }
    set trailersDistinct(val) {
        this[kTrailersDistinct] = val;
    }
    setTimeout(msecs, callback) {
        // Difference from Node.js -
        // In Node.js, this is supposed to set the underlying socket to time out
        // after some time and then run a callback.
        // We do nothing here since we don't really have a way to support direct
        // access to the socket.
        return this;
    }
    async _read(n) {
        // As this is an implementation of stream.Readable, we provide a _read()
        // function that pumps the next chunk out of the underlying ReadableStream.
        if (!this._consuming) {
            this._readableState.readingMore = false;
            this._consuming = true;
        }
        // Difference from Node.js -
        // The Node.js implementation will already have its internal buffer
        // filled by the parserOnBody function.
        // For our implementation, we use the ReadableStream instance.
        if (this._stream == null) {
            // For GET and HEAD requests, the stream would be empty.
            // Simply signal that we're done.
            this.complete = true;
            this.push(null);
            return;
        }
        const reader = this._stream.getReader();
        try {
            const data = await reader.read();
            if (data.done) {
                // Done with stream, tell Readable we have no more data;
                this.complete = true;
                this.push(null);
            }
            else {
                this.push(data.value);
            }
        }
        catch (e) {
            this.destroy(e);
        }
        finally {
            reader.releaseLock();
        }
    }
    _destroy(err, cb) {
        if (!this.readableEnded || !this.complete) {
            this.aborted = true;
            this.emit("aborted");
        }
        // Difference from Node.js -
        // Node.js would check for the existence of the socket and do some additional
        // cleanup.
        // By the way, I believe this name 'onError' is misleading, it is called
        // regardless of whether there was an error. The callback is expected to
        // check for the existence of the error to decide whether the result was
        // actually an error.
        setTimeout(onError, 0, this, err, cb);
    }
    _addHeaderLines(headers, n) {
        if (headers?.length) {
            let dest;
            if (this.complete) {
                this.rawTrailers = headers;
                this[kTrailersCount] = n;
                dest = this[kTrailers];
            }
            else {
                this.rawHeaders = headers;
                this[kHeadersCount] = n;
                dest = this[kHeaders];
            }
            if (dest) {
                for (let i = 0; i < n; i += 2) {
                    this._addHeaderLine(headers[i], headers[i + 1], dest);
                }
            }
        }
    }
    // Add the given (field, value) pair to the message
    //
    // Per RFC2616, section 4.2 it is acceptable to join multiple instances of the
    // same header with a ', ' if the header in question supports specification of
    // multiple values this way. The one exception to this is the Cookie header,
    // which has multiple values joined with a '; ' instead. If a header's values
    // cannot be joined in either of these ways, we declare the first instance the
    // winner and drop the second. Extended header fields (those beginning with
    // 'x-') are always joined.
    _addHeaderLine(field, value, dest) {
        field = matchKnownFields(field);
        const flag = field.charCodeAt(0);
        if (flag === 0 || flag === 2) {
            field = field.slice(1);
            // Make a delimited list
            if (typeof dest[field] === "string") {
                dest[field] += (flag === 0 ? ", " : "; ") + value;
            }
            else {
                dest[field] = value;
            }
        }
        else if (flag === 1) {
            // Array header -- only Set-Cookie at the moment
            if (dest["set-cookie"] !== undefined) {
                dest["set-cookie"].push(value);
            }
            else {
                dest["set-cookie"] = [value];
            }
        }
        else if (this.joinDuplicateHeaders) {
            // RFC 9110 https://www.rfc-editor.org/rfc/rfc9110#section-5.2
            // https://github.com/nodejs/node/issues/45699
            // allow authorization multiple fields
            // Make a delimited list
            if (dest[field] === undefined) {
                dest[field] = value;
            }
            else {
                dest[field] += ", " + value;
            }
        }
        else if (dest[field] === undefined) {
            // Drop duplicates
            dest[field] = value;
        }
    }
    _addHeaderLineDistinct(field, value, dest) {
        field = field.toLowerCase();
        if (!dest[field]) {
            dest[field] = [value];
        }
        else {
            dest[field].push(value);
        }
    }
    // Call this instead of resume() if we want to just
    // dump all the data to /dev/null
    _dump() {
        if (!this._dumped) {
            this._dumped = true;
            // If there is buffered data, it may trigger 'data' events.
            // Remove 'data' event listeners explicitly.
            this.removeAllListeners("data");
            this.resume();
        }
    }
}
/* These items copied from Node.js: node/lib/_http_incoming.js, because they are not exported from that file. */
// This function is used to help avoid the lowercasing of a field name if it
// matches a 'traditional cased' version of a field name. It then returns the
// lowercased name to both avoid calling toLowerCase() a second time and to
// indicate whether the field was a 'no duplicates' field. If a field is not a
// 'no duplicates' field, a `0` byte is prepended as a flag. The one exception
// to this is the Set-Cookie header which is indicated by a `1` byte flag, since
// it is an 'array' field and thus is treated differently in _addHeaderLines().
// TODO: perhaps http_parser could be returning both raw and lowercased versions
// of known header names to avoid us having to call toLowerCase() for those
// headers.
function matchKnownFields(field, lowercased = false) {
    switch (field.length) {
        case 3:
            if (field === "Age" || field === "age")
                return "age";
            break;
        case 4:
            if (field === "Host" || field === "host")
                return "host";
            if (field === "From" || field === "from")
                return "from";
            if (field === "ETag" || field === "etag")
                return "etag";
            if (field === "Date" || field === "date")
                return "\u0000date";
            if (field === "Vary" || field === "vary")
                return "\u0000vary";
            break;
        case 6:
            if (field === "Server" || field === "server")
                return "server";
            if (field === "Cookie" || field === "cookie")
                return "\u0002cookie";
            if (field === "Origin" || field === "origin")
                return "\u0000origin";
            if (field === "Expect" || field === "expect")
                return "\u0000expect";
            if (field === "Accept" || field === "accept")
                return "\u0000accept";
            break;
        case 7:
            if (field === "Referer" || field === "referer")
                return "referer";
            if (field === "Expires" || field === "expires")
                return "expires";
            if (field === "Upgrade" || field === "upgrade")
                return "\u0000upgrade";
            break;
        case 8:
            if (field === "Location" || field === "location")
                return "location";
            if (field === "If-Match" || field === "if-match")
                return "\u0000if-match";
            break;
        case 10:
            if (field === "User-Agent" || field === "user-agent")
                return "user-agent";
            if (field === "Set-Cookie" || field === "set-cookie")
                return "\u0001";
            if (field === "Connection" || field === "connection")
                return "\u0000connection";
            break;
        case 11:
            if (field === "Retry-After" || field === "retry-after")
                return "retry-after";
            break;
        case 12:
            if (field === "Content-Type" || field === "content-type")
                return "content-type";
            if (field === "Max-Forwards" || field === "max-forwards")
                return "max-forwards";
            break;
        case 13:
            if (field === "Authorization" || field === "authorization")
                return "authorization";
            if (field === "Last-Modified" || field === "last-modified")
                return "last-modified";
            if (field === "Cache-Control" || field === "cache-control")
                return "\u0000cache-control";
            if (field === "If-None-Match" || field === "if-none-match")
                return "\u0000if-none-match";
            break;
        case 14:
            if (field === "Content-Length" || field === "content-length")
                return "content-length";
            break;
        case 15:
            if (field === "Accept-Encoding" || field === "accept-encoding")
                return "\u0000accept-encoding";
            if (field === "Accept-Language" || field === "accept-language")
                return "\u0000accept-language";
            if (field === "X-Forwarded-For" || field === "x-forwarded-for")
                return "\u0000x-forwarded-for";
            break;
        case 16:
            if (field === "Content-Encoding" || field === "content-encoding")
                return "\u0000content-encoding";
            if (field === "X-Forwarded-Host" || field === "x-forwarded-host")
                return "\u0000x-forwarded-host";
            break;
        case 17:
            if (field === "If-Modified-Since" || field === "if-modified-since")
                return "if-modified-since";
            if (field === "Transfer-Encoding" || field === "transfer-encoding")
                return "\u0000transfer-encoding";
            if (field === "X-Forwarded-Proto" || field === "x-forwarded-proto")
                return "\u0000x-forwarded-proto";
            break;
        case 19:
            if (field === "Proxy-Authorization" || field === "proxy-authorization")
                return "proxy-authorization";
            if (field === "If-Unmodified-Since" || field === "if-unmodified-since")
                return "if-unmodified-since";
            break;
    }
    if (lowercased) {
        return "\u0000" + field;
    }
    return matchKnownFields(field.toLowerCase(), true);
}
function onError(self, error, cb) {
    // This is to keep backward compatible behavior.
    // An error is emitted only if there are listeners attached to the event.
    if (self.listenerCount("error") === 0) {
        cb();
    }
    else {
        cb(error);
    }
}

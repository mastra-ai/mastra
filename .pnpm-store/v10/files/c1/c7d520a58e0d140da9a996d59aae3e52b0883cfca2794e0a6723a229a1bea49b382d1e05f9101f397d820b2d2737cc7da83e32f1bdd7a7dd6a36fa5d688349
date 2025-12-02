/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Http2SessionHandler = exports.ExponentialBackoffPoller = exports.ApiSettings = exports.AuthorizedHttp2Client = exports.AuthorizedHttpClient = exports.Http2Client = exports.HttpClient = exports.RequestClient = exports.RequestResponseError = void 0;
exports.defaultRetryConfig = defaultRetryConfig;
exports.parseHttpResponse = parseHttpResponse;
const error_1 = require("./error");
const validator = require("./validator");
const http = require("http");
const https = require("https");
const http2 = require("http2");
const url = require("url");
const events_1 = require("events");
const credential_internal_1 = require("../app/credential-internal");
const index_1 = require("../utils/index");
class DefaultRequestResponse {
    /**
     * Constructs a new `RequestResponse` from the given `LowLevelResponse`.
     */
    constructor(resp) {
        this.status = resp.status;
        this.headers = resp.headers;
        this.text = resp.data;
        try {
            if (!resp.data) {
                throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INTERNAL_ERROR, 'HTTP response missing data.');
            }
            this.parsedData = JSON.parse(resp.data);
        }
        catch (err) {
            this.parsedData = undefined;
            this.parseError = err;
        }
        this.request = `${resp.config.method} ${resp.config.url}`;
    }
    get data() {
        if (this.isJson()) {
            return this.parsedData;
        }
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.UNABLE_TO_PARSE_RESPONSE, `Error while parsing response data: "${this.parseError.toString()}". Raw server ` +
            `response: "${this.text}". Status code: "${this.status}". Outgoing ` +
            `request: "${this.request}."`);
    }
    isJson() {
        return typeof this.parsedData !== 'undefined';
    }
}
/**
 * Represents a multipart HTTP or HTTP/2 response. Parts that constitute the response body can be accessed
 * via the multipart getter. Getters for text and data throw errors.
 */
class MultipartRequestResponse {
    constructor(resp) {
        this.status = resp.status;
        this.headers = resp.headers;
        this.multipart = resp.multipart;
    }
    get text() {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.UNABLE_TO_PARSE_RESPONSE, 'Unable to parse multipart payload as text');
    }
    get data() {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.UNABLE_TO_PARSE_RESPONSE, 'Unable to parse multipart payload as JSON');
    }
    isJson() {
        return false;
    }
}
class RequestResponseError extends Error {
    constructor(response) {
        super(`Server responded with status ${response.status}.`);
        this.response = response;
        // Set the prototype so that instanceof checks will work correctly.
        // See: https://github.com/Microsoft/TypeScript/issues/13965
        Object.setPrototypeOf(this, RequestResponseError.prototype);
    }
}
exports.RequestResponseError = RequestResponseError;
/**
 * Default retry configuration for HTTP and HTTP/2 requests. Retries up to 4 times on connection reset and timeout
 * errors as well as 503 errors. Exposed as a function to ensure that every `RequestClient` gets its own `RetryConfig`
 * instance.
 */
function defaultRetryConfig() {
    return {
        maxRetries: 4,
        statusCodes: [503],
        ioErrorCodes: ['ECONNRESET', 'ETIMEDOUT'],
        backOffFactor: 0.5,
        maxDelayInMillis: 60 * 1000,
    };
}
/**
 * Ensures that the given `RetryConfig` object is valid.
 *
 * @param retry - The configuration to be validated.
 */
function validateRetryConfig(retry) {
    if (!validator.isNumber(retry.maxRetries) || retry.maxRetries < 0) {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_ARGUMENT, 'maxRetries must be a non-negative integer');
    }
    if (typeof retry.backOffFactor !== 'undefined') {
        if (!validator.isNumber(retry.backOffFactor) || retry.backOffFactor < 0) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_ARGUMENT, 'backOffFactor must be a non-negative number');
        }
    }
    if (!validator.isNumber(retry.maxDelayInMillis) || retry.maxDelayInMillis < 0) {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_ARGUMENT, 'maxDelayInMillis must be a non-negative integer');
    }
    if (typeof retry.statusCodes !== 'undefined' && !validator.isArray(retry.statusCodes)) {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_ARGUMENT, 'statusCodes must be an array');
    }
    if (typeof retry.ioErrorCodes !== 'undefined' && !validator.isArray(retry.ioErrorCodes)) {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_ARGUMENT, 'ioErrorCodes must be an array');
    }
}
class RequestClient {
    constructor(retry = defaultRetryConfig()) {
        if (retry) {
            this.retry = retry;
            validateRetryConfig(this.retry);
        }
    }
    createRequestResponse(resp) {
        if (resp.multipart) {
            return new MultipartRequestResponse(resp);
        }
        return new DefaultRequestResponse(resp);
    }
    waitForRetry(delayMillis) {
        if (delayMillis > 0) {
            return new Promise((resolve) => {
                setTimeout(resolve, delayMillis);
            });
        }
        return Promise.resolve();
    }
    /**
     * Checks if a failed request is eligible for a retry, and if so returns the duration to wait before initiating
     * the retry.
     *
     * @param retryAttempts - Number of retries completed up to now.
     * @param err - The last encountered error.
     * @returns A 2-tuple where the 1st element is the duration to wait before another retry, and the
     *     2nd element is a boolean indicating whether the request is eligible for a retry or not.
     */
    getRetryDelayMillis(retryAttempts, err) {
        if (!this.isRetryEligible(retryAttempts, err)) {
            return [0, false];
        }
        const response = err.response;
        if (response && response.headers['retry-after']) {
            const delayMillis = this.parseRetryAfterIntoMillis(response.headers['retry-after']);
            if (delayMillis > 0) {
                return [delayMillis, true];
            }
        }
        return [this.backOffDelayMillis(retryAttempts), true];
    }
    isRetryEligible(retryAttempts, err) {
        if (!this.retry) {
            return false;
        }
        if (retryAttempts >= this.retry.maxRetries) {
            return false;
        }
        if (err.response) {
            const statusCodes = this.retry.statusCodes || [];
            return statusCodes.indexOf(err.response.status) !== -1;
        }
        if (err.code) {
            const retryCodes = this.retry.ioErrorCodes || [];
            return retryCodes.indexOf(err.code) !== -1;
        }
        return false;
    }
    /**???
     * Parses the Retry-After header as a milliseconds value. Return value is negative if the Retry-After header
     * contains an expired timestamp or otherwise malformed.
     */
    parseRetryAfterIntoMillis(retryAfter) {
        const delaySeconds = parseInt(retryAfter, 10);
        if (!isNaN(delaySeconds)) {
            return delaySeconds * 1000;
        }
        const date = new Date(retryAfter);
        if (!isNaN(date.getTime())) {
            return date.getTime() - Date.now();
        }
        return -1;
    }
    backOffDelayMillis(retryAttempts) {
        if (retryAttempts === 0) {
            return 0;
        }
        if (!this.retry) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INTERNAL_ERROR, 'Expected this.retry to exist.');
        }
        const backOffFactor = this.retry.backOffFactor || 0;
        const delayInSeconds = (2 ** retryAttempts) * backOffFactor;
        return Math.min(delayInSeconds * 1000, this.retry.maxDelayInMillis);
    }
}
exports.RequestClient = RequestClient;
class HttpClient extends RequestClient {
    constructor(retry) {
        super(retry);
    }
    /**
     * Sends an HTTP request to a remote server. If the server responds with a successful response (2xx), the returned
     * promise resolves with an `RequestResponse`. If the server responds with an error (3xx, 4xx, 5xx), the promise
     * rejects with an `RequestResponseError`. In case of all other errors, the promise rejects with a `FirebaseAppError`.
     * If a request fails due to a low-level network error, the client transparently retries the request once before
     * rejecting the promise.
     *
     * If the request data is specified as an object, it will be serialized into a JSON string. The application/json
     * content-type header will also be automatically set in this case. For all other payload types, the content-type
     * header should be explicitly set by the caller. To send a JSON leaf value (e.g. "foo", 5), parse it into JSON,
     * and pass as a string or a Buffer along with the appropriate content-type header.
     *
     * @param config - HTTP request to be sent.
     * @returns A promise that resolves with the response details.
     */
    send(config) {
        return this.sendWithRetry(config);
    }
    /**
     * Sends an HTTP request. In the event of an error, retries the HTTP request according to the
     * `RetryConfig` set on the `HttpClient`.
     *
     * @param config - HTTP request to be sent.
     * @param retryAttempts - Number of retries performed up to now.
     * @returns A promise that resolves with the response details.
     */
    sendWithRetry(config, retryAttempts = 0) {
        return AsyncHttpCall.invoke(config)
            .then((resp) => {
            return this.createRequestResponse(resp);
        })
            .catch((err) => {
            const [delayMillis, canRetry] = this.getRetryDelayMillis(retryAttempts, err);
            if (canRetry && this.retry && delayMillis <= this.retry.maxDelayInMillis) {
                return this.waitForRetry(delayMillis).then(() => {
                    return this.sendWithRetry(config, retryAttempts + 1);
                });
            }
            if (err.response) {
                throw new RequestResponseError(this.createRequestResponse(err.response));
            }
            if (err.code === 'ETIMEDOUT') {
                throw new error_1.FirebaseAppError(error_1.AppErrorCodes.NETWORK_TIMEOUT, `Error while making request: ${err.message}.`);
            }
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.NETWORK_ERROR, `Error while making request: ${err.message}. Error code: ${err.code}`);
        });
    }
}
exports.HttpClient = HttpClient;
class Http2Client extends RequestClient {
    constructor(retry = defaultRetryConfig()) {
        super(retry);
    }
    /**
     * Sends an HTTP/2 request to a remote server. If the server responds with a successful response (2xx), the returned
     * promise resolves with an `RequestResponse`. If the server responds with an error (3xx, 4xx, 5xx), the promise
     * rejects with an `RequestResponseError`. In case of all other errors, the promise rejects with a `FirebaseAppError`.
     * If a request fails due to a low-level network error, the client transparently retries the request once before
     * rejecting the promise.
     *
     * If the request data is specified as an object, it will be serialized into a JSON string. The application/json
     * content-type header will also be automatically set in this case. For all other payload types, the content-type
     * header should be explicitly set by the caller. To send a JSON leaf value (e.g. "foo", 5), parse it into JSON,
     * and pass as a string or a Buffer along with the appropriate content-type header.
     *
     * @param config - HTTP/2 request to be sent.
     * @returns A promise that resolves with the response details.
     */
    send(config) {
        return this.sendWithRetry(config);
    }
    /**
     * Sends an HTTP/2 request. In the event of an error, retries the HTTP/2 request according to the
     * `RetryConfig` set on the `Http2Client`.
     *
     * @param config - HTTP/2 request to be sent.
     * @param retryAttempts - Number of retries performed up to now.
     * @returns A promise that resolves with the response details.
     */
    sendWithRetry(config, retryAttempts = 0) {
        return AsyncHttp2Call.invoke(config)
            .then((resp) => {
            return this.createRequestResponse(resp);
        })
            .catch((err) => {
            const [delayMillis, canRetry] = this.getRetryDelayMillis(retryAttempts, err);
            if (canRetry && this.retry && delayMillis <= this.retry.maxDelayInMillis) {
                return this.waitForRetry(delayMillis).then(() => {
                    return this.sendWithRetry(config, retryAttempts + 1);
                });
            }
            if (err.response) {
                throw new RequestResponseError(this.createRequestResponse(err.response));
            }
            if (err.code === 'ETIMEDOUT') {
                throw new error_1.FirebaseAppError(error_1.AppErrorCodes.NETWORK_TIMEOUT, `Error while making request: ${err.message}.`);
            }
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.NETWORK_ERROR, `Error while making request: ${err.message}. Error code: ${err.code}`);
        });
    }
}
exports.Http2Client = Http2Client;
/**
 * Parses a full HTTP or HTTP/2 response message containing both a header and a body.
 *
 * @param response - The HTTP or HTTP/2 response to be parsed.
 * @param config - The request configuration that resulted in the HTTP or HTTP/2 response.
 * @returns An object containing the response's parsed status, headers and the body.
 */
function parseHttpResponse(response, config) {
    const responseText = validator.isBuffer(response) ?
        response.toString('utf-8') : response;
    const endOfHeaderPos = responseText.indexOf('\r\n\r\n');
    const headerLines = responseText.substring(0, endOfHeaderPos).split('\r\n');
    const statusLine = headerLines[0];
    const status = statusLine.trim().split(/\s/)[1];
    const headers = {};
    headerLines.slice(1).forEach((line) => {
        const colonPos = line.indexOf(':');
        const name = line.substring(0, colonPos).trim().toLowerCase();
        const value = line.substring(colonPos + 1).trim();
        headers[name] = value;
    });
    let data = responseText.substring(endOfHeaderPos + 4);
    if (data.endsWith('\n')) {
        data = data.slice(0, -1);
    }
    if (data.endsWith('\r')) {
        data = data.slice(0, -1);
    }
    const lowLevelResponse = {
        status: parseInt(status, 10),
        headers,
        data,
        config,
        request: null,
    };
    if (!validator.isNumber(lowLevelResponse.status)) {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INTERNAL_ERROR, 'Malformed HTTP status line.');
    }
    return new DefaultRequestResponse(lowLevelResponse);
}
/**
 * A helper class for common functionality needed to send requests over the wire.
 * It also wraps the callback API of the Node.js standard library in a more flexible Promise API.
 */
class AsyncRequestCall {
    constructor(configImpl) {
        this.configImpl = configImpl;
    }
    /**
     * Extracts multipart boundary from the HTTP header. The content-type header of a multipart
     * response has the form 'multipart/subtype; boundary=string'.
     *
     * If the content-type header does not exist, or does not start with
     * 'multipart/', then null will be returned.
     */
    getMultipartBoundary(headers) {
        const contentType = headers['content-type'];
        if (!contentType || !contentType.startsWith('multipart/')) {
            return null;
        }
        const segments = contentType.split(';');
        const emptyObject = {};
        const headerParams = segments.slice(1)
            .map((segment) => segment.trim().split('='))
            .reduce((curr, params) => {
            // Parse key=value pairs in the content-type header into properties of an object.
            if (params.length === 2) {
                const keyValuePair = {};
                keyValuePair[params[0]] = params[1];
                return Object.assign(curr, keyValuePair);
            }
            return curr;
        }, emptyObject);
        return headerParams.boundary;
    }
    handleMultipartResponse(response, respStream, boundary) {
        const busboy = require('@fastify/busboy'); // eslint-disable-line @typescript-eslint/no-var-requires
        const multipartParser = new busboy.Dicer({ boundary });
        const responseBuffer = [];
        multipartParser.on('part', (part) => {
            const tempBuffers = [];
            part.on('data', (partData) => {
                tempBuffers.push(partData);
            });
            part.on('end', () => {
                responseBuffer.push(Buffer.concat(tempBuffers));
            });
        });
        multipartParser.on('finish', () => {
            response.data = undefined;
            response.multipart = responseBuffer;
            this.finalizeResponse(response);
        });
        respStream.pipe(multipartParser);
    }
    handleRegularResponse(response, respStream) {
        const responseBuffer = [];
        respStream.on('data', (chunk) => {
            responseBuffer.push(chunk);
        });
        respStream.on('error', (err) => {
            const req = response.request;
            if (req && req.destroyed) {
                return;
            }
            this.enhanceAndReject(err, null, req);
        });
        respStream.on('end', () => {
            response.data = Buffer.concat(responseBuffer).toString();
            this.finalizeResponse(response);
        });
    }
    /**
     * Finalizes the current request call in-flight by either resolving or rejecting the associated
     * promise. In the event of an error, adds additional useful information to the returned error.
     */
    finalizeResponse(response) {
        if (response.status >= 200 && response.status < 300) {
            this.resolve(response);
        }
        else {
            this.rejectWithError('Request failed with status code ' + response.status, null, response.request, response);
        }
    }
    /**
     * Creates a new error from the given message, and enhances it with other information available.
     * Then the promise associated with this request call is rejected with the resulting error.
     */
    rejectWithError(message, code, request, response) {
        const error = new Error(message);
        this.enhanceAndReject(error, code, request, response);
    }
    enhanceAndReject(error, code, request, response) {
        this.reject(this.enhanceError(error, code, request, response));
    }
    /**
     * Enhances the given error by adding more information to it. Specifically, the request config,
     * the underlying request and response will be attached to the error.
     */
    enhanceError(error, code, request, response) {
        error.config = this.configImpl;
        if (code) {
            error.code = code;
        }
        error.request = request;
        error.response = response;
        return error;
    }
}
/**
 * A helper class for sending HTTP requests over the wire. This is a wrapper around the standard
 * http and https packages of Node.js, providing content processing, timeouts and error handling.
 * It also wraps the callback API of the Node.js standard library in a more flexible Promise API.
 */
class AsyncHttpCall extends AsyncRequestCall {
    /**
     * Sends an HTTP request based on the provided configuration.
     */
    static invoke(config) {
        return new AsyncHttpCall(config).promise;
    }
    constructor(config) {
        const httpConfigImpl = new HttpRequestConfigImpl(config);
        super(httpConfigImpl);
        try {
            this.httpConfigImpl = httpConfigImpl;
            this.options = this.httpConfigImpl.buildRequestOptions();
            this.entity = this.httpConfigImpl.buildEntity(this.options.headers);
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
                this.execute();
            });
        }
        catch (err) {
            this.promise = Promise.reject(this.enhanceError(err, null));
        }
    }
    execute() {
        const transport = this.options.protocol === 'https:' ? https : http;
        const req = transport.request(this.options, (res) => {
            this.handleResponse(res, req);
        });
        // Handle errors
        req.on('error', (err) => {
            if (req.aborted) {
                return;
            }
            this.enhanceAndReject(err, null, req);
        });
        const timeout = this.httpConfigImpl.timeout;
        const timeoutCallback = () => {
            req.destroy();
            this.rejectWithError(`timeout of ${timeout}ms exceeded`, 'ETIMEDOUT', req);
        };
        if (timeout) {
            // Listen to timeouts and throw an error.
            req.setTimeout(timeout, timeoutCallback);
        }
        // Send the request
        req.end(this.entity);
    }
    handleResponse(res, req) {
        if (req.aborted) {
            return;
        }
        if (!res.statusCode) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INTERNAL_ERROR, 'Expected a statusCode on the response from a ClientRequest');
        }
        const response = {
            status: res.statusCode,
            headers: res.headers,
            request: req,
            data: undefined,
            config: this.httpConfigImpl,
        };
        const boundary = this.getMultipartBoundary(res.headers);
        const respStream = this.uncompressResponse(res);
        if (boundary) {
            this.handleMultipartResponse(response, respStream, boundary);
        }
        else {
            this.handleRegularResponse(response, respStream);
        }
    }
    uncompressResponse(res) {
        // Uncompress the response body transparently if required.
        let respStream = res;
        const encodings = ['gzip', 'compress', 'deflate'];
        if (res.headers['content-encoding'] && encodings.indexOf(res.headers['content-encoding']) !== -1) {
            // Add the unzipper to the body stream processing pipeline.
            const zlib = require('zlib'); // eslint-disable-line @typescript-eslint/no-var-requires
            respStream = respStream.pipe(zlib.createUnzip());
            // Remove the content-encoding in order to not confuse downstream operations.
            delete res.headers['content-encoding'];
        }
        return respStream;
    }
}
class AsyncHttp2Call extends AsyncRequestCall {
    /**
     * Sends an HTTP2 request based on the provided configuration.
     */
    static invoke(config) {
        return new AsyncHttp2Call(config).promise;
    }
    constructor(config) {
        const http2ConfigImpl = new Http2RequestConfigImpl(config);
        super(http2ConfigImpl);
        try {
            this.http2ConfigImpl = http2ConfigImpl;
            this.options = this.http2ConfigImpl.buildRequestOptions();
            this.entity = this.http2ConfigImpl.buildEntity(this.options.headers);
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
                this.execute();
            });
        }
        catch (err) {
            this.promise = Promise.reject(this.enhanceError(err, null));
        }
    }
    execute() {
        const req = this.http2ConfigImpl.http2SessionHandler.session.request({
            ':method': this.options.method,
            ':scheme': this.options.protocol,
            ':path': this.options.path,
            ...this.options.headers
        });
        req.on('response', (headers) => {
            this.handleHttp2Response(headers, req);
        });
        // Handle errors
        req.on('error', (err) => {
            if (req.aborted) {
                return;
            }
            this.enhanceAndReject(err, null, req);
        });
        const timeout = this.http2ConfigImpl.timeout;
        const timeoutCallback = () => {
            req.destroy();
            this.rejectWithError(`timeout of ${timeout}ms exceeded`, 'ETIMEDOUT', req);
        };
        if (timeout) {
            // Listen to timeouts and throw an error.
            req.setTimeout(timeout, timeoutCallback);
        }
        req.end(this.entity);
    }
    handleHttp2Response(headers, stream) {
        if (stream.aborted) {
            return;
        }
        if (!headers[':status']) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INTERNAL_ERROR, 'Expected a statusCode on the response from a ClientRequest');
        }
        const response = {
            status: headers[':status'],
            headers: headers,
            request: stream,
            data: undefined,
            config: this.http2ConfigImpl,
        };
        const boundary = this.getMultipartBoundary(headers);
        const respStream = this.uncompressResponse(headers, stream);
        if (boundary) {
            this.handleMultipartResponse(response, respStream, boundary);
        }
        else {
            this.handleRegularResponse(response, respStream);
        }
    }
    uncompressResponse(headers, stream) {
        // Uncompress the response body transparently if required.
        let respStream = stream;
        const encodings = ['gzip', 'compress', 'deflate'];
        if (headers['content-encoding'] && encodings.indexOf(headers['content-encoding']) !== -1) {
            // Add the unzipper to the body stream processing pipeline.
            const zlib = require('zlib'); // eslint-disable-line @typescript-eslint/no-var-requires
            respStream = respStream.pipe(zlib.createUnzip());
            // Remove the content-encoding in order to not confuse downstream operations.
            delete headers['content-encoding'];
        }
        return respStream;
    }
}
/**
 * An adapter class with common functionality needed to extract options and entity data from a `RequestConfig`.
 */
class BaseRequestConfigImpl {
    constructor(config) {
        this.config = config;
        this.config = config;
    }
    get method() {
        return this.config.method;
    }
    get url() {
        return this.config.url;
    }
    get headers() {
        return this.config.headers;
    }
    get data() {
        return this.config.data;
    }
    get timeout() {
        return this.config.timeout;
    }
    buildEntity(headers) {
        let data;
        if (!this.hasEntity() || !this.isEntityEnclosingRequest()) {
            return data;
        }
        if (validator.isBuffer(this.data)) {
            data = this.data;
        }
        else if (validator.isObject(this.data)) {
            data = Buffer.from(JSON.stringify(this.data), 'utf-8');
            if (typeof headers['content-type'] === 'undefined') {
                headers['content-type'] = 'application/json;charset=utf-8';
            }
        }
        else if (validator.isString(this.data)) {
            data = Buffer.from(this.data, 'utf-8');
        }
        else {
            throw new Error('Request data must be a string, a Buffer or a json serializable object');
        }
        // Add Content-Length header if data exists.
        headers['Content-Length'] = data.length.toString();
        return data;
    }
    buildUrl() {
        const fullUrl = this.urlWithProtocol();
        if (!this.hasEntity() || this.isEntityEnclosingRequest()) {
            return url.parse(fullUrl);
        }
        if (!validator.isObject(this.data)) {
            throw new Error(`${this.method} requests cannot have a body`);
        }
        // Parse URL and append data to query string.
        const parsedUrl = new url.URL(fullUrl);
        const dataObj = this.data;
        for (const key in dataObj) {
            if (Object.prototype.hasOwnProperty.call(dataObj, key)) {
                parsedUrl.searchParams.append(key, dataObj[key]);
            }
        }
        return url.parse(parsedUrl.toString());
    }
    urlWithProtocol() {
        const fullUrl = this.url;
        if (fullUrl.startsWith('http://') || fullUrl.startsWith('https://')) {
            return fullUrl;
        }
        return `https://${fullUrl}`;
    }
    hasEntity() {
        return !!this.data;
    }
    isEntityEnclosingRequest() {
        // GET and HEAD requests do not support entity (body) in request.
        return this.method !== 'GET' && this.method !== 'HEAD';
    }
}
/**
 * An adapter class for extracting options and entity data from an `HttpRequestConfig`.
 */
class HttpRequestConfigImpl extends BaseRequestConfigImpl {
    constructor(httpConfig) {
        super(httpConfig);
        this.httpConfig = httpConfig;
    }
    get httpAgent() {
        return this.httpConfig.httpAgent;
    }
    buildRequestOptions() {
        const parsed = this.buildUrl();
        const protocol = parsed.protocol;
        let port = parsed.port;
        if (!port) {
            const isHttps = protocol === 'https:';
            port = isHttps ? '443' : '80';
        }
        return {
            protocol,
            hostname: parsed.hostname,
            port,
            path: parsed.path,
            method: this.method,
            agent: this.httpAgent,
            headers: Object.assign({}, this.headers),
        };
    }
}
/**
 * An adapter class for extracting options and entity data from an `Http2RequestConfig`.
 */
class Http2RequestConfigImpl extends BaseRequestConfigImpl {
    constructor(http2Config) {
        super(http2Config);
        this.http2Config = http2Config;
    }
    get http2SessionHandler() {
        return this.http2Config.http2SessionHandler;
    }
    buildRequestOptions() {
        const parsed = this.buildUrl();
        // TODO(b/401051826)
        const protocol = parsed.protocol;
        return {
            protocol,
            path: parsed.path,
            method: this.method,
            headers: Object.assign({}, this.headers),
        };
    }
}
class AuthorizedHttpClient extends HttpClient {
    constructor(app) {
        super();
        this.app = app;
    }
    send(request) {
        return this.getToken().then((token) => {
            const requestCopy = Object.assign({}, request);
            requestCopy.headers = Object.assign({}, request.headers);
            const authHeader = 'Authorization';
            requestCopy.headers[authHeader] = `Bearer ${token}`;
            let quotaProjectId;
            if (this.app.options.credential instanceof credential_internal_1.ApplicationDefaultCredential) {
                quotaProjectId = this.app.options.credential.getQuotaProjectId();
            }
            quotaProjectId = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || quotaProjectId;
            if (!requestCopy.headers['x-goog-user-project'] && validator.isNonEmptyString(quotaProjectId)) {
                requestCopy.headers['x-goog-user-project'] = quotaProjectId;
            }
            if (!requestCopy.httpAgent && this.app.options.httpAgent) {
                requestCopy.httpAgent = this.app.options.httpAgent;
            }
            requestCopy.headers['X-Goog-Api-Client'] = (0, index_1.getMetricsHeader)();
            return super.send(requestCopy);
        });
    }
    getToken() {
        return this.app.INTERNAL.getToken()
            .then((accessTokenObj) => accessTokenObj.accessToken);
    }
}
exports.AuthorizedHttpClient = AuthorizedHttpClient;
class AuthorizedHttp2Client extends Http2Client {
    constructor(app) {
        super();
        this.app = app;
    }
    send(request) {
        return this.getToken().then((token) => {
            const requestCopy = Object.assign({}, request);
            requestCopy.headers = Object.assign({}, request.headers);
            const authHeader = 'Authorization';
            requestCopy.headers[authHeader] = `Bearer ${token}`;
            let quotaProjectId;
            if (this.app.options.credential instanceof credential_internal_1.ApplicationDefaultCredential) {
                quotaProjectId = this.app.options.credential.getQuotaProjectId();
            }
            quotaProjectId = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || quotaProjectId;
            if (!requestCopy.headers['x-goog-user-project'] && validator.isNonEmptyString(quotaProjectId)) {
                requestCopy.headers['x-goog-user-project'] = quotaProjectId;
            }
            requestCopy.headers['X-Goog-Api-Client'] = (0, index_1.getMetricsHeader)();
            return super.send(requestCopy);
        });
    }
    getToken() {
        return this.app.INTERNAL.getToken()
            .then((accessTokenObj) => accessTokenObj.accessToken);
    }
}
exports.AuthorizedHttp2Client = AuthorizedHttp2Client;
/**
 * Class that defines all the settings for the backend API endpoint.
 *
 * @param endpoint - The Firebase Auth backend endpoint.
 * @param httpMethod - The HTTP method for that endpoint.
 * @constructor
 */
class ApiSettings {
    constructor(endpoint, httpMethod = 'POST') {
        this.endpoint = endpoint;
        this.httpMethod = httpMethod;
        this.setRequestValidator(null)
            .setResponseValidator(null);
    }
    /** @returns The backend API endpoint. */
    getEndpoint() {
        return this.endpoint;
    }
    /** @returns The request HTTP method. */
    getHttpMethod() {
        return this.httpMethod;
    }
    /**
     * @param requestValidator - The request validator.
     * @returns The current API settings instance.
     */
    setRequestValidator(requestValidator) {
        const nullFunction = () => undefined;
        this.requestValidator = requestValidator || nullFunction;
        return this;
    }
    /** @returns The request validator. */
    getRequestValidator() {
        return this.requestValidator;
    }
    /**
     * @param responseValidator - The response validator.
     * @returns The current API settings instance.
     */
    setResponseValidator(responseValidator) {
        const nullFunction = () => undefined;
        this.responseValidator = responseValidator || nullFunction;
        return this;
    }
    /** @returns The response validator. */
    getResponseValidator() {
        return this.responseValidator;
    }
}
exports.ApiSettings = ApiSettings;
/**
 * Class used for polling an endpoint with exponential backoff.
 *
 * Example usage:
 * ```
 * const poller = new ExponentialBackoffPoller();
 * poller
 *     .poll(() => {
 *       return myRequestToPoll()
 *           .then((responseData: any) => {
 *             if (!isValid(responseData)) {
 *               // Continue polling.
 *               return null;
 *             }
 *
 *             // Polling complete. Resolve promise with final response data.
 *             return responseData;
 *           });
 *     })
 *     .then((responseData: any) => {
 *       console.log(`Final response: ${responseData}`);
 *     });
 * ```
 */
class ExponentialBackoffPoller extends events_1.EventEmitter {
    constructor(initialPollingDelayMillis = 1000, maxPollingDelayMillis = 10000, masterTimeoutMillis = 60000) {
        super();
        this.initialPollingDelayMillis = initialPollingDelayMillis;
        this.maxPollingDelayMillis = maxPollingDelayMillis;
        this.masterTimeoutMillis = masterTimeoutMillis;
        this.numTries = 0;
        this.completed = false;
    }
    /**
     * Poll the provided callback with exponential backoff.
     *
     * @param callback - The callback to be called for each poll. If the
     *     callback resolves to a falsey value, polling will continue. Otherwise, the truthy
     *     resolution will be used to resolve the promise returned by this method.
     * @returns A Promise which resolves to the truthy value returned by the provided
     *     callback when polling is complete.
     */
    poll(callback) {
        if (this.pollCallback) {
            throw new Error('poll() can only be called once per instance of ExponentialBackoffPoller');
        }
        this.pollCallback = callback;
        this.on('poll', this.repoll);
        this.masterTimer = setTimeout(() => {
            if (this.completed) {
                return;
            }
            this.markCompleted();
            this.reject(new Error('ExponentialBackoffPoller deadline exceeded - Master timeout reached'));
        }, this.masterTimeoutMillis);
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.repoll();
        });
    }
    repoll() {
        this.pollCallback()
            .then((result) => {
            if (this.completed) {
                return;
            }
            if (!result) {
                this.repollTimer =
                    setTimeout(() => this.emit('poll'), this.getPollingDelayMillis());
                this.numTries++;
                return;
            }
            this.markCompleted();
            this.resolve(result);
        })
            .catch((err) => {
            if (this.completed) {
                return;
            }
            this.markCompleted();
            this.reject(err);
        });
    }
    getPollingDelayMillis() {
        const increasedPollingDelay = Math.pow(2, this.numTries) * this.initialPollingDelayMillis;
        return Math.min(increasedPollingDelay, this.maxPollingDelayMillis);
    }
    markCompleted() {
        this.completed = true;
        if (this.masterTimer) {
            clearTimeout(this.masterTimer);
        }
        if (this.repollTimer) {
            clearTimeout(this.repollTimer);
        }
    }
}
exports.ExponentialBackoffPoller = ExponentialBackoffPoller;
class Http2SessionHandler {
    constructor(url) {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.http2Session = this.createSession(url);
        });
    }
    createSession(url) {
        if (!this.http2Session || this.isClosed) {
            const opts = {
                // Set local max concurrent stream limit to respect backend limit
                peerMaxConcurrentStreams: 100,
                ALPNProtocols: ['h2']
            };
            const http2Session = http2.connect(url, opts);
            http2Session.on('goaway', (errorCode, _, opaqueData) => {
                this.reject(new error_1.FirebaseAppError(error_1.AppErrorCodes.NETWORK_ERROR, `Error while making requests: GOAWAY - ${opaqueData?.toString()}, Error code: ${errorCode}`));
            });
            http2Session.on('error', (error) => {
                let errorMessage;
                if (error.name == 'AggregateError' && error.errors) {
                    errorMessage = `Session error while making requests: ${error.code} - ${error.name}: ` +
                        `[${error.errors.map((error) => error.message).join(', ')}]`;
                }
                else {
                    errorMessage = `Session error while making requests: ${error.code} - ${error.message} `;
                }
                this.reject(new error_1.FirebaseAppError(error_1.AppErrorCodes.NETWORK_ERROR, errorMessage));
            });
            http2Session.on('close', () => {
                // Resolve current promise
                this.resolve();
            });
            return http2Session;
        }
        return this.http2Session;
    }
    invoke() {
        return this.promise;
    }
    get session() {
        return this.http2Session;
    }
    get isClosed() {
        return this.http2Session.closed;
    }
    close() {
        this.http2Session.close();
    }
}
exports.Http2SessionHandler = Http2SessionHandler;

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchHttpClientResponse = exports.FetchHttpClient = void 0;
const http_client_1 = require("./http-client");
const parse_error_1 = require("../exceptions/parse-error");
const DEFAULT_FETCH_TIMEOUT = 60000; // 60 seconds
class FetchHttpClient extends http_client_1.HttpClient {
    constructor(baseURL, options, fetchFn) {
        super(baseURL, options);
        this.baseURL = baseURL;
        this.options = options;
        // Default to global fetch if available
        if (!fetchFn) {
            if (!globalThis.fetch) {
                throw new Error('Fetch function not defined in the global scope and no replacement was provided.');
            }
            fetchFn = globalThis.fetch;
        }
        this._fetchFn = fetchFn.bind(globalThis);
    }
    /** @override */
    getClientName() {
        return 'fetch';
    }
    get(path, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.fetchRequestWithRetry(resourceURL, 'GET', null, options.headers);
            }
            else {
                return yield this.fetchRequest(resourceURL, 'GET', null, options.headers);
            }
        });
    }
    post(path, entity, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.fetchRequestWithRetry(resourceURL, 'POST', http_client_1.HttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
            else {
                return yield this.fetchRequest(resourceURL, 'POST', http_client_1.HttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
        });
    }
    put(path, entity, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.fetchRequestWithRetry(resourceURL, 'PUT', http_client_1.HttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
            else {
                return yield this.fetchRequest(resourceURL, 'PUT', http_client_1.HttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
        });
    }
    delete(path, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.fetchRequestWithRetry(resourceURL, 'DELETE', null, options.headers);
            }
            else {
                return yield this.fetchRequest(resourceURL, 'DELETE', null, options.headers);
            }
        });
    }
    fetchRequest(url, method, body, headers) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            // For methods which expect payloads, we should always pass a body value
            // even when it is empty. Without this, some JS runtimes (eg. Deno) will
            // inject a second Content-Length header.
            const methodHasPayload = method === 'POST' || method === 'PUT' || method === 'PATCH';
            const requestBody = body || (methodHasPayload ? '' : undefined);
            const { 'User-Agent': userAgent } = (((_a = this.options) === null || _a === void 0 ? void 0 : _a.headers) ||
                {});
            // Create AbortController for timeout if configured
            let abortController;
            let timeoutId;
            // Access timeout from the options with default of 60 seconds
            const timeout = (_c = (_b = this.options) === null || _b === void 0 ? void 0 : _b.timeout) !== null && _c !== void 0 ? _c : DEFAULT_FETCH_TIMEOUT; // Default 60 seconds
            abortController = new AbortController();
            timeoutId = setTimeout(() => {
                abortController === null || abortController === void 0 ? void 0 : abortController.abort();
            }, timeout);
            try {
                const res = yield this._fetchFn(url, {
                    method,
                    headers: Object.assign(Object.assign(Object.assign({ Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json' }, (_d = this.options) === null || _d === void 0 ? void 0 : _d.headers), headers), { 'User-Agent': this.addClientToUserAgent((userAgent || 'workos-node').toString()) }),
                    body: requestBody,
                    signal: abortController === null || abortController === void 0 ? void 0 : abortController.signal,
                });
                // Clear timeout if request completed successfully
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                if (!res.ok) {
                    const requestID = (_e = res.headers.get('X-Request-ID')) !== null && _e !== void 0 ? _e : '';
                    const rawBody = yield res.text();
                    let responseJson;
                    try {
                        responseJson = JSON.parse(rawBody);
                    }
                    catch (error) {
                        if (error instanceof SyntaxError) {
                            throw new parse_error_1.ParseError({
                                message: error.message,
                                rawBody,
                                requestID,
                                rawStatus: res.status,
                            });
                        }
                        throw error;
                    }
                    throw new http_client_1.HttpClientError({
                        message: res.statusText,
                        response: {
                            status: res.status,
                            headers: res.headers,
                            data: responseJson,
                        },
                    });
                }
                return new FetchHttpClientResponse(res);
            }
            catch (error) {
                // Clear timeout if request failed
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                // Handle timeout errors
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new http_client_1.HttpClientError({
                        message: `Request timeout after ${timeout}ms`,
                        response: {
                            status: 408,
                            headers: {},
                            data: { error: 'Request timeout' },
                        },
                    });
                }
                throw error;
            }
        });
    }
    fetchRequestWithRetry(url, method, body, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            let response;
            let retryAttempts = 1;
            const makeRequest = () => __awaiter(this, void 0, void 0, function* () {
                let requestError = null;
                try {
                    response = yield this.fetchRequest(url, method, body, headers);
                }
                catch (e) {
                    requestError = e;
                }
                if (this.shouldRetryRequest(requestError, retryAttempts)) {
                    retryAttempts++;
                    yield this.sleep(retryAttempts);
                    return makeRequest();
                }
                if (requestError != null) {
                    throw requestError;
                }
                return response;
            });
            return makeRequest();
        });
    }
    shouldRetryRequest(requestError, retryAttempt) {
        if (retryAttempt > this.MAX_RETRY_ATTEMPTS) {
            return false;
        }
        if (requestError != null) {
            if (requestError instanceof TypeError) {
                return true;
            }
            if (requestError instanceof http_client_1.HttpClientError &&
                this.RETRY_STATUS_CODES.includes(requestError.response.status)) {
                return true;
            }
        }
        return false;
    }
}
exports.FetchHttpClient = FetchHttpClient;
// tslint:disable-next-line
class FetchHttpClientResponse extends http_client_1.HttpClientResponse {
    constructor(res) {
        super(res.status, FetchHttpClientResponse._transformHeadersToObject(res.headers));
        this._res = res;
    }
    getRawResponse() {
        return this._res;
    }
    toJSON() {
        const contentType = this._res.headers.get('content-type');
        const isJsonResponse = contentType === null || contentType === void 0 ? void 0 : contentType.includes('application/json');
        return isJsonResponse ? this._res.json() : null;
    }
    static _transformHeadersToObject(headers) {
        // Fetch uses a Headers instance so this must be converted to a barebones
        // JS object to meet the HttpClient interface.
        const headersObj = {};
        for (const entry of Object.entries(headers)) {
            if (!Array.isArray(entry) || entry.length !== 2) {
                throw new Error('Response objects produced by the fetch function given to FetchHttpClient do not have an iterable headers map. Response#headers should be an iterable object.');
            }
            headersObj[entry[0]] = entry[1];
        }
        return headersObj;
    }
}
exports.FetchHttpClientResponse = FetchHttpClientResponse;

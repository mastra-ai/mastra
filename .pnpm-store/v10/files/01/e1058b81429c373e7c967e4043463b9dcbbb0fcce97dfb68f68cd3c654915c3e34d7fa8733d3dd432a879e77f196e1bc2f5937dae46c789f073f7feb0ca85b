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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractRestfulClient = exports.AbstractRestClient = void 0;
const errors_1 = require("../lib/errors");
const fetch_1 = require("../lib/fetch");
const AbstractClient_1 = require("./AbstractClient");
const runtime_1 = require("../lib/runtime");
const deepmerge_1 = __importDefault(require("deepmerge"));
/**
 * An abstract class that extends `AbstractClient` and provides a base implementation for a REST-based API client.
 * This class handles authentication, error handling, and other common functionality for REST API clients.
 */
class AbstractRestClient extends AbstractClient_1.AbstractClient {
    /**
     * Constructs a new instance of the `AbstractRestClient` class with the provided options.
     *
     * @param options - The client options to use for this instance.
     * @throws {DeepgramError} If the client is being used in a browser and no proxy is provided.
     */
    constructor(options) {
        super(options);
        if ((0, runtime_1.isBrowser)() && !this.proxy) {
            throw new errors_1.DeepgramError("Due to CORS we are unable to support REST-based API calls to our API from the browser. Please consider using a proxy: https://dpgr.am/js-proxy for more information.");
        }
        this.fetch = (0, fetch_1.fetchWithAuth)(this.key, this.namespaceOptions.fetch.client);
        if (this.proxy) {
            this.baseUrl = this.namespaceOptions.fetch.options.proxy.url;
        }
        else {
            this.baseUrl = this.namespaceOptions.fetch.options.url;
        }
    }
    /**
     * Constructs an error message from the provided error object.
     *
     * @param err - The error object to extract the error message from.
     * @returns The constructed error message.
     */
    _getErrorMessage(err) {
        return err.msg || err.message || err.error_description || err.error || JSON.stringify(err);
    }
    /**
     * Handles an error that occurred during a request.
     *
     * @param error - The error that occurred during the request.
     * @param reject - The rejection function to call with the error.
     * @returns A Promise that resolves when the error has been handled.
     */
    _handleError(error, reject) {
        return __awaiter(this, void 0, void 0, function* () {
            const Res = yield (0, fetch_1.resolveResponse)();
            if (error instanceof Res) {
                error
                    .json()
                    .then((err) => {
                    reject(new errors_1.DeepgramApiError(this._getErrorMessage(err), error.status || 500));
                })
                    .catch((err) => {
                    reject(new errors_1.DeepgramUnknownError(this._getErrorMessage(err), err));
                });
            }
            else {
                reject(new errors_1.DeepgramUnknownError(this._getErrorMessage(error), error));
            }
        });
    }
    /**
     * Constructs the options object to be used for a fetch request.
     *
     * @param method - The HTTP method to use for the request, such as "GET", "POST", "PUT", "PATCH", or "DELETE".
     * @param bodyOrOptions - For "POST", "PUT", and "PATCH" requests, the request body as a string, Buffer, or Readable stream. For "GET" and "DELETE" requests, the fetch options to use.
     * @param options - Additional fetch options to use for the request.
     * @returns The constructed fetch options object.
     */
    _getRequestOptions(method, bodyOrOptions, options) {
        let reqOptions = { method };
        if (method === "GET" || method === "DELETE") {
            reqOptions = Object.assign(Object.assign({}, reqOptions), bodyOrOptions);
        }
        else {
            reqOptions = Object.assign(Object.assign({ duplex: "half", body: bodyOrOptions }, reqOptions), options);
        }
        return (0, deepmerge_1.default)(this.namespaceOptions.fetch.options, reqOptions, { clone: false });
    }
    _handleRequest(method, url, bodyOrOptions, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const fetcher = this.fetch;
                fetcher(url, this._getRequestOptions(method, bodyOrOptions, options))
                    .then((result) => {
                    if (!result.ok)
                        throw result;
                    resolve(result);
                })
                    .catch((error) => this._handleError(error, reject));
            });
        });
    }
    /**
     * Handles an HTTP GET request using the provided URL and optional request options.
     *
     * @param url - The URL to send the GET request to.
     * @param options - Additional fetch options to use for the GET request.
     * @returns A Promise that resolves to the Response object for the GET request.
     */
    get(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._handleRequest("GET", url, options);
        });
    }
    /**
     * Handles an HTTP POST request using the provided URL, request body, and optional request options.
     *
     * @param url - The URL to send the POST request to.
     * @param body - The request body as a string, Buffer, or Readable stream.
     * @param options - Additional fetch options to use for the POST request.
     * @returns A Promise that resolves to the Response object for the POST request.
     */
    post(url, body, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._handleRequest("POST", url, body, options);
        });
    }
    /**
     * Handles an HTTP PUT request using the provided URL, request body, and optional request options.
     *
     * @param url - The URL to send the PUT request to.
     * @param body - The request body as a string, Buffer, or Readable stream.
     * @param options - Additional fetch options to use for the PUT request.
     * @returns A Promise that resolves to the Response object for the PUT request.
     */
    put(url, body, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._handleRequest("PUT", url, body, options);
        });
    }
    /**
     * Handles an HTTP PATCH request using the provided URL, request body, and optional request options.
     *
     * @param url - The URL to send the PATCH request to.
     * @param body - The request body as a string, Buffer, or Readable stream.
     * @param options - Additional fetch options to use for the PATCH request.
     * @returns A Promise that resolves to the Response object for the PATCH request.
     */
    patch(url, body, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._handleRequest("PATCH", url, body, options);
        });
    }
    /**
     * Handles an HTTP DELETE request using the provided URL and optional request options.
     *
     * @param url - The URL to send the DELETE request to.
     * @param options - Additional fetch options to use for the DELETE request.
     * @returns A Promise that resolves to the Response object for the DELETE request.
     */
    delete(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._handleRequest("DELETE", url, options);
        });
    }
    /**
     * Determines whether the current instance should proxy requests.
     * @returns {boolean} true if the current instance should proxy requests; otherwise, false
     */
    get proxy() {
        var _a;
        return this.key === "proxy" && !!((_a = this.namespaceOptions.fetch.options.proxy) === null || _a === void 0 ? void 0 : _a.url);
    }
}
exports.AbstractRestClient = AbstractRestClient;
exports.AbstractRestfulClient = AbstractRestClient;
//# sourceMappingURL=AbstractRestClient.js.map
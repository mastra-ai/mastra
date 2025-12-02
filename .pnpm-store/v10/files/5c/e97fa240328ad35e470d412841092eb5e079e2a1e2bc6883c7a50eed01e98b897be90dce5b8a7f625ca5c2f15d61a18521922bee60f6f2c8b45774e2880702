"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionsClient = void 0;
const tslib_1 = require("tslib");
const helper_1 = require("./helper");
const types_1 = require("./types");
class FunctionsClient {
    constructor(url, { headers = {}, customFetch, region = types_1.FunctionRegion.Any, } = {}) {
        this.url = url;
        this.headers = headers;
        this.region = region;
        this.fetch = (0, helper_1.resolveFetch)(customFetch);
    }
    /**
     * Updates the authorization header
     * @param token - the new jwt token sent in the authorisation header
     */
    setAuth(token) {
        this.headers.Authorization = `Bearer ${token}`;
    }
    /**
     * Invokes a function
     * @param functionName - The name of the Function to invoke.
     * @param options - Options for invoking the Function.
     */
    invoke(functionName_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function* (functionName, options = {}) {
            var _a;
            try {
                const { headers, method, body: functionArgs, signal } = options;
                let _headers = {};
                let { region } = options;
                if (!region) {
                    region = this.region;
                }
                // Add region as query parameter using URL API
                const url = new URL(`${this.url}/${functionName}`);
                if (region && region !== 'any') {
                    _headers['x-region'] = region;
                    url.searchParams.set('forceFunctionRegion', region);
                }
                let body;
                if (functionArgs &&
                    ((headers && !Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) || !headers)) {
                    if ((typeof Blob !== 'undefined' && functionArgs instanceof Blob) ||
                        functionArgs instanceof ArrayBuffer) {
                        // will work for File as File inherits Blob
                        // also works for ArrayBuffer as it is the same underlying structure as a Blob
                        _headers['Content-Type'] = 'application/octet-stream';
                        body = functionArgs;
                    }
                    else if (typeof functionArgs === 'string') {
                        // plain string
                        _headers['Content-Type'] = 'text/plain';
                        body = functionArgs;
                    }
                    else if (typeof FormData !== 'undefined' && functionArgs instanceof FormData) {
                        // don't set content-type headers
                        // Request will automatically add the right boundary value
                        body = functionArgs;
                    }
                    else {
                        // default, assume this is JSON
                        _headers['Content-Type'] = 'application/json';
                        body = JSON.stringify(functionArgs);
                    }
                }
                else {
                    // if the Content-Type was supplied, simply set the body
                    body = functionArgs;
                }
                const response = yield this.fetch(url.toString(), {
                    method: method || 'POST',
                    // headers priority is (high to low):
                    // 1. invoke-level headers
                    // 2. client-level headers
                    // 3. default Content-Type header
                    headers: Object.assign(Object.assign(Object.assign({}, _headers), this.headers), headers),
                    body,
                    signal,
                }).catch((fetchError) => {
                    if (fetchError.name === 'AbortError') {
                        throw fetchError;
                    }
                    throw new types_1.FunctionsFetchError(fetchError);
                });
                const isRelayError = response.headers.get('x-relay-error');
                if (isRelayError && isRelayError === 'true') {
                    throw new types_1.FunctionsRelayError(response);
                }
                if (!response.ok) {
                    throw new types_1.FunctionsHttpError(response);
                }
                let responseType = ((_a = response.headers.get('Content-Type')) !== null && _a !== void 0 ? _a : 'text/plain').split(';')[0].trim();
                let data;
                if (responseType === 'application/json') {
                    data = yield response.json();
                }
                else if (responseType === 'application/octet-stream' ||
                    responseType === 'application/pdf') {
                    data = yield response.blob();
                }
                else if (responseType === 'text/event-stream') {
                    data = response;
                }
                else if (responseType === 'multipart/form-data') {
                    data = yield response.formData();
                }
                else {
                    // default to text
                    data = yield response.text();
                }
                return { data, error: null, response };
            }
            catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return { data: null, error: new types_1.FunctionsFetchError(error) };
                }
                return {
                    data: null,
                    error,
                    response: error instanceof types_1.FunctionsHttpError || error instanceof types_1.FunctionsRelayError
                        ? error.context
                        : undefined,
                };
            }
        });
    }
}
exports.FunctionsClient = FunctionsClient;
//# sourceMappingURL=FunctionsClient.js.map
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestMessageAdapter = exports.RestRequestType = void 0;
const bent_1 = __importDefault(require("bent"));
const Exports_js_1 = require("../common/Exports.js");
var RestRequestType;
(function (RestRequestType) {
    RestRequestType["Get"] = "GET";
    RestRequestType["Post"] = "POST";
    RestRequestType["Delete"] = "DELETE";
    RestRequestType["File"] = "file";
})(RestRequestType = exports.RestRequestType || (exports.RestRequestType = {}));
// accept rest operations via request method and return abstracted objects from server response
class RestMessageAdapter {
    constructor(configParams) {
        if (!configParams) {
            throw new Exports_js_1.ArgumentNullError("configParams");
        }
        this.privHeaders = configParams.headers;
        this.privIgnoreCache = configParams.ignoreCache;
    }
    static extractHeaderValue(headerKey, headers) {
        let headerValue = "";
        try {
            const arr = headers.trim().split(/[\r\n]+/);
            const headerMap = {};
            arr.forEach((line) => {
                const parts = line.split(": ");
                const header = parts.shift().toLowerCase();
                const value = parts.join(": ");
                headerMap[header] = value;
            });
            headerValue = headerMap[headerKey.toLowerCase()];
        }
        catch (e) {
            // ignore the error
        }
        return headerValue;
    }
    set options(configParams) {
        this.privHeaders = configParams.headers;
        this.privIgnoreCache = configParams.ignoreCache;
    }
    setHeaders(key, value) {
        this.privHeaders[key] = value;
    }
    request(method, uri, queryParams = {}, body = null) {
        const responseReceivedDeferral = new Exports_js_1.Deferred();
        const requestCommand = method === RestRequestType.File ? "POST" : method;
        const handleRestResponse = (data, j = {}) => {
            const d = data;
            return {
                data: JSON.stringify(j),
                headers: JSON.stringify(data.headers),
                json: j,
                ok: data.statusCode >= 200 && data.statusCode < 300,
                status: data.statusCode,
                statusText: j.error ? j.error.message : d.statusText ? d.statusText : d.statusMessage
            };
        };
        const send = (postData) => {
            const sendRequest = (0, bent_1.default)(uri, requestCommand, this.privHeaders, 200, 201, 202, 204, 400, 401, 402, 403, 404);
            const params = this.queryParams(queryParams) === "" ? "" : `?${this.queryParams(queryParams)}`;
            sendRequest(params, postData).then(async (data) => {
                if (method === RestRequestType.Delete || data.statusCode === 204) {
                    // No JSON from Delete and reset (204) operations
                    responseReceivedDeferral.resolve(handleRestResponse(data));
                }
                else {
                    try {
                        const j = await data.json();
                        responseReceivedDeferral.resolve(handleRestResponse(data, j));
                    }
                    catch {
                        responseReceivedDeferral.resolve(handleRestResponse(data));
                    }
                }
            }).catch((error) => {
                responseReceivedDeferral.reject(error);
            });
        };
        if (this.privIgnoreCache) {
            this.privHeaders["Cache-Control"] = "no-cache";
        }
        if (method === RestRequestType.Post && body) {
            this.privHeaders["content-type"] = "application/json";
            this.privHeaders["Content-Type"] = "application/json";
        }
        send(body);
        return responseReceivedDeferral.promise;
    }
    queryParams(params = {}) {
        return Object.keys(params)
            .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
            .join("&");
    }
}
exports.RestMessageAdapter = RestMessageAdapter;

//# sourceMappingURL=RestMessageAdapter.js.map

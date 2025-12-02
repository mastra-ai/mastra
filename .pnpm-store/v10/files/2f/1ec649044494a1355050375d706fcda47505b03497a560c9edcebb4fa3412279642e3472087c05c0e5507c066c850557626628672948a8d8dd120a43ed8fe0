"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.NodeHttpClientResponse = exports.NodeHttpClient = void 0;
const http_client_1 = require("./http-client");
const http_ = __importStar(require("node:http"));
const https_ = __importStar(require("node:https"));
// `import * as http_ from 'http'` creates a "Module Namespace Exotic Object"
// which is immune to monkey-patching, whereas http_.default (in an ES Module context)
// will resolve to the same thing as require('http'), which is
// monkey-patchable. We care about this because users in their test
// suites might be using a library like "nock" which relies on the ability
// to monkey-patch and intercept calls to http.request.
const http = http_.default || http_;
const https = https_.default || https_;
class NodeHttpClient extends http_client_1.HttpClient {
    constructor(baseURL, options) {
        super(baseURL, options);
        this.baseURL = baseURL;
        this.options = options;
        this.httpAgent = new http.Agent({ keepAlive: true });
        this.httpsAgent = new https.Agent({ keepAlive: true });
    }
    getClientName() {
        return 'node';
    }
    static getBody(entity) {
        if (entity === null || entity === undefined) {
            return null;
        }
        if (entity instanceof URLSearchParams) {
            return entity.toString();
        }
        return JSON.stringify(entity);
    }
    get(path, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.nodeRequestWithRetry(resourceURL, 'GET', null, options.headers);
            }
            else {
                return yield this.nodeRequest(resourceURL, 'GET', null, options.headers);
            }
        });
    }
    post(path, entity, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.nodeRequestWithRetry(resourceURL, 'POST', NodeHttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
            else {
                return yield this.nodeRequest(resourceURL, 'POST', NodeHttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
        });
    }
    put(path, entity, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.nodeRequestWithRetry(resourceURL, 'PUT', NodeHttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
            else {
                return yield this.nodeRequest(resourceURL, 'PUT', NodeHttpClient.getBody(entity), Object.assign(Object.assign({}, http_client_1.HttpClient.getContentTypeHeader(entity)), options.headers));
            }
        });
    }
    delete(path, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceURL = http_client_1.HttpClient.getResourceURL(this.baseURL, path, options.params);
            if (path.startsWith('/fga/')) {
                return yield this.nodeRequestWithRetry(resourceURL, 'DELETE', null, options.headers);
            }
            else {
                return yield this.nodeRequest(resourceURL, 'DELETE', null, options.headers);
            }
        });
    }
    nodeRequest(url, method, body, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                var _a, _b;
                const isSecureConnection = url.startsWith('https');
                const agent = isSecureConnection ? this.httpsAgent : this.httpAgent;
                const lib = isSecureConnection ? https : http;
                const { 'User-Agent': userAgent } = (_a = this.options) === null || _a === void 0 ? void 0 : _a.headers;
                const options = {
                    method,
                    headers: Object.assign(Object.assign(Object.assign({ Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json' }, (_b = this.options) === null || _b === void 0 ? void 0 : _b.headers), headers), { 'User-Agent': this.addClientToUserAgent(userAgent.toString()) }),
                    agent,
                };
                const req = lib.request(url, options, (res) => __awaiter(this, void 0, void 0, function* () {
                    const clientResponse = new NodeHttpClientResponse(res);
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
                        reject(new http_client_1.HttpClientError({
                            message: res.statusMessage,
                            response: {
                                status: res.statusCode,
                                headers: res.headers,
                                data: yield clientResponse.toJSON(),
                            },
                        }));
                    }
                    resolve(clientResponse);
                }));
                req.on('error', (err) => {
                    reject(new Error(err.message));
                });
                if (body) {
                    req.setHeader('Content-Length', Buffer.byteLength(body));
                    req.write(body);
                }
                req.end();
            });
        });
    }
    nodeRequestWithRetry(url, method, body, headers) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const isSecureConnection = url.startsWith('https');
            const agent = isSecureConnection ? this.httpsAgent : this.httpAgent;
            const lib = isSecureConnection ? https : http;
            const { 'User-Agent': userAgent } = (_a = this.options) === null || _a === void 0 ? void 0 : _a.headers;
            const options = {
                method,
                headers: Object.assign(Object.assign(Object.assign({ Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json' }, (_b = this.options) === null || _b === void 0 ? void 0 : _b.headers), headers), { 'User-Agent': this.addClientToUserAgent(userAgent.toString()) }),
                agent,
            };
            let retryAttempts = 1;
            const makeRequest = () => __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => {
                    const req = lib.request(url, options, (res) => __awaiter(this, void 0, void 0, function* () {
                        const clientResponse = new NodeHttpClientResponse(res);
                        if (this.shouldRetryRequest(res, retryAttempts)) {
                            retryAttempts++;
                            yield this.sleep(retryAttempts);
                            return makeRequest().then(resolve).catch(reject);
                        }
                        if (res.statusCode &&
                            (res.statusCode < 200 || res.statusCode > 299)) {
                            reject(new http_client_1.HttpClientError({
                                message: res.statusMessage,
                                response: {
                                    status: res.statusCode,
                                    headers: res.headers,
                                    data: yield clientResponse.toJSON(),
                                },
                            }));
                        }
                        resolve(new NodeHttpClientResponse(res));
                    }));
                    req.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                        if (err != null && err instanceof TypeError) {
                            retryAttempts++;
                            yield this.sleep(retryAttempts);
                            return makeRequest().then(resolve).catch(reject);
                        }
                        reject(new Error(err.message));
                    }));
                    if (body) {
                        req.setHeader('Content-Length', Buffer.byteLength(body));
                        req.write(body);
                    }
                    req.end();
                });
            });
            return makeRequest();
        });
    }
    shouldRetryRequest(response, retryAttempt) {
        if (retryAttempt > this.MAX_RETRY_ATTEMPTS) {
            return false;
        }
        if (response != null &&
            this.RETRY_STATUS_CODES.includes(response.statusCode)) {
            return true;
        }
        return false;
    }
}
exports.NodeHttpClient = NodeHttpClient;
// tslint:disable-next-line
class NodeHttpClientResponse extends http_client_1.HttpClientResponse {
    constructor(res) {
        // @ts-ignore
        super(res.statusCode, res.headers || {});
        this._res = res;
    }
    getRawResponse() {
        return this._res;
    }
    toJSON() {
        return new Promise((resolve, reject) => {
            const contentType = this._res.headers['content-type'];
            const isJsonResponse = contentType === null || contentType === void 0 ? void 0 : contentType.includes('application/json');
            if (!isJsonResponse) {
                resolve(null);
            }
            let response = '';
            this._res.setEncoding('utf8');
            this._res.on('data', (chunk) => {
                response += chunk;
            });
            this._res.once('end', () => {
                try {
                    resolve(JSON.parse(response));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
}
exports.NodeHttpClientResponse = NodeHttpClientResponse;

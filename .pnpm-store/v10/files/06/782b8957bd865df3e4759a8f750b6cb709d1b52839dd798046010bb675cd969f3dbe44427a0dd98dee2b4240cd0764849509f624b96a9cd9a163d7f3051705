"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
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
var _ZeroEntropy_instances, _a, _ZeroEntropy_baseURLOverridden;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnprocessableEntityError = exports.PermissionDeniedError = exports.InternalServerError = exports.AuthenticationError = exports.BadRequestError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.APIUserAbortError = exports.APIConnectionTimeoutError = exports.APIConnectionError = exports.APIError = exports.ZeroEntropyError = exports.fileFromPath = exports.toFile = exports.ZeroEntropy = void 0;
const Core = __importStar(require("./core.js"));
const Errors = __importStar(require("./error.js"));
const Pagination = __importStar(require("./pagination.js"));
const Uploads = __importStar(require("./uploads.js"));
const API = __importStar(require("./resources/index.js"));
const collections_1 = require("./resources/collections.js");
const documents_1 = require("./resources/documents.js");
const models_1 = require("./resources/models.js");
const queries_1 = require("./resources/queries.js");
const status_1 = require("./resources/status.js");
/**
 * API Client for interfacing with the ZeroEntropy API.
 */
class ZeroEntropy extends Core.APIClient {
    /**
     * API Client for interfacing with the ZeroEntropy API.
     *
     * @param {string | undefined} [opts.apiKey=process.env['ZEROENTROPY_API_KEY'] ?? undefined]
     * @param {string} [opts.baseURL=process.env['ZEROENTROPY_BASE_URL'] ?? https://api.zeroentropy.dev/v1] - Override the default base URL for the API.
     * @param {number} [opts.timeout=1 minute] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
     * @param {Core.Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {Core.DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
     */
    constructor({ baseURL = Core.readEnv('ZEROENTROPY_BASE_URL'), apiKey = Core.readEnv('ZEROENTROPY_API_KEY'), ...opts } = {}) {
        if (apiKey === undefined) {
            throw new Errors.ZeroEntropyError("The ZEROENTROPY_API_KEY environment variable is missing or empty; either provide it, or instantiate the ZeroEntropy client with an apiKey option, like new ZeroEntropy({ apiKey: 'My API Key' }).");
        }
        const options = {
            apiKey,
            ...opts,
            baseURL: baseURL || `https://api.zeroentropy.dev/v1`,
        };
        super({
            baseURL: options.baseURL,
            baseURLOverridden: baseURL ? baseURL !== 'https://api.zeroentropy.dev/v1' : false,
            timeout: options.timeout ?? 60000 /* 1 minute */,
            httpAgent: options.httpAgent,
            maxRetries: options.maxRetries,
            fetch: options.fetch,
        });
        _ZeroEntropy_instances.add(this);
        this.status = new API.Status(this);
        this.collections = new API.Collections(this);
        this.documents = new API.Documents(this);
        this.queries = new API.Queries(this);
        this.models = new API.Models(this);
        this._options = options;
        this.apiKey = apiKey;
    }
    defaultQuery() {
        return this._options.defaultQuery;
    }
    defaultHeaders(opts) {
        return {
            ...super.defaultHeaders(opts),
            ...this._options.defaultHeaders,
        };
    }
    authHeaders(opts) {
        return { Authorization: `Bearer ${this.apiKey}` };
    }
}
exports.ZeroEntropy = ZeroEntropy;
_a = ZeroEntropy, _ZeroEntropy_instances = new WeakSet(), _ZeroEntropy_baseURLOverridden = function _ZeroEntropy_baseURLOverridden() {
    return this.baseURL !== 'https://api.zeroentropy.dev/v1';
};
ZeroEntropy.ZeroEntropy = _a;
ZeroEntropy.DEFAULT_TIMEOUT = 60000; // 1 minute
ZeroEntropy.ZeroEntropyError = Errors.ZeroEntropyError;
ZeroEntropy.APIError = Errors.APIError;
ZeroEntropy.APIConnectionError = Errors.APIConnectionError;
ZeroEntropy.APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
ZeroEntropy.APIUserAbortError = Errors.APIUserAbortError;
ZeroEntropy.NotFoundError = Errors.NotFoundError;
ZeroEntropy.ConflictError = Errors.ConflictError;
ZeroEntropy.RateLimitError = Errors.RateLimitError;
ZeroEntropy.BadRequestError = Errors.BadRequestError;
ZeroEntropy.AuthenticationError = Errors.AuthenticationError;
ZeroEntropy.InternalServerError = Errors.InternalServerError;
ZeroEntropy.PermissionDeniedError = Errors.PermissionDeniedError;
ZeroEntropy.UnprocessableEntityError = Errors.UnprocessableEntityError;
ZeroEntropy.toFile = Uploads.toFile;
ZeroEntropy.fileFromPath = Uploads.fileFromPath;
ZeroEntropy.Status = status_1.Status;
ZeroEntropy.Collections = collections_1.Collections;
ZeroEntropy.Documents = documents_1.Documents;
ZeroEntropy.DocumentGetInfoListResponsesGetDocumentInfoListCursor =
    documents_1.DocumentGetInfoListResponsesGetDocumentInfoListCursor;
ZeroEntropy.Queries = queries_1.Queries;
ZeroEntropy.Models = models_1.Models;
var uploads_1 = require("./uploads.js");
Object.defineProperty(exports, "toFile", { enumerable: true, get: function () { return uploads_1.toFile; } });
Object.defineProperty(exports, "fileFromPath", { enumerable: true, get: function () { return uploads_1.fileFromPath; } });
var error_1 = require("./error.js");
Object.defineProperty(exports, "ZeroEntropyError", { enumerable: true, get: function () { return error_1.ZeroEntropyError; } });
Object.defineProperty(exports, "APIError", { enumerable: true, get: function () { return error_1.APIError; } });
Object.defineProperty(exports, "APIConnectionError", { enumerable: true, get: function () { return error_1.APIConnectionError; } });
Object.defineProperty(exports, "APIConnectionTimeoutError", { enumerable: true, get: function () { return error_1.APIConnectionTimeoutError; } });
Object.defineProperty(exports, "APIUserAbortError", { enumerable: true, get: function () { return error_1.APIUserAbortError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return error_1.NotFoundError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return error_1.ConflictError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return error_1.RateLimitError; } });
Object.defineProperty(exports, "BadRequestError", { enumerable: true, get: function () { return error_1.BadRequestError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return error_1.AuthenticationError; } });
Object.defineProperty(exports, "InternalServerError", { enumerable: true, get: function () { return error_1.InternalServerError; } });
Object.defineProperty(exports, "PermissionDeniedError", { enumerable: true, get: function () { return error_1.PermissionDeniedError; } });
Object.defineProperty(exports, "UnprocessableEntityError", { enumerable: true, get: function () { return error_1.UnprocessableEntityError; } });
exports = module.exports = ZeroEntropy;
exports.default = ZeroEntropy;
//# sourceMappingURL=index.js.map
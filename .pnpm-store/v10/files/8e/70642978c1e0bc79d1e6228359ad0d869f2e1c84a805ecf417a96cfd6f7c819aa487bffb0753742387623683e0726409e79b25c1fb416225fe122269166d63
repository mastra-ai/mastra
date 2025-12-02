// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var _ZeroEntropy_instances, _a, _ZeroEntropy_baseURLOverridden;
import * as Core from "./core.mjs";
import * as Errors from "./error.mjs";
import * as Pagination from "./pagination.mjs";
import * as Uploads from "./uploads.mjs";
import * as API from "./resources/index.mjs";
import { Collections, } from "./resources/collections.mjs";
import { DocumentGetInfoListResponsesGetDocumentInfoListCursor, Documents, } from "./resources/documents.mjs";
import { Models } from "./resources/models.mjs";
import { Queries, } from "./resources/queries.mjs";
import { Status } from "./resources/status.mjs";
/**
 * API Client for interfacing with the ZeroEntropy API.
 */
export class ZeroEntropy extends Core.APIClient {
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
ZeroEntropy.Status = Status;
ZeroEntropy.Collections = Collections;
ZeroEntropy.Documents = Documents;
ZeroEntropy.DocumentGetInfoListResponsesGetDocumentInfoListCursor =
    DocumentGetInfoListResponsesGetDocumentInfoListCursor;
ZeroEntropy.Queries = Queries;
ZeroEntropy.Models = Models;
export { toFile, fileFromPath } from "./uploads.mjs";
export { ZeroEntropyError, APIError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, NotFoundError, ConflictError, RateLimitError, BadRequestError, AuthenticationError, InternalServerError, PermissionDeniedError, UnprocessableEntityError, } from "./error.mjs";
export default ZeroEntropy;
//# sourceMappingURL=index.mjs.map
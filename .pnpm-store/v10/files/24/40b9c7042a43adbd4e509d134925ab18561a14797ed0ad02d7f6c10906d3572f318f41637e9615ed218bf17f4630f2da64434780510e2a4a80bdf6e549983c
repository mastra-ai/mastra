import { type Agent } from "./_shims/index.js";
import * as Core from "./core.js";
import * as Errors from "./error.js";
import * as Pagination from "./pagination.js";
import { type GetDocumentInfoListCursorParams, GetDocumentInfoListCursorResponse } from "./pagination.js";
import * as Uploads from "./uploads.js";
import * as API from "./resources/index.js";
import { CollectionAddParams, CollectionAddResponse, CollectionDeleteParams, CollectionDeleteResponse, CollectionGetListParams, CollectionGetListResponse, Collections } from "./resources/collections.js";
import { DocumentAddParams, DocumentAddResponse, DocumentDeleteParams, DocumentDeleteResponse, DocumentGetInfoListParams, DocumentGetInfoListResponse, DocumentGetInfoListResponsesGetDocumentInfoListCursor, DocumentGetInfoParams, DocumentGetInfoResponse, DocumentGetPageInfoParams, DocumentGetPageInfoResponse, DocumentUpdateParams, DocumentUpdateResponse, Documents } from "./resources/documents.js";
import { ModelRerankParams, ModelRerankResponse, Models } from "./resources/models.js";
import { Queries, QueryTopDocumentsParams, QueryTopDocumentsResponse, QueryTopPagesParams, QueryTopPagesResponse, QueryTopSnippetsParams, QueryTopSnippetsResponse } from "./resources/queries.js";
import { Status, StatusGetStatusParams, StatusGetStatusResponse } from "./resources/status.js";
export interface ClientOptions {
    /**
     * API Key for accessing the ZeroEntropy API.
     */
    apiKey?: string | undefined;
    /**
     * Override the default base URL for the API, e.g., "https://api.example.com/v2/"
     *
     * Defaults to process.env['ZEROENTROPY_BASE_URL'].
     */
    baseURL?: string | null | undefined;
    /**
     * The maximum amount of time (in milliseconds) that the client should wait for a response
     * from the server before timing out a single request.
     *
     * Note that request timeouts are retried by default, so in a worst-case scenario you may wait
     * much longer than this timeout before the promise succeeds or fails.
     *
     * @unit milliseconds
     */
    timeout?: number | undefined;
    /**
     * An HTTP agent used to manage HTTP(S) connections.
     *
     * If not provided, an agent will be constructed by default in the Node.js environment,
     * otherwise no agent is used.
     */
    httpAgent?: Agent | undefined;
    /**
     * Specify a custom `fetch` function implementation.
     *
     * If not provided, we use `node-fetch` on Node.js and otherwise expect that `fetch` is
     * defined globally.
     */
    fetch?: Core.Fetch | undefined;
    /**
     * The maximum number of times that the client will retry a request in case of a
     * temporary failure, like a network error or a 5XX error from the server.
     *
     * @default 2
     */
    maxRetries?: number | undefined;
    /**
     * Default headers to include with every request to the API.
     *
     * These can be removed in individual requests by explicitly setting the
     * header to `undefined` or `null` in request options.
     */
    defaultHeaders?: Core.Headers | undefined;
    /**
     * Default query parameters to include with every request to the API.
     *
     * These can be removed in individual requests by explicitly setting the
     * param to `undefined` in request options.
     */
    defaultQuery?: Core.DefaultQuery | undefined;
}
/**
 * API Client for interfacing with the ZeroEntropy API.
 */
export declare class ZeroEntropy extends Core.APIClient {
    #private;
    apiKey: string;
    private _options;
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
    constructor({ baseURL, apiKey, ...opts }?: ClientOptions);
    status: API.Status;
    collections: API.Collections;
    documents: API.Documents;
    queries: API.Queries;
    models: API.Models;
    protected defaultQuery(): Core.DefaultQuery | undefined;
    protected defaultHeaders(opts: Core.FinalRequestOptions): Core.Headers;
    protected authHeaders(opts: Core.FinalRequestOptions): Core.Headers;
    static ZeroEntropy: typeof ZeroEntropy;
    static DEFAULT_TIMEOUT: number;
    static ZeroEntropyError: typeof Errors.ZeroEntropyError;
    static APIError: typeof Errors.APIError;
    static APIConnectionError: typeof Errors.APIConnectionError;
    static APIConnectionTimeoutError: typeof Errors.APIConnectionTimeoutError;
    static APIUserAbortError: typeof Errors.APIUserAbortError;
    static NotFoundError: typeof Errors.NotFoundError;
    static ConflictError: typeof Errors.ConflictError;
    static RateLimitError: typeof Errors.RateLimitError;
    static BadRequestError: typeof Errors.BadRequestError;
    static AuthenticationError: typeof Errors.AuthenticationError;
    static InternalServerError: typeof Errors.InternalServerError;
    static PermissionDeniedError: typeof Errors.PermissionDeniedError;
    static UnprocessableEntityError: typeof Errors.UnprocessableEntityError;
    static toFile: typeof Uploads.toFile;
    static fileFromPath: typeof Uploads.fileFromPath;
}
export declare namespace ZeroEntropy {
    export type RequestOptions = Core.RequestOptions;
    export import GetDocumentInfoListCursor = Pagination.GetDocumentInfoListCursor;
    export { type GetDocumentInfoListCursorParams as GetDocumentInfoListCursorParams, type GetDocumentInfoListCursorResponse as GetDocumentInfoListCursorResponse, };
    export { Status as Status, type StatusGetStatusResponse as StatusGetStatusResponse, type StatusGetStatusParams as StatusGetStatusParams, };
    export { Collections as Collections, type CollectionDeleteResponse as CollectionDeleteResponse, type CollectionAddResponse as CollectionAddResponse, type CollectionGetListResponse as CollectionGetListResponse, type CollectionDeleteParams as CollectionDeleteParams, type CollectionAddParams as CollectionAddParams, type CollectionGetListParams as CollectionGetListParams, };
    export { Documents as Documents, type DocumentUpdateResponse as DocumentUpdateResponse, type DocumentDeleteResponse as DocumentDeleteResponse, type DocumentAddResponse as DocumentAddResponse, type DocumentGetInfoResponse as DocumentGetInfoResponse, type DocumentGetInfoListResponse as DocumentGetInfoListResponse, type DocumentGetPageInfoResponse as DocumentGetPageInfoResponse, DocumentGetInfoListResponsesGetDocumentInfoListCursor as DocumentGetInfoListResponsesGetDocumentInfoListCursor, type DocumentUpdateParams as DocumentUpdateParams, type DocumentDeleteParams as DocumentDeleteParams, type DocumentAddParams as DocumentAddParams, type DocumentGetInfoParams as DocumentGetInfoParams, type DocumentGetInfoListParams as DocumentGetInfoListParams, type DocumentGetPageInfoParams as DocumentGetPageInfoParams, };
    export { Queries as Queries, type QueryTopDocumentsResponse as QueryTopDocumentsResponse, type QueryTopPagesResponse as QueryTopPagesResponse, type QueryTopSnippetsResponse as QueryTopSnippetsResponse, type QueryTopDocumentsParams as QueryTopDocumentsParams, type QueryTopPagesParams as QueryTopPagesParams, type QueryTopSnippetsParams as QueryTopSnippetsParams, };
    export { Models as Models, type ModelRerankResponse as ModelRerankResponse, type ModelRerankParams as ModelRerankParams, };
}
export { toFile, fileFromPath } from "./uploads.js";
export { ZeroEntropyError, APIError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, NotFoundError, ConflictError, RateLimitError, BadRequestError, AuthenticationError, InternalServerError, PermissionDeniedError, UnprocessableEntityError, } from "./error.js";
export default ZeroEntropy;
//# sourceMappingURL=index.d.ts.map
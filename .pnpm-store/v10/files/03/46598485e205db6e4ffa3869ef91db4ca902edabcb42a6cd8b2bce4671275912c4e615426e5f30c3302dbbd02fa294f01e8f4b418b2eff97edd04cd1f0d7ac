// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { type Agent } from './_shims/index';
import * as Core from './core';
import * as Errors from './error';
import * as Pagination from './pagination';
import { type GetDocumentInfoListCursorParams, GetDocumentInfoListCursorResponse } from './pagination';
import * as Uploads from './uploads';
import * as API from './resources/index';
import {
  CollectionAddParams,
  CollectionAddResponse,
  CollectionDeleteParams,
  CollectionDeleteResponse,
  CollectionGetListParams,
  CollectionGetListResponse,
  Collections,
} from './resources/collections';
import {
  DocumentAddParams,
  DocumentAddResponse,
  DocumentDeleteParams,
  DocumentDeleteResponse,
  DocumentGetInfoListParams,
  DocumentGetInfoListResponse,
  DocumentGetInfoListResponsesGetDocumentInfoListCursor,
  DocumentGetInfoParams,
  DocumentGetInfoResponse,
  DocumentGetPageInfoParams,
  DocumentGetPageInfoResponse,
  DocumentUpdateParams,
  DocumentUpdateResponse,
  Documents,
} from './resources/documents';
import { ModelRerankParams, ModelRerankResponse, Models } from './resources/models';
import {
  Queries,
  QueryTopDocumentsParams,
  QueryTopDocumentsResponse,
  QueryTopPagesParams,
  QueryTopPagesResponse,
  QueryTopSnippetsParams,
  QueryTopSnippetsResponse,
} from './resources/queries';
import { Status, StatusGetStatusParams, StatusGetStatusResponse } from './resources/status';

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
export class ZeroEntropy extends Core.APIClient {
  apiKey: string;

  private _options: ClientOptions;

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
  constructor({
    baseURL = Core.readEnv('ZEROENTROPY_BASE_URL'),
    apiKey = Core.readEnv('ZEROENTROPY_API_KEY'),
    ...opts
  }: ClientOptions = {}) {
    if (apiKey === undefined) {
      throw new Errors.ZeroEntropyError(
        "The ZEROENTROPY_API_KEY environment variable is missing or empty; either provide it, or instantiate the ZeroEntropy client with an apiKey option, like new ZeroEntropy({ apiKey: 'My API Key' }).",
      );
    }

    const options: ClientOptions = {
      apiKey,
      ...opts,
      baseURL: baseURL || `https://api.zeroentropy.dev/v1`,
    };

    super({
      baseURL: options.baseURL!,
      baseURLOverridden: baseURL ? baseURL !== 'https://api.zeroentropy.dev/v1' : false,
      timeout: options.timeout ?? 60000 /* 1 minute */,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });

    this._options = options;

    this.apiKey = apiKey;
  }

  status: API.Status = new API.Status(this);
  collections: API.Collections = new API.Collections(this);
  documents: API.Documents = new API.Documents(this);
  queries: API.Queries = new API.Queries(this);
  models: API.Models = new API.Models(this);

  /**
   * Check whether the base URL is set to its default.
   */
  #baseURLOverridden(): boolean {
    return this.baseURL !== 'https://api.zeroentropy.dev/v1';
  }

  protected override defaultQuery(): Core.DefaultQuery | undefined {
    return this._options.defaultQuery;
  }

  protected override defaultHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    return {
      ...super.defaultHeaders(opts),
      ...this._options.defaultHeaders,
    };
  }

  protected override authHeaders(opts: Core.FinalRequestOptions): Core.Headers {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  static ZeroEntropy = this;
  static DEFAULT_TIMEOUT = 60000; // 1 minute

  static ZeroEntropyError = Errors.ZeroEntropyError;
  static APIError = Errors.APIError;
  static APIConnectionError = Errors.APIConnectionError;
  static APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
  static APIUserAbortError = Errors.APIUserAbortError;
  static NotFoundError = Errors.NotFoundError;
  static ConflictError = Errors.ConflictError;
  static RateLimitError = Errors.RateLimitError;
  static BadRequestError = Errors.BadRequestError;
  static AuthenticationError = Errors.AuthenticationError;
  static InternalServerError = Errors.InternalServerError;
  static PermissionDeniedError = Errors.PermissionDeniedError;
  static UnprocessableEntityError = Errors.UnprocessableEntityError;

  static toFile = Uploads.toFile;
  static fileFromPath = Uploads.fileFromPath;
}

ZeroEntropy.Status = Status;
ZeroEntropy.Collections = Collections;
ZeroEntropy.Documents = Documents;
ZeroEntropy.DocumentGetInfoListResponsesGetDocumentInfoListCursor =
  DocumentGetInfoListResponsesGetDocumentInfoListCursor;
ZeroEntropy.Queries = Queries;
ZeroEntropy.Models = Models;
export declare namespace ZeroEntropy {
  export type RequestOptions = Core.RequestOptions;

  export import GetDocumentInfoListCursor = Pagination.GetDocumentInfoListCursor;
  export {
    type GetDocumentInfoListCursorParams as GetDocumentInfoListCursorParams,
    type GetDocumentInfoListCursorResponse as GetDocumentInfoListCursorResponse,
  };

  export {
    Status as Status,
    type StatusGetStatusResponse as StatusGetStatusResponse,
    type StatusGetStatusParams as StatusGetStatusParams,
  };

  export {
    Collections as Collections,
    type CollectionDeleteResponse as CollectionDeleteResponse,
    type CollectionAddResponse as CollectionAddResponse,
    type CollectionGetListResponse as CollectionGetListResponse,
    type CollectionDeleteParams as CollectionDeleteParams,
    type CollectionAddParams as CollectionAddParams,
    type CollectionGetListParams as CollectionGetListParams,
  };

  export {
    Documents as Documents,
    type DocumentUpdateResponse as DocumentUpdateResponse,
    type DocumentDeleteResponse as DocumentDeleteResponse,
    type DocumentAddResponse as DocumentAddResponse,
    type DocumentGetInfoResponse as DocumentGetInfoResponse,
    type DocumentGetInfoListResponse as DocumentGetInfoListResponse,
    type DocumentGetPageInfoResponse as DocumentGetPageInfoResponse,
    DocumentGetInfoListResponsesGetDocumentInfoListCursor as DocumentGetInfoListResponsesGetDocumentInfoListCursor,
    type DocumentUpdateParams as DocumentUpdateParams,
    type DocumentDeleteParams as DocumentDeleteParams,
    type DocumentAddParams as DocumentAddParams,
    type DocumentGetInfoParams as DocumentGetInfoParams,
    type DocumentGetInfoListParams as DocumentGetInfoListParams,
    type DocumentGetPageInfoParams as DocumentGetPageInfoParams,
  };

  export {
    Queries as Queries,
    type QueryTopDocumentsResponse as QueryTopDocumentsResponse,
    type QueryTopPagesResponse as QueryTopPagesResponse,
    type QueryTopSnippetsResponse as QueryTopSnippetsResponse,
    type QueryTopDocumentsParams as QueryTopDocumentsParams,
    type QueryTopPagesParams as QueryTopPagesParams,
    type QueryTopSnippetsParams as QueryTopSnippetsParams,
  };

  export {
    Models as Models,
    type ModelRerankResponse as ModelRerankResponse,
    type ModelRerankParams as ModelRerankParams,
  };
}

export { toFile, fileFromPath } from './uploads';
export {
  ZeroEntropyError,
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  UnprocessableEntityError,
} from './error';

export default ZeroEntropy;

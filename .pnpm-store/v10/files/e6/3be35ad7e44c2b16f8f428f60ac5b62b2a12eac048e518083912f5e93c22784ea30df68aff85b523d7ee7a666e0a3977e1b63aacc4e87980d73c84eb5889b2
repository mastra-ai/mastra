/// <reference types="node" />
import { AuthClient, GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import { CredentialBody } from 'google-auth-library';
import * as r from 'teeny-request';
import { Duplex, DuplexOptions, Readable, Writable } from 'stream';
import { Interceptor } from './service-object';
export type ResponseBody = any;
export interface DuplexifyOptions extends DuplexOptions {
    autoDestroy?: boolean;
    end?: boolean;
}
export interface Duplexify extends Duplex {
    readonly destroyed: boolean;
    setWritable(writable: Writable | false | null): void;
    setReadable(readable: Readable | false | null): void;
}
export interface DuplexifyConstructor {
    obj(writable?: Writable | false | null, readable?: Readable | false | null, options?: DuplexifyOptions): Duplexify;
    new (writable?: Writable | false | null, readable?: Readable | false | null, options?: DuplexifyOptions): Duplexify;
    (writable?: Writable | false | null, readable?: Readable | false | null, options?: DuplexifyOptions): Duplexify;
}
export interface ParsedHttpRespMessage {
    resp: r.Response;
    err?: ApiError;
}
export interface MakeAuthenticatedRequest {
    (reqOpts: DecorateRequestOptions): Duplexify;
    (reqOpts: DecorateRequestOptions, options?: MakeAuthenticatedRequestOptions): void | Abortable;
    (reqOpts: DecorateRequestOptions, callback?: BodyResponseCallback): void | Abortable;
    (reqOpts: DecorateRequestOptions, optionsOrCallback?: MakeAuthenticatedRequestOptions | BodyResponseCallback): void | Abortable | Duplexify;
    getCredentials: (callback: (err?: Error | null, credentials?: CredentialBody) => void) => void;
    authClient: GoogleAuth<AuthClient>;
}
export interface Abortable {
    abort(): void;
}
export type AbortableDuplex = Duplexify & Abortable;
export interface PackageJson {
    name: string;
    version: string;
}
export interface MakeAuthenticatedRequestFactoryConfig extends Omit<GoogleAuthOptions, 'authClient'> {
    /**
     * Automatically retry requests if the response is related to rate limits or
     * certain intermittent server errors. We will exponentially backoff
     * subsequent requests by default. (default: true)
     */
    autoRetry?: boolean;
    /**
     * If true, just return the provided request options. Default: false.
     */
    customEndpoint?: boolean;
    /**
     * If true, will authenticate when using a custom endpoint. Default: false.
     */
    useAuthWithCustomEndpoint?: boolean;
    /**
     * Account email address, required for PEM/P12 usage.
     */
    email?: string;
    /**
     * Maximum number of automatic retries attempted before returning the error.
     * (default: 3)
     */
    maxRetries?: number;
    stream?: Duplexify;
    /**
     * A pre-instantiated `AuthClient` or `GoogleAuth` client that should be used.
     * A new will be created if this is not set.
     */
    authClient?: AuthClient | GoogleAuth;
    /**
     * Determines if a projectId is required for authenticated requests. Defaults to `true`.
     */
    projectIdRequired?: boolean;
}
export interface MakeAuthenticatedRequestOptions {
    onAuthenticated: OnAuthenticatedCallback;
}
export interface OnAuthenticatedCallback {
    (err: Error | null, reqOpts?: DecorateRequestOptions): void;
}
export interface GoogleErrorBody {
    code: number;
    errors?: GoogleInnerError[];
    response: r.Response;
    message?: string;
}
export interface GoogleInnerError {
    reason?: string;
    message?: string;
}
export interface MakeWritableStreamOptions {
    /**
     * A connection instance used to get a token with and send the request
     * through.
     */
    connection?: {};
    /**
     * Metadata to send at the head of the request.
     */
    metadata?: {
        contentType?: string;
    };
    /**
     * Request object, in the format of a standard Node.js http.request() object.
     */
    request?: r.Options;
    makeAuthenticatedRequest(reqOpts: r.OptionsWithUri, fnobj: {
        onAuthenticated(err: Error | null, authenticatedReqOpts?: r.Options): void;
    }): void;
}
export interface DecorateRequestOptions extends r.CoreOptions {
    autoPaginate?: boolean;
    autoPaginateVal?: boolean;
    objectMode?: boolean;
    maxRetries?: number;
    uri: string;
    interceptors_?: Interceptor[];
    shouldReturnStream?: boolean;
    projectId?: string;
}
export interface ParsedHttpResponseBody {
    body: ResponseBody;
    err?: Error;
}
/**
 * Custom error type for API errors.
 *
 * @param {object} errorBody - Error object.
 */
export declare class ApiError extends Error {
    code?: number;
    errors?: GoogleInnerError[];
    response?: r.Response;
    constructor(errorMessage: string);
    constructor(errorBody: GoogleErrorBody);
    /**
     * Pieces together an error message by combining all unique error messages
     * returned from a single GoogleError
     *
     * @private
     *
     * @param {GoogleErrorBody} err The original error.
     * @param {GoogleInnerError[]} [errors] Inner errors, if any.
     * @returns {string}
     */
    static createMultiErrorMessage(err: GoogleErrorBody, errors?: GoogleInnerError[]): string;
}
/**
 * Custom error type for partial errors returned from the API.
 *
 * @param {object} b - Error object.
 */
export declare class PartialFailureError extends Error {
    errors?: GoogleInnerError[];
    response?: r.Response;
    constructor(b: GoogleErrorBody);
}
export interface BodyResponseCallback {
    (err: Error | ApiError | null, body?: ResponseBody, res?: r.Response): void;
}
export interface RetryOptions {
    retryDelayMultiplier?: number;
    totalTimeout?: number;
    maxRetryDelay?: number;
    autoRetry?: boolean;
    maxRetries?: number;
    retryableErrorFn?: (err: ApiError) => boolean;
}
export interface MakeRequestConfig {
    /**
     * Automatically retry requests if the response is related to rate limits or
     * certain intermittent server errors. We will exponentially backoff
     * subsequent requests by default. (default: true)
     */
    autoRetry?: boolean;
    /**
     * Maximum number of automatic retries attempted before returning the error.
     * (default: 3)
     */
    maxRetries?: number;
    retries?: number;
    retryOptions?: RetryOptions;
    stream?: Duplexify;
    shouldRetryFn?: (response?: r.Response) => boolean;
}
export declare class Util {
    ApiError: typeof ApiError;
    PartialFailureError: typeof PartialFailureError;
    /**
     * No op.
     *
     * @example
     * function doSomething(callback) {
     *   callback = callback || noop;
     * }
     */
    noop(): void;
    /**
     * Uniformly process an API response.
     *
     * @param {*} err - Error value.
     * @param {*} resp - Response value.
     * @param {*} body - Body value.
     * @param {function} callback - The callback function.
     */
    handleResp(err: Error | null, resp?: r.Response | null, body?: ResponseBody, callback?: BodyResponseCallback): void;
    /**
     * Sniff an incoming HTTP response message for errors.
     *
     * @param {object} httpRespMessage - An incoming HTTP response message from `request`.
     * @return {object} parsedHttpRespMessage - The parsed response.
     * @param {?error} parsedHttpRespMessage.err - An error detected.
     * @param {object} parsedHttpRespMessage.resp - The original response object.
     */
    parseHttpRespMessage(httpRespMessage: r.Response): ParsedHttpRespMessage;
    /**
     * Parse the response body from an HTTP request.
     *
     * @param {object} body - The response body.
     * @return {object} parsedHttpRespMessage - The parsed response.
     * @param {?error} parsedHttpRespMessage.err - An error detected.
     * @param {object} parsedHttpRespMessage.body - The original body value provided
     *     will try to be JSON.parse'd. If it's successful, the parsed value will
     * be returned here, otherwise the original value and an error will be returned.
     */
    parseHttpRespBody(body: ResponseBody): ParsedHttpResponseBody;
    /**
     * Take a Duplexify stream, fetch an authenticated connection header, and
     * create an outgoing writable stream.
     *
     * @param {Duplexify} dup - Duplexify stream.
     * @param {object} options - Configuration object.
     * @param {module:common/connection} options.connection - A connection instance used to get a token with and send the request through.
     * @param {object} options.metadata - Metadata to send at the head of the request.
     * @param {object} options.request - Request object, in the format of a standard Node.js http.request() object.
     * @param {string=} options.request.method - Default: "POST".
     * @param {string=} options.request.qs.uploadType - Default: "multipart".
     * @param {string=} options.streamContentType - Default: "application/octet-stream".
     * @param {function} onComplete - Callback, executed after the writable Request stream has completed.
     */
    makeWritableStream(dup: Duplexify, options: MakeWritableStreamOptions, onComplete?: Function): void;
    /**
     * Returns true if the API request should be retried, given the error that was
     * given the first time the request was attempted. This is used for rate limit
     * related errors as well as intermittent server errors.
     *
     * @param {error} err - The API error to check if it is appropriate to retry.
     * @return {boolean} True if the API request should be retried, false otherwise.
     */
    shouldRetryRequest(err?: ApiError): boolean;
    /**
     * Get a function for making authenticated requests.
     *
     * @param {object} config - Configuration object.
     * @param {boolean=} config.autoRetry - Automatically retry requests if the
     *     response is related to rate limits or certain intermittent server
     * errors. We will exponentially backoff subsequent requests by default.
     * (default: true)
     * @param {object=} config.credentials - Credentials object.
     * @param {boolean=} config.customEndpoint - If true, just return the provided request options. Default: false.
     * @param {boolean=} config.useAuthWithCustomEndpoint - If true, will authenticate when using a custom endpoint. Default: false.
     * @param {string=} config.email - Account email address, required for PEM/P12 usage.
     * @param {number=} config.maxRetries - Maximum number of automatic retries attempted before returning the error. (default: 3)
     * @param {string=} config.keyFile - Path to a .json, .pem, or .p12 keyfile.
     * @param {array} config.scopes - Array of scopes required for the API.
     */
    makeAuthenticatedRequestFactory(config: MakeAuthenticatedRequestFactoryConfig): MakeAuthenticatedRequest;
    /**
     * Make a request through the `retryRequest` module with built-in error
     * handling and exponential back off.
     *
     * @param {object} reqOpts - Request options in the format `request` expects.
     * @param {object=} config - Configuration object.
     * @param {boolean=} config.autoRetry - Automatically retry requests if the
     *     response is related to rate limits or certain intermittent server
     * errors. We will exponentially backoff subsequent requests by default.
     * (default: true)
     * @param {number=} config.maxRetries - Maximum number of automatic retries
     *     attempted before returning the error. (default: 3)
     * @param {object=} config.request - HTTP module for request calls.
     * @param {function} callback - The callback function.
     */
    makeRequest(reqOpts: DecorateRequestOptions, config: MakeRequestConfig, callback: BodyResponseCallback): void | Abortable;
    /**
     * Decorate the options about to be made in a request.
     *
     * @param {object} reqOpts - The options to be passed to `request`.
     * @param {string} projectId - The project ID.
     * @return {object} reqOpts - The decorated reqOpts.
     */
    decorateRequest(reqOpts: DecorateRequestOptions, projectId: string): DecorateRequestOptions;
    isCustomType(unknown: any, module: string): boolean;
    /**
     * Create a properly-formatted User-Agent string from a package.json file.
     *
     * @param {object} packageJson - A module's package.json file.
     * @return {string} userAgent - The formatted User-Agent string.
     */
    getUserAgentFromPackageJson(packageJson: PackageJson): string;
    /**
     * Given two parameters, figure out if this is either:
     *  - Just a callback function
     *  - An options object, and then a callback function
     * @param optionsOrCallback An options object or callback.
     * @param cb A potentially undefined callback.
     */
    maybeOptionsOrCallback<T = {}, C = (err?: Error) => void>(optionsOrCallback?: T | C, cb?: C): [T, C];
}
declare const util: Util;
export { util };

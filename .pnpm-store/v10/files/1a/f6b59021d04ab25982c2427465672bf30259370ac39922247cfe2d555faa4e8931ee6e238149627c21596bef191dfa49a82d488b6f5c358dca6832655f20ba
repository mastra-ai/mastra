/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { FirebaseApp } from '../app/firebase-app';
import http = require('http');
import http2 = require('http2');
import { EventEmitter } from 'events';
/** Http method type definition. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
/** API callback function type definition. */
export type ApiCallbackFunction = (data: object) => void;
/**
 * Base configuration for constructing a new request.
 */
export interface BaseRequestConfig {
    method: HttpMethod;
    /** Target URL of the request. Should be a well-formed URL including protocol, hostname, port and path. */
    url: string;
    headers?: {
        [key: string]: string;
    };
    data?: string | object | Buffer | null;
    /** Connect and read timeout (in milliseconds) for the outgoing request. */
    timeout?: number;
}
/**
 * Configuration for constructing a new HTTP request.
 */
export interface HttpRequestConfig extends BaseRequestConfig {
    httpAgent?: http.Agent;
}
/**
 * Configuration for constructing a new HTTP/2 request.
 */
export interface Http2RequestConfig extends BaseRequestConfig {
    http2SessionHandler: Http2SessionHandler;
}
type RequestConfig = HttpRequestConfig | Http2RequestConfig;
/**
 * Represents an HTTP or HTTP/2 response received from a remote server.
 */
export interface RequestResponse {
    readonly status: number;
    readonly headers: any;
    /** Response data as a raw string. */
    readonly text?: string;
    /** Response data as a parsed JSON object. */
    readonly data?: any;
    /** For multipart responses, the payloads of individual parts. */
    readonly multipart?: Buffer[];
    /**
     * Indicates if the response content is JSON-formatted or not. If true, data field can be used
     * to retrieve the content as a parsed JSON object.
     */
    isJson(): boolean;
}
interface BaseLowLevelResponse {
    status: number;
    data?: string;
    multipart?: Buffer[];
}
interface LowLevelHttpResponse extends BaseLowLevelResponse {
    headers: http.IncomingHttpHeaders;
    request: http.ClientRequest | null;
    config: HttpRequestConfig;
}
type IncomingHttp2Headers = http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;
interface LowLevelHttp2Response extends BaseLowLevelResponse {
    headers: IncomingHttp2Headers;
    request: http2.ClientHttp2Stream | null;
    config: Http2RequestConfig;
}
type LowLevelResponse = LowLevelHttpResponse | LowLevelHttp2Response;
interface BaseLowLevelError extends Error {
    code?: string;
}
interface LowLevelHttpError extends BaseLowLevelError {
    config: HttpRequestConfig;
    request?: http.ClientRequest;
    response?: LowLevelHttpResponse;
}
interface LowLevelHttp2Error extends BaseLowLevelError {
    config: Http2RequestConfig;
    request?: http2.ClientHttp2Stream;
    response?: LowLevelHttp2Response;
}
type LowLevelError = LowLevelHttpError | LowLevelHttp2Error;
export declare class RequestResponseError extends Error {
    readonly response: RequestResponse;
    constructor(response: RequestResponse);
}
/**
 * Specifies how failing HTTP and HTTP/2 requests should be retried.
 */
export interface RetryConfig {
    /** Maximum number of times to retry a given request. */
    maxRetries: number;
    /** Response status codes that should be retried. */
    statusCodes?: number[];
    /** Low-level I/O error codes that should be retried. */
    ioErrorCodes?: string[];
    /**
     * The multiplier for exponential back off. The retry delay is calculated in seconds using the formula
     * `(2^n) * backOffFactor`, where n is the number of retries performed so far. When the `backOffFactor` is set
     * to 0, retries are not delayed. When the `backOffFactor` is 1, retry duration is doubled each iteration.
     */
    backOffFactor?: number;
    /** Maximum duration to wait before initiating a retry. */
    maxDelayInMillis: number;
}
/**
 * Default retry configuration for HTTP and HTTP/2 requests. Retries up to 4 times on connection reset and timeout
 * errors as well as 503 errors. Exposed as a function to ensure that every `RequestClient` gets its own `RetryConfig`
 * instance.
 */
export declare function defaultRetryConfig(): RetryConfig;
export declare class RequestClient {
    protected readonly retry: RetryConfig;
    constructor(retry?: RetryConfig | null);
    protected createRequestResponse(resp: LowLevelResponse): RequestResponse;
    protected waitForRetry(delayMillis: number): Promise<void>;
    /**
     * Checks if a failed request is eligible for a retry, and if so returns the duration to wait before initiating
     * the retry.
     *
     * @param retryAttempts - Number of retries completed up to now.
     * @param err - The last encountered error.
     * @returns A 2-tuple where the 1st element is the duration to wait before another retry, and the
     *     2nd element is a boolean indicating whether the request is eligible for a retry or not.
     */
    protected getRetryDelayMillis(retryAttempts: number, err: LowLevelError): [number, boolean];
    protected isRetryEligible(retryAttempts: number, err: LowLevelError): boolean;
    /**???
     * Parses the Retry-After header as a milliseconds value. Return value is negative if the Retry-After header
     * contains an expired timestamp or otherwise malformed.
     */
    protected parseRetryAfterIntoMillis(retryAfter: string): number;
    protected backOffDelayMillis(retryAttempts: number): number;
}
export declare class HttpClient extends RequestClient {
    constructor(retry?: RetryConfig | null);
    /**
     * Sends an HTTP request to a remote server. If the server responds with a successful response (2xx), the returned
     * promise resolves with an `RequestResponse`. If the server responds with an error (3xx, 4xx, 5xx), the promise
     * rejects with an `RequestResponseError`. In case of all other errors, the promise rejects with a `FirebaseAppError`.
     * If a request fails due to a low-level network error, the client transparently retries the request once before
     * rejecting the promise.
     *
     * If the request data is specified as an object, it will be serialized into a JSON string. The application/json
     * content-type header will also be automatically set in this case. For all other payload types, the content-type
     * header should be explicitly set by the caller. To send a JSON leaf value (e.g. "foo", 5), parse it into JSON,
     * and pass as a string or a Buffer along with the appropriate content-type header.
     *
     * @param config - HTTP request to be sent.
     * @returns A promise that resolves with the response details.
     */
    send(config: HttpRequestConfig): Promise<RequestResponse>;
    /**
     * Sends an HTTP request. In the event of an error, retries the HTTP request according to the
     * `RetryConfig` set on the `HttpClient`.
     *
     * @param config - HTTP request to be sent.
     * @param retryAttempts - Number of retries performed up to now.
     * @returns A promise that resolves with the response details.
     */
    private sendWithRetry;
}
export declare class Http2Client extends RequestClient {
    constructor(retry?: RetryConfig | null);
    /**
     * Sends an HTTP/2 request to a remote server. If the server responds with a successful response (2xx), the returned
     * promise resolves with an `RequestResponse`. If the server responds with an error (3xx, 4xx, 5xx), the promise
     * rejects with an `RequestResponseError`. In case of all other errors, the promise rejects with a `FirebaseAppError`.
     * If a request fails due to a low-level network error, the client transparently retries the request once before
     * rejecting the promise.
     *
     * If the request data is specified as an object, it will be serialized into a JSON string. The application/json
     * content-type header will also be automatically set in this case. For all other payload types, the content-type
     * header should be explicitly set by the caller. To send a JSON leaf value (e.g. "foo", 5), parse it into JSON,
     * and pass as a string or a Buffer along with the appropriate content-type header.
     *
     * @param config - HTTP/2 request to be sent.
     * @returns A promise that resolves with the response details.
     */
    send(config: Http2RequestConfig): Promise<RequestResponse>;
    /**
     * Sends an HTTP/2 request. In the event of an error, retries the HTTP/2 request according to the
     * `RetryConfig` set on the `Http2Client`.
     *
     * @param config - HTTP/2 request to be sent.
     * @param retryAttempts - Number of retries performed up to now.
     * @returns A promise that resolves with the response details.
     */
    private sendWithRetry;
}
/**
 * Parses a full HTTP or HTTP/2 response message containing both a header and a body.
 *
 * @param response - The HTTP or HTTP/2 response to be parsed.
 * @param config - The request configuration that resulted in the HTTP or HTTP/2 response.
 * @returns An object containing the response's parsed status, headers and the body.
 */
export declare function parseHttpResponse(response: string | Buffer, config: RequestConfig): RequestResponse;
export declare class AuthorizedHttpClient extends HttpClient {
    private readonly app;
    constructor(app: FirebaseApp);
    send(request: HttpRequestConfig): Promise<RequestResponse>;
    protected getToken(): Promise<string>;
}
export declare class AuthorizedHttp2Client extends Http2Client {
    private readonly app;
    constructor(app: FirebaseApp);
    send(request: Http2RequestConfig): Promise<RequestResponse>;
    protected getToken(): Promise<string>;
}
/**
 * Class that defines all the settings for the backend API endpoint.
 *
 * @param endpoint - The Firebase Auth backend endpoint.
 * @param httpMethod - The HTTP method for that endpoint.
 * @constructor
 */
export declare class ApiSettings {
    private endpoint;
    private httpMethod;
    private requestValidator;
    private responseValidator;
    constructor(endpoint: string, httpMethod?: HttpMethod);
    /** @returns The backend API endpoint. */
    getEndpoint(): string;
    /** @returns The request HTTP method. */
    getHttpMethod(): HttpMethod;
    /**
     * @param requestValidator - The request validator.
     * @returns The current API settings instance.
     */
    setRequestValidator(requestValidator: ApiCallbackFunction | null): ApiSettings;
    /** @returns The request validator. */
    getRequestValidator(): ApiCallbackFunction;
    /**
     * @param responseValidator - The response validator.
     * @returns The current API settings instance.
     */
    setResponseValidator(responseValidator: ApiCallbackFunction | null): ApiSettings;
    /** @returns The response validator. */
    getResponseValidator(): ApiCallbackFunction;
}
/**
 * Class used for polling an endpoint with exponential backoff.
 *
 * Example usage:
 * ```
 * const poller = new ExponentialBackoffPoller();
 * poller
 *     .poll(() => {
 *       return myRequestToPoll()
 *           .then((responseData: any) => {
 *             if (!isValid(responseData)) {
 *               // Continue polling.
 *               return null;
 *             }
 *
 *             // Polling complete. Resolve promise with final response data.
 *             return responseData;
 *           });
 *     })
 *     .then((responseData: any) => {
 *       console.log(`Final response: ${responseData}`);
 *     });
 * ```
 */
export declare class ExponentialBackoffPoller<T> extends EventEmitter {
    private readonly initialPollingDelayMillis;
    private readonly maxPollingDelayMillis;
    private readonly masterTimeoutMillis;
    private numTries;
    private completed;
    private masterTimer;
    private repollTimer;
    private pollCallback?;
    private resolve;
    private reject;
    constructor(initialPollingDelayMillis?: number, maxPollingDelayMillis?: number, masterTimeoutMillis?: number);
    /**
     * Poll the provided callback with exponential backoff.
     *
     * @param callback - The callback to be called for each poll. If the
     *     callback resolves to a falsey value, polling will continue. Otherwise, the truthy
     *     resolution will be used to resolve the promise returned by this method.
     * @returns A Promise which resolves to the truthy value returned by the provided
     *     callback when polling is complete.
     */
    poll(callback: () => Promise<T>): Promise<T>;
    private repoll;
    private getPollingDelayMillis;
    private markCompleted;
}
export declare class Http2SessionHandler {
    private http2Session;
    protected promise: Promise<void>;
    protected resolve: () => void;
    protected reject: (_: any) => void;
    constructor(url: string);
    createSession(url: string): http2.ClientHttp2Session;
    invoke(): Promise<void>;
    get session(): http2.ClientHttp2Session;
    get isClosed(): boolean;
    close(): void;
}
export {};

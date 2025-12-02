import { HttpClientInterface, HttpClientResponseInterface, RequestHeaders, RequestOptions, ResponseHeaders } from '../interfaces/http-client.interface';
export declare abstract class HttpClient implements HttpClientInterface {
    readonly baseURL: string;
    readonly options?: RequestInit | undefined;
    readonly MAX_RETRY_ATTEMPTS = 3;
    readonly BACKOFF_MULTIPLIER = 1.5;
    readonly MINIMUM_SLEEP_TIME_IN_MILLISECONDS = 500;
    readonly RETRY_STATUS_CODES: number[];
    constructor(baseURL: string, options?: RequestInit | undefined);
    /** The HTTP client name used for diagnostics */
    getClientName(): string;
    abstract get(path: string, options: RequestOptions): Promise<HttpClientResponseInterface>;
    abstract post<Entity = any>(path: string, entity: Entity, options: RequestOptions): Promise<HttpClientResponseInterface>;
    abstract put<Entity = any>(path: string, entity: Entity, options: RequestOptions): Promise<HttpClientResponseInterface>;
    abstract delete(path: string, options: RequestOptions): Promise<HttpClientResponseInterface>;
    addClientToUserAgent(userAgent: string): string;
    static getResourceURL(baseURL: string, path: string, params?: Record<string, any>): string;
    static getQueryString(queryObj?: Record<string, any>): string | undefined;
    static getContentTypeHeader(entity: any): RequestHeaders | undefined;
    static getBody(entity: any): BodyInit | null | undefined;
    private getSleepTimeInMilliseconds;
    sleep: (retryAttempt: number) => Promise<unknown>;
}
export declare abstract class HttpClientResponse implements HttpClientResponseInterface {
    _statusCode: number;
    _headers: ResponseHeaders;
    constructor(statusCode: number, headers: ResponseHeaders);
    getStatusCode(): number;
    getHeaders(): ResponseHeaders;
    abstract getRawResponse(): unknown;
    abstract toJSON(): any | null;
}
export declare class HttpClientError<T> extends Error {
    readonly name: string;
    readonly message: string;
    readonly response: {
        status: number;
        headers: any;
        data: T;
    };
    constructor({ message, response, }: {
        message: string;
        readonly response: HttpClientError<T>['response'];
    });
}

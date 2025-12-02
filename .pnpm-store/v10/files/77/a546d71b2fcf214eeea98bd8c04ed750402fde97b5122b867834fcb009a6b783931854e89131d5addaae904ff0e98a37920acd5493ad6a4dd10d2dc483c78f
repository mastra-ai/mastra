import { HttpClientInterface, HttpClientResponseInterface, RequestOptions, ResponseHeaders } from '../interfaces/http-client.interface';
import { HttpClient, HttpClientResponse } from './http-client';
interface FetchHttpClientOptions extends RequestInit {
    timeout?: number;
}
export declare class FetchHttpClient extends HttpClient implements HttpClientInterface {
    readonly baseURL: string;
    readonly options?: FetchHttpClientOptions | undefined;
    private readonly _fetchFn;
    constructor(baseURL: string, options?: FetchHttpClientOptions | undefined, fetchFn?: typeof fetch);
    /** @override */
    getClientName(): string;
    get(path: string, options: RequestOptions): Promise<HttpClientResponseInterface>;
    post<Entity = any>(path: string, entity: Entity, options: RequestOptions): Promise<HttpClientResponseInterface>;
    put<Entity = any>(path: string, entity: Entity, options: RequestOptions): Promise<HttpClientResponseInterface>;
    delete(path: string, options: RequestOptions): Promise<HttpClientResponseInterface>;
    private fetchRequest;
    private fetchRequestWithRetry;
    private shouldRetryRequest;
}
export declare class FetchHttpClientResponse extends HttpClientResponse implements HttpClientResponseInterface {
    _res: Response;
    constructor(res: Response);
    getRawResponse(): Response;
    toJSON(): Promise<any> | null;
    static _transformHeadersToObject(headers: Headers): ResponseHeaders;
}
export {};

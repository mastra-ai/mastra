import { HttpClient, HttpClientResponse } from './http-client';
import { HttpClientInterface, HttpClientResponseInterface, RequestOptions } from '../interfaces/http-client.interface';
import * as http_ from 'node:http';
export declare class NodeHttpClient extends HttpClient implements HttpClientInterface {
    readonly baseURL: string;
    readonly options?: RequestInit | undefined;
    private httpAgent;
    private httpsAgent;
    constructor(baseURL: string, options?: RequestInit | undefined);
    getClientName(): string;
    static getBody(entity: unknown): string | null;
    get(path: string, options: RequestOptions): Promise<HttpClientResponseInterface>;
    post<Entity = any>(path: string, entity: Entity, options: RequestOptions): Promise<HttpClientResponseInterface>;
    put<Entity = any>(path: string, entity: Entity, options: RequestOptions): Promise<HttpClientResponseInterface>;
    delete(path: string, options: RequestOptions): Promise<HttpClientResponseInterface>;
    private nodeRequest;
    private nodeRequestWithRetry;
    private shouldRetryRequest;
}
export declare class NodeHttpClientResponse extends HttpClientResponse implements HttpClientResponseInterface {
    _res: http_.IncomingMessage;
    constructor(res: http_.IncomingMessage);
    getRawResponse(): http_.IncomingMessage;
    toJSON(): Promise<any> | any;
}

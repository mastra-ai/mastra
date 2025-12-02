export type RequestHeaders = Record<string, string | number | string[]>;
export type RequestOptions = {
    params?: Record<string, any>;
    headers?: RequestHeaders;
};
export type ResponseHeaderValue = string | string[];
export type ResponseHeaders = Record<string, ResponseHeaderValue>;
export interface HttpClientInterface {
    getClientName: () => string;
    get(path: string, options: RequestOptions): any;
    post<Entity = any>(path: string, entity: Entity, options: RequestOptions): any;
    put<Entity = any>(path: string, entity: Entity, options: RequestOptions): any;
    delete(path: string, options: RequestOptions): any;
}
export interface HttpClientResponseInterface {
    getStatusCode: () => number;
    getHeaders: () => ResponseHeaders;
    getRawResponse: () => unknown;
    toJSON: () => Promise<any> | null;
}

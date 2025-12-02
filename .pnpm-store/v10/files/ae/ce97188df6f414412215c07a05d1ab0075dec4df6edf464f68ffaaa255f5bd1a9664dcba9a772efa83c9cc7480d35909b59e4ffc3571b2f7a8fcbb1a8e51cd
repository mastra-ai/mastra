/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { CppConnection } from './binding';
import * as events from 'events';
/**
 * @internal
 */
export declare enum HttpServiceType {
    Management = "MGMT",
    Views = "VIEW",
    Query = "QUERY",
    Search = "SEARCH",
    Analytics = "ANALYTICS",
    Eventing = "EVENTING"
}
/**
 * @internal
 */
export declare enum HttpMethod {
    Get = "GET",
    Post = "POST",
    Put = "PUT",
    Delete = "DELETE"
}
/**
 * @internal
 */
export interface HttpRequestOptions {
    type: HttpServiceType;
    method: HttpMethod;
    path: string;
    contentType?: string;
    body?: string | Buffer;
    timeout: number;
}
/**
 * @internal
 */
export interface HttpResponse {
    requestOptions: HttpRequestOptions;
    statusCode: number;
    headers: {
        [key: string]: string;
    };
    body: Buffer;
}
/**
 * @internal
 */
export declare class HttpExecutor {
    private _conn;
    /**
     * @internal
     */
    constructor(conn: CppConnection);
    /**
     * @internal
     */
    streamRequest(options: HttpRequestOptions): events.EventEmitter;
    request(options: HttpRequestOptions): Promise<HttpResponse>;
}

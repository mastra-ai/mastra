/// <reference types="node" />
import type * as http from 'http';
import type * as https from 'https';
import { get, IncomingMessage, request } from 'http';
import * as url from 'url';
export declare type IgnoreMatcher = string | RegExp | ((url: string) => boolean);
export declare type HttpCallback = (res: IncomingMessage) => void;
export declare type RequestFunction = typeof request;
export declare type GetFunction = typeof get;
export declare type HttpCallbackOptional = HttpCallback | undefined;
export declare type RequestSignature = [http.RequestOptions, HttpCallbackOptional] & HttpCallback;
export declare type HttpRequestArgs = Array<HttpCallbackOptional | RequestSignature>;
export declare type ParsedRequestOptions = (http.RequestOptions & Partial<url.UrlWithParsedQuery>) | http.RequestOptions;
export declare type Http = typeof http;
export declare type Https = typeof https;
export declare type Func<T> = (...args: any[]) => T;
export interface Err extends Error {
    errno?: number;
    code?: string;
    path?: string;
    syscall?: string;
    stack?: string;
}
/**
 * Tracks whether this instrumentation emits old experimental,
 * new stable, or both semantic conventions.
 *
 * Enum values chosen such that the enum may be used as a bitmask.
 */
export declare const enum SemconvStability {
    /** Emit only stable semantic conventions */
    STABLE = 1,
    /** Emit only old semantic conventions*/
    OLD = 2,
    /** Emit both stable and old semantic conventions*/
    DUPLICATE = 3
}
//# sourceMappingURL=internal-types.d.ts.map
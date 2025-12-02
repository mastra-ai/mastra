/// <reference types="node" />
import { AbortSignal } from "./abort";
import { Headers, RawHeaders } from "./headers";
export declare type Method = "ACL" | "BIND" | "CHECKOUT" | "CONNECT" | "COPY" | "DELETE" | "GET" | "HEAD" | "LINK" | "LOCK" | "M-SEARCH" | "MERGE" | "MKACTIVITY" | "MKCALENDAR" | "MKCOL" | "MOVE" | "NOTIFY" | "OPTIONS" | "PATCH" | "POST" | "PROPFIND" | "PROPPATCH" | "PURGE" | "PUT" | "REBIND" | "REPORT" | "SEARCH" | "SUBSCRIBE" | "TRACE" | "UNBIND" | "UNLINK" | "UNLOCK" | "UNSUBSCRIBE";
export declare type StorageBodyTypes = Buffer | NodeJS.ReadableStream;
export declare type BodyTypes = StorageBodyTypes | string;
export declare type ModeTypes = "cors" | "no-cors" | "same-origin";
export declare type CredentialsTypes = "omit" | "same-origin" | "include";
export declare type CacheTypes = "default" | "no-store" | "reload" | "no-cache" | "force-cache" | "only-if-cached";
export declare type RedirectTypes = "follow" | "error" | "manual";
export declare type SpecialReferrerTypes = "no-referrer" | "client";
export declare type ReferrerTypes = SpecialReferrerTypes | string;
export declare type ReferrerPolicyTypes = "no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "unsafe-url";
export declare type ResponseTypes = "basic" | "cors" | "error";
export declare type HttpProtocols = "http1" | "http2";
export declare type HttpVersion = 1 | 2;
export interface IBody {
    readonly bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    formData(): Promise<any>;
    json(): Promise<any>;
    text(): Promise<string>;
    readable(): Promise<NodeJS.ReadableStream>;
}
export interface RequestInitWithoutBody {
    method: Method;
    headers: RawHeaders | Headers;
    mode: ModeTypes;
    credentials: CredentialsTypes;
    cache: CacheTypes;
    redirect: RedirectTypes;
    referrer: ReferrerTypes;
    referrerPolicy: ReferrerPolicyTypes;
    integrity: string;
    allowForbiddenHeaders: boolean;
}
export interface RequestInit extends RequestInitWithoutBody {
    body: BodyTypes | IBody;
    json: any;
}
export interface RequestInitWithUrl extends RequestInit {
    url: string;
}
export declare type OnTrailers = (headers: Headers) => void;
export interface FetchInit extends RequestInit {
    signal: AbortSignal;
    timeout: number;
    onTrailers: OnTrailers;
}
export interface ResponseInit {
    status: number;
    statusText: string;
    headers: RawHeaders | Headers;
    allowForbiddenHeaders: boolean;
}
export declare class FetchError extends Error {
    constructor(message: string);
}
export declare class AbortError extends Error {
    constructor(message: string);
}
export declare class TimeoutError extends Error {
    constructor(message: string);
}
export declare class RetryError extends Error {
    constructor(message: string);
}
export declare type DecodeFunction = (stream: NodeJS.ReadableStream) => NodeJS.ReadableStream;
export interface Decoder {
    name: string;
    decode: DecodeFunction;
}
export declare type PerOrigin<T> = (origin: string) => T;
export declare function getByOrigin<T>(val: T | PerOrigin<T>, origin: string): T;
export declare function parsePerOrigin<T>(val: T | PerOrigin<T> | undefined, _default: T): T | PerOrigin<T>;
export interface Http1Options {
    keepAlive: boolean | PerOrigin<boolean>;
    keepAliveMsecs: number | PerOrigin<number>;
    maxSockets: number | PerOrigin<number>;
    maxFreeSockets: number | PerOrigin<number>;
    timeout: void | number | PerOrigin<void | number>;
}

/// <reference types="node" />
import { SecureClientSessionOptions } from "http2";
import { PushHandler } from "./context-http2";
import { CookieJar } from "./cookie-jar";
import { Decoder, FetchInit, Http1Options, HttpProtocols, PerOrigin } from "./core";
import { Request } from "./request";
import { Response } from "./response";
export interface ContextOptions {
    userAgent: string | PerOrigin<string>;
    overwriteUserAgent: boolean | PerOrigin<boolean>;
    accept: string | PerOrigin<string>;
    cookieJar: CookieJar;
    decoders: ReadonlyArray<Decoder> | PerOrigin<ReadonlyArray<Decoder>>;
    session: SecureClientSessionOptions | PerOrigin<SecureClientSessionOptions>;
    httpProtocol: HttpProtocols | PerOrigin<HttpProtocols>;
    httpsProtocols: ReadonlyArray<HttpProtocols> | PerOrigin<ReadonlyArray<HttpProtocols>>;
    http1: Partial<Http1Options> | PerOrigin<Partial<Http1Options>>;
}
export declare class Context {
    private h1Context;
    private h2Context;
    private _userAgent;
    private _overwriteUserAgent;
    private _accept;
    private _cookieJar;
    private _decoders;
    private _sessionOptions;
    private _httpProtocol;
    private _httpsProtocols;
    private _http1Options;
    private _httpsFunnel;
    private _http1Funnel;
    private _http2Funnel;
    private _originCache;
    constructor(opts?: Partial<ContextOptions>);
    setup(opts?: Partial<ContextOptions>): void;
    userAgent(origin: string): string;
    decoders(origin: string): readonly Decoder[];
    sessionOptions(origin: string): SecureClientSessionOptions;
    onPush(pushHandler?: PushHandler): void;
    fetch(input: string | Request, init?: Partial<FetchInit>): Promise<Response>;
    disconnect(url: string): Promise<void>;
    disconnectAll(): Promise<void>;
    private retryFetch;
    private retryableFetch;
    private connectSequenciallyTLS;
    private getHttp1;
    private parseInput;
}

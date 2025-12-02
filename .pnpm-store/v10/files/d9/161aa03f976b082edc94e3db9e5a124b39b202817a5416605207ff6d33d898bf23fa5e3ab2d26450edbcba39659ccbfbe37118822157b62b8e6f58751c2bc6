/// <reference types="node" />
import { BodyTypes, Decoder, HttpVersion, ResponseInit, ResponseTypes } from "./core";
import { AbortSignal } from "./abort";
import { Headers } from "./headers";
import { Body } from "./body";
import { IncomingHttpHeaders } from "./types";
interface Extra {
    httpVersion: HttpVersion;
    redirected: boolean;
    integrity: string;
    signal: AbortSignal;
    type: ResponseTypes;
    url: string;
}
export declare class Response extends Body {
    readonly headers: Headers;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly type: ResponseTypes;
    readonly url: string;
    readonly useFinalURL: boolean;
    readonly httpVersion: HttpVersion;
    constructor(body?: BodyTypes | Body | null, init?: Partial<ResponseInit>, extra?: Partial<Extra>);
    static error(): Response;
    static redirect(url: string, status?: number): Response;
    clone(): Response;
}
export declare class StreamResponse extends Response {
    constructor(contentDecoders: ReadonlyArray<Decoder>, url: string, stream: NodeJS.ReadableStream, headers: IncomingHttpHeaders, redirected: boolean, init: Partial<ResponseInit>, signal: AbortSignal | undefined, httpVersion: HttpVersion, allowForbiddenHeaders: boolean, integrity?: string);
}
export {};

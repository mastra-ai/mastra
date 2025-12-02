import { Readable } from "node:stream";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
declare const kHeaders: unique symbol;
declare const kHeadersDistinct: unique symbol;
declare const kHeadersCount: unique symbol;
declare const kTrailers: unique symbol;
declare const kTrailersDistinct: unique symbol;
declare const kTrailersCount: unique symbol;
/**
 * This is an implementation of IncomingMessage from Node.js intended to run in
 * a WinterTC runtime. The 'Readable' interface of this class is wired to a 'Request'
 * object's 'body'.
 *
 * This instance can be used in normal ways, but it does not give access to the
 * underlying socket (because there isn't one. req.socket will always return null).
 *
 * Some code in this class is transplanted/adapted from node/lib/_http_incoming.js
 */
export declare class FetchIncomingMessage extends Readable implements IncomingMessage {
    _readableState: {
        readingMore: boolean;
    };
    get socket(): any;
    set socket(_val: any);
    httpVersionMajor: number;
    httpVersionMinor: number;
    httpVersion: string;
    complete: boolean;
    [kHeaders]: IncomingHttpHeaders | null;
    [kHeadersDistinct]: Record<string, string[]> | null;
    [kHeadersCount]: number;
    rawHeaders: string[];
    [kTrailers]: NodeJS.Dict<string> | null;
    [kTrailersDistinct]: Record<string, string[]> | null;
    [kTrailersCount]: number;
    rawTrailers: string[];
    joinDuplicateHeaders: boolean;
    aborted: boolean;
    upgrade: boolean;
    url: string;
    method: string;
    _consuming: boolean;
    _dumped: boolean;
    _stream: ReadableStream | null;
    constructor();
    get connection(): any;
    set connection(_socket: any);
    get headers(): IncomingHttpHeaders;
    set headers(val: IncomingHttpHeaders);
    get headersDistinct(): Record<string, string[]>;
    set headersDistinct(val: Record<string, string[]>);
    get trailers(): NodeJS.Dict<string>;
    set trailers(val: NodeJS.Dict<string>);
    get trailersDistinct(): Record<string, string[]>;
    set trailersDistinct(val: Record<string, string[]>);
    setTimeout(msecs: number, callback?: () => void): this;
    _read(n: number): Promise<void>;
    _destroy(err: Error | null, cb: (err?: Error | null) => void): void;
    _addHeaderLines(headers: string[], n: number): void;
    _addHeaderLine(field: string, value: string, dest: IncomingHttpHeaders): void;
    _addHeaderLineDistinct(field: string, value: string, dest: Record<string, string[]>): void;
    _dump(): void;
}
export {};
//# sourceMappingURL=http-incoming.d.ts.map
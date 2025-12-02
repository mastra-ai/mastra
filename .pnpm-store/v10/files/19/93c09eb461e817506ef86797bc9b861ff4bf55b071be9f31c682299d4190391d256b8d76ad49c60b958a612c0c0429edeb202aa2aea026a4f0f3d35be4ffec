import { Buffer } from "node:buffer";
import { Writable } from "node:stream";
import type { OutgoingHttpHeaders, OutgoingMessage, IncomingMessage } from "node:http";
import { kNeedDrain, kOutHeaders } from "./internal-http.js";
declare const kCorked: unique symbol;
declare const kChunkedBuffer: unique symbol;
declare const kChunkedLength: unique symbol;
declare const kUniqueHeaders: unique symbol;
declare const kBytesWritten: unique symbol;
declare const kErrored: unique symbol;
declare const kHighWaterMark: unique symbol;
declare const kRejectNonStandardBodyWrites: unique symbol;
type WriteCallback = (err?: Error) => void;
type OutputData = {
    data: string | Buffer | Uint8Array | null;
    encoding?: BufferEncoding | null;
    callback?: WriteCallback | null;
};
type WrittenDataBufferEntry = OutputData & {
    length: number;
    written: boolean;
};
type WrittenDataBufferConstructorArgs = {
    onWrite?: (index: number, entry: WrittenDataBufferEntry) => void;
};
/**
 * An in-memory buffer that stores the chunks that have been streamed to an
 * OutgoingMessage instance.
 */
export declare class WrittenDataBuffer {
    [kCorked]: number;
    [kHighWaterMark]: number;
    entries: WrittenDataBufferEntry[];
    onWrite?: (index: number, entry: WrittenDataBufferEntry) => void;
    constructor(params?: WrittenDataBufferConstructorArgs);
    write(data: string | Uint8Array, encoding?: BufferEncoding | null, callback?: WriteCallback | null): boolean;
    cork(): void;
    uncork(): void;
    _flush(): void;
    get writableLength(): number;
    get writableHighWaterMark(): number;
    get writableCorked(): number;
}
export type HeadersSentEvent = {
    statusCode: number;
    statusMessage: string;
    headers: [header: string, value: string][];
};
export type DataWrittenEvent = {
    index: number;
    entry: WrittenDataBufferEntry;
};
export type OutgoingMessageOptions = {
    highWaterMark?: number | undefined;
    rejectNonStandardBodyWrites?: boolean | undefined;
};
/**
 * This is an implementation of OutgoingMessage from Node.js intended to run in
 * a WinterTC runtime. The 'Writable' interface of this class is wired to an in-memory
 * buffer.
 *
 * This instance can be used in normal ways, but it does not give access to the
 * underlying socket (because there isn't one. req.socket will always return null).
 *
 * Some code in this class is transplanted/adapted from node/lib/_http_outgoing.js
 */
export declare class FetchOutgoingMessage extends Writable implements OutgoingMessage {
    readonly req: IncomingMessage;
    outputData: OutputData[];
    outputSize: number;
    writtenHeaderBytes: number;
    _last: boolean;
    chunkedEncoding: boolean;
    shouldKeepAlive: boolean;
    maxRequestsOnConnectionReached: boolean;
    _defaultKeepAlive: boolean;
    useChunkedEncodingByDefault: boolean;
    sendDate: boolean;
    _removedConnection: boolean;
    _removedContLen: boolean;
    _removedTE: boolean;
    strictContentLength: boolean;
    [kBytesWritten]: number;
    _contentLength: number | null;
    _hasBody: boolean;
    _trailer: string;
    [kNeedDrain]: boolean;
    finished: boolean;
    _headerSent: boolean;
    [kCorked]: number;
    [kChunkedBuffer]: OutputData[];
    [kChunkedLength]: number;
    _closed: boolean;
    _header: string | null;
    [kOutHeaders]: Record<string, any> | null;
    _keepAliveTimeout: number;
    _maxRequestsPerSocket: number | undefined;
    _onPendingData: (delta: number) => void;
    [kUniqueHeaders]: Set<string> | null;
    [kErrored]: Error | null | undefined;
    [kHighWaterMark]: number;
    [kRejectNonStandardBodyWrites]: boolean;
    _writtenDataBuffer: WrittenDataBuffer;
    constructor(req: IncomingMessage, options?: OutgoingMessageOptions);
    _renderHeaders(): Record<string, string>;
    cork(): void;
    uncork(): void;
    setTimeout(msecs: number, callback?: () => void): this;
    destroy(error?: Error): this;
    _send(data: string | Uint8Array, encoding?: BufferEncoding | WriteCallback | null, callback?: WriteCallback | null, byteLength?: number): boolean;
    _writeRaw(data: string | Uint8Array, encoding?: BufferEncoding | WriteCallback | null, callback?: WriteCallback | null, size?: number): boolean;
    _onDataWritten(index: number, entry: WrittenDataBufferEntry): void;
    _storeHeader(firstLine: string, headers: OutgoingHttpHeaders | ReadonlyArray<[string, string]> | null): void;
    get _headers(): OutgoingHttpHeaders;
    set _headers(val: OutgoingHttpHeaders);
    get connection(): any;
    set connection(_socket: any);
    get socket(): any;
    set socket(_socket: any);
    get _headerNames(): any;
    set _headerNames(val: any);
    setHeader(name: string, value: number | string | ReadonlyArray<string>): this;
    setHeaders(headers: Headers | Map<string, number | string | readonly string[]>): this;
    appendHeader(name: string, value: number | string | ReadonlyArray<string>): this;
    getHeader(name: string): number | string | string[] | undefined;
    getHeaderNames(): string[];
    getRawHeaderNames(): any[];
    getHeaders(): OutgoingHttpHeaders;
    hasHeader(name: string): boolean;
    removeHeader(name: string): void;
    _implicitHeader(): void;
    get headersSent(): boolean;
    write(chunk: string | Buffer | Uint8Array, encoding?: BufferEncoding | WriteCallback | null, callback?: WriteCallback): boolean;
    addTrailers(headers: OutgoingHttpHeaders | ReadonlyArray<[string, string]>): void;
    end(chunk?: string | Buffer | Uint8Array | WriteCallback | null, encoding?: BufferEncoding | WriteCallback | null, callback?: WriteCallback): this;
    _finish(): void;
    _flush(): void;
    _flushOutput(dataBuffer: WrittenDataBuffer): boolean | undefined;
    flushHeaders(): void;
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
}
export {};
//# sourceMappingURL=http-outgoing.d.ts.map
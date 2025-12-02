import type { BaseResultSet, DataFormat, ResponseHeaders, ResultJSONType, ResultStream, Row } from '@clickhouse/client-common';
import type { Readable } from 'stream';
import Stream from 'stream';
/** {@link Stream.Readable} with additional types for the `on(data)` method and the async iterator.
 * Everything else is an exact copy from stream.d.ts */
export type StreamReadable<T> = Omit<Stream.Readable, 'on'> & {
    [Symbol.asyncIterator](): NodeJS.AsyncIterator<T>;
    on(event: 'data', listener: (chunk: T) => void): Stream.Readable;
    on(event: 'close', listener: () => void): Stream.Readable;
    on(event: 'drain', listener: () => void): Stream.Readable;
    on(event: 'end', listener: () => void): Stream.Readable;
    on(event: 'error', listener: (err: Error) => void): Stream.Readable;
    on(event: 'finish', listener: () => void): Stream.Readable;
    on(event: 'pause', listener: () => void): Stream.Readable;
    on(event: 'pipe', listener: (src: Readable) => void): Stream.Readable;
    on(event: 'readable', listener: () => void): Stream.Readable;
    on(event: 'resume', listener: () => void): Stream.Readable;
    on(event: 'unpipe', listener: (src: Readable) => void): Stream.Readable;
    on(event: string | symbol, listener: (...args: any[]) => void): Stream.Readable;
};
export interface ResultSetOptions<Format extends DataFormat> {
    stream: Stream.Readable;
    format: Format;
    query_id: string;
    log_error: (error: Error) => void;
    response_headers: ResponseHeaders;
}
export declare class ResultSet<Format extends DataFormat | unknown> implements BaseResultSet<Stream.Readable, Format> {
    private _stream;
    private readonly format;
    readonly query_id: string;
    readonly response_headers: ResponseHeaders;
    private readonly log_error;
    constructor(_stream: Stream.Readable, format: Format, query_id: string, log_error?: (error: Error) => void, _response_headers?: ResponseHeaders);
    /** See {@link BaseResultSet.text}. */
    text(): Promise<string>;
    /** See {@link BaseResultSet.json}. */
    json<T>(): Promise<ResultJSONType<T, Format>>;
    /** See {@link BaseResultSet.stream}. */
    stream<T>(): ResultStream<Format, StreamReadable<Row<T, Format>[]>>;
    /** See {@link BaseResultSet.close}. */
    close(): void;
    static instance<Format extends DataFormat>({ stream, format, query_id, log_error, response_headers, }: ResultSetOptions<Format>): ResultSet<Format>;
}

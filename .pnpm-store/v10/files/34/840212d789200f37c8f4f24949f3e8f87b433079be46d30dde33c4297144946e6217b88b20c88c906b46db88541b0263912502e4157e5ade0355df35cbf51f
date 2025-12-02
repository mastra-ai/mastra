import type Stream from 'stream';
/** Drains the response stream, as calling `destroy` on a {@link Stream.Readable} response stream
 *  will result in closing the underlying socket, and negate the KeepAlive feature benefits.
 *  See https://github.com/ClickHouse/clickhouse-js/pull/203 */
export declare function drainStream(stream: Stream.Readable): Promise<void>;

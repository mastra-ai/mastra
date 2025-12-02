import type { ProgressRow, ResponseHeaders, ResponseJSON, SpecialEventRow } from './clickhouse_types';
import type { DataFormat, RawDataFormat, RecordsJSONFormat, SingleDocumentJSONFormat, StreamableDataFormat, StreamableJSONDataFormat } from './data_formatter';
export type RowOrProgress<T> = {
    row: T;
} | ProgressRow | SpecialEventRow<T>;
export type ResultStream<Format extends DataFormat | unknown, Stream> = Format extends StreamableDataFormat ? Stream : Format extends SingleDocumentJSONFormat ? never : Format extends RecordsJSONFormat ? never : Stream;
export type ResultJSONType<T, F extends DataFormat | unknown> = F extends 'JSONEachRowWithProgress' ? RowOrProgress<T>[] : F extends StreamableJSONDataFormat ? T[] : F extends SingleDocumentJSONFormat ? ResponseJSON<T> : F extends RecordsJSONFormat ? Record<string, T> : F extends RawDataFormat ? never : // happens only when Format could not be inferred from a literal
T[] | Record<string, T> | ResponseJSON<T>;
export type RowJSONType<T, F extends DataFormat | unknown> = F extends 'JSONEachRowWithProgress' ? RowOrProgress<T> : F extends StreamableJSONDataFormat ? T : F extends RawDataFormat | SingleDocumentJSONFormat | RecordsJSONFormat ? never : T;
export interface Row<JSONType = unknown, Format extends DataFormat | unknown = unknown> {
    /** A string representation of a row. */
    text: string;
    /**
     * Returns a JSON representation of a row.
     * The method will throw if called on a response in JSON incompatible format.
     * It is safe to call this method multiple times.
     */
    json<T = JSONType>(): RowJSONType<T, Format>;
}
export interface BaseResultSet<Stream, Format extends DataFormat | unknown> {
    /**
     * The method waits for all the rows to be fully loaded
     * and returns the result as a string.
     *
     * It is possible to call this method for all supported formats.
     *
     * The method should throw if the underlying stream was already consumed
     * by calling the other methods.
     */
    text(): Promise<string>;
    /**
     * The method waits for the all the rows to be fully loaded.
     * When the response is received in full, it will be decoded to return JSON.
     *
     * Should be called only for JSON* formats family.
     *
     * The method should throw if the underlying stream was already consumed
     * by calling the other methods, or if it is called for non-JSON formats,
     * such as CSV, TSV, etc.
     */
    json<T = unknown>(): Promise<ResultJSONType<T, Format>>;
    /**
     * Returns a readable stream for responses that can be streamed.
     *
     * Formats that CAN be streamed ({@link StreamableDataFormat}):
     *   * JSONEachRow
     *   * JSONStringsEachRow
     *   * JSONCompactEachRow
     *   * JSONCompactStringsEachRow
     *   * JSONCompactEachRowWithNames
     *   * JSONCompactEachRowWithNamesAndTypes
     *   * JSONCompactStringsEachRowWithNames
     *   * JSONCompactStringsEachRowWithNamesAndTypes
     *   * CSV
     *   * CSVWithNames
     *   * CSVWithNamesAndTypes
     *   * TabSeparated
     *   * TabSeparatedRaw
     *   * TabSeparatedWithNames
     *   * TabSeparatedWithNamesAndTypes
     *   * CustomSeparated
     *   * CustomSeparatedWithNames
     *   * CustomSeparatedWithNamesAndTypes
     *   * Parquet
     *
     * Formats that CANNOT be streamed (the method returns "never" in TS):
     *   * JSON
     *   * JSONStrings
     *   * JSONCompact
     *   * JSONCompactStrings
     *   * JSONColumnsWithMetadata
     *   * JSONObjectEachRow
     *
     * Every iteration provides an array of {@link Row} instances
     * for {@link StreamableDataFormat} format.
     *
     * Should be called only once.
     *
     * The method should throw if called on a response in non-streamable format,
     * and if the underlying stream was already consumed
     * by calling the other methods.
     */
    stream(): ResultStream<Format, Stream>;
    /** Close the underlying stream. */
    close(): void;
    /** ClickHouse server QueryID. */
    query_id: string;
    /** Response headers. */
    response_headers: ResponseHeaders;
}

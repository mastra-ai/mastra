export declare const StreamableJSONFormats: readonly ["JSONEachRow", "JSONStringsEachRow", "JSONCompactEachRow", "JSONCompactStringsEachRow", "JSONCompactEachRowWithNames", "JSONCompactEachRowWithNamesAndTypes", "JSONCompactStringsEachRowWithNames", "JSONCompactStringsEachRowWithNamesAndTypes", "JSONEachRowWithProgress"];
export declare const RecordsJSONFormats: readonly ["JSONObjectEachRow"];
export declare const SingleDocumentJSONFormats: readonly ["JSON", "JSONStrings", "JSONCompact", "JSONCompactStrings", "JSONColumnsWithMetadata"];
export declare const SupportedJSONFormats: readonly ["JSONObjectEachRow", "JSON", "JSONStrings", "JSONCompact", "JSONCompactStrings", "JSONColumnsWithMetadata", "JSONEachRow", "JSONStringsEachRow", "JSONCompactEachRow", "JSONCompactStringsEachRow", "JSONCompactEachRowWithNames", "JSONCompactEachRowWithNamesAndTypes", "JSONCompactStringsEachRowWithNames", "JSONCompactStringsEachRowWithNamesAndTypes", "JSONEachRowWithProgress"];
export declare const SupportedRawFormats: readonly ["CSV", "CSVWithNames", "CSVWithNamesAndTypes", "TabSeparated", "TabSeparatedRaw", "TabSeparatedWithNames", "TabSeparatedWithNamesAndTypes", "CustomSeparated", "CustomSeparatedWithNames", "CustomSeparatedWithNamesAndTypes", "Parquet"];
export declare const StreamableFormats: readonly ["JSONEachRow", "JSONStringsEachRow", "JSONCompactEachRow", "JSONCompactStringsEachRow", "JSONCompactEachRowWithNames", "JSONCompactEachRowWithNamesAndTypes", "JSONCompactStringsEachRowWithNames", "JSONCompactStringsEachRowWithNamesAndTypes", "JSONEachRowWithProgress", "CSV", "CSVWithNames", "CSVWithNamesAndTypes", "TabSeparated", "TabSeparatedRaw", "TabSeparatedWithNames", "TabSeparatedWithNamesAndTypes", "CustomSeparated", "CustomSeparatedWithNames", "CustomSeparatedWithNamesAndTypes", "Parquet"];
/** CSV, TSV, etc. - can be streamed, but cannot be decoded as JSON. */
export type RawDataFormat = (typeof SupportedRawFormats)[number];
/** Each row is returned as a separate JSON object or an array, and these formats can be streamed. */
export type StreamableJSONDataFormat = (typeof StreamableJSONFormats)[number];
/** Returned as a single {@link ResponseJSON} object, cannot be streamed. */
export type SingleDocumentJSONFormat = (typeof SingleDocumentJSONFormats)[number];
/** Returned as a single object { row_1: T, row_2: T, ...} <br/>
 *  (i.e. Record<string, T>), cannot be streamed. */
export type RecordsJSONFormat = (typeof RecordsJSONFormats)[number];
/** All allowed JSON formats, whether streamable or not. */
export type JSONDataFormat = StreamableJSONDataFormat | SingleDocumentJSONFormat | RecordsJSONFormat;
/** Data formats that are currently supported by the client. <br/>
 *  This is a union of the following types:<br/>
 *  * {@link JSONDataFormat}
 *  * {@link RawDataFormat}
 *  * {@link StreamableDataFormat}
 *  * {@link StreamableJSONDataFormat}
 *  * {@link SingleDocumentJSONFormat}
 *  * {@link RecordsJSONFormat}
 *  @see https://clickhouse.com/docs/en/interfaces/formats */
export type DataFormat = JSONDataFormat | RawDataFormat;
/** All data formats that can be streamed, whether it can be decoded as JSON or not. */
export type StreamableDataFormat = (typeof StreamableFormats)[number];
export declare function isNotStreamableJSONFamily(format: DataFormat): format is SingleDocumentJSONFormat;
export declare function isStreamableJSONFamily(format: DataFormat): format is StreamableJSONDataFormat;
export declare function isSupportedRawFormat(dataFormat: DataFormat): boolean;
export declare function validateStreamFormat(format: any): format is StreamableDataFormat;
/**
 * Encodes a single row of values into a string in a JSON format acceptable by ClickHouse.
 * @param value a single value to encode.
 * @param format One of the supported JSON formats: https://clickhouse.com/docs/en/interfaces/formats/
 * @returns string
 */
export declare function encodeJSON(value: any, format: DataFormat): string;

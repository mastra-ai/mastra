"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamableFormats = exports.SupportedRawFormats = exports.SupportedJSONFormats = exports.SingleDocumentJSONFormats = exports.RecordsJSONFormats = exports.StreamableJSONFormats = void 0;
exports.isNotStreamableJSONFamily = isNotStreamableJSONFamily;
exports.isStreamableJSONFamily = isStreamableJSONFamily;
exports.isSupportedRawFormat = isSupportedRawFormat;
exports.validateStreamFormat = validateStreamFormat;
exports.encodeJSON = encodeJSON;
exports.StreamableJSONFormats = [
    'JSONEachRow',
    'JSONStringsEachRow',
    'JSONCompactEachRow',
    'JSONCompactStringsEachRow',
    'JSONCompactEachRowWithNames',
    'JSONCompactEachRowWithNamesAndTypes',
    'JSONCompactStringsEachRowWithNames',
    'JSONCompactStringsEachRowWithNamesAndTypes',
    'JSONEachRowWithProgress',
];
exports.RecordsJSONFormats = ['JSONObjectEachRow'];
exports.SingleDocumentJSONFormats = [
    'JSON',
    'JSONStrings',
    'JSONCompact',
    'JSONCompactStrings',
    'JSONColumnsWithMetadata',
];
exports.SupportedJSONFormats = [
    ...exports.RecordsJSONFormats,
    ...exports.SingleDocumentJSONFormats,
    ...exports.StreamableJSONFormats,
];
exports.SupportedRawFormats = [
    'CSV',
    'CSVWithNames',
    'CSVWithNamesAndTypes',
    'TabSeparated',
    'TabSeparatedRaw',
    'TabSeparatedWithNames',
    'TabSeparatedWithNamesAndTypes',
    'CustomSeparated',
    'CustomSeparatedWithNames',
    'CustomSeparatedWithNamesAndTypes',
    'Parquet',
];
exports.StreamableFormats = [
    ...exports.StreamableJSONFormats,
    ...exports.SupportedRawFormats,
];
function isNotStreamableJSONFamily(format) {
    return (exports.SingleDocumentJSONFormats.includes(format) ||
        exports.RecordsJSONFormats.includes(format));
}
function isStreamableJSONFamily(format) {
    return exports.StreamableJSONFormats.includes(format);
}
function isSupportedRawFormat(dataFormat) {
    return exports.SupportedRawFormats.includes(dataFormat);
}
function validateStreamFormat(format) {
    if (!exports.StreamableFormats.includes(format)) {
        throw new Error(`${format} format is not streamable. Streamable formats: ${exports.StreamableFormats.join(',')}`);
    }
    return true;
}
/**
 * Encodes a single row of values into a string in a JSON format acceptable by ClickHouse.
 * @param value a single value to encode.
 * @param format One of the supported JSON formats: https://clickhouse.com/docs/en/interfaces/formats/
 * @returns string
 */
function encodeJSON(value, format) {
    if (exports.SupportedJSONFormats.includes(format)) {
        return JSON.stringify(value) + '\n';
    }
    throw new Error(`The client does not support JSON encoding in [${format}] format.`);
}
//# sourceMappingURL=formatter.js.map
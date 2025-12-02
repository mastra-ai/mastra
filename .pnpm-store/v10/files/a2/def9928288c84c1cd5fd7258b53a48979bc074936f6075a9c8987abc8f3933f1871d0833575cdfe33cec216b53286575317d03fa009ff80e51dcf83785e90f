"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProgressRow = isProgressRow;
exports.isRow = isRow;
exports.isException = isException;
/** Type guard to use with `JSONEachRowWithProgress`, checking if the emitted row is a progress row.
 *  @see https://clickhouse.com/docs/en/interfaces/formats#jsoneachrowwithprogress */
function isProgressRow(row) {
    return (row !== null &&
        typeof row === 'object' &&
        'progress' in row &&
        Object.keys(row).length === 1);
}
/** Type guard to use with `JSONEachRowWithProgress`, checking if the emitted row is a row with data.
 *  @see https://clickhouse.com/docs/en/interfaces/formats#jsoneachrowwithprogress */
function isRow(row) {
    return (row !== null &&
        typeof row === 'object' &&
        'row' in row &&
        Object.keys(row).length === 1);
}
/** Type guard to use with `JSONEachRowWithProgress`, checking if the row contains an exception.
 *  @see https://clickhouse.com/docs/en/interfaces/formats#jsoneachrowwithprogress */
function isException(row) {
    return (row !== null &&
        typeof row === 'object' &&
        'exception' in row &&
        Object.keys(row).length === 1);
}
//# sourceMappingURL=clickhouse_types.js.map
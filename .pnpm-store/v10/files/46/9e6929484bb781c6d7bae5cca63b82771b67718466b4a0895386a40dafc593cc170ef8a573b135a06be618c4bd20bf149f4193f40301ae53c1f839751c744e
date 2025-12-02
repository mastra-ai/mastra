"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleColumnTypes = exports.ColumnTypeParseError = void 0;
exports.parseColumnType = parseColumnType;
exports.parseDecimalType = parseDecimalType;
exports.parseEnumType = parseEnumType;
exports.parseMapType = parseMapType;
exports.parseTupleType = parseTupleType;
exports.parseArrayType = parseArrayType;
exports.parseDateTimeType = parseDateTimeType;
exports.parseDateTime64Type = parseDateTime64Type;
exports.parseFixedStringType = parseFixedStringType;
exports.asNullableType = asNullableType;
exports.getElementsTypes = getElementsTypes;
class ColumnTypeParseError extends Error {
    constructor(message, args) {
        super(message);
        Object.defineProperty(this, "args", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.args = args ?? {};
        // Set the prototype explicitly, see:
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, ColumnTypeParseError.prototype);
    }
}
exports.ColumnTypeParseError = ColumnTypeParseError;
exports.SimpleColumnTypes = [
    'Bool',
    'UInt8',
    'Int8',
    'UInt16',
    'Int16',
    'UInt32',
    'Int32',
    'UInt64',
    'Int64',
    'UInt128',
    'Int128',
    'UInt256',
    'Int256',
    'Float32',
    'Float64',
    'String',
    'UUID',
    'Date',
    'Date32',
    'IPv4',
    'IPv6',
];
/**
 * @experimental - incomplete, unstable API;
 * originally intended to be used for RowBinary/Native header parsing internally.
 * Currently unsupported source types:
 * * Geo
 * * (Simple)AggregateFunction
 * * Nested
 * * Old/new JSON
 * * Dynamic
 * * Variant
 */
function parseColumnType(sourceType) {
    let columnType = sourceType;
    let isNullable = false;
    if (columnType.startsWith(LowCardinalityPrefix)) {
        columnType = columnType.slice(LowCardinalityPrefix.length, -1);
    }
    if (columnType.startsWith(NullablePrefix)) {
        columnType = columnType.slice(NullablePrefix.length, -1);
        isNullable = true;
    }
    let result;
    if (exports.SimpleColumnTypes.includes(columnType)) {
        result = {
            type: 'Simple',
            columnType: columnType,
            sourceType,
        };
    }
    else if (columnType.startsWith(DecimalPrefix)) {
        result = parseDecimalType({
            sourceType,
            columnType,
        });
    }
    else if (columnType.startsWith(DateTime64Prefix)) {
        result = parseDateTime64Type({ sourceType, columnType });
    }
    else if (columnType.startsWith(DateTimePrefix)) {
        result = parseDateTimeType({ sourceType, columnType });
    }
    else if (columnType.startsWith(FixedStringPrefix)) {
        result = parseFixedStringType({ sourceType, columnType });
    }
    else if (columnType.startsWith(Enum8Prefix) ||
        columnType.startsWith(Enum16Prefix)) {
        result = parseEnumType({ sourceType, columnType });
    }
    else if (columnType.startsWith(ArrayPrefix)) {
        result = parseArrayType({ sourceType, columnType });
    }
    else if (columnType.startsWith(MapPrefix)) {
        result = parseMapType({ sourceType, columnType });
    }
    else if (columnType.startsWith(TuplePrefix)) {
        result = parseTupleType({ sourceType, columnType });
    }
    else {
        throw new ColumnTypeParseError('Unsupported column type', { columnType });
    }
    if (isNullable) {
        return asNullableType(result, sourceType);
    }
    else {
        return result;
    }
}
function parseDecimalType({ columnType, sourceType, }) {
    if (!columnType.startsWith(DecimalPrefix) ||
        columnType.length < DecimalPrefix.length + 5 // Decimal(1, 0) is the shortest valid definition
    ) {
        throw new ColumnTypeParseError('Invalid Decimal type', {
            sourceType,
            columnType,
        });
    }
    const split = columnType.slice(DecimalPrefix.length, -1).split(', ');
    if (split.length !== 2) {
        throw new ColumnTypeParseError('Expected Decimal type to have both precision and scale', {
            sourceType,
            columnType,
            split,
        });
    }
    let intSize = 32;
    const precision = parseInt(split[0], 10);
    if (Number.isNaN(precision) || precision < 1 || precision > 76) {
        throw new ColumnTypeParseError('Invalid Decimal precision', {
            columnType,
            sourceType,
            precision,
        });
    }
    const scale = parseInt(split[1], 10);
    if (Number.isNaN(scale) || scale < 0 || scale > precision) {
        throw new ColumnTypeParseError('Invalid Decimal scale', {
            columnType,
            sourceType,
            precision,
            scale,
        });
    }
    if (precision > 38) {
        intSize = 256;
    }
    else if (precision > 18) {
        intSize = 128;
    }
    else if (precision > 9) {
        intSize = 64;
    }
    return {
        type: 'Decimal',
        params: {
            precision,
            scale,
            intSize,
        },
        sourceType,
    };
}
function parseEnumType({ columnType, sourceType, }) {
    let intSize;
    if (columnType.startsWith(Enum8Prefix)) {
        columnType = columnType.slice(Enum8Prefix.length, -1);
        intSize = 8;
    }
    else if (columnType.startsWith(Enum16Prefix)) {
        columnType = columnType.slice(Enum16Prefix.length, -1);
        intSize = 16;
    }
    else {
        throw new ColumnTypeParseError('Expected Enum to be either Enum8 or Enum16', {
            columnType,
            sourceType,
        });
    }
    // The minimal allowed Enum definition is Enum8('' = 0), i.e. 6 chars inside.
    if (columnType.length < 6) {
        throw new ColumnTypeParseError('Invalid Enum type values', {
            columnType,
            sourceType,
        });
    }
    const names = [];
    const indices = [];
    let parsingName = true; // false when parsing the index
    let charEscaped = false; // we should ignore escaped ticks
    let startIndex = 1; // Skip the first '
    // Should support the most complicated enums, such as Enum8('f\'' = 1, 'x =' = 2, 'b\'\'\'' = 3, '\'c=4=' = 42, '4' = 100)
    for (let i = 1; i < columnType.length; i++) {
        if (parsingName) {
            if (charEscaped) {
                charEscaped = false;
            }
            else {
                if (columnType.charCodeAt(i) === BackslashASCII) {
                    charEscaped = true;
                }
                else if (columnType.charCodeAt(i) === SingleQuoteASCII) {
                    // non-escaped closing tick - push the name
                    const name = columnType.slice(startIndex, i);
                    if (names.includes(name)) {
                        throw new ColumnTypeParseError('Duplicate Enum name', {
                            columnType,
                            sourceType,
                            name,
                            names,
                            indices,
                        });
                    }
                    names.push(name);
                    i += 4; // skip ` = ` and the first digit, as it will always have at least one.
                    startIndex = i;
                    parsingName = false;
                }
            }
        }
        // Parsing the index, skipping next iterations until the first non-digit one
        else if (columnType.charCodeAt(i) < ZeroASCII ||
            columnType.charCodeAt(i) > NineASCII) {
            pushEnumIndex(startIndex, i);
            // the char at this index should be comma.
            i += 2; // skip ` '`, but not the first char - ClickHouse allows something like Enum8('foo' = 0, '' = 42)
            startIndex = i + 1;
            parsingName = true;
            charEscaped = false;
        }
    }
    // Push the last index
    pushEnumIndex(startIndex, columnType.length);
    if (names.length !== indices.length) {
        throw new ColumnTypeParseError('Expected Enum to have the same number of names and indices', { columnType, sourceType, names, indices });
    }
    const values = {};
    for (let i = 0; i < names.length; i++) {
        values[indices[i]] = names[i];
    }
    return {
        type: 'Enum',
        values,
        intSize,
        sourceType,
    };
    function pushEnumIndex(start, end) {
        const index = parseInt(columnType.slice(start, end), 10);
        if (Number.isNaN(index) || index < 0) {
            throw new ColumnTypeParseError('Expected Enum index to be a valid number', {
                columnType,
                sourceType,
                names,
                indices,
                index,
                start,
                end,
            });
        }
        if (indices.includes(index)) {
            throw new ColumnTypeParseError('Duplicate Enum index', {
                columnType,
                sourceType,
                index,
                names,
                indices,
            });
        }
        indices.push(index);
    }
}
function parseMapType({ columnType, sourceType, }) {
    if (!columnType.startsWith(MapPrefix) ||
        columnType.length < MapPrefix.length + 11 // the shortest definition seems to be Map(Int8, Int8)
    ) {
        throw new ColumnTypeParseError('Invalid Map type', {
            columnType,
            sourceType,
        });
    }
    columnType = columnType.slice(MapPrefix.length, -1);
    const [keyType, valueType] = getElementsTypes({ columnType, sourceType }, 2);
    const key = parseColumnType(keyType);
    if (key.type === 'DateTime64' ||
        key.type === 'Nullable' ||
        key.type === 'Array' ||
        key.type === 'Map' ||
        key.type === 'Decimal' ||
        key.type === 'Tuple') {
        throw new ColumnTypeParseError('Invalid Map key type', {
            key,
            sourceType,
        });
    }
    const value = parseColumnType(valueType);
    return {
        type: 'Map',
        key,
        value,
        sourceType,
    };
}
function parseTupleType({ columnType, sourceType, }) {
    if (!columnType.startsWith(TuplePrefix) ||
        columnType.length < TuplePrefix.length + 5 // Tuple(Int8) is the shortest valid definition
    ) {
        throw new ColumnTypeParseError('Invalid Tuple type', {
            columnType,
            sourceType,
        });
    }
    columnType = columnType.slice(TuplePrefix.length, -1);
    const elements = getElementsTypes({ columnType, sourceType }, 1).map((type) => parseColumnType(type));
    return {
        type: 'Tuple',
        elements,
        sourceType,
    };
}
function parseArrayType({ columnType, sourceType, }) {
    if (!columnType.startsWith(ArrayPrefix) ||
        columnType.length < ArrayPrefix.length + 5 // Array(Int8) is the shortest valid definition
    ) {
        throw new ColumnTypeParseError('Invalid Array type', {
            columnType,
            sourceType,
        });
    }
    let dimensions = 0;
    while (columnType.length > 0) {
        if (columnType.startsWith(ArrayPrefix)) {
            columnType = columnType.slice(ArrayPrefix.length, -1); // Array(T) -> T
            dimensions++;
        }
        else {
            break;
        }
    }
    if (dimensions === 0 || dimensions > 10) {
        // TODO: check how many we can handle; max 10 seems more than enough.
        throw new ColumnTypeParseError('Expected Array to have between 1 and 10 dimensions', { columnType });
    }
    const value = parseColumnType(columnType);
    if (value.type === 'Array') {
        throw new ColumnTypeParseError('Unexpected Array as value type', {
            columnType,
            sourceType,
        });
    }
    return {
        type: 'Array',
        value,
        dimensions,
        sourceType,
    };
}
function parseDateTimeType({ columnType, sourceType, }) {
    if (columnType.startsWith(DateTimeWithTimezonePrefix) &&
        columnType.length > DateTimeWithTimezonePrefix.length + 4 // DateTime('GB') has the least amount of chars
    ) {
        const timezone = columnType.slice(DateTimeWithTimezonePrefix.length + 1, -2);
        return {
            type: 'DateTime',
            timezone,
            sourceType,
        };
    }
    else if (columnType.startsWith(DateTimePrefix) &&
        columnType.length === DateTimePrefix.length) {
        return {
            type: 'DateTime',
            timezone: null,
            sourceType,
        };
    }
    else {
        throw new ColumnTypeParseError('Invalid DateTime type', {
            columnType,
            sourceType,
        });
    }
}
function parseDateTime64Type({ columnType, sourceType, }) {
    if (!columnType.startsWith(DateTime64Prefix) ||
        columnType.length < DateTime64Prefix.length + 2 // should at least have a precision
    ) {
        throw new ColumnTypeParseError('Invalid DateTime64 type', {
            columnType,
            sourceType,
        });
    }
    const precision = parseInt(columnType[DateTime64Prefix.length], 10);
    if (Number.isNaN(precision) || precision < 0 || precision > 9) {
        throw new ColumnTypeParseError('Invalid DateTime64 precision', {
            columnType,
            sourceType,
            precision,
        });
    }
    let timezone = null;
    if (columnType.length > DateTime64Prefix.length + 2) {
        // e.g. DateTime64(3, 'UTC') -> UTC
        timezone = columnType.slice(DateTime64Prefix.length + 4, -2);
    }
    return {
        type: 'DateTime64',
        timezone,
        precision,
        sourceType,
    };
}
function parseFixedStringType({ columnType, sourceType, }) {
    if (!columnType.startsWith(FixedStringPrefix) ||
        columnType.length < FixedStringPrefix.length + 2 // i.e. at least FixedString(1)
    ) {
        throw new ColumnTypeParseError('Invalid FixedString type', {
            columnType,
            sourceType,
        });
    }
    const sizeBytes = parseInt(columnType.slice(FixedStringPrefix.length, -1), 10);
    if (Number.isNaN(sizeBytes) || sizeBytes < 1) {
        throw new ColumnTypeParseError('Invalid FixedString size in bytes', {
            columnType,
            sourceType,
            sizeBytes,
        });
    }
    return {
        type: 'FixedString',
        sizeBytes,
        sourceType,
    };
}
function asNullableType(value, sourceType) {
    if (value.type === 'Array' ||
        value.type === 'Map' ||
        value.type === 'Tuple' ||
        value.type === 'Nullable') {
        throw new ColumnTypeParseError(`${value.type} cannot be Nullable`, {
            sourceType,
        });
    }
    if (value.sourceType.startsWith(NullablePrefix)) {
        value.sourceType = value.sourceType.slice(NullablePrefix.length, -1);
    }
    return {
        type: 'Nullable',
        sourceType,
        value,
    };
}
/** Used for Map key/value types and Tuple elements.
 *  * `String, UInt8` results in [`String`, `UInt8`].
 *  * `String, UInt8, Array(String)` results in [`String`, `UInt8`, `Array(String)`].
 *  * Throws if parsed values are below the required minimum. */
function getElementsTypes({ columnType, sourceType }, minElements) {
    const elements = [];
    /** Consider the element type parsed once we reach a comma outside of parens AND after an unescaped tick.
     *  The most complicated cases are values names in the self-defined Enum types:
     *  * `Tuple(Enum8('f\'()' = 1))`  ->  `f\'()`
     *  * `Tuple(Enum8('(' = 1))`      ->  `(`
     *  See also: {@link parseEnumType }, which works similarly (but has to deal with the indices following the names). */
    let openParens = 0;
    let quoteOpen = false;
    let charEscaped = false;
    let lastElementIndex = 0;
    for (let i = 0; i < columnType.length; i++) {
        // prettier-ignore
        // console.log(i, 'Current char:', columnType[i], 'openParens:', openParens, 'quoteOpen:', quoteOpen, 'charEscaped:', charEscaped)
        if (charEscaped) {
            charEscaped = false;
        }
        else if (columnType.charCodeAt(i) === BackslashASCII) {
            charEscaped = true;
        }
        else if (columnType.charCodeAt(i) === SingleQuoteASCII) {
            quoteOpen = !quoteOpen; // unescaped quote
        }
        else {
            if (!quoteOpen) {
                if (columnType.charCodeAt(i) === LeftParenASCII) {
                    openParens++;
                }
                else if (columnType.charCodeAt(i) === RightParenASCII) {
                    openParens--;
                }
                else if (columnType.charCodeAt(i) === CommaASCII) {
                    if (openParens === 0) {
                        elements.push(columnType.slice(lastElementIndex, i));
                        // console.log('Pushed element:', elements[elements.length - 1])
                        i += 2; // skip ', '
                        lastElementIndex = i;
                    }
                }
            }
        }
    }
    // prettier-ignore
    // console.log('Final elements:', elements, 'nextElementIndex:', lastElementIndex, 'minElements:', minElements, 'openParens:', openParens)
    // Push the remaining part of the type if it seems to be valid (at least all parentheses are closed)
    if (!openParens && lastElementIndex < columnType.length - 1) {
        elements.push(columnType.slice(lastElementIndex));
    }
    if (elements.length < minElements) {
        throw new ColumnTypeParseError('Expected more elements in the type', {
            sourceType,
            columnType,
            elements,
            minElements,
        });
    }
    return elements;
}
const NullablePrefix = 'Nullable(';
const LowCardinalityPrefix = 'LowCardinality(';
const DecimalPrefix = 'Decimal(';
const ArrayPrefix = 'Array(';
const MapPrefix = 'Map(';
const Enum8Prefix = 'Enum8(';
const Enum16Prefix = 'Enum16(';
const TuplePrefix = 'Tuple(';
const DateTimePrefix = 'DateTime';
const DateTimeWithTimezonePrefix = 'DateTime(';
const DateTime64Prefix = 'DateTime64(';
const FixedStringPrefix = 'FixedString(';
const SingleQuoteASCII = 39;
const LeftParenASCII = 40;
const RightParenASCII = 41;
const CommaASCII = 44;
const ZeroASCII = 48;
const NineASCII = 57;
const BackslashASCII = 92;
//# sourceMappingURL=column_types.js.map
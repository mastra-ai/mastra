"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Decoder = exports.PUSH_TYPE_MAPPING = exports.RESP_TYPES = void 0;
// @ts-nocheck
const verbatim_string_1 = require("./verbatim-string");
const errors_1 = require("../errors");
// https://github.com/redis/redis-specifications/blob/master/protocol/RESP3.md
exports.RESP_TYPES = {
    NULL: 95, // _
    BOOLEAN: 35, // #
    NUMBER: 58, // :
    BIG_NUMBER: 40, // (
    DOUBLE: 44, // ,
    SIMPLE_STRING: 43, // +
    BLOB_STRING: 36, // $
    VERBATIM_STRING: 61, // =
    SIMPLE_ERROR: 45, // -
    BLOB_ERROR: 33, // !
    ARRAY: 42, // *
    SET: 126, // ~
    MAP: 37, // %
    PUSH: 62 // >
};
const ASCII = {
    '\r': 13,
    't': 116,
    '+': 43,
    '-': 45,
    '0': 48,
    '.': 46,
    'i': 105,
    'n': 110,
    'E': 69,
    'e': 101
};
exports.PUSH_TYPE_MAPPING = {
    [exports.RESP_TYPES.BLOB_STRING]: Buffer
};
class Decoder {
    onReply;
    onErrorReply;
    onPush;
    getTypeMapping;
    #cursor = 0;
    #next;
    constructor(config) {
        this.onReply = config.onReply;
        this.onErrorReply = config.onErrorReply;
        this.onPush = config.onPush;
        this.getTypeMapping = config.getTypeMapping;
    }
    reset() {
        this.#cursor = 0;
        this.#next = undefined;
    }
    write(chunk) {
        if (this.#cursor >= chunk.length) {
            this.#cursor -= chunk.length;
            return;
        }
        if (this.#next) {
            if (this.#next(chunk) || this.#cursor >= chunk.length) {
                this.#cursor -= chunk.length;
                return;
            }
        }
        do {
            const type = chunk[this.#cursor];
            if (++this.#cursor === chunk.length) {
                this.#next = this.#continueDecodeTypeValue.bind(this, type);
                break;
            }
            if (this.#decodeTypeValue(type, chunk)) {
                break;
            }
        } while (this.#cursor < chunk.length);
        this.#cursor -= chunk.length;
    }
    #continueDecodeTypeValue(type, chunk) {
        this.#next = undefined;
        return this.#decodeTypeValue(type, chunk);
    }
    #decodeTypeValue(type, chunk) {
        switch (type) {
            case exports.RESP_TYPES.NULL:
                this.onReply(this.#decodeNull());
                return false;
            case exports.RESP_TYPES.BOOLEAN:
                return this.#handleDecodedValue(this.onReply, this.#decodeBoolean(chunk));
            case exports.RESP_TYPES.NUMBER:
                return this.#handleDecodedValue(this.onReply, this.#decodeNumber(this.getTypeMapping()[exports.RESP_TYPES.NUMBER], chunk));
            case exports.RESP_TYPES.BIG_NUMBER:
                return this.#handleDecodedValue(this.onReply, this.#decodeBigNumber(this.getTypeMapping()[exports.RESP_TYPES.BIG_NUMBER], chunk));
            case exports.RESP_TYPES.DOUBLE:
                return this.#handleDecodedValue(this.onReply, this.#decodeDouble(this.getTypeMapping()[exports.RESP_TYPES.DOUBLE], chunk));
            case exports.RESP_TYPES.SIMPLE_STRING:
                return this.#handleDecodedValue(this.onReply, this.#decodeSimpleString(this.getTypeMapping()[exports.RESP_TYPES.SIMPLE_STRING], chunk));
            case exports.RESP_TYPES.BLOB_STRING:
                return this.#handleDecodedValue(this.onReply, this.#decodeBlobString(this.getTypeMapping()[exports.RESP_TYPES.BLOB_STRING], chunk));
            case exports.RESP_TYPES.VERBATIM_STRING:
                return this.#handleDecodedValue(this.onReply, this.#decodeVerbatimString(this.getTypeMapping()[exports.RESP_TYPES.VERBATIM_STRING], chunk));
            case exports.RESP_TYPES.SIMPLE_ERROR:
                return this.#handleDecodedValue(this.onErrorReply, this.#decodeSimpleError(chunk));
            case exports.RESP_TYPES.BLOB_ERROR:
                return this.#handleDecodedValue(this.onErrorReply, this.#decodeBlobError(chunk));
            case exports.RESP_TYPES.ARRAY:
                return this.#handleDecodedValue(this.onReply, this.#decodeArray(this.getTypeMapping(), chunk));
            case exports.RESP_TYPES.SET:
                return this.#handleDecodedValue(this.onReply, this.#decodeSet(this.getTypeMapping(), chunk));
            case exports.RESP_TYPES.MAP:
                return this.#handleDecodedValue(this.onReply, this.#decodeMap(this.getTypeMapping(), chunk));
            case exports.RESP_TYPES.PUSH:
                return this.#handleDecodedValue(this.onPush, this.#decodeArray(exports.PUSH_TYPE_MAPPING, chunk));
            default:
                throw new Error(`Unknown RESP type ${type} "${String.fromCharCode(type)}"`);
        }
    }
    #handleDecodedValue(cb, value) {
        if (typeof value === 'function') {
            this.#next = this.#continueDecodeValue.bind(this, cb, value);
            return true;
        }
        cb(value);
        return false;
    }
    #continueDecodeValue(cb, next, chunk) {
        this.#next = undefined;
        return this.#handleDecodedValue(cb, next(chunk));
    }
    #decodeNull() {
        this.#cursor += 2; // skip \r\n
        return null;
    }
    #decodeBoolean(chunk) {
        const boolean = chunk[this.#cursor] === ASCII.t;
        this.#cursor += 3; // skip {t | f}\r\n
        return boolean;
    }
    #decodeNumber(type, chunk) {
        if (type === String) {
            return this.#decodeSimpleString(String, chunk);
        }
        switch (chunk[this.#cursor]) {
            case ASCII['+']:
                return this.#maybeDecodeNumberValue(false, chunk);
            case ASCII['-']:
                return this.#maybeDecodeNumberValue(true, chunk);
            default:
                return this.#decodeNumberValue(false, this.#decodeUnsingedNumber.bind(this, 0), chunk);
        }
    }
    #maybeDecodeNumberValue(isNegative, chunk) {
        const cb = this.#decodeUnsingedNumber.bind(this, 0);
        return ++this.#cursor === chunk.length ?
            this.#decodeNumberValue.bind(this, isNegative, cb) :
            this.#decodeNumberValue(isNegative, cb, chunk);
    }
    #decodeNumberValue(isNegative, numberCb, chunk) {
        const number = numberCb(chunk);
        return typeof number === 'function' ?
            this.#decodeNumberValue.bind(this, isNegative, number) :
            isNegative ? -number : number;
    }
    #decodeUnsingedNumber(number, chunk) {
        let cursor = this.#cursor;
        do {
            const byte = chunk[cursor];
            if (byte === ASCII['\r']) {
                this.#cursor = cursor + 2; // skip \r\n
                return number;
            }
            number = number * 10 + byte - ASCII['0'];
        } while (++cursor < chunk.length);
        this.#cursor = cursor;
        return this.#decodeUnsingedNumber.bind(this, number);
    }
    #decodeBigNumber(type, chunk) {
        if (type === String) {
            return this.#decodeSimpleString(String, chunk);
        }
        switch (chunk[this.#cursor]) {
            case ASCII['+']:
                return this.#maybeDecodeBigNumberValue(false, chunk);
            case ASCII['-']:
                return this.#maybeDecodeBigNumberValue(true, chunk);
            default:
                return this.#decodeBigNumberValue(false, this.#decodeUnsingedBigNumber.bind(this, 0n), chunk);
        }
    }
    #maybeDecodeBigNumberValue(isNegative, chunk) {
        const cb = this.#decodeUnsingedBigNumber.bind(this, 0n);
        return ++this.#cursor === chunk.length ?
            this.#decodeBigNumberValue.bind(this, isNegative, cb) :
            this.#decodeBigNumberValue(isNegative, cb, chunk);
    }
    #decodeBigNumberValue(isNegative, bigNumberCb, chunk) {
        const bigNumber = bigNumberCb(chunk);
        return typeof bigNumber === 'function' ?
            this.#decodeBigNumberValue.bind(this, isNegative, bigNumber) :
            isNegative ? -bigNumber : bigNumber;
    }
    #decodeUnsingedBigNumber(bigNumber, chunk) {
        let cursor = this.#cursor;
        do {
            const byte = chunk[cursor];
            if (byte === ASCII['\r']) {
                this.#cursor = cursor + 2; // skip \r\n
                return bigNumber;
            }
            bigNumber = bigNumber * 10n + BigInt(byte - ASCII['0']);
        } while (++cursor < chunk.length);
        this.#cursor = cursor;
        return this.#decodeUnsingedBigNumber.bind(this, bigNumber);
    }
    #decodeDouble(type, chunk) {
        if (type === String) {
            return this.#decodeSimpleString(String, chunk);
        }
        switch (chunk[this.#cursor]) {
            case ASCII.n:
                this.#cursor += 5; // skip nan\r\n
                return NaN;
            case ASCII['+']:
                return this.#maybeDecodeDoubleInteger(false, chunk);
            case ASCII['-']:
                return this.#maybeDecodeDoubleInteger(true, chunk);
            default:
                return this.#decodeDoubleInteger(false, 0, chunk);
        }
    }
    #maybeDecodeDoubleInteger(isNegative, chunk) {
        return ++this.#cursor === chunk.length ?
            this.#decodeDoubleInteger.bind(this, isNegative, 0) :
            this.#decodeDoubleInteger(isNegative, 0, chunk);
    }
    #decodeDoubleInteger(isNegative, integer, chunk) {
        if (chunk[this.#cursor] === ASCII.i) {
            this.#cursor += 5; // skip inf\r\n
            return isNegative ? -Infinity : Infinity;
        }
        return this.#continueDecodeDoubleInteger(isNegative, integer, chunk);
    }
    #continueDecodeDoubleInteger(isNegative, integer, chunk) {
        let cursor = this.#cursor;
        do {
            const byte = chunk[cursor];
            switch (byte) {
                case ASCII['.']:
                    this.#cursor = cursor + 1; // skip .
                    return this.#cursor < chunk.length ?
                        this.#decodeDoubleDecimal(isNegative, 0, integer, chunk) :
                        this.#decodeDoubleDecimal.bind(this, isNegative, 0, integer);
                case ASCII.E:
                case ASCII.e:
                    this.#cursor = cursor + 1; // skip E/e
                    const i = isNegative ? -integer : integer;
                    return this.#cursor < chunk.length ?
                        this.#decodeDoubleExponent(i, chunk) :
                        this.#decodeDoubleExponent.bind(this, i);
                case ASCII['\r']:
                    this.#cursor = cursor + 2; // skip \r\n
                    return isNegative ? -integer : integer;
                default:
                    integer = integer * 10 + byte - ASCII['0'];
            }
        } while (++cursor < chunk.length);
        this.#cursor = cursor;
        return this.#continueDecodeDoubleInteger.bind(this, isNegative, integer);
    }
    // Precalculated multipliers for decimal points to improve performance
    // "... about 15 to 17 decimal places ..."
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#:~:text=about%2015%20to%2017%20decimal%20places
    static #DOUBLE_DECIMAL_MULTIPLIERS = [
        1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6,
        1e-7, 1e-8, 1e-9, 1e-10, 1e-11, 1e-12,
        1e-13, 1e-14, 1e-15, 1e-16, 1e-17
    ];
    #decodeDoubleDecimal(isNegative, decimalIndex, double, chunk) {
        let cursor = this.#cursor;
        do {
            const byte = chunk[cursor];
            switch (byte) {
                case ASCII.E:
                case ASCII.e:
                    this.#cursor = cursor + 1; // skip E/e
                    const d = isNegative ? -double : double;
                    return this.#cursor === chunk.length ?
                        this.#decodeDoubleExponent.bind(this, d) :
                        this.#decodeDoubleExponent(d, chunk);
                case ASCII['\r']:
                    this.#cursor = cursor + 2; // skip \r\n
                    return isNegative ? -double : double;
            }
            if (decimalIndex < _a.#DOUBLE_DECIMAL_MULTIPLIERS.length) {
                double += (byte - ASCII['0']) * _a.#DOUBLE_DECIMAL_MULTIPLIERS[decimalIndex++];
            }
        } while (++cursor < chunk.length);
        this.#cursor = cursor;
        return this.#decodeDoubleDecimal.bind(this, isNegative, decimalIndex, double);
    }
    #decodeDoubleExponent(double, chunk) {
        switch (chunk[this.#cursor]) {
            case ASCII['+']:
                return ++this.#cursor === chunk.length ?
                    this.#continueDecodeDoubleExponent.bind(this, false, double, 0) :
                    this.#continueDecodeDoubleExponent(false, double, 0, chunk);
            case ASCII['-']:
                return ++this.#cursor === chunk.length ?
                    this.#continueDecodeDoubleExponent.bind(this, true, double, 0) :
                    this.#continueDecodeDoubleExponent(true, double, 0, chunk);
        }
        return this.#continueDecodeDoubleExponent(false, double, 0, chunk);
    }
    #continueDecodeDoubleExponent(isNegative, double, exponent, chunk) {
        let cursor = this.#cursor;
        do {
            const byte = chunk[cursor];
            if (byte === ASCII['\r']) {
                this.#cursor = cursor + 2; // skip \r\n
                return double * 10 ** (isNegative ? -exponent : exponent);
            }
            exponent = exponent * 10 + byte - ASCII['0'];
        } while (++cursor < chunk.length);
        this.#cursor = cursor;
        return this.#continueDecodeDoubleExponent.bind(this, isNegative, double, exponent);
    }
    #findCRLF(chunk, cursor) {
        while (chunk[cursor] !== ASCII['\r']) {
            if (++cursor === chunk.length) {
                this.#cursor = chunk.length;
                return -1;
            }
        }
        this.#cursor = cursor + 2; // skip \r\n
        return cursor;
    }
    #decodeSimpleString(type, chunk) {
        const start = this.#cursor, crlfIndex = this.#findCRLF(chunk, start);
        if (crlfIndex === -1) {
            return this.#continueDecodeSimpleString.bind(this, [chunk.subarray(start)], type);
        }
        const slice = chunk.subarray(start, crlfIndex);
        return type === Buffer ?
            slice :
            slice.toString();
    }
    #continueDecodeSimpleString(chunks, type, chunk) {
        const start = this.#cursor, crlfIndex = this.#findCRLF(chunk, start);
        if (crlfIndex === -1) {
            chunks.push(chunk.subarray(start));
            return this.#continueDecodeSimpleString.bind(this, chunks, type);
        }
        chunks.push(chunk.subarray(start, crlfIndex));
        return type === Buffer ?
            Buffer.concat(chunks) :
            chunks.join('');
    }
    #decodeBlobString(type, chunk) {
        // RESP 2 bulk string null
        // https://github.com/redis/redis-specifications/blob/master/protocol/RESP2.md#resp-bulk-strings
        if (chunk[this.#cursor] === ASCII['-']) {
            this.#cursor += 4; // skip -1\r\n
            return null;
        }
        const length = this.#decodeUnsingedNumber(0, chunk);
        if (typeof length === 'function') {
            return this.#continueDecodeBlobStringLength.bind(this, length, type);
        }
        else if (this.#cursor >= chunk.length) {
            return this.#decodeBlobStringWithLength.bind(this, length, type);
        }
        return this.#decodeBlobStringWithLength(length, type, chunk);
    }
    #continueDecodeBlobStringLength(lengthCb, type, chunk) {
        const length = lengthCb(chunk);
        if (typeof length === 'function') {
            return this.#continueDecodeBlobStringLength.bind(this, length, type);
        }
        else if (this.#cursor >= chunk.length) {
            return this.#decodeBlobStringWithLength.bind(this, length, type);
        }
        return this.#decodeBlobStringWithLength(length, type, chunk);
    }
    #decodeStringWithLength(length, skip, type, chunk) {
        const end = this.#cursor + length;
        if (end >= chunk.length) {
            const slice = chunk.subarray(this.#cursor);
            this.#cursor = chunk.length;
            return this.#continueDecodeStringWithLength.bind(this, length - slice.length, [slice], skip, type);
        }
        const slice = chunk.subarray(this.#cursor, end);
        this.#cursor = end + skip;
        return type === Buffer ?
            slice :
            slice.toString();
    }
    #continueDecodeStringWithLength(length, chunks, skip, type, chunk) {
        const end = this.#cursor + length;
        if (end >= chunk.length) {
            const slice = chunk.subarray(this.#cursor);
            chunks.push(slice);
            this.#cursor = chunk.length;
            return this.#continueDecodeStringWithLength.bind(this, length - slice.length, chunks, skip, type);
        }
        chunks.push(chunk.subarray(this.#cursor, end));
        this.#cursor = end + skip;
        return type === Buffer ?
            Buffer.concat(chunks) :
            chunks.join('');
    }
    #decodeBlobStringWithLength(length, type, chunk) {
        return this.#decodeStringWithLength(length, 2, type, chunk);
    }
    #decodeVerbatimString(type, chunk) {
        return this.#continueDecodeVerbatimStringLength(this.#decodeUnsingedNumber.bind(this, 0), type, chunk);
    }
    #continueDecodeVerbatimStringLength(lengthCb, type, chunk) {
        const length = lengthCb(chunk);
        return typeof length === 'function' ?
            this.#continueDecodeVerbatimStringLength.bind(this, length, type) :
            this.#decodeVerbatimStringWithLength(length, type, chunk);
    }
    #decodeVerbatimStringWithLength(length, type, chunk) {
        const stringLength = length - 4; // skip <format>:
        if (type === verbatim_string_1.VerbatimString) {
            return this.#decodeVerbatimStringFormat(stringLength, chunk);
        }
        this.#cursor += 4; // skip <format>:
        return this.#cursor >= chunk.length ?
            this.#decodeBlobStringWithLength.bind(this, stringLength, type) :
            this.#decodeBlobStringWithLength(stringLength, type, chunk);
    }
    #decodeVerbatimStringFormat(stringLength, chunk) {
        const formatCb = this.#decodeStringWithLength.bind(this, 3, 1, String);
        return this.#cursor >= chunk.length ?
            this.#continueDecodeVerbatimStringFormat.bind(this, stringLength, formatCb) :
            this.#continueDecodeVerbatimStringFormat(stringLength, formatCb, chunk);
    }
    #continueDecodeVerbatimStringFormat(stringLength, formatCb, chunk) {
        const format = formatCb(chunk);
        return typeof format === 'function' ?
            this.#continueDecodeVerbatimStringFormat.bind(this, stringLength, format) :
            this.#decodeVerbatimStringWithFormat(stringLength, format, chunk);
    }
    #decodeVerbatimStringWithFormat(stringLength, format, chunk) {
        return this.#continueDecodeVerbatimStringWithFormat(format, this.#decodeBlobStringWithLength.bind(this, stringLength, String), chunk);
    }
    #continueDecodeVerbatimStringWithFormat(format, stringCb, chunk) {
        const string = stringCb(chunk);
        return typeof string === 'function' ?
            this.#continueDecodeVerbatimStringWithFormat.bind(this, format, string) :
            new verbatim_string_1.VerbatimString(format, string);
    }
    #decodeSimpleError(chunk) {
        const string = this.#decodeSimpleString(String, chunk);
        return typeof string === 'function' ?
            this.#continueDecodeSimpleError.bind(this, string) :
            new errors_1.SimpleError(string);
    }
    #continueDecodeSimpleError(stringCb, chunk) {
        const string = stringCb(chunk);
        return typeof string === 'function' ?
            this.#continueDecodeSimpleError.bind(this, string) :
            new errors_1.SimpleError(string);
    }
    #decodeBlobError(chunk) {
        const string = this.#decodeBlobString(String, chunk);
        return typeof string === 'function' ?
            this.#continueDecodeBlobError.bind(this, string) :
            new errors_1.BlobError(string);
    }
    #continueDecodeBlobError(stringCb, chunk) {
        const string = stringCb(chunk);
        return typeof string === 'function' ?
            this.#continueDecodeBlobError.bind(this, string) :
            new errors_1.BlobError(string);
    }
    #decodeNestedType(typeMapping, chunk) {
        const type = chunk[this.#cursor];
        return ++this.#cursor === chunk.length ?
            this.#decodeNestedTypeValue.bind(this, type, typeMapping) :
            this.#decodeNestedTypeValue(type, typeMapping, chunk);
    }
    #decodeNestedTypeValue(type, typeMapping, chunk) {
        switch (type) {
            case exports.RESP_TYPES.NULL:
                return this.#decodeNull();
            case exports.RESP_TYPES.BOOLEAN:
                return this.#decodeBoolean(chunk);
            case exports.RESP_TYPES.NUMBER:
                return this.#decodeNumber(typeMapping[exports.RESP_TYPES.NUMBER], chunk);
            case exports.RESP_TYPES.BIG_NUMBER:
                return this.#decodeBigNumber(typeMapping[exports.RESP_TYPES.BIG_NUMBER], chunk);
            case exports.RESP_TYPES.DOUBLE:
                return this.#decodeDouble(typeMapping[exports.RESP_TYPES.DOUBLE], chunk);
            case exports.RESP_TYPES.SIMPLE_STRING:
                return this.#decodeSimpleString(typeMapping[exports.RESP_TYPES.SIMPLE_STRING], chunk);
            case exports.RESP_TYPES.BLOB_STRING:
                return this.#decodeBlobString(typeMapping[exports.RESP_TYPES.BLOB_STRING], chunk);
            case exports.RESP_TYPES.VERBATIM_STRING:
                return this.#decodeVerbatimString(typeMapping[exports.RESP_TYPES.VERBATIM_STRING], chunk);
            case exports.RESP_TYPES.SIMPLE_ERROR:
                return this.#decodeSimpleError(chunk);
            case exports.RESP_TYPES.BLOB_ERROR:
                return this.#decodeBlobError(chunk);
            case exports.RESP_TYPES.ARRAY:
                return this.#decodeArray(typeMapping, chunk);
            case exports.RESP_TYPES.SET:
                return this.#decodeSet(typeMapping, chunk);
            case exports.RESP_TYPES.MAP:
                return this.#decodeMap(typeMapping, chunk);
            default:
                throw new Error(`Unknown RESP type ${type} "${String.fromCharCode(type)}"`);
        }
    }
    #decodeArray(typeMapping, chunk) {
        // RESP 2 null
        // https://github.com/redis/redis-specifications/blob/master/protocol/RESP2.md#resp-arrays
        if (chunk[this.#cursor] === ASCII['-']) {
            this.#cursor += 4; // skip -1\r\n
            return null;
        }
        return this.#decodeArrayWithLength(this.#decodeUnsingedNumber(0, chunk), typeMapping, chunk);
    }
    #decodeArrayWithLength(length, typeMapping, chunk) {
        return typeof length === 'function' ?
            this.#continueDecodeArrayLength.bind(this, length, typeMapping) :
            this.#decodeArrayItems(new Array(length), 0, typeMapping, chunk);
    }
    #continueDecodeArrayLength(lengthCb, typeMapping, chunk) {
        return this.#decodeArrayWithLength(lengthCb(chunk), typeMapping, chunk);
    }
    #decodeArrayItems(array, filled, typeMapping, chunk) {
        for (let i = filled; i < array.length; i++) {
            if (this.#cursor >= chunk.length) {
                return this.#decodeArrayItems.bind(this, array, i, typeMapping);
            }
            const item = this.#decodeNestedType(typeMapping, chunk);
            if (typeof item === 'function') {
                return this.#continueDecodeArrayItems.bind(this, array, i, item, typeMapping);
            }
            array[i] = item;
        }
        return array;
    }
    #continueDecodeArrayItems(array, filled, itemCb, typeMapping, chunk) {
        const item = itemCb(chunk);
        if (typeof item === 'function') {
            return this.#continueDecodeArrayItems.bind(this, array, filled, item, typeMapping);
        }
        array[filled++] = item;
        return this.#decodeArrayItems(array, filled, typeMapping, chunk);
    }
    #decodeSet(typeMapping, chunk) {
        const length = this.#decodeUnsingedNumber(0, chunk);
        if (typeof length === 'function') {
            return this.#continueDecodeSetLength.bind(this, length, typeMapping);
        }
        return this.#decodeSetItems(length, typeMapping, chunk);
    }
    #continueDecodeSetLength(lengthCb, typeMapping, chunk) {
        const length = lengthCb(chunk);
        return typeof length === 'function' ?
            this.#continueDecodeSetLength.bind(this, length, typeMapping) :
            this.#decodeSetItems(length, typeMapping, chunk);
    }
    #decodeSetItems(length, typeMapping, chunk) {
        return typeMapping[exports.RESP_TYPES.SET] === Set ?
            this.#decodeSetAsSet(new Set(), length, typeMapping, chunk) :
            this.#decodeArrayItems(new Array(length), 0, typeMapping, chunk);
    }
    #decodeSetAsSet(set, remaining, typeMapping, chunk) {
        // using `remaining` instead of `length` & `set.size` to make it work even if the set contains duplicates
        while (remaining > 0) {
            if (this.#cursor >= chunk.length) {
                return this.#decodeSetAsSet.bind(this, set, remaining, typeMapping);
            }
            const item = this.#decodeNestedType(typeMapping, chunk);
            if (typeof item === 'function') {
                return this.#continueDecodeSetAsSet.bind(this, set, remaining, item, typeMapping);
            }
            set.add(item);
            --remaining;
        }
        return set;
    }
    #continueDecodeSetAsSet(set, remaining, itemCb, typeMapping, chunk) {
        const item = itemCb(chunk);
        if (typeof item === 'function') {
            return this.#continueDecodeSetAsSet.bind(this, set, remaining, item, typeMapping);
        }
        set.add(item);
        return this.#decodeSetAsSet(set, remaining - 1, typeMapping, chunk);
    }
    #decodeMap(typeMapping, chunk) {
        const length = this.#decodeUnsingedNumber(0, chunk);
        if (typeof length === 'function') {
            return this.#continueDecodeMapLength.bind(this, length, typeMapping);
        }
        return this.#decodeMapItems(length, typeMapping, chunk);
    }
    #continueDecodeMapLength(lengthCb, typeMapping, chunk) {
        const length = lengthCb(chunk);
        return typeof length === 'function' ?
            this.#continueDecodeMapLength.bind(this, length, typeMapping) :
            this.#decodeMapItems(length, typeMapping, chunk);
    }
    #decodeMapItems(length, typeMapping, chunk) {
        switch (typeMapping[exports.RESP_TYPES.MAP]) {
            case Map:
                return this.#decodeMapAsMap(new Map(), length, typeMapping, chunk);
            case Array:
                return this.#decodeArrayItems(new Array(length * 2), 0, typeMapping, chunk);
            default:
                return this.#decodeMapAsObject(Object.create(null), length, typeMapping, chunk);
        }
    }
    #decodeMapAsMap(map, remaining, typeMapping, chunk) {
        // using `remaining` instead of `length` & `map.size` to make it work even if the map contains duplicate keys
        while (remaining > 0) {
            if (this.#cursor >= chunk.length) {
                return this.#decodeMapAsMap.bind(this, map, remaining, typeMapping);
            }
            const key = this.#decodeMapKey(typeMapping, chunk);
            if (typeof key === 'function') {
                return this.#continueDecodeMapKey.bind(this, map, remaining, key, typeMapping);
            }
            if (this.#cursor >= chunk.length) {
                return this.#continueDecodeMapValue.bind(this, map, remaining, key, this.#decodeNestedType.bind(this, typeMapping), typeMapping);
            }
            const value = this.#decodeNestedType(typeMapping, chunk);
            if (typeof value === 'function') {
                return this.#continueDecodeMapValue.bind(this, map, remaining, key, value, typeMapping);
            }
            map.set(key, value);
            --remaining;
        }
        return map;
    }
    #decodeMapKey(typeMapping, chunk) {
        const type = chunk[this.#cursor];
        return ++this.#cursor === chunk.length ?
            this.#decodeMapKeyValue.bind(this, type, typeMapping) :
            this.#decodeMapKeyValue(type, typeMapping, chunk);
    }
    #decodeMapKeyValue(type, typeMapping, chunk) {
        switch (type) {
            // decode simple string map key as string (and not as buffer)
            case exports.RESP_TYPES.SIMPLE_STRING:
                return this.#decodeSimpleString(String, chunk);
            // decode blob string map key as string (and not as buffer)
            case exports.RESP_TYPES.BLOB_STRING:
                return this.#decodeBlobString(String, chunk);
            default:
                return this.#decodeNestedTypeValue(type, typeMapping, chunk);
        }
    }
    #continueDecodeMapKey(map, remaining, keyCb, typeMapping, chunk) {
        const key = keyCb(chunk);
        if (typeof key === 'function') {
            return this.#continueDecodeMapKey.bind(this, map, remaining, key, typeMapping);
        }
        if (this.#cursor >= chunk.length) {
            return this.#continueDecodeMapValue.bind(this, map, remaining, key, this.#decodeNestedType.bind(this, typeMapping), typeMapping);
        }
        const value = this.#decodeNestedType(typeMapping, chunk);
        if (typeof value === 'function') {
            return this.#continueDecodeMapValue.bind(this, map, remaining, key, value, typeMapping);
        }
        map.set(key, value);
        return this.#decodeMapAsMap(map, remaining - 1, typeMapping, chunk);
    }
    #continueDecodeMapValue(map, remaining, key, valueCb, typeMapping, chunk) {
        const value = valueCb(chunk);
        if (typeof value === 'function') {
            return this.#continueDecodeMapValue.bind(this, map, remaining, key, value, typeMapping);
        }
        map.set(key, value);
        return this.#decodeMapAsMap(map, remaining - 1, typeMapping, chunk);
    }
    #decodeMapAsObject(object, remaining, typeMapping, chunk) {
        while (remaining > 0) {
            if (this.#cursor >= chunk.length) {
                return this.#decodeMapAsObject.bind(this, object, remaining, typeMapping);
            }
            const key = this.#decodeMapKey(typeMapping, chunk);
            if (typeof key === 'function') {
                return this.#continueDecodeMapAsObjectKey.bind(this, object, remaining, key, typeMapping);
            }
            if (this.#cursor >= chunk.length) {
                return this.#continueDecodeMapAsObjectValue.bind(this, object, remaining, key, this.#decodeNestedType.bind(this, typeMapping), typeMapping);
            }
            const value = this.#decodeNestedType(typeMapping, chunk);
            if (typeof value === 'function') {
                return this.#continueDecodeMapAsObjectValue.bind(this, object, remaining, key, value, typeMapping);
            }
            object[key] = value;
            --remaining;
        }
        return object;
    }
    #continueDecodeMapAsObjectKey(object, remaining, keyCb, typeMapping, chunk) {
        const key = keyCb(chunk);
        if (typeof key === 'function') {
            return this.#continueDecodeMapAsObjectKey.bind(this, object, remaining, key, typeMapping);
        }
        if (this.#cursor >= chunk.length) {
            return this.#continueDecodeMapAsObjectValue.bind(this, object, remaining, key, this.#decodeNestedType.bind(this, typeMapping), typeMapping);
        }
        const value = this.#decodeNestedType(typeMapping, chunk);
        if (typeof value === 'function') {
            return this.#continueDecodeMapAsObjectValue.bind(this, object, remaining, key, value, typeMapping);
        }
        object[key] = value;
        return this.#decodeMapAsObject(object, remaining - 1, typeMapping, chunk);
    }
    #continueDecodeMapAsObjectValue(object, remaining, key, valueCb, typeMapping, chunk) {
        const value = valueCb(chunk);
        if (typeof value === 'function') {
            return this.#continueDecodeMapAsObjectValue.bind(this, object, remaining, key, value, typeMapping);
        }
        object[key] = value;
        return this.#decodeMapAsObject(object, remaining - 1, typeMapping, chunk);
    }
}
exports.Decoder = Decoder;
_a = Decoder;
//# sourceMappingURL=decoder.js.map
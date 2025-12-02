"use strict";
// Copyright 2021-2025 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromBinary = fromBinary;
exports.mergeFromBinary = mergeFromBinary;
exports.readField = readField;
const descriptors_js_1 = require("./descriptors.js");
const scalar_js_1 = require("./reflect/scalar.js");
const reflect_js_1 = require("./reflect/reflect.js");
const binary_encoding_js_1 = require("./wire/binary-encoding.js");
const varint_js_1 = require("./wire/varint.js");
// Default options for parsing binary data.
const readDefaults = {
    readUnknownFields: true,
};
function makeReadOptions(options) {
    return options ? Object.assign(Object.assign({}, readDefaults), options) : readDefaults;
}
/**
 * Parse serialized binary data.
 */
function fromBinary(schema, bytes, options) {
    const msg = (0, reflect_js_1.reflect)(schema, undefined, false);
    readMessage(msg, new binary_encoding_js_1.BinaryReader(bytes), makeReadOptions(options), false, bytes.byteLength);
    return msg.message;
}
/**
 * Parse from binary data, merging fields.
 *
 * Repeated fields are appended. Map entries are added, overwriting
 * existing keys.
 *
 * If a message field is already present, it will be merged with the
 * new data.
 */
function mergeFromBinary(schema, target, bytes, options) {
    readMessage((0, reflect_js_1.reflect)(schema, target, false), new binary_encoding_js_1.BinaryReader(bytes), makeReadOptions(options), false, bytes.byteLength);
    return target;
}
/**
 * If `delimited` is false, read the length given in `lengthOrDelimitedFieldNo`.
 *
 * If `delimited` is true, read until an EndGroup tag. `lengthOrDelimitedFieldNo`
 * is the expected field number.
 *
 * @private
 */
function readMessage(message, reader, options, delimited, lengthOrDelimitedFieldNo) {
    var _a;
    const end = delimited ? reader.len : reader.pos + lengthOrDelimitedFieldNo;
    let fieldNo;
    let wireType;
    const unknownFields = (_a = message.getUnknown()) !== null && _a !== void 0 ? _a : [];
    while (reader.pos < end) {
        [fieldNo, wireType] = reader.tag();
        if (delimited && wireType == binary_encoding_js_1.WireType.EndGroup) {
            break;
        }
        const field = message.findNumber(fieldNo);
        if (!field) {
            const data = reader.skip(wireType, fieldNo);
            if (options.readUnknownFields) {
                unknownFields.push({ no: fieldNo, wireType, data });
            }
            continue;
        }
        readField(message, reader, field, wireType, options);
    }
    if (delimited) {
        if (wireType != binary_encoding_js_1.WireType.EndGroup || fieldNo !== lengthOrDelimitedFieldNo) {
            throw new Error("invalid end group tag");
        }
    }
    if (unknownFields.length > 0) {
        message.setUnknown(unknownFields);
    }
}
/**
 * @private
 */
function readField(message, reader, field, wireType, options) {
    var _a;
    switch (field.fieldKind) {
        case "scalar":
            message.set(field, readScalar(reader, field.scalar));
            break;
        case "enum":
            const val = readScalar(reader, descriptors_js_1.ScalarType.INT32);
            if (field.enum.open) {
                message.set(field, val);
            }
            else {
                const ok = field.enum.values.some((v) => v.number === val);
                if (ok) {
                    message.set(field, val);
                }
                else if (options.readUnknownFields) {
                    const bytes = [];
                    (0, varint_js_1.varint32write)(val, bytes);
                    const unknownFields = (_a = message.getUnknown()) !== null && _a !== void 0 ? _a : [];
                    unknownFields.push({
                        no: field.number,
                        wireType,
                        data: new Uint8Array(bytes),
                    });
                    message.setUnknown(unknownFields);
                }
            }
            break;
        case "message":
            message.set(field, readMessageField(reader, options, field, message.get(field)));
            break;
        case "list":
            readListField(reader, wireType, message.get(field), options);
            break;
        case "map":
            readMapEntry(reader, message.get(field), options);
            break;
    }
}
// Read a map field, expecting key field = 1, value field = 2
function readMapEntry(reader, map, options) {
    const field = map.field();
    let key;
    let val;
    // Read the length of the map entry, which is a varint.
    const len = reader.uint32();
    // WARNING: Calculate end AFTER advancing reader.pos (above), so that
    //          reader.pos is at the start of the map entry.
    const end = reader.pos + len;
    while (reader.pos < end) {
        const [fieldNo] = reader.tag();
        switch (fieldNo) {
            case 1:
                key = readScalar(reader, field.mapKey);
                break;
            case 2:
                switch (field.mapKind) {
                    case "scalar":
                        val = readScalar(reader, field.scalar);
                        break;
                    case "enum":
                        val = reader.int32();
                        break;
                    case "message":
                        val = readMessageField(reader, options, field);
                        break;
                }
                break;
        }
    }
    if (key === undefined) {
        key = (0, scalar_js_1.scalarZeroValue)(field.mapKey, false);
    }
    if (val === undefined) {
        switch (field.mapKind) {
            case "scalar":
                val = (0, scalar_js_1.scalarZeroValue)(field.scalar, false);
                break;
            case "enum":
                val = field.enum.values[0].number;
                break;
            case "message":
                val = (0, reflect_js_1.reflect)(field.message, undefined, false);
                break;
        }
    }
    map.set(key, val);
}
function readListField(reader, wireType, list, options) {
    var _a;
    const field = list.field();
    if (field.listKind === "message") {
        list.add(readMessageField(reader, options, field));
        return;
    }
    const scalarType = (_a = field.scalar) !== null && _a !== void 0 ? _a : descriptors_js_1.ScalarType.INT32;
    const packed = wireType == binary_encoding_js_1.WireType.LengthDelimited &&
        scalarType != descriptors_js_1.ScalarType.STRING &&
        scalarType != descriptors_js_1.ScalarType.BYTES;
    if (!packed) {
        list.add(readScalar(reader, scalarType));
        return;
    }
    const e = reader.uint32() + reader.pos;
    while (reader.pos < e) {
        list.add(readScalar(reader, scalarType));
    }
}
function readMessageField(reader, options, field, mergeMessage) {
    const delimited = field.delimitedEncoding;
    const message = mergeMessage !== null && mergeMessage !== void 0 ? mergeMessage : (0, reflect_js_1.reflect)(field.message, undefined, false);
    readMessage(message, reader, options, delimited, delimited ? field.number : reader.uint32());
    return message;
}
function readScalar(reader, type) {
    switch (type) {
        case descriptors_js_1.ScalarType.STRING:
            return reader.string();
        case descriptors_js_1.ScalarType.BOOL:
            return reader.bool();
        case descriptors_js_1.ScalarType.DOUBLE:
            return reader.double();
        case descriptors_js_1.ScalarType.FLOAT:
            return reader.float();
        case descriptors_js_1.ScalarType.INT32:
            return reader.int32();
        case descriptors_js_1.ScalarType.INT64:
            return reader.int64();
        case descriptors_js_1.ScalarType.UINT64:
            return reader.uint64();
        case descriptors_js_1.ScalarType.FIXED64:
            return reader.fixed64();
        case descriptors_js_1.ScalarType.BYTES:
            return reader.bytes();
        case descriptors_js_1.ScalarType.FIXED32:
            return reader.fixed32();
        case descriptors_js_1.ScalarType.SFIXED32:
            return reader.sfixed32();
        case descriptors_js_1.ScalarType.SFIXED64:
            return reader.sfixed64();
        case descriptors_js_1.ScalarType.SINT64:
            return reader.sint64();
        case descriptors_js_1.ScalarType.UINT32:
            return reader.uint32();
        case descriptors_js_1.ScalarType.SINT32:
            return reader.sint32();
    }
}

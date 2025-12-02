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
import { ScalarType } from "./descriptors.js";
import { scalarZeroValue } from "./reflect/scalar.js";
import { reflect } from "./reflect/reflect.js";
import { BinaryReader, WireType } from "./wire/binary-encoding.js";
import { varint32write } from "./wire/varint.js";
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
export function fromBinary(schema, bytes, options) {
    const msg = reflect(schema, undefined, false);
    readMessage(msg, new BinaryReader(bytes), makeReadOptions(options), false, bytes.byteLength);
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
export function mergeFromBinary(schema, target, bytes, options) {
    readMessage(reflect(schema, target, false), new BinaryReader(bytes), makeReadOptions(options), false, bytes.byteLength);
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
        if (delimited && wireType == WireType.EndGroup) {
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
        if (wireType != WireType.EndGroup || fieldNo !== lengthOrDelimitedFieldNo) {
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
export function readField(message, reader, field, wireType, options) {
    var _a;
    switch (field.fieldKind) {
        case "scalar":
            message.set(field, readScalar(reader, field.scalar));
            break;
        case "enum":
            const val = readScalar(reader, ScalarType.INT32);
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
                    varint32write(val, bytes);
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
        key = scalarZeroValue(field.mapKey, false);
    }
    if (val === undefined) {
        switch (field.mapKind) {
            case "scalar":
                val = scalarZeroValue(field.scalar, false);
                break;
            case "enum":
                val = field.enum.values[0].number;
                break;
            case "message":
                val = reflect(field.message, undefined, false);
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
    const scalarType = (_a = field.scalar) !== null && _a !== void 0 ? _a : ScalarType.INT32;
    const packed = wireType == WireType.LengthDelimited &&
        scalarType != ScalarType.STRING &&
        scalarType != ScalarType.BYTES;
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
    const message = mergeMessage !== null && mergeMessage !== void 0 ? mergeMessage : reflect(field.message, undefined, false);
    readMessage(message, reader, options, delimited, delimited ? field.number : reader.uint32());
    return message;
}
function readScalar(reader, type) {
    switch (type) {
        case ScalarType.STRING:
            return reader.string();
        case ScalarType.BOOL:
            return reader.bool();
        case ScalarType.DOUBLE:
            return reader.double();
        case ScalarType.FLOAT:
            return reader.float();
        case ScalarType.INT32:
            return reader.int32();
        case ScalarType.INT64:
            return reader.int64();
        case ScalarType.UINT64:
            return reader.uint64();
        case ScalarType.FIXED64:
            return reader.fixed64();
        case ScalarType.BYTES:
            return reader.bytes();
        case ScalarType.FIXED32:
            return reader.fixed32();
        case ScalarType.SFIXED32:
            return reader.sfixed32();
        case ScalarType.SFIXED64:
            return reader.sfixed64();
        case ScalarType.SINT64:
            return reader.sint64();
        case ScalarType.UINT32:
            return reader.uint32();
        case ScalarType.SINT32:
            return reader.sint32();
    }
}

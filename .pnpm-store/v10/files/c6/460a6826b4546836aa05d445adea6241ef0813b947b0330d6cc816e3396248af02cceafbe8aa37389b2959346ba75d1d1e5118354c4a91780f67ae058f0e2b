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
exports.toBinary = toBinary;
exports.writeField = writeField;
const reflect_js_1 = require("./reflect/reflect.js");
const binary_encoding_js_1 = require("./wire/binary-encoding.js");
const descriptors_js_1 = require("./descriptors.js");
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.LEGACY_REQUIRED: const $name: FeatureSet_FieldPresence.$localName = $number;
const LEGACY_REQUIRED = 3;
// Default options for serializing binary data.
const writeDefaults = {
    writeUnknownFields: true,
};
function makeWriteOptions(options) {
    return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
}
function toBinary(schema, message, options) {
    return writeFields(new binary_encoding_js_1.BinaryWriter(), makeWriteOptions(options), (0, reflect_js_1.reflect)(schema, message)).finish();
}
function writeFields(writer, opts, msg) {
    var _a;
    for (const f of msg.sortedFields) {
        if (!msg.isSet(f)) {
            if (f.presence == LEGACY_REQUIRED) {
                throw new Error(`cannot encode ${f} to binary: required field not set`);
            }
            continue;
        }
        writeField(writer, opts, msg, f);
    }
    if (opts.writeUnknownFields) {
        for (const { no, wireType, data } of (_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : []) {
            writer.tag(no, wireType).raw(data);
        }
    }
    return writer;
}
/**
 * @private
 */
function writeField(writer, opts, msg, field) {
    var _a;
    switch (field.fieldKind) {
        case "scalar":
        case "enum":
            writeScalar(writer, msg.desc.typeName, field.name, (_a = field.scalar) !== null && _a !== void 0 ? _a : descriptors_js_1.ScalarType.INT32, field.number, msg.get(field));
            break;
        case "list":
            writeListField(writer, opts, field, msg.get(field));
            break;
        case "message":
            writeMessageField(writer, opts, field, msg.get(field));
            break;
        case "map":
            for (const [key, val] of msg.get(field)) {
                writeMapEntry(writer, opts, field, key, val);
            }
            break;
    }
}
function writeScalar(writer, msgName, fieldName, scalarType, fieldNo, value) {
    writeScalarValue(writer.tag(fieldNo, writeTypeOfScalar(scalarType)), msgName, fieldName, scalarType, value);
}
function writeMessageField(writer, opts, field, message) {
    if (field.delimitedEncoding) {
        writeFields(writer.tag(field.number, binary_encoding_js_1.WireType.StartGroup), opts, message).tag(field.number, binary_encoding_js_1.WireType.EndGroup);
    }
    else {
        writeFields(writer.tag(field.number, binary_encoding_js_1.WireType.LengthDelimited).fork(), opts, message).join();
    }
}
function writeListField(writer, opts, field, list) {
    var _a;
    if (field.listKind == "message") {
        for (const item of list) {
            writeMessageField(writer, opts, field, item);
        }
        return;
    }
    const scalarType = (_a = field.scalar) !== null && _a !== void 0 ? _a : descriptors_js_1.ScalarType.INT32;
    if (field.packed) {
        if (!list.size) {
            return;
        }
        writer.tag(field.number, binary_encoding_js_1.WireType.LengthDelimited).fork();
        for (const item of list) {
            writeScalarValue(writer, field.parent.typeName, field.name, scalarType, item);
        }
        writer.join();
        return;
    }
    for (const item of list) {
        writeScalar(writer, field.parent.typeName, field.name, scalarType, field.number, item);
    }
}
function writeMapEntry(writer, opts, field, key, value) {
    var _a;
    writer.tag(field.number, binary_encoding_js_1.WireType.LengthDelimited).fork();
    // write key, expecting key field number = 1
    writeScalar(writer, field.parent.typeName, field.name, field.mapKey, 1, key);
    // write value, expecting value field number = 2
    switch (field.mapKind) {
        case "scalar":
        case "enum":
            writeScalar(writer, field.parent.typeName, field.name, (_a = field.scalar) !== null && _a !== void 0 ? _a : descriptors_js_1.ScalarType.INT32, 2, value);
            break;
        case "message":
            writeFields(writer.tag(2, binary_encoding_js_1.WireType.LengthDelimited).fork(), opts, value).join();
            break;
    }
    writer.join();
}
function writeScalarValue(writer, msgName, fieldName, type, value) {
    try {
        switch (type) {
            case descriptors_js_1.ScalarType.STRING:
                writer.string(value);
                break;
            case descriptors_js_1.ScalarType.BOOL:
                writer.bool(value);
                break;
            case descriptors_js_1.ScalarType.DOUBLE:
                writer.double(value);
                break;
            case descriptors_js_1.ScalarType.FLOAT:
                writer.float(value);
                break;
            case descriptors_js_1.ScalarType.INT32:
                writer.int32(value);
                break;
            case descriptors_js_1.ScalarType.INT64:
                writer.int64(value);
                break;
            case descriptors_js_1.ScalarType.UINT64:
                writer.uint64(value);
                break;
            case descriptors_js_1.ScalarType.FIXED64:
                writer.fixed64(value);
                break;
            case descriptors_js_1.ScalarType.BYTES:
                writer.bytes(value);
                break;
            case descriptors_js_1.ScalarType.FIXED32:
                writer.fixed32(value);
                break;
            case descriptors_js_1.ScalarType.SFIXED32:
                writer.sfixed32(value);
                break;
            case descriptors_js_1.ScalarType.SFIXED64:
                writer.sfixed64(value);
                break;
            case descriptors_js_1.ScalarType.SINT64:
                writer.sint64(value);
                break;
            case descriptors_js_1.ScalarType.UINT32:
                writer.uint32(value);
                break;
            case descriptors_js_1.ScalarType.SINT32:
                writer.sint32(value);
                break;
        }
    }
    catch (e) {
        if (e instanceof Error) {
            throw new Error(`cannot encode field ${msgName}.${fieldName} to binary: ${e.message}`);
        }
        throw e;
    }
}
function writeTypeOfScalar(type) {
    switch (type) {
        case descriptors_js_1.ScalarType.BYTES:
        case descriptors_js_1.ScalarType.STRING:
            return binary_encoding_js_1.WireType.LengthDelimited;
        case descriptors_js_1.ScalarType.DOUBLE:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.SFIXED64:
            return binary_encoding_js_1.WireType.Bit64;
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.FLOAT:
            return binary_encoding_js_1.WireType.Bit32;
        default:
            return binary_encoding_js_1.WireType.Varint;
    }
}

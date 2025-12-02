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
exports.toJson = toJson;
exports.toJsonString = toJsonString;
exports.enumToJson = enumToJson;
const descriptors_js_1 = require("./descriptors.js");
const names_js_1 = require("./reflect/names.js");
const reflect_js_1 = require("./reflect/reflect.js");
const index_js_1 = require("./wkt/index.js");
const wrappers_js_1 = require("./wkt/wrappers.js");
const index_js_2 = require("./wire/index.js");
const extensions_js_1 = require("./extensions.js");
const reflect_check_js_1 = require("./reflect/reflect-check.js");
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.LEGACY_REQUIRED: const $name: FeatureSet_FieldPresence.$localName = $number;
const LEGACY_REQUIRED = 3;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.IMPLICIT: const $name: FeatureSet_FieldPresence.$localName = $number;
const IMPLICIT = 2;
// Default options for serializing to JSON.
const jsonWriteDefaults = {
    alwaysEmitImplicit: false,
    enumAsInteger: false,
    useProtoFieldName: false,
};
function makeWriteOptions(options) {
    return options ? Object.assign(Object.assign({}, jsonWriteDefaults), options) : jsonWriteDefaults;
}
/**
 * Serialize the message to a JSON value, a JavaScript value that can be
 * passed to JSON.stringify().
 */
function toJson(schema, message, options) {
    return reflectToJson((0, reflect_js_1.reflect)(schema, message), makeWriteOptions(options));
}
/**
 * Serialize the message to a JSON string.
 */
function toJsonString(schema, message, options) {
    var _a;
    const jsonValue = toJson(schema, message, options);
    return JSON.stringify(jsonValue, null, (_a = options === null || options === void 0 ? void 0 : options.prettySpaces) !== null && _a !== void 0 ? _a : 0);
}
/**
 * Serialize a single enum value to JSON.
 */
function enumToJson(descEnum, value) {
    var _a;
    if (descEnum.typeName == "google.protobuf.NullValue") {
        return null;
    }
    const name = (_a = descEnum.value[value]) === null || _a === void 0 ? void 0 : _a.name;
    if (name === undefined) {
        throw new Error(`${value} is not a value in ${descEnum}`);
    }
    return name;
}
function reflectToJson(msg, opts) {
    var _a;
    const wktJson = tryWktToJson(msg, opts);
    if (wktJson !== undefined)
        return wktJson;
    const json = {};
    for (const f of msg.sortedFields) {
        if (!msg.isSet(f)) {
            if (f.presence == LEGACY_REQUIRED) {
                throw new Error(`cannot encode ${f} to JSON: required field not set`);
            }
            if (!opts.alwaysEmitImplicit || f.presence !== IMPLICIT) {
                // Fields with implicit presence omit zero values (e.g. empty string) by default
                continue;
            }
        }
        const jsonValue = fieldToJson(f, msg.get(f), opts);
        if (jsonValue !== undefined) {
            json[jsonName(f, opts)] = jsonValue;
        }
    }
    if (opts.registry) {
        const tagSeen = new Set();
        for (const { no } of (_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : []) {
            // Same tag can appear multiple times, so we
            // keep track and skip identical ones.
            if (!tagSeen.has(no)) {
                tagSeen.add(no);
                const extension = opts.registry.getExtensionFor(msg.desc, no);
                if (!extension) {
                    continue;
                }
                const value = (0, extensions_js_1.getExtension)(msg.message, extension);
                const [container, field] = (0, extensions_js_1.createExtensionContainer)(extension, value);
                const jsonValue = fieldToJson(field, container.get(field), opts);
                if (jsonValue !== undefined) {
                    json[extension.jsonName] = jsonValue;
                }
            }
        }
    }
    return json;
}
function fieldToJson(f, val, opts) {
    switch (f.fieldKind) {
        case "scalar":
            return scalarToJson(f, val);
        case "message":
            return reflectToJson(val, opts);
        case "enum":
            return enumToJsonInternal(f.enum, val, opts.enumAsInteger);
        case "list":
            return listToJson(val, opts);
        case "map":
            return mapToJson(val, opts);
    }
}
function mapToJson(map, opts) {
    const f = map.field();
    const jsonObj = {};
    switch (f.mapKind) {
        case "scalar":
            for (const [entryKey, entryValue] of map) {
                jsonObj[entryKey] = scalarToJson(f, entryValue);
            }
            break;
        case "message":
            for (const [entryKey, entryValue] of map) {
                jsonObj[entryKey] = reflectToJson(entryValue, opts);
            }
            break;
        case "enum":
            for (const [entryKey, entryValue] of map) {
                jsonObj[entryKey] = enumToJsonInternal(f.enum, entryValue, opts.enumAsInteger);
            }
            break;
    }
    return opts.alwaysEmitImplicit || map.size > 0 ? jsonObj : undefined;
}
function listToJson(list, opts) {
    const f = list.field();
    const jsonArr = [];
    switch (f.listKind) {
        case "scalar":
            for (const item of list) {
                jsonArr.push(scalarToJson(f, item));
            }
            break;
        case "enum":
            for (const item of list) {
                jsonArr.push(enumToJsonInternal(f.enum, item, opts.enumAsInteger));
            }
            break;
        case "message":
            for (const item of list) {
                jsonArr.push(reflectToJson(item, opts));
            }
            break;
    }
    return opts.alwaysEmitImplicit || jsonArr.length > 0 ? jsonArr : undefined;
}
function enumToJsonInternal(desc, value, enumAsInteger) {
    var _a;
    if (typeof value != "number") {
        throw new Error(`cannot encode ${desc} to JSON: expected number, got ${(0, reflect_check_js_1.formatVal)(value)}`);
    }
    if (desc.typeName == "google.protobuf.NullValue") {
        return null;
    }
    if (enumAsInteger) {
        return value;
    }
    const val = desc.value[value];
    return (_a = val === null || val === void 0 ? void 0 : val.name) !== null && _a !== void 0 ? _a : value; // if we don't know the enum value, just return the number
}
function scalarToJson(field, value) {
    var _a, _b, _c, _d, _e, _f;
    switch (field.scalar) {
        // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
            if (typeof value != "number") {
                throw new Error(`cannot encode ${field} to JSON: ${(_a = (0, reflect_check_js_1.checkField)(field, value)) === null || _a === void 0 ? void 0 : _a.message}`);
            }
            return value;
        // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
        // Either numbers or strings are accepted. Exponent notation is also accepted.
        case descriptors_js_1.ScalarType.FLOAT:
        case descriptors_js_1.ScalarType.DOUBLE: // eslint-disable-line no-fallthrough
            if (typeof value != "number") {
                throw new Error(`cannot encode ${field} to JSON: ${(_b = (0, reflect_check_js_1.checkField)(field, value)) === null || _b === void 0 ? void 0 : _b.message}`);
            }
            if (Number.isNaN(value))
                return "NaN";
            if (value === Number.POSITIVE_INFINITY)
                return "Infinity";
            if (value === Number.NEGATIVE_INFINITY)
                return "-Infinity";
            return value;
        // string:
        case descriptors_js_1.ScalarType.STRING:
            if (typeof value != "string") {
                throw new Error(`cannot encode ${field} to JSON: ${(_c = (0, reflect_check_js_1.checkField)(field, value)) === null || _c === void 0 ? void 0 : _c.message}`);
            }
            return value;
        // bool:
        case descriptors_js_1.ScalarType.BOOL:
            if (typeof value != "boolean") {
                throw new Error(`cannot encode ${field} to JSON: ${(_d = (0, reflect_check_js_1.checkField)(field, value)) === null || _d === void 0 ? void 0 : _d.message}`);
            }
            return value;
        // JSON value will be a decimal string. Either numbers or strings are accepted.
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
            if (typeof value != "bigint" && typeof value != "string") {
                throw new Error(`cannot encode ${field} to JSON: ${(_e = (0, reflect_check_js_1.checkField)(field, value)) === null || _e === void 0 ? void 0 : _e.message}`);
            }
            return value.toString();
        // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
        // Either standard or URL-safe base64 encoding with/without paddings are accepted.
        case descriptors_js_1.ScalarType.BYTES:
            if (value instanceof Uint8Array) {
                return (0, index_js_2.base64Encode)(value);
            }
            throw new Error(`cannot encode ${field} to JSON: ${(_f = (0, reflect_check_js_1.checkField)(field, value)) === null || _f === void 0 ? void 0 : _f.message}`);
    }
}
function jsonName(f, opts) {
    return opts.useProtoFieldName ? f.name : f.jsonName;
}
// returns a json value if wkt, otherwise returns undefined.
function tryWktToJson(msg, opts) {
    if (!msg.desc.typeName.startsWith("google.protobuf.")) {
        return undefined;
    }
    switch (msg.desc.typeName) {
        case "google.protobuf.Any":
            return anyToJson(msg.message, opts);
        case "google.protobuf.Timestamp":
            return timestampToJson(msg.message);
        case "google.protobuf.Duration":
            return durationToJson(msg.message);
        case "google.protobuf.FieldMask":
            return fieldMaskToJson(msg.message);
        case "google.protobuf.Struct":
            return structToJson(msg.message);
        case "google.protobuf.Value":
            return valueToJson(msg.message);
        case "google.protobuf.ListValue":
            return listValueToJson(msg.message);
        default:
            if ((0, wrappers_js_1.isWrapperDesc)(msg.desc)) {
                const valueField = msg.desc.fields[0];
                return scalarToJson(valueField, msg.get(valueField));
            }
            return undefined;
    }
}
function anyToJson(val, opts) {
    if (val.typeUrl === "") {
        return {};
    }
    const { registry } = opts;
    let message;
    let desc;
    if (registry) {
        message = (0, index_js_1.anyUnpack)(val, registry);
        if (message) {
            desc = registry.getMessage(message.$typeName);
        }
    }
    if (!desc || !message) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: "${val.typeUrl}" is not in the type registry`);
    }
    let json = reflectToJson((0, reflect_js_1.reflect)(desc, message), opts);
    if (desc.typeName.startsWith("google.protobuf.") ||
        json === null ||
        Array.isArray(json) ||
        typeof json !== "object") {
        json = { value: json };
    }
    json["@type"] = val.typeUrl;
    return json;
}
function durationToJson(val) {
    const seconds = Number(val.seconds);
    const nanos = val.nanos;
    if (seconds > 315576000000 || seconds < -315576000000) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: value out of range`);
    }
    if ((seconds > 0 && nanos < 0) || (seconds < 0 && nanos > 0)) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos sign must match seconds sign`);
    }
    let text = val.seconds.toString();
    if (nanos !== 0) {
        let nanosStr = Math.abs(nanos).toString();
        nanosStr = "0".repeat(9 - nanosStr.length) + nanosStr;
        if (nanosStr.substring(3) === "000000") {
            nanosStr = nanosStr.substring(0, 3);
        }
        else if (nanosStr.substring(6) === "000") {
            nanosStr = nanosStr.substring(0, 6);
        }
        text += "." + nanosStr;
        if (nanos < 0 && seconds == 0) {
            text = "-" + text;
        }
    }
    return text + "s";
}
function fieldMaskToJson(val) {
    return val.paths
        .map((p) => {
        if (p.match(/_[0-9]?_/g) || p.match(/[A-Z]/g)) {
            throw new Error(`cannot encode message ${val.$typeName} to JSON: lowerCamelCase of path name "` +
                p +
                '" is irreversible');
        }
        return (0, names_js_1.protoCamelCase)(p);
    })
        .join(",");
}
function structToJson(val) {
    const json = {};
    for (const [k, v] of Object.entries(val.fields)) {
        json[k] = valueToJson(v);
    }
    return json;
}
function valueToJson(val) {
    switch (val.kind.case) {
        case "nullValue":
            return null;
        case "numberValue":
            if (!Number.isFinite(val.kind.value)) {
                throw new Error(`${val.$typeName} cannot be NaN or Infinity`);
            }
            return val.kind.value;
        case "boolValue":
            return val.kind.value;
        case "stringValue":
            return val.kind.value;
        case "structValue":
            return structToJson(val.kind.value);
        case "listValue":
            return listValueToJson(val.kind.value);
        default:
            throw new Error(`${val.$typeName} must have a value`);
    }
}
function listValueToJson(val) {
    return val.values.map(valueToJson);
}
function timestampToJson(val) {
    const ms = Number(val.seconds) * 1000;
    if (ms < Date.parse("0001-01-01T00:00:00Z") ||
        ms > Date.parse("9999-12-31T23:59:59Z")) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive`);
    }
    if (val.nanos < 0) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be negative`);
    }
    if (val.nanos > 999999999) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be greater than 99999999`);
    }
    let z = "Z";
    if (val.nanos > 0) {
        const nanosStr = (val.nanos + 1000000000).toString().substring(1);
        if (nanosStr.substring(3) === "000000") {
            z = "." + nanosStr.substring(0, 3) + "Z";
        }
        else if (nanosStr.substring(6) === "000") {
            z = "." + nanosStr.substring(0, 6) + "Z";
        }
        else {
            z = "." + nanosStr + "Z";
        }
    }
    return new Date(ms).toISOString().replace(".000Z", z);
}

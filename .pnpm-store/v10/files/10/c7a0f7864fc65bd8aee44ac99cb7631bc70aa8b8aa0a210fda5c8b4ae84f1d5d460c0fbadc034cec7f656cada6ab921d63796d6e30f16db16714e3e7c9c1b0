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
exports.checkField = checkField;
exports.checkListItem = checkListItem;
exports.checkMapEntry = checkMapEntry;
exports.formatVal = formatVal;
const descriptors_js_1 = require("../descriptors.js");
const is_message_js_1 = require("../is-message.js");
const error_js_1 = require("./error.js");
const guard_js_1 = require("./guard.js");
const binary_encoding_js_1 = require("../wire/binary-encoding.js");
const text_encoding_js_1 = require("../wire/text-encoding.js");
const proto_int64_js_1 = require("../proto-int64.js");
/**
 * Check whether the given field value is valid for the reflect API.
 */
function checkField(field, value) {
    const check = field.fieldKind == "list"
        ? (0, guard_js_1.isReflectList)(value, field)
        : field.fieldKind == "map"
            ? (0, guard_js_1.isReflectMap)(value, field)
            : checkSingular(field, value);
    if (check === true) {
        return undefined;
    }
    let reason;
    switch (field.fieldKind) {
        case "list":
            reason = `expected ${formatReflectList(field)}, got ${formatVal(value)}`;
            break;
        case "map":
            reason = `expected ${formatReflectMap(field)}, got ${formatVal(value)}`;
            break;
        default: {
            reason = reasonSingular(field, value, check);
        }
    }
    return new error_js_1.FieldError(field, reason);
}
/**
 * Check whether the given list item is valid for the reflect API.
 */
function checkListItem(field, index, value) {
    const check = checkSingular(field, value);
    if (check !== true) {
        return new error_js_1.FieldError(field, `list item #${index + 1}: ${reasonSingular(field, value, check)}`);
    }
    return undefined;
}
/**
 * Check whether the given map key and value are valid for the reflect API.
 */
function checkMapEntry(field, key, value) {
    const checkKey = checkScalarValue(key, field.mapKey);
    if (checkKey !== true) {
        return new error_js_1.FieldError(field, `invalid map key: ${reasonSingular({ scalar: field.mapKey }, key, checkKey)}`);
    }
    const checkVal = checkSingular(field, value);
    if (checkVal !== true) {
        return new error_js_1.FieldError(field, `map entry ${formatVal(key)}: ${reasonSingular(field, value, checkVal)}`);
    }
    return undefined;
}
function checkSingular(field, value) {
    if (field.scalar !== undefined) {
        return checkScalarValue(value, field.scalar);
    }
    if (field.enum !== undefined) {
        if (field.enum.open) {
            return Number.isInteger(value);
        }
        return field.enum.values.some((v) => v.number === value);
    }
    return (0, guard_js_1.isReflectMessage)(value, field.message);
}
function checkScalarValue(value, scalar) {
    switch (scalar) {
        case descriptors_js_1.ScalarType.DOUBLE:
            return typeof value == "number";
        case descriptors_js_1.ScalarType.FLOAT:
            if (typeof value != "number") {
                return false;
            }
            if (Number.isNaN(value) || !Number.isFinite(value)) {
                return true;
            }
            if (value > binary_encoding_js_1.FLOAT32_MAX || value < binary_encoding_js_1.FLOAT32_MIN) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
            // signed
            if (typeof value !== "number" || !Number.isInteger(value)) {
                return false;
            }
            if (value > binary_encoding_js_1.INT32_MAX || value < binary_encoding_js_1.INT32_MIN) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
            // unsigned
            if (typeof value !== "number" || !Number.isInteger(value)) {
                return false;
            }
            if (value > binary_encoding_js_1.UINT32_MAX || value < 0) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case descriptors_js_1.ScalarType.BOOL:
            return typeof value == "boolean";
        case descriptors_js_1.ScalarType.STRING:
            if (typeof value != "string") {
                return false;
            }
            return (0, text_encoding_js_1.getTextEncoding)().checkUtf8(value) || "invalid UTF8";
        case descriptors_js_1.ScalarType.BYTES:
            return value instanceof Uint8Array;
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
            // signed
            if (typeof value == "bigint" ||
                typeof value == "number" ||
                (typeof value == "string" && value.length > 0)) {
                try {
                    proto_int64_js_1.protoInt64.parse(value);
                    return true;
                }
                catch (_) {
                    return `${value} out of range`;
                }
            }
            return false;
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.UINT64:
            // unsigned
            if (typeof value == "bigint" ||
                typeof value == "number" ||
                (typeof value == "string" && value.length > 0)) {
                try {
                    proto_int64_js_1.protoInt64.uParse(value);
                    return true;
                }
                catch (_) {
                    return `${value} out of range`;
                }
            }
            return false;
    }
}
function reasonSingular(field, val, details) {
    details =
        typeof details == "string" ? `: ${details}` : `, got ${formatVal(val)}`;
    if (field.scalar !== undefined) {
        return `expected ${scalarTypeDescription(field.scalar)}` + details;
    }
    if (field.enum !== undefined) {
        return `expected ${field.enum.toString()}` + details;
    }
    return `expected ${formatReflectMessage(field.message)}` + details;
}
function formatVal(val) {
    switch (typeof val) {
        case "object":
            if (val === null) {
                return "null";
            }
            if (val instanceof Uint8Array) {
                return `Uint8Array(${val.length})`;
            }
            if (Array.isArray(val)) {
                return `Array(${val.length})`;
            }
            if ((0, guard_js_1.isReflectList)(val)) {
                return formatReflectList(val.field());
            }
            if ((0, guard_js_1.isReflectMap)(val)) {
                return formatReflectMap(val.field());
            }
            if ((0, guard_js_1.isReflectMessage)(val)) {
                return formatReflectMessage(val.desc);
            }
            if ((0, is_message_js_1.isMessage)(val)) {
                return `message ${val.$typeName}`;
            }
            return "object";
        case "string":
            return val.length > 30 ? "string" : `"${val.split('"').join('\\"')}"`;
        case "boolean":
            return String(val);
        case "number":
            return String(val);
        case "bigint":
            return String(val) + "n";
        default:
            // "symbol" | "undefined" | "object" | "function"
            return typeof val;
    }
}
function formatReflectMessage(desc) {
    return `ReflectMessage (${desc.typeName})`;
}
function formatReflectList(field) {
    switch (field.listKind) {
        case "message":
            return `ReflectList (${field.message.toString()})`;
        case "enum":
            return `ReflectList (${field.enum.toString()})`;
        case "scalar":
            return `ReflectList (${descriptors_js_1.ScalarType[field.scalar]})`;
    }
}
function formatReflectMap(field) {
    switch (field.mapKind) {
        case "message":
            return `ReflectMap (${descriptors_js_1.ScalarType[field.mapKey]}, ${field.message.toString()})`;
        case "enum":
            return `ReflectMap (${descriptors_js_1.ScalarType[field.mapKey]}, ${field.enum.toString()})`;
        case "scalar":
            return `ReflectMap (${descriptors_js_1.ScalarType[field.mapKey]}, ${descriptors_js_1.ScalarType[field.scalar]})`;
    }
}
function scalarTypeDescription(scalar) {
    switch (scalar) {
        case descriptors_js_1.ScalarType.STRING:
            return "string";
        case descriptors_js_1.ScalarType.BOOL:
            return "boolean";
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.SINT64:
        case descriptors_js_1.ScalarType.SFIXED64:
            return "bigint (int64)";
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.FIXED64:
            return "bigint (uint64)";
        case descriptors_js_1.ScalarType.BYTES:
            return "Uint8Array";
        case descriptors_js_1.ScalarType.DOUBLE:
            return "number (float64)";
        case descriptors_js_1.ScalarType.FLOAT:
            return "number (float32)";
        case descriptors_js_1.ScalarType.FIXED32:
        case descriptors_js_1.ScalarType.UINT32:
            return "number (uint32)";
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.SINT32:
            return "number (int32)";
    }
}

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
import { ScalarType, } from "../descriptors.js";
import { isMessage } from "../is-message.js";
import { FieldError } from "./error.js";
import { isReflectList, isReflectMap, isReflectMessage } from "./guard.js";
import { FLOAT32_MAX, FLOAT32_MIN, INT32_MAX, INT32_MIN, UINT32_MAX, } from "../wire/binary-encoding.js";
import { getTextEncoding } from "../wire/text-encoding.js";
import { protoInt64 } from "../proto-int64.js";
/**
 * Check whether the given field value is valid for the reflect API.
 */
export function checkField(field, value) {
    const check = field.fieldKind == "list"
        ? isReflectList(value, field)
        : field.fieldKind == "map"
            ? isReflectMap(value, field)
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
    return new FieldError(field, reason);
}
/**
 * Check whether the given list item is valid for the reflect API.
 */
export function checkListItem(field, index, value) {
    const check = checkSingular(field, value);
    if (check !== true) {
        return new FieldError(field, `list item #${index + 1}: ${reasonSingular(field, value, check)}`);
    }
    return undefined;
}
/**
 * Check whether the given map key and value are valid for the reflect API.
 */
export function checkMapEntry(field, key, value) {
    const checkKey = checkScalarValue(key, field.mapKey);
    if (checkKey !== true) {
        return new FieldError(field, `invalid map key: ${reasonSingular({ scalar: field.mapKey }, key, checkKey)}`);
    }
    const checkVal = checkSingular(field, value);
    if (checkVal !== true) {
        return new FieldError(field, `map entry ${formatVal(key)}: ${reasonSingular(field, value, checkVal)}`);
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
    return isReflectMessage(value, field.message);
}
function checkScalarValue(value, scalar) {
    switch (scalar) {
        case ScalarType.DOUBLE:
            return typeof value == "number";
        case ScalarType.FLOAT:
            if (typeof value != "number") {
                return false;
            }
            if (Number.isNaN(value) || !Number.isFinite(value)) {
                return true;
            }
            if (value > FLOAT32_MAX || value < FLOAT32_MIN) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case ScalarType.INT32:
        case ScalarType.SFIXED32:
        case ScalarType.SINT32:
            // signed
            if (typeof value !== "number" || !Number.isInteger(value)) {
                return false;
            }
            if (value > INT32_MAX || value < INT32_MIN) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case ScalarType.FIXED32:
        case ScalarType.UINT32:
            // unsigned
            if (typeof value !== "number" || !Number.isInteger(value)) {
                return false;
            }
            if (value > UINT32_MAX || value < 0) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case ScalarType.BOOL:
            return typeof value == "boolean";
        case ScalarType.STRING:
            if (typeof value != "string") {
                return false;
            }
            return getTextEncoding().checkUtf8(value) || "invalid UTF8";
        case ScalarType.BYTES:
            return value instanceof Uint8Array;
        case ScalarType.INT64:
        case ScalarType.SFIXED64:
        case ScalarType.SINT64:
            // signed
            if (typeof value == "bigint" ||
                typeof value == "number" ||
                (typeof value == "string" && value.length > 0)) {
                try {
                    protoInt64.parse(value);
                    return true;
                }
                catch (_) {
                    return `${value} out of range`;
                }
            }
            return false;
        case ScalarType.FIXED64:
        case ScalarType.UINT64:
            // unsigned
            if (typeof value == "bigint" ||
                typeof value == "number" ||
                (typeof value == "string" && value.length > 0)) {
                try {
                    protoInt64.uParse(value);
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
export function formatVal(val) {
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
            if (isReflectList(val)) {
                return formatReflectList(val.field());
            }
            if (isReflectMap(val)) {
                return formatReflectMap(val.field());
            }
            if (isReflectMessage(val)) {
                return formatReflectMessage(val.desc);
            }
            if (isMessage(val)) {
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
            return `ReflectList (${ScalarType[field.scalar]})`;
    }
}
function formatReflectMap(field) {
    switch (field.mapKind) {
        case "message":
            return `ReflectMap (${ScalarType[field.mapKey]}, ${field.message.toString()})`;
        case "enum":
            return `ReflectMap (${ScalarType[field.mapKey]}, ${field.enum.toString()})`;
        case "scalar":
            return `ReflectMap (${ScalarType[field.mapKey]}, ${ScalarType[field.scalar]})`;
    }
}
function scalarTypeDescription(scalar) {
    switch (scalar) {
        case ScalarType.STRING:
            return "string";
        case ScalarType.BOOL:
            return "boolean";
        case ScalarType.INT64:
        case ScalarType.SINT64:
        case ScalarType.SFIXED64:
            return "bigint (int64)";
        case ScalarType.UINT64:
        case ScalarType.FIXED64:
            return "bigint (uint64)";
        case ScalarType.BYTES:
            return "Uint8Array";
        case ScalarType.DOUBLE:
            return "number (float64)";
        case ScalarType.FLOAT:
            return "number (float32)";
        case ScalarType.FIXED32:
        case ScalarType.UINT32:
            return "number (uint32)";
        case ScalarType.INT32:
        case ScalarType.SFIXED32:
        case ScalarType.SINT32:
            return "number (int32)";
    }
}

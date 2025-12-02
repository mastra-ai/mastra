"use strict";
import * as Base64 from "./base64.js";
import { isSimpleObject } from "../common/index.js";
const LITTLE_ENDIAN = true;
const MIN_INT64 = BigInt("-9223372036854775808");
const MAX_INT64 = BigInt("9223372036854775807");
const ZERO = BigInt("0");
const EIGHT = BigInt("8");
const TWOFIFTYSIX = BigInt("256");
function isSpecial(n) {
  return Number.isNaN(n) || !Number.isFinite(n) || Object.is(n, -0);
}
export function slowBigIntToBase64(value) {
  if (value < ZERO) {
    value -= MIN_INT64 + MIN_INT64;
  }
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = "0" + hex;
  const bytes = new Uint8Array(new ArrayBuffer(8));
  let i = 0;
  for (const hexByte of hex.match(/.{2}/g).reverse()) {
    bytes.set([parseInt(hexByte, 16)], i++);
    value >>= EIGHT;
  }
  return Base64.fromByteArray(bytes);
}
export function slowBase64ToBigInt(encoded) {
  const integerBytes = Base64.toByteArray(encoded);
  if (integerBytes.byteLength !== 8) {
    throw new Error(
      `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`
    );
  }
  let value = ZERO;
  let power = ZERO;
  for (const byte of integerBytes) {
    value += BigInt(byte) * TWOFIFTYSIX ** power;
    power++;
  }
  if (value > MAX_INT64) {
    value += MIN_INT64 + MIN_INT64;
  }
  return value;
}
export function modernBigIntToBase64(value) {
  if (value < MIN_INT64 || MAX_INT64 < value) {
    throw new Error(
      `BigInt ${value} does not fit into a 64-bit signed integer.`
    );
  }
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigInt64(0, value, true);
  return Base64.fromByteArray(new Uint8Array(buffer));
}
export function modernBase64ToBigInt(encoded) {
  const integerBytes = Base64.toByteArray(encoded);
  if (integerBytes.byteLength !== 8) {
    throw new Error(
      `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`
    );
  }
  const intBytesView = new DataView(integerBytes.buffer);
  return intBytesView.getBigInt64(0, true);
}
export const bigIntToBase64 = DataView.prototype.setBigInt64 ? modernBigIntToBase64 : slowBigIntToBase64;
export const base64ToBigInt = DataView.prototype.getBigInt64 ? modernBase64ToBigInt : slowBase64ToBigInt;
const MAX_IDENTIFIER_LEN = 1024;
function validateObjectField(k) {
  if (k.length > MAX_IDENTIFIER_LEN) {
    throw new Error(
      `Field name ${k} exceeds maximum field name length ${MAX_IDENTIFIER_LEN}.`
    );
  }
  if (k.startsWith("$")) {
    throw new Error(`Field name ${k} starts with a '$', which is reserved.`);
  }
  for (let i = 0; i < k.length; i += 1) {
    const charCode = k.charCodeAt(i);
    if (charCode < 32 || charCode >= 127) {
      throw new Error(
        `Field name ${k} has invalid character '${k[i]}': Field names can only contain non-control ASCII characters`
      );
    }
  }
}
export function jsonToConvex(value) {
  if (value === null) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((value2) => jsonToConvex(value2));
  }
  if (typeof value !== "object") {
    throw new Error(`Unexpected type of ${value}`);
  }
  const entries = Object.entries(value);
  if (entries.length === 1) {
    const key = entries[0][0];
    if (key === "$bytes") {
      if (typeof value.$bytes !== "string") {
        throw new Error(`Malformed $bytes field on ${value}`);
      }
      return Base64.toByteArray(value.$bytes).buffer;
    }
    if (key === "$integer") {
      if (typeof value.$integer !== "string") {
        throw new Error(`Malformed $integer field on ${value}`);
      }
      return base64ToBigInt(value.$integer);
    }
    if (key === "$float") {
      if (typeof value.$float !== "string") {
        throw new Error(`Malformed $float field on ${value}`);
      }
      const floatBytes = Base64.toByteArray(value.$float);
      if (floatBytes.byteLength !== 8) {
        throw new Error(
          `Received ${floatBytes.byteLength} bytes, expected 8 for $float`
        );
      }
      const floatBytesView = new DataView(floatBytes.buffer);
      const float = floatBytesView.getFloat64(0, LITTLE_ENDIAN);
      if (!isSpecial(float)) {
        throw new Error(`Float ${float} should be encoded as a number`);
      }
      return float;
    }
    if (key === "$set") {
      throw new Error(
        `Received a Set which is no longer supported as a Convex type.`
      );
    }
    if (key === "$map") {
      throw new Error(
        `Received a Map which is no longer supported as a Convex type.`
      );
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    validateObjectField(k);
    out[k] = jsonToConvex(v);
  }
  return out;
}
const MAX_VALUE_FOR_ERROR_LEN = 16384;
export function stringifyValueForError(value) {
  const str = JSON.stringify(value, (_key, value2) => {
    if (value2 === void 0) {
      return "undefined";
    }
    if (typeof value2 === "bigint") {
      return `${value2.toString()}n`;
    }
    return value2;
  });
  if (str.length > MAX_VALUE_FOR_ERROR_LEN) {
    const rest = "[...truncated]";
    let truncateAt = MAX_VALUE_FOR_ERROR_LEN - rest.length;
    const codePoint = str.codePointAt(truncateAt - 1);
    if (codePoint !== void 0 && codePoint > 65535) {
      truncateAt -= 1;
    }
    return str.substring(0, truncateAt) + rest;
  }
  return str;
}
function convexToJsonInternal(value, originalValue, context, includeTopLevelUndefined) {
  if (value === void 0) {
    const contextText = context && ` (present at path ${context} in original object ${stringifyValueForError(
      originalValue
    )})`;
    throw new Error(
      `undefined is not a valid Convex value${contextText}. To learn about Convex's supported types, see https://docs.convex.dev/using/types.`
    );
  }
  if (value === null) {
    return value;
  }
  if (typeof value === "bigint") {
    if (value < MIN_INT64 || MAX_INT64 < value) {
      throw new Error(
        `BigInt ${value} does not fit into a 64-bit signed integer.`
      );
    }
    return { $integer: bigIntToBase64(value) };
  }
  if (typeof value === "number") {
    if (isSpecial(value)) {
      const buffer = new ArrayBuffer(8);
      new DataView(buffer).setFloat64(0, value, LITTLE_ENDIAN);
      return { $float: Base64.fromByteArray(new Uint8Array(buffer)) };
    } else {
      return value;
    }
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return { $bytes: Base64.fromByteArray(new Uint8Array(value)) };
  }
  if (Array.isArray(value)) {
    return value.map(
      (value2, i) => convexToJsonInternal(value2, originalValue, context + `[${i}]`, false)
    );
  }
  if (value instanceof Set) {
    throw new Error(
      errorMessageForUnsupportedType(context, "Set", [...value], originalValue)
    );
  }
  if (value instanceof Map) {
    throw new Error(
      errorMessageForUnsupportedType(context, "Map", [...value], originalValue)
    );
  }
  if (!isSimpleObject(value)) {
    const theType = value?.constructor?.name;
    const typeName = theType ? `${theType} ` : "";
    throw new Error(
      errorMessageForUnsupportedType(context, typeName, value, originalValue)
    );
  }
  const out = {};
  const entries = Object.entries(value);
  entries.sort(([k1, _v1], [k2, _v2]) => k1 === k2 ? 0 : k1 < k2 ? -1 : 1);
  for (const [k, v] of entries) {
    if (v !== void 0) {
      validateObjectField(k);
      out[k] = convexToJsonInternal(v, originalValue, context + `.${k}`, false);
    } else if (includeTopLevelUndefined) {
      validateObjectField(k);
      out[k] = convexOrUndefinedToJsonInternal(
        v,
        originalValue,
        context + `.${k}`
      );
    }
  }
  return out;
}
function errorMessageForUnsupportedType(context, typeName, value, originalValue) {
  if (context) {
    return `${typeName}${stringifyValueForError(
      value
    )} is not a supported Convex type (present at path ${context} in original object ${stringifyValueForError(
      originalValue
    )}). To learn about Convex's supported types, see https://docs.convex.dev/using/types.`;
  } else {
    return `${typeName}${stringifyValueForError(
      value
    )} is not a supported Convex type.`;
  }
}
function convexOrUndefinedToJsonInternal(value, originalValue, context) {
  if (value === void 0) {
    return { $undefined: null };
  } else {
    if (originalValue === void 0) {
      throw new Error(
        `Programming error. Current value is ${stringifyValueForError(
          value
        )} but original value is undefined`
      );
    }
    return convexToJsonInternal(value, originalValue, context, false);
  }
}
export function convexToJson(value) {
  return convexToJsonInternal(value, value, "", false);
}
export function convexOrUndefinedToJson(value) {
  return convexOrUndefinedToJsonInternal(value, value, "");
}
export function patchValueToJson(value) {
  return convexToJsonInternal(value, value, "", true);
}
//# sourceMappingURL=value.js.map

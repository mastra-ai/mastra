/**
 * Utilities for working with values stored in Convex.
 *
 * You can see the full set of supported types at
 * [Types](https://docs.convex.dev/using/types).
 * @module
 */
import * as Base64 from "./base64.js";
import { isSimpleObject } from "../common/index.js";

const LITTLE_ENDIAN = true;
// This code is used by code that may not have bigint literals.
const MIN_INT64 = BigInt("-9223372036854775808");
const MAX_INT64 = BigInt("9223372036854775807");
const ZERO = BigInt("0");
const EIGHT = BigInt("8");
const TWOFIFTYSIX = BigInt("256");

/**
 * The type of JavaScript values serializable to JSON.
 *
 * @public
 */
export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/database/document-ids).
 *
 * Documents can be loaded using `db.get(id)` in query and mutation functions.
 *
 * IDs are base 32 encoded strings which are URL safe.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings at compile time.
 *
 * If you're using code generation, use the `Id` type generated for your data model in
 * `convex/_generated/dataModel.d.ts`.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 *
 * @public
 */
export type Id<TableName extends string> = string & { __tableName: TableName };

/**
 * A value supported by Convex.
 *
 * Values can be:
 * - stored inside of documents.
 * - used as arguments and return types to queries and mutation functions.
 *
 * You can see the full set of supported types at
 * [Types](https://docs.convex.dev/using/types).
 *
 * @public
 */
export type Value =
  | null
  | bigint
  | number
  | boolean
  | string
  | ArrayBuffer
  | Value[]
  | { [key: string]: undefined | Value };

/**
 * The types of {@link Value} that can be used to represent numbers.
 *
 * @public
 */
export type NumericValue = bigint | number;

function isSpecial(n: number) {
  return Number.isNaN(n) || !Number.isFinite(n) || Object.is(n, -0);
}

export function slowBigIntToBase64(value: bigint): string {
  // the conversion is easy if we pretend it's unsigned
  if (value < ZERO) {
    value -= MIN_INT64 + MIN_INT64;
  }
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = "0" + hex;

  const bytes = new Uint8Array(new ArrayBuffer(8));
  let i = 0;
  for (const hexByte of hex.match(/.{2}/g)!.reverse()) {
    bytes.set([parseInt(hexByte, 16)], i++);
    value >>= EIGHT;
  }
  return Base64.fromByteArray(bytes);
}

export function slowBase64ToBigInt(encoded: string): bigint {
  const integerBytes = Base64.toByteArray(encoded);
  if (integerBytes.byteLength !== 8) {
    throw new Error(
      `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`,
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

export function modernBigIntToBase64(value: bigint): string {
  if (value < MIN_INT64 || MAX_INT64 < value) {
    throw new Error(
      `BigInt ${value} does not fit into a 64-bit signed integer.`,
    );
  }
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigInt64(0, value, true);
  return Base64.fromByteArray(new Uint8Array(buffer));
}

export function modernBase64ToBigInt(encoded: string): bigint {
  const integerBytes = Base64.toByteArray(encoded);
  if (integerBytes.byteLength !== 8) {
    throw new Error(
      `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`,
    );
  }
  const intBytesView = new DataView(integerBytes.buffer);
  return intBytesView.getBigInt64(0, true);
}

// Fall back to a slower version on Safari 14 which lacks these APIs.
export const bigIntToBase64 = (DataView.prototype as any).setBigInt64
  ? modernBigIntToBase64
  : slowBigIntToBase64;
export const base64ToBigInt = (DataView.prototype as any).getBigInt64
  ? modernBase64ToBigInt
  : slowBase64ToBigInt;

const MAX_IDENTIFIER_LEN = 1024;

function validateObjectField(k: string) {
  if (k.length > MAX_IDENTIFIER_LEN) {
    throw new Error(
      `Field name ${k} exceeds maximum field name length ${MAX_IDENTIFIER_LEN}.`,
    );
  }
  if (k.startsWith("$")) {
    throw new Error(`Field name ${k} starts with a '$', which is reserved.`);
  }
  for (let i = 0; i < k.length; i += 1) {
    const charCode = k.charCodeAt(i);
    // Non-control ASCII characters
    if (charCode < 32 || charCode >= 127) {
      throw new Error(
        `Field name ${k} has invalid character '${k[i]}': Field names can only contain non-control ASCII characters`,
      );
    }
  }
}

/**
 * Parse a Convex value from its JSON representation.
 *
 * This function will deserialize serialized Int64s to `BigInt`s, Bytes to `ArrayBuffer`s etc.
 *
 * To learn more about Convex values, see [Types](https://docs.convex.dev/using/types).
 *
 * @param value - The JSON representation of a Convex value previously created with {@link convexToJson}.
 * @returns The JavaScript representation of the Convex value.
 *
 * @public
 */
export function jsonToConvex(value: JSONValue): Value {
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
    return value.map((value) => jsonToConvex(value));
  }
  if (typeof value !== "object") {
    throw new Error(`Unexpected type of ${value as any}`);
  }
  const entries = Object.entries(value);
  if (entries.length === 1) {
    const key = entries[0][0];
    if (key === "$bytes") {
      if (typeof value.$bytes !== "string") {
        throw new Error(`Malformed $bytes field on ${value as any}`);
      }
      return Base64.toByteArray(value.$bytes).buffer;
    }
    if (key === "$integer") {
      if (typeof value.$integer !== "string") {
        throw new Error(`Malformed $integer field on ${value as any}`);
      }
      return base64ToBigInt(value.$integer);
    }
    if (key === "$float") {
      if (typeof value.$float !== "string") {
        throw new Error(`Malformed $float field on ${value as any}`);
      }
      const floatBytes = Base64.toByteArray(value.$float);
      if (floatBytes.byteLength !== 8) {
        throw new Error(
          `Received ${floatBytes.byteLength} bytes, expected 8 for $float`,
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
        `Received a Set which is no longer supported as a Convex type.`,
      );
    }
    if (key === "$map") {
      throw new Error(
        `Received a Map which is no longer supported as a Convex type.`,
      );
    }
  }
  const out: { [key: string]: Value } = {};
  for (const [k, v] of Object.entries(value)) {
    validateObjectField(k);
    out[k] = jsonToConvex(v);
  }
  return out;
}

const MAX_VALUE_FOR_ERROR_LEN = 16384;

export function stringifyValueForError(value: any) {
  const str = JSON.stringify(value, (_key, value) => {
    if (value === undefined) {
      // By default `JSON.stringify` converts undefined, functions, symbols,
      // Infinity, and NaN to null which produces a confusing error message.
      // We deal with `undefined` specifically because it's the most common.
      // Ideally we'd use a pretty-printing library that prints `undefined`
      // (no quotes), but it might not be worth the bundle size cost.
      return "undefined";
    }
    if (typeof value === "bigint") {
      // `JSON.stringify` throws on bigints by default.
      return `${value.toString()}n`;
    }
    return value;
  });
  if (str.length > MAX_VALUE_FOR_ERROR_LEN) {
    const rest = "[...truncated]";
    let truncateAt = MAX_VALUE_FOR_ERROR_LEN - rest.length;
    const codePoint = str.codePointAt(truncateAt - 1);
    if (codePoint !== undefined && codePoint > 0xffff) {
      // don't split a surrogate pair in half
      truncateAt -= 1;
    }
    return str.substring(0, truncateAt) + rest;
  }
  return str;
}

function convexToJsonInternal(
  value: Value,
  originalValue: Value,
  context: string,
  includeTopLevelUndefined: boolean,
): JSONValue {
  if (value === undefined) {
    const contextText =
      context &&
      ` (present at path ${context} in original object ${stringifyValueForError(
        originalValue,
      )})`;
    throw new Error(
      `undefined is not a valid Convex value${contextText}. To learn about Convex's supported types, see https://docs.convex.dev/using/types.`,
    );
  }
  if (value === null) {
    return value;
  }
  if (typeof value === "bigint") {
    if (value < MIN_INT64 || MAX_INT64 < value) {
      throw new Error(
        `BigInt ${value} does not fit into a 64-bit signed integer.`,
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
    return value.map((value, i) =>
      convexToJsonInternal(value, originalValue, context + `[${i}]`, false),
    );
  }
  if (value instanceof Set) {
    throw new Error(
      errorMessageForUnsupportedType(context, "Set", [...value], originalValue),
    );
  }
  if (value instanceof Map) {
    throw new Error(
      errorMessageForUnsupportedType(context, "Map", [...value], originalValue),
    );
  }

  if (!isSimpleObject(value)) {
    const theType = value?.constructor?.name;
    const typeName = theType ? `${theType} ` : "";
    throw new Error(
      errorMessageForUnsupportedType(context, typeName, value, originalValue),
    );
  }

  const out: { [key: string]: JSONValue } = {};
  const entries = Object.entries(value);
  entries.sort(([k1, _v1], [k2, _v2]) => (k1 === k2 ? 0 : k1 < k2 ? -1 : 1));
  for (const [k, v] of entries) {
    if (v !== undefined) {
      validateObjectField(k);
      out[k] = convexToJsonInternal(v, originalValue, context + `.${k}`, false);
    } else if (includeTopLevelUndefined) {
      validateObjectField(k);
      out[k] = convexOrUndefinedToJsonInternal(
        v,
        originalValue,
        context + `.${k}`,
      );
    }
  }
  return out;
}

function errorMessageForUnsupportedType(
  context: string,
  typeName: string,
  value: any,
  originalValue: any,
) {
  if (context) {
    return `${typeName}${stringifyValueForError(
      value,
    )} is not a supported Convex type (present at path ${context} in original object ${stringifyValueForError(
      originalValue,
    )}). To learn about Convex's supported types, see https://docs.convex.dev/using/types.`;
  } else {
    return `${typeName}${stringifyValueForError(
      value,
    )} is not a supported Convex type.`;
  }
}

// convexOrUndefinedToJsonInternal wrapper exists so we can pipe through the
// `originalValue` and `context` through for better error messaging.
function convexOrUndefinedToJsonInternal(
  value: Value | undefined,
  originalValue: Value | undefined,
  context: string,
): JSONValue {
  if (value === undefined) {
    return { $undefined: null };
  } else {
    if (originalValue === undefined) {
      // This should not happen.
      throw new Error(
        `Programming error. Current value is ${stringifyValueForError(
          value,
        )} but original value is undefined`,
      );
    }
    return convexToJsonInternal(value, originalValue, context, false);
  }
}

/**
 * Convert a Convex value to its JSON representation.
 *
 * Use {@link jsonToConvex} to recreate the original value.
 *
 * To learn more about Convex values, see [Types](https://docs.convex.dev/using/types).
 *
 * @param value - A Convex value to convert into JSON.
 * @returns The JSON representation of `value`.
 *
 * @public
 */
export function convexToJson(value: Value): JSONValue {
  return convexToJsonInternal(value, value, "", false);
}

// Convert a Convex value or `undefined` into its JSON representation.
// `undefined` is used in filters to represent a missing object field.
export function convexOrUndefinedToJson(value: Value | undefined): JSONValue {
  return convexOrUndefinedToJsonInternal(value, value, "");
}

/**
 * Similar to convexToJson but also serializes top level undefined fields
 * using convexOrUndefinedToJson().
 *
 * @param value - A Convex value to convert into JSON.
 * @returns The JSON representation of `value`.
 */
export function patchValueToJson(value: Value): JSONValue {
  return convexToJsonInternal(value, value, "", true);
}

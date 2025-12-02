import {
  ReadonlyJSONArray,
  ReadonlyJSONObject,
  ReadonlyJSONValue,
} from "./json-value";

export function isJSONValue(value: unknown): value is ReadonlyJSONValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJSONValue);
  }

  if (typeof value === "object") {
    return Object.entries(value).every(
      ([key, val]) => typeof key === "string" && isJSONValue(val),
    );
  }

  return false;
}

export function isJSONArray(value: unknown): value is ReadonlyJSONArray {
  return Array.isArray(value) && value.every(isJSONValue);
}

export function isJSONObject(value: unknown): value is ReadonlyJSONObject {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, val]) => typeof key === "string" && isJSONValue(val),
    )
  );
}

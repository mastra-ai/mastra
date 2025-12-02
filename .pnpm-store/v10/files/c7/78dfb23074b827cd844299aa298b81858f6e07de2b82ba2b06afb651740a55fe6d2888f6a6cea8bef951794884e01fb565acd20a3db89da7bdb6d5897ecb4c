import {
  ReadonlyJSONArray,
  ReadonlyJSONObject,
  ReadonlyJSONValue,
} from "assistant-stream/utils";

export function isJSONValue(
  value: unknown,
  currentDepth: number = 0,
): value is ReadonlyJSONValue {
  // Protect against too deep recursion
  if (currentDepth > 100) {
    return false;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  // Handle special number cases
  if (typeof value === "number") {
    return !Number.isNaN(value) && Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJSONValue(item, currentDepth + 1));
  }

  if (typeof value === "object") {
    return Object.entries(value).every(
      ([key, val]) =>
        typeof key === "string" && isJSONValue(val, currentDepth + 1),
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
    Object.entries(value).every(
      ([key, val]) => typeof key === "string" && isJSONValue(val),
    )
  );
}

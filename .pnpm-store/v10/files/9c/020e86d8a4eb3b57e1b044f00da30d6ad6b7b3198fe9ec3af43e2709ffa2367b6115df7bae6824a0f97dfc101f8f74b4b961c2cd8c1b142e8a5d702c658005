import { MimeType } from "@arizeai/openinference-semantic-conventions";
import type { Attributes, AttributeValue } from "@opentelemetry/api";
import { GenericFunction, SafeFunction } from "./types.js";

export const safelyJSONStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

export const getNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
};

export const getString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
};

export const getStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return undefined;
};

export const safelyParseJSON = (value: unknown): unknown => {
  const s = getString(value);
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

export const getMimeType = (value: unknown): MimeType => {
  if (safelyParseJSON(value)) return MimeType.JSON;
  return MimeType.TEXT;
};

/**
 * Assign attribute value to attributes object if value is not undefined or null
 * This mutates the attrs object
 * @param attrs - The attributes object to assign the value to
 * @param key - The key to assign the value to
 * @param value - The value to assign to the key
 */
export const set = (
  attrs: Attributes,
  key: string,
  value?: AttributeValue | null,
) => {
  if (value === undefined || value === null) return;
  attrs[key] = value;
};

/**
 * Merge multiple attributes objects into a single attributes object
 * This mutates the first attributes object
 * @param groups - The groups of attributes to merge
 * @returns The merged attributes
 */
export const merge = (...groups: Attributes[]): Attributes =>
  groups.reduce((acc, g) => Object.assign(acc, g), {} as Attributes);

/**
 * Convert a value to a string. If the value is already a string, return it.
 * If the value can be jsonified, jsonify it.
 * Otherwise, return the string representation of the value.
 * @param value - The value to convert to a string
 * @returns The string representation of the value
 */
export const toStringContent = (value: unknown): string => {
  if (typeof value === "string") return value;
  const json = safelyJSONStringify(value);
  if (typeof json === "string") return json;
  return String(value);
};

/**
 * Wraps a function with a try-catch block to catch and log any errors.
 * @param fn - A function to wrap with a try-catch block.
 * @returns A function that returns null if an error is thrown.
 */
export function withSafety<T extends GenericFunction>({
  fn,
  onError,
}: {
  fn: T;
  onError?: (error: unknown) => void;
}): SafeFunction<T> {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      if (onError) {
        onError(error);
      }
      return null;
    }
  };
}

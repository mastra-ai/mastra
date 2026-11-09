/** @experimental Generative UI is in beta and may change without notice. */
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

/** @experimental Generative UI is in beta and may change without notice. */
export type JSONObject = { [key: string]: JSONValue };

export const isJSONObject = (value: unknown): value is JSONObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

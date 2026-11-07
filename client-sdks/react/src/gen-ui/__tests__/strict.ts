export type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
  enum?: unknown[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What a strict structured-output model can send for `value`: every object is closed, so undeclared keys
 * never reach the browser and every declared key is sent, as null when the model has nothing to say.
 */
export const asStrictModelSends = (schema: Schema, value: unknown): unknown => {
  if (schema.anyOf) {
    const branch =
      schema.anyOf.find(b =>
        Object.entries(b.properties ?? {}).some(
          ([k, p]) => p.enum?.length === 1 && isRecord(value) && value[k] === p.enum[0],
        ),
      ) ??
      schema.anyOf.find(
        b => b.type === 'object' && isRecord(value) && Object.keys(value).every(k => k in (b.properties ?? {})),
      ) ??
      schema.anyOf.find(b => b.type === (Array.isArray(value) ? 'array' : typeof value));
    return branch ? asStrictModelSends(branch, value) : null;
  }
  if (Array.isArray(value)) return value.map(v => asStrictModelSends(schema.items ?? {}, v));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([k, s]) => [
        k,
        value[k] === undefined ? null : asStrictModelSends(s, value[k]),
      ]),
    );
  }
  return value;
};

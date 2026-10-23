export type RequestContextResult =
  | { ok: true; requestContext?: Record<string, unknown> }
  | { ok: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The dataset's request context JSON Schema, or undefined when it has none worth a form. */
export function toRequestContextSchema(schema: unknown): Record<string, unknown> | undefined {
  if (!isRecord(schema)) return undefined;
  if (Object.keys(schema).length === 0) return undefined;
  return schema;
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** The JSON editor's text: blank sends nothing, anything but a JSON object is an error. */
export function parseRequestContext(raw: string): RequestContextResult {
  if (!raw.trim()) return { ok: true };
  const parsed = parseJson(raw);
  if (!parsed.ok) return { ok: false, message: 'Request context must be valid JSON' };
  if (!isRecord(parsed.value)) return { ok: false, message: 'Request context must be a JSON object' };
  return { ok: true, requestContext: parsed.value };
}

/** The schema form's values: empty fields are left out, and nothing is sent when every field is empty. */
export function filledRequestContext(values: Record<string, unknown>): RequestContextResult {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length === 0) return { ok: true };
  return { ok: true, requestContext: Object.fromEntries(entries) };
}

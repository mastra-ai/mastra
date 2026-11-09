/** Schema validation errors the API returns for one field of the item. */
export interface FieldErrors {
  field: string;
  errors: Array<{ path: string; message: string }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isErrorEntry = (value: unknown): value is FieldErrors['errors'][number] =>
  isRecord(value) && typeof value.path === 'string' && typeof value.message === 'string';

/** Reads the schema errors out of an API error such as `HTTP error! status: 400 - {"field":"input","errors":[…]}`. */
export function parseFieldErrors(error: unknown): FieldErrors | undefined {
  if (!(error instanceof Error)) return undefined;
  const match = error.message.match(/- ({.*})$/);
  if (!match?.[1]) return undefined;

  try {
    const parsed: unknown = JSON.parse(match[1]);
    if (!isRecord(parsed) || typeof parsed.field !== 'string' || !Array.isArray(parsed.errors)) return undefined;
    return { field: parsed.field, errors: parsed.errors.filter(isErrorEntry) };
  } catch {
    return undefined;
  }
}

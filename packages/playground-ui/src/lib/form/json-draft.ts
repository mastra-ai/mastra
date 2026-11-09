import type { ZodSchema } from 'zod';

import { isPlainObject } from './utils';
import { getBaseSchema } from './zod-provider/compat';
import { inferFieldType } from './zod-provider/field-type-inference';

export type JsonDraftValue = { ok: true; value: unknown } | { ok: false; error: string };

/** Parses the text of a JSON view, with an error ready to show under the editor. */
export function parseJsonDraft(text: string): JsonDraftValue {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON' };
  }
}

/** Why a JSON value can't be shown in the Form view of `schema`, if it can't. */
export function getFormShapeError(schema: ZodSchema, value: unknown) {
  const fieldType = inferFieldType(getBaseSchema(schema));
  if (fieldType === 'object' && !isPlainObject(value))
    return 'Form input requires a JSON object. Correct the JSON first.';
  if (fieldType === 'array' && !Array.isArray(value))
    return 'Form input requires a JSON array. Correct the JSON first.';
  return undefined;
}

/** Validates a JSON view against `schema`, as one message per issue. */
export function validateJsonDraft(
  schema: ZodSchema,
  text: string,
): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  const json = parseJsonDraft(text);
  if (!json.ok) return { ok: false, errors: [json.error] };
  const result = schema.safeParse(json.value);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    errors: result.error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`),
  };
}

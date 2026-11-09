import type { z } from 'zod/v4';

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

type Issue = { path: PropertyKey[]; message: string };

const toResult = <T>(result: { success: true; data: T } | { success: false; error: { issues: Issue[] } }) =>
  result.success
    ? ({ ok: true, value: result.data } as const)
    : ({
        ok: false,
        error: result.error.issues
          .map(issue => `${issue.path.length ? `${issue.path.map(String).join('.')}: ` : ''}${issue.message}`)
          .join('; '),
      } as const);

/** Validate with a zod schema. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): GenUIValidationResult<z.output<S>> {
  return toResult(schema.safeParse(value));
}

/** Copy of `value` without the `null`s at rejected paths, or `undefined` when there are none. */
function dropRejectedNulls(value: unknown, issues: Issue[]): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  const copy = structuredClone(value) as Record<PropertyKey, unknown>;
  let changed = false;
  for (const { path } of issues) {
    if (!path.length) continue;
    let parent: unknown = copy;
    for (const key of path.slice(0, -1)) parent = (parent as Record<PropertyKey, unknown> | null)?.[key];
    const key = path[path.length - 1]!;
    if (typeof parent === 'object' && parent !== null && !Array.isArray(parent)) {
      const record = parent as Record<PropertyKey, unknown>;
      if (record[key] === null) {
        delete record[key];
        changed = true;
      }
    }
  }
  return changed ? copy : undefined;
}

/**
 * Validate model-written input. Strict structured-output providers send `null` for optional fields they
 * leave out, so a failed parse is retried once without the `null`s the schema rejected.
 */
export function validateModelInput<S extends z.ZodType>(schema: S, value: unknown): GenUIValidationResult<z.output<S>> {
  const first = schema.safeParse(value);
  if (first.success) return toResult(first);
  const retry = dropRejectedNulls(value, first.error.issues as Issue[]);
  const second = retry === undefined ? undefined : schema.safeParse(retry);
  return toResult(second?.success ? second : first);
}

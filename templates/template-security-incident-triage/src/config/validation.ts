import { z } from 'zod';

export const integer = (fallback: number, minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum).default(fallback);

export const optionalSecret = (minimum = 1) =>
  z.preprocess(
    value => (value === '' ? undefined : value),
    z
      .string()
      .min(minimum)
      .refine(value => value.trim() === value)
      .optional(),
  );

/** Report field names and issue codes only; Zod messages can include input values. */
export function configurationError(section: string, error: z.ZodError): Error {
  const fields = error.issues.map(issue => `${issue.path.join('.')} (${issue.code})`);
  return new Error(`Invalid ${section} configuration. Check: ${fields.join(', ')}.`);
}

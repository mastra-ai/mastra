/**
 * Minimal Standard Schema v1 interface (https://standardschema.dev).
 *
 * Copied structurally (as the spec intends) so GenUI can validate with zod
 * (>=3.24), valibot, arktype, etc. without depending on any of them.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

export type StandardSchemaV1Result<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<unknown> }> };

export type InferSchemaOutput<S> = S extends StandardSchemaV1<any, infer O> ? O : unknown;

export type GenUIValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const formatPath = (path: ReadonlyArray<unknown> | undefined) =>
  path?.length
    ? path
        .map(segment => (typeof segment === 'object' && segment !== null ? (segment as { key: unknown }).key : segment))
        .join('.') + ': '
    : '';

const toResult = <T>(result: StandardSchemaV1Result<T>): GenUIValidationResult<T> =>
  result.issues
    ? { ok: false, error: result.issues.map(issue => `${formatPath(issue.path)}${issue.message}`).join('; ') }
    : { ok: true, value: result.value };

export const isStandardSchema = (value: unknown): value is StandardSchemaV1 =>
  typeof value === 'object' && value !== null && '~standard' in value;

/** Validate synchronously; returns an error if the schema only supports async validation. */
export function validateSchemaSync<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): GenUIValidationResult<InferSchemaOutput<S>> {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) return { ok: false, error: 'schema requires async validation' };
  return toResult(result as StandardSchemaV1Result<InferSchemaOutput<S>>);
}

export async function validateSchema<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): Promise<GenUIValidationResult<InferSchemaOutput<S>>> {
  return toResult((await schema['~standard'].validate(value)) as StandardSchemaV1Result<InferSchemaOutput<S>>);
}

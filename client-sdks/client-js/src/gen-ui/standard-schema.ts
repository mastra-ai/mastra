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

type Issues = ReadonlyArray<{ readonly path?: ReadonlyArray<unknown> }>;

const pathKey = (segment: unknown) =>
  typeof segment === 'object' && segment !== null ? (segment as { key: PropertyKey }).key : segment;

/**
 * Strict-mode providers (e.g. OpenAI structured outputs) make every optional
 * field required-but-nullable, so the model sends `null` for "not set". Drop
 * the `null`s the schema rejected so the original optional field validates.
 * Returns undefined when no rejected `null` was found.
 */
function dropRejectedNulls(value: unknown, issues: Issues): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  const copy = structuredClone(value) as Record<PropertyKey, unknown>;
  let changed = false;
  for (const issue of issues) {
    const path = issue.path?.map(pathKey);
    if (!path?.length) continue;
    let parent: unknown = copy;
    for (const key of path.slice(0, -1)) parent = (parent as Record<PropertyKey, unknown> | null)?.[key as PropertyKey];
    const key = path[path.length - 1] as PropertyKey;
    if (
      typeof parent === 'object' &&
      parent !== null &&
      !Array.isArray(parent) &&
      (parent as Record<PropertyKey, unknown>)[key] === null
    ) {
      delete (parent as Record<PropertyKey, unknown>)[key];
      changed = true;
    }
  }
  return changed ? copy : undefined;
}

/** Validate model-generated input, treating rejected `null`s as omitted optional fields. */
export function validateModelInputSync<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): GenUIValidationResult<InferSchemaOutput<S>> {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) return { ok: false, error: 'schema requires async validation' };
  if (!result.issues) return toResult(result as StandardSchemaV1Result<InferSchemaOutput<S>>);
  const retry = dropRejectedNulls(value, result.issues);
  const second = retry === undefined ? undefined : validateSchemaSync(schema, retry);
  return second?.ok ? second : toResult(result as StandardSchemaV1Result<InferSchemaOutput<S>>);
}

export async function validateModelInput<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): Promise<GenUIValidationResult<InferSchemaOutput<S>>> {
  const result = await schema['~standard'].validate(value);
  if (!result.issues) return toResult(result as StandardSchemaV1Result<InferSchemaOutput<S>>);
  const retry = dropRejectedNulls(value, result.issues);
  const second = retry === undefined ? undefined : await validateSchema(schema, retry);
  return second?.ok ? second : toResult(result as StandardSchemaV1Result<InferSchemaOutput<S>>);
}

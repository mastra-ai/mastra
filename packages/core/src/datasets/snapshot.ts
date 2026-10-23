import { createHash } from 'node:crypto';
import { z } from 'zod/v4';

export const DATASET_SNAPSHOT_DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
export const DATASET_SNAPSHOT_MAX_DEPTH = 100;

const snapshotOptionsSchema = z.object({
  maxBytes: z.number().int().positive().default(DATASET_SNAPSHOT_DEFAULT_MAX_BYTES),
});

export type DatasetSnapshotOptions = z.input<typeof snapshotOptionsSchema>;

function snapshotSizeSchema(options: DatasetSnapshotOptions) {
  const { maxBytes } = snapshotOptionsSchema.parse(options);
  return z.string().refine(text => Buffer.byteLength(text, 'utf8') <= maxBytes, {
    message: `Dataset snapshot exceeds the ${maxBytes} byte limit`,
  });
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// RFC 8785 forbids lone surrogates, including in property names.
function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function isJsonValue(value: unknown, ancestors = new Set<object>(), depth = 0): value is JsonValue {
  if (depth > DATASET_SNAPSHOT_MAX_DEPTH) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return !hasLoneSurrogate(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;

  ancestors.add(value);
  try {
    const keys = Reflect.ownKeys(value);
    if (array && keys.length !== value.length + 1) return false;
    return keys.every(key => {
      if (array && key === 'length') return true;
      if (typeof key !== 'string' || hasLoneSurrogate(key)) return false;
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      return descriptor.enumerable && 'value' in descriptor && isJsonValue(descriptor.value, ancestors, depth + 1);
    });
  } finally {
    ancestors.delete(value);
  }
}

const jsonValueSchema = z.custom<JsonValue>(value => isJsonValue(value), {
  message: `Expected lossless JSON with valid Unicode and at most ${DATASET_SNAPSHOT_MAX_DEPTH} levels of nesting`,
});
// Validate without projecting keys: z.record discards an authored "__proto__" property.
const jsonObjectSchema = z.custom<Record<string, JsonValue>>(
  value => value !== null && typeof value === 'object' && !Array.isArray(value) && isJsonValue(value),
  { message: 'Expected a lossless JSON object' },
);
const identitySchema = z.uuid().refine(value => value === value.toLowerCase(), 'Portable identities must be lowercase');
const referenceSchema = z.string().min(1);

const configurationSchema = z.strictObject({
  name: z.string(),
  description: z.string().nullable().optional(),
  metadata: jsonObjectSchema.optional(),
  inputSchema: jsonObjectSchema.nullable().optional(),
  groundTruthSchema: jsonObjectSchema.nullable().optional(),
  requestContextSchema: jsonObjectSchema.nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  targetType: z.enum(['agent', 'workflow', 'scorer', 'processor']).nullable().optional(),
  targetIds: z.array(referenceSchema).nullable().optional(),
  scorerIds: z.array(referenceSchema).nullable().optional(),
});

const payloadSchema = z.strictObject({
  externalId: referenceSchema.nullable().optional(),
  input: jsonValueSchema,
  groundTruth: jsonValueSchema.optional(),
  // Core stores trajectory expectations as unknown JSON, not the server's depth-limited projection.
  expectedTrajectory: jsonValueSchema.optional(),
  toolMocks: z
    .array(
      z.strictObject({
        toolName: z.string(),
        args: jsonObjectSchema,
        output: jsonValueSchema,
        matchArgs: z.enum(['strict', 'ignore']).optional(),
      }),
    )
    .nullable()
    .optional(),
  unmockedToolPolicy: z.enum(['allow', 'deny']).nullable().optional(),
  scorerIds: z.array(referenceSchema).nullable().optional(),
  requestContext: jsonObjectSchema.nullable().optional(),
  metadata: jsonObjectSchema.nullable().optional(),
  source: z
    .strictObject({
      type: z.enum(['csv', 'json', 'trace', 'llm', 'experiment-result', 'candidate-screener']),
      referenceId: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const contentSchema = z.strictObject({
  formatVersion: z.literal(1),
  datasetIdentity: identitySchema,
  configuration: configurationSchema,
  items: z.array(
    z.strictObject({
      itemIdentity: identitySchema,
      createdAt: z.iso.datetime({ precision: 3 }),
      updatedAt: z.iso.datetime({ precision: 3 }),
      payload: payloadSchema,
    }),
  ),
  provenance: z.strictObject({
    exportedAt: z.iso.datetime({ offset: true }),
    sourceDatasetId: referenceSchema,
    itemVersion: z.number().int().nonnegative(),
    configurationBasis: z.literal('export-time'),
  }),
});

export type DatasetSnapshotContent = z.infer<typeof contentSchema>;

function validateIdentities(snapshot: DatasetSnapshotContent, ctx: z.RefinementCtx): void {
  const identities = new Set<string>();
  const externalIds = new Set<string>();
  snapshot.items.forEach((item, index) => {
    if (identities.has(item.itemIdentity)) {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index, 'itemIdentity'],
        message: 'Duplicate portable item identity',
      });
    }
    identities.add(item.itemIdentity);
    const externalId = item.payload.externalId;
    if (externalId != null) {
      if (externalIds.has(externalId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'payload', 'externalId'],
          message: 'Duplicate externalId',
        });
      }
      externalIds.add(externalId);
    }
  });
}

// Emit sorted keys directly: reconstructing an object would reorder integer-like keys.
function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(value[key]!)}`)
    .join(',')}}`;
}

function computeDigest(content: DatasetSnapshotContent): string {
  const items = [...content.items].sort((a, b) =>
    a.itemIdentity < b.itemIdentity ? -1 : a.itemIdentity > b.itemIdentity ? 1 : 0,
  );
  // The schemas allow omitted optional fields, but parsed JSON never contains undefined.
  const value = JSON.parse(JSON.stringify({ ...content, items }));
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

/** Validates unsigned artifact content, including portable identity uniqueness. */
export const datasetSnapshotContentSchema = jsonValueSchema.pipe(contentSchema.superRefine(validateIdentities));

/** Validates the complete v1 artifact and SHA-256 digest, independently of deployment size limits. */
export const datasetSnapshotSchema = jsonValueSchema.pipe(
  contentSchema.extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) }).superRefine((snapshot, ctx) => {
    validateIdentities(snapshot, ctx);
    const { digest, ...content } = snapshot;
    if (digest !== computeDigest(content)) {
      ctx.addIssue({ code: 'custom', path: ['digest'], message: 'Dataset snapshot digest mismatch' });
    }
  }),
);

export type DatasetSnapshot = z.infer<typeof datasetSnapshotSchema>;

/**
 * Seals authored content and limits its compact JSON byte size. Does not read or write storage.
 * The size check follows validation, cloning, and hashing; it does not bound CPU time or peak memory.
 */
export function createDatasetSnapshot(
  content: DatasetSnapshotContent,
  options: DatasetSnapshotOptions = {},
): DatasetSnapshot {
  const sizeSchema = snapshotSizeSchema(options);
  const captured = structuredClone(datasetSnapshotContentSchema.parse(content));
  const snapshot = { ...captured, digest: computeDigest(captured) };
  sizeSchema.parse(JSON.stringify(snapshot));
  return snapshot;
}

const snapshotTextSchema = z
  .string()
  .transform((text, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid dataset snapshot JSON' });
      return z.NEVER;
    }
    // JSON.parse accepts duplicate keys with last-value-wins semantics. Scan the
    // already valid JSON so an ambiguous artifact cannot pass integrity validation.
    const stack: Array<{ keys: Set<string>; expectingKey: boolean } | null> = [];
    for (const [token] of text.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}[\],]/g)) {
      const object = stack.at(-1);
      if (token === '{') stack.push({ keys: new Set(), expectingKey: true });
      else if (token === '[') stack.push(null);
      else if (token === '}' || token === ']') stack.pop();
      else if (token === ',' && object) object.expectingKey = true;
      else if (token.startsWith('"') && object?.expectingKey) {
        const key: string = JSON.parse(token);
        if (object.keys.has(key)) {
          ctx.addIssue({ code: 'custom', message: 'Duplicate JSON property in dataset snapshot' });
          return z.NEVER;
        }
        object.keys.add(key);
        object.expectingKey = false;
      }
    }
    return parsed;
  })
  .pipe(datasetSnapshotSchema);

/** Limits raw UTF-8 bytes before parsing untrusted JSON. Destination checks belong to import preflight. */
export function parseDatasetSnapshot(text: string, options: DatasetSnapshotOptions = {}): DatasetSnapshot {
  return snapshotSizeSchema(options).pipe(snapshotTextSchema).parse(text);
}

import { z } from 'zod';
import { RenderProtocolError } from './errors.js';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const PROTOCOL_VERSION = 1;
export const MAX_INPUT_BYTES = 4_000_000;

/** Reject lossy JSON rather than silently changing user input at the boundary. */
export function json(value: unknown, label = 'value', limit = MAX_INPUT_BYTES): Json {
  const ancestors = new Set<object>();
  function visit(current: unknown, path: string): Json {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number' && Number.isFinite(current)) return current;
    if (typeof current !== 'object' || current === undefined) throw new RenderProtocolError(`${path} is not JSON-safe`);
    if (ancestors.has(current)) throw new RenderProtocolError(`${path} contains a cycle`);
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        return Array.from({ length: current.length }, (_, index) => visit(current[index], `${path}[${index}]`));
      }
      if (Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
        throw new RenderProtocolError(`${path} must be a plain object`);
      }
      if (Object.getOwnPropertySymbols(current).length) throw new RenderProtocolError(`${path} contains symbol keys`);
      const result: Record<string, Json> = Object.create(null);
      for (const key of Object.keys(current)) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
        if (!('value' in descriptor)) throw new RenderProtocolError(`${path}.${key} is an accessor`);
        result[key] = visit(descriptor.value, `${path}.${key}`);
      }
      return result;
    } finally {
      ancestors.delete(current);
    }
  }
  const result = visit(value, label);
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > limit) {
    throw new RenderProtocolError(`${label} exceeds the ${limit}-byte protocol limit`);
  }
  return result;
}

/** Framework metadata intentionally omits absent fields and serializes Errors. User values must pass json() first. */
export function frameworkJson(value: unknown): Json {
  return json(
    JSON.parse(
      JSON.stringify(value, (_key, entry: unknown) =>
        entry instanceof Error ? { name: entry.name, message: entry.message } : entry,
      ),
    ),
    'framework result',
  );
}

const identity = {
  version: z.literal(PROTOCOL_VERSION),
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  buildId: z.string().min(1),
  manifest: z.string().min(1),
  resourceId: z.string().optional(),
};

export const rootEnvelopeSchema = z
  .object({
    ...identity,
    input: z.unknown().refine(value => value !== undefined, 'input is required'),
    state: z.unknown().refine(value => value !== undefined, 'state is required'),
    requestContext: z.record(z.unknown()),
  })
  .strict();
export type RootEnvelope = z.infer<typeof rootEnvelopeSchema>;

export const stepEnvelopeSchema = rootEnvelopeSchema
  .extend({
    stepKey: z.string(),
    executionKey: z.string(),
    initialInput: z.unknown().refine(value => value !== undefined, 'initialInput is required'),
    priorOutputs: z.record(z.unknown()),
    readOnly: z.boolean(),
  })
  .strict();
export type StepEnvelope = z.infer<typeof stepEnvelopeSchema>;

export const stepOutcomeSchema = z
  .object({
    output: z.unknown().refine(value => value !== undefined, 'output is required'),
    stateChanged: z.boolean(),
    state: z.unknown().refine(value => value !== undefined, 'state is required'),
    requestContext: z.record(z.unknown()),
  })
  .strict();
export type StepOutcome = z.infer<typeof stepOutcomeSchema>;

export function parseEnvelope<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  // The provider input is a positional argument array, so include its framing in the limit.
  json([value], 'task arguments');
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new RenderProtocolError(parsed.error.message);
  return parsed.data;
}

import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { z as zv3 } from 'zod/v3';
import { applyCompatLayer } from '../utils';
import { GoogleSchemaCompatLayer } from './google';

// Gemini's `Schema.enum` only accepts non-empty strings on a `type: "string"` node,
// and it has no `const`. Anything else makes the whole generateContent request fail
// with HTTP 400 before the model runs, for every tool on the agent (#29167).
function geminiEnumViolations(node: unknown, path = '$'): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => geminiEnumViolations(item, `${path}[${i}]`));
  }
  if (typeof node !== 'object' || node === null) return [];

  const schema = new Map<string, unknown>(Object.entries(node));
  const violations: string[] = [];
  if (schema.has('const')) {
    violations.push(`${path}.const = ${JSON.stringify(schema.get('const'))}`);
  }
  if (schema.has('enum')) {
    const values = schema.get('enum');
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string' || v === '')) {
      violations.push(`${path}.enum = ${JSON.stringify(values)}`);
    }
    if (schema.get('type') !== 'string') {
      violations.push(`${path}.enum on type ${JSON.stringify(schema.get('type'))}`);
    }
  }
  for (const [key, value] of schema) {
    if (key === 'enum' || key === 'const') continue;
    violations.push(...geminiEnumViolations(value, `${path}.${key}`));
  }
  return violations;
}

/** Read a nested schema value, failing the test with the path if any step is missing. */
function at(node: unknown, ...path: string[]): unknown {
  let current = node;
  for (const key of path) {
    const entries =
      typeof current === 'object' && current !== null ? new Map<string, unknown>(Object.entries(current)) : undefined;
    if (!entries?.has(key)) {
      throw new Error(`schema has no ${path.join('.')} (stopped at ${key})`);
    }
    current = entries.get(key);
  }
  return current;
}

describe('GoogleSchemaCompatLayer: literal and enum values Gemini rejects (#29167)', () => {
  const layer = new GoogleSchemaCompatLayer({
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    supportsStructuredOutputs: false,
  });

  const toolInput = (schema: Parameters<typeof layer.processToJSONSchema>[0]): JSONSchema7 =>
    applyCompatLayer({ schema, compatLayers: [layer], mode: 'jsonSchema' });

  it('sends a numeric literal as a plain number with the allowed value in the description', () => {
    const result = toolInput(z.object({ v: z.literal(1) }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'v')).toEqual({ type: 'number', description: 'Must be 1.' });
  });

  it('sends a boolean literal as a plain boolean with the allowed value in the description', () => {
    const result = toolInput(z.object({ flag: z.literal(true) }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'flag')).toEqual({ type: 'boolean', description: 'Must be true.' });
  });

  it('sends a string-or-empty-string union without an empty enum value', () => {
    const result = toolInput(z.object({ x: z.union([z.string(), z.literal('')]) }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'x', 'anyOf')).toEqual([
      { type: 'string' },
      { type: 'string', description: 'Must be "".' },
    ]);
  });

  it('keeps string enums and drops numeric literals in a nullable mixed union', () => {
    const result = toolInput(z.object({ m: z.union([z.enum(['a', 'b']), z.literal(3), z.null()]) }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'm')).toEqual({
      anyOf: [
        { type: 'string', enum: ['a', 'b'] },
        { type: 'number', description: 'Must be 3.' },
      ],
      nullable: true,
    });
  });

  it('turns a string enum that includes null into a nullable string enum', () => {
    const result = toolInput(z.object({ choice: z.literal(['a', 'b', null]) }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'choice')).toEqual({ type: 'string', enum: ['a', 'b'], nullable: true });
  });

  it('drops enum: [null] from null literals and still collapses a string-or-null-literal union', async () => {
    const original = z.object({ none: z.literal(null), name: z.union([z.string(), z.literal(null)]) });
    const result = toolInput(original);

    expect(geminiEnumViolations(result)).toEqual([]);
    // A null-only node keeps `type: 'null'` so a parent anyOf can still recognise and drop it.
    expect(at(result, 'properties', 'none')).toEqual({ type: 'null', nullable: true, description: 'Must be null.' });
    expect(at(result, 'properties', 'name')).toEqual({ type: 'string', nullable: true });

    const aiSdk = layer.processToAISDKSchema(original);
    expect(geminiEnumViolations(aiSdk.jsonSchema)).toEqual([]);
    expect(at(aiSdk.jsonSchema, 'properties', 'name')).toEqual({ type: 'string', nullable: true });

    const compat = layer.processToCompatSchema(original);
    expect((await compat['~standard'].validate({ none: null, name: null })).issues).toBeUndefined();
    expect((await compat['~standard'].validate({ none: 'x', name: null })).issues).toBeDefined();
    expect(aiSdk.validate?.({ none: null, name: 'Ada' })).toMatchObject({ success: true });
    expect(aiSdk.validate?.({ none: 1, name: 'Ada' })).toMatchObject({ success: false });
  });

  it('types a mixed number/string literal set instead of leaving it typeless', () => {
    const result = toolInput(z.object({ mixed: z.literal([1, 'a']) }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'mixed')).toEqual({
      anyOf: [{ type: 'integer' }, { type: 'string' }],
      description: 'Must be one of: 1, "a".',
    });
  });

  it('infers integer or number for typeless numeric enums from external JSON Schema', () => {
    // MCP and other external tools hand Mastra raw JSON Schema, which may omit `type`.
    const result = toolInput({
      type: 'object',
      properties: {
        level: { enum: [1, 2, 3] },
        ratio: { enum: [0.5, 1] },
        mode: { enum: ['fast', null] },
        count: { type: 'integer', enum: [1, 2, null] },
        size: { enum: ['s', 'm'] },
        code: { type: 'integer', enum: ['1', '2'] },
        either: { type: ['string', 'number'], enum: ['a', 'b'] },
      },
    } satisfies JSONSchema7);

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'level')).toEqual({ type: 'integer', description: 'Must be one of: 1, 2, 3.' });
    expect(at(result, 'properties', 'ratio')).toEqual({ type: 'number', description: 'Must be one of: 0.5, 1.' });
    expect(at(result, 'properties', 'mode')).toEqual({ type: 'string', enum: ['fast'], nullable: true });
    expect(at(result, 'properties', 'count')).toEqual({
      type: 'integer',
      nullable: true,
      description: 'Must be one of: 1, 2, null.',
    });
    expect(at(result, 'properties', 'size')).toEqual({ type: 'string', enum: ['s', 'm'] });
    // String values on a node that is not a plain string node can't stay an enum either.
    expect(at(result, 'properties', 'code')).toEqual({ type: 'integer', description: 'Must be one of: "1", "2".' });
    expect(at(result, 'properties', 'either')).toEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }],
      description: 'Must be one of: "a", "b".',
    });
  });

  it('appends the allowed values after an existing description', () => {
    const result = toolInput(z.object({ flag: z.literal(true).describe('Turns the feature on') }));

    expect(at(result, 'properties', 'flag', 'description')).toBe('Turns the feature on Must be true.');
  });

  it('keeps the outer description first when a nullable literal is collapsed', () => {
    const result = toolInput(z.object({ flag: z.literal(true).nullable().describe('Turns the feature on') }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'flag')).toEqual({
      type: 'boolean',
      nullable: true,
      description: 'Turns the feature on Must be true.',
    });
  });

  it('does not repeat a description that zod v3 copies onto both levels of a nullable literal', () => {
    const result = toolInput(zv3.object({ flag: zv3.literal(true).describe('Turns the feature on').nullable() }));

    expect(at(result, 'properties', 'flag', 'description')).toBe('Turns the feature on Must be true.');
  });

  it('keeps every description and the allowed values through a doubly nullable literal', () => {
    const result = toolInput(z.object({ v: z.literal(1).nullable().describe('inner').nullable().describe('outer') }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'v', 'description')).toBe('outer inner Must be 1.');
  });

  it('keeps the allowed values when the enum sits on a nullable anyOf parent', () => {
    // External JSON Schema can put the enum next to the anyOf it constrains.
    const result = toolInput({
      type: 'object',
      properties: {
        text: { enum: ['', null], anyOf: [{ type: 'string', description: 'Text branch' }, { type: 'null' }] },
      },
    } satisfies JSONSchema7);

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'text')).toEqual({
      type: 'string',
      nullable: true,
      description: 'Must be one of: "", null. Text branch',
    });
  });

  it('leaves descriptions on ordinary nullable fields as they were', () => {
    // Only branches that got an allowed-values note merge in the parent description.
    const result = toolInput(z.object({ name: z.string().describe('inner').nullable().describe('outer') }));

    expect(at(result, 'properties', 'name')).toEqual({ type: 'string', nullable: true, description: 'inner' });
  });

  it('fixes zod v3 literal schemas the same way', () => {
    const result = toolInput(zv3.object({ v: zv3.literal(1), x: zv3.union([zv3.string(), zv3.literal('')]) }));

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'v')).toEqual({ type: 'number', description: 'Must be 1.' });
  });

  it('leaves valid string enums and string literals unchanged', () => {
    const result = toolInput(
      z.object({
        mode: z.literal('strict'),
        level: z.enum(['low', 'high']).nullable(),
      }),
    );

    expect(at(result, 'properties', 'mode')).toEqual({ type: 'string', enum: ['strict'] });
    expect(at(result, 'properties', 'level')).toEqual({ type: 'string', enum: ['low', 'high'], nullable: true });
  });

  it('sends Gemini-valid enums through the AI SDK schema path too', () => {
    const result = layer.processToAISDKSchema(
      z.object({
        v: z.literal(1),
        flag: z.literal(true),
        x: z.union([z.string(), z.literal('')]),
        m: z.union([z.enum(['a', 'b']), z.literal(3), z.null()]),
      }),
    ).jsonSchema;

    expect(geminiEnumViolations(result)).toEqual([]);
    expect(at(result, 'properties', 'x', 'anyOf')).toEqual([
      { type: 'string' },
      { type: 'string', description: 'Must be "".' },
    ]);
  });

  it('still validates tool arguments against the original literal values', async () => {
    const original = z.object({ v: z.literal(1), x: z.union([z.string().min(3), z.literal('')]) });
    const compat = layer.processToCompatSchema(original);

    expect((await compat['~standard'].validate({ v: 1, x: '' })).issues).toBeUndefined();
    expect((await compat['~standard'].validate({ v: 1, x: 'abc' })).issues).toBeUndefined();
    expect((await compat['~standard'].validate({ v: 2, x: '' })).issues).toBeDefined();
    expect((await compat['~standard'].validate({ v: 1, x: 'ab' })).issues).toBeDefined();

    const aiSdk = layer.processToAISDKSchema(original);
    expect(aiSdk.validate?.({ v: 1, x: '' })).toMatchObject({ success: true });
    expect(aiSdk.validate?.({ v: 2, x: '' })).toMatchObject({ success: false });
  });
});

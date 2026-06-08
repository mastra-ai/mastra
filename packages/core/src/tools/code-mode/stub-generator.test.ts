import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../tool';
import { buildRunner } from './runner';
import { createCodeModeInstructions, generateStubs, jsonSchemaToTsString } from './stub-generator';

describe('jsonSchemaToTsString', () => {
  it('maps primitives', () => {
    expect(jsonSchemaToTsString({ type: 'string' })).toBe('string');
    expect(jsonSchemaToTsString({ type: 'number' })).toBe('number');
    expect(jsonSchemaToTsString({ type: 'integer' })).toBe('number');
    expect(jsonSchemaToTsString({ type: 'boolean' })).toBe('boolean');
    expect(jsonSchemaToTsString(undefined)).toBe('unknown');
  });

  it('maps objects with required vs optional fields', () => {
    const ts = jsonSchemaToTsString({
      type: 'object',
      properties: { id: { type: 'string' }, age: { type: 'number' } },
      required: ['id'],
    });
    expect(ts).toBe('{ id: string; age?: number }');
  });

  it('maps arrays and arrays of objects', () => {
    expect(jsonSchemaToTsString({ type: 'array', items: { type: 'string' } })).toBe('string[]');
    expect(
      jsonSchemaToTsString({
        type: 'array',
        items: { type: 'object', properties: { x: { type: 'number' } }, required: ['x'] },
      }),
    ).toBe('{ x: number }[]');
  });

  it('maps enums and unions', () => {
    expect(jsonSchemaToTsString({ enum: ['a', 'b'] })).toBe('"a" | "b"');
    expect(jsonSchemaToTsString({ anyOf: [{ type: 'string' }, { type: 'number' }] })).toBe('string | number');
  });

  it('parenthesizes array of union', () => {
    expect(jsonSchemaToTsString({ type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } })).toBe(
      'Array<string | number>',
    );
  });

  it('degrades unknown shapes to unknown', () => {
    expect(jsonSchemaToTsString({})).toBe('unknown');
  });
});

describe('generateStubs', () => {
  const getWeather = createTool({
    id: 'getWeather',
    description: 'Get weather for a city',
    inputSchema: z.object({ location: z.string() }),
    outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
    execute: async () => ({ temperature: 1, condition: 'sunny' }),
  });

  it('produces a typed declaration with description', () => {
    const [stub] = generateStubs({ getWeather });
    expect(stub.toolId).toBe('getWeather');
    expect(stub.externalName).toBe('getWeather');
    expect(stub.declaration).toContain('/** Get weather for a city */');
    expect(stub.declaration).toContain('declare function external_getWeather(input: { location: string }): Promise<');
    expect(stub.declaration).toContain('temperature: number');
  });

  it('falls back to Promise<unknown> with no output schema', () => {
    const noOut = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      execute: async () => ({}),
    });
    const [stub] = generateStubs({ noOut });
    expect(stub.declaration).toContain('Promise<unknown>');
  });

  it('sanitizes ids that are not valid identifiers', () => {
    const weird = createTool({ id: 'do-the-thing', description: 'x', execute: async () => ({}) });
    const [stub] = generateStubs({ weird });
    expect(stub.externalName).toBe('do_the_thing');
    expect(stub.declaration).toContain('external_do_the_thing');
  });

  it('throws when two ids sanitize to the same external name', () => {
    const dash = createTool({ id: 'a-b', description: 'x', execute: async () => ({}) });
    const underscore = createTool({ id: 'a_b', description: 'x', execute: async () => ({}) });
    expect(() => generateStubs({ dash, underscore })).toThrow(/collision.*external_a_b/);
  });
});

describe('createCodeModeInstructions', () => {
  it('includes the usage contract and all stubs', () => {
    const a = createTool({ id: 'a', description: 'tool a', inputSchema: z.object({}), execute: async () => ({}) });
    const b = createTool({ id: 'b', description: 'tool b', inputSchema: z.object({}), execute: async () => ({}) });
    const instructions = createCodeModeInstructions({ tools: { a, b } });
    expect(instructions).toContain('# Code Mode');
    expect(instructions).toContain('external_a');
    expect(instructions).toContain('external_b');
    expect(instructions).toContain('Promise.all');
  });
});

describe('buildRunner', () => {
  it('rejects non-identifier external names', () => {
    expect(() =>
      buildRunner({ programModule: 'file:///p.ts', externals: [{ externalName: 'bad-name', toolId: 'bad-name' }] }),
    ).toThrow(/Invalid Code Mode external identifier/);
  });

  it('rejects duplicate external names that would overwrite globals', () => {
    expect(() =>
      buildRunner({
        programModule: 'file:///p.ts',
        externals: [
          { externalName: 'a_b', toolId: 'a-b' },
          { externalName: 'a_b', toolId: 'a_b' },
        ],
      }),
    ).toThrow(/collision.*external_a_b/);
  });

  it('builds runner source for valid externals', () => {
    const source = buildRunner({
      programModule: 'file:///p.ts',
      externals: [{ externalName: 'get_thing', toolId: 'get-thing' }],
    });
    expect(source).toContain('get_thing');
    expect(source).toContain('file:///p.ts');
  });
});

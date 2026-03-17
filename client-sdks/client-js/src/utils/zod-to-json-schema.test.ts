import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from './zod-to-json-schema';

describe('zodToJsonSchema', () => {
  it('should convert z.object({}) to have type: object', () => {
    const emptySchema = z.object({});
    const result = zodToJsonSchema(emptySchema);

    expect(result.type).toBe('object');
    expect(result.properties).toEqual({});
  });

  it('should handle nested empty object schemas', () => {
    const schema = z.object({
      data: z.object({}),
    });
    const result = zodToJsonSchema(schema);

    expect(result.type).toBe('object');
    expect(result.properties?.data).toBeDefined();
    expect((result.properties?.data as any).type).toBe('object');
  });

  it('should pass through non-Zod values unchanged', () => {
    const plainObject = { type: 'object', properties: {} };
    const result = zodToJsonSchema(plainObject);

    expect(result).toEqual(plainObject);
  });

  it('should handle object with properties', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const result = zodToJsonSchema(schema);

    expect(result.type).toBe('object');
    expect(result.properties?.name).toBeDefined();
    expect(result.properties?.age).toBeDefined();
  });

  it('should handle arrays with object items', () => {
    const schema = z.array(z.object({}));
    const result = zodToJsonSchema(schema);

    expect(result.type).toBe('array');
    expect((result.items as any)?.type).toBe('object');
  });

  it('should handle optional object schemas', () => {
    const schema = z.object({
      data: z.object({}).optional(),
    });
    const result = zodToJsonSchema(schema);

    expect(result.type).toBe('object');
    expect(result.properties?.data).toBeDefined();
  });
});

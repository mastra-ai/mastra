import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseSchema } from '../index';

describe('parseSchema v4Type fallback — array fields', () => {
  it('should detect z.array(z.string()) as type "array" with element subSchema', () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    const result = parseSchema(schema);
    const itemsField = result.fields.find(f => f.key === 'items');

    expect(itemsField).toBeDefined();
    expect(itemsField!.type).toBe('array');
    expect(itemsField!.schema).toHaveLength(1);
    expect(itemsField!.schema![0]!.type).toBe('string');
    expect(itemsField!.schema![0]!.key).toBe('0');
  });

  it('should detect z.array(z.number()) as type "array" with number element', () => {
    const schema = z.object({
      nums: z.array(z.number()),
    });

    const result = parseSchema(schema);
    const numsField = result.fields.find(f => f.key === 'nums');

    expect(numsField!.type).toBe('array');
    expect(numsField!.schema).toHaveLength(1);
    expect(numsField!.schema![0]!.type).toBe('number');
  });

  it('should detect z.array(z.object(...)) as type "array" with object element', () => {
    const schema = z.object({
      sources: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
        }),
      ),
    });

    const result = parseSchema(schema);
    const sourcesField = result.fields.find(f => f.key === 'sources');

    expect(sourcesField!.type).toBe('array');
    expect(sourcesField!.schema).toHaveLength(1);
    expect(sourcesField!.schema![0]!.type).toBe('object');
  });

  it('should handle array fields with .min()/.max() constraints', () => {
    const schema = z.object({
      items: z.array(z.string()).min(1).max(10),
    });

    const result = parseSchema(schema);
    const itemsField = result.fields.find(f => f.key === 'items');

    expect(itemsField!.type).toBe('array');
    expect(itemsField!.schema).toHaveLength(1);
  });
});

describe('parseSchema v4Type fallback — union fields', () => {
  it('should detect z.union([z.string(), z.number()]) as type "union"', () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });

    const result = parseSchema(schema);
    const valueField = result.fields.find(f => f.key === 'value');

    expect(valueField).toBeDefined();
    expect(valueField!.type).toBe('union');
    expect(valueField!.schema!.length).toBe(2);
  });
});

describe('parseSchema — primitive fields (control)', () => {
  it('should correctly parse string, number, and boolean fields', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    });

    const result = parseSchema(schema);
    expect(result.fields).toHaveLength(3);
    expect(result.fields.find(f => f.key === 'name')!.type).toBe('string');
    expect(result.fields.find(f => f.key === 'age')!.type).toBe('number');
    expect(result.fields.find(f => f.key === 'active')!.type).toBe('boolean');
  });
});

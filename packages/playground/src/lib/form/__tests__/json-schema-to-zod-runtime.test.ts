import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { jsonSchemaToZodRuntime } from '../json-schema-to-zod-runtime';
import { getBaseSchema } from '../zod-provider/compat';
import { inferFieldType } from '../zod-provider/field-type-inference';

/**
 * The behavior being replaced: generate Zod source and evaluate it. Kept here
 * only as the reference implementation these tests compare against, so the
 * runtime converter is pinned to what Studio does today rather than to an
 * assumption about it.
 */
function resolveViaEval(jsonSchema: unknown): z.ZodTypeAny {
  return Function('z', `"use strict";return (${jsonSchemaToZod(jsonSchema as any)});`)(z);
}

/** Schemas Studio realistically receives from tools, workflows and request context. */
const schemas: Record<string, Record<string, any>> = {
  'a required and an optional field': {
    type: 'object',
    properties: { name: { type: 'string' }, age: { type: 'number' } },
    required: ['name'],
  },
  'a nested object': {
    type: 'object',
    properties: {
      user: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
    },
    required: ['user'],
  },
  'an array of objects': {
    type: 'object',
    properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } } },
  },
  'a string enum': { type: 'object', properties: { color: { type: 'string', enum: ['red', 'green'] } } },
  'a nullable field': { type: 'object', properties: { v: { type: ['string', 'null'] } } },
  'string constraints': {
    type: 'object',
    properties: { s: { type: 'string', minLength: 2, maxLength: 5, pattern: '^[a-z]+$' } },
  },
  'number constraints': {
    type: 'object',
    properties: { n: { type: 'number', minimum: 1, maximum: 10 }, i: { type: 'integer' } },
  },
  'a default value': { type: 'object', properties: { d: { type: 'string', default: 'hi' } } },
  'a described field': { type: 'object', properties: { d: { type: 'string', description: 'a field' } } },
  'an anyOf union': { type: 'object', properties: { v: { anyOf: [{ type: 'string' }, { type: 'number' }] } } },
  'a boolean': { type: 'object', properties: { b: { type: 'boolean' } } },
  'a date-time string': { type: 'object', properties: { t: { type: 'string', format: 'date-time' } } },
  'an email string': { type: 'object', properties: { e: { type: 'string', format: 'email' } } },
  'a dictionary of strings': {
    type: 'object',
    properties: { m: { type: 'object', additionalProperties: { type: 'string' } } },
  },
  'no properties at all': { type: 'object', properties: {} },
  'a deeply nested shape': {
    type: 'object',
    properties: { a: { type: 'object', properties: { b: { type: 'array', items: { type: 'string' } } } } },
  },
};

/** Values spanning valid, invalid and absent for the fields above. */
const values: unknown[] = [
  {},
  { name: 'x' },
  { name: 'x', age: 3 },
  { name: 'x', age: 'not-a-number' },
  { user: { email: 'a@b.com' } },
  { items: [{ id: '1' }] },
  { items: 'not-an-array' },
  { color: 'red' },
  { color: 'blue' },
  { v: null },
  { v: 'str' },
  { v: 5 },
  { s: 'abc' },
  { s: 'a' },
  { s: 'ABCD' },
  { n: 5 },
  { n: 50 },
  { i: 2 },
  { i: 2.5 },
  { d: 'hi' },
  { b: true },
  { b: 'yes' },
  { t: '2024-01-01T00:00:00Z' },
  { t: 'not-a-date' },
  { e: 'a@b.com' },
  { e: 'nope' },
  { m: { k: 'v' } },
  { m: { k: 1 } },
  { a: { b: ['x'] } },
];

describe('jsonSchemaToZodRuntime', () => {
  describe('when given the schemas Studio receives', () => {
    it.each(Object.entries(schemas))(
      'accepts and rejects the same values as the evaluated schema for %s',
      (_name, jsonSchema) => {
        const evaluated = resolveViaEval(jsonSchema);
        const runtime = jsonSchemaToZodRuntime(jsonSchema);

        for (const value of values) {
          expect({ value, valid: runtime.safeParse(value).success }).toEqual({
            value,
            valid: evaluated.safeParse(value).success,
          });
        }
      },
    );

    it.each(Object.entries(schemas))(
      'infers the same form field types as the evaluated schema for %s',
      (_name, jsonSchema) => {
        const evaluatedShape = (resolveViaEval(jsonSchema) as z.ZodObject<any>).shape;
        const runtimeShape = (jsonSchemaToZodRuntime(jsonSchema) as z.ZodObject<any>).shape;

        expect(Object.keys(runtimeShape)).toEqual(Object.keys(evaluatedShape));
        for (const key of Object.keys(evaluatedShape)) {
          expect({ key, type: inferFieldType(runtimeShape[key]) }).toEqual({
            key,
            type: inferFieldType(evaluatedShape[key]),
          });
        }
      },
    );
  });

  describe('when the field drives specialized form rendering', () => {
    it('keeps a date-time string a date field rather than a plain text field', () => {
      const shape = (jsonSchemaToZodRuntime(schemas['a date-time string']!) as z.ZodObject<any>).shape;

      expect(inferFieldType(getBaseSchema(shape.t))).toBe('date');
    });

    it('keeps a dictionary a record field, so its entries are not discarded', () => {
      const shape = (jsonSchemaToZodRuntime(schemas['a dictionary of strings']!) as z.ZodObject<any>).shape;

      expect(inferFieldType(getBaseSchema(shape.m))).toBe('record');
      expect(jsonSchemaToZodRuntime(schemas['a dictionary of strings']!).parse({ m: { k: 'v' } })).toEqual({
        m: { k: 'v' },
      });
    });

    it('keeps an anyOf a union rather than an intersection', () => {
      const shape = (jsonSchemaToZodRuntime(schemas['an anyOf union']!) as z.ZodObject<any>).shape;

      expect(inferFieldType(getBaseSchema(shape.v))).toBe('union');
    });
  });

  describe('when the schema is unusable', () => {
    it('falls back to a permissive field instead of throwing, matching the generator', () => {
      expect(jsonSchemaToZodRuntime(undefined).safeParse('anything').success).toBe(true);
      expect(jsonSchemaToZodRuntime({ type: 'not-a-real-type' }).safeParse(123).success).toBe(true);
    });

    it('ignores a pattern that is not a valid JavaScript regex', () => {
      const schema = jsonSchemaToZodRuntime({ type: 'string', pattern: '(' });

      expect(schema.safeParse('anything').success).toBe(true);
    });
  });

  describe('when building the schema', () => {
    it('never compiles a string, so Studio does not need unsafe-eval', () => {
      const originalFunction = globalThis.Function;
      const calls: unknown[] = [];
      // @ts-expect-error deliberately replacing the constructor for the assertion
      globalThis.Function = (...args: unknown[]) => {
        calls.push(args);
        throw new Error('Function() was called');
      };

      try {
        for (const jsonSchema of Object.values(schemas)) {
          jsonSchemaToZodRuntime(jsonSchema);
        }
      } finally {
        globalThis.Function = originalFunction;
      }

      expect(calls).toEqual([]);
    });
  });
});

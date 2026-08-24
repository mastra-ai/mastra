import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { z as z4 } from 'zod-v4';

import { isEmptyZodObject } from '../is-empty-zod-object';

/**
 * Studio uses this to decide whether a tool/workflow input needs a form at all
 * (`dynamic-form` and `ToolExecutor`). Schemas reach it as either Zod v3 or v4,
 * so both versions are exercised through the compat layer.
 */
describe.each([
  ['zod v3', z],
  ['zod v4', z4],
] as const)('isEmptyZodObject with %s', (_label, lib) => {
  describe('when the schema is a plain object', () => {
    it('reports an object with no fields as empty', () => {
      expect(isEmptyZodObject(lib.object({}))).toBe(true);
    });

    it('reports an object with a field as not empty', () => {
      expect(isEmptyZodObject(lib.object({ query: lib.string() }))).toBe(false);
    });
  });

  describe('when the schema is an intersection', () => {
    it('reports an intersection of two empty objects as empty', () => {
      expect(isEmptyZodObject(lib.intersection(lib.object({}), lib.object({})))).toBe(true);
    });

    it('reports an intersection as not empty when the right side has fields', () => {
      expect(isEmptyZodObject(lib.intersection(lib.object({}), lib.object({ query: lib.string() })))).toBe(false);
    });

    it('reports an intersection as not empty when the left side has fields', () => {
      expect(isEmptyZodObject(lib.intersection(lib.object({ query: lib.string() }), lib.object({})))).toBe(false);
    });

    it('reports a nested intersection of empty objects as empty', () => {
      const nested = lib.intersection(lib.intersection(lib.object({}), lib.object({})), lib.object({}));
      expect(isEmptyZodObject(nested)).toBe(true);
    });
  });

  describe('when the schema is neither an object nor an intersection', () => {
    it('reports a string schema as not empty', () => {
      expect(isEmptyZodObject(lib.string())).toBe(false);
    });

    it('reports an array schema as not empty', () => {
      expect(isEmptyZodObject(lib.array(lib.string()))).toBe(false);
    });
  });
});

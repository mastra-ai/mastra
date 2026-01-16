import { describe, it, expect } from 'vitest';
import { deepMergeWorkingMemory } from './working-memory';

describe('deepMergeWorkingMemory', () => {
  describe('null/undefined/empty update handling', () => {
    it('should return shallow copy of existing when update is null', () => {
      const existing = { name: 'Alice', age: 30 };
      const result = deepMergeWorkingMemory(existing, null);

      expect(result).toEqual({ name: 'Alice', age: 30 });
      expect(result).not.toBe(existing); // Must be a new object
    });

    it('should return shallow copy of existing when update is undefined', () => {
      const existing = { name: 'Bob', location: 'NYC' };
      const result = deepMergeWorkingMemory(existing, undefined);

      expect(result).toEqual({ name: 'Bob', location: 'NYC' });
      expect(result).not.toBe(existing); // Must be a new object
    });

    it('should return shallow copy of existing when update is empty object', () => {
      const existing = { foo: 'bar', count: 42 };
      const result = deepMergeWorkingMemory(existing, {});

      expect(result).toEqual({ foo: 'bar', count: 42 });
      expect(result).not.toBe(existing); // Must be a new object
    });

    it('should return empty object when both existing and update are null', () => {
      const result = deepMergeWorkingMemory(null, null);

      expect(result).toEqual({});
    });

    it('should return empty object when existing is null and update is empty', () => {
      const result = deepMergeWorkingMemory(null, {});

      expect(result).toEqual({});
    });

    it('should return empty object when existing is undefined and update is null', () => {
      const result = deepMergeWorkingMemory(undefined, null);

      expect(result).toEqual({});
    });
  });

  describe('basic merging', () => {
    it('should merge new keys into existing object', () => {
      const existing = { name: 'Alice' };
      const update = { age: 25 };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ name: 'Alice', age: 25 });
      expect(result).not.toBe(existing);
    });

    it('should overwrite existing keys with update values', () => {
      const existing = { name: 'Alice', age: 25 };
      const update = { age: 26 };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ name: 'Alice', age: 26 });
    });

    it('should return update when existing is null', () => {
      const update = { name: 'Charlie', role: 'admin' };
      const result = deepMergeWorkingMemory(null, update);

      expect(result).toEqual({ name: 'Charlie', role: 'admin' });
    });

    it('should return update when existing is undefined', () => {
      const update = { status: 'active' };
      const result = deepMergeWorkingMemory(undefined, update);

      expect(result).toEqual({ status: 'active' });
    });
  });

  describe('null value deletion', () => {
    it('should delete property when update value is null', () => {
      const existing = { name: 'Alice', location: 'Seattle', age: 30 };
      const update = { location: null };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ name: 'Alice', age: 30 });
      expect('location' in result).toBe(false);
    });

    it('should delete multiple properties when multiple null values', () => {
      const existing = { a: 1, b: 2, c: 3, d: 4 };
      const update = { b: null, d: null };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ a: 1, c: 3 });
    });
  });

  describe('nested object merging', () => {
    it('should recursively merge nested objects', () => {
      const existing = {
        about: { name: 'Alice', location: 'NYC' },
        work: { company: 'Acme' },
      };
      const update = {
        about: { age: 30 },
      };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({
        about: { name: 'Alice', location: 'NYC', age: 30 },
        work: { company: 'Acme' },
      });
    });

    it('should overwrite nested values', () => {
      const existing = {
        about: { name: 'Alice', location: 'NYC' },
      };
      const update = {
        about: { location: 'LA' },
      };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({
        about: { name: 'Alice', location: 'LA' },
      });
    });

    it('should delete nested properties with null', () => {
      const existing = {
        about: { name: 'Alice', location: 'NYC', timezone: 'EST' },
      };
      const update = {
        about: { location: null },
      };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({
        about: { name: 'Alice', timezone: 'EST' },
      });
    });

    it('should create nested objects when they do not exist', () => {
      const existing = { name: 'Alice' };
      const update = { work: { company: 'Acme', role: 'Engineer' } };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({
        name: 'Alice',
        work: { company: 'Acme', role: 'Engineer' },
      });
    });
  });

  describe('array handling', () => {
    it('should replace arrays entirely instead of merging', () => {
      const existing = {
        people: [
          { name: 'Alice', role: 'manager' },
          { name: 'Bob', role: 'engineer' },
        ],
      };
      const update = {
        people: [{ name: 'Charlie', role: 'designer' }],
      };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({
        people: [{ name: 'Charlie', role: 'designer' }],
      });
    });

    it('should allow setting an array where none existed', () => {
      const existing = { name: 'Alice' };
      const update = { tags: ['important', 'vip'] };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({
        name: 'Alice',
        tags: ['important', 'vip'],
      });
    });

    it('should replace existing array with empty array', () => {
      const existing = { items: [1, 2, 3] };
      const update = { items: [] };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ items: [] });
    });
  });

  describe('type coercion edge cases', () => {
    it('should replace object with primitive', () => {
      const existing = { data: { nested: 'value' } };
      const update = { data: 'simple string' };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ data: 'simple string' });
    });

    it('should replace primitive with object', () => {
      const existing = { data: 'simple string' };
      const update = { data: { nested: 'value' } };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ data: { nested: 'value' } });
    });

    it('should replace array with object', () => {
      const existing = { data: [1, 2, 3] };
      const update = { data: { key: 'value' } };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ data: { key: 'value' } });
    });

    it('should replace object with array', () => {
      const existing = { data: { key: 'value' } };
      const update = { data: [1, 2, 3] };
      const result = deepMergeWorkingMemory(existing, update);

      expect(result).toEqual({ data: [1, 2, 3] });
    });
  });

  describe('immutability', () => {
    it('should not mutate the existing object', () => {
      const existing = { name: 'Alice', nested: { a: 1 } };
      const existingCopy = JSON.parse(JSON.stringify(existing));
      const update = { name: 'Bob', nested: { b: 2 } };

      deepMergeWorkingMemory(existing, update);

      expect(existing).toEqual(existingCopy);
    });

    it('should not mutate the update object', () => {
      const existing = { name: 'Alice' };
      const update = { age: 30, nested: { key: 'value' } };
      const updateCopy = JSON.parse(JSON.stringify(update));

      deepMergeWorkingMemory(existing, update);

      expect(update).toEqual(updateCopy);
    });
  });
});

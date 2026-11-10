import { describe, it, expect, beforeEach } from 'vitest';

import type { VectorizeVectorFilter } from './filter';
import { VectorizeFilterTranslator } from './filter';

describe('VectorizeFilterTranslator', () => {
  let translator: VectorizeFilterTranslator;

  beforeEach(() => {
    translator = new VectorizeFilterTranslator();
  });

  describe('translate', () => {
    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null)).toEqual(null);
      expect(translator.translate(undefined)).toEqual(undefined);
    });

    // Basic cases
    it('converts implicit equality to explicit $eq', () => {
      const filter: VectorizeVectorFilter = { field: 'value' };
      expect(translator.translate(filter)).toEqual({
        field: { $eq: 'value' },
      });
    });

    it('handles comparison operators', () => {
      const filter: VectorizeVectorFilter = {
        age: { $gt: 25 },
        price: { $lte: 100 },
        status: { $ne: 'inactive' },
        quantity: { $gte: 10 },
        rating: { $lt: 5 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles $in operator', () => {
      const filter: VectorizeVectorFilter = {
        tags: { $in: ['important', 'urgent'] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles $nin operator', () => {
      const filter: VectorizeVectorFilter = {
        status: { $nin: ['deleted', 'archived'] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles null values', () => {
      const filter: VectorizeVectorFilter = {
        field: null,
        other: { $eq: null },
      };
      expect(translator.translate(filter)).toEqual({
        field: { $eq: null },
        other: { $eq: null },
      });
    });

    it('handles empty objects', () => {
      const filter: VectorizeVectorFilter = { field: {} };
      expect(translator.translate(filter)).toEqual({ field: {} });
    });

    it('flattens nested objects to dot notation', () => {
      const filter = {
        user: {
          profile: {
            age: { $gt: 25 },
          },
        },
      };
      expect(translator.translate(filter)).toEqual({
        'user.profile.age': { $gt: 25 },
      });
    });

    it('normalizes date values', () => {
      const date = new Date('2024-01-01');
      const filter: VectorizeVectorFilter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual({
        timestamp: { $gt: date.toISOString() },
      });
    });

    it('handles multiple operators on same field', () => {
      const filter: VectorizeVectorFilter = {
        price: { $gt: 100, $lt: 200 },
        quantity: { $gte: 10, $lte: 20 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles arrays of mixed types', () => {
      const filter: VectorizeVectorFilter = {
        field: { $in: [123, 'string', true] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles empty arrays in $in and $nin', () => {
      const filter: VectorizeVectorFilter = {
        field1: { $in: [] },
        field2: { $nin: [] },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles deeply nested null values', () => {
      const filter = {
        user: {
          profile: {
            lastLogin: null,
            settings: { theme: { $eq: null } },
          },
        },
      };
      expect(translator.translate(filter)).toEqual({
        'user.profile.lastLogin': { $eq: null },
        'user.profile.settings.theme': { $eq: null },
      });
    });

    it('preserves order of multiple operators', () => {
      const filter: VectorizeVectorFilter = {
        field: {
          $gt: 0,
          $lt: 10,
        },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('preserves order of range operators', () => {
      // Valid range operator combinations
      const filters = [
        { field: { $gt: 0, $lt: 10 } },
        { field: { $gte: 0, $lte: 10 } },
        { field: { $gt: 0, $lte: 10 } },
        { field: { $gte: 0, $lt: 10 } },
      ];

      filters.forEach(filter => {
        expect(translator.translate(filter)).toEqual(filter);
      });
    });
  });

  describe('validate operators', () => {
    it('ensure all operator filters are supported', () => {
      const supportedFilters = [
        { field: { $eq: 'value' } },
        { field: { $ne: 'value' } },
        { field: { $gt: 'value' } },
        { field: { $gte: 'value' } },
        { field: { $lt: 'value' } },
        { field: { $lte: 'value' } },
        { field: { $in: ['value'] } },
        { field: { $nin: ['value'] } },
      ];
      supportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });
    it('throws error for unsupported operators', () => {
      const unsupportedFilters = [
        { field: { $regex: 'pattern' } },
        { field: { $exists: true } },
        { field: { $elemMatch: { $gt: 5 } } },
        { field: { $nor: [{ $eq: 'value' }] } },
        { field: { $not: [{ $eq: 'value' }] } },
        { field: { $regex: 'pattern', $options: 'i' } },
        { field: { $and: [{ $eq: 'value' }] } },
        { field: { $or: [{ $eq: 'value' }] } },
        { field: { $all: [{ $eq: 'value' }] } },
        { field: { $contains: 'value' } },
      ];

      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });
    it('throws error for regex operators', () => {
      const filter = { field: /pattern/i };
      expect(() => translator.translate(filter)).toThrow();
    });
    it('throws error for non-logical operators at top level', () => {
      const invalidFilters: any = [{ $gt: 100 }, { $in: ['value1', 'value2'] }, { $eq: true }];

      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Invalid top-level operator/);
      });
    });
  });

  // SemanticRecall and Memory.recall() send `{ $and: [scopeFilter, userFilter] }`. Vectorize ANDs
  // top-level keys, so a top-level `$and` of plain clauses becomes one object.
  describe('top-level $and', () => {
    it('merges clauses on different fields into one filter', () => {
      const filter: any = { $and: [{ resource_id: 'user-1' }, { projectId: { $eq: 'project-a' } }] };
      expect(translator.translate(filter)).toEqual({
        resource_id: { $eq: 'user-1' },
        projectId: { $eq: 'project-a' },
      });
    });

    it('merges different operators on the same field', () => {
      const filter: any = { $and: [{ score: { $gt: 1 } }, { score: { $lt: 5 } }] };
      expect(translator.translate(filter)).toEqual({ score: { $gt: 1, $lt: 5 } });
    });

    it('flattens nested fields inside a clause', () => {
      const filter: any = { $and: [{ thread_id: 't-1' }, { project: { stage: 'beta' } }] };
      expect(translator.translate(filter)).toEqual({
        thread_id: { $eq: 't-1' },
        'project.stage': { $eq: 'beta' },
      });
    });

    it('rejects clauses that set the same operator on the same field', () => {
      const filter: any = { $and: [{ resource_id: 'user-1' }, { resource_id: 'user-2' }] };
      expect(() => translator.translate(filter)).toThrow(/Vectorize/);
    });

    it.each([
      ['$eq with $in', [{ resource_id: 'u' }, { resource_id: { $in: ['u', 'v'] } }]],
      ['$ne with $nin', [{ tag: { $ne: 'a' } }, { tag: { $nin: ['b'] } }]],
      ['two lower bounds', [{ score: { $gt: 1 } }, { score: { $gte: 2 } }]],
      ['two upper bounds', [{ score: { $lt: 9 } }, { score: { $lte: 8 } }]],
    ])('rejects combining %s on one field, which Vectorize cannot run', (_name, clauses) => {
      expect(() => translator.translate({ $and: clauses } as any)).toThrow(/Vectorize/);
    });

    it('accepts one lower and one upper bound on a field', () => {
      const filter: any = { $and: [{ score: { $gte: 1 } }, { score: { $lte: 5 } }] };
      expect(translator.translate(filter)).toEqual({ score: { $gte: 1, $lte: 5 } });
    });

    it.each([
      ['an array', []],
      ['an array of values', ['x']],
      ['a number', 5],
      ['a string', 'x'],
    ])('rejects a clause that is %s', (_name, clause) => {
      expect(() => translator.translate({ $and: [{ resource_id: 'u' }, clause] } as any)).toThrow(/clause/);
    });

    it('treats empty, null and undefined clauses as no condition', () => {
      const filter: any = { $and: [{ resource_id: 'u' }, {}, null, undefined] };
      expect(translator.translate(filter)).toEqual({ resource_id: { $eq: 'u' } });
    });

    it('still rejects $and clauses that use logical operators', () => {
      const filter: any = { $and: [{ a: 1 }, { $or: [{ b: 1 }, { c: 2 }] }] };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('still rejects $and next to other top-level keys', () => {
      const filter: any = { $and: [{ a: 1 }], b: 2 };
      expect(() => translator.translate(filter)).toThrow();
    });
  });
});

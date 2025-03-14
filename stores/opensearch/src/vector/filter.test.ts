import { beforeEach, describe, expect, it } from 'vitest';

import { OpenSearchFilterTranslator } from './filter';

describe('OpenSearchFilterTranslator', () => {
  let translator: OpenSearchFilterTranslator;

  beforeEach(() => {
    translator = new OpenSearchFilterTranslator();
  });

  // Basic Filter Operations
  describe('basic operations', () => {
    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual({});
      expect(translator.translate(null as any)).toEqual(null);
      expect(translator.translate(undefined as any)).toEqual(undefined);
    });

    it('translates simple field equality to term query', () => {
      const filter = { field: 'value' };
      expect(translator.translate(filter)).toEqual({
        term: { 'metadata.field.keyword': 'value' },
      });
    });

    it('translates multiple top-level fields to bool must', () => {
      const filter = { field1: 'value1', field2: 'value2' };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [{ term: { 'metadata.field1.keyword': 'value1' } }, { term: { 'metadata.field2.keyword': 'value2' } }],
        },
      });
    });

    it('handles nested objects', () => {
      const filter = {
        user: {
          profile: {
            age: 25,
            name: 'John',
          },
        },
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [
            {
              bool: {
                must: [
                  { term: { 'metadata.user.profile.age': 25 } },
                  { term: { 'metadata.user.profile.name.keyword': 'John' } },
                ],
              },
            },
          ],
        },
      });
    });
  });

  // Comparison Operators
  describe('comparison operators', () => {
    it('translates $eq operator', () => {
      const filter = { field: { $eq: 'value' } };
      expect(translator.translate(filter)).toEqual({
        term: { 'metadata.field.keyword': 'value' },
      });
    });

    it('translates $ne operator', () => {
      const filter = { field: { $ne: 'value' } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ term: { 'metadata.field.keyword': 'value' } }],
        },
      });
    });

    it('handles date values', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual({
        range: { 'metadata.timestamp': { gt: date.toISOString() } },
      });
    });
  });

  // Logical Operators
  describe('logical operators', () => {
    it('translates $and operator', () => {
      const filter = {
        $and: [{ field1: 'value1' }, { field2: 'value2' }],
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [{ term: { 'metadata.field1.keyword': 'value1' } }, { term: { 'metadata.field2.keyword': 'value2' } }],
        },
      });
    });

    it('translates $or operator', () => {
      const filter = {
        $or: [{ field1: 'value1' }, { field2: 'value2' }],
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          should: [
            { term: { 'metadata.field1.keyword': 'value1' } },
            { term: { 'metadata.field2.keyword': 'value2' } },
          ],
        },
      });
    });

    it('translates $not operator', () => {
      const filter = {
        $not: { field: 'value' },
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ term: { 'metadata.field.keyword': 'value' } }],
        },
      });
    });

    it('handles nested logical operators', () => {
      const filter = {
        $and: [
          { field1: 'value1' },
          {
            $or: [{ field2: 'value2' }, { field3: 'value3' }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [
            { term: { 'metadata.field1.keyword': 'value1' } },
            {
              bool: {
                should: [
                  { term: { 'metadata.field2.keyword': 'value2' } },
                  { term: { 'metadata.field3.keyword': 'value3' } },
                ],
              },
            },
          ],
        },
      });
    });
  });

  // Array Operators
  describe('array operators', () => {
    it('translates $in operator', () => {
      const filter = { field: { $in: ['value1', 'value2'] } };
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.field.keyword': ['value1', 'value2'] },
      });
    });

    it('translates $nin operator', () => {
      const filter = { field: { $nin: ['value1', 'value2'] } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ terms: { 'metadata.field.keyword': ['value1', 'value2'] } }],
        },
      });
    });

    it('translates $all operator', () => {
      const filter = { field: { $all: ['value1', 'value2'] } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [{ term: { 'metadata.field.keyword': 'value1' } }, { term: { 'metadata.field.keyword': 'value2' } }],
        },
      });
    });

    it('handles empty arrays', () => {
      const filter = { field: { $in: [] } };
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.field.keyword': [] },
      });
    });
  });

  // Element Operators
  describe('element operators', () => {
    it('translates $exists operator', () => {
      const filter = { field: { $exists: true } };
      expect(translator.translate(filter)).toEqual({
        exists: { field: 'metadata.field' },
      });
    });

    it('translates $exists operator with false', () => {
      const filter = { field: { $exists: false } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ exists: { field: 'metadata.field' } }],
        },
      });
    });
  });

  // Regex Operators
  describe('regex operators', () => {
    it('translates $regex operator', () => {
      const filter = { field: { $regex: 'pattern' } };
      expect(translator.translate(filter)).toEqual({
        regexp: { 'metadata.field': 'pattern' },
      });
    });
  });

  // Complex Queries
  describe('complex queries', () => {
    it('translates mixed operators', () => {
      const filter = {
        $and: [{ field1: { $gt: 10 } }, { field2: { $in: ['value1', 'value2'] } }, { field3: { $exists: true } }],
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [
            { range: { 'metadata.field1': { gt: 10 } } },
            { terms: { 'metadata.field2.keyword': ['value1', 'value2'] } },
            { exists: { field: 'metadata.field3' } },
          ],
        },
      });
    });

    it('translates complex nested queries', () => {
      const filter = {
        $and: [
          { status: 'active' },
          {
            $or: [{ age: { $gt: 25 } }, { role: { $in: ['admin', 'manager'] } }],
          },
          {
            $not: {
              $and: [{ deleted: true }, { archived: true }],
            },
          },
        ],
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [
            { term: { 'metadata.status.keyword': 'active' } },
            {
              bool: {
                should: [
                  { range: { 'metadata.age': { gt: 25 } } },
                  { terms: { 'metadata.role.keyword': ['admin', 'manager'] } },
                ],
              },
            },
            {
              bool: {
                must_not: [
                  {
                    bool: {
                      must: [{ term: { 'metadata.deleted': true } }, { term: { 'metadata.archived': true } }],
                    },
                  },
                ],
              },
            },
          ],
        },
      });
    });
  });

  // Error Cases
  describe('error cases', () => {
    it('throws error for unsupported operators', () => {
      const filter = { field: { $unsupported: 'value' } };
      expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
    });

    it('throws error for invalid logical operator structure', () => {
      const filter = { $and: 'invalid' };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('throws error for invalid array operator values', () => {
      const filter = { field: { $in: 'not-an-array' } };
      expect(() => translator.translate(filter)).toThrow();
    });
  });

  describe('field type handling', () => {
    it('adds .keyword suffix for string fields', () => {
      const filter = { field: 'value' };
      expect(translator.translate(filter)).toEqual({
        term: { 'metadata.field.keyword': 'value' },
      });
    });

    it('adds .keyword suffix for string array fields', () => {
      const filter = { field: { $in: ['value1', 'value2'] } };
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.field.keyword': ['value1', 'value2'] },
      });
    });

    it('does not add .keyword suffix for numeric fields', () => {
      const filter = { field: 123 };
      expect(translator.translate(filter)).toEqual({
        term: { 'metadata.field': 123 },
      });
    });

    it('does not add .keyword suffix for numeric array fields', () => {
      const filter = { field: { $in: [1, 2, 3] } };
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.field': [1, 2, 3] },
      });
    });

    it('handles mixed field types in complex queries', () => {
      const filter = {
        $and: [
          { textField: 'value' },
          { numericField: 123 },
          { arrayField: { $in: ['a', 'b'] } },
          { numericArray: { $in: [1, 2] } },
        ],
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [
            { term: { 'metadata.textField.keyword': 'value' } },
            { term: { 'metadata.numericField': 123 } },
            { terms: { 'metadata.arrayField.keyword': ['a', 'b'] } },
            { terms: { 'metadata.numericArray': [1, 2] } },
          ],
        },
      });
    });
  });
});

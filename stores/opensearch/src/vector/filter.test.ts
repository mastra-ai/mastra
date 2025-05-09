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
      expect(translator.translate({})).toEqual(undefined);
      expect(translator.translate(null as any)).toEqual(undefined);
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

    it('translates $not with $eq operator', () => {
      const filter = { field: { $not: { $eq: 'value' } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ term: { 'metadata.field.keyword': 'value' } }],
        },
      });
    });

    it('translates $not with $ne operator', () => {
      const filter = { field: { $not: { $ne: 'value' } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              bool: {
                must_not: [{ term: { 'metadata.field.keyword': 'value' } }],
              },
            },
          ],
        },
      });
    });

    it('translates $not with $eq null', () => {
      const filter = { field: { $not: { $eq: null } } };
      expect(translator.translate(filter)).toEqual({
        exists: { field: 'metadata.field' },
      });
    });

    it('translates $not with $ne null', () => {
      const filter = { field: { $not: { $ne: null } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ exists: { field: 'metadata.field' } }],
        },
      });
    });

    it('translates $not with nested fields', () => {
      const filter = { 'user.profile.age': { $not: { $gt: 25 } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              range: { 'metadata.user.profile.age': { gt: 25 } },
            },
          ],
        },
      });
    });

    it('translates $not with multiple operators', () => {
      const filter = { price: { $not: { $gte: 30, $lte: 70 } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              range: { 'metadata.price': { gte: 30, lte: 70 } },
            },
          ],
        },
      });
    });

    it('handles empty $and array', () => {
      const filter = {
        $and: [],
      };
      // Empty $and should match everything
      expect(translator.translate(filter)).toEqual({ match_all: {} });
    });

    it('handles empty $or array', () => {
      const filter = {
        $or: [],
      };
      // Empty $or should match nothing
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ match_all: {} }],
        },
      });
    });

    it('throws error for empty $not condition', () => {
      const filter = {
        $not: {},
      };
      expect(() => translator.translate(filter)).toThrow('not operator cannot be empty');
    });

    it('handles $not with comparison operators', () => {
      const filter = {
        price: { $not: { $gt: 100 } },
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ range: { 'metadata.price': { gt: 100 } } }],
        },
      });
    });

    it('handles nested $not with $or', () => {
      const filter = {
        $not: { $or: [{ category: 'electronics' }, { category: 'books' }] },
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              bool: {
                should: [
                  { term: { 'metadata.category.keyword': 'electronics' } },
                  { term: { 'metadata.category.keyword': 'books' } },
                ],
              },
            },
          ],
        },
      });
    });

    it('handles $not with $not operator', () => {
      const filter = {
        $not: { $not: { category: 'electronics' } },
      };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              bool: {
                must_not: [{ term: { 'metadata.category.keyword': 'electronics' } }],
              },
            },
          ],
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

    it('handles empty $in array', () => {
      const filter = { field: { $in: [] } };
      // Empty $in should match nothing (empty terms)
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.field.keyword': [] },
      });
    });

    it('handles empty $nin array', () => {
      const filter = { field: { $nin: [] } };
      // Empty $nin should match everything
      expect(translator.translate(filter)).toEqual({
        match_all: {},
      });
    });

    it('handles empty $all array', () => {
      const filter = { field: { $all: [] } };
      // Empty $all should match nothing
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [{ match_all: {} }],
        },
      });
    });

    it('handles $not with array operators', () => {
      const filter = { tags: { $not: { $in: ['premium', 'new'] } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              terms: { 'metadata.tags.keyword': ['premium', 'new'] },
            },
          ],
        },
      });
    });

    it('handles $not with empty array operators', () => {
      const filter = { tags: { $not: { $in: [] } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              terms: { 'metadata.tags.keyword': [] },
            },
          ],
        },
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

    it('handles $regex with start anchor', () => {
      const filter = { category: { $regex: '^elect' } };
      // Should use wildcard for better anchor handling
      expect(translator.translate(filter)).toEqual({
        wildcard: { 'metadata.category': 'elect*' },
      });
    });

    it('handles $regex with end anchor', () => {
      const filter = { category: { $regex: 'nics$' } };
      // Should use wildcard for better anchor handling
      expect(translator.translate(filter)).toEqual({
        wildcard: { 'metadata.category': '*nics' },
      });
    });

    it('handles $regex with both anchors', () => {
      const filter = { category: { $regex: '^electronics$' } };
      // Should use exact match for both anchors
      expect(translator.translate(filter)).toEqual({
        wildcard: { 'metadata.category': 'electronics' },
      });
    });

    it('handles $not with $regex operator', () => {
      const filter = { category: { $not: { $regex: '^elect' } } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must_not: [
            {
              wildcard: { 'metadata.category': 'elect*' },
            },
          ],
        },
      });
    });
  });

  // Complex Queries
  describe('complex queries', () => {
    it('translates numeric operators', () => {
      const filter = { price: { $gt: 70, $lte: 100 } };
      expect(translator.translate(filter)).toEqual({
        range: { 'metadata.price': { gt: 70, lte: 100 } },
      });
    });

    it('translates multiple range operators on the same field', () => {
      const filter = { price: { $gte: 50, $lt: 200 } };
      expect(translator.translate(filter)).toEqual({
        range: { 'metadata.price': { gte: 50, lt: 200 } },
      });
    });

    it('translates all four range operators combined', () => {
      // This is an edge case that would never occur in practice, but tests the implementation
      const filter = { value: { $gt: 10, $gte: 20, $lt: 100, $lte: 90 } };
      expect(translator.translate(filter)).toEqual({
        range: { 'metadata.value': { gt: 10, gte: 20, lt: 100, lte: 90 } },
      });
    });

    it('translates mixed numeric and non-numeric operators', () => {
      const filter = { price: { $gt: 50, $exists: true } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [{ range: { 'metadata.price': { gt: 50 } } }, { exists: { field: 'metadata.price' } }],
        },
      });
    });
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

    it('throws error for nested invalid operators', () => {
      const filter = { user: { profile: { age: { $invalid: 25 } } } };
      expect(() => translator.translate(filter)).toThrow();
    });
  });

  describe('special values', () => {
    it('handles boolean values', () => {
      const filter = { active: true, disabled: false };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [{ term: { 'metadata.active': true } }, { term: { 'metadata.disabled': false } }],
        },
      });
    });

    it('handles null values', () => {
      const filter = { field: null };
      expect(translator.translate(filter)).toEqual({
        term: { 'metadata.field': null },
      });
    });
  });

  describe('array handling', () => {
    it('translates array values to terms query', () => {
      const filter = { tags: ['premium', 'new'] };
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.tags.keyword': ['premium', 'new'] },
      });
    });

    it('translates numeric array values to terms query', () => {
      const filter = { scores: [90, 95, 100] };
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.scores': [90, 95, 100] },
      });
    });

    it('translates empty array values to empty terms query', () => {
      const filter = { tags: [] };
      expect(translator.translate(filter)).toEqual({
        terms: { 'metadata.tags.keyword': [] },
      });
    });

    it('handles nested arrays in objects', () => {
      const filter = { user: { interests: ['sports', 'music'] } };
      expect(translator.translate(filter)).toEqual({
        bool: {
          must: [
            {
              term: {
                'metadata.user.interests.keyword': ['sports', 'music'],
              },
            },
          ],
        },
      });
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

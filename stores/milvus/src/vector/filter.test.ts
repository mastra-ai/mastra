import { describe, it, expect, beforeEach } from 'vitest';

import { MilvusFilterTranslator } from './filter';

describe('MilvusFilterTranslator', () => {
  let translator: MilvusFilterTranslator;

  beforeEach(() => {
    translator = new MilvusFilterTranslator();
  });

  // Basic Filter Operations
  describe('basic operations', () => {
    it('handles empty filters', () => {
      expect(translator.translate({})).toEqual('');
      expect(translator.translate(null as any)).toEqual('');
      expect(translator.translate(undefined as any)).toEqual('');
    });

    it('translates equality operation', () => {
      const filter = { field: 'value' };
      expect(translator.translate(filter)).toEqual('metadata["field"] == \'value\'');
    });

    it('translates numeric equality operation', () => {
      const filter = { count: 42 };
      expect(translator.translate(filter)).toEqual('metadata["count"] == 42');
    });

    it('translates boolean equality operation', () => {
      const filter = { active: true };
      expect(translator.translate(filter)).toEqual('metadata["active"] == true');
    });

    it('combines multiple fields with AND', () => {
      const filter = {
        field1: 'value1',
        field2: 'value2',
      };
      expect(translator.translate(filter)).toEqual(
        'metadata["field1"] == \'value1\' AND metadata["field2"] == \'value2\'',
      );
    });

    it('handles comparison operators', () => {
      const filter = {
        price: { $gt: 100 },
      };
      expect(translator.translate(filter)).toEqual('metadata["price"] > 100');
    });

    it('handles multiple operators on same field', () => {
      const filter = {
        price: { $gt: 100, $lt: 200 },
        quantity: { $gte: 10, $lte: 20 },
      };
      expect(translator.translate(filter)).toEqual(
        'metadata["price"] > 100 AND metadata["price"] < 200 AND metadata["quantity"] >= 10 AND metadata["quantity"] <= 20',
      );
    });

    it('handles date values', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: date };
      expect(translator.translate(filter)).toEqual(`metadata["timestamp"] == timestamp '${date.toISOString()}'`);
    });

    it('handles date comparison operators', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual(`metadata["timestamp"] > timestamp '${date.toISOString()}'`);
    });
  });

  // Array Operations
  describe('array operations', () => {
    it('translates arrays to IN operator', () => {
      const filter = { tags: ['tag1', 'tag2'] };
      expect(translator.translate(filter)).toEqual("metadata[\"tags\"] IN ['tag1', 'tag2']");
    });

    it('handles numeric arrays', () => {
      const filter = { ids: [1, 2, 3] };
      expect(translator.translate(filter)).toEqual('metadata["ids"] IN [1, 2, 3]');
    });

    it('handles empty array values', () => {
      const filter = { tags: [] };
      expect(translator.translate(filter)).toEqual('false'); // Empty IN is usually false
    });

    it('handles explicit $in operator', () => {
      const filter = { tags: { $in: ['tag1', 'tag2'] } };
      expect(translator.translate(filter)).toEqual("metadata[\"tags\"] IN ['tag1', 'tag2']");
    });

    it('handles $in with mixed type values', () => {
      const filter = { field: { $in: [1, 'two', true] } };
      expect(translator.translate(filter)).toEqual('metadata["field"] IN [1, \'two\', true]');
    });

    it('handles $in with date values', () => {
      const date = new Date('2024-01-01');
      const filter = { field: { $in: [date] } };
      expect(translator.translate(filter)).toEqual(`metadata["field"] IN [timestamp '${date.toISOString()}']`);
    });
  });

  // Logical Operators
  describe('logical operators', () => {
    it('handles $and operator', () => {
      const filter = {
        $and: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual('metadata["status"] == \'active\' AND metadata["age"] > 25');
    });

    it('handles $or operator', () => {
      const filter = {
        $or: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual('(metadata["status"] == \'active\' OR metadata["age"] > 25)');
    });

    it('handles $not operator', () => {
      const filter = {
        $not: { color: 'green' },
      };
      expect(translator.translate(filter)).toEqual('NOT (metadata["color"] == \'green\')');
    });

    it('handles $not operator with comparison', () => {
      const filter = {
        $not: { price: { $gt: 100 } },
      };
      expect(translator.translate(filter)).toEqual('NOT (metadata["price"] > 100)');
    });

    it('handles $not operator with complex conditions', () => {
      const filter = {
        $not: {
          $or: [{ category: 'news' }, { importance: { $gt: 8 } }],
        },
      };
      expect(translator.translate(filter)).toEqual(
        'NOT (metadata["category"] == \'news\' OR metadata["importance"] > 8)',
      );
    });

    it('handles nested logical operators', () => {
      const filter = {
        $and: [
          { status: 'active' },
          {
            $or: [{ category: { $in: ['A', 'B'] } }, { price: { $gt: 100 } }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(
        'metadata["status"] == \'active\' AND (metadata["category"] IN [\'A\', \'B\'] OR metadata["price"] > 100)',
      );
    });

    it('handles complex nested conditions', () => {
      const filter = {
        $or: [
          { age: { $gt: 25 } },
          {
            $and: [{ status: 'active' }, { theme: 'dark' }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(
        '(metadata["age"] > 25 OR metadata["status"] == \'active\' AND metadata["theme"] == \'dark\')',
      );
    });

    it('handles $not operator with equality', () => {
      const filter = { field: { $ne: 'value' } };
      expect(translator.translate(filter)).toEqual('metadata["field"] != \'value\'');
    });

    it('handles IS NULL conditions', () => {
      const filter = { field: null };
      expect(translator.translate(filter)).toEqual('metadata["field"] IS NULL');
    });

    it('handles IS NOT NULL conditions', () => {
      const filter = { field: { $ne: null } };
      expect(translator.translate(filter)).toEqual('metadata["field"] IS NOT NULL');
    });
  });

  // Invalid Nested Fields and Objects
  describe('invalid nested fields and objects', () => {
    it('throws error for fields with dot notation', () => {
      const filter = { 'user.profile.name': 'John' };
      expect(() => translator.translate(filter)).toThrow(/Nested fields with dot notation are not supported/);
    });

    it('throws error for nested objects', () => {
      const filter = {
        user: {
          name: 'John',
        },
      };
      expect(() => translator.translate(filter)).toThrow(/Nested objects are not supported/);
    });

    it('throws error for deeply nested objects', () => {
      const filter = {
        user: {
          profile: {
            age: { $gt: 25 },
          },
        },
      };
      expect(() => translator.translate(filter)).toThrow(/Nested objects are not supported/);
    });

    it('allows id fields with dot notation', () => {
      const filter = { 'id.subfield': 'value' };
      // This should not throw as id is in the nonMetadataFields list
      expect(translator.translate(filter)).toEqual("id.subfield == 'value'");
    });

    it('allows vectors fields with dot notation', () => {
      const filter = { 'vectors.dimension': 128 };
      // This should not throw as vectors is in the nonMetadataFields list
      expect(translator.translate(filter)).toEqual('vectors.dimension == 128');
    });
  });

  // Special Operators
  describe('special operators', () => {
    it('handles LIKE operator', () => {
      const filter = { name: { $like: '%John%' } };
      expect(translator.translate(filter)).toEqual('metadata["name"] LIKE \'%John%\'');
    });

    it('handles NOT LIKE operator', () => {
      const filter = { name: { $notLike: '%John%' } };
      expect(translator.translate(filter)).toEqual('metadata["name"] NOT LIKE \'%John%\'');
    });

    it('converts regex starts-with pattern to LIKE', () => {
      const filter = { name: { $regex: '^John' } };
      expect(translator.translate(filter)).toEqual('metadata["name"] LIKE \'John%\'');
    });

    it('converts regex ends-with pattern to LIKE', () => {
      const filter = { name: { $regex: 'Smith$' } };
      expect(translator.translate(filter)).toEqual('metadata["name"] LIKE \'%Smith\'');
    });

    it('converts regex contains pattern to LIKE', () => {
      const filter = { name: { $regex: 'middle' } };
      expect(translator.translate(filter)).toEqual('metadata["name"] LIKE \'%middle%\'');
    });
  });

  // JSON Operators
  describe('json operators', () => {
    it('handles json_contains with string value', () => {
      const filter = { tags: { $jsonContains: 'sale' } };
      expect(translator.translate(filter)).toEqual('json_contains(metadata["tags"], "sale")');
    });

    it('handles json_contains with object value', () => {
      const filter = { product: { $jsonContains: { price: 100 } } };
      expect(translator.translate(filter)).toEqual('json_contains(metadata["product"], {"price": 100})');
    });

    it('handles json_contains_all with array value', () => {
      const filter = { tags: { $jsonContainsAll: ['electronics', 'sale', 'new'] } };
      expect(translator.translate(filter)).toEqual(
        'json_contains_all(metadata["tags"], ["electronics", "sale", "new"])',
      );
    });

    it('handles json_contains_any with array value', () => {
      const filter = { tags: { $jsonContainsAny: ['electronics', 'new', 'clearance'] } };
      expect(translator.translate(filter)).toEqual(
        'json_contains_any(metadata["tags"], ["electronics", "new", "clearance"])',
      );
    });

    it('handles json operators with complex nested values', () => {
      const filter = {
        products: {
          $jsonContains: {
            items: [
              { name: 'Laptop', price: 999 },
              { name: 'Mouse', price: 25 },
            ],
          },
        },
      };
      expect(translator.translate(filter)).toEqual(
        'json_contains(metadata["products"], {"items": [{"name": "Laptop", "price": 999}, {"name": "Mouse", "price": 25}]})',
      );
    });

    it('handles json operators with non-metadata fields', () => {
      const filter = { id: { $jsonContains: 'prefix-' } };
      expect(translator.translate(filter)).toEqual('json_contains(id, "prefix-")');
    });

    it('handles json operators in combination with other operators', () => {
      const filter = {
        $and: [{ tags: { $jsonContainsAny: ['electronics', 'new'] } }, { price: { $lt: 1000 } }],
      };
      expect(translator.translate(filter)).toEqual(
        'json_contains_any(metadata["tags"], ["electronics", "new"]) AND metadata["price"] < 1000',
      );
    });
  });

  // Operator Validation
  describe('operator validation', () => {
    it('validates supported comparison operators', () => {
      const supportedFilters = [
        { field: { $eq: 'value' } },
        { field: { $ne: 'value' } },
        { field: { $gt: 'value' } },
        { field: { $gte: 'value' } },
        { field: { $lt: 'value' } },
        { field: { $lte: 'value' } },
        { field: { $in: ['value'] } },
        { field: { $like: '%value%' } },
        { field: { $notLike: '%value%' } },
        { field: { $regex: 'pattern' } },
      ];
      supportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });

    it('throws error for unsupported operators', () => {
      const unsupportedFilters = [
        { field: { $contains: 'value' } },
        { field: { $all: ['value'] } },
        { field: { $elemMatch: { $gt: 5 } } },
        { field: { $nor: [{ $eq: 'value' }] } },
        { field: { $type: 'string' } },
        { field: { $mod: [5, 0] } },
        { field: { $size: 3 } },
      ];

      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });

    it('throws error for invalid operators at top level', () => {
      const invalidFilters = [{ $gt: 100 }, { $in: ['value1', 'value2'] }, { $like: '%pattern%' }];

      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Invalid top-level operator/);
      });
    });

    it('handles backtick escaping for special column names', () => {
      const filter = {
        CUBE: 10,
        'Upper-Case-Name': 'Test',
        'column name with space': 'value',
      };
      expect(translator.translate(filter)).toEqual(
        'metadata["CUBE"] == 10 AND metadata["Upper-Case-Name"] == \'Test\' AND metadata["column name with space"] == \'value\'',
      );
    });

    it('throws error for field names with periods that are not nested fields', () => {
      const filter = {
        'field.with..period': 'value', // Using double dots to ensure it's invalid
      };
      expect(() => translator.translate(filter)).toThrow(/Nested fields with dot notation are not supported/);
    });
  });

  // Type and value handling
  describe('type handling', () => {
    it('handles boolean values correctly', () => {
      expect(translator.translate({ active: true })).toEqual('metadata["active"] == true');
      expect(translator.translate({ active: false })).toEqual('metadata["active"] == false');
    });

    it('handles numeric types correctly', () => {
      expect(translator.translate({ int: 42 })).toEqual('metadata["int"] == 42');
      expect(translator.translate({ float: 3.14 })).toEqual('metadata["float"] == 3.14');
    });

    it('handles string values with proper quoting', () => {
      expect(translator.translate({ name: 'John' })).toEqual('metadata["name"] == \'John\'');
      expect(translator.translate({ text: "O'Reilly" })).toEqual("metadata[\"text\"] == 'O''Reilly'"); // SQL escaping
    });

    it('handles special SQL data types', () => {
      const date = new Date('2024-01-01');
      expect(translator.translate({ date_col: date })).toEqual(
        `metadata["date_col"] == timestamp '${date.toISOString()}'`,
      );
    });
  });

  // Milvus-specific filters
  describe('milvus-specific filtering', () => {
    it('handles JSON field filtering', () => {
      const filter = { price: { $gt: 100 } };
      expect(translator.translate(filter)).toEqual('metadata["price"] > 100');
    });

    it('throws error for nested JSON fields with dot notation', () => {
      const filter = { 'product.price': { $lt: 200 } };
      expect(() => translator.translate(filter)).toThrow(/Nested fields with dot notation are not supported/);
    });

    it('handles combined metadata and field filtering', () => {
      const filter = {
        id: 'doc123',
        tags: { $in: ['important', 'urgent'] },
      };
      expect(translator.translate(filter)).toEqual("id == 'doc123' AND metadata[\"tags\"] IN ['important', 'urgent']");
    });

    it('handles complex metadata filtering conditions', () => {
      const filter = {
        $and: [
          { id: { $in: ['doc1', 'doc2', 'doc3'] } },
          {
            $or: [{ category: 'news' }, { importance: { $gt: 8 } }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(
        "id IN ['doc1', 'doc2', 'doc3'] AND (metadata[\"category\"] == 'news' OR metadata[\"importance\"] > 8)",
      );
    });

    it('does not transform id and vectors fields', () => {
      const filter = {
        id: 'doc1',
        vectors: [1, 2, 3],
      };
      expect(translator.translate(filter)).toEqual("id == 'doc1' AND vectors IN [1, 2, 3]");
    });
  });
});

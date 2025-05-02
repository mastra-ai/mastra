import { describe, it, expect, beforeEach } from 'vitest';

import { LanceFilterTranslator } from './filter';

describe('LanceFilterTranslator', () => {
  let translator: LanceFilterTranslator;

  beforeEach(() => {
    translator = new LanceFilterTranslator();
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
      expect(translator.translate(filter)).toEqual("field = 'value'");
    });

    it('translates numeric equality operation', () => {
      const filter = { count: 42 };
      expect(translator.translate(filter)).toEqual('count = 42');
    });

    it('translates boolean equality operation', () => {
      const filter = { active: true };
      expect(translator.translate(filter)).toEqual('active = true');
    });

    it('combines multiple fields with AND', () => {
      const filter = {
        field1: 'value1',
        field2: 'value2',
      };
      expect(translator.translate(filter)).toEqual("field1 = 'value1' AND field2 = 'value2'");
    });

    it('handles comparison operators', () => {
      const filter = {
        price: { $gt: 100 },
      };
      expect(translator.translate(filter)).toEqual('price > 100');
    });

    it('handles multiple operators on same field', () => {
      const filter = {
        price: { $gt: 100, $lt: 200 },
        quantity: { $gte: 10, $lte: 20 },
      };
      expect(translator.translate(filter)).toEqual('price > 100 AND price < 200 AND quantity >= 10 AND quantity <= 20');
    });

    it('handles date values', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: date };
      expect(translator.translate(filter)).toEqual(`timestamp = timestamp '${date.toISOString()}'`);
    });

    it('handles date comparison operators', () => {
      const date = new Date('2024-01-01');
      const filter = { timestamp: { $gt: date } };
      expect(translator.translate(filter)).toEqual(`timestamp > timestamp '${date.toISOString()}'`);
    });
  });

  // Array Operations
  describe('array operations', () => {
    it('translates arrays to IN operator', () => {
      const filter = { tags: ['tag1', 'tag2'] };
      expect(translator.translate(filter)).toEqual("tags IN ('tag1', 'tag2')");
    });

    it('handles numeric arrays', () => {
      const filter = { ids: [1, 2, 3] };
      expect(translator.translate(filter)).toEqual('ids IN (1, 2, 3)');
    });

    it('handles empty array values', () => {
      const filter = { tags: [] };
      expect(translator.translate(filter)).toEqual('false'); // Empty IN is usually false in SQL
    });

    it('handles explicit $in operator', () => {
      const filter = { tags: { $in: ['tag1', 'tag2'] } };
      expect(translator.translate(filter)).toEqual("tags IN ('tag1', 'tag2')");
    });

    it('handles $in with mixed type values', () => {
      const filter = { field: { $in: [1, 'two', true] } };
      expect(translator.translate(filter)).toEqual("field IN (1, 'two', true)");
    });

    it('handles $in with date values', () => {
      const date = new Date('2024-01-01');
      const filter = { field: { $in: [date] } };
      expect(translator.translate(filter)).toEqual(`field IN (timestamp '${date.toISOString()}')`);
    });
  });

  // Logical Operators
  describe('logical operators', () => {
    it('handles $and operator', () => {
      const filter = {
        $and: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual("status = 'active' AND age > 25");
    });

    it('handles $or operator', () => {
      const filter = {
        $or: [{ status: 'active' }, { age: { $gt: 25 } }],
      };
      expect(translator.translate(filter)).toEqual("status = 'active' OR age > 25");
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
      expect(translator.translate(filter)).toEqual("status = 'active' AND (category IN ('A', 'B') OR price > 100)");
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
      expect(translator.translate(filter)).toEqual("age > 25 OR (status = 'active' AND theme = 'dark')");
    });

    it('handles $not operator with equality', () => {
      const filter = { field: { $ne: 'value' } };
      expect(translator.translate(filter)).toEqual("field != 'value'");
    });

    it('handles IS NULL conditions', () => {
      const filter = { field: null };
      expect(translator.translate(filter)).toEqual('field IS NULL');
    });

    it('handles IS NOT NULL conditions', () => {
      const filter = { field: { $ne: null } };
      expect(translator.translate(filter)).toEqual('field IS NOT NULL');
    });
  });

  // Nested Objects and Fields
  describe('nested objects and fields', () => {
    it('converts nested objects to dot notation in SQL', () => {
      const filter = {
        user: {
          profile: {
            age: { $gt: 25 },
          },
        },
      };
      expect(translator.translate(filter)).toEqual('user.profile.age > 25');
    });

    it('handles nested object equality', () => {
      const filter = {
        'user.profile.name': 'John',
      };
      expect(translator.translate(filter)).toEqual("user.profile.name = 'John'");
    });

    it('handles mixed nesting patterns', () => {
      const filter = {
        user: {
          'profile.age': { $gt: 25 },
          name: 'John',
        },
      };
      expect(translator.translate(filter)).toEqual("user.profile.age > 25 AND user.name = 'John'");
    });
  });

  // Special Operators
  describe('special operators', () => {
    it('handles LIKE operator', () => {
      const filter = { name: { $like: '%John%' } };
      expect(translator.translate(filter)).toEqual("name LIKE '%John%'");
    });

    it('handles NOT LIKE operator', () => {
      const filter = { name: { $notLike: '%John%' } };
      expect(translator.translate(filter)).toEqual("name NOT LIKE '%John%'");
    });

    it('handles regexp_match function', () => {
      const filter = { name: { $regex: '^John' } };
      expect(translator.translate(filter)).toEqual("regexp_match(name, '^John')");
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
        "`CUBE` = 10 AND `Upper-Case-Name` = 'Test' AND `column name with space` = 'value'",
      );
    });

    it('throws error for field names with periods that are not nested fields', () => {
      const filter = {
        'field.with..period': 'value', // Using double dots to ensure it's invalid
      };
      expect(() => translator.translate(filter)).toThrow(/Field names containing periods/);
    });
  });

  // Type and value handling
  describe('type handling', () => {
    it('handles boolean values correctly', () => {
      expect(translator.translate({ active: true })).toEqual('active = true');
      expect(translator.translate({ active: false })).toEqual('active = false');
    });

    it('handles numeric types correctly', () => {
      expect(translator.translate({ int: 42 })).toEqual('int = 42');
      expect(translator.translate({ float: 3.14 })).toEqual('float = 3.14');
    });

    it('handles string values with proper quoting', () => {
      expect(translator.translate({ name: 'John' })).toEqual("name = 'John'");
      expect(translator.translate({ text: "O'Reilly" })).toEqual("text = 'O''Reilly'"); // SQL escaping
    });

    it('handles special SQL data types', () => {
      const date = new Date('2024-01-01');
      expect(translator.translate({ date_col: date })).toEqual(`date_col = timestamp '${date.toISOString()}'`);
    });
  });
});

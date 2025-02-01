import { describe, expect, it } from 'vitest';

import { LibSQLFilterTranslator } from './filter';

describe('LibSQLFilterTranslator', () => {
  const translator = new LibSQLFilterTranslator();

  // Basic Operations
  describe('basic operations', () => {
    it('handles empty filter', () => {
      expect(translator.translate({})).toEqual({});
    });

    it('translates primitive to $eq', () => {
      expect(translator.translate({ field: 'value' })).toEqual({
        field: { $eq: 'value' },
      });
    });

    it('preserves comparison operators', () => {
      const filter = {
        field1: { $eq: 'value' },
        field2: { $ne: 'value' },
        field3: { $gt: 5 },
        field4: { $gte: 5 },
        field5: { $lt: 5 },
        field6: { $lte: 5 },
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles nested paths', () => {
      expect(
        translator.translate({
          'nested.field': { $eq: 'value' },
        }),
      ).toEqual({
        'nested.field': { $eq: 'value' },
      });
    });

    it('handles nested objects', () => {
      expect(
        translator.translate({
          nested: {
            field: 'value',
          },
        }),
      ).toEqual({
        'nested.field': { $eq: 'value' },
      });
    });
  });

  // Array Operations
  describe('array operations', () => {
    it('translates array to $in', () => {
      expect(translator.translate({ field: ['a', 'b'] })).toEqual({
        field: { $in: ['a', 'b'] },
      });
    });

    it('translates arrays to JSON for basic operators', () => {
      expect(translator.translate({ field: { $eq: ['a', 'b'] } })).toEqual({
        field: { $eq: JSON.stringify(['a', 'b']) },
      });
      expect(translator.translate({ field: { $ne: ['a', 'b'] } })).toEqual({
        field: { $ne: JSON.stringify(['a', 'b']) },
      });
    });

    it('handles empty arrays', () => {
      expect(
        translator.translate({
          field: [],
        }),
      ).toEqual({
        field: { $in: [] },
      });
    });
  });

  // Array Operator Normalization
  describe('array operator normalization', () => {
    it('normalizes single values for $all', () => {
      expect(
        translator.translate({
          field: { $all: 'value' },
        }),
      ).toEqual({
        field: { $all: ['value'] },
      });
    });

    it('normalizes single values for $elemMatch', () => {
      expect(
        translator.translate({
          field: { $elemMatch: 'value' },
        }),
      ).toEqual({
        field: { $elemMatch: ['value'] },
      });
    });

    it('normalizes single values for $in', () => {
      expect(
        translator.translate({
          field: { $in: 'value' },
        }),
      ).toEqual({
        field: { $in: ['value'] },
      });
    });

    it('normalizes single values for $nin', () => {
      expect(
        translator.translate({
          field: { $nin: 'value' },
        }),
      ).toEqual({
        field: { $nin: ['value'] },
      });
    });

    it('preserves arrays for array operators', () => {
      expect(
        translator.translate({
          field: { $all: ['value1', 'value2'] },
        }),
      ).toEqual({
        field: { $all: ['value1', 'value2'] },
      });
    });
  });

  // Logical Operators
  describe('logical operators', () => {
    it('handles logical operators', () => {
      const filter = {
        $and: [{ field1: { $eq: 'value1' } }, { field2: { $eq: 'value2' } }],
        $or: [{ field3: { $eq: 'value3' } }, { field4: { $eq: 'value4' } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('handles empty logical operators', () => {
      expect(
        translator.translate({
          $and: [],
          $or: [],
        }),
      ).toEqual({
        $and: [],
        $or: [],
      });
    });

    it('handles multiple logical operators at root level', () => {
      expect(
        translator.translate({
          $and: [{ category: 'electronics' }],
          $or: [{ price: { $lt: 100 } }, { price: { $gt: 20 } }],
        }),
      ).toEqual({
        $and: [{ category: { $eq: 'electronics' } }],
        $or: [{ price: { $lt: 100 } }, { price: { $gt: 20 } }],
      });
    });

    it('handles empty conditions in logical operators', () => {
      expect(
        translator.translate({
          $and: [],
          category: 'electronics',
        }),
      ).toEqual({
        $and: [],
        category: { $eq: 'electronics' },
      });
    });

    it('handles $nor operator', () => {
      expect(
        translator.translate({
          $nor: [{ field1: 'value1' }, { field2: { $gt: 100 } }],
        }),
      ).toEqual({
        $nor: [{ field1: { $eq: 'value1' } }, { field2: { $gt: 100 } }],
      });
    });

    it('handles nested logical operators', () => {
      expect(
        translator.translate({
          $and: [
            {
              $or: [{ field1: 'value1' }, { field2: 'value2' }],
            },
            {
              $nor: [{ field3: 'value3' }, { field4: 'value4' }],
            },
          ],
        }),
      ).toEqual({
        $and: [
          {
            $or: [{ field1: { $eq: 'value1' } }, { field2: { $eq: 'value2' } }],
          },
          {
            $nor: [{ field3: { $eq: 'value3' } }, { field4: { $eq: 'value4' } }],
          },
        ],
      });
    });

    it('handles logical operators with empty arrays and primitives', () => {
      expect(
        translator.translate({
          $and: [],
          $or: [{ field1: 'value1' }],
          field2: true,
          $nor: [],
        }),
      ).toEqual({
        $and: [],
        $or: [{ field1: { $eq: 'value1' } }],
        field2: { $eq: true },
        $nor: [],
      });
    });

    it('handles $not operator with comparison', () => {
      expect(
        translator.translate({
          field: { $not: { $eq: 'value' } },
        }),
      ).toEqual({
        field: { $not: { $eq: 'value' } },
      });
    });

    it('handles $not operator with array operators', () => {
      expect(
        translator.translate({
          field: { $not: { $in: ['value1', 'value2'] } },
        }),
      ).toEqual({
        field: { $not: { $in: ['value1', 'value2'] } },
      });
    });

    it('handles multiple $not conditions', () => {
      expect(
        translator.translate({
          $and: [{ field1: { $not: { $eq: 'value1' } } }, { field2: { $not: { $in: ['value2', 'value3'] } } }],
        }),
      ).toEqual({
        $and: [{ field1: { $not: { $eq: 'value1' } } }, { field2: { $not: { $in: ['value2', 'value3'] } } }],
      });
    });

    it('handles combination of $not with other logical operators', () => {
      expect(
        translator.translate({
          $and: [
            {
              $or: [{ field1: 'value1' }, { field2: { $gt: 100 } }],
            },
            {
              $nor: [{ field3: { $lt: 50 } }, { field4: { $eq: 'value4' } }],
            },
            {
              field5: { $not: { $in: ['value5', 'value6'] } },
            },
          ],
        }),
      ).toEqual({
        $and: [
          {
            $or: [{ field1: { $eq: 'value1' } }, { field2: { $gt: 100 } }],
          },
          {
            $nor: [{ field3: { $lt: 50 } }, { field4: { $eq: 'value4' } }],
          },
          {
            field5: { $not: { $in: ['value5', 'value6'] } },
          },
        ],
      });
    });
  });

  // Complex Filter Structures
  describe('complex filter structures', () => {
    it('handles nested logical operators with mixed conditions', () => {
      expect(
        translator.translate({
          $or: [
            {
              $and: [{ category: 'value1' }, { price: { $gt: 90 } }, { active: true }],
            },
            {
              $and: [{ category: 'value2' }, { tags: { $exists: true } }, { price: { $lt: 30 } }],
            },
          ],
        }),
      ).toEqual({
        $or: [
          {
            $and: [{ category: { $eq: 'value1' } }, { price: { $gt: 90 } }, { active: { $eq: true } }],
          },
          {
            $and: [{ category: { $eq: 'value2' } }, { tags: { $exists: true } }, { price: { $lt: 30 } }],
          },
        ],
      });
    });

    it('handles deeply nested metadata paths', () => {
      expect(
        translator.translate({
          'level1.level2.level3': 'deep value',
        }),
      ).toEqual({
        'level1.level2.level3': { $eq: 'deep value' },
      });
    });

    it('handles non-existent nested paths', () => {
      expect(
        translator.translate({
          'nonexistent.path': 'value',
        }),
      ).toEqual({
        'nonexistent.path': { $eq: 'value' },
      });
    });
  });

  // Edge Cases
  describe('edge cases', () => {
    it('handles null values', () => {
      expect(
        translator.translate({
          field: null,
        }),
      ).toEqual({
        field: { $eq: null },
      });
    });

    it('handles boolean values', () => {
      expect(
        translator.translate({
          field1: true,
          field2: false,
        }),
      ).toEqual({
        field1: { $eq: true },
        field2: { $eq: false },
      });
    });

    it('handles numeric values', () => {
      expect(
        translator.translate({
          int: 42,
          float: 42.42,
          negative: -42,
        }),
      ).toEqual({
        int: { $eq: 42 },
        float: { $eq: 42.42 },
        negative: { $eq: -42 },
      });
    });

    it('handles empty strings', () => {
      expect(
        translator.translate({
          field: '',
        }),
      ).toEqual({
        field: { $eq: '' },
      });
    });
  });

  // Operator Validation
  describe('operator validation', () => {
    it('ensure all operator filters are supported', () => {
      const supportedFilters = [
        // Basic comparison operators
        { field: { $eq: 'value' } },
        { field: { $ne: 'value' } },
        { field: { $gt: 'value' } },
        { field: { $gte: 'value' } },
        { field: { $lt: 'value' } },
        { field: { $lte: 'value' } },

        // Array operators
        { field: { $in: ['value'] } },
        { field: { $nin: ['value'] } },
        { field: { $all: ['value'] } },
        { field: { $elemMatch: { $gt: 5 } } },

        // Pattern matching
        // { field: { $regex: 'value' } },
        { field: { $contains: 'value' } },

        // Existence
        { field: { $exists: true } },

        { $and: [{ field1: 'value1' }, { field2: 'value2' }] },
        { $or: [{ field1: 'value1' }, { field2: 'value2' }] },
        { $nor: [{ field1: 'value1' }, { field2: 'value2' }] },

        { $and: { field: 'value' } },
        { $or: { field: 'value' } },
        { $nor: { field: 'value' } },
        { $not: { field: 'value' } },

        { $or: [{ $and: { field1: 'value1' } }, { $not: { field2: 'value2' } }] },

        { field: { $not: { $eq: 'value' } } },
        { field: { $not: { $in: ['value1', 'value2'] } } },
        { field: { $not: { $gt: 100 } } },
        { field: { $not: { $lt: 50 } } },
      ];

      supportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });

    it('throws error when logical operators are used in field-level conditions', () => {
      // $and cannot be used in field conditions
      expect(() =>
        translator.translate({
          field: { $and: [{ $eq: 'value1' }, { $eq: 'value2' }] },
        }),
      ).toThrow();

      // $or cannot be used in field conditions
      expect(() =>
        translator.translate({
          field: { $or: [{ $eq: 'value1' }, { $eq: 'value2' }] },
        }),
      ).toThrow();

      // $nor cannot be used in field conditions
      expect(() =>
        translator.translate({
          field: { $nor: [{ $eq: 'value1' }, { $eq: 'value2' }] },
        }),
      ).toThrow();
    });

    it('allows logical operators at root level', () => {
      // Valid root level usage
      expect(() =>
        translator.translate({
          $and: [{ field1: 'value1' }, { field2: 'value2' }],
          $or: [{ field3: 'value3' }, { field4: 'value4' }],
          $nor: [{ field5: 'value5' }, { field6: 'value6' }],
        }),
      ).not.toThrow();
    });

    it('allows logical operators nested within other logical operators', () => {
      // Valid nested usage
      expect(() =>
        translator.translate({
          $and: [
            {
              $or: [{ field1: 'value1' }, { field2: 'value2' }],
            },
            {
              $nor: [{ field3: 'value3' }, { field4: 'value4' }],
            },
          ],
        }),
      ).not.toThrow();
    });

    it('throws error for deeply nested logical operators in non-logical contexts', () => {
      // Invalid deep nesting in comparison operators
      expect(() =>
        translator.translate({
          field: {
            $gt: {
              $or: [{ subfield: 'value1' }, { subfield: 'value2' }],
            },
          },
        }),
      ).toThrow();

      // Invalid deep nesting in array operators
      expect(() =>
        translator.translate({
          field: {
            $in: [
              {
                $and: [{ subfield: 'value1' }, { subfield: 'value2' }],
              },
            ],
          },
        }),
      ).toThrow();
    });

    it('validates $not operator structure', () => {
      // $not must be an object
      expect(() => translator.translate({ field: { $not: 'value' } })).toThrow();
      expect(() => translator.translate({ field: { $not: ['value'] } })).toThrow();
      expect(() => translator.translate({ $not: 'value' })).toThrow();
      expect(() => translator.translate({ $not: ['value'] })).toThrow();
    });

    it('validates $not operator nesting', () => {
      // $not can be nested
      expect(() =>
        translator.translate({
          field: { $not: { $not: { $eq: 'value' } } },
        }),
      ).not.toThrow();

      // $not can be deeply nested
      expect(() =>
        translator.translate({
          field: { $not: { $not: { $not: { $eq: 'value' } } } },
        }),
      ).not.toThrow();

      // Cannot use $not with logical operators
      expect(() =>
        translator.translate({
          field: { $not: { $and: [{ $eq: 'value1' }, { $eq: 'value2' }] } },
        }),
      ).not.toThrow();

      expect(() =>
        translator.translate({
          field: { $not: { $or: [{ $eq: 'value1' }, { $eq: 'value2' }] } },
        }),
      ).not.toThrow();

      // $not can be used with comparison operators at any nesting level
      expect(() =>
        translator.translate({
          field: { $not: { $not: { $gt: 100 } } },
          field2: { $not: { $not: { $lt: 50 } } },
        }),
      ).not.toThrow();
    });

    it('allows $not with comparison operators', () => {
      expect(() =>
        translator.translate({
          field: { $not: { $eq: 'value' } },
          field2: { $not: { $gt: 100 } },
          field3: { $not: { $lt: 50 } },
          field4: { $not: { $in: ['value1', 'value2'] } },
        }),
      ).not.toThrow();
    });

    it('validates empty $not conditions', () => {
      expect(() => translator.translate({ field: { $not: {} } })).toThrow();
      expect(() => translator.translate({ $not: {} })).toThrow();
    });
  });

  // Regex Support (Currently Commented)
  // describe('regex translation', () => {
  // it('translates string pattern', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: 'pattern' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: 'pattern' },
  //   });
  // });
  // it('translates regex with options', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: 'pattern', $options: 'i' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: 'pattern', $options: 'i' },
  //   });
  // });
  // it('translates regex literal', () => {
  //   expect(
  //     translator.translate({
  //       field: /pattern/i,
  //     }),
  //   ).toEqual({
  //     field: { $regex: 'pattern', $options: 'i' },
  //   });
  // });
  // it('translates starts with pattern', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: '^start' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: '^start' },
  //   });
  // });
  // it('translates ends with pattern', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: 'end$' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: 'end$' },
  //   });
  // });
  // it('translates exact match pattern', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: '^exact$' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: '^exact$' },
  //   });
  // });
  // it('translates contains pattern', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: 'contains' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: 'contains' },
  //   });
  // });
  // it('supports complex patterns', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: 'pat.*ern' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: 'pat.*ern' },
  //   });
  // });
  // it('combines multiple regex flags', () => {
  //   expect(
  //     translator.translate({
  //       field: { $regex: 'pattern', $options: 'imsx' },
  //     }),
  //   ).toEqual({
  //     field: { $regex: 'pattern', $options: 'imsx' },
  //   });
  // });
  // it('throws on $options without $regex', () => {
  //   expect(() =>
  //     translator.translate({
  //       field: { $options: 'i' },
  //     }),
  //   ).toThrow();
  // });
  // it('handles nested regex patterns', () => {
  //   expect(
  //     translator.translate({
  //       nested: {
  //         field: { $regex: 'pattern', $options: 'i' },
  //       },
  //     }),
  //   ).toEqual({
  //     'nested.field': { $regex: 'pattern', $options: 'i' },
  //   });
  // });
  // it('handles multiple regex patterns', () => {
  //   expect(
  //     translator.translate({
  //       field1: { $regex: 'pattern1' },
  //       field2: { $regex: 'pattern2', $options: 'i' },
  //     }),
  //   ).toEqual({
  //     field1: { $regex: 'pattern1' },
  //     field2: { $regex: 'pattern2', $options: 'i' },
  //   });
  // });
  // it('handles regex in logical operators', () => {
  //   expect(
  //     translator.translate({
  //       $or: [{ field: { $regex: 'pattern1' } }, { field: { $regex: 'pattern2', $options: 'i' } }],
  //     }),
  //   ).toEqual({
  //     $or: [{ field: { $regex: 'pattern1' } }, { field: { $regex: 'pattern2', $options: 'i' } }],
  //   });
  // });
  // it('handles deeply nested paths with regex', () => {
  //   expect(
  //     translator.translate({
  //       'level1.level2.level3': { $regex: 'pattern', $options: 'i' },
  //     }),
  //   ).toEqual({
  //     'level1.level2.level3': { $regex: 'pattern', $options: 'i' },
  //   });
  // });
  // });

  // Unsupported Operations
  describe('unsupported operators', () => {
    it('throws on unsupported operators', () => {
      expect(() => translator.translate({ field: { $regex: 'value' } })).toThrow();
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';

import { UpstashFilterTranslator } from './filter';

describe('UpstashFilterTranslator', () => {
  let translator: UpstashFilterTranslator;

  beforeEach(() => {
    translator = new UpstashFilterTranslator();
  });

  it('handles empty/undefined filters', () => {
    expect(translator.translate(undefined)).toBeUndefined();
    expect(translator.translate({})).toBeUndefined();
  });

  it('translates primitive equality', () => {
    expect(translator.translate({ city: 'Istanbul' })).toBe("city = 'Istanbul'");
    expect(translator.translate({ population: 15460000 })).toBe('population = 15460000');
    expect(translator.translate({ is_capital: false })).toBe('is_capital = false');
  });

  it('translates nested paths', () => {
    expect(translator.translate({ 'geography.continent': 'Asia' })).toBe("geography.continent = 'Asia'");
    expect(translator.translate({ geography: { continent: 'Asia' } })).toBe("geography.continent = 'Asia'");
  });

  it('translates comparison operators', () => {
    expect(translator.translate({ population: { $gt: 1000000 } })).toBe('population > 1000000');
    expect(translator.translate({ population: { $gte: 1000000 } })).toBe('population >= 1000000');
    expect(translator.translate({ population: { $lt: 2000000 } })).toBe('population < 2000000');
    expect(translator.translate({ population: { $lte: 2000000 } })).toBe('population <= 2000000');
    expect(translator.translate({ population: { $ne: 1000000 } })).toBe('population != 1000000');
  });

  it('translates array operators', () => {
    expect(translator.translate({ country: { $in: ['Turkey', 'Germany'] } })).toBe("country IN ('Turkey', 'Germany')");
    expect(translator.translate({ country: { $nin: ['USA', 'Canada'] } })).toBe("country NOT IN ('USA', 'Canada')");
    expect(translator.translate({ 'economy.major_industries': { $contains: 'Tourism' } })).toBe(
      "economy.major_industries CONTAINS 'Tourism'",
    );
  });

  it('translates existence checks', () => {
    expect(translator.translate({ coordinates: { $exists: true } })).toBe('HAS FIELD coordinates');
    expect(translator.translate({ coordinates: { $exists: false } })).toBe('HAS NOT FIELD coordinates');
  });

  it('translates glob patterns', () => {
    expect(translator.translate({ city: { $regex: '?[sz]*[^m-z]' } })).toBe("city GLOB '?[sz]*[^m-z]'");
  });

  it('translates logical operators', () => {
    expect(
      translator.translate({
        $and: [{ population: { $gte: 1000000 } }, { 'geography.continent': 'Asia' }],
      }),
    ).toBe("(population >= 1000000 AND geography.continent = 'Asia')");

    expect(
      translator.translate({
        $or: [{ country: 'Turkey' }, { country: 'Germany' }],
      }),
    ).toBe("(country = 'Turkey' OR country = 'Germany')");
  });

  it('translates complex nested conditions', () => {
    const filter = {
      $and: [
        { population: { $gte: 1000000 } },
        { 'geography.continent': 'Asia' },
        {
          $or: [{ 'economy.major_industries': { $contains: 'Tourism' } }, { is_capital: true }],
        },
      ],
    };

    expect(translator.translate(filter)).toBe(
      "(population >= 1000000 AND geography.continent = 'Asia' AND " +
        "(economy.major_industries CONTAINS 'Tourism' OR is_capital = true))",
    );
  });

  describe('operator combinations', () => {
    it('combines multiple comparison operators', () => {
      expect(
        translator.translate({
          population: { $gte: 1000000, $lte: 2000000 },
        }),
      ).toBe('(population >= 1000000 AND population <= 2000000)');
    });

    it('combines array operators with comparisons', () => {
      expect(
        translator.translate({
          country: { $in: ['Turkey', 'Germany'] },
          population: { $gt: 1000000 },
        }),
      ).toBe("(country IN ('Turkey', 'Germany') AND population > 1000000)");
    });

    it('combines exists with other operators', () => {
      expect(
        translator.translate({
          coordinates: { $exists: true },
          population: { $gt: 1000000 },
          'economy.industries': { $contains: 'Tech' },
        }),
      ).toBe("(HAS FIELD coordinates AND population > 1000000 AND economy.industries CONTAINS 'Tech')");
    });

    it('combines glob with other operators', () => {
      expect(
        translator.translate({
          city: { $regex: 'A*' },
          population: { $gt: 1000000 },
          country: { $in: ['Turkey', 'Germany'] },
        }),
      ).toBe("(city GLOB 'A*' AND population > 1000000 AND country IN ('Turkey', 'Germany'))");
    });

    it('translates $nor', () => {
      expect(
        translator.translate({
          $nor: [{ type: 'food' }, { price: { $lt: 10 } }],
        }),
      ).toBe("(type != 'food' AND price >= 10)");
    });

    it('translates $all', () => {
      expect(
        translator.translate({
          tags: { $all: ['red', 'round'] },
        }),
      ).toBe("(tags CONTAINS 'red' AND tags CONTAINS 'round')");
    });

    it('translates complex combination', () => {
      expect(
        translator.translate({
          $and: [
            { name: { $regex: 'A.*' } },
            { $nor: [{ type: 'food' }, { category: 'toys' }] },
            { tags: { $all: ['premium', 'new'] } },
          ],
        }),
      ).toBe(
        "(name GLOB 'A.*' AND " +
          "(type != 'food' AND category != 'toys') AND " +
          "(tags CONTAINS 'premium' AND tags CONTAINS 'new'))",
      );
    });
  });

  describe('complex scenarios', () => {
    it('deeply nested logical operators', () => {
      const filter = {
        $or: [
          {
            $and: [
              { population: { $gte: 1000000 } },
              { 'geography.continent': 'Asia' },
              {
                $or: [
                  { 'economy.industries': { $contains: 'Tech' } },
                  { 'economy.industries': { $contains: 'Finance' } },
                ],
              },
            ],
          },
          {
            $and: [{ 'geography.continent': 'Europe' }, { is_capital: true }, { population: { $lt: 5000000 } }],
          },
        ],
      };

      expect(translator.translate(filter)).toBe(
        "((population >= 1000000 AND geography.continent = 'Asia' AND " +
          "(economy.industries CONTAINS 'Tech' OR economy.industries CONTAINS 'Finance')) OR " +
          "(geography.continent = 'Europe' AND is_capital = true AND population < 5000000))",
      );
    });

    it('mixed array and nested object conditions', () => {
      const filter = {
        $and: [
          {
            'economy.sectors': {
              $in: ['Technology', 'Finance', 'Tourism'],
            },
          },
          {
            'geography.coordinates': {
              latitude: { $gte: 35.5 },
              longitude: { $lte: 45 },
            },
          },
          {
            $or: [
              { population: { $gte: 1000000 } },
              {
                $and: [{ is_capital: true }, { 'economy.gdp': { $gte: 50000 } }],
              },
            ],
          },
        ],
      };

      expect(translator.translate(filter)).toBe(
        "(economy.sectors IN ('Technology', 'Finance', 'Tourism') AND " +
          '(geography.coordinates.latitude >= 35.5 AND geography.coordinates.longitude <= 45) AND ' +
          '(population >= 1000000 OR (is_capital = true AND economy.gdp >= 50000)))',
      );
    });

    it('complex filtering with all operator types', () => {
      const filter = {
        $and: [
          {
            $or: [{ name: { $regex: 'San*' } }, { name: { $regex: 'New*' } }],
          },
          { population: { $gte: 500000, $lte: 10000000 } },
          { 'coordinates.latitude': { $exists: true } },
          {
            $or: [
              { 'economy.industries': { $contains: 'Tech' } },
              {
                $and: [
                  { 'economy.industries': { $contains: 'Tourism' } },
                  { 'climate.type': { $in: ['Mediterranean', 'Tropical'] } },
                ],
              },
            ],
          },
          {
            'demographics.languages': {
              $nin: ['French', 'German'],
            },
          },
        ],
      };

      expect(translator.translate(filter)).toBe(
        "((name GLOB 'San*' OR name GLOB 'New*') AND " +
          '(population >= 500000 AND population <= 10000000) AND ' +
          'HAS FIELD coordinates.latitude AND ' +
          "(economy.industries CONTAINS 'Tech' OR " +
          "(economy.industries CONTAINS 'Tourism' AND climate.type IN ('Mediterranean', 'Tropical'))) AND " +
          "demographics.languages NOT IN ('French', 'German'))",
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty arrays', () => {
      expect(translator.translate({ tags: [] })).toBe('(HAS FIELD empty AND HAS NOT FIELD empty)');
    });

    it('handles multiple empty conditions in logical operators', () => {
      expect(
        translator.translate({
          $and: [{ field2: [] }],
        }),
      ).toBe('((HAS FIELD empty AND HAS NOT FIELD empty))');
    });

    it('handles special characters in field names', () => {
      expect(
        translator.translate({
          'field.with.dots': 'value',
          field_with_underscores: 'value',
        }),
      ).toBe("(field.with.dots = 'value' AND field_with_underscores = 'value')");
    });

    it('handles special characters in string values', () => {
      expect(
        translator.translate({
          field: "value'with'quotes",
        }),
      ).toBe('field = "value\'with\'quotes"');
    });
  });

  describe('NOT operators', () => {
    it('translates not equals', () => {
      expect(translator.translate({ field: { $ne: 'value' } })).toBe("field != 'value'");
    });

    it('translates not in array', () => {
      expect(translator.translate({ field: { $nin: ['a', 'b'] } })).toBe("field NOT IN ('a', 'b')");
    });

    it('translate $not with direct object value', () => {
      expect(translator.translate({ $not: { field: true } })).toBe('field != true');
    });

    it('translates $not with operator', () => {
      expect(
        translator.translate({
          field: { $not: { $eq: 'value' } },
        }),
      ).toBe("field != 'value'");
    });

    it('translates not contains', () => {
      expect(
        translator.translate({
          field: { $not: { $contains: 'value' } },
        }),
      ).toBe("field NOT CONTAINS 'value'");
    });

    it('translates not glob', () => {
      expect(
        translator.translate({
          field: { $not: { $regex: 'a*' } },
        }),
      ).toBe("field NOT GLOB 'a*'");
    });

    it('translates has not field', () => {
      expect(translator.translate({ field: { $exists: false } })).toBe('HAS NOT FIELD field');
    });

    it('translates $not with $exists', () => {
      expect(translator.translate({ $not: { field: { $exists: true } } })).toBe('HAS NOT FIELD field');
      expect(translator.translate({ field: { $not: { $exists: false } } })).toBe('HAS FIELD field');
    });

    it('translates $not operator with comparison', () => {
      expect(
        translator.translate({
          field: { $not: { $gt: 100 } },
        }),
      ).toBe('field <= 100');
    });

    it('translates $not operator with multiple conditions', () => {
      expect(
        translator.translate({
          $not: {
            $and: [{ field: { $in: ['a', 'b'] } }, { field: { $gt: 100 } }],
          },
        }),
      ).toBe("(field NOT IN ('a', 'b') OR field <= 100)");
    });

    it('translates $not with $nor', () => {
      expect(
        translator.translate({
          $not: {
            $nor: [{ field: { $in: ['a', 'b'] } }, { field: { $gt: 100 } }],
          },
        }),
      ).toBe("(field IN ('a', 'b') OR field > 100)");
    });
  });

  describe('array access', () => {
    it('handles deeply nested array access', () => {
      expect(
        translator.translate({
          'array.0.nested.1.field': 'value',
        }),
      ).toBe("array.0.nested.1.field = 'value'");
    });
  });

  describe('multiple NOT combinations', () => {
    it('handles multiple NOT combinations', () => {
      expect(
        translator.translate({
          $and: [
            { field1: { $not: { $contains: 'a' } } },
            { field2: { $not: { $regex: 'b*' } } },
            { field3: { $nin: ['c', 'd'] } },
          ],
        }),
      ).toBe("(field1 NOT CONTAINS 'a' AND field2 NOT GLOB 'b*' AND field3 NOT IN ('c', 'd'))");
    });
  });

  describe('null and undefined handling', () => {
    it('handles null in comparisons', () => {
      expect(() => translator.translate({ value: null })).toThrow();
    });

    it('handles null in arrays', () => {
      expect(() =>
        translator.translate({
          field: { $in: [null, 'value'] },
        }),
      ).toThrow();
    });

    it('handles undefined values', () => {
      expect(() =>
        translator.translate({
          field: undefined,
        }),
      ).toThrow();
    });
  });

  describe('empty conditions', () => {
    it('handles empty AND', () => {
      expect(
        translator.translate({
          $and: [],
        }),
      ).toBe('(HAS FIELD empty OR HAS NOT FIELD empty)');
    });

    it('handles empty OR', () => {
      expect(
        translator.translate({
          $or: [],
        }),
      ).toBe('(HAS FIELD empty AND HAS NOT FIELD empty)');
    });

    it('handles empty IN', () => {
      expect(
        translator.translate({
          field: { $in: [] },
        }),
      ).toBe('(HAS FIELD empty AND HAS NOT FIELD empty)');
    });
  });

  describe('number handling', () => {
    it('handles zero', () => {
      expect(
        translator.translate({
          field: 0,
        }),
      ).toBe('field = 0');
    });

    it('handles negative numbers', () => {
      expect(
        translator.translate({
          field: -123.45,
        }),
      ).toBe('field = -123.45');
    });

    it('handles scientific notation', () => {
      expect(
        translator.translate({
          field: 1e-10,
        }),
      ).toBe('field = 0.0000000001');
    });
  });

  describe('array indexing', () => {
    it('handles positive array indices', () => {
      expect(
        translator.translate({
          'array[0]': 'value',
          'nested.array[2]': 'other',
        }),
      ).toBe("(array[0] = 'value' AND nested.array[2] = 'other')");
    });

    it('handles negative array indices', () => {
      expect(
        translator.translate({
          'array[#-1]': 'last',
          'nested.array[#-2]': 'second-to-last',
        }),
      ).toBe("(array[#-1] = 'last' AND nested.array[#-2] = 'second-to-last')");
    });

    it('handles array indices with operators', () => {
      expect(
        translator.translate({
          'array[0]': { $gt: 100 },
          'array[#-1]': { $lt: 200 },
        }),
      ).toBe('(array[0] > 100 AND array[#-1] < 200)');
    });

    it('handles array indices in complex queries', () => {
      expect(
        translator.translate({
          $or: [{ 'array[0]': { $in: ['a', 'b'] } }, { 'array[#-1]': { $contains: 'value' } }],
        }),
      ).toBe("(array[0] IN ('a', 'b') OR array[#-1] CONTAINS 'value')");
    });

    it('handles multiple array indices', () => {
      expect(
        translator.translate({
          'array[0][1]': 'value',
          'nested[#-1][2]': 'other',
        }),
      ).toBe("(array[0][1] = 'value' AND nested[#-1][2] = 'other')");
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
        { field: { $invalid: 'value' } },
        { field: { $elemMatch: { $gt: 5 } } },
        { field: { $regex: 'pattern', $options: 'i' } },
      ];

      unsupportedFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Unsupported operator/);
      });
    });

    it('throws error for invalid $not operator', () => {
      expect(() => translator.translate({ field: { $not: true } })).toThrow();
    });

    it('throws error for regex operators', () => {
      const filter = { field: /pattern/i };
      expect(() => translator.translate(filter)).toThrow();
    });
    it('throws error for non-logical operators at top level', () => {
      const invalidFilters = [{ $gt: 100 }, { $in: ['value1', 'value2'] }, { $eq: true }];

      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow(/Invalid top-level operator/);
      });
    });

    it('allows logical operators at top level', () => {
      const validFilters = [{ $and: [{ field: 'value' }] }, { $or: [{ field: 'value' }] }];

      validFilters.forEach(filter => {
        expect(() => translator.translate(filter)).not.toThrow();
      });
    });
  });
});

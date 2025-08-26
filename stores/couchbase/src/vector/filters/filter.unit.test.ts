import { describe, it, expect } from 'vitest';
import { CouchbaseFilterTranslator } from './filter';

describe.skip('sample', () => {
  it('sample', () => {
    const translator = new CouchbaseFilterTranslator();
    const filter = {
      $and: [
        {
          field3: {
            $eq: 'value3',
            $ne: 'value4',
          },
        },
        {
          field4: {
            $eq: 'value4',
            $ne: 'value5',
          },
        },
      ],
      $or: [
        {
          field5: { $eq: 'value5' },
          field6: { $ne: 'value6' },
        },
        {
          field5: { $eq: 'value5' },
          field6: { $ne: 'value6' },
        },
      ],
      $not: {
        field7: { $eq: 'value7' },
        field8: { $ne: 'value8' },
      },
      field1: {
        $eq: 'value1',
        $ne: 'value2',
      },
      field2: {
        $gt: 10,
        $gte: 10,
        $lt: 10,
        $lte: 10,
      },
    };
    const result = translator.translate(filter);
    console.log(JSON.stringify(result, null, 2));
  });
});

/**
 * Test suite for CouchbaseFilterTranslator
 *
 * These tests are structured to validate filter translation from Mastra format to Couchbase format.
 * Test cases are organized by operator type and data type combinations.
 * Each test case includes the input filter and expected output translation.
 */
describe('CouchbaseFilterTranslator - table-driven tests', () => {
  const translator = new CouchbaseFilterTranslator();

  type TestCase = { name: string; input: any; expected: any };

  /**
   * Tests for equality ($eq) operations with different data types
   */
  describe('translates equality operations ($eq)', () => {
    const cases: TestCase[] = [
      {
        name: 'string equality',
        input: { 'meta.years': { $eq: '2019' } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', term: '2019' }],
            },
          ],
        },
      },
      {
        name: 'number equality',
        input: { 'meta.years': { $eq: 2019 } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  field: 'meta.years',
                  min: 2019,
                  max: 2019,
                  inclusive_min: true,
                  inclusive_max: true,
                },
              ],
            },
          ],
        },
      },
      {
        name: 'date equality',
        input: { 'meta.years': { $eq: new Date('2011-10-05T14:48:00.000Z') } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  field: 'meta.years',
                  start: new Date('2011-10-05T14:48:00.000Z'),
                  end: new Date('2011-10-05T14:48:00.000Z'),
                  inclusive_start: true,
                  inclusive_end: true,
                },
              ],
            },
          ],
        },
      },
      {
        name: 'boolean equality',
        input: { active: { $eq: true } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'active', bool: true }],
            },
          ],
        },
      },
      {
        name: 'null equality',
        input: { nickname: { $eq: null } },
        expected: {
          conjuncts: [{}],
        },
      },
      {
        name: 'multiple field operations',
        input: { field1: { $eq: 'value1', $ne: 'value2' } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                { field: 'field1', term: 'value1' },
                { must_not: { disjuncts: [{ field: 'field1', term: 'value2' }] } },
              ],
            },
          ],
        },
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const result = translator.translate(c.input as any);
        expect(result).toEqual(c.expected);
      });
    }
  });

  /**
   * Tests for inequality ($ne) operations with different data types
   */
  describe('translates inequality operations ($ne)', () => {
    const cases: TestCase[] = [
      {
        name: 'string inequality',
        input: { 'meta.years': { $ne: '2011' } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  must_not: {
                    disjuncts: [{ field: 'meta.years', term: '2011' }],
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: 'number inequality',
        input: { 'meta.years': { $ne: 1 } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  must_not: {
                    disjuncts: [
                      {
                        field: 'meta.years',
                        min: 1,
                        max: 1,
                        inclusive_min: true,
                        inclusive_max: true,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: 'date inequality',
        input: { 'meta.years': { $ne: new Date('2011-10-05T14:48:00.000Z') } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  must_not: {
                    disjuncts: [
                      {
                        field: 'meta.years',
                        start: new Date('2011-10-05T14:48:00.000Z'),
                        end: new Date('2011-10-05T14:48:00.000Z'),
                        inclusive_start: true,
                        inclusive_end: true,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: 'boolean inequality',
        input: { archived: { $ne: false } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  must_not: {
                    disjuncts: [{ field: 'archived', bool: false }],
                  },
                },
              ],
            },
          ],
        },
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const result = translator.translate(c.input as any);
        expect(result).toEqual(c.expected);
      });
    }
  });

  /**
   * Tests for comparison operations ($gt, $gte, $lt, $lte) with different data types
   */
  describe('translates comparison operations ($gt, $gte, $lt, $lte)', () => {
    const cases: TestCase[] = [
      {
        name: 'number greater than',
        input: { 'meta.years': { $gt: 2019 } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', min: 2019, inclusive_min: false }],
            },
          ],
        },
      },
      {
        name: 'number greater than or equal',
        input: { 'meta.years': { $gte: 2019 } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', min: 2019 }],
            },
          ],
        },
      },
      {
        name: 'date greater than',
        input: { 'meta.years': { $gt: new Date('2011-10-05T14:48:00.000Z') } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', start: new Date('2011-10-05T14:48:00.000Z'), inclusive_start: false }],
            },
          ],
        },
      },
      {
        name: 'date greater than or equal',
        input: { 'meta.years': { $gte: new Date('2011-10-05T14:48:00.000Z') } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', start: new Date('2011-10-05T14:48:00.000Z') }],
            },
          ],
        },
      },
      {
        name: 'number less than',
        input: { 'meta.years': { $lt: 2019 } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', max: 2019, inclusive_min: false }],
            },
          ],
        },
      },
      {
        name: 'number less than or equal',
        input: { 'meta.years': { $lte: 2019 } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', max: 2019, inclusive_max: true, inclusive_min: false }],
            },
          ],
        },
      },
      {
        name: 'date less than',
        input: { 'meta.years': { $lt: new Date('2011-10-05T14:48:00.000Z') } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'meta.years', end: new Date('2011-10-05T14:48:00.000Z'), inclusive_start: false }],
            },
          ],
        },
      },
      {
        name: 'date less than or equal',
        input: { 'meta.years': { $lte: new Date('2011-10-05T14:48:00.000Z') } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  field: 'meta.years',
                  end: new Date('2011-10-05T14:48:00.000Z'),
                  inclusive_end: true,
                  inclusive_start: false,
                },
              ],
            },
          ],
        },
      },
      {
        name: 'multiple number comparisons',
        input: { field2: { $gt: 10, $gte: 10, $lt: 10, $lte: 10 } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                { field: 'field2', min: 10, inclusive_min: false },
                { field: 'field2', min: 10 },
                { field: 'field2', max: 10, inclusive_min: false },
                { field: 'field2', max: 10, inclusive_max: true, inclusive_min: false },
              ],
            },
          ],
        },
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const result = translator.translate(c.input as any);
        expect(result).toEqual(c.expected);
      });
    }
  });

  /**
   * Tests for logical operations ($and, $or, $not) and their combinations
   */
  describe('translates logical operations', () => {
    const cases: TestCase[] = [
      {
        name: '$and of two clauses',
        input: {
          $and: [
            {
              a: {
                $eq: 'x',
              },
            },
            {
              b: {
                $ne: 'y',
              },
            },
          ],
        },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  conjuncts: [
                    {
                      conjuncts: [
                        {
                          field: 'a',
                          term: 'x',
                        },
                      ],
                    },
                  ],
                },
                {
                  conjuncts: [
                    {
                      conjuncts: [
                        {
                          must_not: {
                            disjuncts: [
                              {
                                field: 'b',
                                term: 'y',
                              },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        name: '$or of two equalities',
        input: { $or: [{ s: { $eq: 'p' } }, { t: { $eq: 'q' } }] },
        expected: {
          conjuncts: [
            {
              disjuncts: [
                {
                  conjuncts: [{ conjuncts: [{ field: 's', term: 'p' }] }],
                },
                {
                  conjuncts: [{ conjuncts: [{ field: 't', term: 'q' }] }],
                },
              ],
            },
          ],
        },
      },
      {
        name: '$not wrapping a simple equality',
        input: { $not: { z: { $eq: 'n' } } },
        expected: {
          conjuncts: [
            {
              must_not: { disjuncts: [{ conjuncts: [{ conjuncts: [{ field: 'z', term: 'n' }] }] }] },
            },
          ],
        },
      },
      {
        name: 'complex nested logical operations',
        input: {
          $and: [
            { 'meta.years': { $eq: 2019 } },
            { 'meta.date1': { $eq: new Date('2011-10-05T14:48:00.000Z') } },
            {
              $or: [
                { 'meta.text': { $eq: '1' } },
                { 'meta.date2': { $gte: new Date('2011-10-05T14:48:00.000Z') } },
                {
                  $not: {
                    'meta.date3': { $eq: new Date('2011-10-05T14:48:00.000Z') },
                  },
                },
              ],
            },
          ],
        },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  conjuncts: [
                    {
                      conjuncts: [
                        {
                          field: 'meta.years',
                          min: 2019,
                          max: 2019,
                          inclusive_min: true,
                          inclusive_max: true,
                        },
                      ],
                    },
                  ],
                },
                {
                  conjuncts: [
                    {
                      conjuncts: [
                        {
                          field: 'meta.date1',
                          start: new Date('2011-10-05T14:48:00.000Z'),
                          end: new Date('2011-10-05T14:48:00.000Z'),
                          inclusive_start: true,
                          inclusive_end: true,
                        },
                      ],
                    },
                  ],
                },
                {
                  conjuncts: [
                    {
                      disjuncts: [
                        {
                          conjuncts: [
                            {
                              conjuncts: [
                                {
                                  field: 'meta.text',
                                  term: '1',
                                },
                              ],
                            },
                          ],
                        },
                        {
                          conjuncts: [
                            {
                              conjuncts: [
                                {
                                  field: 'meta.date2',
                                  start: new Date('2011-10-05T14:48:00.000Z'),
                                },
                              ],
                            },
                          ],
                        },
                        {
                          conjuncts: [
                            {
                              must_not: {
                                disjuncts: [
                                  {
                                    conjuncts: [
                                      {
                                        conjuncts: [
                                          {
                                            field: 'meta.date3',
                                            start: new Date('2011-10-05T14:48:00.000Z'),
                                            end: new Date('2011-10-05T14:48:00.000Z'),
                                            inclusive_start: true,
                                            inclusive_end: true,
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const result = translator.translate(c.input as any);
        expect(result).toEqual(c.expected);
      });
    }
  });

  /**
   * Tests for array operators ($in, $nin) with different data types
   */
  describe.skip('translates array operators ($in, $nin)', () => {
    const cases: TestCase[] = [
      {
        name: 'string in array',
        input: { 'meta.years': { $in: ['2019'] } },
        expected: {
          conjuncts: [
            {
              disjuncts: [{ field: 'meta.years', term: '2019' }],
            },
          ],
        },
      },
      {
        name: 'number in array',
        input: { 'meta.years': { $in: [2019] } },
        expected: {
          conjuncts: [
            {
              disjuncts: [
                {
                  field: 'meta.years',
                  min: 2019,
                  max: 2019,
                  inclusive_min: true,
                  inclusive_max: true,
                },
              ],
            },
          ],
        },
      },
      {
        name: 'date in array',
        input: { 'meta.years': { $in: [new Date('2011-10-05T14:48:00.000Z')] } },
        expected: {
          conjuncts: [
            {
              disjuncts: [
                {
                  field: 'meta.years',
                  start: new Date('2011-10-05T14:48:00.000Z'),
                  end: new Date('2011-10-05T14:48:00.000Z'),
                  inclusive_start: true,
                  inclusive_end: true,
                },
              ],
            },
          ],
        },
      },
      {
        name: 'multiple strings in array',
        input: { 'meta.years': { $in: ['1', '2'] } },
        expected: {
          conjuncts: [
            {
              disjuncts: [
                { field: 'meta.years', term: '1' },
                { field: 'meta.years', term: '2' },
              ],
            },
          ],
        },
      },
      {
        name: 'multiple numbers in array',
        input: { 'meta.years': { $in: [1, 2] } },
        expected: {
          conjuncts: [
            {
              disjuncts: [
                { field: 'meta.years', min: 1, max: 1, inclusive_min: true, inclusive_max: true },
                { field: 'meta.years', min: 2, max: 2, inclusive_min: true, inclusive_max: true },
              ],
            },
          ],
        },
      },
      {
        name: 'string not in array',
        input: { 'meta.years': { $nin: ['2019'] } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  must_not: {
                    disjuncts: [{ field: 'meta.years', term: '2019' }],
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: 'number not in array',
        input: { 'meta.years': { $nin: [2019] } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  must_not: {
                    disjuncts: [
                      {
                        field: 'meta.years',
                        min: 2019,
                        max: 2019,
                        inclusive_min: true,
                        inclusive_max: true,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: 'date not in array',
        input: { 'meta.years': { $nin: [new Date('2011-10-05T14:48:00.000Z')] } },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  must_not: {
                    disjuncts: [
                      {
                        field: 'meta.years',
                        start: new Date('2011-10-05T14:48:00.000Z'),
                        end: new Date('2011-10-05T14:48:00.000Z'),
                        inclusive_start: true,
                        inclusive_end: true,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const result = translator.translate(c.input as any);
        expect(result).toEqual(c.expected);
      });
    }
  });

  /**
   * Tests for edge cases and special situations
   */
  describe('translates edge cases', () => {
    const cases: TestCase[] = [
      {
        name: 'empty object',
        input: {},
        expected: {},
      },
      {
        name: 'single-element $and',
        input: { $and: [{ flag: { $eq: true } }] },
        expected: {
          conjuncts: [
            {
              conjuncts: [
                {
                  conjuncts: [
                    {
                      conjuncts: [{ field: 'flag', bool: true }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        name: 'single-element $or',
        input: { $or: [{ role: { $eq: 'user' } }] },
        expected: {
          conjuncts: [
            {
              disjuncts: [
                {
                  conjuncts: [{ conjuncts: [{ field: 'role', term: 'user' }] }],
                },
              ],
            },
          ],
        },
      },
      {
        name: 'multiple fields with different operators',
        input: { name: { $eq: 'Bob' }, age: { $gt: 18 }, active: { $ne: false } },
        expected: {
          conjuncts: [
            {
              conjuncts: [{ field: 'name', term: 'Bob' }],
            },
            {
              conjuncts: [{ field: 'age', min: 18, inclusive_min: false }],
            },
            {
              conjuncts: [{ must_not: { disjuncts: [{ field: 'active', bool: false }] } }],
            },
          ],
        },
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const result = translator.translate(c.input as any);
        expect(result).toEqual(c.expected);
      });
    }
  });

  describe('validates and throws for invalid filters', () => {
    const invalidCases: { name: string; input: any; errorPattern?: RegExp }[] = [
      { name: 'top-level non-logical operator', input: { $eq: 'John' }, errorPattern: /Invalid top-level operator/ },
      {
        name: 'unsupported array operator',
        input: { name: { $in: ['A', 'B'] } },
        errorPattern: /Unsupported operator/,
      },
      { name: '$and requires array', input: { $and: { a: { $eq: 1 } } } },
      {
        name: 'logical at field level',
        input: { name: { $and: [{ $eq: 'a' }, { $eq: 'b' }] } },
        errorPattern: /cannot be used at field level/,
      },
      { name: 'empty $not', input: { $not: {} }, errorPattern: /cannot be empty/ },
      { name: 'type mismatch', input: { price: { $gt: '10' } }, errorPattern: /Unsupported operator/ },
      {
        name: 'nested invalid operator',
        input: { $and: [{ price: { $invalid: 10 } }] },
        errorPattern: /Unsupported operator/,
      },
      {
        name: 'mixed types in operators',
        input: { price: { $gt: 10, $lt: '20' } },
        errorPattern: /is string but expected number/,
      },
      { name: 'undefined field type', input: { price: {} }, errorPattern: /Unsupported field type/ },
      { name: 'invalid $nor structure', input: { $nor: {} } },
      { name: 'invalid logical operator', input: { $xyz: [] }, errorPattern: /Unsupported operator/ },
      {
        name: 'deeply nested invalid operator',
        input: { $and: [{ $or: [{ price: { $invalid: 50 } }] }] },
        errorPattern: /Unsupported operator/,
      },
      {
        name: 'multiple logical operators in field',
        input: { product: { $and: [], $or: [] } },
        errorPattern: /cannot be used at field level/,
      },
      { name: '$not with non-object value', input: { $not: 'invalid' }, errorPattern: /requires an object/ },
    ];

    for (const c of invalidCases) {
      it(c.name, () => {
        if (c.errorPattern) {
          expect(() => translator.translate(c.input as any)).toThrow(c.errorPattern);
        } else {
          expect(() => translator.translate(c.input as any)).toThrow();
        }
      });
    }
  });

  describe('edge cases and empty/falsy values', () => {
    const edgeCases: { name: string; input: any; expected?: any; shouldThrow?: boolean }[] = [
      { name: 'empty object', input: {}, expected: {} },
      { name: 'null filter', input: null, expected: null },
      { name: 'undefined filter', input: undefined, expected: undefined },
      { name: '$and with empty array', input: { $and: [] }, expected: { conjuncts: [{}] } },
      { name: '$or with empty array', input: { $or: [] }, expected: { conjuncts: [{}] } },
      { name: '$and with null value', input: { $and: [null] }, shouldThrow: true },
      {
        name: 'nested empty objects',
        input: { $and: [{ $or: [] }] },
        expected: { conjuncts: [{ conjuncts: [{ conjuncts: [{}] }] }] },
      },
      {
        name: 'boolean false value',
        input: { active: { $eq: false } },
        expected: { conjuncts: [{ conjuncts: [{ field: 'active', bool: false }] }] },
      },
      {
        name: 'boolean true value',
        input: { active: { $eq: true } },
        expected: { conjuncts: [{ conjuncts: [{ field: 'active', bool: true }] }] },
      },
      {
        name: 'zero value',
        input: { count: { $eq: 0 } },
        expected: {
          conjuncts: [{ conjuncts: [{ field: 'count', min: 0, max: 0, inclusive_min: true, inclusive_max: true }] }],
        },
      },
      {
        name: 'negative zero edge case',
        input: { count: { $eq: -0 } },
        expected: {
          conjuncts: [{ conjuncts: [{ field: 'count', min: 0, max: 0, inclusive_min: true, inclusive_max: true }] }],
        },
      },
      { name: 'empty string', input: { name: { $eq: '' } }, expected: { conjuncts: [{ conjuncts: [{}] }] } },
      {
        name: 'field with escaped characters',
        input: { 'a.b': { $eq: 'value' } },
        expected: { conjuncts: [{ conjuncts: [{ field: 'a.b', term: 'value' }] }] },
      },
    ];

    for (const c of edgeCases) {
      it(c.name, () => {
        if (c.shouldThrow) {
          expect(() => translator.translate(c.input as any)).toThrow();
        } else {
          const result = translator.translate(c.input as any);
          expect(result).toEqual(c.expected);
        }
      });
    }
  });

  describe('input validation and field paths', () => {
    it('should handle deeply nested paths correctly', () => {
      const input = {
        'nested.deeply.field': { $eq: 'value' },
      };
      const result = translator.translate(input as any);
      expect(result).toEqual({
        conjuncts: [
          {
            conjuncts: [{ field: 'nested.deeply.field', term: 'value' }],
          },
        ],
      });
    });

    it.skip('should validate arrays in filters', () => {
      // Arrays in field values are allowed for equality
      const validArray = { tags: { $eq: ['tag1', 'tag2'] } };
      const result = translator.translate(validArray as any);
      expect(result).toEqual({
        conjuncts: [
          {
            conjuncts: [{ field: 'tags', term: ['tag1', 'tag2'] }],
          },
        ],
      });
    });

    it('should handle special characters in field names', () => {
      // Field names with special characters should be handled properly
      const specialCharsField = { 'field-with_special$chars': { $eq: 'value' } };
      const result = translator.translate(specialCharsField as any);
      expect(result).toEqual({
        conjuncts: [
          {
            conjuncts: [{ field: 'field-with_special$chars', term: 'value' }],
          },
        ],
      });
    });

    it('should validate Date objects in filters', () => {
      const date = new Date('2023-01-01T00:00:00Z');
      const dateFilter = { timestamp: { $gt: date } };
      const result = translator.translate(dateFilter as any);
      expect(result).toHaveProperty('conjuncts');
    });
  });

  describe('translateNode error handling', () => {
    it('throws with invalid operator', () => {
      expect(() => {
        // @ts-ignore - Testing invalid input
        CouchbaseFilterTranslator.translateNode({ $invalid: 'value' });
      }).toThrow(/not a valid operator/);
    });

    it('handles unexpected input types gracefully', () => {
      // Empty inputs should return empty result
      expect(CouchbaseFilterTranslator.translateNode({})).toEqual({ conjuncts: [] });

      // Logical operator handling should be robust
      const result = CouchbaseFilterTranslator.translateNode({
        $and: [
          { name: { $eq: 'test' } },
          {}, // Empty object should be handled
        ],
      });

      expect(result).toHaveProperty('conjuncts');
    });
  });
});

import { describe, it, expect } from 'vitest';

import { QdrantFilterTranslator } from './filter';

describe('QdrantFilterTranslator', () => {
  const translator = new QdrantFilterTranslator();

  describe('Basic Operators', () => {
    it('should translate direct value match', () => {
      const filter = { field: 'value' };
      const expected = { must: [{ key: 'field', match: { value: 'value' } }] };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate primitive values', () => {
      expect(translator.translate({ field: 123 })).toEqual({ must: [{ key: 'field', match: { value: 123 } }] });
      expect(translator.translate({ field: true })).toEqual({ must: [{ key: 'field', match: { value: true } }] });
      expect(translator.translate({ field: null })).toEqual({ must: [{ is_null: { key: 'field' } }] });
    });

    it('should handle special numeric values', () => {
      expect(translator.translate({ field: 0 })).toEqual({ must: [{ key: 'field', match: { value: 0 } }] });
      expect(translator.translate({ field: -0 })).toEqual({ must: [{ key: 'field', match: { value: 0 } }] });
      expect(translator.translate({ field: Number.MAX_SAFE_INTEGER })).toEqual({
        must: [{ key: 'field', match: { value: Number.MAX_SAFE_INTEGER } }],
      });
      expect(translator.translate({ field: Number.MIN_SAFE_INTEGER })).toEqual({
        must: [{ key: 'field', match: { value: Number.MIN_SAFE_INTEGER } }],
      });
    });

    it('should translate comparison operators', () => {
      const filters = {
        eq: { field: { $eq: 'value' } },
        ne: { field: { $ne: 'value' } },
        gt: { field: { $gt: 100 } },
        gte: { field: { $gte: 100 } },
        lt: { field: { $lt: 100 } },
        lte: { field: { $lte: 100 } },
      };

      expect(translator.translate(filters.eq)).toEqual({ must: [{ key: 'field', match: { value: 'value' } }] });
      expect(translator.translate(filters.ne)).toEqual({ must: [{ key: 'field', match: { except: ['value'] } }] });
      expect(translator.translate(filters.gt)).toEqual({ must: [{ key: 'field', range: { gt: 100 } }] });
      expect(translator.translate(filters.gte)).toEqual({ must: [{ key: 'field', range: { gte: 100 } }] });
      expect(translator.translate(filters.lt)).toEqual({ must: [{ key: 'field', range: { lt: 100 } }] });
      expect(translator.translate(filters.lte)).toEqual({ must: [{ key: 'field', range: { lte: 100 } }] });
    });

    it('should translate array operators', () => {
      const filters = {
        in: { field: { $in: [1, 2, 3] } },
        nin: { field: { $nin: [1, 2, 3] } },
      };

      expect(translator.translate(filters.in)).toEqual({ must: [{ key: 'field', match: { any: [1, 2, 3] } }] });
      expect(translator.translate(filters.nin)).toEqual({ must: [{ key: 'field', match: { except: [1, 2, 3] } }] });
    });

    it('should handle empty arrays', () => {
      expect(translator.translate({ field: [] })).toEqual({ must: [{ is_empty: { key: 'field' } }] });
      expect(translator.translate({ field: { $in: [] } })).toEqual({ must: [{ key: 'field', match: { any: [] } }] });
    });

    it('should handle multiple comparison operators on same field', () => {
      const filter = { field: { $gt: 10, $lt: 20 } };
      const expected = { must: [{ key: 'field', range: { gt: 10, lt: 20 } }] };
      expect(translator.translate(filter)).toEqual(expected);
    });
  });

  describe('Logical Operators', () => {
    it('should translate $and operator', () => {
      const filter = {
        $and: [{ field1: 'value1' }, { field2: { $gt: 100 } }],
      };

      const expected = {
        must: [
          { key: 'field1', match: { value: 'value1' } },
          { key: 'field2', range: { gt: 100 } },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $or operator', () => {
      const filter = {
        $or: [{ field1: 'value1' }, { field2: { $lt: 100 } }],
      };

      const expected = {
        should: [
          { key: 'field1', match: { value: 'value1' } },
          { key: 'field2', range: { lt: 100 } },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $not operator', () => {
      const filter = {
        $not: { field: 'value' },
      };

      const expected = {
        must_not: [{ key: 'field', match: { value: 'value' } }],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle nested logical operators', () => {
      const filter = {
        $and: [
          { 'user.age': { $gte: 18 } },
          {
            $or: [{ 'user.country': { $in: ['US', 'CA'] } }, { 'user.verified': true }],
          },
          {
            $not: { 'user.banned': true },
          },
        ],
      };

      const expected = {
        must: [
          { key: 'user.age', range: { gte: 18 } },
          {
            should: [
              { key: 'user.country', match: { any: ['US', 'CA'] } },
              { key: 'user.verified', match: { value: true } },
            ],
          },
          {
            must_not: [{ key: 'user.banned', match: { value: true } }],
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle empty logical operators', () => {
      expect(translator.translate({ $and: [] })).toEqual({ must: [] });
      expect(translator.translate({ $or: [] })).toEqual({ should: [] });
    });

    it('should handle single condition in logical operators', () => {
      expect(translator.translate({ $and: [{ field: 'value' }] })).toEqual({
        must: [{ key: 'field', match: { value: 'value' } }],
      });
    });

    it('should handle nested must_not operators', () => {
      const filter = {
        $not: {
          $not: { field: 'value' },
        },
      };
      const expected = {
        must_not: [
          {
            must_not: [{ key: 'field', match: { value: 'value' } }],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle complex logical combinations with ranges', () => {
      const filter = {
        $or: [
          { $and: [{ price: { $gte: 100, $lt: 200 } }, { stock: { $gt: 0 } }] },
          { $and: [{ price: { $lt: 100 } }, { featured: true }] },
        ],
      };
      const expected = {
        should: [
          {
            must: [
              { key: 'price', range: { gte: 100, lt: 200 } },
              { key: 'stock', range: { gt: 0 } },
            ],
          },
          {
            must: [
              { key: 'price', range: { lt: 100 } },
              { key: 'featured', match: { value: true } },
            ],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });
  });

  describe('Custom Operators', () => {
    it('should translate $count operator', () => {
      const filter = { field: { $count: { $gt: 5 } } };
      const expected = { must: [{ key: 'field', values_count: { gt: 5 } }] };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $geo operator with radius', () => {
      const filter = {
        location: {
          $geo: {
            type: 'radius',
            center: { lat: 52.5, lon: 13.4 },
            radius: 1000,
          },
        },
      };
      const expected = {
        must: [
          {
            key: 'location',
            geo_radius: {
              center: { lat: 52.5, lon: 13.4 },
              radius: 1000,
            },
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $geo operator with bounding box', () => {
      const filter = {
        location: {
          $geo: {
            type: 'box',
            top_left: { lat: 52.5, lon: 13.4 },
            bottom_right: { lat: 52.4, lon: 13.5 },
          },
        },
      };

      const expected = {
        must: [
          {
            key: 'location',
            geo_bounding_box: {
              top_left: { lat: 52.5, lon: 13.4 },
              bottom_right: { lat: 52.4, lon: 13.5 },
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $geo operator with polygon', () => {
      const filter = {
        location: {
          $geo: {
            type: 'polygon',
            exterior: { points: [{ lat: 52.5, lon: 13.4 }] },
            interiors: [],
          },
        },
      };

      const expected = {
        must: [
          {
            key: 'location',
            geo_polygon: {
              exterior: { points: [{ lat: 52.5, lon: 13.4 }] },
              interiors: [],
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $hasId operator', () => {
      expect(translator.translate({ $hasId: '123' })).toEqual({ must: [{ has_id: ['123'] }] });
      expect(translator.translate({ $hasId: ['123', '456'] })).toEqual({ must: [{ has_id: ['123', '456'] }] });
    });

    it('should translate $nested operator', () => {
      const filter = {
        diet: {
          $nested: {
            food: 'meat',
            likes: true,
          },
        },
        $hasId: '123',
      };

      const expected = {
        must: [
          {
            nested: {
              key: 'diet',
              filter: {
                must: [
                  { key: 'food', match: { value: 'meat' } },
                  { key: 'likes', match: { value: true } },
                ],
              },
            },
          },
          { has_id: ['123'] },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $hasVector operator', () => {
      expect(translator.translate({ $hasVector: 'vector_field' })).toEqual({ must: [{ has_vector: 'vector_field' }] });
    });

    it('should translate $datetime operator', () => {
      const now = new Date();
      const filter = {
        timestamp: {
          $datetime: {
            range: {
              gt: now,
              lt: new Date(now.getTime() + 86400000),
            },
          },
        },
      };

      const expected = {
        must: [
          {
            key: 'timestamp',
            range: {
              gt: now.toISOString(),
              lt: new Date(now.getTime() + 86400000).toISOString(),
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $null operator', () => {
      expect(translator.translate({ field: { $null: true } })).toEqual({ must: [{ is_null: { key: 'field' } }] });
    });

    it('should translate $empty operator', () => {
      expect(translator.translate({ field: { $empty: true } })).toEqual({ must: [{ is_empty: { key: 'field' } }] });
    });

    it('should handle nested $count with multiple conditions', () => {
      const filter = { 'array.items': { $count: { $gt: 5, $lt: 10 } } };
      const expected = {
        must: [
          {
            key: 'array.items',
            values_count: { gt: 5, lt: 10 },
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $nested operator with complex conditions', () => {
      const filter = {
        nested_field: {
          $nested: {
            inner_field: { $gt: 100 },
            'deep.field': { $in: ['value1', 'value2'] },
          },
        },
      };
      const expected = {
        must: [
          {
            nested: {
              key: 'nested_field',
              filter: {
                must: [
                  { key: 'inner_field', range: { gt: 100 } },
                  { key: 'deep.field', match: { any: ['value1', 'value2'] } },
                ],
              },
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $datetime operator with multiple range conditions', () => {
      const now = new Date();
      const filter = {
        timestamp: {
          $datetime: {
            range: {
              gt: now,
              lt: new Date(now.getTime() + 86400000),
              gte: new Date(now.getTime() - 3600000),
              lte: new Date(now.getTime() + 90000000),
            },
          },
        },
      };

      const expected = {
        must: [
          {
            key: 'timestamp',
            range: {
              gt: now.toISOString(),
              lt: new Date(now.getTime() + 86400000).toISOString(),
              gte: new Date(now.getTime() - 3600000).toISOString(),
              lte: new Date(now.getTime() + 90000000).toISOString(),
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate $datetime operator with string dates', () => {
      const filter = {
        timestamp: {
          $datetime: {
            key: 'timestamp',
            range: {
              gt: '2023-01-01T00:00:00Z',
              lt: '2024-01-01T00:00:00Z',
            },
          },
        },
      };

      const expected = {
        must: [
          {
            key: 'timestamp',
            range: {
              gt: '2023-01-01T00:00:00Z',
              lt: '2024-01-01T00:00:00Z',
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should translate complex $nested operator', () => {
      const filter = {
        diet: {
          $nested: {
            food: { $in: ['meat', 'fish'] },
            likes: true,
            rating: { $gt: 5 },
          },
        },
      };

      const expected = {
        must: [
          {
            nested: {
              key: 'diet',
              filter: {
                must: [
                  { key: 'food', match: { any: ['meat', 'fish'] } },
                  { key: 'likes', match: { value: true } },
                  { key: 'rating', range: { gt: 5 } },
                ],
              },
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });
  });

  describe('Special Cases', () => {
    it('should handle nested paths', () => {
      const filter = { 'obj.field': 'value' };
      const expected = { must: [{ key: 'obj.field', match: { value: 'value' } }] };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle deep nested paths', () => {
      const filter = { 'a.b.c.d': { $gt: 100 } };
      const expected = { must: [{ key: 'a.b.c.d', range: { gt: 100 } }] };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle complex combinations', () => {
      const filter = {
        $and: [
          { 'user.age': { $gte: 18 } },
          {
            $or: [{ 'user.country': { $in: ['US', 'CA'] } }, { 'user.verified': true }],
          },
          {
            $not: { 'user.banned': true },
          },
        ],
      };

      const expected = {
        must: [
          { key: 'user.age', range: { gte: 18 } },
          {
            should: [
              { key: 'user.country', match: { any: ['US', 'CA'] } },
              { key: 'user.verified', match: { value: true } },
            ],
          },
          {
            must_not: [{ key: 'user.banned', match: { value: true } }],
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle multiple nested paths with same prefix', () => {
      const filter = {
        $and: [{ 'user.profile.age': { $gte: 18 } }, { 'user.profile.name': 'John' }],
      };

      const expected = {
        must: [
          { key: 'user.profile.age', range: { gte: 18 } },
          { key: 'user.profile.name', match: { value: 'John' } },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle mixed array and object paths', () => {
      const filter = {
        'items[].category': { $in: ['A', 'B'] },
        'items[].details.price': { $gt: 100 },
      };

      const expected = {
        must: [
          { key: 'items[].category', match: { any: ['A', 'B'] } },
          { key: 'items[].details.price', range: { gt: 100 } },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle empty logical operators in combination', () => {
      const filter = {
        $and: [{ $or: [] }, { field: 'value' }],
      };
      const expected = {
        must: [{ should: [] }, { key: 'field', match: { value: 'value' } }],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle deeply nested paths with array notation', () => {
      const filter = {
        'users[].addresses[].geo.location': {
          $geo: {
            type: 'radius',
            center: { lat: 52.5, lon: 13.4 },
            radius: 1000,
          },
        },
      };
      const expected = {
        must: [
          {
            key: 'users[].addresses[].geo.location',
            geo_radius: {
              center: { lat: 52.5, lon: 13.4 },
              radius: 1000,
            },
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle array paths with multiple levels', () => {
      const filter = {
        'users[].addresses[].location[].coordinates': { $gt: 100 },
      };
      const expected = {
        must: [
          {
            key: 'users[].addresses[].location[].coordinates',
            range: { gt: 100 },
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle combination of array and object paths', () => {
      const filter = {
        'users[].profile.addresses[].location.coordinates': { $gt: 100 },
      };
      const expected = {
        must: [
          {
            key: 'users[].profile.addresses[].location.coordinates',
            range: { gt: 100 },
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should handle multiple conditions with same array path', () => {
      const filter = {
        $and: [
          { 'items[].price': { $gt: 100 } },
          { 'items[].quantity': { $gt: 0 } },
          { 'items[].tags': { $in: ['sale'] } },
        ],
      };
      const expected = {
        must: [
          { key: 'items[].price', range: { gt: 100 } },
          { key: 'items[].quantity', range: { gt: 0 } },
          { key: 'items[].tags', match: { any: ['sale'] } },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });
  });

  describe('Error Cases', () => {
    it('should throw error for unsupported operators', () => {
      const filter = { field: { $invalidOp: 'value' } };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('should throw error for invalid geo filter type', () => {
      const filter = {
        location: {
          $geo: {
            type: 'invalid',
            center: { lat: 52.5, lon: 13.4 },
            radius: 1000,
          },
        },
      };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('should throw error for invalid custom operator', () => {
      const filter = { $invalidCustom: 'value' };
      expect(() => translator.translate(filter)).toThrow();
    });
  });

  describe('Validation Cases', () => {
    it('should validate $not operator structure', () => {
      const invalidFilters = [
        { $not: 'invalid' }, // Should be an object
        { $not: [] }, // Should be an object
        { $not: {} }, // Cannot be empty
      ];

      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow();
      });
    });

    it('should validate array operator values', () => {
      const invalidFilters = [
        { field: { $in: 'not-an-array' } }, // Should be array
        { field: { $nin: 123 } }, // Should be array
        { field: { $in: {} } }, // Should be array
      ];

      invalidFilters.forEach(filter => {
        expect(() => translator.translate(filter)).toThrow();
      });
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

  describe('Must Wrapper Cases', () => {
    it('should wrap single field conditions', () => {
      const filters = {
        simple: { field: 'value' },
        nested: { 'obj.field': 'value' },
        array: { 'items[].field': 'value' },
      };

      expect(translator.translate(filters.simple)).toEqual({
        must: [{ key: 'field', match: { value: 'value' } }],
      });
      expect(translator.translate(filters.nested)).toEqual({
        must: [{ key: 'obj.field', match: { value: 'value' } }],
      });
      expect(translator.translate(filters.array)).toEqual({
        must: [{ key: 'items[].field', match: { value: 'value' } }],
      });
    });

    it('should wrap multiple field conditions in single must', () => {
      const filter = {
        field1: 'value1',
        field2: 'value2',
      };
      const expected = {
        must: [
          { key: 'field1', match: { value: 'value1' } },
          { key: 'field2', match: { value: 'value2' } },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should wrap complex single field conditions', () => {
      const filter = {
        field: {
          $gt: 10,
          $lt: 20,
          $ne: 15,
        },
      };
      const expected = {
        must: [
          {
            key: 'field',
            range: { gt: 10, lt: 20 },
          },
          {
            key: 'field',
            match: { except: [15] },
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });
  });

  describe('No Must Wrapper Cases', () => {
    it('should not wrap nested logical operators', () => {
      const filter = {
        $and: [{ field1: 'value1' }, { field2: 'value2' }],
      };
      const expected = {
        must: [
          { key: 'field1', match: { value: 'value1' } },
          { key: 'field2', match: { value: 'value2' } },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });

    it('should not double-wrap already wrapped conditions', () => {
      const filter = {
        must: [{ key: 'field', match: { value: 'value' } }],
      };
      expect(translator.translate(filter)).toEqual(filter);
    });

    it('should preserve existing logical structure', () => {
      const filter = {
        $or: [{ field1: 'value1' }, { $and: [{ field2: 'value2' }, { field3: 'value3' }] }],
      };
      const expected = {
        should: [
          { key: 'field1', match: { value: 'value1' } },
          {
            must: [
              { key: 'field2', match: { value: 'value2' } },
              { key: 'field3', match: { value: 'value3' } },
            ],
          },
        ],
      };
      expect(translator.translate(filter)).toEqual(expected);
    });
  });

  describe('Regex Patterns', () => {
    it('should throw error for direct regex patterns', () => {
      const filter = {
        field: /pattern/,
      };
      expect(() => translator.translate(filter)).toThrow();
    });

    it('should translate $regex operator', () => {
      const filters = {
        field: { $regex: 'pattern' },
      };

      expect(translator.translate(filters)).toEqual({ must: [{ key: 'field', match: { text: 'pattern' } }] });
    });

    it('should handle regex in nested conditions', () => {
      const filter = {
        diet: {
          $nested: {
            food: { $regex: 'meat' },
            description: { $regex: 'organic' },
          },
        },
      };

      const expected = {
        must: [
          {
            nested: {
              key: 'diet',
              filter: {
                must: [
                  { key: 'food', match: { text: 'meat' } },
                  { key: 'description', match: { text: 'organic' } },
                ],
              },
            },
          },
        ],
      };

      expect(translator.translate(filter)).toEqual(expected);
    });
  });
});

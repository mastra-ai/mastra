import { describe, it, expect } from 'vitest';

import { WeaviateFilterTranslator } from './filter';
import weaviate from 'weaviate-client';
import type { FilterValue } from 'weaviate-client';

describe('WeaviateFilterTranslator', async () => {
  const client = await weaviate.connectToLocal();
  const translator = WeaviateFilterTranslator.use(client.collections.use('Whatever'));

  describe('Simple Equality Filters', () => {
    it('should handle string equality', () => {
      const filter = { username: 'johndoe' };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<string>>({
        operator: 'Equal',
        target: { property: 'username' },
        value: 'johndoe',
      });
    });

    it('should handle number equality', () => {
      const filter = { age: 30 };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<number>>({
        operator: 'Equal',
        target: { property: 'age' },
        value: 30,
      });
    });

    it('should handle boolean equality', () => {
      const filter = { isActive: true };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<boolean>>({
        operator: 'Equal',
        target: { property: 'isActive' },
        value: true,
      });
    });

    it('should handle null equality', () => {
      const filter = { email: null };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<boolean>>({
        operator: 'IsNull',
        target: { property: 'email' },
        value: true,
      });
    });

    it('should handle Date object equality', () => {
      const testDate = new Date('2023-01-01T00:00:00Z');
      const filter = { createdAt: testDate };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<Date>>({
        operator: 'Equal',
        target: { property: 'createdAt' },
        value: testDate,
      });
    });

    it('should handle Array equality', () => {
      const testArray = ['apple', 'banana', 'cherry'];
      const filter = { fruits: testArray };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<string[]>>({
        operator: 'ContainsAll',
        target: { property: 'fruits' },
        value: testArray,
      });
    });
  });

  describe('Comparison Operators', () => {
    it('should handle greater than', () => {
      const filter = { salary: { $gt: 50000 } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<number>>({
        operator: 'GreaterThan',
        target: { property: 'salary' },
        value: 50000,
      });
    });

    it('should handle less than', () => {
      const filter = { age: { $lt: 25 } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<number>>({
        operator: 'LessThan',
        target: { property: 'age' },
        value: 25,
      });
    });

    it('should handle greater than or equal', () => {
      const filter = { score: { $gte: 80 } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<number>>({
        operator: 'GreaterThanEqual',
        target: { property: 'score' },
        value: 80,
      });
    });

    it('should handle less than or equal', () => {
      const filter = { temperature: { $lte: 0 } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<number>>({
        operator: 'LessThanEqual',
        target: { property: 'temperature' },
        value: 0,
      });
    });

    it('should handle not equal', () => {
      const filter = { status: { $ne: 'pending' } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<string>>({
        operator: 'NotEqual',
        target: { property: 'status' },
        value: 'pending',
      });
    });
  });

  describe('Array Operators', () => {
    it('should handle $all operator', () => {
      const filter = { tags: { $all: ['red', 'green', 'blue'] } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<string[]>>({
        operator: 'ContainsAll',
        target: { property: 'tags' },
        value: ['red', 'green', 'blue'],
      });
    });

    it('should handle $in operator', () => {
      const filter = { category: { $in: ['electronics', 'books'] } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<string[]>>({
        operator: 'ContainsAny',
        target: { property: 'category' },
        value: ['electronics', 'books'],
      });
    });
  });

  describe('Logical Operators', () => {
    it('should handle $and operator', () => {
      const filter = { $and: [{ isActive: true }, { age: { $gte: 18 } }] };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<null>>({
        operator: 'And',
        filters: [
          {
            operator: 'Equal',
            target: { property: 'isActive' },
            value: true,
          },
          {
            operator: 'GreaterThanEqual',
            target: { property: 'age' },
            value: 18,
          },
        ],
        value: null,
      });
    });

    it('should handle $or operator', () => {
      const filter = { $or: [{ isActive: true }, { age: { $gte: 18 } }] };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<null>>({
        operator: 'Or',
        filters: [
          {
            operator: 'Equal',
            target: { property: 'isActive' },
            value: true,
          },
          {
            operator: 'GreaterThanEqual',
            target: { property: 'age' },
            value: 18,
          },
        ],
        value: null,
      });
    });
  });

  describe('Custom Operators', () => {
    it('should handle $length operator', () => {
      const filter = { tags: { $length: 3 } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<number>>({
        operator: 'Equal',
        target: { property: 'len(tags)' },
        value: 3,
      });
    });

    it('should handle $null operator', () => {
      const filter = { email: { $null: true } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<boolean>>({
        operator: 'IsNull',
        target: { property: 'email' },
        value: true,
      });
    });

    it('should handle $geo operator', () => {
      const filter = { location: { $geo: { lat: 40.71, lon: -74.01, radius: 1000 } } };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<any>>({
        operator: 'WithinGeoRange',
        target: { property: 'location' },
        value: { latitude: 40.71, longitude: -74.01, distance: 1000 },
      });
    });
  });

  describe('Multiple Field Filters', () => {
    it('should handle multiple field filters', () => {
      const filter = {
        isActive: true,
        age: { $gte: 18, $lte: 60 },
        name: 'John',
      };
      const result = translator.translate(filter);
      expect(result).toEqual<FilterValue<any>>({
        operator: 'And',
        filters: [
          {
            operator: 'Equal',
            target: { property: 'isActive' },
            value: true,
          },
          {
            operator: 'And',
            filters: [
              {
                operator: 'GreaterThanEqual',
                target: { property: 'age' },
                value: 18,
              },
              {
                operator: 'LessThanEqual',
                target: { property: 'age' },
                value: 60,
              },
            ],
            value: null,
          },
          {
            operator: 'Equal',
            target: { property: 'name' },
            value: 'John',
          },
        ],
        value: null,
      });
    });
  });
});

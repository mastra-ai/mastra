import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryServerCache } from './inmemory';

describe('InMemoryServerCache', () => {
  let cache: InMemoryServerCache;

  beforeEach(() => {
    cache = new InMemoryServerCache();
  });

  describe('Basic Operations', () => {
    describe('get/set', () => {
      it('should store and retrieve a string value', async () => {
        await cache.set('key1', 'value1');
        const result = await cache.get('key1');
        expect(result).toBe('value1');
      });

      it('should store and retrieve a number value', async () => {
        await cache.set('key2', 42);
        const result = await cache.get('key2');
        expect(result).toBe(42);
      });

      it('should store and retrieve an object value', async () => {
        const obj = { name: 'test', age: 30 };
        await cache.set('key3', obj);
        const result = await cache.get('key3');
        expect(result).toEqual(obj);
      });

      it('should store and retrieve an array value', async () => {
        const arr = [1, 2, 3, 'test'];
        await cache.set('key4', arr);
        const result = await cache.get('key4');
        expect(result).toEqual(arr);
      });

      it('should return undefined for non-existent keys', async () => {
        const result = await cache.get('nonexistent');
        expect(result).toBeUndefined();
      });

      it('should overwrite existing values', async () => {
        await cache.set('key5', 'original');
        await cache.set('key5', 'updated');
        const result = await cache.get('key5');
        expect(result).toBe('updated');
      });
    });

    describe('delete', () => {
      it('should delete an existing key', async () => {
        await cache.set('deleteMe', 'value');
        expect(await cache.get('deleteMe')).toBe('value');

        await cache.delete('deleteMe');
        expect(await cache.get('deleteMe')).toBeUndefined();
      });

      it('should not throw when deleting non-existent key', async () => {
        await expect(cache.delete('nonexistent')).resolves.not.toThrow();
      });
    });

    describe('clear', () => {
      it('should clear all cached values', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        await cache.set('key3', [1, 2, 3]);

        expect(await cache.get('key1')).toBe('value1');
        expect(await cache.get('key2')).toBe('value2');
        expect(await cache.get('key3')).toEqual([1, 2, 3]);

        await cache.clear();

        expect(await cache.get('key1')).toBeUndefined();
        expect(await cache.get('key2')).toBeUndefined();
        expect(await cache.get('key3')).toBeUndefined();
      });
    });
  });

  describe('List Operations', () => {
    describe('listPush', () => {
      it('should create a new list when key does not exist', async () => {
        await cache.listPush('newList', 'item1');
        const result = await cache.get('newList');
        expect(result).toEqual(['item1']);
      });

      it('should append to existing list', async () => {
        await cache.set('existingList', ['item1', 'item2']);
        await cache.listPush('existingList', 'item3');
        const result = await cache.get('existingList');
        expect(result).toEqual(['item1', 'item2', 'item3']);
      });

      it('should handle different data types in list', async () => {
        await cache.listPush('mixedList', 'string');
        await cache.listPush('mixedList', 42);
        await cache.listPush('mixedList', { key: 'value' });
        await cache.listPush('mixedList', [1, 2, 3]);

        const result = await cache.get('mixedList');
        expect(result).toEqual(['string', 42, { key: 'value' }, [1, 2, 3]]);
      });

      it('should create new list when existing value is not an array', async () => {
        await cache.set('notAnArray', 'string value');
        await cache.listPush('notAnArray', 'newItem');
        const result = await cache.get('notAnArray');
        expect(result).toEqual(['newItem']);
      });
    });

    describe('listLength', () => {
      it('should return length of existing list', async () => {
        await cache.set('testList', ['a', 'b', 'c']);
        const length = await cache.listLength('testList');
        expect(length).toBe(3);
      });

      it('should return 0 for empty list', async () => {
        await cache.set('emptyList', []);
        const length = await cache.listLength('emptyList');
        expect(length).toBe(0);
      });

      it('should throw error when key contains non-array value', async () => {
        await cache.set('notAnArray', 'string value');
        await expect(cache.listLength('notAnArray')).rejects.toThrow('notAnArray is not an array');
      });

      it('should throw error when key does not exist', async () => {
        await expect(cache.listLength('nonexistent')).rejects.toThrow('nonexistent is not an array');
      });
    });

    describe('listFromTo', () => {
      beforeEach(async () => {
        await cache.set('testList', ['a', 'b', 'c', 'd', 'e']);
      });

      it('should return slice from start to end (inclusive)', async () => {
        const result = await cache.listFromTo('testList', 1, 3);
        expect(result).toEqual(['b', 'c', 'd']);
      });

      it('should return slice from start to end of array when to is -1', async () => {
        const result = await cache.listFromTo('testList', 2, -1);
        expect(result).toEqual(['c', 'd', 'e']);
      });

      it('should return slice from start to end of array when to is not provided', async () => {
        const result = await cache.listFromTo('testList', 2);
        expect(result).toEqual(['c', 'd', 'e']);
      });

      it('should return full array when from is 0 and to is -1', async () => {
        const result = await cache.listFromTo('testList', 0, -1);
        expect(result).toEqual(['a', 'b', 'c', 'd', 'e']);
      });

      it('should return empty array when from is greater than array length', async () => {
        const result = await cache.listFromTo('testList', 10, 15);
        expect(result).toEqual([]);
      });

      it('should return empty array when key does not exist', async () => {
        const result = await cache.listFromTo('nonexistent', 0, 2);
        expect(result).toEqual([]);
      });

      it('should return empty array when key contains non-array value', async () => {
        await cache.set('notAnArray', 'string value');
        const result = await cache.listFromTo('notAnArray', 0, 2);
        expect(result).toEqual([]);
      });

      it('should handle negative from index', async () => {
        const result = await cache.listFromTo('testList', -2, -1);
        expect(result).toEqual(['d', 'e']);
      });

      it('should return inclusive range when from and to are consecutive', async () => {
        const result = await cache.listFromTo('testList', 1, 2);
        expect(result).toEqual(['b', 'c']);
      });

      it('should behave like Redis LRANGE with inclusive end index', async () => {
        // Redis LRANGE includes both start and end indices
        const result = await cache.listFromTo('testList', 0, 4);
        expect(result).toEqual(['a', 'b', 'c', 'd', 'e']); // All elements included

        const singleItem = await cache.listFromTo('testList', 2, 2);
        expect(singleItem).toEqual(['c']); // Single item when start === end
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple concurrent operations', async () => {
      const promises = [];

      // Concurrent sets
      for (let i = 0; i < 10; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }

      await Promise.all(promises);

      // Verify all values are set
      for (let i = 0; i < 10; i++) {
        const result = await cache.get(`key${i}`);
        expect(result).toBe(`value${i}`);
      }
    });

    it('should handle mixed operations on same key', async () => {
      // Start with a regular value
      await cache.set('mixedKey', 'initial');
      expect(await cache.get('mixedKey')).toBe('initial');

      // Convert to list by pushing
      await cache.listPush('mixedKey', 'listItem');
      expect(await cache.get('mixedKey')).toEqual(['listItem']);

      // Add more items
      await cache.listPush('mixedKey', 'anotherItem');
      expect(await cache.listLength('mixedKey')).toBe(2);

      // Get slice (Redis-like inclusive)
      const slice = await cache.listFromTo('mixedKey', 0, 1);
      expect(slice).toEqual(['listItem', 'anotherItem']);

      // Replace with regular value again
      await cache.set('mixedKey', 'replaced');
      expect(await cache.get('mixedKey')).toBe('replaced');
    });

    it('should maintain data integrity after operations', async () => {
      // Set up initial data
      await cache.set('string', 'test');
      await cache.set('number', 123);
      await cache.set('object', { key: 'value' });
      await cache.set('list', ['a', 'b']);

      // Perform operations
      await cache.listPush('list', 'c');
      await cache.set('string', 'updated');

      // Verify integrity
      expect(await cache.get('string')).toBe('updated');
      expect(await cache.get('number')).toBe(123);
      expect(await cache.get('object')).toEqual({ key: 'value' });
      expect(await cache.get('list')).toEqual(['a', 'b', 'c']);
      expect(await cache.listLength('list')).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', async () => {
      await cache.set('nullValue', null);
      await cache.set('undefinedValue', undefined);

      expect(await cache.get('nullValue')).toBe(null);
      expect(await cache.get('undefinedValue')).toBe(undefined);
    });

    it('should handle empty strings and empty objects', async () => {
      await cache.set('emptyString', '');
      await cache.set('emptyObject', {});
      await cache.set('emptyArray', []);

      expect(await cache.get('emptyString')).toBe('');
      expect(await cache.get('emptyObject')).toEqual({});
      expect(await cache.get('emptyArray')).toEqual([]);
    });

    it('should handle special characters in keys', async () => {
      const specialKeys = ['key with spaces', 'key-with-dashes', 'key_with_underscores', 'key.with.dots'];

      for (const key of specialKeys) {
        await cache.set(key, `value for ${key}`);
        expect(await cache.get(key)).toBe(`value for ${key}`);
      }
    });

    it('should handle very long keys and values', async () => {
      const longKey = 'a'.repeat(1000);
      const longValue = 'b'.repeat(10000);

      await cache.set(longKey, longValue);
      expect(await cache.get(longKey)).toBe(longValue);
    });

    it('should handle complex nested objects', async () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, { nested: true }],
              string: 'deep value',
              number: 42,
            },
          },
        },
      };

      await cache.set('complex', complexObject);
      expect(await cache.get('complex')).toEqual(complexObject);
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large number of keys', async () => {
      const keyCount = 100;
      const promises = [];

      for (let i = 0; i < keyCount; i++) {
        promises.push(cache.set(`bulk${i}`, `value${i}`));
      }

      await Promise.all(promises);

      // Verify a sample of keys
      expect(await cache.get('bulk0')).toBe('value0');
      expect(await cache.get('bulk50')).toBe('value50');
      expect(await cache.get('bulk99')).toBe('value99');
    });

    it('should handle large lists', async () => {
      const itemCount = 1000;

      for (let i = 0; i < itemCount; i++) {
        await cache.listPush('largeList', `item${i}`);
      }

      expect(await cache.listLength('largeList')).toBe(itemCount);

      const firstItems = await cache.listFromTo('largeList', 0, 5);
      expect(firstItems).toEqual(['item0', 'item1', 'item2', 'item3', 'item4', 'item5']);

      const lastItems = await cache.listFromTo('largeList', itemCount - 5);
      expect(lastItems).toEqual(['item995', 'item996', 'item997', 'item998', 'item999']);
    });
  });
});

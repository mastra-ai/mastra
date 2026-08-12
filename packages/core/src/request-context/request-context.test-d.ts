import { assertType, describe, expectTypeOf, it } from 'vitest';
import { RequestContext } from './index';

/**
 * Type tests for RequestContext type inference
 *
 * Problem: When calling get(), the type should be inferred based on the specific key being accessed.
 * Also, entries()/keys()/values() should return properly typed iterators.
 *
 * Expected: get('age') should return `number`, not `string | number`
 */
describe('RequestContext Type Tests', () => {
  describe('Issue #4467: get() should return accurate types based on key', () => {
    type MyContext = {
      name: string;
      age: number;
      isActive: boolean;
    };

    it('should infer correct type for get() with typed keys', () => {
      const context = new RequestContext<MyContext>();

      // get() should return the specific type for the key being accessed
      const age = context.get('age');
      expectTypeOf(age).toEqualTypeOf<number>();

      const name = context.get('name');
      expectTypeOf(name).toEqualTypeOf<string>();

      const isActive = context.get('isActive');
      expectTypeOf(isActive).toEqualTypeOf<boolean>();
    });

    it('should infer correct key type from keyof Values', () => {
      const context = new RequestContext<MyContext>();

      // Keys should be typed as 'name' | 'age' | 'isActive'
      const keys = context.keys();
      expectTypeOf(keys).toEqualTypeOf<IterableIterator<keyof MyContext>>();
    });

    it('should return discriminated union entries() for proper type narrowing', () => {
      const context = new RequestContext<MyContext>();

      // entries() should return a discriminated union of tuples
      // This enables type narrowing when checking the key
      const entries = context.entries();

      // The type should be a discriminated union: ['name', string] | ['age', number] | ['isActive', boolean]
      type ExpectedEntryType = ['name', string] | ['age', number] | ['isActive', boolean];
      assertType<IterableIterator<ExpectedEntryType>>(entries);

      // Verify type narrowing works when iterating
      for (const [key, value] of entries) {
        if (key === 'age') {
          // When key is narrowed to 'age', value should be narrowed to number
          expectTypeOf(value).toEqualTypeOf<number>();
        } else if (key === 'name') {
          // When key is narrowed to 'name', value should be narrowed to string
          expectTypeOf(value).toEqualTypeOf<string>();
        } else {
          // When key is 'isActive', value should be boolean
          expectTypeOf(value).toEqualTypeOf<boolean>();
        }
      }
    });

    it('should accept correct value types in set()', () => {
      const context = new RequestContext<MyContext>();

      // Verify correct types work
      context.set('name', 'John');
      context.set('age', 25);
      context.set('isActive', true);

      // Assert the value type for 'age' must be number
      expectTypeOf<string>().not.toMatchTypeOf<Parameters<typeof context.set<'age'>>[1]>();

      // Assert 'unknownKey' is not a valid key
      expectTypeOf<'unknownKey'>().not.toMatchTypeOf<keyof MyContext>();
    });

    it('should work with nested object types', () => {
      type NestedContext = {
        user: { id: string; name: string };
        settings: { theme: 'light' | 'dark' };
      };

      const context = new RequestContext<NestedContext>();

      const user = context.get('user');
      expectTypeOf(user).toEqualTypeOf<{ id: string; name: string }>();

      const settings = context.get('settings');
      expectTypeOf(settings).toEqualTypeOf<{ theme: 'light' | 'dark' }>();
    });

    it('should infer correct value types from values()', () => {
      const context = new RequestContext<MyContext>();
      const values = context.values();
      expectTypeOf(values).toEqualTypeOf<IterableIterator<string | number | boolean>>();
    });

    it('should provide typed callback in forEach()', () => {
      const context = new RequestContext<MyContext>();
      context.forEach((value, key) => {
        // Key should be typed as keyof MyContext
        expectTypeOf(key).toEqualTypeOf<keyof MyContext>();
        // Value is the union of all value types (no narrowing in forEach)
        expectTypeOf(value).toEqualTypeOf<string | number | boolean>();
      });
    });
  });

  describe('Issue #21286: a declared schema narrows autocomplete without closing the map', () => {
    type MyContext = {
      tenantTier?: 'free' | 'pro';
      verbose?: boolean;
    };

    const RUNTIME_KEY = 'session.cache';

    it('should accept undeclared keys without a cast', () => {
      const context = new RequestContext<MyContext>();

      // The runtime stores these; before #21286 each of these lines was a
      // TS2345 and callers had to write `get(KEY as never)`.
      context.set(RUNTIME_KEY, { hits: 0 });
      context.set('mastra__resourceId', 'resource-1');
      context.has(RUNTIME_KEY);
      context.delete(RUNTIME_KEY);
    });

    it('should type undeclared keys as unknown, not never', () => {
      const context = new RequestContext<MyContext>();

      const value = context.get(RUNTIME_KEY);
      expectTypeOf(value).toEqualTypeOf<unknown>();

      // `unknown` is the honest type: the caller narrows it themselves.
      expectTypeOf<{ hits: number }>().toMatchTypeOf<unknown>();
    });

    it('should keep declared keys strictly typed', () => {
      const context = new RequestContext<MyContext>();

      // Declared keys must not have been widened to unknown by the fix.
      expectTypeOf(context.get('tenantTier')).toEqualTypeOf<'free' | 'pro' | undefined>();
      expectTypeOf(context.get('verbose')).toEqualTypeOf<boolean | undefined>();

      // And their value types are still enforced on set().
      expectTypeOf<number>().not.toMatchTypeOf<Parameters<typeof context.set<'verbose'>>[1]>();
    });

    it('should still honour an explicit return-type override on get()', () => {
      const context = new RequestContext<MyContext>();

      const value = context.get<typeof RUNTIME_KEY, { hits: number }>(RUNTIME_KEY);
      expectTypeOf(value).toEqualTypeOf<{ hits: number }>();
    });
  });

  describe('Untyped RequestContext should allow any key', () => {
    it('should return unknown for untyped context', () => {
      const context = new RequestContext();

      const value = context.get('anyKey');
      expectTypeOf(value).toEqualTypeOf<unknown>();
    });

    it('should allow setting any key on untyped context', () => {
      const context = new RequestContext();

      // These should all compile without errors
      context.set('stringKey', 'value');
      context.set('numberKey', 42);
      context.set('objectKey', { foo: 'bar' });
    });
  });
});

import { describe, expectTypeOf, it } from 'vitest';
import { RequestContext } from './index';
import type { IRequestContext } from './index';

/**
 * Type tests for RequestContext type inference
 *
 * With the new IRequestContext interface design:
 * - RequestContext<T> provides typed get/set via method overloads
 * - keys(), entries(), values() return string/unknown for IRequestContext compatibility
 * - RequestContext<T> is always assignable to IRequestContext
 */
describe('RequestContext Type Tests', () => {
  describe('Typed get() and set() with method overloads', () => {
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
  });

  describe('IRequestContext-compatible methods return loose types', () => {
    type MyContext = {
      name: string;
      age: number;
      isActive: boolean;
    };

    it('should return IterableIterator<string> from keys() for IRequestContext compatibility', () => {
      const context = new RequestContext<MyContext>();

      // keys() returns string iterator (not keyof T) for IRequestContext compatibility
      const keys = context.keys();
      expectTypeOf(keys).toEqualTypeOf<IterableIterator<string>>();
    });

    it('should return IterableIterator<[string, unknown]> from entries()', () => {
      const context = new RequestContext<MyContext>();

      // entries() returns [string, unknown] for IRequestContext compatibility
      const entries = context.entries();
      expectTypeOf(entries).toEqualTypeOf<IterableIterator<[string, unknown]>>();
    });

    it('should return IterableIterator<unknown> from values()', () => {
      const context = new RequestContext<MyContext>();

      // values() returns unknown iterator for IRequestContext compatibility
      const values = context.values();
      expectTypeOf(values).toEqualTypeOf<IterableIterator<unknown>>();
    });

    it('should provide unknown value in forEach() callback', () => {
      const context = new RequestContext<MyContext>();
      context.forEach((value, key) => {
        // Key is string, value is unknown for IRequestContext compatibility
        expectTypeOf(key).toEqualTypeOf<string>();
        expectTypeOf(value).toEqualTypeOf<unknown>();
      });
    });
  });

  describe('RequestContext assignability to IRequestContext', () => {
    it('should be assignable to IRequestContext', () => {
      type MyContext = { userId: string; tenantId: string };

      // Any typed RequestContext should be assignable to IRequestContext
      const typedContext = new RequestContext<MyContext>();
      expectTypeOf(typedContext).toMatchTypeOf<IRequestContext>();
    });

    it('should allow passing typed context to function expecting IRequestContext', () => {
      type MyContext = { userId: string };

      // A function that accepts IRequestContext
      type AcceptIRequestContext = (ctx: IRequestContext) => unknown;

      // A typed RequestContext should be passable
      const typedCtx = new RequestContext<MyContext>();

      // This should compile - the key benefit of the IRequestContext design
      expectTypeOf(typedCtx).toMatchTypeOf<Parameters<AcceptIRequestContext>[0]>();
    });
  });

  describe('Untyped RequestContext', () => {
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

    it('should have all property return Record<string, unknown>', () => {
      const context = new RequestContext();

      const all = context.all;
      expectTypeOf(all).toEqualTypeOf<Record<string, unknown>>();
    });
  });

  describe('Typed RequestContext all property', () => {
    it('should return typed object from all property', () => {
      type MyContext = {
        name: string;
        age: number;
      };

      const context = new RequestContext<MyContext>();
      context.set('name', 'John');
      context.set('age', 30);

      const all = context.all;
      expectTypeOf(all).toEqualTypeOf<MyContext>();
    });
  });
});

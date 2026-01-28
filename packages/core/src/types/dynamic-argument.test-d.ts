import { describe, expectTypeOf, it } from 'vitest';
import type { Mastra } from '../mastra';
import type { DynamicArgument } from './dynamic-argument';

/**
 * Type tests for DynamicArgument with optional TContext generic
 */
describe('DynamicArgument Type Tests', () => {
  describe('Backward compatibility with single generic parameter', () => {
    it('should work with just value type', () => {
      // DynamicArgument<T> should still work as before
      const staticValue: DynamicArgument<string> = 'hello';
      expectTypeOf(staticValue).toMatchTypeOf<DynamicArgument<string>>();
    });

    it('should accept function with untyped RequestContext', () => {
      const dynamicValue: DynamicArgument<string> = ({ requestContext }) => {
        // Without TContext, get returns unknown
        const value = requestContext.get('anything');
        expectTypeOf(value).toEqualTypeOf<unknown>();
        return 'computed';
      };
      expectTypeOf(dynamicValue).toMatchTypeOf<DynamicArgument<string>>();
    });

    it('should accept async function', () => {
      const asyncValue: DynamicArgument<number> = async () => {
        return 42;
      };
      expectTypeOf(asyncValue).toMatchTypeOf<DynamicArgument<number>>();
    });
  });

  describe('Typed context with TContext generic', () => {
    type MyContext = {
      userId: string;
      tenantId: string;
      isAdmin: boolean;
    };

    it('should provide typed RequestContext when TContext is specified', () => {
      const dynamicValue: DynamicArgument<string, MyContext> = ({ requestContext }) => {
        // With TContext, get returns the correct type for each key
        const userId = requestContext.get('userId');
        expectTypeOf(userId).toEqualTypeOf<string>();

        const tenantId = requestContext.get('tenantId');
        expectTypeOf(tenantId).toEqualTypeOf<string>();

        const isAdmin = requestContext.get('isAdmin');
        expectTypeOf(isAdmin).toEqualTypeOf<boolean>();

        return `User: ${userId}`;
      };
      expectTypeOf(dynamicValue).toMatchTypeOf<DynamicArgument<string, MyContext>>();
    });

    it('should type check keys in typed context', () => {
      const dynamicValue: DynamicArgument<string, MyContext> = ({ requestContext }) => {
        // Only keys from MyContext should be valid
        const keys = requestContext.keys();
        expectTypeOf(keys).toEqualTypeOf<IterableIterator<keyof MyContext>>();
        return 'test';
      };
      expectTypeOf(dynamicValue).toMatchTypeOf<DynamicArgument<string, MyContext>>();
    });

    it('should work with async functions and typed context', () => {
      const asyncValue: DynamicArgument<string, MyContext> = async ({ requestContext }) => {
        const tenantId = requestContext.get('tenantId');
        expectTypeOf(tenantId).toEqualTypeOf<string>();
        return `Tenant: ${tenantId}`;
      };
      expectTypeOf(asyncValue).toMatchTypeOf<DynamicArgument<string, MyContext>>();
    });

    it('should allow static values with typed context', () => {
      // Static values don't use context, but the type should still be valid
      const staticValue: DynamicArgument<string, MyContext> = 'static';
      expectTypeOf(staticValue).toMatchTypeOf<DynamicArgument<string, MyContext>>();
    });
  });

  describe('Complex value types', () => {
    type Context = { locale: string };

    it('should work with object value types', () => {
      type Config = { name: string; value: number };
      const configDynamic: DynamicArgument<Config, Context> = ({ requestContext }) => {
        return { name: requestContext.get('locale'), value: 42 };
      };
      expectTypeOf(configDynamic).toMatchTypeOf<DynamicArgument<Config, Context>>();
    });

    it('should work with array value types', () => {
      const arrayDynamic: DynamicArgument<string[], Context> = ({ requestContext }) => {
        return [requestContext.get('locale'), 'default'];
      };
      expectTypeOf(arrayDynamic).toMatchTypeOf<DynamicArgument<string[], Context>>();
    });

    it('should work with union value types', () => {
      const unionDynamic: DynamicArgument<string | null, Context> = ({ requestContext }) => {
        const locale = requestContext.get('locale');
        return locale || null;
      };
      expectTypeOf(unionDynamic).toMatchTypeOf<DynamicArgument<string | null, Context>>();
    });
  });

  describe('Mastra parameter', () => {
    it('should have optional mastra parameter', () => {
      const withMastra: DynamicArgument<string> = ({ mastra }) => {
        // mastra should be optional (Mastra | undefined)
        expectTypeOf(mastra).toEqualTypeOf<Mastra | undefined>();
        return 'test';
      };
      expectTypeOf(withMastra).toMatchTypeOf<DynamicArgument<string>>();
    });
  });
});

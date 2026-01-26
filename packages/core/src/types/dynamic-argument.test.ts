import { describe, expect, it } from 'vitest';
import { RequestContext } from '../request-context';
import type { DynamicArgument } from './dynamic-argument';

/**
 * Runtime tests for DynamicArgument resolution
 */
describe('DynamicArgument Runtime Tests', () => {
  // Helper to resolve a dynamic argument
  async function resolveDynamicArg<T, TContext = unknown>(
    arg: DynamicArgument<T, TContext>,
    requestContext: RequestContext<TContext>,
  ): Promise<T> {
    if (typeof arg === 'function') {
      return await (arg as Function)({ requestContext });
    }
    return arg;
  }

  describe('Static values', () => {
    it('should return static string values', async () => {
      const arg: DynamicArgument<string> = 'hello';
      const result = await resolveDynamicArg(arg, new RequestContext());
      expect(result).toBe('hello');
    });

    it('should return static number values', async () => {
      const arg: DynamicArgument<number> = 42;
      const result = await resolveDynamicArg(arg, new RequestContext());
      expect(result).toBe(42);
    });

    it('should return static object values', async () => {
      const obj = { name: 'test', value: 123 };
      const arg: DynamicArgument<typeof obj> = obj;
      const result = await resolveDynamicArg(arg, new RequestContext());
      expect(result).toEqual({ name: 'test', value: 123 });
    });
  });

  describe('Dynamic function values', () => {
    it('should resolve sync function', async () => {
      const arg: DynamicArgument<string> = () => 'computed';
      const result = await resolveDynamicArg(arg, new RequestContext());
      expect(result).toBe('computed');
    });

    it('should resolve async function', async () => {
      const arg: DynamicArgument<string> = async () => 'async-computed';
      const result = await resolveDynamicArg(arg, new RequestContext());
      expect(result).toBe('async-computed');
    });

    it('should pass requestContext to function', async () => {
      const context = new RequestContext<{ userId: string }>();
      context.set('userId', 'user-123');

      const arg: DynamicArgument<string, { userId: string }> = ({ requestContext }) => {
        return `User: ${requestContext.get('userId')}`;
      };

      const result = await resolveDynamicArg(arg, context);
      expect(result).toBe('User: user-123');
    });
  });

  describe('Typed RequestContext', () => {
    type MyContext = {
      userId: string;
      tenantId: string;
      isAdmin: boolean;
    };

    it('should access typed context values', async () => {
      const context = new RequestContext<MyContext>([
        ['userId', 'user-456'],
        ['tenantId', 'tenant-789'],
        ['isAdmin', true],
      ]);

      const arg: DynamicArgument<string, MyContext> = ({ requestContext }) => {
        const userId = requestContext.get('userId');
        const tenantId = requestContext.get('tenantId');
        const isAdmin = requestContext.get('isAdmin');
        return `${userId}@${tenantId} (admin: ${isAdmin})`;
      };

      const result = await resolveDynamicArg(arg, context);
      expect(result).toBe('user-456@tenant-789 (admin: true)');
    });

    it('should work with async function and typed context', async () => {
      const context = new RequestContext<MyContext>([
        ['userId', 'async-user'],
        ['tenantId', 'async-tenant'],
        ['isAdmin', false],
      ]);

      const arg: DynamicArgument<{ user: string; admin: boolean }, MyContext> = async ({ requestContext }) => {
        // Simulate async operation
        await Promise.resolve();
        return {
          user: requestContext.get('userId'),
          admin: requestContext.get('isAdmin'),
        };
      };

      const result = await resolveDynamicArg(arg, context);
      expect(result).toEqual({ user: 'async-user', admin: false });
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined context values', async () => {
      const context = new RequestContext<{ optional?: string }>();

      const arg: DynamicArgument<string | undefined, { optional?: string }> = ({ requestContext }) => {
        return requestContext.get('optional');
      };

      const result = await resolveDynamicArg(arg, context);
      expect(result).toBeUndefined();
    });

    it('should handle function that returns null', async () => {
      const arg: DynamicArgument<string | null> = () => null;
      const result = await resolveDynamicArg(arg, new RequestContext());
      expect(result).toBeNull();
    });

    it('should handle empty context', async () => {
      const arg: DynamicArgument<number> = ({ requestContext }) => {
        return requestContext.size();
      };
      const result = await resolveDynamicArg(arg, new RequestContext());
      expect(result).toBe(0);
    });
  });
});

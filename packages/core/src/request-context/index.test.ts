import { describe, it, expect } from 'vitest';
import { RequestContext } from './index';

describe('RequestContext', () => {
  describe('constructor', () => {
    it('should construct from a plain object (e.g. deserialized from JSON)', () => {
      const original = new RequestContext();
      original.set('userTier', 'free');
      original.set('feature', 'dark-mode');
      original.set('count', 42);

      const serialized = original.toJSON();
      const restored = new RequestContext(serialized as any);

      expect(restored.get('userTier')).toBe('free');
      expect(restored.get('feature')).toBe('dark-mode');
      expect(restored.get('count')).toBe(42);
      expect(restored.size()).toBe(3);
    });

    it('should construct from an empty plain object', () => {
      const restored = new RequestContext({} as any);

      expect(restored.size()).toBe(0);
    });

    it('should still construct from undefined', () => {
      const ctx = new RequestContext();
      expect(ctx.size()).toBe(0);
    });

    it('should still construct from an array of tuples', () => {
      const ctx = new RequestContext([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);
      expect(ctx.get('key1')).toBe('value1');
      expect(ctx.get('key2')).toBe('value2');
    });
  });

  describe('toJSON', () => {
    it('should correctly serialize serializable values', () => {
      const ctx = new RequestContext();
      ctx.set('string', 'hello');
      ctx.set('number', 42);
      ctx.set('boolean', true);
      ctx.set('null', null);
      ctx.set('object', { nested: 'value' });
      ctx.set('array', [1, 2, 3]);

      const json = ctx.toJSON();

      expect(json).toEqual({
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        object: { nested: 'value' },
        array: [1, 2, 3],
      });
    });

    it('should skip functions', () => {
      const ctx = new RequestContext();
      ctx.set('serializable', 'value');
      ctx.set('func', () => 'function');

      const json = ctx.toJSON();

      expect(json).toEqual({
        serializable: 'value',
      });
      expect(json).not.toHaveProperty('func');
    });

    it('should skip symbols', () => {
      const ctx = new RequestContext();
      ctx.set('serializable', 'value');
      ctx.set('symbol', Symbol('test'));

      const json = ctx.toJSON();

      expect(json).toEqual({
        serializable: 'value',
      });
      expect(json).not.toHaveProperty('symbol');
    });

    it('should skip objects with circular references', () => {
      const ctx = new RequestContext();
      ctx.set('serializable', 'value');

      const circular: Record<string, unknown> = { name: 'circular' };
      circular.self = circular;
      ctx.set('circular', circular);

      const json = ctx.toJSON();

      expect(json).toEqual({
        serializable: 'value',
      });
      expect(json).not.toHaveProperty('circular');
    });

    it('should skip objects without toJSON method (e.g., RPC proxies)', () => {
      const ctx = new RequestContext();
      ctx.set('serializable', 'value');

      // Simulate an RPC proxy that throws an error when JSON.stringify is called
      const rpcProxy = new Proxy(
        {},
        {
          get(target, prop) {
            if (prop === 'toJSON') {
              throw new TypeError('The RPC receiver does not implement the method "toJSON".');
            }
            return Reflect.get(target, prop);
          },
        },
      );
      ctx.set('rpcProxy', rpcProxy);

      const json = ctx.toJSON();

      expect(json).toEqual({
        serializable: 'value',
      });
      expect(json).not.toHaveProperty('rpcProxy');
    });

    it('should handle undefined values', () => {
      const ctx = new RequestContext();
      ctx.set('defined', 'value');
      ctx.set('undefined', undefined);

      const json = ctx.toJSON();

      expect(json).toEqual({
        defined: 'value',
        undefined: undefined,
      });
    });

    it('should return empty object for empty RequestContext', () => {
      const ctx = new RequestContext();

      const json = ctx.toJSON();

      expect(json).toEqual({});
    });

    it('should return only serializable values when mixed with non-serializable values', () => {
      const ctx = new RequestContext();
      ctx.set('userId', 'user-123');
      ctx.set('feature', 'dark-mode');
      ctx.set('callback', () => {});

      const circular: Record<string, unknown> = {};
      circular.self = circular;
      ctx.set('badData', circular);

      const json = ctx.toJSON();

      expect(json).toEqual({
        userId: 'user-123',
        feature: 'dark-mode',
      });
    });

    it('should skip values that transitively reference another RequestContext that references back (cross-context cycle)', () => {
      // Without the reentry guard this hangs the Node event loop at 100% CPU.
      // V8's in-call cycle detection does NOT catch this case because each
      // `isSerializable(value)` is a fresh `JSON.stringify(value)` call with
      // a fresh internal cycle stack — recursion happens across calls, not
      // within one. The pattern appears in real agent runtimes where one
      // RequestContext stores a service object that references a second
      // RequestContext (e.g. a sub-agent's), and the second references back.
      const ctxA = new RequestContext();
      const ctxB = new RequestContext();
      ctxA.set('ref', { other: ctxB });
      ctxB.set('ref', { other: ctxA });
      ctxA.set('serializable', 'value');

      const start = Date.now();
      const json = ctxA.toJSON();
      const elapsed = Date.now() - start;

      // Failure mode is unbounded recursion; even on a slow CI node this
      // completes in microseconds. The threshold is loose on purpose to
      // assert "did not hang", not "is fast".
      expect(elapsed).toBeLessThan(2000);
      // The serializable key is preserved; the cyclic key is filtered the
      // same way circular in-value references are.
      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('ref');
    });

    it('should skip values that contain a direct self-back-reference to the same context', () => {
      const ctx = new RequestContext();
      ctx.set('userId', 'user-123');
      // Stored value contains a reference back to the owning context.
      ctx.set('bridge', { ctx });

      const start = Date.now();
      const json = ctx.toJSON();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(json).toEqual({ userId: 'user-123' });
      expect(json).not.toHaveProperty('bridge');
    });

    it('should skip values in a 3-way cycle A → B → C → A', () => {
      const A = new RequestContext();
      const B = new RequestContext();
      const C = new RequestContext();
      A.set('userId', 'a-user');
      A.set('next', { c: B });
      B.set('next', { c: C });
      C.set('next', { c: A });

      const start = Date.now();
      const json = A.toJSON();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(json).toEqual({ userId: 'a-user' });
      expect(json).not.toHaveProperty('next');
    });

    it('should produce a finite, cycle-free JSON string when JSON.stringify is called on a context with cross-context back-references', () => {
      const ctxA = new RequestContext();
      const ctxB = new RequestContext();
      ctxA.set('ref', { other: ctxB });
      ctxB.set('ref', { other: ctxA });
      ctxA.set('serializable', 'value');

      const start = Date.now();
      const serialized = JSON.stringify(ctxA);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual({ serializable: 'value' });
    });
  });
});

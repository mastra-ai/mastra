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
  });
});

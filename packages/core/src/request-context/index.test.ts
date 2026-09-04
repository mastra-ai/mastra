import { describe, it, expect } from 'vitest';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from './index';

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

    it('should skip acyclic shared-reference values that expand past the serialization budget, in bounded time', () => {
      // JSON.stringify expands shared references once per path: this value
      // holds 31 heap objects but expands to 2^30 visited nodes. Without the
      // probe budget the stringify probe burns 60-100s of synchronous CPU,
      // throws RangeError past V8's string cap, and the key is filtered
      // anyway — after blocking the event loop for the full expansion.
      let node: unknown = { leaf: true };
      for (let i = 0; i < 30; i++) node = { a: node, b: node };

      const ctx = new RequestContext();
      ctx.set('sharedDag', node);
      ctx.set('serializable', 'value');

      const start = Date.now();
      const json = ctx.toJSON();
      const elapsed = Date.now() - start;

      // The unbudgeted probe takes minutes here; the budgeted one bails in
      // tens of milliseconds. Loose threshold to assert "bounded", not "fast".
      expect(elapsed).toBeLessThan(2000);
      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('sharedDag');
    });

    it('should keep acyclic shared-reference values that stay within the serialization budget', () => {
      // Same shape, but 2^10 expanded nodes — far under the budget.
      let node: unknown = { leaf: true };
      for (let i = 0; i < 10; i++) node = { a: node, b: node };

      const ctx = new RequestContext();
      ctx.set('smallDag', node);

      const json = ctx.toJSON();

      expect(json).toHaveProperty('smallDag');
    });

    it('should bound nested RequestContext probes by sharing one budget across them (#20446)', () => {
      // A shared-reference graph that reaches a nested RequestContext through
      // 2^8 paths. With a per-call budget each of the 256 visits re-ran the
      // inner probe with a fresh full budget (~9-10s). Sharing one budget across
      // nested probes bounds the total work and filters the over-budget key.
      const inner = new RequestContext();
      let big: unknown = { leaf: true };
      for (let i = 0; i < 25; i++) big = { a: big, b: big }; // over budget on its own
      inner.set('big', big);

      let outer: unknown = inner;
      for (let i = 0; i < 8; i++) outer = { a: outer, b: outer }; // 2^8 shared paths to inner

      const ctx = new RequestContext();
      ctx.set('outer', outer);
      ctx.set('serializable', 'value');

      const start = Date.now();
      const json = ctx.toJSON();
      const elapsed = Date.now() - start;

      // Loose threshold: assert "bounded", not "fast" (was ~9-10s unbounded).
      expect(elapsed).toBeLessThan(2000);
      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('outer');
    });

    it('should keep nested RequestContext values whose total probe stays within budget', () => {
      const inner = new RequestContext();
      inner.set('userId', 'user-123');
      inner.set('data', { nested: { value: 1 } });

      const ctx = new RequestContext();
      ctx.set('inner', { ctx: inner });

      const json = ctx.toJSON();

      expect(json).toHaveProperty('inner');
    });

    it('should skip oversized typed arrays without materializing their elements, and keep small ones', () => {
      const ctx = new RequestContext();
      ctx.set('bigTyped', new Float64Array(8 * 1024 * 1024));
      ctx.set('smallTyped', new Uint8Array(16));
      ctx.set('smallBuffer', Buffer.alloc(64));

      const start = Date.now();
      const json = ctx.toJSON();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(json).not.toHaveProperty('bigTyped');
      expect(json).toHaveProperty('smallTyped');
      expect(json).toHaveProperty('smallBuffer');
    });

    it('should still skip BigInt-element typed arrays like the unbudgeted probe did', () => {
      const ctx = new RequestContext();
      ctx.set('bigIntArray', new BigInt64Array([1n]));
      ctx.set('serializable', 'value');

      const json = ctx.toJSON();

      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('bigIntArray');
    });

    it('should skip BigInt-element typed arrays whose brand tag is spoofed', () => {
      // An own Symbol.toStringTag shadows the built-in typed-array tag, so
      // detection must not rely on it — the elements are still BigInt and a
      // real JSON.stringify still throws.
      const spoofed = new BigInt64Array([1n]);
      Object.defineProperty(spoofed, Symbol.toStringTag, { value: 'Uint8Array' });

      const ctx = new RequestContext();
      ctx.set('spoofedBigIntArray', spoofed);
      ctx.set('serializable', 'value');

      const json = ctx.toJSON();

      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('spoofedBigIntArray');
    });

    it('should keep empty BigInt-element typed arrays, matching JSON.stringify', () => {
      // No elements to throw on: JSON.stringify(new BigInt64Array(0)) is '{}',
      // so the unbudgeted probe kept it and the budgeted probe must too.
      const ctx = new RequestContext();
      ctx.set('emptyBigIntArray', new BigInt64Array(0));

      const json = ctx.toJSON();

      expect(json).toHaveProperty('emptyBigIntArray');
    });

    it('should skip BigInt-element typed arrays created in another realm', async () => {
      // A foreign-realm BigInt64Array passes ArrayBuffer.isView but fails
      // `instanceof BigInt64Array`, so the fast path must detect it via the
      // cross-realm brand tag — JSON.stringify still throws on its elements.
      const vm = await import('node:vm');
      const foreign = vm.runInNewContext('new BigInt64Array([1n])');

      const ctx = new RequestContext();
      ctx.set('foreignBigIntArray', foreign);
      ctx.set('serializable', 'value');

      const json = ctx.toJSON();

      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('foreignBigIntArray');
    });

    it('should skip typed arrays whose custom enumerable getter throws', () => {
      // The element fast path must not hide non-index properties from the
      // probe: a throwing getter fails a real JSON.stringify, so it must
      // fail the probe too.
      const typed = new Uint8Array([1]);
      Object.defineProperty(typed, 'boom', {
        enumerable: true,
        get() {
          throw new Error('getter invoked');
        },
      });

      const ctx = new RequestContext();
      ctx.set('throwingTyped', typed);
      ctx.set('serializable', 'value');

      const json = ctx.toJSON();

      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('throwingTyped');
    });

    it('should skip typed arrays whose custom property leads back into a cycle', () => {
      const typed = new Uint8Array([1]);
      const holder: Record<string, unknown> = { typed };
      Object.defineProperty(typed, 'back', { enumerable: true, value: holder });

      const ctx = new RequestContext();
      ctx.set('cyclicTyped', typed);
      ctx.set('serializable', 'value');

      const json = ctx.toJSON();

      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('cyclicTyped');
    });

    it('should keep plain DataViews, matching JSON.stringify', () => {
      // A DataView has no intrinsic elements; JSON.stringify renders it '{}'.
      const ctx = new RequestContext();
      ctx.set('dataView', new DataView(new ArrayBuffer(8)));

      const json = ctx.toJSON();

      expect(json).toHaveProperty('dataView');
    });

    it('should skip DataViews whose own index-named property leads back into a cycle', () => {
      // Unlike a typed array, an index-named own property on a DataView is
      // ordinary data that a real serialization walks — the probe must not
      // treat it as a skippable element.
      const dataView = new DataView(new ArrayBuffer(8));
      const holder: Record<string, unknown> = { dataView };
      (dataView as unknown as Record<number, unknown>)[0] = holder;

      const ctx = new RequestContext();
      ctx.set('cyclicDataView', dataView);
      ctx.set('serializable', 'value');

      const json = ctx.toJSON();

      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('cyclicDataView');
    });

    it('should budget typed-array elements by intrinsic length even when an own length property lies', () => {
      const big = new Float64Array(8 * 1024 * 1024);
      Object.defineProperty(big, 'length', { value: 0 });

      const ctx = new RequestContext();
      ctx.set('lyingLength', big);
      ctx.set('serializable', 'value');

      const start = Date.now();
      const json = ctx.toJSON();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('lyingLength');
    });

    it('should skip typed arrays whose own enumerable __proto__ property leads back into a cycle', () => {
      // An own enumerable `__proto__` data property is serialized by
      // JSON.stringify; a plain-object surrogate would swallow it through
      // the inherited setter and let the probe pass a value that a real
      // serialization rejects.
      const typed = new Uint8Array([1]);
      const holder: Record<string, unknown> = { typed };
      Object.defineProperty(typed, '__proto__', { enumerable: true, value: holder });

      const ctx = new RequestContext();
      ctx.set('protoCyclicTyped', typed);
      ctx.set('serializable', 'value');

      const json = ctx.toJSON();

      expect(json).toEqual({ serializable: 'value' });
      expect(json).not.toHaveProperty('protoCyclicTyped');
    });
  });

  describe('serializeForSpan', () => {
    it('should redact the auth token key', () => {
      const ctx = new RequestContext();
      ctx.set(MASTRA_AUTH_TOKEN_KEY, 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.secret');
      ctx.set('userId', 'user-123');

      const result = ctx.serializeForSpan();

      expect(result[MASTRA_AUTH_TOKEN_KEY]).toBe('[REDACTED]');
      expect(result['userId']).toBe('user-123');
    });

    it('should include primitive values as-is', () => {
      const ctx = new RequestContext();
      ctx.set('str', 'hello');
      ctx.set('num', 42);
      ctx.set('bool', true);
      ctx.set('nil', null);
      ctx.set('undef', undefined);

      const result = ctx.serializeForSpan();

      expect(result).toEqual({
        str: 'hello',
        num: 42,
        bool: true,
        nil: null,
        undef: undefined,
      });
    });

    it('should pass plain objects and arrays through for deepClean to walk, but collapse other types', () => {
      class Widget {
        secret = 'do-not-walk';
      }
      const ctx = new RequestContext();
      const obj = { nested: 'value' };
      const arr = [1, 2, 3];
      const fn = () => {};
      const instance = new Widget();
      ctx.set('obj', obj);
      ctx.set('arr', arr);
      ctx.set('fn', fn);
      ctx.set('instance', instance);

      const result = ctx.serializeForSpan();

      // Plain objects/arrays are returned by reference so the downstream
      // deepClean walks them (nested data stays visible in traces).
      expect(result['obj']).toBe(obj);
      expect(result['arr']).toBe(arr);
      // Functions and class instances are collapsed, not walked — their
      // internals never reach the trace serializer.
      expect(result['fn']).toBe('[function]');
      expect(result['instance']).toBe('[object]');
    });

    it('should collapse values that reject classification (e.g. a revoked Proxy) instead of throwing', () => {
      const revocable = Proxy.revocable({}, {});
      revocable.revoke();
      const ctx = new RequestContext();
      ctx.set('revoked', revocable.proxy as unknown);
      ctx.set('userId', 'user-123');

      expect(() => ctx.serializeForSpan()).not.toThrow();
      const result = ctx.serializeForSpan();
      expect(result['revoked']).toBe('[object]');
      expect(result['userId']).toBe('user-123');
    });

    it('should return empty object for empty context', () => {
      const ctx = new RequestContext();
      expect(ctx.serializeForSpan()).toEqual({});
    });
  });

  describe('Issue #21286: open-map *Raw helpers', () => {
    it('should read and write undeclared keys through getRaw/setRaw', () => {
      const ctx = new RequestContext<{ tenantTier?: 'free' | 'pro' }>();
      ctx.set('tenantTier', 'pro');
      ctx.setRaw('session.cache', { hits: 0 });

      expect(ctx.get('tenantTier')).toBe('pro');
      expect(ctx.getRaw('session.cache')).toEqual({ hits: 0 });
      expect([...ctx.keys()]).toEqual(['tenantTier', 'session.cache']);
    });

    it('should pass reserved middleware keys through a schema-typed context', () => {
      const ctx = new RequestContext<{ verbose?: boolean }>();
      ctx.set('verbose', true);
      ctx.setRaw(MASTRA_AUTH_TOKEN_KEY, 'secret-token');

      expect(ctx.hasRaw(MASTRA_AUTH_TOKEN_KEY)).toBe(true);
      expect(ctx.getRaw(MASTRA_AUTH_TOKEN_KEY)).toBe('secret-token');
      expect(ctx.deleteRaw(MASTRA_AUTH_TOKEN_KEY)).toBe(true);
      expect(ctx.hasRaw(MASTRA_AUTH_TOKEN_KEY)).toBe(false);
      expect(ctx.get('verbose')).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';

import { safeStringify } from './utils';

describe('safeStringify', () => {
  describe('preserves the original sanitization behaviour', () => {
    it('drops true circular references', () => {
      const a: Record<string, any> = { name: 'a' };
      a.self = a;

      const json = safeStringify(a);

      expect(JSON.parse(json)).toEqual({ name: 'a' });
    });

    it('drops circular references nested deeper in the graph', () => {
      const root: Record<string, any> = { name: 'root' };
      const child: Record<string, any> = { name: 'child' };
      root.child = child;
      child.parent = root;

      const json = safeStringify(root);

      expect(JSON.parse(json)).toEqual({ name: 'root', child: { name: 'child' } });
    });

    it('drops functions and symbols', () => {
      const value = {
        keep: 1,
        fn: () => 'nope',
        sym: Symbol('nope'),
      };

      expect(JSON.parse(safeStringify(value))).toEqual({ keep: 1 });
    });

    it('coerces BigInt to string', () => {
      expect(safeStringify({ n: 10n })).toBe('{"n":"10"}');
    });

    it('honours toJSON when provided (e.g. RequestContext-style objects)', () => {
      const value = {
        toJSON: () => ({ serialized: true }),
      };

      expect(JSON.parse(safeStringify(value))).toEqual({ serialized: true });
    });

    it('tolerates RPC-proxy-style objects that throw on property access', () => {
      // Cloudflare Workers RPC proxies throw when any property (including toJSON)
      // is accessed. safeStringify should drop these instead of crashing.
      const proxy = new Proxy(
        {},
        {
          get() {
            throw new Error('RPC proxy: cannot access properties synchronously');
          },
          ownKeys() {
            throw new Error('RPC proxy: cannot enumerate properties');
          },
        },
      );

      const value = { keep: 1, proxy };

      expect(JSON.parse(safeStringify(value))).toEqual({ keep: 1 });
    });

    it('serializes arrays recursively', () => {
      const value = [1, { a: 2 }, [3, () => 4]];

      expect(JSON.parse(safeStringify(value))).toEqual([1, { a: 2 }, [3, null]]);
    });

    it('returns the string "null" when the input itself is undefined', () => {
      expect(safeStringify(undefined)).toBe('null');
    });
  });

  describe('preserves shared (non-circular) references', () => {
    // Regression test for a bug where the cycle-detection WeakSet was added to
    // but never cleared, causing any object that appeared in two places in the
    // graph (e.g. snapshot.result and context[step].output of a workflow run)
    // to be silently dropped on the second visit.
    it('serializes the same object reference appearing in sibling branches', () => {
      const shared = { result: 3 };
      const value = {
        result: shared,
        context: {
          'add-numbers': { output: shared },
        },
      };

      const parsed = JSON.parse(safeStringify(value));

      expect(parsed.result).toEqual({ result: 3 });
      expect(parsed.context['add-numbers'].output).toEqual({ result: 3 });
    });

    it('serializes shared references repeated inside an array', () => {
      const shared = { id: 'shared' };

      const parsed = JSON.parse(safeStringify({ items: [shared, shared, shared] }));

      expect(parsed.items).toEqual([{ id: 'shared' }, { id: 'shared' }, { id: 'shared' }]);
    });

    it('still drops a reference that becomes a true ancestor cycle even when shared elsewhere', () => {
      const shared: Record<string, any> = { id: 'shared' };
      const branchA: Record<string, any> = { shared };
      shared.back = branchA; // ancestor cycle: branchA -> shared -> branchA

      const value = { branchA, branchB: { shared } };
      const parsed = JSON.parse(safeStringify(value));

      // In branchA, walking branchA -> shared -> back hits branchA on the
      // path, so `back` is dropped: { id: 'shared' }
      expect(parsed.branchA.shared).toEqual({ id: 'shared' });
      // In branchB, walking branchB -> shared -> back -> branchA re-enters
      // shared which is on the path, so the inner `shared` is dropped but
      // `back` itself is kept as an empty object.
      expect(parsed.branchB.shared).toEqual({ id: 'shared', back: {} });
    });
  });
});

import { describe, expect, it } from 'vitest';
import { applyStatePatch, diffState } from './state-patch';
import type { StatePatchOp } from './state-patch';

// mulberry32: a small seeded PRNG, so a failing case can be rerun from its seed.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = ReturnType<typeof rng>;

const KEYS = ['a', 'b', 'c', 'messages', 'count', '__proto__', 'constructor', '0'];

function pick<T>(rand: Rand, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function randomValue(rand: Rand, depth: number): unknown {
  const kind = Math.floor(rand() * (depth > 2 ? 4 : 6));
  switch (kind) {
    case 0:
      return null;
    case 1:
      return Math.floor(rand() * 10);
    case 2:
      return pick(rand, ['', 'x', 'hello']);
    case 3:
      return rand() < 0.5;
    case 4:
      return Array.from({ length: Math.floor(rand() * 4) }, () => randomValue(rand, depth + 1));
    default: {
      const obj: Record<string, unknown> = {};
      for (let i = Math.floor(rand() * 4); i > 0; i--) {
        Object.defineProperty(obj, pick(rand, KEYS), {
          value: randomValue(rand, depth + 1),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      return obj;
    }
  }
}

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// JSON with sorted keys. Vitest's equality can't compare these states: it reads `constructor`
// and `__proto__`, which the generated states use as keys.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, v[k]]),
        )
      : v,
  );

// Returns a changed copy of `state`: one to three random edits somewhere inside it.
function mutate(rand: Rand, state: Record<string, unknown>): Record<string, unknown> {
  const next = json(state);
  for (let edits = 1 + Math.floor(rand() * 3); edits > 0; edits--) {
    let container: any = next;
    while (typeof container === 'object' && container !== null && rand() < 0.6) {
      const keys = Object.keys(container);
      if (keys.length === 0) break;
      const child = container[pick(rand, keys)];
      if (typeof child !== 'object' || child === null) break;
      container = child;
    }
    if (Array.isArray(container)) {
      const r = rand();
      if (r < 0.4) container.push(randomValue(rand, 1));
      else if (r < 0.6) container.length = Math.floor(rand() * container.length);
      else if (container.length > 0) container[Math.floor(rand() * container.length)] = randomValue(rand, 1);
    } else {
      const keys = Object.keys(container);
      if (keys.length > 0 && rand() < 0.3) delete container[pick(rand, keys)];
      else {
        Object.defineProperty(container, pick(rand, KEYS), {
          value: randomValue(rand, 1),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  }
  return next;
}

function randomStates(seed: number, length: number): Record<string, unknown>[] {
  const rand = rng(seed);
  const states: Record<string, unknown>[] = [json({ ...(randomValue(rand, 0) as object) })];
  while (states.length < length) states.push(mutate(rand, states.at(-1)!));
  return states;
}

describe('diffState and applyStatePatch', () => {
  it('applying the diff of two states to the first gives the second', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const states = randomStates(seed, 20);
      for (let i = 1; i < states.length; i++) {
        const ops = diffState(states[i - 1], states[i]);
        expect(canonical(applyStatePatch(json(states[i - 1]!), ops)), `seed ${seed}, step ${i}`).toBe(
          canonical(states[i]),
        );
      }
    }
  });

  it('applying the same diff twice gives the same state as applying it once', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const states = randomStates(seed, 20);
      for (let i = 1; i < states.length; i++) {
        const ops = diffState(states[i - 1], states[i]);
        const once = applyStatePatch(json(states[i - 1]!), ops);
        expect(canonical(applyStatePatch(once, ops)), `seed ${seed}, step ${i}`).toBe(canonical(states[i]));
      }
    }
  });

  it('replaying a whole chain of diffs from the first state gives the last', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const states = randomStates(seed, 30);
      let replayed = json(states[0]!);
      for (let i = 1; i < states.length; i++) replayed = applyStatePatch(replayed, diffState(states[i - 1], states[i]));
      expect(canonical(replayed), `seed ${seed}`).toBe(canonical(states.at(-1)));
    }
  });

  it('replaying a whole chain again onto its own result changes nothing', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const states = randomStates(seed, 30);
      const chain: StatePatchOp[][] = [];
      for (let i = 1; i < states.length; i++) chain.push(diffState(states[i - 1], states[i]));
      let replayed = json(states.at(-1)!);
      for (const ops of chain) replayed = applyStatePatch(replayed, ops);
      expect(canonical(replayed), `seed ${seed}`).toBe(canonical(states.at(-1)));
    }
  });

  it('returns no ops when nothing changed', () => {
    const state = { a: 1, b: [1, { c: 'x' }], d: { e: null } };
    expect(diffState(state, json(state))).toEqual([]);
  });

  it('sets each new index of a grown array', () => {
    expect(diffState({ messages: ['a'] }, { messages: ['a', 'b', 'c'] })).toEqual([
      { op: 'set', path: ['messages', 1], value: 'b' },
      { op: 'set', path: ['messages', 2], value: 'c' },
    ]);
  });

  it('sets the whole array when it shrinks', () => {
    expect(diffState({ messages: ['a', 'b'] }, { messages: ['a'] })).toEqual([
      { op: 'set', path: ['messages'], value: ['a'] },
    ]);
  });

  it('deletes a removed key and recurses into shared ones', () => {
    expect(diffState({ a: 1, b: { c: 1, d: 2 } }, { b: { c: 1, d: 3 } })).toEqual([
      { op: 'delete', path: ['a'] },
      { op: 'set', path: ['b', 'd'], value: 3 },
    ]);
  });

  it('sets the value when its type changes', () => {
    expect(diffState({ a: [1] }, { a: { 0: 1 } })).toEqual([{ op: 'set', path: ['a'], value: { 0: 1 } }]);
    expect(diffState({ a: { b: 1 } }, { a: 'x' })).toEqual([{ op: 'set', path: ['a'], value: 'x' }]);
  });

  it('creates missing containers on the way to a set', () => {
    expect(
      applyStatePatch({}, [
        { op: 'set', path: ['a', 0, 'b'], value: 1 },
        { op: 'set', path: ['c', 'd'], value: 2 },
      ]),
    ).toStrictEqual({ a: [{ b: 1 }], c: { d: 2 } });
  });

  it('leaves the state alone when a delete path does not exist', () => {
    expect(
      applyStatePatch({ a: 1 }, [
        { op: 'delete', path: ['a', 'b'] },
        { op: 'delete', path: ['c', 'd'] },
      ]),
    ).toStrictEqual({ a: 1 });
  });

  it('copies set values, so the result shares nothing with the ops', () => {
    const ops: StatePatchOp[] = [{ op: 'set', path: ['a'], value: { list: [1] } }];
    const state = applyStatePatch<Record<string, any>>({}, ops);
    state.a.list.push(2);
    expect(ops[0]).toEqual({ op: 'set', path: ['a'], value: { list: [1] } });
  });

  it('stores a __proto__ key as data without touching any prototype', () => {
    const state = applyStatePatch<Record<string, any>>({}, [
      { op: 'set', path: ['__proto__', 'polluted'], value: true },
    ]);
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
    expect(JSON.stringify(state)).toBe('{"__proto__":{"polluted":true}}');
  });

  it('replaces the root on an empty path', () => {
    expect(applyStatePatch({ a: 1 }, [{ op: 'set', path: [], value: { b: 2 } }])).toStrictEqual({ b: 2 });
  });
});

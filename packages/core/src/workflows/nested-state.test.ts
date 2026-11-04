import { describe, expect, it } from 'vitest';
import { copyState, rebaseNestedState } from './nested-state';

describe('rebaseNestedState', () => {
  it('keeps the parent value of a key the nested run did not change', () => {
    expect(rebaseNestedState({ a: 2, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 5 })).toEqual({ a: 2, b: 5 });
  });

  it("appends the nested run's new items after the ones the parent gained meanwhile", () => {
    expect(rebaseNestedState({ items: ['x', 'p'] }, { items: ['x'] }, { items: ['x', 'n1', 'n2'] })).toEqual({
      items: ['x', 'p', 'n1', 'n2'],
    });
  });

  it('appends onto a list the parent replaced meanwhile', () => {
    expect(rebaseNestedState({ items: ['reset'] }, { items: ['x'] }, { items: ['x', 'n'] })).toEqual({
      items: ['reset', 'n'],
    });
  });

  it('replaces a list the nested run edited or shrank', () => {
    expect(rebaseNestedState({ items: ['x', 'y', 'p'] }, { items: ['x', 'y'] }, { items: ['x', 'Y'] })).toEqual({
      items: ['x', 'Y'],
    });
    expect(rebaseNestedState({ items: ['x', 'y', 'p'] }, { items: ['x', 'y'] }, { items: ['x'] })).toEqual({
      items: ['x'],
    });
  });

  it('merges objects key by key, keeping keys the parent added and dropping keys the nested run removed', () => {
    expect(
      rebaseNestedState({ cfg: { a: 1, b: 1, sibling: true } }, { cfg: { a: 1, b: 1 } }, { cfg: { a: 2 } }),
    ).toEqual({ cfg: { a: 2, sibling: true } });
  });

  it('leaves a top-level key the nested run dropped to the parent', () => {
    expect(rebaseNestedState({ a: 1, extra: 1 }, { a: 1, extra: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("keeps the nested run's own values, such as Dates, for what it changed", () => {
    const at = new Date(0);
    const result = rebaseNestedState({ at: 'old', log: [] }, { at: 'old', log: [] }, { at, log: [at] });
    expect(result.at).toBe(at);
    expect((result.log as unknown[])[0]).toBe(at);
  });

  it('treats a Date the nested run kept as unchanged', () => {
    const at = new Date(0);
    expect(rebaseNestedState({ at: 'parent' }, { at: at.toISOString() }, { at })).toEqual({ at: 'parent' });
  });

  it("takes the nested run's value for an unchanged key the parent doesn't have, such as a schema default", () => {
    expect(
      rebaseNestedState<Record<string, unknown>>(
        { cfg: { a: 1 } },
        { mode: 'fast', cfg: { a: 1, level: 3 } },
        { mode: 'fast', cfg: { a: 2, level: 3 } },
      ),
    ).toEqual({ mode: 'fast', cfg: { a: 2, level: 3 } });
  });
});

describe('copyState', () => {
  it('copies plain objects and arrays, and keeps other values as they are', () => {
    class Counter {
      n = 1;
    }
    const at = new Date(0);
    const counter = new Counter();
    const fn = () => 1;
    const state = { list: [{ a: 1 }], at, counter, fn, map: new Map([[1, 2]]) };
    const copy = copyState(state);

    copy.list.push({ a: 2 });
    copy.list[0]!.a = 9;
    expect(state.list).toEqual([{ a: 1 }]);
    expect(copy.at).toBe(at);
    expect(copy.counter).toBe(counter);
    expect(copy.counter).toBeInstanceOf(Counter);
    expect(copy.fn).toBe(fn);
    expect(copy.map).toBe(state.map);
  });

  it('keeps shared and cyclic references within the copy', () => {
    const shared = { n: 1 };
    const state: Record<string, any> = { a: shared, b: shared };
    state.self = state;
    const copy = copyState(state);
    expect(copy.a).toBe(copy.b);
    expect(copy.a).not.toBe(shared);
    expect(copy.self).toBe(copy);
  });

  it('stores a `__proto__` key as data', () => {
    const copy = copyState(JSON.parse('{"__proto__": {"polluted": true}}'));
    expect(Object.hasOwn(copy, '__proto__')).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
  });
});

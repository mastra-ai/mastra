import { describe, it, expect } from 'vitest';
import { cloneJsonWithCycleSafety } from './clone-json-schema';

describe('cloneJsonWithCycleSafety', () => {
  it('clones acyclic objects like JSON.parse(JSON.stringify)', () => {
    const input = { a: 1, b: { c: 'x' } };
    const out = cloneJsonWithCycleSafety(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out.b).not.toBe(input.b);
  });

  it('does not throw on circular references', () => {
    const obj: Record<string, unknown> = { name: 'root' };
    obj.self = obj;
    const out = cloneJsonWithCycleSafety(obj) as Record<string, unknown>;
    expect(out.name).toBe('root');
    expect(out.self).toBe('[Circular]');
  });

  it('preserves duplicated (non-circular) shared references as separate copies', () => {
    const shared = { x: 1 };
    const obj = { a: shared, b: shared };
    const out = cloneJsonWithCycleSafety(obj) as { a: { x: number }; b: { x: number } };
    expect(out.a).toEqual({ x: 1 });
    expect(out.b).toEqual({ x: 1 });
    expect(out.a).not.toBe(out.b);
  });

  it('returns primitives unchanged', () => {
    expect(cloneJsonWithCycleSafety(null)).toBe(null);
    expect(cloneJsonWithCycleSafety(42)).toBe(42);
    expect(cloneJsonWithCycleSafety('hi')).toBe('hi');
  });
});

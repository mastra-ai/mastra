import { describe, it, expect } from 'vitest';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../request-context';
import { snapshotRequestContextForScore } from './request-context-snapshot';

describe('snapshotRequestContextForScore', () => {
  it('excludes the auth token and non-primitive values from a RequestContext', () => {
    const ctx = new RequestContext<any>([
      ['userId', 'u1'],
      [MASTRA_AUTH_TOKEN_KEY, 'secret'],
      ['fn', () => 1],
      ['list', [1, 2]],
      ['count', 3],
      ['flag', false],
    ]);
    expect(snapshotRequestContextForScore(ctx)).toEqual({ userId: 'u1', count: 3, flag: false });
  });

  it('flattens nested plain objects to dotted keys', () => {
    expect(snapshotRequestContextForScore({ a: { b: { c: 'x' } }, d: 1 })).toEqual({ 'a.b.c': 'x', d: 1 });
  });

  it('does not hang on circular references', () => {
    const obj: Record<string, unknown> = { name: 'n' };
    obj.self = obj;
    expect(snapshotRequestContextForScore(obj)).toEqual({ name: 'n' });
  });

  it('skips Buffer and typed-array values', () => {
    expect(snapshotRequestContextForScore({ secret: Buffer.from('abc'), bytes: new Uint8Array([1]), ok: 'y' })).toEqual(
      {
        ok: 'y',
      },
    );
  });

  it('keeps a primitive __proto__ key as an own property', () => {
    const snapshot = snapshotRequestContextForScore(new RequestContext<any>([['__proto__', 'x']]));
    expect(Object.prototype.hasOwnProperty.call(snapshot, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
  });

  it('excludes the auth token at any nesting level', () => {
    const inner = new RequestContext();
    inner.set(MASTRA_AUTH_TOKEN_KEY, 'nested-secret');
    inner.set('ok', 1);
    expect(snapshotRequestContextForScore({ child: inner, obj: { [MASTRA_AUTH_TOKEN_KEY]: 'x' } })).toEqual({
      'child.ok': 1,
    });
  });

  it('skips non-finite numbers', () => {
    expect(snapshotRequestContextForScore({ n: 1, a: NaN, b: Infinity, c: -Infinity })).toEqual({ n: 1 });
  });

  it('returns an empty object for missing input', () => {
    expect(snapshotRequestContextForScore(undefined)).toEqual({});
  });
});

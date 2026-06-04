import { describe, expect, it } from 'vitest';
import { cloneRunData } from './inmemory';

describe('cloneRunData', () => {
  // ── Primitives ──────────────────────────────────────────────────────

  it('returns primitives unchanged', () => {
    expect(cloneRunData(null)).toBe(null);
    expect(cloneRunData(undefined)).toBe(undefined);
    expect(cloneRunData(0)).toBe(0);
    expect(cloneRunData('')).toBe('');
    expect(cloneRunData(true)).toBe(true);
    expect(cloneRunData(42)).toBe(42);
    expect(cloneRunData('hello')).toBe('hello');
  });

  it('returns symbols and bigints unchanged', () => {
    const sym = Symbol('test');
    expect(cloneRunData(sym)).toBe(sym);
    expect(cloneRunData(BigInt(9007199254740991))).toBe(BigInt(9007199254740991));
  });

  // ── Plain objects ───────────────────────────────────────────────────

  it('deep-clones plain objects', () => {
    const src = { a: 1, nested: { b: 2 } };
    const out = cloneRunData(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out.nested).not.toBe(src.nested);
  });

  it('preserves explicitly-undefined properties', () => {
    const src = { present: 1, absent: undefined };
    const out = cloneRunData(src);
    expect(out).toEqual(src);
    expect('absent' in out).toBe(true);
    expect(out.absent).toBeUndefined();
  });

  it('preserves null-prototype objects', () => {
    const src = Object.create(null) as Record<string, unknown>;
    src.key = 'value';
    const out = cloneRunData(src);
    expect(Object.getPrototypeOf(out)).toBe(null);
    expect(out.key).toBe('value');
    expect(out).not.toBe(src);
  });

  // ── Arrays ──────────────────────────────────────────────────────────

  it('deep-clones arrays', () => {
    const src = [1, [2, 3], { x: 4 }];
    const out = cloneRunData(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out[1]).not.toBe(src[1]);
    expect(out[2]).not.toBe(src[2]);
  });

  it('clones sparse arrays preserving holes', () => {
    const src = [1, , 3];
    const out = cloneRunData(src);
    expect(out.length).toBe(3);
    expect(out[0]).toBe(1);
    expect(out[2]).toBe(3);
  });

  // ── Date ────────────────────────────────────────────────────────────

  it('clones Date instances preserving time', () => {
    const src = new Date('2024-01-15T12:00:00Z');
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Date);
    expect(out.getTime()).toBe(src.getTime());
    expect(out).not.toBe(src);
  });

  it('clones invalid dates', () => {
    const src = new Date('invalid');
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Date);
    expect(Number.isNaN(out.getTime())).toBe(true);
  });

  // ── RegExp ──────────────────────────────────────────────────────────

  it('clones RegExp preserving source and flags', () => {
    const src = /foo.*bar/gi;
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(RegExp);
    expect(out.source).toBe('foo.*bar');
    expect(out.flags).toBe('gi');
    expect(out).not.toBe(src);
  });

  // ── URL ─────────────────────────────────────────────────────────────

  it('clones URL instances', () => {
    const src = new URL('https://example.com/path?q=1');
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(URL);
    expect(out.href).toBe(src.href);
    expect(out).not.toBe(src);
  });

  // ── Map ─────────────────────────────────────────────────────────────

  it('deep-clones Maps including nested values', () => {
    const inner = { deep: true };
    const src = new Map<string, unknown>([
      ['key1', 'val1'],
      ['key2', inner],
    ]);
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Map);
    expect(out.size).toBe(2);
    expect(out.get('key1')).toBe('val1');
    expect(out.get('key2')).toEqual(inner);
    expect(out.get('key2')).not.toBe(inner);
    expect(out).not.toBe(src);
  });

  it('clones Maps with object keys', () => {
    const objKey = { id: 1 };
    const src = new Map([[objKey, 'value']]);
    const out = cloneRunData(src);
    expect(out.size).toBe(1);
    const [clonedKey, clonedVal] = [...out.entries()][0]!;
    expect(clonedKey).toEqual(objKey);
    expect(clonedKey).not.toBe(objKey);
    expect(clonedVal).toBe('value');
  });

  // ── Set ─────────────────────────────────────────────────────────────

  it('deep-clones Sets including nested objects', () => {
    const inner = { id: 1 };
    const src = new Set([1, 'two', inner]);
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Set);
    expect(out.size).toBe(3);
    expect(out.has(1)).toBe(true);
    expect(out.has('two')).toBe(true);
    const clonedInner = [...out].find(v => typeof v === 'object');
    expect(clonedInner).toEqual(inner);
    expect(clonedInner).not.toBe(inner);
  });

  // ── Error ───────────────────────────────────────────────────────────

  it('clones Error preserving message, name, and stack', () => {
    const src = new Error('boom');
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe('boom');
    expect(out.name).toBe('Error');
    expect(out.stack).toBe(src.stack);
    expect(out).not.toBe(src);
  });

  it('clones Error subclasses preserving prototype and extra properties', () => {
    const src = new TypeError('bad type');
    (src as Record<string, unknown>).code = 'ERR_INVALID';
    (src as Record<string, unknown>).statusCode = 400;
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(TypeError);
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe('bad type');
    expect(out.name).toBe('TypeError');
    expect((out as Record<string, unknown>).code).toBe('ERR_INVALID');
    expect((out as Record<string, unknown>).statusCode).toBe(400);
  });

  it('clones Error.cause recursively', () => {
    const cause = new Error('root cause');
    const src = new Error('wrapper', { cause });
    const out = cloneRunData(src);
    expect(out.cause).toBeInstanceOf(Error);
    expect((out.cause as Error).message).toBe('root cause');
    expect(out.cause).not.toBe(cause);
  });

  it('honours toJSON that omits stack', () => {
    const src = new Error('no-stack');
    (src as Record<string, unknown>).toJSON = () => ({ message: src.message });
    const out = cloneRunData(src);
    expect(out.message).toBe('no-stack');
    expect(out.stack).toBeUndefined();
  });

  it('includes stack when toJSON includes stack', () => {
    const src = new Error('with-stack');
    (src as Record<string, unknown>).toJSON = () => ({ message: src.message, stack: src.stack });
    const out = cloneRunData(src);
    expect(out.message).toBe('with-stack');
    expect(out.stack).toBe(src.stack);
  });

  it('includes stack when toJSON throws', () => {
    const src = new Error('bad-toJSON');
    (src as Record<string, unknown>).toJSON = () => {
      throw new Error('toJSON broken');
    };
    const out = cloneRunData(src);
    expect(out.message).toBe('bad-toJSON');
    expect(out.stack).toBe(src.stack);
  });

  // ── ArrayBuffer / TypedArrays / DataView ────────────────────────────

  it('clones ArrayBuffer', () => {
    const src = new ArrayBuffer(8);
    new Uint8Array(src).set([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(ArrayBuffer);
    expect(out.byteLength).toBe(8);
    expect(new Uint8Array(out)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(out).not.toBe(src);
  });

  it('clones Uint8Array', () => {
    const src = new Uint8Array([10, 20, 30]);
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out).toEqual(src);
    expect(out.buffer).not.toBe(src.buffer);
  });

  it('clones Float64Array', () => {
    const src = new Float64Array([1.1, 2.2, 3.3]);
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Float64Array);
    expect(out).toEqual(src);
    expect(out.buffer).not.toBe(src.buffer);
  });

  it('clones Int32Array', () => {
    const src = new Int32Array([-1, 0, 2147483647]);
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(Int32Array);
    expect(out).toEqual(src);
  });

  it('clones DataView', () => {
    const buf = new ArrayBuffer(4);
    new Uint8Array(buf).set([0xde, 0xad, 0xbe, 0xef]);
    const src = new DataView(buf);
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(DataView);
    expect(out.byteLength).toBe(4);
    expect(out.getUint8(0)).toBe(0xde);
    expect(out.getUint8(3)).toBe(0xef);
    expect(out.buffer).not.toBe(src.buffer);
  });

  // ── Circular references ─────────────────────────────────────────────

  it('handles self-referential objects', () => {
    const src: Record<string, unknown> = { a: 1 };
    src.self = src;
    const out = cloneRunData(src);
    expect(out.a).toBe(1);
    expect(out.self).toBe(out);
    expect(out).not.toBe(src);
  });

  it('handles circular references in nested structures', () => {
    const a: Record<string, unknown> = { name: 'a' };
    const b: Record<string, unknown> = { name: 'b', ref: a };
    a.ref = b;
    const out = cloneRunData(a);
    expect(out.name).toBe('a');
    expect((out.ref as Record<string, unknown>).name).toBe('b');
    expect((out.ref as Record<string, unknown>).ref).toBe(out);
  });

  it('handles self-referential Error.cause', () => {
    const src = new Error('loop');
    src.cause = src;
    const out = cloneRunData(src);
    expect(out.message).toBe('loop');
    expect(out.cause).toBe(out);
  });

  it('handles circular references in Maps', () => {
    const src = new Map<string, unknown>();
    src.set('self', src);
    const out = cloneRunData(src);
    expect(out.get('self')).toBe(out);
    expect(out).not.toBe(src);
  });

  it('handles circular references in Sets', () => {
    const src = new Set<unknown>();
    src.add(src);
    const out = cloneRunData(src);
    expect(out.has(out)).toBe(true);
    expect(out).not.toBe(src);
  });

  // ── Class instances ─────────────────────────────────────────────────

  it('preserves prototype chain for class instances', () => {
    class StepResult {
      status: string;
      output: unknown;
      constructor(status: string, output: unknown) {
        this.status = status;
        this.output = output;
      }
    }
    const src = new StepResult('completed', { score: 42 });
    const out = cloneRunData(src);
    expect(out).toBeInstanceOf(StepResult);
    expect(out.status).toBe('completed');
    expect(out.output).toEqual({ score: 42 });
    expect(out).not.toBe(src);
  });

  // ── Shared references (DAG, not tree) ───────────────────────────────

  it('preserves identity for shared references (DAG)', () => {
    const shared = { id: 'shared' };
    const src = { a: shared, b: shared };
    const out = cloneRunData(src);
    expect(out.a).toBe(out.b);
    expect(out.a).not.toBe(shared);
    expect(out.a).toEqual(shared);
  });

  // ── Deeply nested structures ────────────────────────────────────────

  it('handles deeply nested objects', () => {
    let src: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 100; i++) {
      src = { child: src };
    }
    const out = cloneRunData(src);
    let cursor: Record<string, unknown> = out;
    for (let i = 0; i < 100; i++) {
      cursor = cursor.child as Record<string, unknown>;
    }
    expect(cursor.value).toBe('leaf');
  });

  // ── Mixed-type graph (realistic workflow state) ─────────────────────

  it('clones a realistic workflow step result', () => {
    const error = new TypeError('timeout');
    (error as Record<string, unknown>).code = 'ETIMEOUT';
    const state = {
      status: 'suspended',
      steps: {
        'step-1': {
          status: 'completed',
          output: {
            response: 'hello',
            timestamp: new Date('2024-06-01'),
            headers: undefined,
            metadata: new Map([['model', 'gpt-4']]),
          },
        },
        'step-2': {
          status: 'failed',
          error,
          retries: 3,
        },
      },
      context: Object.create(null) as Record<string, unknown>,
      tags: new Set(['urgent', 'v2']),
    };
    (state.context as Record<string, unknown>).runId = 'abc-123';

    const out = cloneRunData(state);

    // Top-level
    expect(out.status).toBe('suspended');
    expect(out).not.toBe(state);

    // Step 1 — Date preserved
    const s1 = (out.steps as Record<string, Record<string, unknown>>)['step-1']!;
    const s1out = s1.output as Record<string, unknown>;
    expect(s1out.timestamp).toBeInstanceOf(Date);
    expect((s1out.timestamp as Date).getTime()).toBe(new Date('2024-06-01').getTime());
    expect(s1out.timestamp).not.toBe((state.steps['step-1'].output as Record<string, unknown>).timestamp);

    // Explicitly-undefined preserved
    expect('headers' in s1out).toBe(true);
    expect(s1out.headers).toBeUndefined();

    // Map preserved
    expect(s1out.metadata).toBeInstanceOf(Map);
    expect((s1out.metadata as Map<string, string>).get('model')).toBe('gpt-4');

    // Step 2 — Error preserved
    const s2 = (out.steps as Record<string, Record<string, unknown>>)['step-2']!;
    expect(s2.error).toBeInstanceOf(TypeError);
    expect((s2.error as Error).message).toBe('timeout');
    expect((s2.error as Record<string, unknown>).code).toBe('ETIMEOUT');

    // Null-prototype dict
    expect(Object.getPrototypeOf(out.context)).toBe(null);
    expect((out.context as Record<string, unknown>).runId).toBe('abc-123');

    // Set preserved
    expect(out.tags).toBeInstanceOf(Set);
    expect((out.tags as Set<string>).has('urgent')).toBe(true);
  });

  // ── Edge: functions are preserved by reference (not cloned) ─────────

  it('preserves function references (no clone)', () => {
    const fn = () => 42;
    const src = { callback: fn };
    const out = cloneRunData(src);
    expect(out.callback).toBe(fn);
  });
});

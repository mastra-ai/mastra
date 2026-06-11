import { describe, it, expect, afterEach } from 'vitest';
import { DefaultGeneratedFile, DefaultGeneratedFileWithType } from '../../stream/aisdk/v5/file';
import { encode, decode, registerClass, unregisterClass, CODEC_TAG } from './index';

/**
 * Helper: full wire round-trip — encode, JSON.stringify, JSON.parse, decode.
 * Matches what UnixSocketPubSub does at the frame boundary.
 */
function roundTrip<T>(input: T): unknown {
  return decode(JSON.parse(JSON.stringify(encode(input))));
}

describe('codec', () => {
  describe('primitives', () => {
    it.each([
      ['null', null],
      ['empty string', ''],
      ['string', 'hello'],
      ['number', 42],
      ['zero', 0],
      ['negative number', -3.14],
      ['boolean true', true],
      ['boolean false', false],
    ])('round-trips %s', (_label, input) => {
      expect(roundTrip(input)).toEqual(input);
    });

    it('coerces NaN and Infinity to null (JSON parity)', () => {
      expect(roundTrip(NaN)).toBeNull();
      expect(roundTrip(Infinity)).toBeNull();
      expect(roundTrip(-Infinity)).toBeNull();
    });
  });

  describe('Date', () => {
    it('round-trips a Date instance', () => {
      const d = new Date('2026-06-10T12:34:56.789Z');
      const out = roundTrip(d);
      expect(out).toBeInstanceOf(Date);
      expect((out as Date).toISOString()).toBe(d.toISOString());
    });

    it('round-trips Date nested in object', () => {
      const out = roundTrip({ when: new Date('2026-01-01') }) as { when: Date };
      expect(out.when).toBeInstanceOf(Date);
    });

    it('round-trips Date nested in array', () => {
      const out = roundTrip([new Date('2026-01-01'), new Date('2026-02-01')]) as Date[];
      expect(out[0]).toBeInstanceOf(Date);
      expect(out[1]).toBeInstanceOf(Date);
    });
  });

  describe('Error', () => {
    it('round-trips a plain Error', () => {
      const e = new Error('boom');
      const out = roundTrip(e) as Error;
      expect(out).toBeInstanceOf(Error);
      expect(out.message).toBe('boom');
      expect(out.name).toBe('Error');
      expect(out.stack).toBe(e.stack);
    });

    it('preserves Error name from subclass', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const out = roundTrip(new CustomError('x')) as Error;
      expect(out).toBeInstanceOf(Error);
      expect(out.name).toBe('CustomError');
    });

    it('preserves custom enumerable properties', () => {
      const e = new Error('boom') as Error & { code: string; statusCode: number };
      e.code = 'E_BOOM';
      e.statusCode = 500;
      const out = roundTrip(e) as Error & { code: string; statusCode: number };
      expect(out.message).toBe('boom');
      expect(out.code).toBe('E_BOOM');
      expect(out.statusCode).toBe(500);
    });

    it('preserves Error cause chain', () => {
      const inner = new Error('inner');
      const outer = new Error('outer', { cause: inner });
      const out = roundTrip(outer) as Error;
      expect(out.message).toBe('outer');
      expect(out.cause).toBeInstanceOf(Error);
      expect((out.cause as Error).message).toBe('inner');
    });

    it('does not mutate the original Error with toJSON', () => {
      const e = new Error('boom');
      expect((e as Error & { toJSON?: unknown }).toJSON).toBeUndefined();
      encode(e);
      expect((e as Error & { toJSON?: unknown }).toJSON).toBeUndefined();
    });
  });

  describe('Map', () => {
    it('round-trips a Map', () => {
      const m = new Map<string, number>([
        ['a', 1],
        ['b', 2],
      ]);
      const out = roundTrip(m) as Map<string, number>;
      expect(out).toBeInstanceOf(Map);
      expect(out.get('a')).toBe(1);
      expect(out.get('b')).toBe(2);
    });

    it('round-trips a Map with Date values', () => {
      const m = new Map<string, Date>([['t', new Date('2026-01-01')]]);
      const out = roundTrip(m) as Map<string, Date>;
      expect(out.get('t')).toBeInstanceOf(Date);
    });

    it('round-trips a Map with object keys', () => {
      const key = { id: 1 };
      const m = new Map([[key, 'value']]);
      const out = roundTrip(m) as Map<{ id: number }, string>;
      expect(out.size).toBe(1);
      const [[k, v]] = Array.from(out.entries());
      expect(k).toEqual({ id: 1 });
      expect(v).toBe('value');
    });
  });

  describe('Set', () => {
    it('round-trips a Set', () => {
      const s = new Set([1, 2, 3]);
      const out = roundTrip(s) as Set<number>;
      expect(out).toBeInstanceOf(Set);
      expect(Array.from(out)).toEqual([1, 2, 3]);
    });

    it('round-trips a Set of Dates', () => {
      const s = new Set([new Date('2026-01-01')]);
      const out = roundTrip(s) as Set<Date>;
      const [first] = Array.from(out);
      expect(first).toBeInstanceOf(Date);
    });
  });

  describe('RegExp', () => {
    it('round-trips a RegExp', () => {
      const r = /foo/gi;
      const out = roundTrip(r) as RegExp;
      expect(out).toBeInstanceOf(RegExp);
      expect(out.source).toBe('foo');
      expect(out.flags).toBe('gi');
    });

    it('preserves metacharacter semantics across encode/decode', () => {
      // Regression for a previous decode-side autofix that escaped every
      // metacharacter in `source` before reconstruction, turning `/foo.*/gi`
      // into a regex matching the literal string `foo.*`.
      const cases: RegExp[] = [/foo.*/gi, /\d+-\d+/, /[a-z]{2,4}/i, /^(yes|no)$/, /a\.b\\c/];
      for (const r of cases) {
        const out = roundTrip(r) as RegExp;
        expect(out).toBeInstanceOf(RegExp);
        expect(out.source).toBe(r.source);
        expect(out.flags).toBe(r.flags);
        // Behavioural check: matching parity on a representative input.
        const sample = 'a.b\\c yes 12-34 foozzz';
        expect(sample.match(out)?.toString()).toBe(sample.match(r)?.toString());
      }
    });

    it('treats a RegExp envelope with hostile flags as user data', () => {
      // Crafted payload as if a peer tried to inject non-spec flags. The
      // decoder must not construct a RegExp from it.
      const hostile = { __m_codec__: 'RegExp', v: { source: 'foo', flags: 'gizz' } };
      const out = decode(hostile);
      expect(out).not.toBeInstanceOf(RegExp);
      expect(out).toEqual(hostile);
    });

    it('returns the raw envelope when source is unparseable', () => {
      // Spec-valid flags but the source itself is invalid. The decoder must
      // catch the constructor error and fall back to the user-data path.
      const broken = { __m_codec__: 'RegExp', v: { source: '[', flags: 'g' } };
      const out = decode(broken);
      expect(out).not.toBeInstanceOf(RegExp);
      expect(out).toEqual(broken);
    });

    it('treats an oversized source as user data instead of constructing a RegExp', () => {
      // Bound check: `isEnvelope` caps `source` length so a hostile peer
      // cannot push an unbounded pattern into `new RegExp(...)`.
      const oversized = {
        __m_codec__: 'RegExp',
        v: { source: 'a'.repeat(2000), flags: 'g' },
      };
      const out = decode(oversized);
      expect(out).not.toBeInstanceOf(RegExp);
      expect(out).toEqual(oversized);
    });
  });

  describe('URL', () => {
    it('round-trips a URL', () => {
      const u = new URL('https://example.com/a?b=c');
      const out = roundTrip(u) as URL;
      expect(out).toBeInstanceOf(URL);
      expect(out.toString()).toBe(u.toString());
    });
  });

  describe('BigInt', () => {
    it('round-trips a BigInt', () => {
      const out = roundTrip(123456789012345678901234567890n);
      expect(out).toBe(123456789012345678901234567890n);
    });
  });

  describe('undefined', () => {
    it('round-trips a top-level undefined', () => {
      expect(roundTrip(undefined)).toBeUndefined();
    });

    it('preserves undefined values in objects (unlike JSON.stringify)', () => {
      const out = roundTrip({ a: 1, b: undefined }) as { a: number; b: undefined };
      expect(out).toHaveProperty('b');
      expect(out.b).toBeUndefined();
    });
  });

  describe('functions and symbols', () => {
    it('drops function values from objects', () => {
      const out = roundTrip({ a: 1, f: () => 'x' }) as Record<string, unknown>;
      expect(out).toEqual({ a: 1 });
    });

    it('drops symbol values from objects', () => {
      const out = roundTrip({ a: 1, s: Symbol('x') }) as Record<string, unknown>;
      expect(out).toEqual({ a: 1 });
    });

    it('encodes a top-level function to undefined (JSON-unrepresentable, like JSON.stringify)', () => {
      expect(encode(() => 1)).toBeUndefined();
    });
  });

  describe('cycles', () => {
    it('replaces self-referencing objects with null at recurrence', () => {
      const o: Record<string, unknown> = { a: 1 };
      o.self = o;
      const out = roundTrip(o) as Record<string, unknown>;
      expect(out.a).toBe(1);
      expect(out.self).toBeNull();
    });

    it('replaces self-referencing arrays with null at recurrence', () => {
      const arr: unknown[] = [1, 2];
      arr.push(arr);
      const out = roundTrip(arr) as unknown[];
      expect(out[0]).toBe(1);
      expect(out[1]).toBe(2);
      expect(out[2]).toBeNull();
    });
  });

  describe('toJSON', () => {
    it('honors a toJSON method on plain objects', () => {
      const o = {
        a: 1,
        toJSON() {
          return { b: 2 };
        },
      };
      const out = roundTrip(o) as Record<string, unknown>;
      expect(out).toEqual({ b: 2 });
    });
  });

  describe('class registry', () => {
    afterEach(() => {
      unregisterClass('TestThing');
    });

    it('does not reconstruct unregistered classes', () => {
      class Foo {
        x = 1;
      }
      const out = roundTrip(new Foo()) as { x: number };
      expect(out).toEqual({ x: 1 });
      expect(out).not.toBeInstanceOf(Foo);
    });

    it('reconstructs a registered class', () => {
      class TestThing {
        constructor(public n: number) {}
      }
      registerClass<TestThing, { n: number }>('TestThing', {
        toData: t => ({ n: t.n }),
        fromData: d => new TestThing(d.n),
      });
      const out = roundTrip(new TestThing(7)) as TestThing;
      expect(out).toBeInstanceOf(TestThing);
      expect(out.n).toBe(7);
    });

    it('decodes Class envelope to plain data when registry entry is missing', () => {
      const envelope = { [CODEC_TAG]: 'Class', n: 'NeverRegistered', v: { foo: 1 } };
      const out = decode(JSON.parse(JSON.stringify(envelope))) as { foo: number };
      expect(out).toEqual({ foo: 1 });
    });
  });

  describe('built-in GeneratedFile registrations', () => {
    it('round-trips DefaultGeneratedFile', () => {
      const f = new DefaultGeneratedFile({ data: 'aGVsbG8=', mediaType: 'text/plain' });
      const out = roundTrip(f) as DefaultGeneratedFile;
      expect(out).toBeInstanceOf(DefaultGeneratedFile);
      expect(out.base64).toBe('aGVsbG8=');
      expect(out.mediaType).toBe('text/plain');
    });

    it('round-trips DefaultGeneratedFileWithType', () => {
      const f = new DefaultGeneratedFileWithType({ data: 'aGVsbG8=', mediaType: 'text/plain' });
      const out = roundTrip(f) as DefaultGeneratedFileWithType;
      expect(out).toBeInstanceOf(DefaultGeneratedFileWithType);
      expect(out.mediaType).toBe('text/plain');
      expect(out.type).toBe('file');
    });
  });

  describe('envelope collision safety', () => {
    it('preserves user objects with a non-matching __m_codec__ key', () => {
      // User happens to have data with the tag key, but wrong shape.
      const input = { [CODEC_TAG]: 'NotARealTag', extra: 1, otherStuff: 2 };
      const out = roundTrip(input);
      expect(out).toEqual(input);
    });

    it('preserves user objects with __m_codec__ as a number value', () => {
      const input = { [CODEC_TAG]: 42, extra: 'x' };
      const out = roundTrip(input);
      expect(out).toEqual(input);
    });
  });

  describe('representative payloads', () => {
    it('round-trips a failed StepResult with Date and Error fields', () => {
      const stepResult = {
        status: 'failed' as const,
        error: Object.assign(new Error('llm failed'), { code: 'E_LLM' }),
        startedAt: 1700000000000,
        endedAt: 1700000005000,
        metadata: { iter: 3 },
      };
      const out = roundTrip(stepResult) as typeof stepResult;
      expect(out.status).toBe('failed');
      expect(out.error).toBeInstanceOf(Error);
      expect(out.error.message).toBe('llm failed');
      expect((out.error as Error & { code: string }).code).toBe('E_LLM');
      expect(out.startedAt).toBe(1700000000000);
      expect(out.endedAt).toBe(1700000005000);
    });

    it('round-trips a workflow event with Date createdAt and nested chunk', () => {
      const event = {
        topic: 'workflow.events.v2.run-1',
        event: {
          id: 'evt-1',
          createdAt: new Date('2026-06-10T00:00:00.000Z'),
          type: 'watch',
          data: {
            chunk: {
              type: 'text',
              payload: 'hello',
              ts: new Date('2026-06-10T00:00:01.000Z'),
            },
          },
        },
      };
      const out = roundTrip(event) as typeof event;
      expect(out.event.createdAt).toBeInstanceOf(Date);
      expect(out.event.createdAt.toISOString()).toBe(event.event.createdAt.toISOString());
      expect(out.event.data.chunk.ts).toBeInstanceOf(Date);
    });
  });
});

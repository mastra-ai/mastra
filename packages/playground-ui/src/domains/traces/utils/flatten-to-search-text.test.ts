import { describe, expect, it } from 'vitest';

import { flattenToSearchText } from './flatten-to-search-text';

describe('flattenToSearchText', () => {
  describe('when given a primitive', () => {
    it('returns a string unchanged', () => {
      expect(flattenToSearchText('weather tool')).toBe('weather tool');
    });

    it('stringifies numbers, including zero and negatives', () => {
      expect(flattenToSearchText(0)).toBe('0');
      expect(flattenToSearchText(42)).toBe('42');
      expect(flattenToSearchText(-1.5)).toBe('-1.5');
    });

    it('stringifies booleans, including false', () => {
      expect(flattenToSearchText(true)).toBe('true');
      expect(flattenToSearchText(false)).toBe('false');
    });

    it('stringifies bigints', () => {
      expect(flattenToSearchText(9007199254740993n)).toBe('9007199254740993');
    });

    it('returns an empty string for null and undefined', () => {
      expect(flattenToSearchText(null)).toBe('');
      expect(flattenToSearchText(undefined)).toBe('');
    });

    it('drops NaN and infinities, which no one can usefully search for', () => {
      expect(flattenToSearchText(NaN)).toBe('');
      expect(flattenToSearchText(Infinity)).toBe('');
      expect(flattenToSearchText(-Infinity)).toBe('');
    });
  });

  describe('when given a flat object', () => {
    it('emits each key immediately before its value', () => {
      expect(flattenToSearchText({ city: 'Lyon', unit: 'celsius' })).toBe('city Lyon unit celsius');
    });

    it('makes a field name searchable on its own', () => {
      expect(flattenToSearchText({ model: 'gpt-5-mini' })).toContain('model');
    });

    it('keeps the key of a value it cannot search, so the field is still findable', () => {
      expect(flattenToSearchText({ error: null })).toBe('error');
      expect(flattenToSearchText({ a: 'one', b: null, c: undefined, d: 'two' })).toBe('a one b c d two');
    });

    it('returns an empty string for an object with no keys at all', () => {
      expect(flattenToSearchText({})).toBe('');
    });
  });

  describe('when given nested structures', () => {
    it('descends into nested objects, emitting the key at every level', () => {
      const input = { request: { location: { city: 'Lyon', country: 'FR' } } };

      expect(flattenToSearchText(input)).toBe('request location city Lyon country FR');
    });

    it('descends into arrays without emitting their indices', () => {
      expect(flattenToSearchText(['reasoning', 'text'])).toBe('reasoning text');
    });

    it('emits the array key once, then the items', () => {
      const input = { tags: ['weather', 'forecast'] };

      expect(flattenToSearchText(input)).toBe('tags weather forecast');
    });

    it('descends into arrays of objects', () => {
      const input = { messages: [{ role: 'user', content: 'hello' }, { role: 'assistant' }] };

      expect(flattenToSearchText(input)).toBe('messages role user content hello role assistant');
    });

    it('handles objects and arrays interleaved at depth', () => {
      const input = {
        steps: [{ tools: [{ name: 'weather' }, { name: 'clock' }] }, { tools: [] }],
        done: true,
      };

      expect(flattenToSearchText(input)).toBe('steps tools name weather name clock tools done true');
    });

    it('flattens deep nesting without truncating', () => {
      const input = { a: { b: { c: { d: { e: { f: 'bottom' } } } } } };

      expect(flattenToSearchText(input)).toBe('a b c d e f bottom');
    });
  });

  describe('when given values that are not worth searching', () => {
    it('emits the key but not the function body', () => {
      const result = flattenToSearchText({ fn: () => 'drop' });

      expect(result).toBe('fn');
      expect(result).not.toContain('drop');
    });

    it('emits the key but not the symbol', () => {
      const result = flattenToSearchText({ sym: Symbol('drop') });

      expect(result).toBe('sym');
      expect(result).not.toContain('drop');
    });

    it('does not walk into properties hung off a function', () => {
      // A function is dropped whole: without an explicit stop it would fall
      // through to the object walk and leak its own enumerable properties.
      const fn = () => 'drop';
      Object.assign(fn, { label: 'drop-too' });

      expect(flattenToSearchText({ fn })).toBe('fn');
    });

    it('skips symbol-keyed entries entirely', () => {
      expect(flattenToSearchText({ a: 'keep', [Symbol('k')]: 'drop' })).toBe('a keep');
    });

    it('does not walk the prototype chain', () => {
      const proto = { inherited: 'drop' };
      const input = Object.create(proto);
      input.own = 'keep';

      expect(flattenToSearchText(input)).toBe('own keep');
    });
  });

  describe('when given values with a meaningful string form', () => {
    it('renders a Date as its ISO string', () => {
      expect(flattenToSearchText(new Date('2026-06-10T12:30:00.000Z'))).toBe('2026-06-10T12:30:00.000Z');
    });

    it('renders a nested Date behind its key', () => {
      const input = { startedAt: new Date('2026-06-10T12:30:00.000Z') };

      expect(flattenToSearchText(input)).toBe('startedAt 2026-06-10T12:30:00.000Z');
    });

    it('keeps the key but drops an invalid Date rather than emitting "Invalid Date"', () => {
      const result = flattenToSearchText({ startedAt: new Date('nope') });

      expect(result).toBe('startedAt');
      expect(result).not.toContain('Invalid');
    });

    it('renders both sides of a Map entry', () => {
      const input = new Map([
        ['city', 'Lyon'],
        ['unit', 'celsius'],
      ]);

      expect(flattenToSearchText(input)).toBe('city Lyon unit celsius');
    });

    it('renders the members of a Set, which has no keys', () => {
      expect(flattenToSearchText(new Set(['reasoning', 'text']))).toBe('reasoning text');
    });

    it('renders an Error message', () => {
      expect(flattenToSearchText(new Error('rate limit exceeded'))).toBe('rate limit exceeded');
    });
  });

  describe('when the shape is hostile', () => {
    it('terminates on a self-referencing object', () => {
      const input: Record<string, unknown> = { name: 'root' };
      input.self = input;

      expect(flattenToSearchText(input)).toBe('name root self');
    });

    it('terminates on a two-object cycle', () => {
      const a: Record<string, unknown> = { name: 'a' };
      const b: Record<string, unknown> = { name: 'b', a };
      a.b = b;

      expect(flattenToSearchText(a)).toBe('name a b name b a');
    });

    it('terminates on a cycle through an array', () => {
      const list: unknown[] = ['item'];
      list.push(list);

      expect(flattenToSearchText(list)).toBe('item');
    });

    it('emits a repeated sibling reference once per occurrence, since it is not a cycle', () => {
      const shared = { value: 'shared' };

      expect(flattenToSearchText({ a: shared, b: shared })).toBe('a value shared b value shared');
    });

    it('keeps the key and the rest of the payload when a getter throws', () => {
      const input = {
        safe: 'keep',
        get boom(): string {
          throw new Error('exploded');
        },
      };

      const result = flattenToSearchText(input);

      expect(result).toContain('safe keep');
      expect(result).toContain('boom');
      expect(result).not.toContain('exploded');
    });

    it('survives a value whose toString throws', () => {
      const input = {
        safe: 'keep',
        bad: {
          toString() {
            throw new Error('exploded');
          },
        },
      };

      expect(() => flattenToSearchText(input)).not.toThrow();
      expect(flattenToSearchText(input)).toContain('keep');
    });
  });

  describe('the shape of the output', () => {
    it('never emits leading, trailing or repeated whitespace', () => {
      expect(flattenToSearchText({ b: 'one', c: {}, d: [], e: 'two' })).toBe('b one c d e two');
    });

    it('preserves whitespace inside a value', () => {
      expect(flattenToSearchText({ text: 'the quick  brown fox' })).toBe('text the quick  brown fox');
    });

    it('trims values that are only whitespace out of the result', () => {
      expect(flattenToSearchText({ a: '   ', b: 'kept' })).toBe('a b kept');
    });

    it('does not mutate its input', () => {
      const input = { a: 'one', nested: { b: 'two' }, list: [1, 2] };
      const snapshot = structuredClone(input);

      flattenToSearchText(input);

      expect(input).toEqual(snapshot);
    });

    it('is deterministic across repeated calls', () => {
      const input = { a: 'one', nested: { b: 'two', list: [3, 'four'] } };

      expect(flattenToSearchText(input)).toBe(flattenToSearchText(input));
    });
  });

  describe('when given a realistic span payload', () => {
    it('exposes every nested value and field name to a substring search', () => {
      const attributes = {
        model: 'gpt-5-mini',
        usage: { inputTokens: 1200, outputTokens: 300 },
        request: { location: { city: 'Lyon' }, tags: ['weather', 'forecast'] },
        error: null,
      };

      const result = flattenToSearchText(attributes);

      const needles = ['gpt-5-mini', '1200', '300', 'Lyon', 'weather', 'forecast', 'model', 'usage', 'error'];
      for (const needle of needles) {
        expect(result).toContain(needle);
      }
    });
  });
});

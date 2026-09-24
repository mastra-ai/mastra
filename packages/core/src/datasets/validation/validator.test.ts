import { describe, expect, it } from 'vitest';
import { SchemaValidationError } from './errors';
import { SafeRegExp, UnsupportedSchemaPatternError } from './safe-regex';
import { assertSupportedPatterns, createValidator } from './validator';

const catastrophic = 'a'.repeat(5000) + '!';

describe('SafeRegExp', () => {
  it('matches like RegExp for supported syntax', () => {
    const re = new SafeRegExp('^[a-z]+\\d{2}$', 'i');
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test('ABC12')).toBe(true);
    expect(re.test('abc1')).toBe(false);
    expect('xbcy'.match(new SafeRegExp('b(c)'))?.[1]).toBe('c');
    expect([...'a1b2'.matchAll(new SafeRegExp('\\d', 'g'))].map(m => m[0])).toEqual(['1', '2']);
  });

  it('runs nested-quantifier patterns in linear time', () => {
    for (const pattern of ['^(a+)+$', '^(a?a)*$', 'a*a*a*a*a*b', '\\s+$']) {
      const start = performance.now();
      new SafeRegExp(pattern).test(pattern === '\\s+$' ? ' '.repeat(5000) + 'x' : catastrophic);
      expect(performance.now() - start).toBeLessThan(100);
    }
  });

  it('rejects lookarounds and backreferences', () => {
    expect(() => new SafeRegExp('(?=a)b')).toThrow(UnsupportedSchemaPatternError);
    expect(() => new SafeRegExp('(a)\\1')).toThrow(UnsupportedSchemaPatternError);
  });
});

describe('SchemaValidator regex patterns', () => {
  it('validates `pattern` with RE2 and stays fast on malicious input', () => {
    const validator = createValidator();
    const schema = { type: 'object', properties: { name: { type: 'string', pattern: '^(a+)+$' } } } as const;

    expect(() => validator.validate({ name: 'aaa' }, schema, 'input', 'k1')).not.toThrow();

    const start = performance.now();
    expect(() => validator.validate({ name: catastrophic }, schema, 'input', 'k1')).toThrow(SchemaValidationError);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('validates `patternProperties` with RE2', () => {
    const validator = createValidator();
    const schema = { type: 'object', patternProperties: { '^(a+)+$': { type: 'number' } } } as const;

    expect(() => validator.validate({ aa: 1 }, schema, 'input', 'k2')).not.toThrow();
    expect(() => validator.validate({ aa: 'x' }, schema, 'input', 'k2')).toThrow(SchemaValidationError);

    const start = performance.now();
    validator.validate({ [catastrophic]: 1 }, schema, 'input', 'k2');
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('rejects unsupported syntax when the schema compiles', () => {
    const validator = createValidator();
    const schema = { type: 'object', properties: { a: { type: 'string', pattern: '^(?!x)' } } } as const;
    expect(() => validator.validate({ a: 'y' }, schema, 'input', 'k3')).toThrow(UnsupportedSchemaPatternError);
    expect(() => assertSupportedPatterns({ patternProperties: { '(a)\\1': {} } })).toThrow(
      UnsupportedSchemaPatternError,
    );
  });

  it('ignores `pattern` strings inside data keywords', () => {
    expect(() => assertSupportedPatterns({ const: { pattern: '(?=a)' }, default: { pattern: '(?=a)' } })).not.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { resolveDescription } from './description';

describe('resolveDescription', () => {
  it('returns the description unchanged when already trimmed', () => {
    expect(resolveDescription('a helpful agent')).toBe('a helpful agent');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveDescription('  padded description  ')).toBe('padded description');
  });

  it('trims newlines and tabs', () => {
    expect(resolveDescription('\n\tdescription\t\n')).toBe('description');
  });

  it('preserves interior whitespace', () => {
    expect(resolveDescription('  many   inner   spaces  ')).toBe('many   inner   spaces');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(resolveDescription('   ')).toBe('');
  });
});

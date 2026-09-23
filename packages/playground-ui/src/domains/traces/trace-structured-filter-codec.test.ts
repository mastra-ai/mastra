import { describe, expect, it } from 'vitest';

import {
  decodeExactStructuredPath,
  decodeStructuredScalar,
  encodeExactStructuredPath,
  encodeStructuredScalar,
  formatStructuredScalar,
  normalizeStructuredPath,
} from './trace-structured-filter-codec';

describe('trace structured filter codec', () => {
  describe('when a structured root is registered', () => {
    it('normalizes nested paths and preserves literal dotted segments', () => {
      expect(normalizeStructuredPath('custom.customer.id', 'custom')).toBe('custom.customer.id');
      expect(normalizeStructuredPath(['custom', 'customer.id'], 'custom')).toEqual(['custom', 'customer.id']);
      expect(normalizeStructuredPath(['custom', 'customer', 'id'], 'custom')).toBeUndefined();
      expect(normalizeStructuredPath('other.customer.id', 'custom')).toBeUndefined();
    });

    it('round-trips exact paths without losing segment boundaries', () => {
      const path: ['custom', string, ...string[]] = ['custom', 'customer.id', 'profile'];
      expect(decodeExactStructuredPath(encodeExactStructuredPath(path), 'custom')).toEqual(path);
    });
  });

  describe('when typed scalar values are encoded', () => {
    it('preserves scalar types and exact string formatting', () => {
      const prefix = '~custom-v1~';
      expect(decodeStructuredScalar(encodeStructuredScalar(false, prefix), prefix)).toBe(false);
      expect(decodeStructuredScalar(encodeStructuredScalar(0, prefix), prefix)).toBe(0);
      expect(decodeStructuredScalar(encodeStructuredScalar('', prefix), prefix)).toBe('');
      expect(decodeStructuredScalar('false', prefix)).toBe('false');
      expect(formatStructuredScalar('   ')).toBe('"   "');
    });
  });
});

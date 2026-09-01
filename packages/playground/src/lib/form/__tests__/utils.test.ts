import { describe, expect, it } from 'vitest';

import { removeEmptyValues } from '../utils';

describe('removeEmptyValues', () => {
  describe('when values include empty containers', () => {
    it('removes empty plain objects and arrays', () => {
      const plainObjectWithoutPrototype = Object.assign(Object.create(null), {
        value: 'kept',
      });

      const cleaned = removeEmptyValues({
        missing: null,
        unset: undefined,
        emptyArray: [],
        emptyObject: {},
        nested: {
          emptyValue: '',
        },
        items: [{ emptyValue: '' }, null, { value: 'kept' }],
        plainObjectWithoutPrototype,
        populated: {
          value: 'kept',
        },
      });

      expect(cleaned).not.toHaveProperty('missing');
      expect(cleaned).not.toHaveProperty('unset');
      expect(Object.getPrototypeOf(cleaned.plainObjectWithoutPrototype)).toBe(Object.prototype);
      expect(cleaned).toStrictEqual({
        items: [{ value: 'kept' }],
        plainObjectWithoutPrototype: {
          value: 'kept',
        },
        populated: {
          value: 'kept',
        },
      });
    });
  });

  describe('when values include non-plain objects', () => {
    it('preserves them instead of treating them as empty plain objects', () => {
      const startDate = new Date('2026-09-02T00:00:00.000Z');
      const metadata = new Map([['source', 'playground']]);

      expect(
        removeEmptyValues({
          startDate,
          metadata,
          nested: {
            uploadedAt: startDate,
          },
          entries: [{ value: startDate }, metadata],
        }),
      ).toEqual({
        startDate,
        metadata,
        nested: {
          uploadedAt: startDate,
        },
        entries: [{ value: startDate }, metadata],
      });
    });
  });
});

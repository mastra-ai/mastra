import { describe, expect, it } from 'vitest';

import { removeEmptyValues } from '../utils';

/**
 * Strips empty values out of dynamic-form submissions so the server is not sent
 * keys the user never filled in.
 */
describe('removeEmptyValues', () => {
  describe('when a value is empty', () => {
    it('drops a null', () => {
      expect(removeEmptyValues({ a: null, b: 1 })).toEqual({ b: 1 });
    });

    it('drops an undefined', () => {
      expect(removeEmptyValues({ a: undefined, b: 1 })).toEqual({ b: 1 });
    });

    it('drops an empty string', () => {
      expect(removeEmptyValues({ a: '', b: 1 })).toEqual({ b: 1 });
    });

    it('drops an empty array', () => {
      expect(removeEmptyValues({ a: [], b: 1 })).toEqual({ b: 1 });
    });

    it('drops an empty object', () => {
      expect(removeEmptyValues({ a: {}, b: 1 })).toEqual({ b: 1 });
    });
  });

  describe('when a value is falsy but meaningful', () => {
    it('keeps a zero', () => {
      expect(removeEmptyValues({ a: 0 })).toEqual({ a: 0 });
    });

    it('keeps false', () => {
      expect(removeEmptyValues({ a: false })).toEqual({ a: false });
    });

    it('keeps a whitespace-only string', () => {
      expect(removeEmptyValues({ a: ' ' })).toEqual({ a: ' ' });
    });
  });

  describe('when a value is a nested object', () => {
    it('keeps the fields that survive cleaning', () => {
      expect(removeEmptyValues({ a: { keep: 1, drop: '' } })).toEqual({ a: { keep: 1 } });
    });

    it('drops an object left empty by cleaning', () => {
      expect(removeEmptyValues({ a: { drop: '' }, b: 1 })).toEqual({ b: 1 });
    });

    it('cleans several levels down', () => {
      expect(removeEmptyValues({ a: { b: { c: 1, d: null } } })).toEqual({ a: { b: { c: 1 } } });
    });
  });

  describe('when a value is an array', () => {
    it('keeps primitive entries as they are', () => {
      expect(removeEmptyValues({ a: [1, 'two', false] })).toEqual({ a: [1, 'two', false] });
    });

    it('cleans object entries', () => {
      expect(removeEmptyValues({ a: [{ keep: 1, drop: '' }] })).toEqual({ a: [{ keep: 1 }] });
    });

    it('drops entries left empty by cleaning', () => {
      expect(removeEmptyValues({ a: [{ drop: '' }, { keep: 1 }] })).toEqual({ a: [{ keep: 1 }] });
    });

    it('drops the whole key when every entry is cleaned away', () => {
      expect(removeEmptyValues({ a: [{ drop: '' }], b: 1 })).toEqual({ b: 1 });
    });

    it('keeps a nested array entry that is not an object', () => {
      expect(removeEmptyValues({ a: ['keep', ''] })).toEqual({ a: ['keep', ''] });
    });
  });

  describe('when nothing survives', () => {
    it('returns an empty object', () => {
      expect(removeEmptyValues({ a: '', b: null, c: undefined })).toEqual({});
    });

    it('handles an already-empty input', () => {
      expect(removeEmptyValues({})).toEqual({});
    });
  });

  describe('the input it was given', () => {
    it('is left untouched', () => {
      const input = { a: '', b: { c: 1 } };

      removeEmptyValues(input);

      expect(input).toEqual({ a: '', b: { c: 1 } });
    });
  });
});

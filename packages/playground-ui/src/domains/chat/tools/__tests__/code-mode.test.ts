import { describe, expect, it } from 'vitest';
import { getCodeModeCall } from '../code-mode';

describe('getCodeModeCall', () => {
  describe('when args are an object with a string code field', () => {
    it('returns the code alone when the program has not run yet', () => {
      expect(getCodeModeCall({ code: 'return 1;' }, undefined)).toEqual({ code: 'return 1;' });
      expect(getCodeModeCall({ code: 'return 1;' }, null)).toEqual({ code: 'return 1;' });
    });

    it('returns the code and a successful result carrying result and logs', () => {
      const result = { success: true, result: 2, logs: ['done'] };

      expect(getCodeModeCall({ code: 'return 1 + 1;' }, result)).toEqual({ code: 'return 1 + 1;', result });
    });

    it('returns the code and a failed result carrying an error', () => {
      const result = { success: false, error: { message: 'boom', name: 'Error', line: 3 } };

      expect(getCodeModeCall({ code: 'throw new Error("boom");' }, result)).toEqual({
        code: 'throw new Error("boom");',
        result,
      });
    });

    it('accepts a result that only has the logs key', () => {
      const result = { success: true, logs: [] };

      expect(getCodeModeCall({ code: 'console.log(1);' }, result)).toEqual({ code: 'console.log(1);', result });
    });

    it('accepts a result that only has the result key', () => {
      const result = { success: true, result: null };

      expect(getCodeModeCall({ code: 'return null;' }, result)).toEqual({ code: 'return null;', result });
    });
  });

  describe('when args are a JSON string', () => {
    it('parses the code and keeps the result', () => {
      const result = { success: false, error: { message: 'x' } };

      expect(getCodeModeCall(JSON.stringify({ code: 'return 3;' }), result)).toEqual({ code: 'return 3;', result });
    });

    it('returns null when the JSON is invalid', () => {
      expect(getCodeModeCall('not json', undefined)).toBeNull();
    });

    it('returns null when the JSON parses to null', () => {
      expect(getCodeModeCall('null', undefined)).toBeNull();
    });
  });

  describe('when args have no string code field', () => {
    it('returns null when code is absent', () => {
      expect(getCodeModeCall({ command: 'ls' }, { success: true, result: 'x' })).toBeNull();
    });

    it('returns null when code is not a string', () => {
      expect(getCodeModeCall({ code: 42 }, undefined)).toBeNull();
      expect(getCodeModeCall({ code: null }, undefined)).toBeNull();
    });
  });

  describe('when the result does not match the Code Mode shape', () => {
    it('returns null for an unrelated object result', () => {
      expect(getCodeModeCall({ code: 'x' }, { rows: [1, 2, 3] })).toBeNull();
    });

    it('returns null for a primitive result', () => {
      expect(getCodeModeCall({ code: 'x' }, 'plain string result')).toBeNull();
      expect(getCodeModeCall({ code: 'x' }, 42)).toBeNull();
      expect(getCodeModeCall({ code: 'x' }, true)).toBeNull();
    });

    it('returns null when success is not a boolean', () => {
      expect(getCodeModeCall({ code: 'x' }, { success: 'yes', result: 1 })).toBeNull();
    });

    it('returns null when success is a boolean without result, logs or error', () => {
      expect(getCodeModeCall({ code: 'x' }, { success: true })).toBeNull();
      expect(getCodeModeCall({ code: 'x' }, { success: false, message: 'x' })).toBeNull();
    });
  });
});

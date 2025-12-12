import { describe, it, expect } from 'vitest';
import { getErrorFromUnknown } from './utils';

describe('getErrorFromUnknown', () => {
  describe('basic error conversion', () => {
    it('should return the same Error instance when passed an Error', () => {
      const error = new Error('test error');
      const result = getErrorFromUnknown(error);
      expect(result).toBe(error);
    });

    it('should create an Error from a string', () => {
      const result = getErrorFromUnknown('test error');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('test error');
    });

    it('should create an Error with fallback message for unknown types', () => {
      const result = getErrorFromUnknown(null, { fallbackMessage: 'Unknown error occurred' });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Unknown error occurred');
    });

    it('should preserve custom properties on Error instances', () => {
      const error = new Error('test error');
      (error as any).statusCode = 500;
      (error as any).responseHeaders = { 'retry-after': '60' };

      const result = getErrorFromUnknown(error);
      expect(result).toBe(error);
      expect((result as any).statusCode).toBe(500);
      expect((result as any).responseHeaders).toEqual({ 'retry-after': '60' });
    });
  });

  describe('serializeStack option', () => {
    it('should always preserve stack on instance regardless of serializeStack option', () => {
      const error = new Error('test error');
      const originalStack = error.stack;

      const result = getErrorFromUnknown(error, { serializeStack: false });

      // Stack should still be on the instance
      expect(result.stack).toBe(originalStack);
    });

    it('should include stack in JSON when serializeStack is true', () => {
      const error = new Error('test error');
      const result = getErrorFromUnknown(error, { serializeStack: true });

      const json = JSON.parse(JSON.stringify(result));
      expect(json.stack).toBeDefined();
    });

    it('should exclude stack from JSON when serializeStack is false', () => {
      const error = new Error('test error');
      const result = getErrorFromUnknown(error, { serializeStack: false });

      const json = JSON.parse(JSON.stringify(result));
      expect(json.stack).toBeUndefined();
    });
  });

  describe('cause chain serialization', () => {
    it('should add toJSON to cause chain', () => {
      const rootCause = new Error('root cause');
      const middleCause = new Error('middle cause', { cause: rootCause });
      const topError = new Error('top error', { cause: middleCause });

      const result = getErrorFromUnknown(topError);

      // Serialize and check the entire chain
      const json = JSON.parse(JSON.stringify(result));
      expect(json.message).toBe('top error');
      expect(json.cause).toBeDefined();
      expect(json.cause.message).toBe('middle cause');
      expect(json.cause.cause).toBeDefined();
      expect(json.cause.cause.message).toBe('root cause');
    });

    it('should respect serializeStack for entire cause chain', () => {
      const rootCause = new Error('root cause');
      const topError = new Error('top error', { cause: rootCause });

      const result = getErrorFromUnknown(topError, { serializeStack: false });

      const json = JSON.parse(JSON.stringify(result));
      expect(json.stack).toBeUndefined();
      expect(json.cause.stack).toBeUndefined();
    });

    it('should preserve custom properties on cause errors', () => {
      const rootCause = new Error('root cause');
      (rootCause as any).code = 'ECONNREFUSED';

      const topError = new Error('top error', { cause: rootCause });
      (topError as any).statusCode = 500;

      const result = getErrorFromUnknown(topError);

      const json = JSON.parse(JSON.stringify(result));
      expect(json.statusCode).toBe(500);
      expect(json.cause.code).toBe('ECONNREFUSED');
    });
  });

  describe('maxDepth protection', () => {
    it('should limit cause chain processing to maxDepth', () => {
      // Create a chain of 10 errors
      let error: Error = new Error('error-0');
      for (let i = 1; i < 10; i++) {
        error = new Error(`error-${i}`, { cause: error });
      }

      // Process with maxDepth of 3
      const result = getErrorFromUnknown(error, { maxDepth: 3 });

      // The top-level error should have toJSON
      expect((result as any).toJSON).toBeDefined();

      // Traverse the chain and count how many have toJSON
      let current: Error | undefined = result;
      let toJSONCount = 0;
      while (current) {
        if ((current as any).toJSON) {
          toJSONCount++;
        }
        current = current.cause as Error | undefined;
      }

      // With maxDepth=3, toJSON is added at depths 0, 1, 2, and 3 (4 errors total)
      // The recursion condition `currentDepth < maxDepth` stops at depth 3,
      // but toJSON is still added to the error at depth 3 before returning
      expect(toJSONCount).toBe(4);
    });

    it('should handle deeply nested causes without stack overflow', () => {
      // Create a very deep chain (100 errors)
      let error: Error = new Error('error-0');
      for (let i = 1; i < 100; i++) {
        error = new Error(`error-${i}`, { cause: error });
      }

      // Should not throw due to depth protection
      expect(() => getErrorFromUnknown(error)).not.toThrow();
    });

    it('should use default maxDepth when not specified', () => {
      // Create a chain that exceeds default depth (5)
      let error: Error = new Error('error-0');
      for (let i = 1; i < 20; i++) {
        error = new Error(`error-${i}`, { cause: error });
      }

      // Should process without error
      const result = getErrorFromUnknown(error);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('error-19');
    });
  });

  describe('object to Error conversion', () => {
    it('should convert plain objects with message property to Error', () => {
      const obj = { message: 'error from object', code: 'ERR_TEST' };
      const result = getErrorFromUnknown(obj);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('error from object');
      expect((result as any).code).toBe('ERR_TEST');
    });

    it('should preserve cause from plain objects', () => {
      const cause = new Error('original cause');
      const obj = { message: 'wrapper error', cause };

      const result = getErrorFromUnknown(obj);

      expect(result).toBeInstanceOf(Error);
      expect(result.cause).toBe(cause);
    });
  });

  describe('toJSON serialization', () => {
    it('should include message and name in JSON', () => {
      const error = new Error('test error');
      const result = getErrorFromUnknown(error);

      const json = JSON.parse(JSON.stringify(result));
      expect(json.message).toBe('test error');
      expect(json.name).toBe('Error');
    });

    it('should not overwrite existing toJSON method', () => {
      const error = new Error('test error');
      const customToJSON = () => ({ custom: true });
      (error as any).toJSON = customToJSON;

      const result = getErrorFromUnknown(error);

      expect((result as any).toJSON).toBe(customToJSON);
      const json = JSON.parse(JSON.stringify(result));
      expect(json.custom).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle mixed cause types (string cause)', () => {
      const error = new Error('top error', { cause: 'string cause' });
      const result = getErrorFromUnknown(error);

      const json = JSON.parse(JSON.stringify(result));
      expect(json.message).toBe('top error');
      expect(json.cause).toBe('string cause');
    });

    it('should handle mixed cause types (plain object cause)', () => {
      const error = new Error('top error', { cause: { code: 'ERR_PLAIN', details: 'some details' } });
      const result = getErrorFromUnknown(error);

      const json = JSON.parse(JSON.stringify(result));
      expect(json.message).toBe('top error');
      expect(json.cause).toEqual({ code: 'ERR_PLAIN', details: 'some details' });
    });

    it('should handle number as unknown input', () => {
      const result = getErrorFromUnknown(42, { fallbackMessage: 'Unexpected error' });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Unexpected error');
    });

    it('should handle array as unknown input', () => {
      const result = getErrorFromUnknown(['error1', 'error2'], { fallbackMessage: 'Unexpected error' });
      expect(result).toBeInstanceOf(Error);
      // Arrays get JSON stringified as the message
      expect(result.message).toBe('["error1","error2"]');
    });

    it('should handle symbol as unknown input', () => {
      const result = getErrorFromUnknown(Symbol('error'), { fallbackMessage: 'Unexpected error' });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Unexpected error');
    });

    it('should handle undefined as unknown input', () => {
      const result = getErrorFromUnknown(undefined, { fallbackMessage: 'Unexpected error' });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Unexpected error');
    });

    it('should handle circular references in cause chains gracefully via maxDepth', () => {
      const error1 = new Error('error 1');
      const error2 = new Error('error 2', { cause: error1 });
      // Create a circular reference
      (error1 as any).cause = error2;

      // Should not throw due to maxDepth protection
      expect(() => getErrorFromUnknown(error2, { maxDepth: 3 })).not.toThrow();

      const result = getErrorFromUnknown(error2, { maxDepth: 3 });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('error 2');
    });
  });
});

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

      // Should have toJSON on top 3 errors (depth 0, 1, 2) but not deeper
      // Note: maxDepth limits the recursive processing
      expect(toJSONCount).toBeLessThanOrEqual(4); // maxDepth + 1 for the initial call
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
});

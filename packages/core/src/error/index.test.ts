import { describe, expect, it } from 'vitest';
import { MastraError, ErrorDomain, ErrorCategory } from './index';
import type { IErrorDefinition } from './index';

// Define a default context type for tests where specific fields aren't needed by the error definition itself.
interface TestContext {
  [key: string]: any;
}

describe('MastraError (Base Class)', () => {
  const sampleContext: TestContext = {
    fileName: 'test.ts',
    lineNumber: 42,
  };
  const sampleErrorDefinition: IErrorDefinition<`${ErrorDomain}`, `${ErrorCategory}`> = {
    id: 'BASE_TEST_001',
    domain: 'AGENT',
    category: 'UNKNOWN',
    details: sampleContext,
  };

  it('should create a base error with definition and context', () => {
    const error = new MastraError(sampleErrorDefinition);
    expect(error).toBeInstanceOf(MastraError);
    expect(error).toBeInstanceOf(Error);
    expect(error.id).toBe('BASE_TEST_001');
    // Since there's no text field in the definition, message will be empty
    expect(error.message).toBe('Unknown error');
    expect(error.domain).toBe('AGENT');
    expect(error.category).toBe('UNKNOWN');
  });

  it('should use error message from provided cause', () => {
    const cause = new Error('Test error message');
    const error = new MastraError(sampleErrorDefinition, cause);
    expect(error.message).toBe('Test error message');
  });

  it('should create a base error with a cause', () => {
    const cause = new Error('Original cause');
    const error = new MastraError(sampleErrorDefinition, cause);
    expect(error.cause).toBe(cause);
  });

  describe('toJSON methods for Base MastraError', () => {
    it('should correctly serialize to JSON with toJSON() and toJSONDetails()', () => {
      const cause = new Error('Original cause');
      const error = new MastraError(sampleErrorDefinition, cause);

      // Since we have a cause, the message should be from the cause
      expect(error.message).toBe('Original cause');

      const jsonDetails = error.toJSONDetails();
      expect(jsonDetails.message).toBe('Original cause');
      expect(jsonDetails.domain).toBe(ErrorDomain.AGENT);
      expect(jsonDetails.category).toBe(ErrorCategory.UNKNOWN);
      expect(jsonDetails.details).toEqual(sampleContext);

      const jsonError = error.toJSON();
      expect(jsonError.code).toBe('BASE_TEST_001');
      expect(jsonError.message).toBe('Original cause');
      expect(jsonError.details).toEqual(jsonDetails);
    });

    it('should serialize to JSON without a cause', () => {
      const error = new MastraError(sampleErrorDefinition);

      const jsonDetails = error.toJSONDetails();
      expect(jsonDetails.message).toBe('Unknown error');
      expect(jsonDetails.domain).toBe(ErrorDomain.AGENT);
      expect(jsonDetails.category).toBe(ErrorCategory.UNKNOWN);
      expect(jsonDetails.details).toEqual(sampleContext);

      const jsonError = error.toJSON();
      expect(jsonError.code).toBe('BASE_TEST_001');
      expect(jsonError.message).toBe('Unknown error');
      expect(jsonError.details).toEqual(jsonDetails);
    });
  });
});

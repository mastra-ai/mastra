import { describe, expect, it } from 'vitest';
import { MastraError, Domain, ErrorCategory } from './index';
import type { IErrorDefinition, IErrorContext } from './index';

// Define a default context type for tests where specific fields aren't needed by the error definition itself.
interface TestContext extends IErrorContext {
  [key: string]: any;
}

describe('MastraError (Base Class)', () => {
  const sampleContext: TestContext = {
    fileName: 'test.ts',
    lineNumber: 42,
  };
  const sampleErrorDefinition: IErrorDefinition = {
    id: 'BASE_TEST_001',
    text: 'This is a base test error',
    domain: Domain.AGENT,
    category: ErrorCategory.UNKNOWN,
    details: sampleContext,
  };

  it('should create a base error with definition and context', () => {
    const error = new MastraError(sampleErrorDefinition);
    expect(error).toBeInstanceOf(MastraError);
    expect(error).toBeInstanceOf(Error);
    expect(error.id).toBe('BASE_TEST_001');
    expect(error.message).toBe('This is a base test error');
    expect(error.domain).toBe(Domain.AGENT);
    expect(error.category).toBe(ErrorCategory.UNKNOWN);
    expect(error.originalError).toBeUndefined();
  });

  it('should use context in text function for base error', () => {
    const definitionWithTextFn: IErrorDefinition = {
      ...sampleErrorDefinition,
      id: 'BASE_TEXTFN_001',
      text: `Error in ${sampleContext.fileName} at line ${sampleContext.lineNumber}`,
    };
    const error = new MastraError(definitionWithTextFn);
    expect(error.message).toBe('Error in test.ts at line 42');
  });

  it('should create a base error with an originalError (cause)', () => {
    const cause = new Error('Original cause');
    const error = new MastraError(sampleErrorDefinition, cause);
    expect(error.originalError).toBe(cause);
    if (error.cause) {
      expect(error.cause).toBe(cause);
    }
  });

  describe('toJSON methods for Base MastraError', () => {
    it('should correctly serialize to JSON with toJSON() and toJSONDetails()', () => {
      const cause = new Error('Original cause');
      cause.stack = 'original stack trace';
      const error = new MastraError(sampleErrorDefinition, cause);
      error.stack = 'mastra error stack trace';

      const jsonDetails = error.toJSONDetails();
      expect(jsonDetails.message).toBe('This is a base test error');
      expect(jsonDetails.domain).toBe(Domain.AGENT);
      expect(jsonDetails.category).toBe(ErrorCategory.UNKNOWN);
      expect(jsonDetails.details).toEqual(sampleContext);
      expect(jsonDetails.stack).toBe('mastra error stack trace');
      expect(jsonDetails.originalError).toBeDefined();
      expect(jsonDetails.originalError?.name).toBe('Error');
      expect(jsonDetails.originalError?.message).toBe('Original cause');
      expect(jsonDetails.originalError?.stack).toBe('original stack trace');

      const jsonError = error.toJSON();
      expect(jsonError.code).toBe('BASE_TEST_001');
      expect(jsonError.message).toBe('This is a base test error');
      expect(jsonError.details).toEqual(jsonDetails);
    });

    it('should serialize to JSON without an original error', () => {
      const error = new MastraError(sampleErrorDefinition);
      error.stack = 'mastra error stack trace';

      const jsonDetails = error.toJSONDetails();
      expect(jsonDetails.message).toBe('This is a base test error');
      expect(jsonDetails.domain).toBe(Domain.AGENT);
      expect(jsonDetails.category).toBe(ErrorCategory.UNKNOWN);
      expect(jsonDetails.stack).toBe('mastra error stack trace');
      expect(jsonDetails.originalError).toBeUndefined();

      const jsonError = error.toJSON();
      expect(jsonError.code).toBe('BASE_TEST_001');
      expect(jsonError.message).toBe('This is a base test error');
      expect(jsonError.details).toEqual(jsonDetails);
    });
  });
});

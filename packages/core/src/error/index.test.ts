import { describe, expect, it } from 'vitest';
import { MastraError, Domain, ErrorCategory, MASTRA_ERRORS } from './index';
import type { IErrorDefinition, IErrorContext } from './index';

// Define a default context type for tests where specific fields aren't needed by the error definition itself.
interface TestContext extends IErrorContext {
  [key: string]: any;
}

describe('MastraError (Base Class)', () => {
  const sampleErrorDefinition: IErrorDefinition = {
    id: 'BASE_TEST_001',
    text: 'This is a base test error',
    domain: Domain.AGENT,
    category: ErrorCategory.UNKNOWN,
  };

  const sampleContext: TestContext = {
    fileName: 'test.ts',
    lineNumber: 42,
  };

  const emptyContext: TestContext = {};

  it('should create a base error with definition and context', () => {
    const error = new MastraError(sampleErrorDefinition, emptyContext);
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
      text: (ctx: IErrorContext) =>
        `Error in ${(ctx as TestContext).fileName} at line ${(ctx as TestContext).lineNumber}`,
    };
    const error = new MastraError(definitionWithTextFn, sampleContext);
    expect(error.message).toBe('Error in test.ts at line 42');
  });

  it('should use context in domain function for base error', () => {
    const definitionWithDomainFn: IErrorDefinition = {
      ...sampleErrorDefinition,
      id: 'BASE_DOMAINFN_001',
      text: 'Static text for domain function test',
      domain: (ctx: IErrorContext) => ((ctx as TestContext).isCritical ? Domain.MCP : Domain.AGENT),
    };
    const criticalContext: TestContext = { ...sampleContext, isCritical: true };
    const nonCriticalContext: TestContext = { ...sampleContext, isCritical: false };

    const error1 = new MastraError(definitionWithDomainFn, criticalContext);
    expect(error1.domain).toBe(Domain.MCP);

    const error2 = new MastraError(definitionWithDomainFn, nonCriticalContext);
    expect(error2.domain).toBe(Domain.AGENT);
  });

  it('should create a base error with an originalError (cause)', () => {
    const cause = new Error('Original cause');
    const error = new MastraError(sampleErrorDefinition, sampleContext, cause);
    expect(error.originalError).toBe(cause);
    if (error.cause) {
      expect(error.cause).toBe(cause);
    }
  });

  describe('toJSON methods for Base MastraError', () => {
    it('should correctly serialize to JSON with toJSON() and toJSONDetails()', () => {
      const cause = new Error('Original cause');
      cause.stack = 'original stack trace';
      const error = new MastraError(sampleErrorDefinition, sampleContext, cause);
      error.stack = 'mastra error stack trace';

      const jsonDetails = error.toJSONDetails();
      expect(jsonDetails.message).toBe('This is a base test error');
      expect(jsonDetails.domain).toBe(Domain.AGENT);
      expect(jsonDetails.category).toBe(ErrorCategory.UNKNOWN);
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
      const error = new MastraError(sampleErrorDefinition, emptyContext);
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

describe('MASTRA_ERRORS (Generated Error Classes)', () => {
  it('TOOL_EXECUTE_ERROR should create an error with strongly-typed context', () => {
    const toolErrorContext = { toolName: 'user123' };
    const error = new MASTRA_ERRORS.TOOL_EXECUTE_ERROR(toolErrorContext);

    expect(error).toBeInstanceOf(MastraError);
    expect(error).toBeInstanceOf(Error);
    expect(error.id).toBe('TOOL_EXECUTE_ERROR');
    expect(error.message).toBe('Tool user123 failed to execute');
    expect(error.domain).toBe(Domain.TOOL);
    expect(error.category).toBe(ErrorCategory.USER);
  });

  it('TOOL_EXECUTE_ERROR should accept a cause', () => {
    const toolErrorContext = { toolName: 'user456' };
    const cause = new Error('Underlying network issue');
    const error = new MASTRA_ERRORS.TOOL_EXECUTE_ERROR(toolErrorContext, cause);

    expect(error.id).toBe('TOOL_EXECUTE_ERROR');
    expect(error.message).toBe('Tool user456 failed to execute');
    expect(error.originalError).toBe(cause);
    if (error.cause) {
      expect(error.cause).toBe(cause);
    }
  });

  describe('toJSON methods for Generated MASTRA_ERRORS.TOOL_EXECUTE_ERROR', () => {
    it('should correctly serialize to JSON', () => {
      const toolErrorContext = { toolName: 'jsonUser' };
      const cause = new Error('Original JSON cause');
      cause.stack = 'original json stack trace';
      const error = new MASTRA_ERRORS.TOOL_EXECUTE_ERROR(toolErrorContext, cause);
      error.stack = 'tool_execute_error stack trace';

      const jsonDetails = error.toJSONDetails();
      expect(jsonDetails.message).toBe('Tool jsonUser failed to execute');
      expect(jsonDetails.domain).toBe(Domain.TOOL);
      expect(jsonDetails.category).toBe(ErrorCategory.USER);
      expect(jsonDetails.stack).toBe('tool_execute_error stack trace');
      expect(jsonDetails.originalError).toBeDefined();
      expect(jsonDetails.originalError?.name).toBe('Error');
      expect(jsonDetails.originalError?.message).toBe('Original JSON cause');
      expect(jsonDetails.originalError?.stack).toBe('original json stack trace');

      const jsonError = error.toJSON();
      expect(jsonError.code).toBe('TOOL_EXECUTE_ERROR');
      expect(jsonError.message).toBe('Tool jsonUser failed to execute');
      expect(jsonError.details).toEqual(jsonDetails);
    });
  });
});

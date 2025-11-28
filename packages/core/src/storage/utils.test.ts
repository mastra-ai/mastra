import { describe, expect, it } from 'vitest';
import { TABLE_SCORERS } from './constants';
import { safelyParseJSON, transformRow, transformScoreRow } from './utils';

describe('safelyParseJSON', () => {
  const sampleObject = {
    foo: 'bar',
    nested: { value: 42 },
  };

  it('should return input object unchanged when provided a non-null object', () => {
    // Arrange: Prepare test object with nested structure
    const inputObject = sampleObject;

    // Act: Pass object through safelyParseJSON
    const result = safelyParseJSON(inputObject);

    // Assert: Verify object reference and structure preservation
    expect(result).toBe(inputObject); // Same reference
    expect(result).toEqual({
      foo: 'bar',
      nested: { value: 42 },
    });
    expect(result.nested).toBe(inputObject.nested); // Nested reference preserved
  });

  it('should return empty object when provided null or undefined', () => {
    // Act & Assert: Test null input
    const nullResult = safelyParseJSON(null);
    expect(nullResult).toEqual({});
    expect(Object.keys(nullResult)).toHaveLength(0);

    // Act & Assert: Test undefined input
    const undefinedResult = safelyParseJSON(undefined);
    expect(undefinedResult).toEqual({});
    expect(Object.keys(undefinedResult)).toHaveLength(0);

    // Assert: Verify different object instances
    expect(nullResult).not.toBe(undefinedResult);
  });

  it('should return empty object when provided non-string primitives', () => {
    // Act & Assert: Test number input
    const numberResult = safelyParseJSON(42);
    expect(numberResult).toEqual({});
    expect(Object.keys(numberResult)).toHaveLength(0);

    // Act & Assert: Test boolean input
    const booleanResult = safelyParseJSON(true);
    expect(booleanResult).toEqual({});
    expect(Object.keys(booleanResult)).toHaveLength(0);

    // Assert: Verify different object instances
    expect(numberResult).not.toBe(booleanResult);
  });
  it('should return raw string when provided a non-JSON string', () => {
    const raw = 'hello world'; // not valid JSON
    expect(safelyParseJSON(raw)).toBe(raw);
  });

  it('should still parse valid JSON strings', () => {
    const json = '{"a":1,"b":"two"}';
    expect(safelyParseJSON(json)).toEqual({ a: 1, b: 'two' });
  });
  it('parses JSON numbers/booleans/arrays', () => {
    expect(safelyParseJSON('123')).toBe(123);
    expect(safelyParseJSON('true')).toBe(true);
    expect(safelyParseJSON('[1,2]')).toEqual([1, 2]);
  });

  it('trims whitespace around JSON strings', () => {
    expect(safelyParseJSON(' { "x": 1 } ')).toEqual({ x: 1 });
  });
});

describe('transformRow', () => {
  it('should parse jsonb fields from JSON strings', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{"name":"test-scorer","version":"1.0"}',
      input: '{"prompt":"hello"}',
      output: '{"response":"world"}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result.id).toBe('test-id');
    expect(result.scorer).toEqual({ name: 'test-scorer', version: '1.0' });
    expect(result.input).toEqual({ prompt: 'hello' });
    expect(result.output).toEqual({ response: 'world' });
    expect(result.score).toBe(0.85);
  });

  it('should pass through already-parsed objects', () => {
    const scorerObject = { name: 'test-scorer', version: '1.0' };
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: scorerObject,
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result.scorer).toBe(scorerObject); // Same reference
  });

  it('should skip null and undefined values', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      metadata: null,
      reason: undefined,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('reason');
  });

  it('should convert timestamps when convertTimestamps is true', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, { convertTimestamps: true });

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect((result.createdAt as Date).toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should not convert timestamps by default', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result.createdAt).toBe('2024-01-15T10:30:00Z');
    expect(result.updatedAt).toBe('2024-01-15T11:00:00Z');
  });

  it('should use timestamp fallback fields when provided', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      createdAtZ: '2024-01-15T10:30:00.000Z', // More precise version
      updatedAt: '2024-01-15T11:00:00Z',
      updatedAtZ: '2024-01-15T11:00:00.000Z',
    };

    const result = transformRow(row, TABLE_SCORERS, {
      timestampFallbackFields: {
        createdAt: 'createdAtZ',
        updatedAt: 'updatedAtZ',
      },
    });

    expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
    expect(result.updatedAt).toBe('2024-01-15T11:00:00.000Z');
  });

  it('should fall back to original field when fallback field is missing', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      // createdAtZ is missing
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, {
      timestampFallbackFields: {
        createdAt: 'createdAtZ',
      },
    });

    expect(result.createdAt).toBe('2024-01-15T10:30:00Z');
  });

  it('should skip values matching nullValuePattern', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      reason: '_null_',
      metadata: '_null_',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, { nullValuePattern: '_null_' });

    expect(result).not.toHaveProperty('reason');
    expect(result).not.toHaveProperty('metadata');
  });

  it('should apply field mappings', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      entityData: '{"type":"agent","name":"test-agent"}', // DynamoDB stores entity as entityData
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, {
      fieldMappings: { entity: 'entityData' },
    });

    expect(result.entity).toEqual({ type: 'agent', name: 'test-agent' });
    expect(result).not.toHaveProperty('entityData');
  });
});

describe('transformScoreRow', () => {
  it('should be a convenience wrapper for transformRow with TABLE_SCORERS', () => {
    const row = {
      id: 'score-123',
      scorerId: 'accuracy-scorer',
      runId: 'run-456',
      scorer: '{"id":"accuracy","name":"Accuracy Scorer"}',
      input: '{"question":"What is 2+2?"}',
      output: '{"answer":"4"}',
      score: 1.0,
      reason: 'Correct answer',
      source: 'TEST',
      entityType: 'AGENT',
      entity: '{"name":"math-agent"}',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformScoreRow(row);

    expect(result.id).toBe('score-123');
    expect(result.scorerId).toBe('accuracy-scorer');
    expect(result.scorer).toEqual({ id: 'accuracy', name: 'Accuracy Scorer' });
    expect(result.input).toEqual({ question: 'What is 2+2?' });
    expect(result.output).toEqual({ answer: '4' });
    expect(result.score).toBe(1.0);
    expect(result.reason).toBe('Correct answer');
    expect(result.entity).toEqual({ name: 'math-agent' });
  });

  it('should accept the same options as transformRow', () => {
    const row = {
      id: 'score-123',
      scorerId: 'accuracy-scorer',
      runId: 'run-456',
      scorer: '{}',
      score: 1.0,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      createdAtZ: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T11:00:00Z',
      updatedAtZ: '2024-01-15T11:00:00.000Z',
    };

    const result = transformScoreRow(row, {
      timestampFallbackFields: {
        createdAt: 'createdAtZ',
        updatedAt: 'updatedAtZ',
      },
      convertTimestamps: true,
    });

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});

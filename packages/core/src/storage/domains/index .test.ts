import { describe, expect, it } from 'vitest';
import { safelyParseJSON } from '.';

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
});

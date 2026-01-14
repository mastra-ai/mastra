import { describe, it, expect } from 'vitest';
import {
  evaluateRef,
  isVariableRef,
  isLiteralValue,
  evaluateValueOrRef,
  evaluateInputMapping,
  type EvaluationContext,
  type VariableRef,
  type LiteralValue,
  type ValueOrRef,
} from '../evaluate-ref';

describe('evaluateRef', () => {
  const context: EvaluationContext = {
    input: {
      userId: '123',
      count: 42,
      nested: {
        deeply: {
          value: 'found',
        },
      },
    },
    steps: {
      step1: { output: { name: 'John', age: 30 } },
      step2: { output: { items: ['a', 'b', 'c'] } },
    },
    state: {
      counter: 5,
      isActive: true,
      data: null,
    },
  };

  describe('valid paths', () => {
    it('should resolve input references', () => {
      expect(evaluateRef('input.userId', context)).toBe('123');
      expect(evaluateRef('input.count', context)).toBe(42);
    });

    it('should resolve step output references', () => {
      expect(evaluateRef('steps.step1.output.name', context)).toBe('John');
      expect(evaluateRef('steps.step1.output.age', context)).toBe(30);
      expect(evaluateRef('steps.step2.output.items', context)).toEqual(['a', 'b', 'c']);
    });

    it('should resolve state references', () => {
      expect(evaluateRef('state.counter', context)).toBe(5);
      expect(evaluateRef('state.isActive', context)).toBe(true);
    });

    it('should return the entire source object when only source is specified', () => {
      expect(evaluateRef('input', context)).toEqual(context.input);
      expect(evaluateRef('steps', context)).toEqual(context.steps);
      expect(evaluateRef('state', context)).toEqual(context.state);
    });
  });

  describe('nested paths', () => {
    it('should resolve deeply nested input references', () => {
      expect(evaluateRef('input.nested.deeply.value', context)).toBe('found');
    });

    it('should resolve array elements via index', () => {
      expect(evaluateRef('steps.step2.output.items.0', context)).toBe('a');
      expect(evaluateRef('steps.step2.output.items.1', context)).toBe('b');
      expect(evaluateRef('steps.step2.output.items.2', context)).toBe('c');
    });
  });

  describe('missing paths', () => {
    it('should return undefined for non-existent input keys', () => {
      expect(evaluateRef('input.nonexistent', context)).toBeUndefined();
    });

    it('should return undefined for non-existent step keys', () => {
      expect(evaluateRef('steps.step999.output', context)).toBeUndefined();
    });

    it('should return undefined for non-existent state keys', () => {
      expect(evaluateRef('state.nonexistent', context)).toBeUndefined();
    });

    it('should return undefined for paths through non-objects', () => {
      expect(evaluateRef('input.userId.foo', context)).toBeUndefined();
      expect(evaluateRef('state.counter.bar', context)).toBeUndefined();
    });

    it('should return undefined for paths through null values', () => {
      expect(evaluateRef('state.data.foo', context)).toBeUndefined();
    });

    it('should return undefined for paths through undefined values', () => {
      expect(evaluateRef('input.nested.missing.value', context)).toBeUndefined();
    });
  });

  describe('invalid source', () => {
    it('should throw for unknown reference source', () => {
      expect(() => evaluateRef('unknown.path', context)).toThrow(
        'Unknown reference source: "unknown". Expected "input", "steps", or "state".',
      );
    });

    it('should throw for empty source', () => {
      expect(() => evaluateRef('.path', context)).toThrow(
        'Unknown reference source: "". Expected "input", "steps", or "state".',
      );
    });

    it('should throw for invalid sources', () => {
      expect(() => evaluateRef('context.input', context)).toThrow();
      expect(() => evaluateRef('workflow.steps', context)).toThrow();
    });
  });
});

describe('isVariableRef', () => {
  it('should return true for objects with $ref property', () => {
    expect(isVariableRef({ $ref: 'input.userId' })).toBe(true);
    expect(isVariableRef({ $ref: '' })).toBe(true);
  });

  it('should return false for objects without $ref property', () => {
    expect(isVariableRef({ $literal: 'value' })).toBe(false);
    expect(isVariableRef({ other: 'prop' })).toBe(false);
    expect(isVariableRef({})).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isVariableRef(null)).toBe(false);
    expect(isVariableRef(undefined)).toBe(false);
    expect(isVariableRef('string')).toBe(false);
    expect(isVariableRef(123)).toBe(false);
    expect(isVariableRef(true)).toBe(false);
    expect(isVariableRef(['array'])).toBe(false);
  });
});

describe('isLiteralValue', () => {
  it('should return true for objects with $literal property', () => {
    expect(isLiteralValue({ $literal: 'value' })).toBe(true);
    expect(isLiteralValue({ $literal: 123 })).toBe(true);
    expect(isLiteralValue({ $literal: null })).toBe(true);
    expect(isLiteralValue({ $literal: undefined })).toBe(true);
  });

  it('should return false for objects without $literal property', () => {
    expect(isLiteralValue({ $ref: 'path' })).toBe(false);
    expect(isLiteralValue({ other: 'prop' })).toBe(false);
    expect(isLiteralValue({})).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isLiteralValue(null)).toBe(false);
    expect(isLiteralValue(undefined)).toBe(false);
    expect(isLiteralValue('string')).toBe(false);
    expect(isLiteralValue(123)).toBe(false);
  });
});

describe('evaluateValueOrRef', () => {
  const context: EvaluationContext = {
    input: { userId: '123' },
    steps: { step1: { output: { name: 'John' } } },
    state: { counter: 5 },
  };

  describe('with $ref', () => {
    it('should evaluate variable reference', () => {
      const ref: VariableRef = { $ref: 'input.userId' };
      expect(evaluateValueOrRef(ref, context)).toBe('123');
    });

    it('should evaluate nested variable reference', () => {
      const ref: VariableRef = { $ref: 'steps.step1.output.name' };
      expect(evaluateValueOrRef(ref, context)).toBe('John');
    });

    it('should return undefined for non-existent paths', () => {
      const ref: VariableRef = { $ref: 'input.nonexistent' };
      expect(evaluateValueOrRef(ref, context)).toBeUndefined();
    });
  });

  describe('with $literal', () => {
    it('should return literal string value', () => {
      const literal: LiteralValue = { $literal: 'Hello' };
      expect(evaluateValueOrRef(literal, context)).toBe('Hello');
    });

    it('should return literal number value', () => {
      const literal: LiteralValue = { $literal: 42 };
      expect(evaluateValueOrRef(literal, context)).toBe(42);
    });

    it('should return literal null value', () => {
      const literal: LiteralValue = { $literal: null };
      expect(evaluateValueOrRef(literal, context)).toBeNull();
    });

    it('should return literal boolean value', () => {
      const literal: LiteralValue = { $literal: true };
      expect(evaluateValueOrRef(literal, context)).toBe(true);
    });

    it('should return literal object value', () => {
      const obj = { key: 'value' };
      const literal: LiteralValue = { $literal: obj };
      expect(evaluateValueOrRef(literal, context)).toEqual(obj);
    });

    it('should return literal array value', () => {
      const arr = [1, 2, 3];
      const literal: LiteralValue = { $literal: arr };
      expect(evaluateValueOrRef(literal, context)).toEqual(arr);
    });
  });

  describe('with invalid value', () => {
    it('should throw for objects without $ref or $literal', () => {
      const invalid = { other: 'value' } as unknown as ValueOrRef;
      expect(() => evaluateValueOrRef(invalid, context)).toThrow(
        'Invalid ValueOrRef: expected object with $ref or $literal property',
      );
    });

    it('should throw for empty objects', () => {
      const invalid = {} as unknown as ValueOrRef;
      expect(() => evaluateValueOrRef(invalid, context)).toThrow(
        'Invalid ValueOrRef: expected object with $ref or $literal property',
      );
    });
  });
});

describe('evaluateInputMapping', () => {
  const context: EvaluationContext = {
    input: { userId: '123', email: 'test@example.com' },
    steps: { step1: { output: { name: 'John', age: 30 } } },
    state: { counter: 5 },
  };

  it('should evaluate mapping with only $ref values', () => {
    const mapping: Record<string, ValueOrRef> = {
      user: { $ref: 'input.userId' },
      personName: { $ref: 'steps.step1.output.name' },
      count: { $ref: 'state.counter' },
    };

    expect(evaluateInputMapping(mapping, context)).toEqual({
      user: '123',
      personName: 'John',
      count: 5,
    });
  });

  it('should evaluate mapping with only $literal values', () => {
    const mapping: Record<string, ValueOrRef> = {
      greeting: { $literal: 'Hello' },
      count: { $literal: 42 },
      active: { $literal: true },
    };

    expect(evaluateInputMapping(mapping, context)).toEqual({
      greeting: 'Hello',
      count: 42,
      active: true,
    });
  });

  it('should evaluate mapping with mixed $ref and $literal values', () => {
    const mapping: Record<string, ValueOrRef> = {
      userId: { $ref: 'input.userId' },
      greeting: { $literal: 'Hello' },
      userName: { $ref: 'steps.step1.output.name' },
      defaultValue: { $literal: null },
    };

    expect(evaluateInputMapping(mapping, context)).toEqual({
      userId: '123',
      greeting: 'Hello',
      userName: 'John',
      defaultValue: null,
    });
  });

  it('should handle empty mapping', () => {
    const mapping: Record<string, ValueOrRef> = {};
    expect(evaluateInputMapping(mapping, context)).toEqual({});
  });

  it('should handle undefined values from missing references', () => {
    const mapping: Record<string, ValueOrRef> = {
      missing: { $ref: 'input.nonexistent' },
      present: { $literal: 'value' },
    };

    expect(evaluateInputMapping(mapping, context)).toEqual({
      missing: undefined,
      present: 'value',
    });
  });
});

import { describe, it, expect } from 'vitest';
import { evaluateCondition, type ConditionDef, type ConditionOperator } from '../evaluate-condition';
import type { EvaluationContext, VariableRef, ValueOrRef } from '../evaluate-ref';

describe('evaluateCondition', () => {
  const context: EvaluationContext = {
    input: {
      userId: '123',
      count: 42,
      name: 'Hello World',
      email: 'test@example.com',
      tags: ['a', 'b', 'c'],
      isActive: true,
      nullValue: null,
    },
    steps: {
      step1: { output: { status: 'success', score: 85 } },
    },
    state: {
      counter: 10,
      message: 'Processing complete',
    },
  };

  describe('comparison operators', () => {
    describe('equals', () => {
      it('should return true for equal string values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'equals',
          value: { $literal: '123' },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false for unequal string values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'equals',
          value: { $literal: '456' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return true for equal number values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'equals',
          value: { $literal: 42 },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should compare values from different sources', () => {
        const contextWithMatch: EvaluationContext = {
          ...context,
          state: { ...context.state, counter: 42 },
        };
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'equals',
          value: { $ref: 'state.counter' },
        };
        expect(evaluateCondition(condition, contextWithMatch)).toBe(true);
      });
    });

    describe('notEquals', () => {
      it('should return true for unequal values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'notEquals',
          value: { $literal: '456' },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false for equal values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'notEquals',
          value: { $literal: '123' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('gt (greater than)', () => {
      it('should return true when field > value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'gt',
          value: { $literal: 40 },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when field <= value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'gt',
          value: { $literal: 42 },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return false for non-numeric values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'gt',
          value: { $literal: 100 },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('gte (greater than or equal)', () => {
      it('should return true when field >= value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'gte',
          value: { $literal: 42 },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when field < value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'gte',
          value: { $literal: 50 },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('lt (less than)', () => {
      it('should return true when field < value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'lt',
          value: { $literal: 50 },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when field >= value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'lt',
          value: { $literal: 42 },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('lte (less than or equal)', () => {
      it('should return true when field <= value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'lte',
          value: { $literal: 42 },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when field > value', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'lte',
          value: { $literal: 30 },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('contains', () => {
      it('should return true when string contains substring', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.name' },
          operator: 'contains',
          value: { $literal: 'World' },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when string does not contain substring', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.name' },
          operator: 'contains',
          value: { $literal: 'Universe' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return false for non-string values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'contains',
          value: { $literal: '4' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('startsWith', () => {
      it('should return true when string starts with prefix', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.name' },
          operator: 'startsWith',
          value: { $literal: 'Hello' },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when string does not start with prefix', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.name' },
          operator: 'startsWith',
          value: { $literal: 'World' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('endsWith', () => {
      it('should return true when string ends with suffix', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.name' },
          operator: 'endsWith',
          value: { $literal: 'World' },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when string does not end with suffix', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.name' },
          operator: 'endsWith',
          value: { $literal: 'Hello' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('matches (regex)', () => {
      it('should return true when string matches regex', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.email' },
          operator: 'matches',
          value: { $literal: '^[^@]+@[^@]+\\.[^@]+$' },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when string does not match regex', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.email' },
          operator: 'matches',
          value: { $literal: '^\\d+$' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return false for invalid regex', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.email' },
          operator: 'matches',
          value: { $literal: '[invalid(' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return false for non-string field', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.count' },
          operator: 'matches',
          value: { $literal: '\\d+' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('in', () => {
      it('should return true when value is in array', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'in',
          value: { $literal: ['123', '456', '789'] },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when value is not in array', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'in',
          value: { $literal: ['456', '789'] },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return false when compare value is not an array', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'in',
          value: { $literal: '123' },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('isNull', () => {
      it('should return true for null values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.nullValue' },
          operator: 'isNull',
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return true for undefined values (missing paths)', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.nonexistent' },
          operator: 'isNull',
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false for non-null values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'isNull',
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('isNotNull', () => {
      it('should return false for null values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.nullValue' },
          operator: 'isNotNull',
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return true for non-null values', () => {
        const condition: ConditionDef = {
          type: 'compare',
          field: { $ref: 'input.userId' },
          operator: 'isNotNull',
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });
    });
  });

  describe('logical operators', () => {
    describe('and', () => {
      it('should return true when all conditions are true', () => {
        const condition: ConditionDef = {
          type: 'and',
          conditions: [
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'gt',
              value: { $literal: 40 },
            },
            {
              type: 'compare',
              field: { $ref: 'input.isActive' },
              operator: 'equals',
              value: { $literal: true },
            },
          ],
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when any condition is false', () => {
        const condition: ConditionDef = {
          type: 'and',
          conditions: [
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'gt',
              value: { $literal: 40 },
            },
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'lt',
              value: { $literal: 40 },
            },
          ],
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return true for empty conditions array', () => {
        const condition: ConditionDef = {
          type: 'and',
          conditions: [],
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });
    });

    describe('or', () => {
      it('should return true when any condition is true', () => {
        const condition: ConditionDef = {
          type: 'or',
          conditions: [
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'lt',
              value: { $literal: 10 },
            },
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'gt',
              value: { $literal: 40 },
            },
          ],
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });

      it('should return false when all conditions are false', () => {
        const condition: ConditionDef = {
          type: 'or',
          conditions: [
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'lt',
              value: { $literal: 10 },
            },
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'gt',
              value: { $literal: 50 },
            },
          ],
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should return false for empty conditions array', () => {
        const condition: ConditionDef = {
          type: 'or',
          conditions: [],
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });
    });

    describe('not', () => {
      it('should negate true condition to false', () => {
        const condition: ConditionDef = {
          type: 'not',
          condition: {
            type: 'compare',
            field: { $ref: 'input.count' },
            operator: 'equals',
            value: { $literal: 42 },
          },
        };
        expect(evaluateCondition(condition, context)).toBe(false);
      });

      it('should negate false condition to true', () => {
        const condition: ConditionDef = {
          type: 'not',
          condition: {
            type: 'compare',
            field: { $ref: 'input.count' },
            operator: 'equals',
            value: { $literal: 100 },
          },
        };
        expect(evaluateCondition(condition, context)).toBe(true);
      });
    });
  });

  describe('nested conditions', () => {
    it('should handle deeply nested conditions', () => {
      // (count > 40 AND isActive) OR (count < 10 AND NOT isActive)
      const condition: ConditionDef = {
        type: 'or',
        conditions: [
          {
            type: 'and',
            conditions: [
              {
                type: 'compare',
                field: { $ref: 'input.count' },
                operator: 'gt',
                value: { $literal: 40 },
              },
              {
                type: 'compare',
                field: { $ref: 'input.isActive' },
                operator: 'equals',
                value: { $literal: true },
              },
            ],
          },
          {
            type: 'and',
            conditions: [
              {
                type: 'compare',
                field: { $ref: 'input.count' },
                operator: 'lt',
                value: { $literal: 10 },
              },
              {
                type: 'not',
                condition: {
                  type: 'compare',
                  field: { $ref: 'input.isActive' },
                  operator: 'equals',
                  value: { $literal: true },
                },
              },
            ],
          },
        ],
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should handle not with and', () => {
      // NOT (count > 50 AND isActive)
      const condition: ConditionDef = {
        type: 'not',
        condition: {
          type: 'and',
          conditions: [
            {
              type: 'compare',
              field: { $ref: 'input.count' },
              operator: 'gt',
              value: { $literal: 50 },
            },
            {
              type: 'compare',
              field: { $ref: 'input.isActive' },
              operator: 'equals',
              value: { $literal: true },
            },
          ],
        },
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });
  });

  describe('expression evaluation', () => {
    it('should evaluate simple expressions', () => {
      const condition: ConditionDef = {
        type: 'expr',
        expression: 'input.count > 40',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should evaluate expressions with step references', () => {
      const condition: ConditionDef = {
        type: 'expr',
        expression: "steps.step1.output.status === 'success'",
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should evaluate expressions with state references', () => {
      const condition: ConditionDef = {
        type: 'expr',
        expression: 'state.counter >= 10',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should evaluate complex expressions', () => {
      const condition: ConditionDef = {
        type: 'expr',
        expression: "input.count > 40 && steps.step1.output.status === 'success'",
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should return false for falsy expressions', () => {
      const condition: ConditionDef = {
        type: 'expr',
        expression: 'input.count > 100',
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should coerce non-boolean results to boolean', () => {
      const condition: ConditionDef = {
        type: 'expr',
        expression: 'input.count',
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should throw for invalid expressions', () => {
      const condition: ConditionDef = {
        type: 'expr',
        expression: 'invalid syntax {{{{',
      };
      expect(() => evaluateCondition(condition, context)).toThrow('Failed to evaluate expression');
    });
  });

  describe('edge cases', () => {
    it('should handle comparing undefined to literal', () => {
      const condition: ConditionDef = {
        type: 'compare',
        field: { $ref: 'input.nonexistent' },
        operator: 'equals',
        value: { $literal: undefined },
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should handle type mismatches gracefully', () => {
      // Comparing string to number should return false for numeric operators
      const condition: ConditionDef = {
        type: 'compare',
        field: { $ref: 'input.userId' }, // string '123'
        operator: 'gt',
        value: { $literal: 100 },
      };
      expect(evaluateCondition(condition, context)).toBe(false);
    });

    it('should throw for unknown condition type', () => {
      const condition = {
        type: 'unknown',
      } as unknown as ConditionDef;
      expect(() => evaluateCondition(condition, context)).toThrow('Unknown condition type: unknown');
    });

    it('should throw for unknown operator', () => {
      const condition: ConditionDef = {
        type: 'compare',
        field: { $ref: 'input.count' },
        operator: 'unknownOp' as ConditionOperator,
        value: { $literal: 42 },
      };
      expect(() => evaluateCondition(condition, context)).toThrow('Unknown operator: unknownOp');
    });

    it('should handle boolean field values', () => {
      const condition: ConditionDef = {
        type: 'compare',
        field: { $ref: 'input.isActive' },
        operator: 'equals',
        value: { $literal: true },
      };
      expect(evaluateCondition(condition, context)).toBe(true);
    });

    it('should handle comparing arrays', () => {
      const condition: ConditionDef = {
        type: 'compare',
        field: { $ref: 'input.tags' },
        operator: 'equals',
        value: { $literal: ['a', 'b', 'c'] },
      };
      // Arrays are compared by reference, so this should be false
      expect(evaluateCondition(condition, context)).toBe(false);
    });
  });
});

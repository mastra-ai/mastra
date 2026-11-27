import { describe, it, expect } from 'vitest';
import { evaluateRuleGroup } from './rule-evaluator';
import type { Rule, RuleGroup } from '@mastra/core/storage';

describe('evaluateRuleGroup', () => {
  describe('empty conditions', () => {
    it('should return true for empty AND group', () => {
      expect(evaluateRuleGroup({ operator: 'AND', conditions: [] }, {})).toBe(true);
    });

    it('should return true for empty OR group', () => {
      expect(evaluateRuleGroup({ operator: 'OR', conditions: [] }, {})).toBe(true);
    });
  });

  describe('equals / not_equals', () => {
    it.each([
      ['should pass for equals match', 'equals', 'admin', true],
      ['should fail for equals mismatch', 'equals', 'user', false],
      ['should pass for not_equals mismatch', 'not_equals', 'user', true],
      ['should fail for not_equals match', 'not_equals', 'admin', false],
    ] as const)('%s', (_title, operator, role, expected) => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator, value: 'admin' }],
      };
      expect(evaluateRuleGroup(group, { role })).toBe(expected);
    });
  });

  describe('contains / not_contains', () => {
    it.each([
      ['should pass for string contains', 'contains', 'lic', true],
      ['should fail for string not containing', 'contains', 'xyz', false],
      ['should pass for not_contains when absent from string', 'not_contains', 'xyz', true],
      ['should fail for not_contains when present', 'not_contains', 'lic', false],
    ] as const)('%s', (_title, operator, value, expected) => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator, value }],
      };
      expect(evaluateRuleGroup(group, { name: 'Alice' })).toBe(expected);
    });

    it('should pass for array contains', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'tags', operator: 'contains', value: 'vip' }],
      };
      expect(evaluateRuleGroup(group, { tags: ['vip', 'active'] })).toBe(true);
    });

    it.each([
      ['should return false for contains on non-string/non-array', 'contains', false],
      ['should return true for not_contains on non-string/non-array', 'not_contains', true],
    ] as const)('%s', (_title, operator, expected) => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'count', operator, value: 1 }],
      };
      expect(evaluateRuleGroup(group, { count: 42 })).toBe(expected);
    });
  });

  describe('comparison operators', () => {
    it('should pass greater_than', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'age', operator: 'greater_than', value: 18 }],
      };
      expect(evaluateRuleGroup(group, { age: 25 })).toBe(true);
    });

    it('should fail greater_than when equal', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'age', operator: 'greater_than', value: 25 }],
      };
      expect(evaluateRuleGroup(group, { age: 25 })).toBe(false);
    });

    it('should pass less_than', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'age', operator: 'less_than', value: 30 }],
      };
      expect(evaluateRuleGroup(group, { age: 25 })).toBe(true);
    });

    it('should pass greater_than_or_equal when equal', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'age', operator: 'greater_than_or_equal', value: 25 }],
      };
      expect(evaluateRuleGroup(group, { age: 25 })).toBe(true);
    });

    it('should pass less_than_or_equal when equal', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'age', operator: 'less_than_or_equal', value: 25 }],
      };
      expect(evaluateRuleGroup(group, { age: 25 })).toBe(true);
    });

    it('should fail comparison on non-numeric', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'age', operator: 'greater_than', value: 18 }],
      };
      expect(evaluateRuleGroup(group, { age: 'twenty' })).toBe(false);
    });
  });

  describe('in / not_in', () => {
    it.each([
      ['should pass when value is in array', 'in', 'admin', true],
      ['should fail when value is not in array', 'in', 'viewer', false],
      ['should pass not_in when value absent', 'not_in', 'viewer', true],
      ['should fail not_in when value present', 'not_in', 'admin', false],
    ] as const)('%s', (_title, operator, role, expected) => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator, value: ['admin', 'editor'] }],
      };
      expect(evaluateRuleGroup(group, { role })).toBe(expected);
    });
  });

  describe('exists / not_exists', () => {
    it.each([
      ['should pass exists when field has a value', 'Alice', true],
      ['should fail exists when field is null', null, false],
    ] as const)('%s', (_title, name, expected) => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'exists', value: null }],
      };
      expect(evaluateRuleGroup(group, { name })).toBe(expected);
    });

    it.each([
      ['should fail exists when field is undefined', 'exists', false],
      ['should pass not_exists when field is undefined', 'not_exists', true],
    ] as const)('%s', (_title, operator, expected) => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator, value: null }],
      };
      expect(evaluateRuleGroup(group, {})).toBe(expected);
    });
  });

  describe('nested path resolution', () => {
    it('should evaluate rules using dot-notation paths', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'user.role', operator: 'equals', value: 'admin' }],
      };
      expect(evaluateRuleGroup(group, { user: { role: 'admin' } })).toBe(true);
    });

    it('should handle missing intermediate path segments', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'user.profile.role', operator: 'exists', value: null }],
      };
      expect(evaluateRuleGroup(group, { user: {} })).toBe(false);
    });
  });

  describe('AND grouping', () => {
    it.each([
      ['should pass when all conditions pass', true],
      ['should fail when one condition fails', false],
    ] as const)('%s', (_title, active) => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [
          { field: 'role', operator: 'equals', value: 'admin' },
          { field: 'active', operator: 'equals', value: true },
        ],
      };
      expect(evaluateRuleGroup(group, { role: 'admin', active })).toBe(active);
    });
  });

  describe('OR grouping', () => {
    it.each([
      ['should pass when at least one condition passes', 'editor', true],
      ['should fail when no conditions pass', 'viewer', false],
    ] as const)('%s', (_title, role, expected) => {
      const group: RuleGroup = {
        operator: 'OR',
        conditions: [
          { field: 'role', operator: 'equals', value: 'admin' },
          { field: 'role', operator: 'equals', value: 'editor' },
        ],
      };
      expect(evaluateRuleGroup(group, { role })).toBe(expected);
    });
  });

  describe('nested RuleGroups', () => {
    it('should evaluate nested groups recursively', () => {
      // (role == admin) AND (tier == gold OR tier == platinum)
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [
          { field: 'role', operator: 'equals', value: 'admin' },
          {
            operator: 'OR',
            conditions: [
              { field: 'tier', operator: 'equals', value: 'gold' },
              { field: 'tier', operator: 'equals', value: 'platinum' },
            ],
          },
        ],
      };
      expect(evaluateRuleGroup(group, { role: 'admin', tier: 'platinum' })).toBe(true);
      expect(evaluateRuleGroup(group, { role: 'admin', tier: 'silver' })).toBe(false);
      expect(evaluateRuleGroup(group, { role: 'user', tier: 'gold' })).toBe(false);
    });

    it('should handle deeply nested groups', () => {
      const group: RuleGroup = {
        operator: 'OR',
        conditions: [
          {
            operator: 'AND',
            conditions: [
              { field: 'a', operator: 'equals', value: 1 },
              { field: 'b', operator: 'equals', value: 2 },
            ],
          },
          {
            operator: 'AND',
            conditions: [
              { field: 'c', operator: 'equals', value: 3 },
              { field: 'd', operator: 'equals', value: 4 },
            ],
          },
        ],
      };
      expect(evaluateRuleGroup(group, { a: 1, b: 2, c: 0, d: 0 })).toBe(true);
      expect(evaluateRuleGroup(group, { a: 0, b: 0, c: 3, d: 4 })).toBe(true);
      expect(evaluateRuleGroup(group, { a: 1, b: 0, c: 3, d: 0 })).toBe(false);
    });
  });

  describe('unknown operator', () => {
    it('should return false for an unknown operator', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'x', operator: 'banana' as any, value: 1 }],
      };
      expect(evaluateRuleGroup(group, { x: 1 })).toBe(false);
    });
  });
});

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
    it('should pass for equals match', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
      };
      expect(evaluateRuleGroup(group, { role: 'admin' })).toBe(true);
    });

    it('should fail for equals mismatch', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
      };
      expect(evaluateRuleGroup(group, { role: 'user' })).toBe(false);
    });

    it('should pass for not_equals mismatch', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'not_equals', value: 'admin' }],
      };
      expect(evaluateRuleGroup(group, { role: 'user' })).toBe(true);
    });

    it('should fail for not_equals match', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'not_equals', value: 'admin' }],
      };
      expect(evaluateRuleGroup(group, { role: 'admin' })).toBe(false);
    });
  });

  describe('contains / not_contains', () => {
    it('should pass for string contains', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'contains', value: 'lic' }],
      };
      expect(evaluateRuleGroup(group, { name: 'Alice' })).toBe(true);
    });

    it('should pass for array contains', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'tags', operator: 'contains', value: 'vip' }],
      };
      expect(evaluateRuleGroup(group, { tags: ['vip', 'active'] })).toBe(true);
    });

    it('should fail for string not containing', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'contains', value: 'xyz' }],
      };
      expect(evaluateRuleGroup(group, { name: 'Alice' })).toBe(false);
    });

    it('should pass for not_contains when absent from string', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'not_contains', value: 'xyz' }],
      };
      expect(evaluateRuleGroup(group, { name: 'Alice' })).toBe(true);
    });

    it('should fail for not_contains when present', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'not_contains', value: 'lic' }],
      };
      expect(evaluateRuleGroup(group, { name: 'Alice' })).toBe(false);
    });

    it('should return false for contains on non-string/non-array', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'count', operator: 'contains', value: 1 }],
      };
      expect(evaluateRuleGroup(group, { count: 42 })).toBe(false);
    });

    it('should return true for not_contains on non-string/non-array', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'count', operator: 'not_contains', value: 1 }],
      };
      expect(evaluateRuleGroup(group, { count: 42 })).toBe(true);
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
    it('should pass when value is in array', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'in', value: ['admin', 'editor'] }],
      };
      expect(evaluateRuleGroup(group, { role: 'admin' })).toBe(true);
    });

    it('should fail when value is not in array', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'in', value: ['admin', 'editor'] }],
      };
      expect(evaluateRuleGroup(group, { role: 'viewer' })).toBe(false);
    });

    it('should pass not_in when value absent', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'not_in', value: ['admin', 'editor'] }],
      };
      expect(evaluateRuleGroup(group, { role: 'viewer' })).toBe(true);
    });

    it('should fail not_in when value present', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'not_in', value: ['admin', 'editor'] }],
      };
      expect(evaluateRuleGroup(group, { role: 'admin' })).toBe(false);
    });
  });

  describe('exists / not_exists', () => {
    it('should pass exists when field has a value', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'exists', value: null }],
      };
      expect(evaluateRuleGroup(group, { name: 'Alice' })).toBe(true);
    });

    it('should fail exists when field is undefined', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'exists', value: null }],
      };
      expect(evaluateRuleGroup(group, {})).toBe(false);
    });

    it('should fail exists when field is null', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'exists', value: null }],
      };
      expect(evaluateRuleGroup(group, { name: null })).toBe(false);
    });

    it('should pass not_exists when field is undefined', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [{ field: 'name', operator: 'not_exists', value: null }],
      };
      expect(evaluateRuleGroup(group, {})).toBe(true);
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
    it('should pass when all conditions pass', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [
          { field: 'role', operator: 'equals', value: 'admin' },
          { field: 'active', operator: 'equals', value: true },
        ],
      };
      expect(evaluateRuleGroup(group, { role: 'admin', active: true })).toBe(true);
    });

    it('should fail when one condition fails', () => {
      const group: RuleGroup = {
        operator: 'AND',
        conditions: [
          { field: 'role', operator: 'equals', value: 'admin' },
          { field: 'active', operator: 'equals', value: true },
        ],
      };
      expect(evaluateRuleGroup(group, { role: 'admin', active: false })).toBe(false);
    });
  });

  describe('OR grouping', () => {
    it('should pass when at least one condition passes', () => {
      const group: RuleGroup = {
        operator: 'OR',
        conditions: [
          { field: 'role', operator: 'equals', value: 'admin' },
          { field: 'role', operator: 'equals', value: 'editor' },
        ],
      };
      expect(evaluateRuleGroup(group, { role: 'editor' })).toBe(true);
    });

    it('should fail when no conditions pass', () => {
      const group: RuleGroup = {
        operator: 'OR',
        conditions: [
          { field: 'role', operator: 'equals', value: 'admin' },
          { field: 'role', operator: 'equals', value: 'editor' },
        ],
      };
      expect(evaluateRuleGroup(group, { role: 'viewer' })).toBe(false);
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

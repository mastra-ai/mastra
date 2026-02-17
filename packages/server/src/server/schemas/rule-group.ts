import z from 'zod';

/**
 * Rule and RuleGroup schemas for conditional prompt block evaluation.
 *
 * Uses a fixed nesting depth (3 levels) to avoid infinite recursion
 * when converting to JSON Schema / OpenAPI.
 */
export const ruleSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'in',
    'not_in',
    'exists',
    'not_exists',
  ]),
  value: z.unknown(),
});

const ruleGroupDepth2 = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(ruleSchema),
});

const ruleGroupDepth1 = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.union([ruleSchema, ruleGroupDepth2])),
});

export const ruleGroupSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.union([ruleSchema, ruleGroupDepth1])),
});

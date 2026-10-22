import { z } from 'zod';

/**
 * Conditions for intake and event routes. Factory owns these types and their
 * evaluator; the shape mirrors the editor's rule groups (`{field, operator,
 * value}` leaves inside AND/OR groups) so the two read the same, but nothing is
 * shared with `@mastra/editor` or `@mastra/server`.
 */
export const RULE_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'exists',
  'not_exists',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const MAX_RULE_GROUP_DEPTH = 3;
const MAX_CONDITIONS_PER_GROUP = 20;
const MAX_STRING_VALUE_LENGTH = 500;

/** Facts an intake route can test when it places a new item. */
export const INTAKE_ROUTE_FIELDS = [
  'source.kind',
  'source.integration',
  'source.repository',
  'source.team',
  'source.project',
  'item.labels',
  'item.author',
  'item.title',
  'item.authorTrusted',
  'item.draft',
] as const;

/** Facts an event route can test when an integration event reaches a card. */
export const EVENT_ROUTE_FIELDS = [
  'pullRequest.merged',
  'pullRequest.draft',
  'pullRequest.factoryAuthored',
  'issue.stateReason',
  'item.hasOtherOpenPullRequest',
  'actor.trusted',
] as const;

export type RuleValue = string | number | boolean | Array<string | number | boolean>;

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: RuleValue;
}

export interface RuleGroup {
  operator: 'AND' | 'OR';
  conditions: Array<RuleCondition | RuleGroup>;
}

export type RuleFacts = Readonly<Record<string, unknown>>;

const scalarSchema = z.union([z.string().max(MAX_STRING_VALUE_LENGTH), z.number().finite(), z.boolean()]);
const valueSchema = z.union([scalarSchema, z.array(scalarSchema).max(100)]);

const VALUELESS: ReadonlySet<RuleOperator> = new Set(['exists', 'not_exists']);
const LIST_VALUE: ReadonlySet<RuleOperator> = new Set(['in', 'not_in']);
const ORDERED: ReadonlySet<RuleOperator> = new Set([
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
]);

function conditionSchema(fields: readonly [string, ...string[]]) {
  return z
    .object({ field: z.enum(fields), operator: z.enum(RULE_OPERATORS), value: valueSchema.optional() })
    .strict()
    .superRefine((condition, ctx) => {
      if (VALUELESS.has(condition.operator)) {
        if (condition.value !== undefined) {
          ctx.addIssue({ code: 'custom', path: ['value'], message: `'${condition.operator}' takes no value.` });
        }
        return;
      }
      if (condition.value === undefined) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: `'${condition.operator}' needs a value.` });
        return;
      }
      if (LIST_VALUE.has(condition.operator) !== Array.isArray(condition.value)) {
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: LIST_VALUE.has(condition.operator)
            ? `'${condition.operator}' needs a list value.`
            : `'${condition.operator}' needs a single value.`,
        });
      }
      if (ORDERED.has(condition.operator) && typeof condition.value !== 'number') {
        ctx.addIssue({ code: 'custom', path: ['value'], message: `'${condition.operator}' needs a number.` });
      }
    });
}

/** Zod schema for a rule group whose leaves may only name `fields`. Depth is capped at {@link MAX_RULE_GROUP_DEPTH}. */
export function ruleGroupSchema(fields: readonly [string, ...string[]]): z.ZodType<RuleGroup> {
  const leaf = conditionSchema(fields);
  const groupAt = (depth: number): z.ZodType<RuleGroup> => {
    const member: z.ZodType<RuleCondition | RuleGroup> =
      depth < MAX_RULE_GROUP_DEPTH ? z.union([leaf, z.lazy(() => groupAt(depth + 1))]) : leaf;
    return z
      .object({
        operator: z.enum(['AND', 'OR']),
        conditions: z.array(member).min(1).max(MAX_CONDITIONS_PER_GROUP),
      })
      .strict() as z.ZodType<RuleGroup>;
  };
  return groupAt(1);
}

export const intakeRouteWhenSchema = ruleGroupSchema(INTAKE_ROUTE_FIELDS);
export const eventRouteWhenSchema = ruleGroupSchema(EVENT_ROUTE_FIELDS);

function isGroup(member: RuleCondition | RuleGroup): member is RuleGroup {
  return 'conditions' in member;
}

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const same = (left: unknown, right: unknown) => normalize(left) === normalize(right);

function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) return actual.some(entry => same(entry, expected));
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }
  return false;
}

function compare(actual: unknown, expected: unknown, test: (left: number, right: number) => boolean): boolean {
  return typeof actual === 'number' && typeof expected === 'number' && test(actual, expected);
}

/**
 * Evaluate one condition. Strings compare case-insensitively (labels and
 * repository slugs are case-insensitive on every provider Factory reads). A
 * missing fact fails every operator except `not_exists`, `not_equals`,
 * `not_contains` and `not_in`.
 */
function evaluateCondition(condition: RuleCondition, facts: RuleFacts): boolean {
  const actual = facts[condition.field];
  const present = actual !== undefined && actual !== null;
  const expected = condition.value;
  switch (condition.operator) {
    case 'exists':
      return present;
    case 'not_exists':
      return !present;
    case 'equals':
      return present && same(actual, expected);
    case 'not_equals':
      return !present || !same(actual, expected);
    case 'contains':
      return present && contains(actual, expected);
    case 'not_contains':
      return !present || !contains(actual, expected);
    case 'in':
      return present && Array.isArray(expected) && expected.some(candidate => same(actual, candidate));
    case 'not_in':
      return !present || !Array.isArray(expected) || !expected.some(candidate => same(actual, candidate));
    case 'greater_than':
      return compare(actual, expected, (left, right) => left > right);
    case 'less_than':
      return compare(actual, expected, (left, right) => left < right);
    case 'greater_than_or_equal':
      return compare(actual, expected, (left, right) => left >= right);
    case 'less_than_or_equal':
      return compare(actual, expected, (left, right) => left <= right);
  }
}

/** True when `facts` satisfy `group`. A `null`/absent group matches everything (a fallback route). */
export function evaluateRuleGroup(group: RuleGroup | null | undefined, facts: RuleFacts): boolean {
  if (!group) return true;
  const results = group.conditions.map(member =>
    isGroup(member) ? evaluateRuleGroup(member, facts) : evaluateCondition(member, facts),
  );
  return group.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

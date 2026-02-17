import type { ConditionOperator, Rule, RuleGroup } from '../types';
import type { JsonSchema, JsonSchemaProperty } from '@/lib/json-schema';

export type { JsonSchema, JsonSchemaProperty };

/**
 * Represents a field option extracted from JSON Schema
 */
export type FieldOption = {
  /** The field path (e.g., "user.email") */
  path: string;
  /** Display label */
  label: string;
  /** The JSON Schema type of the field */
  type: string;
  /** Whether this field has nested properties */
  hasChildren: boolean;
  /** Child properties if type is object */
  children?: Record<string, JsonSchemaProperty>;
  /** Item schema if type is array */
  items?: JsonSchemaProperty;
};

/**
 * Props for the RuleBuilder root component
 */
export type RuleBuilderProps = {
  /** JSON Schema defining available fields */
  schema: JsonSchema;
  /** Current rule group (recursive, supports nested groups) */
  ruleGroup: RuleGroup | undefined;
  /** Callback when rule group changes */
  onChange: (ruleGroup: RuleGroup | undefined) => void;
  /** Maximum nesting depth (default: 3) */
  maxDepth?: number;
  /** Optional class name */
  className?: string;
};

/**
 * Internal props for the recursive RuleGroupView component
 */
export type RuleGroupViewProps = {
  /** JSON Schema defining available fields */
  schema: JsonSchema;
  /** The rule group to render */
  group: RuleGroup;
  /** Callback when this group changes */
  onChange: (group: RuleGroup) => void;
  /** Callback to remove this group (undefined for root) */
  onRemove?: () => void;
  /** Current nesting depth (0 = root) */
  depth: number;
  /** Maximum nesting depth */
  maxDepth: number;
};

/**
 * Props for a single rule row
 */
export type RuleRowProps = {
  /** JSON Schema defining available fields */
  schema: JsonSchema;
  /** Current rule */
  rule: Rule;
  /** Callback when rule changes */
  onChange: (rule: Rule) => void;
  /** Callback to remove this rule */
  onRemove: () => void;
  /** Optional class name */
  className?: string;
};

/**
 * Props for the field selector
 */
export type RuleFieldSelectProps = {
  /** JSON Schema defining available fields */
  schema: JsonSchema;
  /** Current selected field path */
  value: string;
  /** Callback when field changes */
  onChange: (field: string) => void;
  /** Optional class name */
  className?: string;
};

/**
 * Props for the operator selector
 */
export type RuleOperatorSelectProps = {
  /** Current selected operator */
  value: ConditionOperator;
  /** Callback when operator changes */
  onChange: (operator: ConditionOperator) => void;
  /** Subset of operators to show. Defaults to all operators. */
  operators?: readonly ConditionOperator[];
  /** Optional class name */
  className?: string;
};

/**
 * Props for the value input
 */
export type RuleValueInputProps = {
  /** Current value */
  value: unknown;
  /** Callback when value changes */
  onChange: (value: unknown) => void;
  /** The operator (affects input behavior for "in" and "not_in") */
  operator: ConditionOperator;
  /** The field type from JSON Schema (string, number, boolean, etc.) */
  fieldType?: string;
  /** Optional placeholder */
  placeholder?: string;
  /** Optional class name */
  className?: string;
};

/**
 * Operator labels for display
 */
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'not equals',
  contains: 'contains',
  not_contains: 'not contains',
  greater_than: 'greater than',
  less_than: 'less than',
  greater_than_or_equal: 'greater than or equal',
  less_than_or_equal: 'less than or equal',
  in: 'in',
  not_in: 'not in',
  exists: 'exists',
  not_exists: 'not exists',
};

/**
 * All available operators
 */
export const OPERATORS: ConditionOperator[] = [
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
];

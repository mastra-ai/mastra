export type { Rule, RuleGroup, ConditionOperator } from './types';

// Re-export JSON Schema types from shared location for backward compatibility
export type { JsonSchema, JsonSchemaProperty } from '@/lib/json-schema';

// Utilities
export { isRule, isRuleGroup, countLeafRules, countGroups, createDefaultRule, createDefaultRuleGroup } from './utils';

// Components
export {
  RuleBuilder,
  RuleRow,
  RuleFieldSelect,
  RuleOperatorSelect,
  RuleValueInput,
  OPERATOR_LABELS,
  OPERATORS,
  getFieldOptionsFromSchema,
  getFieldOptionAtPath,
  getChildFieldOptions,
  parseFieldPath,
} from './components';

export type {
  FieldOption,
  RuleBuilderProps,
  RuleRowProps,
  RuleFieldSelectProps,
  RuleOperatorSelectProps,
  RuleValueInputProps,
} from './components';

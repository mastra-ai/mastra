export { isEligible } from './utils';
export type { Rule, RuleContext, ConditionOperator, RuleValue } from './types';

// Re-export JSON Schema types from shared location for backward compatibility
export type { JsonSchema, JsonSchemaProperty } from '@/lib/json-schema';

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

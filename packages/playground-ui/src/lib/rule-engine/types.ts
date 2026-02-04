export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in';

export type RuleValue = unknown | Array<unknown>;

export type Rule = {
  field: string;
  operator: ConditionOperator;
  value: RuleValue;
};

// Generic context type for pre-validated JSON Schema data
export type RuleContext = Record<string, unknown>;

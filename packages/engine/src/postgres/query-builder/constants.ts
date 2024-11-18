import { FilterOperators, PropertyType } from '@mastra/core';

export interface SortField {
  type: string;
  name: string;
  displayName: string;
  config?: Record<string, any>;
}

export interface SortLogic {
  field: SortField;
  mode: 'ascending' | 'descending';
}

export const fieldsWithCommaSeparatedValues: PropertyType[] = [
  PropertyType.SINGLE_SELECT,
  PropertyType.MULTI_SELECT,
  PropertyType.USER,
  PropertyType.COMPANY,
  PropertyType.CONTACT,
];

export const SORT_MODE_TO_ABBR: Record<SortLogic['mode'], string> = {
  ascending: 'asc',
  descending: 'desc',
};

export const FilterOperatorToSQL: Record<FilterOperators, string> = {
  [FilterOperators.IS]: '=',
  [FilterOperators.EQUAL]: '=',
  [FilterOperators.NOT_EQUAL]: '!=',
  [FilterOperators.CONTAINS]: '~*',
  [FilterOperators.IN]: 'IN',
  [FilterOperators.NOT_IN]: 'NOT IN',
  [FilterOperators.GREATER_THAN]: '>',
  [FilterOperators.LESS_THAN]: '<',
  [FilterOperators.NOT_CONTAINS]: '!~*',
  [FilterOperators.GREATER_THAN_OR_EQUAL]: '>=',
  [FilterOperators.LESS_THAN_OR_EQUAL]: '<=',
  // this is so we don't piss off the types
  [FilterOperators.OP]: 'AND',
  [FilterOperators.SET]: 'IS NOT NULL',
  [FilterOperators.NOT_SET]: 'IS NULL',
};

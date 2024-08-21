import { PropertyType } from '@prisma-app/client';
import { FilterOperators } from './types';

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
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'USER',
  'COMPANY',
  'CONTACT',
];

export const FieldTypePrimitiveMap: Record<PropertyType, string> = {
  [PropertyType.BADGE_LIST]: 'string',
  [PropertyType.CHECKBOX]: 'boolean',
  [PropertyType.CURRENCY]: 'number',
  [PropertyType.DATE]: 'date',
  [PropertyType.LONG_TEXT]: 'string',
  [PropertyType.MULTI_SELECT]: 'string',
  [PropertyType.PHONE]: 'string',
  [PropertyType.SINGLE_LINE_TEXT]: 'string',
  [PropertyType.SINGLE_SELECT]: 'string',
  [PropertyType.URL]: 'string',
  [PropertyType.USER]: 'string',
  [PropertyType.CONTACT]: 'string',
  [PropertyType.COMPANY]: 'string',
  [PropertyType.COMPOSITE]: 'string',
  [PropertyType.PERSON]: 'string',
  [PropertyType.ENRICHMENT]: 'string',
};

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

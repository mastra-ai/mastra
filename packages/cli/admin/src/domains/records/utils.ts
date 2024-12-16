import { PropertyType, Property } from '@mastra/core';

import { IconName } from '@/types/icons';

export enum CheckboxValue {
  'Checked' = 'Checked',
  'Unchecked' = 'Unchecked',
}

export const sortablePropertyTypeSet = new Set([
  'CURRENCY',
  'SINGLE_LINE_TEXT',
  'ENRICHMENT',
  'COMPOSITE',
  'PERSON',
  'DATE',
  'SINGLE_SELECT',
]);

export const propertyTypeToOperatorMap: Record<PropertyType | 'RECORDS', FilterOperator[]> = {
  LONG_TEXT: ['CONTAINS', 'NOT_CONTAINS', 'EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  SINGLE_LINE_TEXT: ['CONTAINS', 'NOT_CONTAINS', 'EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  CHECKBOX: ['IS', 'IS_NOT', 'SET', 'NOT_SET'],
  DATE: [
    'EQUAL',
    'NOT_EQUAL',
    'GREATER_THAN',
    'LESS_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN_OR_EQUAL',
    'SET',
    'NOT_SET',
  ],
  USER: ['EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  BADGE_LIST: ['EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  CURRENCY: [
    'EQUAL',
    'NOT_EQUAL',
    'GREATER_THAN',
    'LESS_THAN',
    'GREATER_THAN_OR_EQUAL',
    'LESS_THAN_OR_EQUAL',
    'SET',
    'NOT_SET',
  ],
  URL: ['CONTAINS', 'NOT_CONTAINS', 'EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  PHONE: ['CONTAINS', 'NOT_CONTAINS', 'EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  CONTACT: ['EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  COMPANY: ['EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  SINGLE_SELECT: ['EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  MULTI_SELECT: ['EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  RECORDS: ['EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  PERSON: ['CONTAINS', 'NOT_CONTAINS', 'EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  COMPOSITE: ['CONTAINS', 'NOT_CONTAINS', 'EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  ENRICHMENT: ['CONTAINS', 'NOT_CONTAINS', 'EQUAL', 'NOT_EQUAL', 'SET', 'NOT_SET'],
  BOOLEAN: ['IS', 'IS_NOT', 'SET', 'NOT_SET'],
  FLOAT: [],
  JSON_ARRAY: [],
  JSON_OBJECT: [],
  NUMBER: [],
};

export const filterPropertyTypeMap = {
  LONG_TEXT: 'LONG_TEXT',
  SINGLE_LINE_TEXT: 'SINGLE_LINE_TEXT',
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  CHECKBOX: 'CHECKBOX',
  DATE: 'DATE',
  USER: 'USER',
  BADGE_LIST: 'BADGE_LIST',
  CURRENCY: 'CURRENCY',
  URL: 'URL',
  PHONE: 'PHONE',
  CONTACT: 'CONTACT',
  COMPANY: 'COMPANY',
  RECORDS: 'RECORDS',
  COMPOSITE: 'COMPOSITE',
  PERSON: 'PERSON',
  ENRICHMENT: 'ENRICHMENT',
  BOOLEAN: 'BOOLEAN',
  NUMBER: 'NUMBER',
  FLOAT: 'FLOAT',
  JSON_ARRAY: 'JSON_ARRAY',
  JSON_OBJECT: 'JSON_OBJECT',
} as const;

export const filterPropertyTypeToOperatorMap = {
  ...propertyTypeToOperatorMap,
  RECORDS: propertyTypeToOperatorMap.MULTI_SELECT,
} as const;

export const FilterPropertyTypeEnum = {
  TEXT: 'TEXT',
  MULTI_SELECT: 'MULTI_SELECT',
  SINGLE_SELECT: 'SINGLE_SELECT',
  DATE: 'DATE',
} as const;

export const FilterOperatorEnum = {
  IS: 'is',
  IS_NOT: 'is not',
  EQUAL: 'equal',
  NOT_EQUAL: 'not equal',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not contains',
  IS_ANY_OF: 'is any of',
  GREATER_THAN: 'greater than',
  LESS_THAN: 'less than',
  DOES_NOT_CONTAIN: 'does not contain',
  GREATER_THAN_OR_EQUAL: 'greater than or equal',
  LESS_THAN_OR_EQUAL: 'less than or equal',
  SET: 'is set',
  NOT_SET: 'is not set',
} as const;

export const FilterOpToValueMap: Record<FilterOperator, string> = {
  EQUAL: 'eq',
  NOT_EQUAL: 'not_eq',
  CONTAINS: 'contains',
  IS: 'eq',
  IS_NOT: 'not_eq',
  NOT_CONTAINS: 'not_contains',
  IS_ANY_OF: 'is_any_of',
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  DOES_NOT_CONTAIN: 'not_contains',
  GREATER_THAN_OR_EQUAL: 'gte',
  LESS_THAN_OR_EQUAL: 'lte',
  SET: 'set',
  NOT_SET: 'not_set',
} as const;

export const FilterOpToValueMapEnum = {
  EQUAL: 'EQUAL',
  NOT_EQUAL: 'NOT_EQUAL',
  CONTAINS: 'CONTAINS',
  IS: 'IS',
  IS_NOT: 'IS_NOT',
  NOT_CONTAINS: 'NOT_CONTAINS',
  IS_ANY_OF: 'IS_ANY_OF',
  GREATER_THAN: 'GREATER_THAN',
  LESS_THAN: 'LESS_THAN',
  DOES_NOT_CONTAIN: 'DOES_NOT_CONTAIN',
  GREATER_THAN_OR_EQUAL: 'GREATER_THAN_OR_EQUAL',
  LESS_THAN_OR_EQUAL: 'LESS_THAN_OR_EQUAL',
  SET: 'SET',
  NOT_SET: 'NOT_SET',
} as const;

export type FilterOperator = keyof typeof FilterOperatorEnum;

export const getFilterLabel = (op: FilterOperator, filter: { value: unknown }) => {
  if (op === 'IS_ANY_OF' || op === 'EQUAL' || op === 'NOT_EQUAL') {
    if (!Array.isArray(filter.value) || (filter.value as string[])?.length === 1) {
      return FilterOperatorEnum[op === 'IS_ANY_OF' || op === 'EQUAL' ? 'EQUAL' : 'NOT_EQUAL'];
    }

    return FilterOperatorEnum[op];
  }

  return FilterOperatorEnum[op];
};

export function getFilterOperator(operator: FilterOperator, resourceType?: any) {
  return FilterOpToValueMap[operator];
}

export const operatorToIconMap: Record<keyof typeof FilterOperatorEnum, IconName> = {
  IS: 'plus-icon',
  IS_NOT: 'ban',
  EQUAL: 'plus-icon',
  NOT_EQUAL: 'ban',
  CONTAINS: 'plus-icon',
  DOES_NOT_CONTAIN: 'ban',
  IS_ANY_OF: 'plus-icon',
  GREATER_THAN: 'plus-icon',
  GREATER_THAN_OR_EQUAL: 'plus-icon',
  LESS_THAN_OR_EQUAL: 'plus-icon',
  LESS_THAN: 'plus-icon',
  NOT_CONTAINS: 'ban',
  SET: 'plus-icon',
  NOT_SET: 'ban',
};

export const filterPropertyTypeToIconMap: Record<keyof typeof filterPropertyTypeMap, IconName> = {
  SINGLE_LINE_TEXT: 'text',
  DATE: 'calendar-empty',
} as Record<keyof typeof filterPropertyTypeMap, IconName>;

export const getFieldOperators = (
  fieldType: keyof typeof filterPropertyTypeMap,
  nextGen?: boolean,
): FilterOperator[] => {
  if (nextGen) {
    return filterPropertyTypeToOperatorMap[fieldType];
  }
  return filterPropertyTypeToOperatorMap[fieldType];
};

//not sure we want to do this yet
export const syncFieldsOnLocalWithRemote = (fieldsFromLocalStorage: Property[], fieldsFromBackend: Property[]) => {
  const localFieldsVisibleMap: Record<string, { visible: boolean; order: number }> = fieldsFromLocalStorage.reduce(
    (map, field) => ({ ...map, [field.name]: { visible: field.visible, order: field.order } }),
    {},
  );
  // For each field returned from backend, check if the stored cache already has a saved `visible` value for that field
  return fieldsFromBackend.map(field => ({
    ...field,
    visible:
      typeof localFieldsVisibleMap[field.name]?.visible === 'boolean'
        ? localFieldsVisibleMap[field.name]?.visible
        : field.visible,
    order:
      typeof localFieldsVisibleMap[field.name]?.order === 'number'
        ? localFieldsVisibleMap[field.name]?.order
        : field.order,
  }));
};

export const getFilterValue = <T>(val: T) => {
  if (typeof val === 'boolean') return val ? CheckboxValue.Checked : CheckboxValue.Unchecked;
  return val;
};

import { IconName } from '@/types/icons';

export enum FieldTypes {
  LONG_TEXT = 'LONG_TEXT',
  SINGLE_LINE_TEXT = 'SINGLE_LINE_TEXT',
  SINGLE_SELECT = 'SINGLE_SELECT',
  MULTI_SELECT = 'MULTI_SELECT',
  CHECKBOX = 'CHECKBOX',
  DATE = 'DATE',
  USER = 'USER',
  BADGE_LIST = 'BADGE_LIST',
  CURRENCY = 'CURRENCY',
  URL = 'URL',
  PHONE = 'PHONE',
  CONTACT = 'CONTACT',
  COMPANY = 'COMPANY',
  PERSON = 'PERSON',
  ENRICHMENT = 'ENRICHMENT',
  COMPOSITE = 'COMPOSITE',
}

export const fieldTypeToOperatorMap: Record<FieldTypes | 'RECORDS', FilterOperator[]> = {
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
};

export const filterFieldTypeToOperatorMap = {
  ...fieldTypeToOperatorMap,
  RECORDS: fieldTypeToOperatorMap.MULTI_SELECT,
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

export type FilterOperator = keyof typeof FilterOperatorEnum;

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

export const IntegrationFieldTypeEnum = {
  SINGLE_LINE_TEXT: 'SINGLE_LINE_TEXT',
  LONG_TEXT: 'LONG_TEXT',
  RICH_TEXT: 'RICH_TEXT',
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  CREATABLE_SELECT: 'CREATABLE_SELECT',
  CHECKBOX: 'CHECKBOX',
  DATE: 'DATE',
  USER: 'USER',
  BADGE_LIST: 'BADGE_LIST',
  CURRENCY: 'CURRENCY',
  URL: 'URL',
  PHONE: 'PHONE',
  CONTACT: 'CONTACT',
  COMPANY: 'COMPANY',
  COMPOSITE: 'COMPOSITE',
  PERSON: 'PERSON',
  ENRICHMENT: 'ENRICHMENT',
} as const;

export type IntegrationFieldType = keyof typeof IntegrationFieldTypeEnum;

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

export const WorkflowStatusEnum = {
  DRAFT: 'DRAFT',
  UNPUBLISHED: 'UNPUBLISHED',
  PUBLISHED: 'PUBLISHED',
} as const;

export interface BaseEntity {
  id: string;
  connectionId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date | null;
  lastSyncId: string | null;
}
export interface BaseRecord {
  id: string;
  entityId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date | null;
  externalId: string;
  entityType: string;
}

export enum PropertyType {
  'LONG_TEXT' = 'LONG_TEXT',
  'SINGLE_LINE_TEXT' = 'SINGLE_LINE_TEXT',
  'SINGLE_SELECT' = 'SINGLE_SELECT',
  'MULTI_SELECT' = 'MULTI_SELECT',
  'CHECKBOX' = 'CHECKBOX',
  'DATE' = 'DATE',
  'USER' = 'USER',
  'BADGE_LIST' = 'BADGE_LIST',
  'CURRENCY' = 'CURRENCY',
  'URL' = 'URL',
  'PHONE' = 'PHONE',
  'CONTACT' = 'CONTACT',
  'COMPANY' = 'COMPANY',
  'PERSON' = 'PERSON',
  'ENRICHMENT' = 'ENRICHMENT',
  'COMPOSITE' = 'COMPOSITE',
  'BOOLEAN' = 'BOOLEAN',
  'NUMBER' = 'NUMBER',
  'FLOAT' = 'FLOAT',
  'JSON_OBJECT' = 'JSON_OBJECT',
  'JSON_ARRAY' = 'JSON_ARRAY',
}

export enum FilterOperators {
  IS = 'is',
  EQUAL = 'eq',
  NOT_EQUAL = 'not_eq',
  CONTAINS = 'contains',
  IN = 'in',
  NOT_IN = 'not_in',
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN_OR_EQUAL = 'lte',
  OP = 'op',
  SET = 'set',
  NOT_SET = 'not_set',
}

export interface FilterCondition {
  field: string;
  operator: FilterOperators;
  value: any;
}

export interface SortOrder {
  field: string;
  direction: 'ASC' | 'DESC';
}
export interface QueryOptions {
  filters?: FilterCondition[];
  sort?: SortOrder[];
  limit?: number;
  offset?: number;
}

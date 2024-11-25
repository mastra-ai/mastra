import { z } from 'zod';
import { filterQuerySchema } from './schema';

export interface BaseConnection {
  id: string;
  name: string;
  issues: string[];
  syncConfig: Record<string, any> | null;
  connectionId: string;
  createdAt: Date;
  updatedAt: Date | null;
  lastSyncAt: Date | null;
  subscriptionId?: string | null;
  error?: string | null;
}

export interface BaseCredential {
  id: string;
  type: string;
  value: Record<string, any>;
  scope: string[];
  kId: string | null;
}

export type CredentialInput = Omit<BaseCredential, 'id' | 'kId'>;

export type CredentialWithConnection = {
  id: string;
  type: string;
  value: Record<string, any>;
  scope: string[];
  kId: string | null;
  connection: BaseConnection | null;
};

export interface BaseEntity {
  id: string;
  kId: string | null;
  type: string;
  lastSyncId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export type CredentialUpdateInput = Partial<{
  type: string;
  value: Record<string, any>;
  scope: string[];
}>;

export interface BaseRecord {
  id: string;
  entityId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date | null;
  externalId: string | null;
  entityType: string;
}

export interface BaseProperty {
  id?: string;
  name: string;
  displayName: string;
  visible: boolean;
  config: Record<string, any>;
  description: string | null;
  type: PropertyType;
  order: number;
  modifiable: boolean;
  entityId?: string;
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

export type FilterObject<T extends string | number | symbol> = Record<
  T,
  z.infer<typeof filterQuerySchema>
>;

export interface FilterClauseArgs<T extends string | number | symbol> {
  parentTableRef?: string;
  filters: FilterObject<T>;
  fields?: Pick<BaseProperty, 'name' | 'type'>[];
}

export interface SortClauseArgs {
  parentTableRef?: string;
  sort: string[];
  fields?: Pick<BaseProperty, 'name' | 'type'>[];
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

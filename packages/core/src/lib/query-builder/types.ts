import { Property } from '@prisma-app/client';
import { z } from 'zod';
import { filterQuerySchema } from './schema';

export type FilterObject<T extends string | number | symbol> = Record<T, z.infer<typeof filterQuerySchema>>;

export interface FilterClauseArgs<T extends string | number | symbol> {
  parentTableRef?: string;
  filters: FilterObject<T>;
  fields?: Pick<Property, 'name' | 'type'>[];
}

export interface SortClauseArgs {
  parentTableRef?: string;
  sort: string[];
  fields?: Pick<Property, 'name' | 'type'>[];
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

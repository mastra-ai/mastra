/**
 * Filter-bar state of the observability list pages, in the same encoding as their URLs:
 * flat tokens plus nested AND/OR groups (the JSON of the `filterGroup` URL param).
 */
import { z } from 'zod/v4';

/** Operator ids the filter bar writes to the URL (`<param>.op`). Omitted means the field default. */
export const FILTER_OPERATOR_IDS = [
  'is',
  'isNot',
  'in',
  'notIn',
  'exists',
  'notExists',
  'gt',
  'gte',
  'lt',
  'lte',
  'matches',
  'notMatches',
] as const;

export type FilterOperatorId = (typeof FILTER_OPERATOR_IDS)[number];

export const filterTokenSchema = z.object({
  fieldId: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]),
  operatorId: z.enum(FILTER_OPERATOR_IDS).optional(),
  /** Set on tokens inside a group: a group may hold several tokens on the same field. */
  id: z.string().optional(),
});

export type FilterToken = z.infer<typeof filterTokenSchema>;

export type FilterGroup = { id: string; logic: 'and' | 'or'; nodes: FilterNode[] };
export type FilterNode = FilterToken | FilterGroup;

export const filterGroupSchema: z.ZodType<FilterGroup> = z.object({
  id: z.string().min(1),
  logic: z.enum(['and', 'or']),
  get nodes() {
    return z.array(filterNodeSchema);
  },
});

export const filterNodeSchema: z.ZodType<FilterNode> = z.union([filterGroupSchema, filterTokenSchema]);

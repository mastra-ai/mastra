/**
 * Filter-bar state of the observability list pages, in the same encoding as their URLs:
 * flat tokens plus nested AND/OR groups (the JSON of the `filterGroup` URL param).
 */
import { z } from 'zod/v4';

// Plain `z.object` (not `.strict()`): unknown keys are dropped quietly.
export const filterTokenSchema = z.object({
  fieldId: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]),
  /**
   * The filter bar's operator id (`<param>.op` in the URL); omitted means the field default. Any id is
   * accepted so a page or dashboard can add operators without a schema change; the UI drops a token
   * whose operator it doesn't know.
   */
  operatorId: z.string().min(1).optional(),
  /** Set on tokens inside a group: a group may hold several tokens on the same field. */
  id: z.string().optional(),
});

export type FilterToken = z.infer<typeof filterTokenSchema>;

export type FilterGroup = { id: string; logic: 'and' | 'or'; nodes: FilterNode[] };
export type FilterNode = FilterToken | FilterGroup;

// The `filterGroup` URL reader drops a grouped token without an id, so a group's tokens need one.
const groupedFilterTokenSchema = filterTokenSchema.extend({ id: z.string().min(1) });

export const filterGroupSchema: z.ZodType<FilterGroup> = z.object({
  id: z.string().min(1),
  logic: z.enum(['and', 'or']),
  get nodes() {
    return z.array(z.union([filterGroupSchema, groupedFilterTokenSchema]));
  },
});

export const filterNodeSchema: z.ZodType<FilterNode> = z.union([filterGroupSchema, filterTokenSchema]);

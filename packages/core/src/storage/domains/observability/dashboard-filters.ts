import { z } from 'zod/v4';

/**
 * Filter-bar state as playground-ui stores it in the `filterGroup` URL param: a list of nodes, each
 * a token (one chip) or a nested and/or group. Dashboards use it for `defaults.filters` and
 * `drilldown.filters`; saved views use the same encoding.
 */

export const DASHBOARD_FILTER_LOGICS = ['and', 'or'] as const;

export const dashboardFilterTokenSchema = z
  .object({
    fieldId: z.string().min(1),
    value: z.union([z.string(), z.array(z.string())]),
    /** Defaults to `is` (equality / set membership) when omitted. */
    operatorId: z.string().min(1).optional(),
    /** Only set for tokens inside a group, which may hold several tokens on the same field. */
    id: z.string().min(1).optional(),
  })
  .strict();

export type DashboardFilterToken = z.infer<typeof dashboardFilterTokenSchema>;

export type DashboardFilterGroup = {
  id: string;
  logic: (typeof DASHBOARD_FILTER_LOGICS)[number];
  nodes: DashboardFilterNode[];
};

export type DashboardFilterNode = DashboardFilterToken | DashboardFilterGroup;

export const dashboardFilterGroupSchema: z.ZodType<DashboardFilterGroup, DashboardFilterGroup> = z
  .object({
    id: z.string().min(1),
    logic: z.enum(DASHBOARD_FILTER_LOGICS),
    get nodes() {
      return z.array(dashboardFilterNodeSchema);
    },
  })
  .strict();

export const dashboardFilterNodeSchema: z.ZodType<DashboardFilterNode, DashboardFilterNode> = z.union([
  dashboardFilterTokenSchema,
  dashboardFilterGroupSchema,
]);

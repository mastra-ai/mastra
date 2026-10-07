import { z } from "zod";

export const componentProperties = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[^\d<>]*$/,
      "Titles must be plain nonnumeric labels; numeric facts come from verified data.",
    )
    .refine(
      (value) => !/https?:/i.test(value),
      "Titles must be plain nonnumeric labels; numeric facts come from verified data.",
    )
    .describe(
      "Short plain label without digits, dates, URLs or markup. Values and periods are rendered from verified data.",
    ),
  x: z
    .string()
    .max(80)
    .optional()
    .describe(
      "Line/bar: exact grouping key. Heatmap: exact returned axes.x key. Otherwise absent/null.",
    ),
  y: z
    .string()
    .max(80)
    .optional()
    .describe(
      "Line/bar: numeric key with metric unit. Heatmap: exact returned axes.y key. Otherwise absent/null.",
    ),
  value: z
    .string()
    .max(80)
    .optional()
    .describe("Heatmaps only: exact matrix value axis key. Otherwise absent/null."),
  scenario: z.boolean().optional(),
  options: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});
export const componentSchema = z.strictObject({
  id: z
    .string()
    .min(1)
    .max(80)
    .refine(
      (id) => id !== "__proto__",
      "The __proto__ ID is reserved because saved card metadata cannot serialize it.",
    ),
  component: z.string().min(1).max(80),
  version: z.string().min(1).max(80),
  resultId: z.string().min(1),
  properties: componentProperties,
});
export const compositionSchema = z.strictObject({
  components: z.array(componentSchema).min(1).max(12),
});
export type ComponentBinding = z.infer<typeof componentSchema>;
export type Composition = z.infer<typeof compositionSchema>;
export interface ComponentDeclaration {
  id: string;
  version: string;
  description: string;
  enabled: boolean;
  kind: "metric" | "line" | "bar" | "table" | "comparison" | "heatmap";
  roles: readonly ("scalar" | "series" | "ranked" | "records" | "matrix")[];
  units: readonly string[];
  actions: readonly ("filter" | "drill" | "compare")[];
  properties: z.ZodType;
  defaults: { pageSize: number };
}

/** Serializable capabilities and renderers share these declarations. Extend in renderers.tsx. */
export const components: readonly ComponentDeclaration[] = [
  {
    id: "heatmap",
    kind: "heatmap",
    version: "1",
    description:
      "Customer retention or cumulative churn by first activation cohort and completed month age. Bind x, y and value exactly to verified matrix axes. Unobserved months remain blank.",
    enabled: true,
    roles: ["matrix"],
    units: ["percent"],
    actions: [],
    properties: componentProperties,
    defaults: { pageSize: 12 },
  },
  {
    id: "compact",
    kind: "metric",
    version: "1",
    description:
      "Compact verified KPI; options.emphasis chooses a validated verification label. Supports comparison.",
    enabled: false,
    roles: ["scalar", "series", "ranked", "records"],
    units: ["USD cents", "percent"],
    actions: ["compare"],
    properties: componentProperties.extend({
      options: z.strictObject({ emphasis: z.enum(["verified", "audited"]) }),
    }),
    defaults: { pageSize: 5 },
  },
  {
    id: "metric",
    kind: "metric",
    version: "1",
    description: "Verified scalar metric with definition and provenance.",
    enabled: true,
    roles: ["scalar", "series", "ranked", "records"],
    units: ["USD cents", "percent"],
    actions: ["filter", "compare"],
    properties: componentProperties,
    defaults: { pageSize: 10 },
  },
  {
    id: "line",
    kind: "line",
    version: "1",
    description:
      "Ordered monthly trend. Bind x to a date column and y to a numeric column with the metric unit.",
    enabled: true,
    roles: ["series"],
    units: ["USD cents", "percent"],
    actions: ["filter", "drill", "compare"],
    properties: componentProperties,
    defaults: { pageSize: 10 },
  },
  {
    id: "bar",
    kind: "bar",
    version: "1",
    description:
      "Ranked comparison with zero baseline. Bind x to categories and y to verified metric values.",
    enabled: true,
    roles: ["ranked"],
    units: ["USD cents", "percent"],
    actions: ["filter", "drill", "compare"],
    properties: componentProperties,
    defaults: { pageSize: 10 },
  },
  {
    id: "table",
    kind: "table",
    version: "1",
    description:
      "Accessible paginated verified records or grouped data; all columns remain available.",
    enabled: true,
    roles: ["scalar", "series", "ranked", "records", "matrix"],
    units: ["USD cents", "percent"],
    actions: ["filter", "drill", "compare"],
    properties: componentProperties,
    defaults: { pageSize: 10 },
  },
  {
    id: "comparison",
    kind: "comparison",
    version: "1",
    description: "A comparison panel for a second verified metric, preserving existing cards.",
    enabled: true,
    roles: ["scalar", "series", "ranked", "records"],
    units: ["USD cents", "percent"],
    actions: ["filter", "compare"],
    properties: componentProperties,
    defaults: { pageSize: 10 },
  },
];
export function validateCatalog(entries: readonly ComponentDeclaration[]) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (
      !entry.id ||
      !entry.version ||
      !entry.description ||
      ids.has(entry.id) ||
      !(entry.properties instanceof z.ZodType) ||
      !["metric", "line", "bar", "table", "comparison", "heatmap"].includes(entry.kind) ||
      !entry.roles.length ||
      !entry.units.length ||
      entry.units.some((unit) => typeof unit !== "string" || !unit.trim() || unit.length > 80) ||
      entry.roles.some(
        (role) => !["scalar", "series", "ranked", "records", "matrix"].includes(role),
      ) ||
      entry.actions.some((action) => !["filter", "drill", "compare"].includes(action)) ||
      !Number.isInteger(entry.defaults.pageSize) ||
      entry.defaults.pageSize < 1 ||
      entry.defaults.pageSize > 50
    )
      throw new Error(
        "Invalid or duplicate UI registration. Correct the component declaration before startup.",
      );
    ids.add(entry.id);
  }
  if (!entries.some((entry) => entry.enabled)) throw new Error("Enable at least one UI component.");
  return entries.filter((entry) => entry.enabled);
}

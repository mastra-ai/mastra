import { z } from "zod";
import { representation, representationSchema } from "../analysis/contracts.ts";
import { groupingColumn, SourceError } from "../../data-sources/source.ts";
import type { SourceDescriptor } from "../../data-sources/source.ts";
import type { VerifiedResult } from "../analysis/contracts.ts";

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
export const acceptedWorkspaceSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  components: z
    .array(
      componentSchema.extend({
        representation: representationSchema,
      }),
    )
    .max(24),
});
export type AcceptedWorkspace = z.infer<typeof acceptedWorkspaceSchema>;
export function acceptedWorkspace(
  revision: number,
  bindings: readonly ComponentBinding[],
  results: readonly VerifiedResult[],
  entries: readonly ComponentDeclaration[],
  descriptor: SourceDescriptor,
): AcceptedWorkspace {
  const components = bindings.map((binding) => {
    validateComposition({ components: [binding] }, results, entries);
    const result = results.find((result) => result.resultId === binding.resultId)!;
    return { ...binding, representation: representation(result, descriptor) };
  });
  const context = acceptedWorkspaceSchema.parse({ revision, components });
  if (Buffer.byteLength(JSON.stringify(context)) > 65536)
    throw new SourceError(
      "budget-exceeded",
      "Saved component context exceeds 64 KiB. Refine fewer cards before asking another question.",
    );
  return context;
}
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
export function agentCatalog(entries: readonly ComponentDeclaration[]) {
  return validateCatalog(entries).map(({ properties, ...entry }) => ({
    ...entry,
    properties: z.toJSONSchema(properties),
  }));
}
/** Constrain model choices to the actual verified result/renderer bindings for this step. */
export function compositionInputSchema(
  results: readonly VerifiedResult[],
  entries: readonly ComponentDeclaration[],
) {
  const catalog = validateCatalog(entries);
  const candidates = results.flatMap((result) =>
    catalog.flatMap((entry) => {
      const table = result.data.table;
      if (!entry.roles.includes(table?.kind ?? "scalar") || !entry.units.includes(result.data.unit))
        return [];
      const registered =
        entry.properties instanceof z.ZodObject ? entry.properties : componentProperties;
      let properties: z.ZodObject = z.strictObject(
        Object.fromEntries(
          Object.entries(registered.shape).filter(([key]) => !["x", "y", "value"].includes(key)),
        ),
      );
      if (entry.kind === "heatmap") {
        if (!table?.axes || table.kind !== "matrix") return [];
        properties = properties.safeExtend({
          x: z.literal(table.axes.x),
          y: z.literal(table.axes.y),
          value: z.literal(table.axes.value),
        });
      } else if (entry.kind === "line" || entry.kind === "bar") {
        const x = table && groupingColumn(table);
        const values = table?.columns.filter(
          (column) => column.type === "number" && column.unit === result.data.unit,
        );
        if (!x || !values?.length) return [];
        properties = properties.safeExtend({
          x: z.literal(x.key),
          y: z.enum(values.map((column) => column.key)),
        });
      }
      if (result.data.metric === "forecast")
        properties = properties.safeExtend({ scenario: z.literal(true) });
      properties = properties.refine((value) => entry.properties.safeParse(value).success, {
        message: "Properties must satisfy the registered view contract.",
      });
      return [
        componentSchema.extend({
          component: z.literal(entry.id),
          version: z.literal(entry.version),
          resultId: z.literal(result.resultId),
          properties,
        }),
      ];
    }),
  );
  if (!candidates.length)
    throw new SourceError("invalid-composition", "No enabled view supports the verified results.");
  return compositionSchema.extend({ components: z.array(z.union(candidates)).min(1).max(12) });
}
export function validateComposition(
  input: unknown,
  results: readonly VerifiedResult[],
  entries: readonly ComponentDeclaration[],
): Composition {
  const composition = compositionSchema.parse(input);
  const catalog = validateCatalog(entries);
  const ids = new Set<string>();
  for (const binding of composition.components) {
    const entry = catalog.find(
      (item) => item.id === binding.component && item.version === binding.version,
    );
    const result = results.find((item) => item.resultId === binding.resultId);
    if (!entry || !result || ids.has(binding.id))
      throw new Error("Unknown, disabled, duplicate or unverified component binding.");
    ids.add(binding.id);
    entry.properties.parse(binding.properties);
    const table = result.data.table;
    if (!entry.roles.includes(table?.kind ?? "scalar") || !entry.units.includes(result.data.unit))
      throw new Error("Component data role or unit is incompatible.");
    if (result.data.metric === "forecast" && binding.properties.scenario !== true)
      throw new Error("Forecast views must explicitly identify an illustrative scenario.");
    if (entry.kind === "heatmap") {
      if (
        !table ||
        table.kind !== "matrix" ||
        !table.axes ||
        table.omitted !== 0 ||
        binding.properties.x !== table.axes.x ||
        binding.properties.y !== table.axes.y ||
        binding.properties.value !== table.axes.value ||
        table.columns.find((column) => column.key === table.axes?.value)?.unit !== result.data.unit
      )
        throw new Error("Heatmaps must bind the complete verified matrix axes and metric unit.");
    } else if (binding.properties.value)
      throw new Error("A value axis is only supported by heatmap components.");
    if (entry.kind === "line" || entry.kind === "bar") {
      const x = table?.columns.find((column) => column.key === binding.properties.x);
      const y = table?.columns.find((column) => column.key === binding.properties.y);
      if (
        !table ||
        !x ||
        !y ||
        x.key !== groupingColumn(table)?.key ||
        y.type !== "number" ||
        y.unit !== result.data.unit ||
        x.type !== (entry.kind === "line" ? "date" : "category")
      )
        throw new Error("Charts must bind compatible typed columns and units.");
      if (
        entry.kind === "bar" &&
        table.rows.some(
          (row, index) => index > 0 && Number(row[y.key]) > Number(table.rows[index - 1]?.[y.key]),
        )
      )
        throw new Error("Ranked values must descend on the declared metric axis.");
      if (table.omitted !== 0)
        throw new Error("Charts cannot present incomplete groupings as complete.");
      if (
        entry.kind === "line" &&
        table.rows.some(
          (row, index) => index > 0 && String(row[x.key]) <= String(table.rows[index - 1]?.[x.key]),
        )
      )
        throw new Error("Time axes must be strictly ordered.");
    } else if (entry.kind !== "heatmap" && (binding.properties.x || binding.properties.y))
      throw new Error("Axis properties are only supported by chart components.");
  }
  return composition;
}

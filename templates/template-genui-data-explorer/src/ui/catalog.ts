import { z } from "zod";
import { representation, representationSchema } from "../analysis/contracts.ts";
import { groupingColumn, SourceError } from "../../data-sources/source.ts";
import type { VerifiedResult } from "../analysis/contracts.ts";

export const componentProperties = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(
      (value) => !/\d|https?:|[<>]/i.test(value),
      "Titles must be plain nonnumeric labels; numeric facts come from verified data.",
    ),
  x: z.string().max(80).optional(),
  y: z.string().max(80).optional(),
  scenario: z.boolean().optional(),
  options: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});
export const componentSchema = z.strictObject({
  id: z.string().min(1).max(80),
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
): AcceptedWorkspace {
  const components = bindings.map((binding) => {
    validateComposition({ components: [binding] }, results, entries);
    const result = results.find((result) => result.resultId === binding.resultId)!;
    return { ...binding, representation: representation(result) };
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
  kind: "metric" | "line" | "bar" | "table" | "comparison";
  roles: readonly ("scalar" | "series" | "ranked" | "records")[];
  units: readonly string[];
  actions: readonly ("filter" | "drill" | "compare")[];
  properties: z.ZodType;
  defaults: { pageSize: number };
}

/** Serializable capabilities and renderers share these declarations. Extend in renderers.tsx. */
export const components: readonly ComponentDeclaration[] = [
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
    roles: ["scalar", "series", "ranked", "records"],
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
      !["metric", "line", "bar", "table", "comparison"].includes(entry.kind) ||
      !entry.roles.length ||
      !entry.units.length ||
      entry.units.some((unit) => typeof unit !== "string" || !unit.trim() || unit.length > 80) ||
      entry.roles.some((role) => !["scalar", "series", "ranked", "records"].includes(role)) ||
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
    } else if (binding.properties.x || binding.properties.y)
      throw new Error("Axis properties are only supported by chart components.");
  }
  return composition;
}

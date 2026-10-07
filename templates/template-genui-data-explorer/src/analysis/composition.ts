import { z } from "zod";
import { representation, representationSchema } from "./contracts.ts";
import type { VerifiedResult } from "./contracts.ts";
import { groupingColumn, SourceError } from "../../data-sources/source.ts";
import type { SourceDescriptor } from "../../data-sources/source.ts";
import {
  componentSchema,
  componentProperties,
  compositionSchema,
  validateCatalog,
} from "../components/catalog.ts";

import type { ComponentBinding, ComponentDeclaration, Composition } from "../components/catalog.ts";

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

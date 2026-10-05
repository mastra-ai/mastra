import { it, expect } from "vitest";
import { verifiedResultSchema } from "../../src/analysis/contracts.ts";
import {
  components,
  validateCatalog,
  validateComposition,
  acceptedWorkspace,
} from "../../src/ui/catalog.ts";
import { resultTableSchema, tableColumnSchema } from "../../data-sources/source.ts";
import { ReferenceSource } from "../fixtures/reference-source.ts";

it("catalog schemas reject misleading axes, units, forecasts and undeclared display options", async () => {
  const data = await new ReferenceSource().execute({
    metric: "bookings",
    period: { start: "2025-03-01", end: "2025-04-01" },
  });
  data.table = {
    kind: "series",
    omitted: 0,
    columns: [
      { key: "label", label: "Month", type: "date" },
      { key: "value", label: "bookings", type: "number", unit: "USD cents" },
    ],
    rows: [{ label: "2025-03-01", value: 12000 }],
  };
  const result = verifiedResultSchema.parse({
    resultId: "verified",
    queryId: "query",
    workflowId: "grounded-analysis",
    workflowRunId: "run",
    requestId: "request",
    workspaceId: "workspace",
    threadId: "thread",
    baseRevision: 0,
    traceId: "trace",
    data,
    checks: ["schema", "identity", "versions", "request", "unit", "completeness", "calculation"],
    elapsedMs: 1,
    explanation: "Verified reference bookings.",
  });
  const binding = {
    id: "trend",
    component: "line",
    version: "1",
    resultId: "verified",
    properties: { title: "Monthly bookings", x: "label", y: "value" },
  };
  expect(
    validateComposition({ components: [binding] }, [result], components).components,
  ).toHaveLength(1);
  expect(() =>
    validateComposition(
      { components: [{ ...binding, resultId: "invented" }] },
      [result],
      components,
    ),
  ).toThrow("unverified");
  expect(() =>
    validateComposition(
      { components: [{ ...binding, properties: { ...binding.properties, x: "value" } }] },
      [result],
      components,
    ),
  ).toThrow("typed columns");
  expect(() =>
    validateComposition({ components: [{ ...binding, component: "bar" }] }, [result], components),
  ).toThrow("role");
  const wrongUnit = structuredClone(result);
  wrongUnit.data.table!.columns[1]!.unit = "percent";
  expect(() => validateComposition({ components: [binding] }, [wrongUnit], components)).toThrow(
    "units",
  );
  const forecast = structuredClone(result);
  forecast.data.metric = "forecast";
  expect(() => validateComposition({ components: [binding] }, [forecast], components)).toThrow(
    "scenario",
  );
  expect(() =>
    validateComposition(
      {
        components: [
          { ...binding, properties: { ...binding.properties, title: "Bookings 999999" } },
        ],
      },
      [result],
      components,
    ),
  ).toThrow("nonnumeric");
  expect(() => validateCatalog([...components, components[0]!])).toThrow("duplicate");
  const disabled = components.map((entry) => ({
    ...entry,
    enabled: entry.id !== "line" && entry.enabled,
  }));
  expect(() => validateComposition({ components: [binding] }, [result], disabled)).toThrow(
    "disabled",
  );
  const compact = components.find((entry) => entry.id === "compact")!;
  const catalog = [
    ...components.filter((entry) => entry.id !== "compact"),
    { ...compact, enabled: true },
  ];
  expect(() =>
    validateComposition(
      {
        components: [
          {
            id: "custom",
            component: "compact",
            version: "1",
            resultId: "verified",
            properties: { title: "Compact KPI", options: { emphasis: "fictional" } },
          },
        ],
      },
      [result],
      catalog,
    ),
  ).toThrow();
  const customUnit = structuredClone(result);
  customUnit.data.unit = "items";
  customUnit.data.table!.columns[1]!.unit = "items";
  const itemMetric = { ...components.find((entry) => entry.id === "metric")!, units: ["items"] };
  expect(
    validateComposition(
      {
        components: [{ ...binding, component: "metric", properties: { title: "Completed items" } }],
      },
      [customUnit],
      [itemMetric],
    ).components,
  ).toHaveLength(1);
  const savedCustom = {
    id: "custom-saved",
    component: "compact",
    version: "1",
    resultId: result.resultId,
    properties: { title: "Compact KPI", options: { emphasis: "audited" } },
  };
  expect(
    acceptedWorkspace(5, [savedCustom], [result], catalog).components[0]?.properties.options,
  ).toEqual({ emphasis: "audited" });
  const bindings = Array.from({ length: 24 }, (_, index) => ({ ...binding, id: `saved-${index}` }));
  const context = acceptedWorkspace(5, bindings, [result], components);
  expect(context.components).toHaveLength(24);
  expect(context.components[0]?.representation).toMatchObject({
    role: "series",
    grouping: "label",
    unit: "USD cents",
  });
  expect(context.components[0]?.representation).not.toHaveProperty("rows");
  expect(() =>
    acceptedWorkspace(5, [...bindings, { ...binding, id: "overflow" }], [result], components),
  ).toThrow();
  const detailed = structuredClone(result);
  if (!detailed.data.table) throw new Error("Expected grouped fixture.");
  const extra = Array.from({ length: 48 }, (_, index) =>
    tableColumnSchema.parse({
      key: `amount-${index}`,
      label: "Detailed verified monetary column ".repeat(3).slice(0, 100),
      type: "number",
      unit: "USD cents",
    }),
  );
  detailed.data.table.columns.push(...extra);
  for (const row of detailed.data.table.rows) for (const column of extra) row[column.key] = 0;
  expect(() =>
    acceptedWorkspace(5, bindings, [verifiedResultSchema.parse(detailed)], components),
  ).toThrow("64 KiB");
  const renamed = structuredClone(result.data.table);
  if (!renamed) throw new Error("Expected grouping fixture.");
  renamed.columns[0]!.key = "calendarTick";
  renamed.rows = [{ calendarTick: "2025-03-01", value: 12000 }];
  expect(resultTableSchema.parse(renamed).columns[0]?.key).toBe("calendarTick");
  const ambiguous = {
    ...renamed,
    columns: [...renamed.columns, { key: "otherDate", label: "Other date", type: "date" }],
    rows: [{ ...renamed.rows[0], otherDate: "2025-03-01" }],
  };
  expect(resultTableSchema.safeParse(ambiguous).success).toBe(false);
  expect(resultTableSchema.parse({ ...ambiguous, grouping: "calendarTick" }).grouping).toBe(
    "calendarTick",
  );
});

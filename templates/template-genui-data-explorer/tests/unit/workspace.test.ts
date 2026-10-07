import { it, expect } from "vitest";
import { verifiedResultSchema } from "../../src/analysis/contracts.ts";
import { components, validateCatalog, componentSchema } from "../../src/components/catalog.ts";
import { validateComposition, acceptedWorkspace } from "../../src/analysis/composition.ts";
import {
  resultTableSchema,
  tableColumnSchema,
  sourceDescriptorSchema,
} from "../../data-sources/source.ts";
import { ReferenceSource } from "../fixtures/reference-source.ts";
import {
  formatValue,
  formatDate,
  humanAnswer,
  viewTitle,
  metricName,
} from "../../src/components/format.ts";

it("human summaries display currency and inclusive calendar dates without technical operands", async () => {
  const data = await new ReferenceSource().execute({
    metric: "bookings",
    period: { start: "2025-03-01", end: "2025-04-01" },
  });
  expect(humanAnswer(data)).toBe("Bookings: $120.00 · Mar 1, 2025 – Mar 31, 2025.");
  expect(formatValue(63976000, "USD cents")).toBe("$639,760.00");
  expect(formatValue(25.123, "percent")).toBe("25.12%");
  expect(formatValue("Synthetic account 12")).toBe("Example account 12");
  expect(formatValue("Synthetic representative 2")).toBe("Example representative 2");
  expect(formatValue("Customer account 12")).toBe("Customer account 12");
  expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  expect(viewTitle({ ...data, metric: "customerChurn" })).toBe("Customer churn");
  expect(metricName("constructor")).toBe("constructor");
  expect(
    viewTitle({ ...data, metric: "constructor", request: { ...data.request, groupBy: "month" } }),
  ).toBe("Monthly constructor");
});

it("catalog schemas reject misleading axes, units, forecasts and undeclared display options", async () => {
  const descriptor = new ReferenceSource().describe();
  expect(
    componentSchema.safeParse({
      id: "__proto__",
      component: "table",
      version: "1",
      resultId: "verified",
      properties: { title: "Bookings" },
    }).success,
  ).toBe(false);
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
  const monthlyOnly = verifiedResultSchema.parse({
    ...result,
    data: {
      ...data,
      metric: "customerChurn",
      request: { ...data.request, metric: "customerChurn", groupBy: "month" },
      status: "unavailable",
      value: null,
      numerator: 0,
      denominator: 0,
      reason: "No opening customers.",
      unit: "percent",
      table: {
        kind: "series",
        grouping: "month",
        omitted: 0,
        columns: [
          { key: "month", label: "Month", type: "date" },
          { key: "value", label: "Churn", type: "number", unit: "percent" },
          { key: "numerator", label: "Churned", type: "number" },
          { key: "denominator", label: "Starting", type: "number" },
        ],
        rows: [{ month: "2025-03-01", value: 0, numerator: 0, denominator: 1 }],
      },
    },
  });
  const monthlyDescriptor = sourceDescriptorSchema.parse({
    ...descriptor,
    capabilities: [
      {
        metric: "customerChurn",
        description: "Opening population per month.",
        unit: "percent",
        calculation: "percentage",
        groupedCalculation: "independent",
        fields: ["period", "groupBy"],
        filters: [],
        groupings: [{ field: "month", kind: "series" }],
      },
    ],
  });
  const monthlyContext = acceptedWorkspace(
    1,
    [
      {
        id: "monthly-only",
        component: "line",
        version: "1",
        resultId: monthlyOnly.resultId,
        properties: { title: "Monthly churn", x: "month", y: "value" },
      },
    ],
    [monthlyOnly],
    components,
    monthlyDescriptor,
  );
  expect(monthlyContext.components[0]?.representation.status).toBe("available");
  expect(monthlyOnly.data.status).toBe("unavailable");
  expect(humanAnswer(monthlyOnly.data)).toContain("Monthly customer churn is available");
  const matrixResult = verifiedResultSchema.parse({
    ...monthlyOnly,
    data: {
      ...monthlyOnly.data,
      status: "available",
      value: 50,
      numerator: 1,
      denominator: 2,
      reason: null,
      request: { ...monthlyOnly.data.request, groupBy: "cohort" },
      table: {
        kind: "matrix",
        omitted: 0,
        axes: { x: "age", y: "cohort", value: "share" },
        columns: [
          { key: "age", label: "Age", type: "number" },
          { key: "cohort", label: "Cohort", type: "date" },
          { key: "share", label: "Share", type: "number", unit: "percent" },
          { key: "numerator", label: "Numerator", type: "number" },
          { key: "denominator", label: "Denominator", type: "number" },
        ],
        rows: [{ age: 0, cohort: "2025-03-01", share: 50, numerator: 1, denominator: 2 }],
      },
    },
  });
  const matrixBinding = {
    id: "matrix",
    component: "heatmap",
    version: "1",
    resultId: matrixResult.resultId,
    properties: { title: "Cohort", x: "age", y: "cohort", value: "share" },
  };
  expect(
    validateComposition({ components: [matrixBinding] }, [matrixResult], components).components,
  ).toHaveLength(1);
  expect(() =>
    validateComposition(
      {
        components: [
          { ...matrixBinding, properties: { ...matrixBinding.properties, value: "numerator" } },
        ],
      },
      [matrixResult],
      components,
    ),
  ).toThrow();
  const duplicateCell = structuredClone(matrixResult.data.table)!;
  duplicateCell.rows.push({ ...duplicateCell.rows[0]! });
  expect(resultTableSchema.safeParse(duplicateCell).success).toBe(false);
  const negativeAge = structuredClone(matrixResult.data.table)!;
  negativeAge.rows[0]!.age = -1;
  expect(resultTableSchema.safeParse(negativeAge).success).toBe(false);
  expect(
    resultTableSchema.safeParse({
      ...matrixResult.data.table,
      axes: { x: "share", y: "cohort", value: "share" },
    }).success,
  ).toBe(false);
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
    acceptedWorkspace(5, [savedCustom], [result], catalog, descriptor).components[0]?.properties
      .options,
  ).toEqual({ emphasis: "audited" });
  const bindings = Array.from({ length: 24 }, (_, index) => ({ ...binding, id: `saved-${index}` }));
  const context = acceptedWorkspace(5, bindings, [result], components, descriptor);
  expect(context.components).toHaveLength(24);
  expect(context.components[0]?.representation).toMatchObject({
    role: "series",
    grouping: "label",
    unit: "USD cents",
  });
  expect(context.components[0]?.representation).not.toHaveProperty("rows");
  expect(() =>
    acceptedWorkspace(
      5,
      [...bindings, { ...binding, id: "overflow" }],
      [result],
      components,
      descriptor,
    ),
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
    acceptedWorkspace(5, bindings, [verifiedResultSchema.parse(detailed)], components, descriptor),
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

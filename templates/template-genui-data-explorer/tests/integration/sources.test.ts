import { mkdtemp, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { openDataSource } from "../../data-sources/registry.ts";
import { inspectSource } from "../../data-sources/inspect.ts";
import { SalesSource } from "../../data-sources/sales/source.ts";
import { prepareSource, sources } from "../../scripts/sources.ts";
import { ReferenceSource } from "../fixtures/reference-source.ts";
import { referenceFixture, cohortFixture } from "../fixtures/reference.ts";
import {
  analysisRequestSchema,
  analysisToolSchema,
  hasAvailableData,
} from "../../data-sources/source.ts";
import { verifySourceResult } from "../../src/analysis/verification.ts";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function scratch() {
  const directory = await mkdtemp(join(tmpdir(), "sales-sources-"));
  directories.push(directory);
  return directory;
}

it("monthly subscription series verify independent rows without changing the whole-period rate", async () => {
  const path = join(await scratch(), "monthly.sqlite");
  const fixture = referenceFixture(path);
  fixture.db.close();
  const source = new SalesSource(path);
  const period = { start: "2025-01-01", end: "2025-04-01" };
  try {
    for (const metric of ["customerChurn", "revenueChurn"]) {
      const request = { metric, period, groupBy: "month" };
      const actual = await source.execute(request);
      expect(actual.table?.rows).toHaveLength(3);
      expect(() =>
        verifySourceResult(actual, request, source.describe(), 1048576, 1000),
      ).not.toThrow();
      const repeated = structuredClone(actual);
      repeated.table!.rows.push({ ...repeated.table!.rows[0]! });
      expect(() => verifySourceResult(repeated, request, source.describe(), 1048576, 1000)).toThrow(
        "unique ordered dates",
      );
      const noRead = structuredClone(actual);
      noRead.provenance.operations = [];
      expect(() => verifySourceResult(noRead, request, source.describe(), 1048576, 1000)).toThrow();
      const forged = structuredClone(actual);
      forged.table!.rows[0]!.value = 999;
      expect(() => verifySourceResult(forged, request, source.describe(), 1048576, 1000)).toThrow(
        "Grouped calculation failed",
      );
    }
    const actual = await source.execute({ metric: "customerChurn", period, groupBy: "month" });
    expect(actual).toMatchObject({ numerator: 2, denominator: 3, value: (2 / 3) * 100 });
    expect(hasAvailableData(actual, source.describe())).toBe(true);
    await expect(
      source.execute({
        metric: "customerChurn",
        period: { start: "2025-01-02", end: period.end },
        groupBy: "month",
      }),
    ).rejects.toThrow("complete calendar months");
  } finally {
    source.close();
  }
});

it("absent optional fields preserve source semantics without allowing unknown or unsupported values", async () => {
  const path = join(await scratch(), "optional-fields.sqlite");
  referenceFixture(path).db.close();
  const source = new SalesSource(path);
  try {
    for (const example of source.describe().examples) {
      const request = {
        period: undefined,
        baseline: undefined,
        horizon: undefined,
        asOf: undefined,
        filters: undefined,
        groupBy: undefined,
        records: undefined,
        ...example.request,
      };
      expect(analysisRequestSchema.parse(request)).toStrictEqual(example.request);
      const actual = await source.execute(request);
      const expected = await source.execute(example.request);
      expect(actual).toEqual(expected);
    }
    const request = { metric: "bookings", period: { start: "2025-03-01", end: "2025-04-01" } };
    expect(analysisRequestSchema.safeParse({ ...request, sql: undefined }).success).toBe(false);
    expect(analysisRequestSchema.safeParse({ ...request, period: null }).success).toBe(false);
    await expect(source.execute({ ...request, asOf: "2025-03-01" })).rejects.toThrow();
    await expect(
      source.execute({ metric: "customerChurn", period: request.period, filters: {} }),
    ).rejects.toThrow();
    expect((await source.execute({ ...request, records: false })).request.records).toBe(false);
    const tool = analysisToolSchema(source.describe());
    expect(
      tool.parse({ ...request, filters: { segment: "SMB", region: undefined } }),
    ).toStrictEqual({
      ...request,
      filters: { segment: "SMB" },
    });
    expect(tool.safeParse({ ...request, filters: { hidden: "value" } }).success).toBe(false);
    expect(tool.safeParse({ ...request, records: false }).success).toBe(false);
    expect(tool.parse({ ...request, records: true }).records).toBe(true);
    const reference = new ReferenceSource();
    const descriptor = reference.describe();
    const customTool = analysisToolSchema({
      ...descriptor,
      capabilities: descriptor.capabilities.map((entry) => ({ ...entry, filters: ["team"] })),
    });
    expect(
      customTool.parse({ metric: descriptor.capabilities[0]!.metric, filters: { team: "blue" } })
        .filters,
    ).toStrictEqual({ team: "blue" });
    expect(
      customTool.safeParse({
        metric: descriptor.capabilities[0]!.metric,
        filters: { segment: "SMB" },
      }).success,
    ).toBe(false);
  } finally {
    await source.close();
  }
});

it("substitutes a non-SQL source without opening or preparing unselected or disabled Sales", async () => {
  const directory = await scratch();
  const path = join(directory, "unopened-sales.sqlite");
  for (const enabled of [true, false]) {
    const reference = new ReferenceSource();
    const prepare = vi.fn(async () => {});
    const salesOpen = vi.fn(sources[0]!.open);
    const salesPrepare = vi.fn(sources[0]!.prepare);
    const registrations = [
      { ...sources[0]!, enabled, open: salesOpen, prepare: salesPrepare },
      { id: "reference", open: () => reference, prepare },
    ];
    await prepareSource(registrations, "reference", { path });
    const report = await inspectSource(await openDataSource(registrations, "reference", { path }));
    expect(report.source.id).toBe("reference");
    expect(report.results.map((entry) => entry.result.value)).toEqual([12000, 50]);
    expect(report.results[0]?.result.provenance.sourceId).toBe("reference");
    expect(prepare).toHaveBeenCalledOnce();
    expect(salesOpen).not.toHaveBeenCalled();
    expect(salesPrepare).not.toHaveBeenCalled();
    expect(reference.closed).toBe(true);
    await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    if (!enabled) {
      await expect(prepareSource(registrations, "sales", { path })).rejects.toThrow("unavailable");
      await expect(openDataSource(registrations, "sales", { path })).rejects.toThrow("unavailable");
      await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    }
  }
});

it("rejects missing and duplicate registrations without silent fallback", async () => {
  const open = vi.fn(() => new ReferenceSource());
  const prepare = vi.fn(async () => {});
  const registrations = [{ id: "reference", open, prepare }];
  await expect(openDataSource(registrations, "removed")).rejects.toThrow("no fallback");
  await expect(openDataSource([], "reference")).rejects.toThrow("unavailable");
  await expect(prepareSource(registrations, "removed")).rejects.toThrow("no fallback");
  await expect(openDataSource([...registrations, ...registrations], "reference")).rejects.toThrow(
    "unique",
  );
  expect(open).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
});

it("awaits resource release after execution failure or source identity mismatch", async () => {
  const failing = new ReferenceSource(true);
  await expect(
    inspectSource(await openDataSource([{ id: "reference", open: () => failing }], "reference")),
  ).rejects.toThrow("Reference source unavailable");
  expect(failing.closed).toBe(true);
  const mismatched = new ReferenceSource();
  await expect(openDataSource([{ id: "wrong", open: () => mismatched }], "wrong")).rejects.toThrow(
    "registered ID",
  );
  expect(mismatched.closed).toBe(true);
});

it("Sales adapter preserves independent values, provenance and historical request filters", async () => {
  const directory = await scratch();
  const path = join(directory, "reference-sales.sqlite");
  const fixture = referenceFixture(path);
  fixture.db.close();
  const sales = await openDataSource([{ id: "sales", open: () => new SalesSource(path) }], "sales");
  const reference = new ReferenceSource();
  try {
    for (const example of reference.describe().examples) {
      const actual = await sales.execute(example.request);
      const expected = await reference.execute(example.request);
      expect(actual).toMatchObject({
        status: expected.status,
        value: expected.value,
        unit: expected.unit,
        numerator: expected.numerator,
        denominator: expected.denominator,
        period: expected.period,
      });
      expect(actual.provenance).toMatchObject({
        sourceId: "sales",
        metricVersion: "saas-v1",
        complete: true,
      });
    }
    const request = {
      metric: "forecast",
      asOf: "2025-02-01",
      horizon: { start: "2025-03-01", end: "2025-04-01" },
      filters: { ownerId: 1, segment: "SMB" },
    };
    const result = await sales.execute(request);
    expect(result).toMatchObject({
      value: 11000,
      request,
      provenance: { asOf: "2026-09-30", sourceId: "sales" },
    });
    request.filters.ownerId = 2;
    expect(result.request.filters?.ownerId).toBe(1);
    await expect(sales.execute({ metric: "unknown" })).rejects.toThrow("Unsupported Sales metric");
    await expect(
      sales.execute({
        metric: "customerChurn",
        period: { start: "2025-01-01", end: "2025-02-01" },
        filters: {},
      }),
    ).rejects.toThrow("Unsupported fields");
    await expect(
      sales.execute({
        metric: "bookings",
        period: { start: "2025-03-01", end: "2025-04-01" },
        asOf: "2025-03-01",
      }),
    ).rejects.toThrow("Unsupported fields");
    await expect(
      sales.execute({ metric: "pipeline", asOf: "2025-02-01", filters: { segment: true } }),
    ).rejects.toThrow("Invalid or unsupported");
    await expect(sales.execute({ metric: "conversion" })).rejects.toThrow("period requires");
  } finally {
    await sales.close();
    await reference.close();
  }
});

it("cohort matrices reconcile period-end populations and reject missing, future or inconsistent cells", async () => {
  const path = join(await scratch(), "cohorts.sqlite");
  cohortFixture(path).db.close();
  const source = new SalesSource(path);
  const period = { start: "2025-01-01", end: "2025-04-01" };
  try {
    for (const metric of ["cohortRetention", "cohortChurn"]) {
      const request = { metric, period, groupBy: "cohort" };
      const actual = await source.execute(request);
      expect(actual).toMatchObject({
        numerator: metric === "cohortRetention" ? 2 : 3,
        denominator: 5,
        table: { kind: "matrix", axes: { x: "age", y: "cohort", value: "value" } },
      });
      expect(actual.table?.rows).toHaveLength(6);
      expect(() =>
        verifySourceResult(actual, request, source.describe(), 1048576, 1000),
      ).not.toThrow();
      for (const defect of [
        "missing",
        "future",
        "population",
        "value",
        "date",
        "order",
        "duplicate",
        "total",
        "incomplete",
      ]) {
        const forged = structuredClone(actual);
        const rows = forged.table!.rows;
        if (defect === "missing") rows.splice(1, 1);
        if (defect === "future") rows[5]!.age = 1;
        if (defect === "population") rows[1]!.denominator = 4;
        if (defect === "value") rows[1]!.value = 999;
        if (defect === "date") rows[0]!.cohort = "2024-12-01";
        if (defect === "order") rows.reverse();
        if (defect === "duplicate") rows.push({ ...rows[0]! });
        if (defect === "total") {
          forged.numerator = 1;
          forged.value = 20;
        }
        if (defect === "incomplete") forged.table!.omitted = 1;
        expect(
          () => verifySourceResult(forged, request, source.describe(), 1048576, 1000),
          defect,
        ).toThrow();
      }
      // Value column names remain source-owned instead of being fixed in the renderer/workflow.
      const aliased = structuredClone(actual);
      aliased.table!.axes!.value = "share";
      aliased.table!.columns = aliased.table!.columns.map((column) =>
        column.key === "value" ? { ...column, key: "share" } : column,
      );
      aliased.table!.rows = aliased.table!.rows.map(({ value, ...row }) => ({
        ...row,
        share: value ?? 0,
      }));
      expect(() =>
        verifySourceResult(aliased, request, source.describe(), 1048576, 1000),
      ).not.toThrow();
    }
    await expect(
      source.execute({ metric: "cohortRetention", period, groupBy: "month" }),
    ).rejects.toThrow("grouping");
    await expect(
      source.execute({ metric: "cohortChurn", period, filters: { segment: "SMB" } }),
    ).rejects.toThrow("Unsupported fields");
    const uncovered = await source.execute({
      metric: "cohortRetention",
      period: { start: "2020-01-01", end: "2020-04-01" },
      groupBy: "cohort",
    });
    expect(uncovered.status).toBe("unavailable");
    expect(uncovered).not.toHaveProperty("table");
  } finally {
    source.close();
  }
});

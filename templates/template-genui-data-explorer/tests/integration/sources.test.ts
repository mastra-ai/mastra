import { mkdtemp, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { openDataSource } from "../../data-sources/registry.ts";
import { inspectSource } from "../../data-sources/inspect.ts";
import { SalesSource } from "../../data-sources/sales/source.ts";
import { prepareSource, sources } from "../../scripts/sources.ts";
import { ReferenceSource } from "../fixtures/reference-source.ts";
import { referenceFixture } from "../fixtures/reference.ts";
import { analysisRequestSchema, analysisToolSchema } from "../../data-sources/source.ts";

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

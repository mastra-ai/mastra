import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { initializeSales } from "../../scripts/initialize.ts";
import { openSales } from "../../data-sources/sales/database.ts";
import {
  bookings,
  conversion,
  pipeline,
  forecast,
  salesGrowth,
} from "../../data-sources/sales/opportunity-metrics.ts";
import { customerChurn, revenueChurn } from "../../data-sources/sales/churn-metrics.ts";
import { createMetadata } from "../../scripts/generate.ts";
import { samplePrompts, shiftMonths } from "../../data-sources/sales/calendar.ts";
import { referenceFixture } from "../fixtures/reference.ts";
import { setTimeout as delay } from "node:timers/promises";

const execute = promisify(execFile);
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function scratch() {
  const directory = await mkdtemp(join(tmpdir(), "sales-data-"));
  directories.push(directory);
  return directory;
}
const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");

it("seeded_sales_matches_reference_metrics", async () => {
  const directory = await scratch();
  const options = { now: () => new Date("2026-10-04T12:00:00Z"), seed: 1729 };
  const first = join(directory, "a.sqlite");
  const second = join(directory, "b.sqlite");
  expect(await initializeSales(first, options)).toEqual(await initializeSales(second, options));
  const left = openSales(first);
  const right = openSales(second);
  try {
    for (const table of [
      "months",
      "accounts",
      "representatives",
      "opportunities",
      "opportunity_history",
      "subscriptions",
      "subscription_history",
      "dataset_metadata",
    ]) {
      expect(left.db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()).toEqual(
        right.db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all(),
      );
    }
    expect(left.db.prepare("SELECT COUNT(*) AS n FROM months").get()?.n).toBe(24);
    expect(left.db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(
      left.db
        .prepare(
          "SELECT COUNT(*) AS n FROM opportunity_history h JOIN opportunities o ON o.id=h.opportunity_id WHERE h.effective_at < o.created_at",
        )
        .get()?.n,
    ).toBe(0);
    expect(
      left.db
        .prepare("SELECT COUNT(*) AS n FROM subscription_history WHERE effective_at < ?")
        .get(left.metadata.coverage.start)?.n,
    ).toBeGreaterThan(0);
    // Plain fact inspection is independent of the production metric queries.
    const facts = left.db.prepare("SELECT * FROM opportunity_history").all();
    const period = {
      start: shiftMonths(left.metadata.coverage.end, -12),
      end: left.metadata.coverage.end,
    };
    const closes = facts.filter(
      (row) =>
        String(row.effective_at) >= period.start &&
        String(row.effective_at) < period.end &&
        ["won", "lost"].includes(String(row.stage)),
    );
    const won = closes.filter((row) => row.stage === "won");
    const total = won.reduce((sum, row) => sum + Number(row.value_cents), 0);
    expect(bookings(left.db, left.metadata, period).value).toBe(total);
    expect(conversion(left.db, left.metadata, period).value).toBe(
      (won.length / closes.length) * 100,
    );
    expect(won.length).toBe(96);
    expect(closes.length).toBe(156);
    for (const month of left.db.prepare("SELECT start,end FROM months").all()) {
      expect(
        bookings(left.db, left.metadata, { start: String(month.start), end: String(month.end) })
          .value,
      ).toBeGreaterThan(0);
    }
    expect(samplePrompts(left.metadata)[0]).toContain("2025-10-01");
    expect(() => left.db.exec("DELETE FROM accounts")).toThrow();
    const later = createMetadata(new Date("2036-08-01T00:00:00Z"), 1729);
    expect(samplePrompts(later)[0]).toContain("2035-08-01");
    expect(bookings(left.db, later, { start: "2025-01-01", end: "2026-01-01" }).status).toBe(
      "unavailable",
    );
  } finally {
    left.db.close();
    right.db.close();
  }
});

it("seed_retry_preserves_complete_dataset", async () => {
  const directory = await scratch();
  const path = join(directory, "sales.sqlite");
  const options = { now: () => new Date("2026-10-04T00:00:00Z"), seed: 7 };
  const metadata = await initializeSales(path, options);
  const before = hash(await readFile(path));
  expect(
    await initializeSales(path, {
      now: () => {
        throw new Error("Saved data must not consult the wall clock");
      },
      seed: 99,
    }),
  ).toEqual(metadata);
  expect(hash(await readFile(path))).toBe(before);
  const interruptedPath = join(directory, "retry.sqlite");
  const abandoned = `${interruptedPath}.crashed.pending`;
  const partial = new DatabaseSync(abandoned);
  partial.exec("CREATE TABLE incomplete (id INTEGER)");
  partial.close();
  expect((await initializeSales(interruptedPath, options)).complete).toBe(true);
  expect((await readFile(abandoned)).length).toBeGreaterThan(0);
  const incomplete = join(directory, "incomplete.sqlite");
  const incompleteDb = new DatabaseSync(incomplete);
  incompleteDb.exec("CREATE TABLE incomplete (id INTEGER)");
  incompleteDb.close();
  const incompleteBefore = hash(await readFile(incomplete));
  await expect(initializeSales(incomplete, options)).rejects.toThrow("Preserve the existing file");
  expect(hash(await readFile(incomplete))).toBe(incompleteBefore);
  const incompatible = join(directory, "incompatible.sqlite");
  await initializeSales(incompatible, options);
  const writable = new DatabaseSync(incompatible);
  const saved = JSON.parse(
    String(writable.prepare("SELECT json FROM dataset_metadata").get()?.json),
  );
  saved.schema = 999;
  writable.prepare("UPDATE dataset_metadata SET json=?").run(JSON.stringify(saved));
  writable.close();
  const incompatibleBefore = hash(await readFile(incompatible));
  await expect(initializeSales(incompatible, options)).rejects.toThrow(
    "Preserve the existing file",
  );
  expect(hash(await readFile(incompatible))).toBe(incompatibleBefore);
  const corrupt = join(directory, "corrupt.sqlite");
  await writeFile(corrupt, "valuable existing bytes");
  await expect(initializeSales(corrupt, options)).rejects.toThrow("Preserve the existing file");
  expect(await readFile(corrupt, "utf8")).toBe("valuable existing bytes");
  const blocker = join(directory, "blocked-parent");
  await writeFile(blocker, "keep");
  await expect(initializeSales(join(blocker, "sales.sqlite"), options)).rejects.toThrow(
    "Check the path",
  );
  expect(await readFile(blocker, "utf8")).toBe("keep");
  const concurrent = join(directory, "concurrent.sqlite");
  const releasePath = join(directory, "release");
  const readyPaths = [join(directory, "ready-a"), join(directory, "ready-b")];
  const processes = ["2026-10-04T00:00:00Z", "2030-01-01T00:00:00Z"].map((anchor, index) =>
    execute(process.execPath, [
      "tests/fixtures/initialize-worker.ts",
      concurrent,
      anchor,
      String(index + 1),
      readyPaths[index]!,
      releasePath,
    ]),
  );
  const deadline = Date.now() + 10000;
  while (
    !(await readdir(directory)).includes("ready-a") ||
    !(await readdir(directory)).includes("ready-b")
  ) {
    if (Date.now() > deadline)
      throw new Error("Both initialization processes must reach the barrier.");
    await delay(5);
  }
  await writeFile(releasePath, "go");
  const results = await Promise.all(processes);
  const winners = results.map((result) => JSON.parse(result.stdout));
  expect(winners[0]).toEqual(winners[1]);
  const reopened = openSales(concurrent);
  expect(reopened.metadata).toEqual(winners[0]);
  reopened.db.close();
  expect(
    (await readdir(directory)).filter(
      (name) => name.startsWith("concurrent.sqlite.") && name.endsWith(".pending"),
    ),
  ).toEqual([]);
});

it("metric_boundaries_avoid_double_counting_and_future_leakage", () => {
  const { db, metadata } = referenceFixture();
  try {
    expect(bookings(db, metadata, { start: "2025-03-01", end: "2025-04-01" }).value).toBe(12000);
    expect(pipeline(db, metadata, "2025-02-01", { ownerId: 1, segment: "SMB" }).value).toBe(32000);
    expect(pipeline(db, metadata, "2025-02-20", { ownerId: 1, segment: "SMB" }).value).toBe(12000);
    const scenario = forecast(db, metadata, "2025-02-01", {
      start: "2025-03-01",
      end: "2025-04-01",
    });
    expect(scenario.weightedOpenCents).toBe(31000);
    expect(scenario.bookedCents).toBe(0);
    expect(scenario.rows.find((row) => row.opportunityId === 2)).toMatchObject({
      ownerId: 1,
      segment: "SMB",
      valueCents: 20000,
      expectedClose: "2025-03-10",
    });
    expect(
      forecast(db, metadata, "2025-02-20", { start: "2025-03-01", end: "2025-04-01" }).rows.map(
        (row) => row.opportunityId,
      ),
    ).toEqual([1, 3]);
    expect(customerChurn(db, metadata, { start: "2025-01-01", end: "2025-01-05" }).numerator).toBe(
      0,
    );
    expect(customerChurn(db, metadata, { start: "2025-01-01", end: "2025-02-01" })).toMatchObject({
      numerator: 1,
      denominator: 3,
      reactivatedCustomers: 1,
    });
    expect(revenueChurn(db, metadata, { start: "2025-01-01", end: "2025-02-01" })).toMatchObject({
      numerator: 30000,
      denominator: 40000,
      value: 75,
    });
    expect(salesGrowth(db, metadata, { start: "2025-03-01", end: "2025-04-01" }).reason).toContain(
      "Insufficient history",
    );
    expect(salesGrowth(db, metadata, { start: "2026-02-01", end: "2026-03-01" }).reason).toContain(
      "denominator is zero",
    );
    expect(() =>
      db.exec(
        "INSERT INTO opportunity_history VALUES (1,'2025-04-01','won',12000,'2025-04-01',1,'SMB')",
      ),
    ).toThrow("Closed opportunities");
    // Same-day subscription handover must not invent customer churn, while gross loss still excludes expansion.
    db.exec(`INSERT INTO accounts VALUES (6,'F','Americas'); INSERT INTO subscriptions VALUES (6,6),(7,6);
      INSERT INTO subscription_history VALUES (6,'2024-09-01',5000),(6,'2025-01-01',0),(7,'2025-01-01',7000);`);
    expect(customerChurn(db, metadata, { start: "2025-01-01", end: "2025-02-01" })).toMatchObject({
      numerator: 1,
      denominator: 4,
    });
    expect(revenueChurn(db, metadata, { start: "2025-01-01", end: "2025-02-01" })).toMatchObject({
      numerator: 35000,
      denominator: 45000,
      cancellationLossCents: 15000,
    });
    const leapMetadata = createMetadata(new Date("2024-03-01T00:00:00Z"), 7);
    db.exec(`INSERT INTO opportunities VALUES (8,1,'2024-02-29');
      INSERT INTO opportunity_history VALUES
        (8,'2024-02-29','qualification',100,'2024-03-31',1,'SMB'),
        (8,'2024-03-01','won',100,'2024-03-31',1,'SMB');`);
    expect(pipeline(db, leapMetadata, "2024-02-28").value).toBe(0);
    expect(pipeline(db, leapMetadata, "2024-02-29").value).toBe(100);
    expect(
      forecast(db, leapMetadata, "2024-02-29", { start: "2024-03-01", end: "2024-04-01" }),
    ).toMatchObject({ weightedOpenCents: 10, bookedCents: 0 });
  } finally {
    db.close();
  }
});

import { expect, it } from "vitest";
import { referenceFixture, cohortFixture } from "../fixtures/reference.ts";
import {
  bookings,
  conversion,
  pipeline,
  forecast,
  salesGrowth,
} from "../../data-sources/sales/opportunity-metrics.ts";
import {
  customerChurn,
  monthlyCustomerChurn,
  revenueChurn,
  trailingCustomerChurn,
  churnSeries,
  customerCohorts,
} from "../../data-sources/sales/churn-metrics.ts";
import { safeInteger } from "../../data-sources/sales/contracts.ts";

it("computes hand-verifiable commercial metrics with explicit denominators", () => {
  const { db, metadata } = referenceFixture();
  try {
    const period = { start: "2025-03-01", end: "2025-04-01" };
    expect(bookings(db, metadata, period).value).toBe(12000);
    expect(conversion(db, metadata, period)).toMatchObject({
      value: 50,
      numerator: 1,
      denominator: 2,
    });
    expect(salesGrowth(db, metadata, { start: "2026-03-01", end: "2026-04-01" })).toMatchObject({
      value: 100,
      comparisonBookings: 24000,
      baselineBookings: 12000,
    });
    const asOf = pipeline(db, metadata, "2025-02-01");
    expect(asOf.value).toBe(72000);
    expect(pipeline(db, metadata, "2025-02-01", { ownerId: 1, segment: "SMB" }).value).toBe(32000);
    expect(pipeline(db, metadata, "2025-02-20", { ownerId: 1, segment: "SMB" }).value).toBe(12000);
    expect(
      forecast(db, metadata, "2025-02-01", { start: "2025-03-01", end: "2025-04-01" }),
    ).toMatchObject({ weightedOpenCents: 31000, bookedCents: 0 });
    expect(
      forecast(db, metadata, "2025-02-20", { start: "2025-03-01", end: "2025-04-01" })
        .weightedOpenCents,
    ).toBe(26000);
  } finally {
    db.close();
  }
});

it("counts accounts, first cancellation and capped gross MRR loss", () => {
  const { db, metadata } = referenceFixture();
  try {
    const period = { start: "2025-01-01", end: "2025-02-01" };
    expect(monthlyCustomerChurn(db, metadata, period.start)).toMatchObject({
      numerator: 1,
      denominator: 3,
      reactivatedCustomers: 1,
    });
    expect(customerChurn(db, metadata, { start: "2025-01-01", end: "2025-01-04" }).numerator).toBe(
      0,
    );
    expect(revenueChurn(db, metadata, period)).toMatchObject({
      numerator: 30000,
      denominator: 40000,
      value: 75,
      cancellationLossCents: 10000,
    });
    expect(customerChurn(db, metadata, { start: "2025-01-01", end: "2025-03-01" })).toMatchObject({
      numerator: 2,
      denominator: 3,
      reactivatedCustomers: 1,
    });
    expect(trailingCustomerChurn(db, metadata, "2025-10-01").denominator).toBe(3);
  } finally {
    db.close();
  }
});

it("monthly churn keeps independent opening populations and gaps instead of adding rates", () => {
  const { db, metadata } = referenceFixture();
  try {
    const period = { start: "2025-01-01", end: "2025-04-01" };
    const customers = churnSeries(db, metadata, period, "customerChurn");
    expect(customers.rows).toEqual([
      {
        month: "2025-01-01",
        numerator: 1,
        denominator: 3,
        value: (1 / 3) * 100,
        reactivatedCustomers: 1,
      },
      { month: "2025-02-01", numerator: 1, denominator: 2, value: 50, reactivatedCustomers: 0 },
      { month: "2025-03-01", numerator: 0, denominator: 1, value: 0, reactivatedCustomers: 0 },
    ]);
    expect(customerChurn(db, metadata, period)).toMatchObject({ numerator: 2, denominator: 3 });
    const revenue = churnSeries(db, metadata, period, "revenueChurn");
    expect(revenue.rows).toMatchObject([
      { numerator: 30000, denominator: 40000, value: 75 },
      { numerator: 10000, denominator: 13000, value: (10000 / 13000) * 100 },
      { numerator: 0, denominator: 3000, value: 0 },
    ]);
    expect(revenueChurn(db, metadata, period)).toMatchObject({
      numerator: 40000,
      denominator: 40000,
    });
    expect(() =>
      churnSeries(db, metadata, { start: "2025-01-02", end: "2025-04-01" }, "customerChurn"),
    ).toThrow("complete calendar months");
    db.exec(
      "DELETE FROM subscription_history; INSERT INTO subscription_history VALUES (1,'2025-02-10',10000)",
    );
    expect(churnSeries(db, metadata, period, "customerChurn").rows).toEqual([
      { month: "2025-03-01", numerator: 0, denominator: 1, value: 0, reactivatedCustomers: 0 },
    ]);
    expect(customerChurn(db, metadata, period)).toMatchObject({
      status: "unavailable",
      denominator: 0,
    });
  } finally {
    db.close();
  }
});

it("distinguishes empty denominators from unsupported dates and zero totals", () => {
  const { db, metadata } = referenceFixture();
  try {
    expect(bookings(db, metadata, { start: "2025-02-01", end: "2025-03-01" })).toMatchObject({
      status: "available",
      value: 0,
    });
    expect(conversion(db, metadata, { start: "2025-02-01", end: "2025-03-01" })).toMatchObject({
      status: "unavailable",
      denominator: 0,
      value: null,
    });
    expect(salesGrowth(db, metadata, { start: "2026-02-01", end: "2026-03-01" })).toMatchObject({
      status: "unavailable",
      comparisonBookings: 0,
      baselineBookings: 0,
    });
    expect(bookings(db, metadata, { start: "2020-01-01", end: "2021-01-01" })).toMatchObject({
      status: "unavailable",
      numerator: null,
    });
    for (const result of [
      conversion(db, metadata, { start: "2020-01-01", end: "2021-01-01" }),
      customerChurn(db, metadata, { start: "2020-01-01", end: "2021-01-01" }),
      revenueChurn(db, metadata, { start: "2020-01-01", end: "2021-01-01" }),
      salesGrowth(db, metadata, { start: "2020-01-01", end: "2021-01-01" }),
    ])
      expect(result).toMatchObject({ status: "unavailable", unit: "percent", value: null });
    db.exec("DELETE FROM subscription_history");
    expect(revenueChurn(db, metadata, { start: "2025-01-01", end: "2025-02-01" })).toMatchObject({
      denominator: 0,
      value: null,
    });
  } finally {
    db.close();
  }
});

it("rejects invalid filters and unsafe monetary totals", () => {
  const { db, metadata } = referenceFixture();
  try {
    expect(() => pipeline(db, metadata, "2025-02-01", { ownerId: 1.5 })).toThrow(
      "positive integer",
    );
    expect(() => pipeline(db, metadata, "2025-02-01", { segment: "unknown" })).toThrow(
      "Unknown segment",
    );
    expect(() => safeInteger(Number.MAX_SAFE_INTEGER + 1)).toThrow("safe integer");
    db.prepare("UPDATE opportunity_history SET value_cents=? WHERE stage='won'").run(
      Number.MAX_SAFE_INTEGER,
    );
    expect(bookings(db, metadata, { start: "2025-01-01", end: "2026-01-01" }).value).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(() => bookings(db, metadata, { start: "2025-01-01", end: "2026-10-01" })).toThrow(
      "safe integer",
    );
  } finally {
    db.close();
  }
});

it("continuous cohorts keep first activation members and never restore cancelled accounts", () => {
  const { db, metadata } = cohortFixture();
  const period = { start: "2025-01-01", end: "2025-04-01" };
  try {
    const retention = customerCohorts(db, metadata, period);
    expect(retention).toMatchObject({ value: 40, numerator: 2, denominator: 5, cohortCount: 3 });
    expect(retention.table?.rows).toEqual([
      {
        cohort: "2025-01-01",
        age: 0,
        numerator: 2,
        denominator: 3,
        value: (2 / 3) * 100,
        reactivatedCustomers: 0,
      },
      {
        cohort: "2025-01-01",
        age: 1,
        numerator: 1,
        denominator: 3,
        value: (1 / 3) * 100,
        reactivatedCustomers: 2,
      },
      {
        cohort: "2025-01-01",
        age: 2,
        numerator: 1,
        denominator: 3,
        value: (1 / 3) * 100,
        reactivatedCustomers: 2,
      },
      {
        cohort: "2025-02-01",
        age: 0,
        numerator: 1,
        denominator: 1,
        value: 100,
        reactivatedCustomers: 0,
      },
      {
        cohort: "2025-02-01",
        age: 1,
        numerator: 0,
        denominator: 1,
        value: 0,
        reactivatedCustomers: 1,
      },
      {
        cohort: "2025-03-01",
        age: 0,
        numerator: 1,
        denominator: 1,
        value: 100,
        reactivatedCustomers: 0,
      },
    ]);
    const churn = customerCohorts(db, metadata, period, "cohortChurn");
    expect(churn).toMatchObject({ value: 60, numerator: 3, denominator: 5 });
    expect(churn.table?.rows.map((row) => row.numerator)).toEqual([1, 2, 2, 0, 1, 0]);
    const january = customerCohorts(db, metadata, { start: period.start, end: "2025-02-01" });
    expect(january).toMatchObject({ numerator: 2, denominator: 3 });
    expect(january.table?.rows).toHaveLength(1);
    expect(customerCohorts(db, metadata, { start: "2025-02-01", end: period.end })).toMatchObject({
      numerator: 1,
      denominator: 2,
    });
    expect(() => customerCohorts(db, metadata, { start: "2025-01-02", end: period.end })).toThrow(
      "complete calendar months",
    );
    expect(customerCohorts(db, metadata, { start: "2020-01-01", end: "2020-04-01" })).toMatchObject(
      { status: "unavailable", value: null, table: undefined },
    );
    // Removing the later cancellation proves the same-day subscription transfer was not churn.
    db.exec(
      "DELETE FROM subscription_history WHERE subscription_id=2 AND effective_at='2025-02-10'",
    );
    expect(customerCohorts(db, metadata, period).table?.rows[1]?.numerator).toBe(2);
    db.exec("DELETE FROM subscription_history");
    expect(customerCohorts(db, metadata, period)).toMatchObject({
      status: "unavailable",
      denominator: 0,
      table: { rows: [] },
    });
  } finally {
    db.close();
  }
});

import { expect, it } from "vitest";
import { referenceFixture } from "../fixtures/reference.ts";
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

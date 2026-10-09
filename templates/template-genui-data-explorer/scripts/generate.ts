import type { DatabaseSync } from "node:sqlite";
import type { DatasetMetadata } from "../data-sources/sales/contracts.ts";
import { completeMonthCoverage, shiftDays, shiftMonths } from "../data-sources/sales/calendar.ts";
import { VERSIONS } from "../data-sources/sales/contracts.ts";

export function generateSales(db: DatabaseSync, metadata: DatasetMetadata): void {
  let state = metadata.seed;
  const random = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  const account = db.prepare("INSERT INTO accounts VALUES (?, ?, ?)");
  const representative = db.prepare("INSERT INTO representatives VALUES (?, ?)");
  const opportunity = db.prepare("INSERT INTO opportunities VALUES (?, ?, ?)");
  const snapshot = db.prepare("INSERT INTO opportunity_history VALUES (?, ?, ?, ?, ?, ?, ?)");
  const subscription = db.prepare("INSERT INTO subscriptions VALUES (?, ?)");
  const mrr = db.prepare("INSERT INTO subscription_history VALUES (?, ?, ?)");
  const month = db.prepare("INSERT INTO months VALUES (?, ?)");
  for (let id = 1; id <= 6; id++) representative.run(id, `Synthetic representative ${id}`);
  for (let id = 1; id <= 120; id++) {
    account.run(id, `Synthetic account ${id}`, ["Americas", "EMEA", "APAC"][id % 3]!);
    subscription.run(id, id);
    const initial = (20 + random(80)) * 1000;
    const start =
      id <= 48
        ? shiftMonths(metadata.coverage.start, -1)
        : shiftMonths(metadata.coverage.start, random(20));
    mrr.run(id, start, initial);
    const change = shiftMonths(start, 3 + random(9));
    if (change < metadata.coverage.end) {
      const updated = id % 4 === 0 ? 0 : id % 3 === 0 ? Math.floor(initial * 0.7) : initial + 10000;
      mrr.run(id, change, updated);
      const later = shiftMonths(change, 3);
      if (later < metadata.coverage.end && id % 4 === 0) mrr.run(id, later, initial);
    }
    if (id % 10 === 0) {
      subscription.run(id + 120, id);
      mrr.run(id + 120, start, 15000);
      if (change < metadata.coverage.end) mrr.run(id + 120, change, 0);
    }
  }
  let id = 0;
  for (let index = 0; index < 24; index++) {
    const start = shiftMonths(metadata.coverage.start, index);
    const end = shiftMonths(start, 1);
    month.run(start, end);
    for (let deal = 0; deal < 18; deal++) {
      id++;
      const created = shiftDays(start, deal % 10);
      const owner = 1 + random(6);
      const segment = ["SMB", "Mid-market", "Enterprise"][random(3)]!;
      const seasonality = [120, 95, 100, 110][index % 4]!;
      const value = (100 + random(900)) * seasonality * 100;
      const expected = shiftDays(start, 20);
      opportunity.run(id, 1 + random(120), created);
      snapshot.run(id, created, "qualification", value, expected, owner, segment);
      snapshot.run(id, shiftDays(created, 3), "proposal", value, expected, owner, segment);
      if (deal < 13)
        snapshot.run(
          id,
          shiftDays(start, 25),
          deal < 8 ? "won" : "lost",
          value,
          expected,
          owner,
          segment,
        );
      else
        snapshot.run(
          id,
          shiftDays(start, 26),
          deal % 2 ? "negotiation" : "discovery",
          value,
          shiftDays(end, 20 + random(45)),
          owner,
          segment,
        );
    }
  }
}

export function createMetadata(now: Date, seed: number = 1729): DatasetMetadata {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Seed must be an unsigned 32-bit integer.");
  const coverage = completeMonthCoverage(now);
  return {
    ...VERSIONS,
    seed,
    anchor: now.toISOString(),
    timezone: "UTC",
    currency: "USD",
    coverage,
    asOf: shiftDays(coverage.end, -1),
    complete: true,
  };
}

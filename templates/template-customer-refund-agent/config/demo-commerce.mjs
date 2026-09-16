function validInstant(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("LOCAL_DEMO_SEED_AT must be a valid ISO instant.");
  return date;
}

/** Add a calendar month in UTC while retaining the source day where possible.
 * Jan 31 therefore renews on Feb 28/29 instead of spilling into March. */
export function addCalendarMonthClamped(value) {
  const date = validInstant(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month + 1,
      Math.min(day, lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  ).toISOString();
}

/** The interactive local demo has one customer with the same commerce facts
 * in the backend and client databases. Callers may inject the clock for a
 * reproducible demo run. */
export function interactiveLocalCommerce(seedAt = new Date()) {
  const purchaseClock =
    validInstant(seedAt).getTime() - 5 * 24 * 60 * 60 * 1000;
  const purchasedAt = new Date(purchaseClock).toISOString();
  return {
    purchase: {
      orderId: "DEMO-API-CREDITS-001",
      product: "API Credits",
      amountMinor: 500,
      currency: "USD",
      purchasedAt,
    },
  };
}

export function localDemoSeedInstant(environment = process.env) {
  return environment.LOCAL_DEMO_SEED_AT || new Date().toISOString();
}

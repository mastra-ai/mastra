import { describe, expect, it } from "vitest";
import { subscriptionDisplayName, subscriptionInterval } from "./case-detail";

describe("CaseDetail subscription evidence", () => {
  it("uses a readable fallback for an opaque Stripe price and retains the ID as detail", () => {
    expect(subscriptionDisplayName("price_synthetic123")).toBe(
      "Monthly subscription",
    );
    expect(subscriptionInterval("month", 1)).toBe("month");
    expect(subscriptionInterval("month", 3)).toBe("3 months");
    expect(subscriptionDisplayName("Named plan")).toBe("Named plan");
  });
});

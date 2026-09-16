import { describe, expect, it } from "vitest";
import { samplesForPrincipal } from "./mock-emails";

describe("customer-specific portal samples", () => {
  it("only offers samples owned by the authenticated customer", () => {
    expect(samplesForPrincipal("alex@example.com")).toEqual([
      expect.objectContaining({ externalId: "email-1001" }),
    ]);
    expect(samplesForPrincipal("jordan@example.com")).toEqual([
      expect.objectContaining({ externalId: "email-1002" }),
    ]);
    expect(samplesForPrincipal("unknown@example.com")).toEqual([]);
  });
});

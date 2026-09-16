import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApprovalCard } from "./approval-card";
import type { SupportCase } from "@/lib/types";

describe("ApprovalCard", () => {
  it("renders and binds the subscription-credit approval identity", () => {
    const html = renderToStaticMarkup(
      <ApprovalCard
        approverId="approver-demo"
        onDecision={async () => undefined}
        supportCase={
          {
            metadata: {
              subscriptionCreditCommand: { fingerprint: "credit-fingerprint" },
            },
            draft: {
              draftResponse: "A credit can be added after approval.",
              citedSources: [],
              selectedPolicyExcerpts: [],
              recommendRefund: false,
              resolutionAction: "subscription_credit",
              subscriptionCreditAmount: 49,
              subscriptionCreditCurrency: "USD",
              subscriptionCreditReason: "Verified outage",
              requiresEscalation: false,
            },
            subscriptionLookup: {
              found: true,
              subscription: { subscriptionId: "SUB-1001" },
            },
          } as unknown as SupportCase
        }
      />,
    );
    expect(html).toContain("Subscription credit approval requested");
    expect(html).toContain("Approve credit");
    expect(html).toContain("I confirm the reported service problem");
    expect(html).toContain("credit-fingerprint");
    expect(html).toContain("SUB-1001");
    expect(html).toContain("49 USD");
  });
});

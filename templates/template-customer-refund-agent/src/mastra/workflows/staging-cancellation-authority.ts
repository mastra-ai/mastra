import { createHash } from "node:crypto";
import { z } from "zod";
import { hasExplicitStagingMode } from "../../../config/app-mode.mjs";
import { triageResultSchema, type SupportCase } from "../domain/support-case";
import { bindingsForPersistedCase } from "../runtime/provider-bindings";

export const stagingCancellationInterpretationSchema = z.object({
  directCancellationRequested: z.boolean(),
  atPeriodEnd: z.boolean(),
  explicitNoRefund: z.boolean(),
  hasNegationQuoteConflictOrAmbiguity: z.boolean(),
  evidenceVerbatim: z.array(z.string().min(1)).max(4),
  confidence: z.number().min(0).max(1),
});

export type StagingCancellationInterpretation = z.infer<
  typeof stagingCancellationInterpretationSchema
>;

export const stagingTriageSchema = triageResultSchema.extend({
  cancellationInterpretation:
    stagingCancellationInterpretationSchema.optional(),
});

export const stagingCancellationSystem = {
  role: "system" as const,
  content: `Fill cancellationInterpretation only from the current customer text. For non-cancellation or empty text, set every authority flag false, hasNegationQuoteConflictOrAmbiguity true, and evidenceVerbatim empty. Mark directCancellationRequested and atPeriodEnd true only for a direct request to cancel at period end, including stop at next renewal while retaining access until then. explicitNoRefund is true only when the customer clearly declines a refund. “I do not want a refund” is positive no-refund evidence, not a negation. hasNegationQuoteConflictOrAmbiguity is true when cancellation itself is negated, quoted, conflicted, uncertain, immediate, or paired with any refund request. evidenceVerbatim must be exact snippets from the customer message. Use confidence at least 0.90 only when every required fact is unambiguous.`,
};

export function cancellationMessageHash(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

export function explicitNoRefundCancellation(body: string) {
  const normalized = body.trim().replace(/\s+/g, " ").toLowerCase();
  return /^(?:please )?cancel(?: my)? subscription(?: at the end of (?:the )?(?:current )?(?:billing )?period)?[.!]? (?:i )?(?:do not|don't) want (?:a )?refund[.!]?$/.test(
    normalized,
  );
}

export function isStagingIntercomStripeCase(supportCase: SupportCase) {
  const bindings = bindingsForPersistedCase(supportCase);
  return (
    hasExplicitStagingMode() &&
    bindings.support.providerKind === "intercom" &&
    bindings.commerce.providerKind === "stripe" &&
    bindings.transactions.providerKind === "stripe"
  );
}

export function stampedCancellationInterpretation(
  supportCase: SupportCase,
  turn: { id: string; message?: { id: string; body: string } },
) {
  if (!isStagingIntercomStripeCase(supportCase) || !turn.message) return false;
  const value = supportCase.metadata.stagingCancellationInterpretation;
  const parsed = stagingCancellationInterpretationSchema.safeParse(value);
  if (!parsed.success) return false;
  const stamp = value as Record<string, unknown>;
  const binding = bindingsForPersistedCase(supportCase).transactions;
  return (
    stamp.turnId === turn.id &&
    stamp.messageId === turn.message.id &&
    stamp.messageHash === cancellationMessageHash(turn.message.body) &&
    JSON.stringify(stamp.binding) === JSON.stringify(binding) &&
    parsed.data.directCancellationRequested &&
    parsed.data.atPeriodEnd &&
    parsed.data.explicitNoRefund &&
    !parsed.data.hasNegationQuoteConflictOrAmbiguity &&
    parsed.data.confidence >= 0.9 &&
    parsed.data.evidenceVerbatim.length > 0 &&
    parsed.data.evidenceVerbatim.every((excerpt) =>
      turn.message!.body.includes(excerpt),
    )
  );
}

export function cancellationAuthority(
  supportCase: SupportCase,
  turn: { id: string; message?: { id: string; body: string } },
) {
  return isStagingIntercomStripeCase(supportCase)
    ? stampedCancellationInterpretation(supportCase, turn)
    : Boolean(turn.message && explicitNoRefundCancellation(turn.message.body));
}

import type { InvoiceRuntime } from "../../accounting/providers.ts";
import { ProviderUnavailableError } from "../../accounting/types.ts";
import type { AssessmentState } from "../schema.ts";
import { decide } from "./decision.ts";

const withinSevenDays = (left: string, right: string) => {
  const days = Math.abs(Date.parse(left) - Date.parse(right)) / 86_400_000;
  return !Number.isFinite(days) || days <= 7;
};

export function makeDuplicateDetection(runtime: InvoiceRuntime) {
  return async (state: AssessmentState) => {
    if (!state.vendor || state.decisions.some(({ outcome }) => outcome !== "pass")) return state;

    try {
      await runtime.seedHistory();
      const candidates = await runtime.history.findPotentialDuplicates({
        vendorId: state.vendor.id,
        invoiceNumber: state.invoice.invoiceNumber,
        currency: state.invoice.currency,
        totalMinor: state.invoice.totalMinor,
      });
      const duplicateIds = candidates
        .filter(
          (invoice) =>
            invoice.invoiceNumber?.trim().toLowerCase() ===
              state.invoice.invoiceNumber.trim().toLowerCase() ||
            (invoice.currency === state.invoice.currency &&
              invoice.totalMinor === state.invoice.totalMinor &&
              withinSevenDays(invoice.invoiceDate, state.invoice.invoiceDate)),
        )
        .map(({ id }) => id);

      const duplicate = duplicateIds.length > 0;
      return decide(state, {
        step: "dedup",
        outcome: duplicate ? "review" : "pass",
        reasons: [
          {
            code: duplicate ? "POSSIBLE_DUPLICATE" : "NO_DUPLICATE",
            message: duplicate ? "Potential prior invoice found" : "No duplicate invoice found",
            evidence: { invoiceIds: duplicateIds },
          },
        ],
      });
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
      return decide(state, {
        step: "dedup",
        outcome: "unknown_retry",
        reasons: [{ code: "HISTORY_UNAVAILABLE", message: error.message }],
      });
    }
  };
}

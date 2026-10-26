import type { InvoiceRuntime } from "../../accounting/providers.ts";
import { ProviderUnavailableError } from "../../accounting/types.ts";
import type { AssessmentState, PurchaseOrder } from "../schema.ts";
import { hasLowConfidence } from "../validation.ts";
import { decide } from "./decision.ts";

const compareLines = (state: AssessmentState, order: PurchaseOrder, tolerance: number) => {
  const unusedOrderLines = new Set(order.lines.map((_, index) => index));
  const mismatches: string[] = [];

  state.invoice.lines.forEach((line, invoiceIndex) => {
    const orderIndex = line.sku
      ? order.lines.findIndex(
          (candidate, index) => unusedOrderLines.has(index) &&
            [candidate.sku, candidate.description].some((id) => id === line.sku || id === line.description),
        )
      : unusedOrderLines.has(invoiceIndex)
        ? invoiceIndex
        : -1;
    if (orderIndex < 0) return void mismatches.push(`lines.${invoiceIndex}.missing`);

    unusedOrderLines.delete(orderIndex);
    const expected = order.lines[orderIndex]!;
    if (line.qty !== expected.qty) mismatches.push(`lines.${invoiceIndex}.qty`);
    if (Math.abs(line.unitPriceMinor - expected.unitPriceMinor) > tolerance)
      mismatches.push(`lines.${invoiceIndex}.unitPrice`);
    if (
      line.lineTotalMinor !== null &&
      Math.abs(line.lineTotalMinor - expected.lineTotalMinor) > tolerance
    )
      mismatches.push(`lines.${invoiceIndex}.lineTotal`);
  });

  if (unusedOrderLines.size) mismatches.push("lines.uninvoicedPoLines");
  return mismatches;
};

export function makeInvoiceMatch(runtime: InvoiceRuntime) {
  const provider = runtime.provider;

  return async (state: AssessmentState) => {
    if (!state.vendor || state.decisions.some(({ outcome }) => outcome !== "pass")) return state;

    try {
      if (!state.invoice.poNumber)
        return decide(state, {
          step: "match",
          outcome: "review",
          reasons: [{ code: "PO_NUMBER_MISSING", message: "Invoice has no printed PO number" }],
        });

      const orders = await provider.findPurchaseOrders(state.invoice.poNumber);
      if (orders.length !== 1) {
        const ambiguous = orders.length > 1;
        return decide(state, {
          step: "match",
          outcome: "review",
          reasons: [
            {
              code: ambiguous ? "PO_AMBIGUOUS" : "PO_NOT_FOUND",
              message: ambiguous
                ? "Multiple purchase orders match"
                : "Purchase order was not found",
            },
          ],
        });
      }

      const order = orders[0]!;
      state.purchaseOrder = order;
      const mismatches = [
        ...(order.vendorId === state.vendor.id ? [] : ["vendor"]),
        ...(order.currency === state.invoice.currency ? [] : ["currency"]),
        ...(Math.abs(order.totalMinor - state.invoice.totalMinor) <=
        runtime.policy.amountToleranceMinor
          ? []
          : ["total"]),
        ...compareLines(state, order, runtime.policy.amountToleranceMinor),
      ];
      if (mismatches.length) {
        const verify = hasLowConfidence(
          state.invoice,
          ["vendorName", "poNumber", "currency", "total", "lines"],
          runtime.policy.lowConfidenceThreshold,
        );
        return decide(state, {
          step: "match",
          outcome: verify ? "verify_extraction" : "review",
          reasons: [
            {
              code: "PO_MISMATCH",
              message: "Invoice does not match the purchase order",
              evidence: { mismatches },
            },
          ],
        });
      }

      if (!provider.findReceipts)
        return decide(state, {
          step: "match",
          outcome: "pass",
          reasons: [
            {
              code: "TWO_WAY_MATCH",
              message: "Invoice and purchase order match; receipts are unavailable",
            },
          ],
        });

      const receipts = await provider.findReceipts(order.id);
      const invoiceLinesWithoutSku = state.invoice.lines.filter(({ sku }) => !sku).length;
      const receiptLinesWithoutSku = receipts
        .flatMap(({ lines }) => lines)
        .filter(({ sku }) => !sku).length;
      if (invoiceLinesWithoutSku > 1 || receiptLinesWithoutSku > 1)
        return decide(state, {
          step: "match",
          outcome: "review",
          reasons: [
            {
              code: "RECEIPT_LINE_IDENTITY_AMBIGUOUS",
              message: "Multiple lines without SKUs cannot be matched safely by position",
              evidence: { invoiceLinesWithoutSku, receiptLinesWithoutSku },
            },
          ],
        });

      const received = new Map<string, number>();
      for (const receipt of receipts)
        receipt.lines.forEach((line, index) => {
          const key = line.sku ?? `line:${index}`;
          received.set(key, (received.get(key) ?? 0) + line.qty);
        });
      const receiptMismatch =
        !receipts.length ||
        state.invoice.lines.some(
          (line, index) => (received.get(line.sku ?? `line:${index}`) ?? 0) < line.qty,
        );
      const verify =
        receiptMismatch &&
        hasLowConfidence(state.invoice, ["lines", "qty"], runtime.policy.lowConfidenceThreshold);
      return decide(state, {
        step: "match",
        outcome: receiptMismatch ? (verify ? "verify_extraction" : "review") : "pass",
        reasons: [
          {
            code: receiptMismatch ? "RECEIPT_MISMATCH" : "THREE_WAY_MATCH",
            message: receiptMismatch
              ? "Received quantities do not cover invoiced quantities"
              : "Invoice, purchase order, and receipts match",
            evidence: { receiptIds: receipts.map(({ id }) => id) },
          },
        ],
      });
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
      return decide(state, {
        step: "match",
        outcome: "unknown_retry",
        reasons: [{ code: "MATCH_LOOKUP_UNAVAILABLE", message: error.message }],
      });
    }
  };
}

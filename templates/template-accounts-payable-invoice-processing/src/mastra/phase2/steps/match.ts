import type { Phase2Runtime } from '../composition.ts';
import { runtimeSources } from '../composition.ts';
import { ProviderUnavailableError, ReferenceCrosswalkError } from '../ports.ts';
import { AssessmentStateSchema, type AssessmentState, type PurchaseOrder, type StepDecision } from '../schemas.ts';
import { hasLowConfidence } from '../confidence.ts';

const lowConfidence = (state: AssessmentState, fields: string[], threshold: number) =>
  hasLowConfidence(state.invoice, fields, threshold);
const mismatchReasons = (mismatches: string[]) => [
  {
    code: 'PO_MISMATCH',
    message: 'Invoice does not match the purchase order',
    evidence: { mismatches },
  },
  ...(mismatches.some(mismatch => mismatch.endsWith('.unitPrice'))
    ? [
        {
          code: 'PRICE_VARIANCE',
          message: 'One or more invoice unit prices exceed the PO tolerance',
          evidence: {
            mismatches: mismatches.filter(mismatch => mismatch.endsWith('.unitPrice')),
          },
        },
      ]
    : []),
  ...(mismatches.some(mismatch => mismatch.endsWith('.qty'))
    ? [
        {
          code: 'QUANTITY_VARIANCE',
          message: 'One or more invoice quantities differ from the PO',
          evidence: { mismatches: mismatches.filter(mismatch => mismatch.endsWith('.qty')) },
        },
      ]
    : []),
  ...(mismatches.some(mismatch => mismatch.endsWith('.missing') || mismatch === 'lines.uninvoicedPoLines')
    ? [
        {
          code: 'LINE_ITEM_VARIANCE',
          message: 'Invoice and PO line items differ',
          evidence: {
            mismatches: mismatches.filter(
              mismatch => mismatch.endsWith('.missing') || mismatch === 'lines.uninvoicedPoLines',
            ),
          },
        },
      ]
    : []),
  ...(mismatches.includes('total')
    ? [
        {
          code: 'TOTAL_VARIANCE',
          message: 'Invoice total differs from the PO beyond tolerance',
          evidence: { mismatches: ['total'] },
        },
      ]
    : []),
  ...(mismatches.includes('currency')
    ? [
        {
          code: 'CURRENCY_MISMATCH',
          message: 'Invoice and PO currencies differ',
          evidence: { mismatches: ['currency'] },
        },
      ]
    : []),
  ...(mismatches.includes('vendor')
    ? [
        {
          code: 'PO_VENDOR_MISMATCH',
          message: 'Purchase order belongs to a different vendor',
          evidence: { mismatches: ['vendor'] },
        },
      ]
    : []),
];
const reviewTypeFor = (mismatches: string[]) =>
  mismatches.some(mismatch => mismatch.endsWith('.unitPrice'))
    ? 'review_price_variance'
    : mismatches.some(mismatch => mismatch.endsWith('.qty'))
      ? 'review_quantity_variance'
      : mismatches.some(mismatch => mismatch.endsWith('.missing') || mismatch === 'lines.uninvoicedPoLines')
        ? 'review_line_item_variance'
        : mismatches.includes('currency')
          ? 'review_currency_mismatch'
          : 'po_mismatch';
const lineMismatches = (state: AssessmentState, po: PurchaseOrder, tolerance: number) => {
  const available = new Set(po.lines.map((_, index) => index)),
    mismatches: string[] = [];
  state.invoice.lines.forEach((line, invoiceIndex) => {
    const poIndex = line.sku
      ? po.lines.findIndex((candidate, index) => available.has(index) && candidate.sku === line.sku)
      : available.has(invoiceIndex)
        ? invoiceIndex
        : -1;
    if (poIndex < 0) {
      mismatches.push(`lines.${invoiceIndex}.missing`);
      return;
    }
    available.delete(poIndex);
    const expected = po.lines[poIndex]!;
    if (line.qty !== expected.qty) mismatches.push(`lines.${invoiceIndex}.qty`);
    if (Math.abs(line.unitPriceMinor - expected.unitPriceMinor) > tolerance)
      mismatches.push(`lines.${invoiceIndex}.unitPrice`);
    if (line.lineTotalMinor !== null && Math.abs(line.lineTotalMinor - expected.lineTotalMinor) > tolerance)
      mismatches.push(`lines.${invoiceIndex}.lineTotal`);
  });
  if (available.size) mismatches.push('lines.uninvoicedPoLines');
  return mismatches;
};
export function makeInvoiceMatch(runtime: Phase2Runtime) {
  const provider = runtime.provider,
    sources = runtimeSources(runtime);
  return async (state: AssessmentState) => {
    if (!state.vendor || state.decisions.some(decision => decision.outcome !== 'pass')) return state;
    const adaptations: StepDecision['adaptations'] = [];
    try {
      const policy = await runtime.policy.getPolicy();
      if (!state.invoice.poNumber) {
        state.decisions.push({
          step: 'match',
          outcome: 'review',
          reviewType: 'missing_po',
          reasons: [{ code: 'PO_NUMBER_MISSING', message: 'Invoice has no printed PO number' }],
          signals: [],
          adaptations,
          sources: {},
        });
        return AssessmentStateSchema.parse(state);
      }
      const orders = await provider.purchaseOrders!.findByNumber(state.invoice.poNumber);
      if (orders.length !== 1) {
        state.decisions.push({
          step: 'match',
          outcome: 'review',
          reviewType: orders.length ? 'ambiguous_po' : 'po_not_found',
          reasons: [
            {
              code: orders.length ? 'PO_AMBIGUOUS' : 'PO_NOT_FOUND',
              message: orders.length ? 'Multiple purchase orders match' : 'Purchase order was not found',
            },
          ],
          signals: [],
          adaptations,
          sources: { purchaseOrders: sources.purchaseOrders },
        });
        return AssessmentStateSchema.parse(state);
      }
      const po = orders[0]!;
      state.purchaseOrder = po;
      const mismatches = [
        ...(po.vendorId === state.vendor.id ? [] : ['vendor']),
        ...(po.currency === state.invoice.currency ? [] : ['currency']),
        ...(Math.abs(po.totalMinor - state.invoice.totalMinor) <= policy.amountToleranceMinor ? [] : ['total']),
        ...lineMismatches(state, po, policy.amountToleranceMinor),
      ];
      if (mismatches.length) {
        const verify = lowConfidence(
          state,
          ['vendorName', 'poNumber', 'currency', 'total', 'lines', 'sku', 'qty', 'unitPrice', 'lineTotal'],
          policy.lowConfidenceThreshold,
        );
        state.decisions.push({
          step: 'match',
          outcome: verify ? 'verify_extraction' : 'review',
          reviewType: verify ? null : reviewTypeFor(mismatches),
          reasons: mismatchReasons(mismatches),
          signals: [],
          adaptations,
          sources: { purchaseOrders: sources.purchaseOrders },
        });
        return AssessmentStateSchema.parse(state);
      }
      if (!provider.goodsReceipts) {
        state.matchMode = 'two_way';
        adaptations.push({ code: 'GOODS_RECEIPTS_UNAVAILABLE', providerId: provider.id });
        state.decisions.push({
          step: 'match',
          outcome: 'pass',
          reviewType: null,
          reasons: [
            {
              code: 'TWO_WAY_MATCH',
              message: 'Invoice and purchase order match; source supplies no goods receipts',
              evidence: { matchMode: 'two_way' },
            },
          ],
          signals: [],
          adaptations,
          sources: { purchaseOrders: sources.purchaseOrders },
        });
        return AssessmentStateSchema.parse(state);
      }
      state.matchMode = 'three_way';
      state.receipts = await provider.goodsReceipts.findByPurchaseOrderId(po.id);
      const received = new Map<string, number>();
      for (const receipt of state.receipts)
        receipt.lines.forEach((line, index) => {
          const key = line.sku ?? `line:${index}`;
          received.set(key, (received.get(key) ?? 0) + line.qty);
        });
      const receiptMismatch =
        !state.receipts.length ||
        state.invoice.lines.some((line, index) => (received.get(line.sku ?? `line:${index}`) ?? 0) < line.qty);
      const verify = receiptMismatch && lowConfidence(state, ['lines', 'qty'], policy.lowConfidenceThreshold);
      state.decisions.push({
        step: 'match',
        outcome: receiptMismatch ? (verify ? 'verify_extraction' : 'review') : 'pass',
        reviewType: receiptMismatch && !verify ? 'receipt_mismatch' : null,
        reasons: [
          {
            code: receiptMismatch ? 'RECEIPT_MISMATCH' : 'THREE_WAY_MATCH',
            message: receiptMismatch
              ? 'Received quantities do not cover invoiced quantities'
              : 'Invoice, purchase order, and receipts match',
            evidence: {
              matchMode: 'three_way',
              receiptIds: state.receipts.map(receipt => receipt.id),
            },
          },
        ],
        signals: [],
        adaptations,
        sources: { purchaseOrders: sources.purchaseOrders, goodsReceipts: sources.goodsReceipts },
      });
      return AssessmentStateSchema.parse(state);
    } catch (error) {
      if (error instanceof ReferenceCrosswalkError) {
        state.decisions.push({
          step: 'match',
          outcome: 'review',
          reviewType: 'identity_crosswalk_missing',
          reasons: [
            {
              code: 'IDENTITY_CROSSWALK_MISSING',
              message: error.message,
              evidence: { entity: error.entity, id: error.id },
            },
          ],
          signals: [],
          adaptations,
          sources: { purchaseOrders: sources.purchaseOrders, goodsReceipts: sources.goodsReceipts },
        });
        return AssessmentStateSchema.parse(state);
      }
      if (!(error instanceof ProviderUnavailableError)) throw error;
      state.decisions.push({
        step: 'match',
        outcome: 'unknown_retry',
        reviewType: null,
        reasons: [{ code: 'MATCH_LOOKUP_UNAVAILABLE', message: error.message }],
        signals: [],
        adaptations,
        sources: { purchaseOrders: sources.purchaseOrders, goodsReceipts: sources.goodsReceipts },
      });
      return AssessmentStateSchema.parse(state);
    }
  };
}

import Decimal from 'decimal.js';
import type { ExtractedInvoice } from '../schemas/invoice.ts';
import { Phase2InvoiceSchema, type Phase1WorkflowOutput, type Phase2Invoice } from './schemas.ts';

const exponent = (currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
export function toMinorUnits(value: number, currency: string): number {
  const result = new Decimal(value.toString())
    .mul(new Decimal(10).pow(exponent(currency)))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  if (!Number.isSafeInteger(result)) throw new Error(`Unsafe ${currency} minor-unit value: ${value}`);
  return result;
}
export function normalizePhase1Output(output: Phase1WorkflowOutput): Phase2Invoice {
  const x: ExtractedInvoice = output.extractedResult,
    money = (value: number | null) => (value === null ? null : toMinorUnits(value, x.currency));
  return Phase2InvoiceSchema.parse({
    document: output.rawDocumentRef,
    invoiceNumber: x.invoiceNumber,
    vendorName: x.vendorName,
    vendorTaxId: x.vendorTaxId,
    poNumber: x.poNumber,
    invoiceDate: x.invoiceDate,
    currency: x.currency,
    subtotalMinor: money(x.subtotal),
    taxMinor: money(x.tax),
    totalMinor: toMinorUnits(x.total, x.currency),
    lines: x.lines.map(line => ({
      sku: line.sku,
      description: line.description,
      qty: line.qty,
      unitPriceMinor: toMinorUnits(line.unitPrice, x.currency),
      lineTotalMinor: money(line.lineTotal),
    })),
    confidence: x.confidence,
    overallConfidence: x.overallConfidence,
    fixtureHints: { vendorId: output.vendorId, poId: output.poId },
  });
}

import Decimal from "decimal.js";
import { code as currencyCode } from "currency-codes";
import {
  NormalizedInvoiceSchema,
  type InvoiceWorkflowInput,
  type NormalizedInvoice,
} from "./schema.ts";

const recentCurrencies = new Map([
  ["XAD", 2],
  ["XCG", 2],
]);
const currenciesWithoutMinorUnits = new Set([
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XPD",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
]);
export const isCanonicalCurrency = (currency: string) =>
  currencyCode(currency)?.code === currency || recentCurrencies.has(currency);
export const minorUnitDigits = (currency: string) => {
  if (currenciesWithoutMinorUnits.has(currency)) return null;
  return recentCurrencies.get(currency) ?? currencyCode(currency)?.digits ?? null;
};
const exponent = (currency: string) => {
  const digits = minorUnitDigits(currency);
  if (digits === null) throw new Error(`${currency} has no supported ISO 4217 minor unit`);
  return digits;
};
export function toMinorUnits(value: number, currency: string): number {
  const result = new Decimal(value.toString())
    .mul(new Decimal(10).pow(exponent(currency)))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  if (!Number.isSafeInteger(result))
    throw new Error(`Unsafe ${currency} minor-unit value: ${value}`);
  return result;
}
export function toMajorUnits(value: number, currency: string): number {
  if (!Number.isSafeInteger(value))
    throw new Error(`Unsafe ${currency} minor-unit value: ${value}`);
  return new Decimal(value).div(new Decimal(10).pow(exponent(currency))).toNumber();
}
export function normalizeInvoice(output: InvoiceWorkflowInput): NormalizedInvoice {
  const invoice = output.extractedResult;
  const money = (value: number | null) =>
    value === null ? null : toMinorUnits(value, invoice.currency);
  return NormalizedInvoiceSchema.parse({
    ...invoice,
    document: output.rawDocumentRef,
    subtotalMinor: money(invoice.subtotal),
    taxMinor: money(invoice.tax),
    totalMinor: toMinorUnits(invoice.total, invoice.currency),
    lines: invoice.lines.map((line) => ({
      sku: line.sku,
      description: line.description,
      qty: line.qty,
      unitPriceMinor: toMinorUnits(line.unitPrice, invoice.currency),
      lineTotalMinor: money(line.lineTotal),
    })),
  });
}

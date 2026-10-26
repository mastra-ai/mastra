import Decimal from "decimal.js";
import {
  ExtractedInvoiceSchema,
  type ExtractedInvoice,
  type InvoiceDraft,
  type NormalizedInvoice,
} from "./schema.ts";
import { isCanonicalCurrency, minorUnitDigits } from "./money.ts";

const isDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const blank = (value: string) => value.trim().length === 0;
const hasMinorUnitPrecision = (value: number, digits: number) =>
  new Decimal(value).decimalPlaces() <= digits;
// Unit prices may be sub-minor-unit rates; posted extended amounts must obey the currency scale.
const reconciles = (parts: Array<number | Decimal>, total: number, digits: number) => {
  const sum = parts.reduce<Decimal>((value, part) => value.plus(part), new Decimal(0)),
    expected = new Decimal(total);
  return sum
    .toDecimalPlaces(digits, Decimal.ROUND_HALF_UP)
    .equals(expected.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP));
};

export function validateExtraction(draft: InvoiceDraft): {
  extracted: ExtractedInvoice | null;
  issues: string[];
} {
  // A vendor tax ID is a useful identity signal when it is printed, but it is
  // not required to create or match a QBO Bill. Models commonly omit optional
  // fields instead of returning `null`, so normalize that omission explicitly.
  const parsed = ExtractedInvoiceSchema.safeParse({
    ...draft,
    vendorTaxId: draft.vendorTaxId ?? null,
  });
  if (!parsed.success)
    return {
      extracted: null,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "invoice"}: ${issue.message}`,
      ),
    };
  const invoice = parsed.data;
  const issues: string[] = [];
  for (const field of ["invoiceNumber", "vendorName", "invoiceDate", "currency"] as const)
    if (blank(invoice[field])) issues.push(`${field} is required`);
  if (!isDate(invoice.invoiceDate)) issues.push("invoiceDate must be yyyy-mm-dd");
  invoice.lines.forEach((line, index) => {
    if (blank(line.description)) issues.push(`lines.${index}.description is required`);
  });

  const canonicalCurrency = isCanonicalCurrency(invoice.currency);
  const digits = minorUnitDigits(invoice.currency);
  const lineAmounts: Array<number | Decimal> = invoice.lines.map(
    (line) => line.lineTotal ?? new Decimal(line.qty).mul(line.unitPrice),
  );
  const subtotalBasis =
    invoice.subtotal ??
    (lineAmounts.length
      ? lineAmounts.reduce<Decimal>((sum, value) => sum.plus(value), new Decimal(0))
      : null);

  if (!canonicalCurrency) issues.push("currency must be a canonical uppercase ISO 4217 code");
  else if (digits === null)
    issues.push("currency must define ISO 4217 minor units to be supported for posting");
  else {
    for (const [field, value] of [
      ["subtotal", invoice.subtotal],
      ["tax", invoice.tax],
      ["total", invoice.total],
    ] as const)
      if (value !== null && !hasMinorUnitPrecision(value, digits))
        issues.push(`${field} exceeds ${invoice.currency} minor-unit precision`);

    if (subtotalBasis === null) issues.push("total cannot be reconciled from printed amounts");
    else if (!reconciles([subtotalBasis, invoice.tax ?? 0], invoice.total, digits))
      issues.push("subtotal + tax does not equal total");

    invoice.lines.forEach((line, index) => {
      if (line.lineTotal === null) return;
      if (!hasMinorUnitPrecision(line.lineTotal, digits))
        issues.push(`lines.${index}.lineTotal exceeds ${invoice.currency} minor-unit precision`);
      if (!reconciles([new Decimal(line.qty).mul(line.unitPrice)], line.lineTotal, digits))
        issues.push(`lines.${index} does not reconcile`);
    });
    if (
      invoice.subtotal !== null &&
      lineAmounts.length &&
      !reconciles(lineAmounts, invoice.subtotal, digits)
    )
      issues.push("line totals do not equal subtotal");
  }

  return { extracted: issues.length ? null : invoice, issues };
}

const lineLeaf = /^(sku|description|qty|unitPrice|lineTotal)$/;

const canonicalConfidenceField = (field: string) => {
  const normalized = field.replace(/\[(\d+)\]/g, ".$1");
  return lineLeaf.test(normalized) ? `lines.0.${normalized}` : normalized;
};

const entries = (invoice: NormalizedInvoice) =>
  invoice.confidence.map((item) => ({ ...item, field: canonicalConfidenceField(item.field) }));

const confidenceFor = (values: NormalizedInvoice["confidence"], field: string) => {
  const canonical = canonicalConfidenceField(field);
  const candidates = values.filter(
    (item) =>
      item.field === canonical || (canonical.startsWith("lines.") && item.field === "lines"),
  );
  return candidates.length ? Math.min(...candidates.map((item) => item.confidence)) : undefined;
};

const requiredConfidenceFields = (invoice: NormalizedInvoice) => [
  "invoiceNumber",
  "vendorName",
  "poNumber",
  "invoiceDate",
  "currency",
  ...(invoice.subtotalMinor === null ? [] : ["subtotal"]),
  ...(invoice.taxMinor === null ? [] : ["tax"]),
  "total",
  ...invoice.lines.flatMap((line, index) => [
    `lines.${index}.description`,
    `lines.${index}.qty`,
    `lines.${index}.unitPrice`,
    ...(line.sku === null ? [] : [`lines.${index}.sku`]),
    ...(line.lineTotalMinor === null ? [] : [`lines.${index}.lineTotal`]),
  ]),
];

export const confidenceProblems = (invoice: NormalizedInvoice, threshold: number) => {
  const required = requiredConfidenceFields(invoice), values = entries(invoice);
  const missingConfidence = required.filter((field) => confidenceFor(values, field) === undefined);
  const uncertainFields = required.filter((field) => {
    const confidence = confidenceFor(values, field);
    return confidence !== undefined && confidence < threshold;
  });
  return { uncertainFields, missingConfidence };
};

export const hasLowConfidence = (
  invoice: NormalizedInvoice,
  fields: string[],
  threshold: number,
) => {
  const values = entries(invoice);
  return fields.some((field) => {
    const canonical = canonicalConfidenceField(field);
    if (canonical === "lines")
      return values.some(
        (item) =>
          (item.field === "lines" || item.field.startsWith("lines.")) &&
          item.confidence < threshold,
      );
    if (lineLeaf.test(field))
      return values.some((item) => item.field.endsWith(`.${field}`) && item.confidence < threshold);
    const confidence = confidenceFor(values, canonical);
    return confidence !== undefined && confidence < threshold;
  });
};

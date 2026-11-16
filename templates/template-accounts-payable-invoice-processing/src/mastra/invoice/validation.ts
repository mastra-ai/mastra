import { ExtractedInvoiceSchema, type ExtractedInvoice, type InvoiceDraft, type NormalizedInvoice } from './schema.ts';

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
      issues: parsed.error.issues.map(issue => `${issue.path.join('.') || 'invoice'}: ${issue.message}`),
    };
  return { extracted: parsed.data, issues: [] };
}

const lineLeaf = /^(sku|description|qty|unitPrice|lineTotal)$/;

const canonicalConfidenceField = (field: string) => {
  const normalized = field.replace(/\[(\d+)\]/g, '.$1');
  return lineLeaf.test(normalized) ? `lines.0.${normalized}` : normalized;
};

const entries = (invoice: NormalizedInvoice) =>
  invoice.confidence.map(item => ({ ...item, field: canonicalConfidenceField(item.field) }));

const confidenceFor = (values: NormalizedInvoice['confidence'], field: string) => {
  const canonical = canonicalConfidenceField(field);
  const candidates = values.filter(
    item => item.field === canonical || (canonical.startsWith('lines.') && item.field === 'lines'),
  );
  return candidates.length ? Math.min(...candidates.map(item => item.confidence)) : undefined;
};

const requiredConfidenceFields = (invoice: NormalizedInvoice) => [
  'invoiceNumber',
  'vendorName',
  'poNumber',
  'invoiceDate',
  'currency',
  ...(invoice.subtotalMinor === null ? [] : ['subtotal']),
  ...(invoice.taxMinor === null ? [] : ['tax']),
  'total',
  ...invoice.lines.flatMap((line, index) => [
    `lines.${index}.description`,
    `lines.${index}.qty`,
    `lines.${index}.unitPrice`,
    ...(line.sku === null ? [] : [`lines.${index}.sku`]),
    ...(line.lineTotalMinor === null ? [] : [`lines.${index}.lineTotal`]),
  ]),
];

export const confidenceProblems = (invoice: NormalizedInvoice, threshold: number) => {
  const required = requiredConfidenceFields(invoice),
    values = entries(invoice);
  const missingConfidence = required.filter(field => confidenceFor(values, field) === undefined);
  const uncertainFields = required.filter(field => {
    const confidence = confidenceFor(values, field);
    return confidence !== undefined && confidence < threshold;
  });
  return { uncertainFields, missingConfidence };
};

export const hasLowConfidence = (invoice: NormalizedInvoice, fields: string[], threshold: number) => {
  const values = entries(invoice);
  return fields.some(field => {
    const canonical = canonicalConfidenceField(field);
    if (canonical === 'lines')
      return values.some(
        item => (item.field === 'lines' || item.field.startsWith('lines.')) && item.confidence < threshold,
      );
    if (lineLeaf.test(field))
      return values.some(item => item.field.endsWith(`.${field}`) && item.confidence < threshold);
    const confidence = confidenceFor(values, canonical);
    return confidence !== undefined && confidence < threshold;
  });
};

import type { Phase2Invoice } from './schemas.ts';

const lineLeaf = /^(sku|description|qty|unitPrice|lineTotal)$/;

export const canonicalConfidenceField = (field: string) => {
  const normalized = field.replace(/\[(\d+)\]/g, '.$1');
  return lineLeaf.test(normalized) ? `lines.0.${normalized}` : normalized;
};

const entries = (invoice: Phase2Invoice) =>
  invoice.confidence.map(item => ({ ...item, field: canonicalConfidenceField(item.field) }));

export const confidenceFor = (invoice: Phase2Invoice, field: string) => {
  const canonical = canonicalConfidenceField(field);
  const values = entries(invoice);
  const candidates = values.filter(
    item => item.field === canonical || (canonical.startsWith('lines.') && item.field === 'lines'),
  );
  return candidates.length ? Math.min(...candidates.map(item => item.confidence)) : undefined;
};

export const requiredConfidenceFields = (invoice: Phase2Invoice) => [
  'invoiceNumber',
  'vendorName',
  'poNumber',
  'invoiceDate',
  'currency',
  'subtotal',
  'tax',
  'total',
  ...invoice.lines.flatMap((line, index) => [
    `lines.${index}.description`,
    `lines.${index}.qty`,
    `lines.${index}.unitPrice`,
    ...(line.sku === null ? [] : [`lines.${index}.sku`]),
    ...(line.lineTotalMinor === null ? [] : [`lines.${index}.lineTotal`]),
  ]),
];

export const confidenceProblems = (invoice: Phase2Invoice, threshold: number) => {
  const required = requiredConfidenceFields(invoice);
  const missingConfidence = required.filter(field => confidenceFor(invoice, field) === undefined);
  const uncertainFields = required.filter(field => {
    const confidence = confidenceFor(invoice, field);
    return confidence !== undefined && confidence < threshold;
  });
  return { uncertainFields, missingConfidence };
};

export const hasLowConfidence = (invoice: Phase2Invoice, fields: string[], threshold: number) => {
  const values = entries(invoice);
  return fields.some(field => {
    const canonical = canonicalConfidenceField(field);
    if (canonical === 'lines')
      return values.some(
        item => (item.field === 'lines' || item.field.startsWith('lines.')) && item.confidence < threshold,
      );
    if (lineLeaf.test(field))
      return values.some(item => item.field.endsWith(`.${field}`) && item.confidence < threshold);
    const confidence = confidenceFor(invoice, canonical);
    return confidence !== undefined && confidence < threshold;
  });
};

import { createScorer } from '@mastra/core/evals';
import type { ExtractedInvoice, InvoiceDraft } from '../schemas/invoice.ts';

type FidelityReport = { fields: Record<string, number>; overall: number };
const same = (left: unknown, right: unknown) =>
  left === null || right === null
    ? left === right
    : typeof left === 'number' && typeof right === 'number'
      ? left === right
      : typeof left === 'string' && typeof right === 'string'
        ? left.trim().toLowerCase() === right.trim().toLowerCase()
        : Object.is(left, right);
export function scoreExtraction(actual: InvoiceDraft, expected: ExtractedInvoice): FidelityReport {
  const fields: Record<string, number> = {};
  for (const field of [
    'invoiceNumber',
    'vendorName',
    'vendorTaxId',
    'poNumber',
    'invoiceDate',
    'currency',
    'subtotal',
    'tax',
    'total',
    'source',
  ] as const)
    fields[field] = same(actual[field], expected[field]) ? 1 : 0;
  const lineFields = ['sku', 'description', 'qty', 'unitPrice', 'lineTotal'] as const;
  const lines = actual.lines ?? [];
  fields['lines.count'] = lines.length === expected.lines.length ? 1 : 0;
  for (const field of lineFields)
    fields[`lines.${field}`] =
      lines.length === expected.lines.length &&
      lines.every((line, index) => same(line[field], expected.lines[index]?.[field]))
        ? 1
        : 0;
  return {
    fields,
    overall: Object.values(fields).reduce((sum, score) => sum + score, 0) / Object.keys(fields).length,
  };
}
export const extractionFidelityScorer = createScorer<ExtractedInvoice, InvoiceDraft>({
  id: 'extraction-fidelity',
  description: 'Deterministically scores invoice extraction fidelity before human correction.',
})
  .analyze(({ run }) =>
    run.output && run.input ? scoreExtraction(run.output, run.input) : { fields: { output: 0 }, overall: 0 },
  )
  .generateScore(({ results }) => results.analyzeStepResult.overall)
  .generateReason(
    ({ results, score }) =>
      `score=${score}; failed=${
        Object.entries(results.analyzeStepResult.fields)
          .filter(([, value]) => value === 0)
          .map(([field]) => field)
          .join(',') || 'none'
      }`,
  );

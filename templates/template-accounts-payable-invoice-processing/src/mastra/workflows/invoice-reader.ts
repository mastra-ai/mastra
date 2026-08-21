import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { invoiceReader, prepareDocument } from '../readers/invoice-reader.ts';
import {
  DocumentRefSchema,
  ExtractedInvoiceSchema,
  ExtractionChecksSchema,
  HumanVerificationSchema,
  InvoiceDraftSchema,
  ReviewerContextSchema,
} from '../schemas/invoice.ts';
import { validateExtraction } from '../validation/extraction-checks.ts';

const extractedSchema = z.object({ rawDocumentRef: DocumentRefSchema, draft: InvoiceDraftSchema });
const verifiedSchema = z.object({
  rawDocumentRef: DocumentRefSchema,
  extractedResult: ExtractedInvoiceSchema,
  checks: ExtractionChecksSchema,
  reviewerId: z.string().nullable(),
});
const outputSchema = verifiedSchema.extend({
  snapshot: z.object({
    rawDocumentRef: DocumentRefSchema,
    extractedResult: ExtractedInvoiceSchema,
  }),
});

const loadDocument = createStep({
  id: 'load-document',
  inputSchema: DocumentRefSchema,
  outputSchema: DocumentRefSchema,
  execute: async ({ inputData }) => prepareDocument(inputData),
});
const extractInvoice = createStep({
  id: 'extract-invoice',
  inputSchema: DocumentRefSchema,
  outputSchema: extractedSchema,
  execute: async ({ inputData }) => ({
    rawDocumentRef: inputData,
    draft: { ...(await invoiceReader.read(inputData)), source: inputData.source },
  }),
});
const verifyInvoice = createStep({
  id: 'verify-invoice',
  inputSchema: extractedSchema,
  outputSchema: verifiedSchema,
  suspendSchema: z.object({ issues: z.array(z.string()), draft: InvoiceDraftSchema }),
  resumeSchema: HumanVerificationSchema,
  requestContextSchema: ReviewerContextSchema,
  execute: async ({ inputData, resumeData, requestContext, suspend }) => {
    const reviewerId = resumeData ? (requestContext.get('reviewerId') ?? null) : null;
    if (resumeData && !reviewerId)
      throw new Error('reviewerId must come from authenticated request context when resuming verification');
    const originalCandidate = {
      ...inputData.draft,
      source: inputData.rawDocumentRef.source,
    };
    const originalIssues = validateExtraction(originalCandidate).issues;
    const candidate = {
      ...(resumeData?.extracted ?? inputData.draft),
      source: inputData.rawDocumentRef.source,
    };
    const { extracted, issues } = validateExtraction(candidate);
    if (!extracted) return await suspend({ issues, draft: candidate });
    return {
      rawDocumentRef: inputData.rawDocumentRef,
      extractedResult: extracted,
      checks: { passed: true, issues: resumeData ? originalIssues : issues },
      reviewerId,
    };
  },
});
const snapshotTrustedExtraction = createStep({
  id: 'snapshot-trusted-extraction',
  inputSchema: verifiedSchema,
  outputSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    snapshot: {
      rawDocumentRef: inputData.rawDocumentRef,
      extractedResult: inputData.extractedResult,
    },
  }),
});

export const invoiceReaderWorkflow = createWorkflow({
  id: 'invoice-reader-workflow',
  inputSchema: DocumentRefSchema,
  outputSchema,
  requestContextSchema: ReviewerContextSchema,
  options: { shouldPersistSnapshot: () => true },
})
  .then(loadDocument)
  .then(extractInvoice)
  .then(verifyInvoice)
  .then(snapshotTrustedExtraction)
  .commit();

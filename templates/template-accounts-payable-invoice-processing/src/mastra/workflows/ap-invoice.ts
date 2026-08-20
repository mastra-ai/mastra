import { createWorkflow } from '@mastra/core/workflows';
import { apExecutionWorkflow } from '../phase3/workflow.ts';
import { Phase3ResultSchema } from '../phase2/schemas.ts';
import { apDecisionWorkflow } from '../phase2/workflow.ts';
import { DocumentRefSchema, ReviewerContextSchema } from '../schemas/invoice.ts';
import { invoiceReaderWorkflow } from './invoice-reader.ts';

export const apInvoiceWorkflow = createWorkflow({
  id: 'ap-invoice-workflow',
  inputSchema: DocumentRefSchema,
  outputSchema: Phase3ResultSchema,
  requestContextSchema: ReviewerContextSchema,
  options: { shouldPersistSnapshot: () => true },
})
  .then(invoiceReaderWorkflow)
  .then(apDecisionWorkflow)
  .then(apExecutionWorkflow)
  .commit();

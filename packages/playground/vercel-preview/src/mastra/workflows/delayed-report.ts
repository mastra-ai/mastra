import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';

const reportSchema = z.object({ message: z.string().min(1).max(200).default('The report is ready.') });

const publishReport = createStep({
  id: 'publish-report',
  description: 'Return the report after the waiting period.',
  inputSchema: reportSchema,
  outputSchema: reportSchema,
  execute: async ({ inputData }) => inputData,
});

export const delayedReport = createWorkflow({
  id: 'delayed-report',
  description: 'Wait eight seconds, then return a report. Inspect real running and completed states.',
  inputSchema: reportSchema,
  outputSchema: reportSchema,
})
  .sleep(8000, { id: 'wait-for-report', description: 'Give the report eight seconds before publishing.' })
  .then(publishReport)
  .commit();

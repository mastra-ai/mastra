import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';

const documentSchema = z.object({ title: z.string().min(1).max(120), text: z.string().trim().min(1).max(5000) });
const analysisSchema = z.object({ title: z.string(), excerpt: z.string(), words: z.number() });
const reportSchema = z.object({ processed: z.number(), documents: z.array(analysisSchema) });

const countWords = createStep({
  id: 'count-words',
  inputSchema: documentSchema,
  outputSchema: z.object({ words: z.number() }),
  execute: async ({ inputData }) => ({ words: inputData.text.split(/\s+/).length }),
});

const extractExcerpt = createStep({
  id: 'extract-excerpt',
  inputSchema: documentSchema,
  outputSchema: z.object({ title: z.string(), excerpt: z.string() }),
  execute: async ({ inputData }) => ({ title: inputData.title, excerpt: inputData.text.slice(0, 80) }),
});

const analyzeDocument = createWorkflow({
  id: 'analyze-document',
  description: 'Count words and extract an excerpt in parallel.',
  inputSchema: documentSchema,
  outputSchema: analysisSchema,
})
  .parallel([countWords, extractExcerpt])
  .map(async ({ inputData }) => ({ ...inputData['count-words'], ...inputData['extract-excerpt'] }))
  .commit();

export const documentBatchInputSchema = z.object({
  documents: z
    .array(documentSchema)
    .min(1)
    .max(10)
    .default([
      { title: 'Getting started', text: 'Create a workflow, connect its steps, and inspect the output in Studio.' },
      { title: 'Human review', text: 'Suspend a run when a reviewer needs to approve a decision.' },
      { title: 'Batch processing', text: 'Use foreach to process each document with the same nested workflow.' },
    ]),
});

export const documentBatch = createWorkflow({
  id: 'document-batch',
  description: 'Process documents with foreach, a nested workflow, parallel steps, and output mapping.',
  inputSchema: documentBatchInputSchema,
  outputSchema: reportSchema,
})
  .map(async ({ inputData }) => inputData.documents)
  .foreach(analyzeDocument, { concurrency: 2 })
  .map(async ({ inputData }) => ({ processed: inputData.length, documents: inputData }))
  .commit();

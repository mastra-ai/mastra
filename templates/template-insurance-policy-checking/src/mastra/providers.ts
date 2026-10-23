import { inputLimits, inputLimitsSchema } from './config/limits.js';
import { createApprovedOutputProvider } from './providers/approved-output.js';
import { createDraftPdfProvider } from './providers/draft-pdf.js';
import { createPdfProvider } from './providers/pdf.js';
import type { InputProvider, OutputProvider } from './domain/contracts.js';

export const input: InputProvider[] = [createPdfProvider(inputLimitsSchema.parse(inputLimits))];
export const draftOutput: OutputProvider<'draftOutput'>[] = [createDraftPdfProvider()];
export const reportOutput: OutputProvider<'reportOutput'>[] = [createApprovedOutputProvider('reportOutput')];
export const correctionOutput: OutputProvider<'correctionOutput'>[] = [
  createApprovedOutputProvider('correctionOutput'),
];
export const providerDefaults = {
  input: 'local-pdf',
  draftOutput: 'local-pdf-draft',
  reportOutput: 'local-pdf-final',
  correctionOutput: 'local-markdown-correction',
};

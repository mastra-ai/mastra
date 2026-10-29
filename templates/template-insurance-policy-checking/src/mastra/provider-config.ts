import { inputLimits, inputLimitsSchema } from './config/input-limits-config.js';
import type { InputProvider, OutputProvider } from './domain/case-contracts.js';
import { createApprovedOutputProvider } from './providers/approved-output-provider.js';
import { createDraftPdfProvider } from './providers/draft-pdf-provider.js';
import { createPdfProvider } from './providers/pdf-input-provider.js';

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

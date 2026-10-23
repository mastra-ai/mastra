import { inputLimits, inputLimitsSchema } from './config/limits.js';
import { createDraftPdfProvider } from './providers/draft-pdf.js';
import { createPdfProvider } from './providers/pdf.js';
import type { InputProvider, OutputProvider } from './domain/contracts.js';

export const input: InputProvider[] = [createPdfProvider(inputLimitsSchema.parse(inputLimits))];
// Final and correction stages are registered when their review authority is implemented.
export const draftOutput: OutputProvider<'draftOutput'>[] = [createDraftPdfProvider()];
export const reportOutput: OutputProvider<'reportOutput'>[] = [];
export const correctionOutput: OutputProvider<'correctionOutput'>[] = [];
export const providerDefaults = { input: 'local-pdf', draftOutput: 'local-pdf-draft' };

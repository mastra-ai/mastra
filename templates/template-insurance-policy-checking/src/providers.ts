import { inputLimits, inputLimitsSchema } from './config/limits.js';
import { createPdfProvider } from './mastra/providers/pdf.js';
import type { InputProvider, OutputProvider } from './mastra/domain/contracts.js';

export const input: InputProvider[] = [createPdfProvider(inputLimitsSchema.parse(inputLimits))];
// Output registrations are introduced with the corresponding publication stages.
export const draftOutput: OutputProvider<'draftOutput'>[] = [];
export const reportOutput: OutputProvider<'reportOutput'>[] = [];
export const correctionOutput: OutputProvider<'correctionOutput'>[] = [];
export const providerDefaults = { input: 'local-pdf' };

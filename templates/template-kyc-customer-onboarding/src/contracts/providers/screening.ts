import { z } from 'zod';

import type { providerIdSchema } from '../../domain/identifiers.js';
import { caseIdSchema } from '../../domain/identifiers.js';
import type { screeningResultSchema } from '../../domain/verification.js';
import type { ProviderExecutionContext } from '../shared/execution-context.js';
import type { providerCapabilitiesSchema } from '../shared/provider.js';

export const screeningInputSchema = z
  .object({
    caseId: caseIdSchema,
    fullName: z.string().min(1).max(200),
    aliases: z.array(z.string().min(1).max(200)),
    dateOfBirth: z.iso.date().nullable(),
    nationality: z.string().length(2).nullable(),
    jurisdiction: z.string().length(2),
    policyVersion: z.string().min(1).max(64),
  })
  .strict();

export type ScreeningInput = z.infer<typeof screeningInputSchema>;
export type ScreeningProviderResult = z.infer<typeof screeningResultSchema>;

export interface SanctionsScreeningProvider {
  readonly id: z.infer<typeof providerIdSchema>;
  readonly version: string;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  screen(input: ScreeningInput, context: ProviderExecutionContext): Promise<ScreeningProviderResult>;
}

export interface PepScreeningProvider {
  readonly id: z.infer<typeof providerIdSchema>;
  readonly version: string;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  screen(input: ScreeningInput, context: ProviderExecutionContext): Promise<ScreeningProviderResult>;
}

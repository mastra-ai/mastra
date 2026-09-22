import { z } from 'zod';

import { postalAddressSchema } from '../../domain/application.js';
import type { providerIdSchema } from '../../domain/identifiers.js';
import { caseIdSchema } from '../../domain/identifiers.js';
import type { verificationResultSchema } from '../../domain/verification.js';
import type { ProviderExecutionContext } from '../shared/execution-context.js';
import type { providerCapabilitiesSchema } from '../shared/provider.js';

const verificationInputBase = {
  caseId: caseIdSchema,
  jurisdiction: z.string().length(2),
  policyVersion: z.string().min(1).max(64),
};

export const identityVerificationInputSchema = z
  .object({
    ...verificationInputBase,
    applicationFullName: z.string().min(1).max(200),
    extractedFullName: z.string().min(1).max(500).nullable(),
  })
  .strict();
export const addressVerificationInputSchema = z
  .object({
    ...verificationInputBase,
    applicationAddress: postalAddressSchema,
    extractedAddress: z.string().min(1).max(500).nullable(),
  })
  .strict();

export type IdentityVerificationInput = z.infer<typeof identityVerificationInputSchema>;
export type AddressVerificationInput = z.infer<typeof addressVerificationInputSchema>;
export type VerificationProviderResult = z.infer<typeof verificationResultSchema>;

export interface IdentityVerificationProvider {
  readonly id: z.infer<typeof providerIdSchema>;
  readonly version: string;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  verify(input: IdentityVerificationInput, context: ProviderExecutionContext): Promise<VerificationProviderResult>;
}

export interface AddressVerificationProvider {
  readonly id: z.infer<typeof providerIdSchema>;
  readonly version: string;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  verify(input: AddressVerificationInput, context: ProviderExecutionContext): Promise<VerificationProviderResult>;
}

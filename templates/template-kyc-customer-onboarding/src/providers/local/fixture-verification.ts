import type {
  AddressVerificationInput,
  AddressVerificationProvider,
  IdentityVerificationInput,
  IdentityVerificationProvider,
  VerificationProviderResult,
} from '../../contracts/providers/verification.js';
import {
  addressVerificationInputSchema,
  identityVerificationInputSchema,
} from '../../contracts/providers/verification.js';
import type { ProviderExecutionContext } from '../../contracts/shared/execution-context.js';
import type { ProviderCapabilities } from '../../contracts/shared/provider.js';
import type { Clock } from '../../contracts/technical/primitives.js';
import { verificationResultSchema } from '../../domain/verification.js';
import { SystemClock } from './deterministic-primitives.js';
import { providerTimestamp } from './provider-time.js';
import { executeProviderOperation, parseProviderBoundary, parseProviderResult } from './provider-validation.js';

const capabilities = (operation: 'IDENTITY_VERIFICATION' | 'ADDRESS_VERIFICATION'): ProviderCapabilities =>
  Object.freeze({
    operations: [operation],
    environments: ['test', 'demo-default', 'demo-strict'],
    externalNetwork: false,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: operation === 'IDENTITY_VERIFICATION' ? ['IDENTITY'] : ['ADDRESS'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  } satisfies ProviderCapabilities);

const result = (
  id: string,
  operation: 'IDENTITY_VERIFICATION' | 'ADDRESS_VERIFICATION',
  inputValue: string,
  extractedValue: string | null,
  context: ProviderExecutionContext,
  clock: Clock,
): VerificationProviderResult => {
  const matches = extractedValue !== null && inputValue.trim().toUpperCase() === extractedValue.trim().toUpperCase();
  return {
    status: extractedValue === null ? 'INCONCLUSIVE' : matches ? 'VERIFIED' : 'NOT_VERIFIED',
    reasonCodes: [extractedValue === null ? 'FIELD_UNAVAILABLE' : matches ? 'NORMALIZED_MATCH' : 'MISMATCH'],
    evidenceIds: [],
    providerId: id,
    providerVersion: '1.0.0',
    completedAt: providerTimestamp(clock, context, id, operation),
  };
};

const normalizeAddress = (value: string): string =>
  value
    .normalize('NFKD')
    .replaceAll(/[^\p{Letter}\p{Number}]/gu, '')
    .toUpperCase();

export class FixtureIdentityVerificationProvider implements IdentityVerificationProvider {
  readonly id = 'local-identity';
  readonly version = '1.0.0';
  readonly capabilities = capabilities('IDENTITY_VERIFICATION');

  constructor(private readonly clock: Clock = new SystemClock()) {}

  async verify(
    input: IdentityVerificationInput,
    context: ProviderExecutionContext,
  ): Promise<VerificationProviderResult> {
    const identity = {
      providerId: this.id,
      operation: 'IDENTITY_VERIFICATION' as const,
    };
    return executeProviderOperation(identity, () => {
      const boundary = parseProviderBoundary(identityVerificationInputSchema, input, context, identity);
      return parseProviderResult(
        verificationResultSchema,
        result(
          this.id,
          identity.operation,
          boundary.input.applicationFullName,
          boundary.input.extractedFullName,
          boundary.context,
          this.clock,
        ),
        identity,
      );
    });
  }
}

export class FixtureAddressVerificationProvider implements AddressVerificationProvider {
  readonly id = 'local-address';
  readonly version = '1.0.0';
  readonly capabilities = capabilities('ADDRESS_VERIFICATION');

  constructor(private readonly clock: Clock = new SystemClock()) {}

  async verify(
    input: AddressVerificationInput,
    context: ProviderExecutionContext,
  ): Promise<VerificationProviderResult> {
    const identity = {
      providerId: this.id,
      operation: 'ADDRESS_VERIFICATION' as const,
    };
    return executeProviderOperation(identity, () => {
      const boundary = parseProviderBoundary(addressVerificationInputSchema, input, context, identity);
      const applicationAddress = [
        boundary.input.applicationAddress.line1,
        boundary.input.applicationAddress.line2,
        boundary.input.applicationAddress.city,
        boundary.input.applicationAddress.region,
        boundary.input.applicationAddress.postalCode,
      ]
        .filter((value): value is string => value !== undefined)
        .join(' ');
      const extractedAddress = boundary.input.extractedAddress;
      return parseProviderResult(
        verificationResultSchema,
        result(
          this.id,
          identity.operation,
          normalizeAddress(applicationAddress),
          extractedAddress === null ? null : normalizeAddress(extractedAddress),
          boundary.context,
          this.clock,
        ),
        identity,
      );
    });
  }
}

import type { EvidenceProviderInput, EvidenceSourceV1 } from '../evidence/contracts.js';

export interface ReadOnlyEvidenceProvider<Source extends EvidenceSourceV1 = EvidenceSourceV1> {
  readonly source: Source;
  readonly providerId: string;
  inspect(input: EvidenceProviderInput, options: Readonly<{ signal: AbortSignal; attempt: 1 | 2 }>): Promise<unknown>;
}

export type IdentityEvidenceProvider = ReadOnlyEvidenceProvider<'identity'>;

export type EndpointEvidenceProvider = ReadOnlyEvidenceProvider<'endpoint'>;

export type CloudEvidenceProvider = ReadOnlyEvidenceProvider<'cloud'>;

export type LocalProviderBehavior =
  | 'success'
  | 'not_found'
  | 'timeout'
  | 'unavailable'
  | 'rate_limited'
  | 'invalid_response';

export type SafeProviderCall = Readonly<{
  tenantId: string;
  incidentId: string;
  subjectId: string;
  workflowRunId: string;
  attempt: 1 | 2;
}>;

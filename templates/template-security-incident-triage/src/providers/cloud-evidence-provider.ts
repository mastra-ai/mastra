import type { EvidenceFact } from '../evidence/contracts.js';
import type { CloudEvidenceProvider, SafeProviderCall } from './evidence-provider.js';
import { executeLocalInspection, type LocalProviderOptions } from './local-evidence.js';
import { REFERENCE_ALLOWED_COUNTRY } from '../triage/policy-registry.js';

export class LocalCloudEvidenceProvider implements CloudEvidenceProvider {
  readonly source = 'cloud' as const;
  readonly providerId = 'local-cloud';
  readonly calls: SafeProviderCall[] = [];
  constructor(
    private readonly options: LocalProviderOptions & {
      countryByIp?: Readonly<Record<string, 'US' | 'CA' | 'BR'>>;
      allowedCountry?: 'US' | 'CA';
      includeIpPresence?: boolean;
      includeSessionHistory?: boolean;
    } = {},
  ) {}
  async inspect(
    input: Parameters<CloudEvidenceProvider['inspect']>[0],
    options: Parameters<CloudEvidenceProvider['inspect']>[1],
  ) {
    return executeLocalInspection({
      provider: this.providerId,
      providerRef: 'cloud',
      request: input,
      signal: options.signal,
      attempt: options.attempt,
      behavior: this.options.behavior ?? 'success',
      ...(this.options.release ? { release: this.options.release } : {}),
      ...(this.options.onStart ? { onStart: this.options.onStart } : {}),
      callLog: this.calls,
      facts: async request => cloudFacts(request.occurredAt, request.incidentKind, request.ip, this.options),
    });
  }
}

function cloudFacts(
  observedAt: string,
  kind: string,
  ip: string | undefined,
  options: Readonly<{
    countryByIp?: Readonly<Record<string, 'US' | 'CA' | 'BR'>>;
    allowedCountry?: 'US' | 'CA';
    includeIpPresence?: boolean;
    includeSessionHistory?: boolean;
  }>,
): readonly EvidenceFact[] {
  const country = options.countryByIp
    ? ip
      ? options.countryByIp[ip]
      : undefined
    : ip === '8.8.8.8'
      ? 'US'
      : ip === '200.160.2.3'
        ? 'BR'
        : kind === 'disallowed_country_login'
          ? 'CA'
          : 'US';
  const ipPresent = ip !== undefined;
  return [
    ...(ipPresent && country ? [fact(observedAt, 'observed-country', 'login.country', country)] : []),
    fact(observedAt, 'allowed-country', 'policy.allowedCountry', options.allowedCountry ?? REFERENCE_ALLOWED_COUNTRY),
    ...(kind === 'disallowed_country_login' && options.includeIpPresence !== false
      ? [booleanFact(observedAt, 'source-ip-present', 'login.ipPresent', ipPresent)]
      : []),
    ...(options.includeSessionHistory !== false &&
    (kind === 'disallowed_country_login' || kind === 'unknown_device_login')
      ? [booleanFact(observedAt, 'abnormal-session-history', 'session.abnormalHistory', false)]
      : []),
  ];
}

function booleanFact(observedAt: string, semanticKey: string, factType: string, value: boolean): EvidenceFact {
  return {
    semanticKey,
    observedAt,
    factType,
    value,
    confidence: 1,
    confidenceProvenance: 'rule-v1',
    rawPayloadRef: `protected:cloud:${semanticKey}`,
    sensitivity: 'confidential',
    incomplete: false,
  };
}

function fact(observedAt: string, semanticKey: string, factType: string, value: string): EvidenceFact {
  return {
    semanticKey,
    observedAt,
    factType,
    value,
    confidence: factType === 'login.country' ? 0.8 : 1,
    confidenceProvenance: factType === 'login.country' ? 'provider' : 'rule-v1',
    rawPayloadRef: `protected:cloud:${semanticKey}`,
    sensitivity: 'confidential',
    incomplete: false,
  };
}

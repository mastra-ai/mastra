import { createHash } from 'node:crypto';

import {
  EvidenceProviderResultSchema,
  type EvidenceProviderInput,
  type EvidenceProviderResult,
} from '../evidence/contracts.js';
import type { IdentityEvidenceProvider } from './evidence-provider.js';
import type { GeoIpProvider } from './geoip-provider.js';

/** Adds the approved, minimal GeoIP projection to identity gathering only. */
export class GeoIpIdentityEvidenceProvider implements IdentityEvidenceProvider {
  readonly source = 'identity' as const;
  readonly providerId = 'identity-geoip';
  constructor(
    private readonly options: Readonly<{
      base: IdentityEvidenceProvider;
      geoip: GeoIpProvider;
      timeoutMs: number;
    }>,
  ) {}

  async inspect(
    input: EvidenceProviderInput,
    options: Readonly<{ signal: AbortSignal; attempt: 1 | 2 }>,
  ): Promise<unknown> {
    // WorkOS and IPinfo are independent authorities. Start both reads before
    // awaiting either one so a slow identity response cannot prevent GeoIP
    // from using its own bounded deadline.
    const basePromise = this.options.base.inspect(input, options);
    const geoPromise = input.ip
      ? this.options.geoip.lookup({
          tenantId: input.tenantId,
          ip: input.ip,
          deadline: new Date(Date.now() + this.options.timeoutMs),
          signal: options.signal,
        })
      : undefined;
    const [baseValue, geo] = await Promise.all([basePromise, geoPromise]);
    const base = EvidenceProviderResultSchema.parse(baseValue);
    // runProviderInspection requires a stable result-level identity for the
    // adapter it invokes. Base facts retain their own provider explicitly.
    if (!input.ip) return wrapBaseResult(base, this.providerId);
    if (!geo || geo.outcome !== 'known') return wrapBaseResult(base, this.providerId);
    const rawPayloadRef = `sha256:${createHash('sha256').update(JSON.stringify(geo), 'utf8').digest('hex')}`;
    return EvidenceProviderResultSchema.parse({
      status: 'success',
      provider: this.providerId,
      facts: [
        ...(base.status === 'success'
          ? base.facts.map(fact => ({
              ...fact,
              provider: fact.provider ?? base.provider,
            }))
          : []),
        {
          semanticKey: 'login.ip_present',
          factType: 'login.ipPresent',
          value: true,
          observedAt: input.occurredAt,
          confidence: 1,
          confidenceProvenance: 'rule-v1',
          rawPayloadRef: `protected:identity-geoip:ip-present`,
          sensitivity: 'confidential',
          incomplete: false,
          provider: this.providerId,
        },
        {
          semanticKey: 'login.country',
          factType: 'login.country',
          value: geo.countryCode,
          observedAt: geo.observedAt,
          confidence: geo.confidence,
          confidenceProvenance: 'policy-v1',
          rawPayloadRef,
          sensitivity: 'internal',
          incomplete: false,
          provider: this.providerId,
        },
        ...(geo.asn
          ? [
              {
                semanticKey: 'geoip.asn',
                factType: 'geoip.asn',
                value: geo.asn,
                observedAt: geo.observedAt,
                confidence: geo.confidence,
                confidenceProvenance: 'rule-v1' as const,
                rawPayloadRef,
                sensitivity: 'internal' as const,
                incomplete: false,
                provider: this.providerId,
              },
            ]
          : []),
      ],
    });
  }
}

function wrapBaseResult(base: EvidenceProviderResult, wrapperProvider: string): EvidenceProviderResult {
  return EvidenceProviderResultSchema.parse(
    base.status === 'success'
      ? {
          ...base,
          provider: wrapperProvider,
          facts: base.facts.map(fact => ({
            ...fact,
            provider: fact.provider ?? base.provider,
          })),
        }
      : { ...base, provider: wrapperProvider },
  );
}

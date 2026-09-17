import { z } from 'zod';

export const GeoIpKnownSchema = z
  .object({
    outcome: z.literal('known'),
    countryCode: z.string().regex(/^[A-Z]{2}$/u),
    asn: z
      .string()
      .regex(/^AS[0-9]+$/u)
      .optional(),
    providerName: z.string().trim().min(1).max(256).optional(),
    observedAt: z.string().datetime({ offset: true }),
    provider: z.literal('ipinfo-lite'),
    confidence: z.literal(0.7),
    confidenceProvenance: z.literal('policy-v1'),
  })
  .strict();

export const GeoIpUnknownSchema = z
  .object({
    outcome: z.literal('unknown'),
    reasonCode: z.enum(['private', 'bogon', 'timeout', 'rate_limited', 'unavailable', 'invalid_response', 'disabled']),
  })
  .strict();

export const GeoIpLookupResultSchema = z.discriminatedUnion('outcome', [GeoIpKnownSchema, GeoIpUnknownSchema]);

export type GeoIpLookupResult = z.infer<typeof GeoIpLookupResultSchema>;

export interface GeoIpProvider {
  lookup(
    input: Readonly<{
      tenantId?: string;
      ip: string;
      deadline: Date;
      signal?: AbortSignal;
    }>,
  ): Promise<GeoIpLookupResult>;
}

export type GeoIpTransport = (
  input: Readonly<{
    url: string;
    headers: Readonly<Record<string, string>>;
    signal: AbortSignal;
  }>,
) => Promise<Readonly<{ status: number; json(): Promise<unknown> }>>;

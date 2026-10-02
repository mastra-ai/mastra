import { z } from 'zod';

import { boundedJsonObject, longText, opaqueId, schemaVersion, sha256, utcTimestamp } from './common.js';

export const EvidenceSourceSchema = z.enum(['identity', 'endpoint', 'cloud', 'geoip', 'policy']);

export const EvidenceSchema = z
  .object({
    schemaVersion,
    hashVersion: z.literal(1),
    evidenceId: opaqueId,
    incidentId: opaqueId,
    tenantId: opaqueId,
    source: EvidenceSourceSchema,
    provider: z.string().trim().min(1).max(64),
    observedAt: utcTimestamp,
    collectedAt: utcTimestamp,
    fact: boundedJsonObject,
    confidence: z.number().finite().min(0).max(1),
    rawPayloadRef: z.string().trim().min(1).max(512),
    integrityHash: sha256,
    sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']),
    incomplete: z.boolean().default(false),
    error: longText.optional(),
  })
  .strict();

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

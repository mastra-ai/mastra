import { z } from 'zod';

import { evidenceReference, longText, opaqueId, reference, schemaVersion } from './common.js';
import { IncidentSeveritySchema } from './incident.js';

const IncidentClaimSchema = z.discriminatedUnion('hypothesis', [
  z
    .object({
      text: longText,
      hypothesis: z.literal(false),
      references: z
        .array(reference)
        .min(1)
        .max(16)
        .refine(
          references => references.some(value => evidenceReference.safeParse(value).success),
          'factual claims require an evidence reference',
        ),
    })
    .strict(),
  z
    .object({
      text: longText,
      hypothesis: z.literal(true),
      references: z.array(reference).max(16),
    })
    .strict(),
]);

export const SeverityClassificationSchema = z
  .object({
    schemaVersion,
    incidentId: opaqueId,
    severity: IncidentSeveritySchema,
    rationale: longText,
    references: z.array(reference).min(1).max(32),
  })
  .strict();

export const IncidentSummarySchema = z
  .object({
    schemaVersion,
    incidentId: opaqueId,
    summary: longText,
    claims: z.array(IncidentClaimSchema).max(64),
  })
  .strict();

import { z } from 'zod';

import { opaqueId, tenantIdSchema, utcTimestamp } from '../schemas/common.js';
import { IncidentKindSchema } from '../schemas/incident.js';

export const MAX_CORRELATED_EVIDENCE_ITEMS = 3 * 16;
export const MAX_PAIRWISE_CONTRADICTIONS = (MAX_CORRELATED_EVIDENCE_ITEMS * (MAX_CORRELATED_EVIDENCE_ITEMS - 1)) / 2;

const InvestigationContextObjectSchema = z
  .object({
    // v1 remains readable for existing workflow runs. v2 is emitted only for a
    // validated privilege-change alert and carries no inferred authority.
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    eventId: opaqueId,
    alertId: opaqueId,
    incidentId: opaqueId,
    tenantId: tenantIdSchema,
    subjectId: opaqueId,
    workflowRunId: opaqueId,
    correlationId: opaqueId,
    incidentKind: IncidentKindSchema,
    occurredAt: utcTimestamp,
    sessionId: opaqueId.optional(),
    deviceId: opaqueId.optional(),
    ip: z.ipv4().or(z.ipv6()).optional(),
    actorId: opaqueId.optional(),
    roleChange: z
      .object({
        previousRole: z.enum(['admin', 'member', 'viewer']),
        currentRole: z.enum(['admin', 'member', 'viewer']),
      })
      .strict()
      .optional(),
    // This field is populated exclusively from the local authorization ledger
    // by loadInvestigationContext. A webhook/provider value is never trusted.
    changeApproved: z.boolean().optional(),
  })
  .strict();

export const InvestigationContextSchema = InvestigationContextObjectSchema.superRefine((value, context) => {
  if (
    value.schemaVersion === 2 &&
    value.incidentKind === 'unauthorized_privilege_change' &&
    (!value.actorId || !value.roleChange)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Privilege-change context v2 requires actor and role change.',
    });
  }
});

export const EvidenceProviderInputSchema = InvestigationContextObjectSchema.pick({
  tenantId: true,
  incidentId: true,
  subjectId: true,
  workflowRunId: true,
  incidentKind: true,
  occurredAt: true,
  sessionId: true,
  deviceId: true,
  ip: true,
  actorId: true,
  roleChange: true,
  changeApproved: true,
}).strict();

export const EvidenceProviderIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/u);

export const EvidenceFactSchema = z
  .object({
    semanticKey: z.string().trim().min(1).max(128),
    observedAt: utcTimestamp,
    factType: z.string().trim().min(1).max(64),
    value: z.union([z.string().max(2_048), z.number().finite(), z.boolean()]),
    confidence: z.number().finite().min(0).max(1),
    confidenceProvenance: z.enum(['provider', 'rule-v1', 'policy-v1']),
    rawPayloadRef: z.string().regex(/^(sha256:|protected:)[^\s]{1,480}$/u),
    sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']),
    incomplete: z.boolean().default(false),
    // v2 composition may carry facts from more than one provider in a single
    // branch result. Omitting this optional field preserves v1 behavior.
    provider: EvidenceProviderIdSchema.optional(),
  })
  .strict();

export const ProviderErrorSchema = z
  .object({
    code: z.enum(['NOT_FOUND', 'TIMEOUT', 'UNAVAILABLE', 'RATE_LIMITED', 'INVALID_RESPONSE', 'ABORTED']),
    retryable: z.boolean(),
    safeRef: z.string().regex(/^provider:[a-z][a-z0-9-]*:[a-z0-9-]+$/u),
    attempt: z.number().int().min(1).max(2),
  })
  .strict();

export const EvidenceProviderResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('success'),
      provider: EvidenceProviderIdSchema,
      facts: z.array(EvidenceFactSchema).min(1).max(16),
    })
    .strict(),
  providerFailureResult('not_found', 'NOT_FOUND', false),
  providerFailureResult('timeout', 'TIMEOUT', false),
  providerFailureResult('aborted', 'ABORTED', false),
  providerFailureResult('unavailable', 'UNAVAILABLE', true),
  providerFailureResult('rate_limited', 'RATE_LIMITED', true),
  providerFailureResult('operational_error', 'UNAVAILABLE', false),
  providerFailureResult('invalid_response', 'INVALID_RESPONSE', false),
]);

function providerFailureResult<
  const Status extends string,
  const Code extends z.infer<typeof ProviderErrorSchema>['code'],
  const Retryable extends boolean,
>(status: Status, code: Code, retryable: Retryable) {
  return z
    .object({
      status: z.literal(status),
      provider: EvidenceProviderIdSchema,
      error: ProviderErrorSchema.extend({
        code: z.literal(code),
        retryable: z.literal(retryable),
      }),
    })
    .strict();
}

export const EvidenceToolOutputSchema = z
  .object({
    toolCallId: opaqueId,
    result: EvidenceProviderResultSchema,
  })
  .strict();

export const EvidenceSourceV1Schema = z.enum(['identity', 'endpoint', 'cloud']);

export const BranchResultSchema = z
  .object({
    source: EvidenceSourceV1Schema,
    status: z.enum(['success', 'partial', 'failed']),
    evidenceIds: z.array(opaqueId).max(16),
    error: ProviderErrorSchema.optional(),
    startedAt: utcTimestamp,
    finishedAt: utcTimestamp,
    latencyMs: z.number().int().nonnegative(),
    stepId: z.string().regex(/^gather-(identity|endpoint|cloud)-evidence$/u),
    toolCallIds: z.array(opaqueId).max(2),
  })
  .strict();

export const ParallelEvidenceSchema = z
  .object({
    'gather-identity-evidence': BranchResultSchema,
    'gather-endpoint-evidence': BranchResultSchema,
    'gather-cloud-evidence': BranchResultSchema,
  })
  .strict();

export const CorrelationSchema = z
  .object({
    context: InvestigationContextSchema,
    branches: z.array(BranchResultSchema).length(3),
    orderedEvents: z
      .array(z.object({ evidenceId: opaqueId, observedAt: utcTimestamp }).strict())
      .max(MAX_CORRELATED_EVIDENCE_ITEMS),
    relations: z
      .array(
        z
          .object({
            fromEvidenceId: opaqueId,
            toEvidenceId: opaqueId,
            type: z.literal('same-subject-within-15m-v1'),
          })
          .strict(),
      )
      .max(MAX_CORRELATED_EVIDENCE_ITEMS - 1),
    contradictions: z
      .array(
        z
          .object({
            leftEvidenceId: opaqueId,
            rightEvidenceId: opaqueId,
            reason: z.string().trim().min(1).max(256),
          })
          .strict(),
      )
      .max(MAX_PAIRWISE_CONTRADICTIONS),
    missingData: z
      .array(
        z
          .object({
            source: EvidenceSourceV1Schema,
            evidenceId: opaqueId.optional(),
            reason: z.string().trim().min(1).max(256),
          })
          .strict(),
      )
      .max(MAX_CORRELATED_EVIDENCE_ITEMS),
  })
  .strict();

export type InvestigationContext = z.infer<typeof InvestigationContextSchema>;
export type EvidenceProviderInput = z.infer<typeof EvidenceProviderInputSchema>;
export type EvidenceFact = z.infer<typeof EvidenceFactSchema>;
export type EvidenceProviderResult = z.infer<typeof EvidenceProviderResultSchema>;
export type EvidenceSourceV1 = z.infer<typeof EvidenceSourceV1Schema>;
export type BranchResult = z.infer<typeof BranchResultSchema>;
export type Correlation = z.infer<typeof CorrelationSchema>;

import { z } from 'zod';

const opaqueIdentifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

export const tenantIdSchema = opaqueIdentifier;
export const caseIdSchema = opaqueIdentifier;
export const applicationIdSchema = opaqueIdentifier;
export const documentIdSchema = opaqueIdentifier;
export const evidenceIdSchema = opaqueIdentifier;
export const reviewIdSchema = opaqueIdentifier;
export const informationRequestIdSchema = opaqueIdentifier;
export const informationResponseIdSchema = opaqueIdentifier;
export const riskAssessmentIdSchema = opaqueIdentifier;
export const reviewDecisionIdSchema = opaqueIdentifier;
export const resumeCommandIdSchema = opaqueIdentifier;
export const eventIdSchema = opaqueIdentifier;
export const accountIdSchema = opaqueIdentifier;
export const notificationIdSchema = opaqueIdentifier;
export const threadIdSchema = opaqueIdentifier;
export const workflowRunIdSchema = opaqueIdentifier;
export const workflowIdSchema = opaqueIdentifier;
export const workflowStepIdSchema = opaqueIdentifier;
export const correlationIdSchema = opaqueIdentifier;
export const actorIdSchema = opaqueIdentifier;
export const providerIdSchema = opaqueIdentifier;
export const policyIdSchema = opaqueIdentifier;
export const modelIdSchema = opaqueIdentifier;
export const idempotencyKeySchema = z.string().min(8).max(256);
export const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/u);
export const timestampSchema = z.iso.datetime({ offset: true });

export type TenantId = z.infer<typeof tenantIdSchema>;
export type CaseId = z.infer<typeof caseIdSchema>;
export type EvidenceId = z.infer<typeof evidenceIdSchema>;

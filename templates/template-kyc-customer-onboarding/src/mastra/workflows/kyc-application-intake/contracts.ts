import { z } from 'zod';

import type { JurisdictionPolicyProvider } from '../../../contracts/policies/policies.js';
import type { CaseRepository } from '../../../contracts/repositories/case-repository.js';
import type { CasePolicySnapshotRepository } from '../../../contracts/repositories/decision-repositories.js';
import type { DocumentExtractionRepository } from '../../../contracts/repositories/document-extraction-repository.js';
import type { DocumentRepository } from '../../../contracts/repositories/document-repository.js';
import type { StudioCaseLinkRepository } from '../../../contracts/repositories/studio-case-link-repository.js';
import type { Clock } from '../../../contracts/technical/primitives.js';
import { executionContextSchema } from '../../../domain/context.js';
import { evidenceIdSchema, idempotencyKeySchema, providerIdSchema } from '../../../domain/identifiers.js';
import { caseIdSchema, documentIdSchema, threadIdSchema } from '../../../domain/identifiers.js';
import type { ApplicationIntakeService } from '../../../services/application-intake.js';
import type { CompletenessAssessmentService } from '../../../services/completeness-assessment.js';
import type { DocumentExtractionService } from '../../../services/document-extraction.js';
import type { DocumentIntakeService } from '../../../services/document-intake.js';
import { extractionAssessmentSchema } from '../../../services/extraction-assessment.js';
import type { ExtractionRoutingService } from '../../../services/extraction-routing.js';
import { screeningCheckOutputSchema, verificationCheckOutputSchema } from '../../../services/check-execution.js';
import type {
  AddressVerificationTool,
  IdentityVerificationTool,
  PepScreeningTool,
  SanctionsScreeningTool,
} from '../../tools/verification-checks.js';

export const kycWorkflowRequestContextSchema = z
  .object({
    ...executionContextSchema.shape,
    policyProfile: z.enum(['demo-default', 'demo-strict']),
  })
  .loose();

export type KycWorkflowRequestContext = z.infer<typeof kycWorkflowRequestContextSchema>;

export const fixtureKycApplicationWorkflowInputSchema = z
  .object({
    scenario: z.enum([
      'low-risk',
      'missing-fields',
      'unreadable',
      'expired-document',
      'missing-document-side',
      'identity-mismatch',
      'dob-mismatch',
      'address-mismatch',
      'address-inconclusive',
      'sanctions-strong',
      'sanctions-ambiguous',
      'pep-candidate',
      'provider-unavailable',
      'high-risk-escalation',
    ]),
    idempotencyKey: idempotencyKeySchema,
    studioThreadKey: threadIdSchema.optional(),
  })
  .strict();

const persistedKycApplicationWorkflowInputSchema = z
  .object({
    source: z.literal('persisted-case'),
    caseId: caseIdSchema,
    idempotencyKey: idempotencyKeySchema,
    studioThreadKey: threadIdSchema.optional(),
  })
  .strict();

export const kycApplicationWorkflowInputSchema = z.union([
  fixtureKycApplicationWorkflowInputSchema,
  persistedKycApplicationWorkflowInputSchema,
]);

export const kycApplicationWorkflowOutputSchema = z
  .object({
    caseId: caseIdSchema,
    documentId: documentIdSchema,
    status: z.enum(['CHECKING', 'MISSING_INFORMATION']),
    route: extractionAssessmentSchema.shape.route,
    quality: extractionAssessmentSchema.shape.quality,
    missingFields: extractionAssessmentSchema.shape.missingFields,
    lowConfidenceFields: extractionAssessmentSchema.shape.lowConfidenceFields,
    warnings: extractionAssessmentSchema.shape.warnings,
    providerId: providerIdSchema,
    readiness: z.enum(['READY_FOR_RISK_ASSESSMENT', 'AWAITING_INFORMATION']),
    checks: z
      .object({
        identity: verificationCheckOutputSchema,
        address: verificationCheckOutputSchema,
        sanctions: screeningCheckOutputSchema,
        pep: screeningCheckOutputSchema,
      })
      .strict()
      .nullable(),
    evidenceIds: z.array(evidenceIdSchema),
    automaticSteps: z.array(z.string().min(1)),
    message: z.string().min(1).max(500),
  })
  .strict();

export type KycApplicationWorkflowDependencies = Readonly<{
  cases: CaseRepository;
  applicationIntake: ApplicationIntakeService;
  documentIntake: DocumentIntakeService;
  documentExtraction: DocumentExtractionService;
  extractionRouting: ExtractionRoutingService;
  completeness: CompletenessAssessmentService;
  documents: DocumentRepository;
  documentExtractions: DocumentExtractionRepository;
  casePolicySnapshots: CasePolicySnapshotRepository;
  studioCaseLinks: StudioCaseLinkRepository;
  jurisdictionPolicy: JurisdictionPolicyProvider;
  clock: Clock;
  modelId: string;
  schemaVersion: string;
  timeoutMs: number;
  identityVerification: IdentityVerificationTool;
  addressVerification: AddressVerificationTool;
  sanctionsScreening: SanctionsScreeningTool;
  pepScreening: PepScreeningTool;
}>;

export const contextFrom = (value: KycWorkflowRequestContext) =>
  executionContextSchema.parse({
    tenantId: value.tenantId,
    jurisdiction: value.jurisdiction,
    piiMode: value.piiMode,
    policy: value.policy,
    locale: value.locale,
    correlationId: value.correlationId,
    actor: value.actor,
  });

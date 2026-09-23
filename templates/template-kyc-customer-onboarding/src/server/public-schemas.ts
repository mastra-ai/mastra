import { z } from 'zod';

import type {
  CaseEventsPage,
  CaseSummary,
  CreateCaseResult,
  CreateCaseRequest,
  DemoSession,
  EvalMetrics,
  MetricsSummary,
  ProviderMetrics,
  PublicError,
  ReviewDecisionRequest,
  ReviewPage,
  ReviewQueueItem,
  SubmitInformationRequest,
  UploadDocumentResult,
} from '../contracts/http/public-api.js';
import { publicSchemaVersion } from '../contracts/http/public-api.js';
import { applicationCorrectionsSchema, applicationDataSchema } from '../domain/application.js';
import { kycCaseStatusSchema } from '../domain/case.js';
import { documentIdSchema, informationRequestIdSchema, reviewIdSchema } from '../domain/identifiers.js';
import { reasonCodeSchema } from '../domain/reasons.js';
import { reviewDecisionSchema } from '../domain/review.js';

export const publicErrorSchema = z
  .object({
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
    correlationId: z.string().min(1).max(128),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const demoPersonaSchema = z.enum(['applicant', 'reviewer', 'senior-reviewer']);
export const createDemoSessionRequestSchema = z.object({ persona: demoPersonaSchema }).strict();
export const demoSessionSchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    persona: demoPersonaSchema,
    csrfToken: z.string().min(32).max(128),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const createCaseRequestSchema = z.object({ application: applicationDataSchema }).strict();
export const createCaseResultSchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    caseId: z.string().min(1).max(128),
    status: kycCaseStatusSchema,
  })
  .strict();
export const casePathSchema = z.object({ caseId: z.string().min(1).max(128) }).strict();
export const reviewPathSchema = z.object({ reviewId: reviewIdSchema }).strict();

const pendingActionSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('MISSING_INFORMATION'),
      requestId: informationRequestIdSchema,
      requestedItems: z.array(z.string().min(1).max(100)),
      safeMessage: z.string().min(1).max(500),
      expiresAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      type: z.literal('COMPLIANCE_REVIEW'),
      reviewId: reviewIdSchema,
      level: z.enum(['INITIAL', 'SENIOR']),
      expiresAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
]);

export const caseSummarySchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    caseId: z.string().min(1).max(128),
    status: kycCaseStatusSchema,
    workflowStatus: z.enum(['NOT_STARTED', 'RUNNING', 'SUSPENDED', 'COMPLETED']),
    documentReadiness: z
      .object({
        storedDocumentCount: z.number().int().nonnegative(),
        canStart: z.boolean(),
      })
      .strict(),
    pendingAction: pendingActionSchema.nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const uploadDocumentResultSchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    caseId: z.string().min(1).max(128),
    documentId: documentIdSchema,
    status: kycCaseStatusSchema,
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    sizeBytes: z.number().int().positive(),
    pageCount: z.number().int().positive().nullable(),
  })
  .strict();

export const caseEventViewSchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    eventId: z.string().min(1).max(128),
    caseId: z.string().min(1).max(128),
    status: kycCaseStatusSchema,
    eventType: z.enum(['CASE_CREATED', 'CASE_STATUS_TRANSITIONED']),
    reasonCode: z.string().min(1).max(100),
    occurredAt: z.iso.datetime({ offset: true }),
    caseVersion: z.number().int().positive(),
  })
  .strict();

export const caseEventsQuerySchema = z
  .object({
    cursor: z.string().min(1).max(128).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();
export const caseEventsPageSchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    events: z.array(caseEventViewSchema),
    nextCursor: z.string().min(1).max(128).nullable(),
    terminal: z.boolean(),
  })
  .strict();

export const submitInformationRequestSchema = z.object({
  requestId: informationRequestIdSchema,
  responseOption: z.enum([
    'IDENTITY_DOCUMENT',
    'IDENTITY_DOCUMENT_BACK',
    'PROOF_OF_ADDRESS',
    'CORRECTED_APPLICATION',
    'READABLE_DOCUMENT',
  ]),
  applicationCorrections: applicationCorrectionsSchema.optional(),
  documentIds: z.array(documentIdSchema).min(1),
});

export const customerResponseWebhookSchema = submitInformationRequestSchema
  .safeExtend({
    schemaVersion: z.literal(publicSchemaVersion),
    caseId: casePathSchema.shape.caseId,
  })
  .strict()
  .strict()
  .superRefine((value, context) => {
    const corrected = value.responseOption === 'CORRECTED_APPLICATION';
    if (corrected !== (value.applicationCorrections !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['applicationCorrections'],
        message: 'corrections must match response option',
      });
    }
  });

export const reviewQueueItemSchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    reviewId: reviewIdSchema,
    caseId: z.string().min(1).max(128),
    level: z.enum(['INITIAL', 'SENIOR']),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    riskRoute: z.enum(['AUTO_REVIEW', 'REJECT_RECOMMENDED', 'ESCALATE_RECOMMENDED', 'INSUFFICIENT_INFORMATION']),
    reasonCodes: z.array(reasonCodeSchema),
    allowedDecisions: z.array(
      z
        .object({
          decision: reviewDecisionSchema,
          reasonCode: z.enum(['REVIEW_APPROVED', 'REVIEW_REJECTED', 'REVIEW_ESCALATED']),
        })
        .strict(),
    ),
    expiresAt: z.iso.datetime({ offset: true }),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const reviewsQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.literal('PENDING').default('PENDING'),
  })
  .strict();
export const reviewPageSchema = z
  .object({
    schemaVersion: z.literal(publicSchemaVersion),
    reviews: z.array(reviewQueueItemSchema),
    nextCursor: z.string().min(1).max(512).nullable(),
  })
  .strict();

export const reviewDecisionRequestSchema = z
  .object({
    decision: reviewDecisionSchema,
    reasonCode: reasonCodeSchema,
    safeNote: z.string().min(1).max(500).optional(),
    feedback: z
      .object({
        extractionUseful: z.boolean().nullable(),
        screeningUseful: z.boolean().nullable(),
        riskUseful: z.boolean().nullable(),
        evidenceUseful: z.boolean().nullable(),
        falsePositiveEscalation: z.boolean().nullable().optional(),
        curatedForDataset: z.boolean().optional(),
        note: z.string().max(500).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const complianceDecisionWebhookSchema = reviewDecisionRequestSchema
  .safeExtend({ schemaVersion: z.literal(publicSchemaVersion), reviewId: reviewIdSchema })
  .strict();

export const metricsQuerySchema = z
  .object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

const metricValueSchema = z.union([z.number().nonnegative(), z.literal('not_available')]);
const metricsWindowSchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    timezone: z.literal('UTC'),
  })
  .strict();
const projectionLagSchema = z
  .object({
    pendingEvents: z.number().int().nonnegative(),
    oldestPendingAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();
const percentileSchema = z.object({ p50: metricValueSchema, p95: metricValueSchema }).strict();
export const metricsSummarySchema = z
  .object({
    schemaVersion: z.literal('1.1'),
    observationWindow: metricsWindowSchema,
    sampleCount: z.number().int().nonnegative(),
    denominator: z.number().int().nonnegative(),
    finalStatusCounts: z
      .object({
        active: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        escalated: z.number().int().nonnegative(),
        provisioningFailed: z.number().int().nonnegative(),
      })
      .strict(),
    rates: z
      .object({
        approval: metricValueSchema,
        rejection: metricValueSchema,
        escalation: metricValueSchema,
        missingInformation: metricValueSchema,
      })
      .strict(),
    latencyMs: z
      .object({
        endToEnd: percentileSchema.safeExtend({ sampleCount: z.number().int().nonnegative() }),
        steps: z.array(
          percentileSchema.safeExtend({
            step: z.string().min(1).max(100),
            sampleCount: z.number().int().nonnegative(),
          }),
        ),
      })
      .strict(),
    dimensions: z
      .object({
        policies: z.array(
          z
            .object({
              policyVersion: z.string().min(1).max(64),
              sampleCount: z.number().int().nonnegative(),
            })
            .strict(),
        ),
        jurisdictions: z.array(
          z
            .object({
              jurisdiction: z.string().length(2),
              sampleCount: z.number().int().nonnegative(),
            })
            .strict(),
        ),
      })
      .strict(),
    review: z
      .object({
        sampleCount: z.number().int().nonnegative(),
        turnaroundMs: percentileSchema,
        feedback: z.array(
          z
            .object({
              category: z.enum(['extraction', 'screening', 'risk', 'evidence']),
              useful: z.number().int().nonnegative(),
              incorrect: z.number().int().nonnegative(),
              notAnswered: z.number().int().nonnegative(),
            })
            .strict(),
        ),
        falsePositiveEscalation: z
          .object({
            sampleCount: z.number().int().nonnegative(),
            denominator: z.number().int().nonnegative(),
            rate: metricValueSchema,
          })
          .strict(),
      })
      .strict(),
    projectionLag: projectionLagSchema,
  })
  .strict();

export const providerMetricsSchema = z
  .object({
    schemaVersion: z.literal('1.1'),
    observationWindow: metricsWindowSchema,
    sampleCount: z.number().int().nonnegative(),
    providers: z.array(
      z
        .object({
          providerId: z.string().min(1).max(128),
          sampleCount: z.number().int().nonnegative(),
          outcomes: z
            .object({
              success: z.number().int().nonnegative(),
              timeout: z.number().int().nonnegative(),
              retry: z.number().int().nonnegative(),
              error: z.number().int().nonnegative(),
            })
            .strict(),
          rates: z
            .object({
              success: metricValueSchema,
              timeout: metricValueSchema,
              retry: metricValueSchema,
            })
            .strict(),
          latencyMs: percentileSchema.safeExtend({ sampleCount: z.number().int().nonnegative() }),
          usage: z
            .object({
              denominator: z.number().int().nonnegative(),
              inputUnits: z.number().int().nonnegative(),
              outputUnits: z.number().int().nonnegative(),
              costUsd: metricValueSchema,
              costPerCaseUsd: percentileSchema,
              priceVersions: z.array(z.string().min(1).max(100)),
            })
            .strict(),
        })
        .strict(),
    ),
    projectionLag: projectionLagSchema,
  })
  .strict();

export const evalMetricsSchema = z
  .object({
    schemaVersion: z.literal('1.1'),
    observationWindow: metricsWindowSchema,
    sampleCount: z.number().int().nonnegative(),
    evals: z.array(
      z
        .object({
          evalId: z.string().min(1).max(128),
          candidateId: z.string().min(1).max(128),
          datasetVersion: z.string().min(1).max(100),
          manifestDigest: z.string().regex(/^[a-f0-9]{64}$/u),
          sampleCount: z.number().int().nonnegative(),
          passedCount: z.number().int().nonnegative(),
          score: z.object({ p50: metricValueSchema, p95: metricValueSchema }).strict(),
        })
        .strict(),
    ),
    projectionLag: projectionLagSchema,
  })
  .strict();

type Extends<Left, Right> = [Left] extends [Right] ? true : false;
type Assert<Condition extends true> = Condition;
type _PublicContractAssertions = [
  Assert<Extends<z.infer<typeof publicErrorSchema>, PublicError>>,
  Assert<Extends<PublicError, z.input<typeof publicErrorSchema>>>,
  Assert<Extends<z.infer<typeof demoSessionSchema>, DemoSession>>,
  Assert<Extends<z.infer<typeof createCaseRequestSchema>, CreateCaseRequest>>,
  Assert<Extends<z.infer<typeof createCaseResultSchema>, CreateCaseResult>>,
  Assert<Extends<z.infer<typeof caseSummarySchema>, CaseSummary>>,
  Assert<Extends<z.infer<typeof uploadDocumentResultSchema>, UploadDocumentResult>>,
  Assert<Extends<z.infer<typeof caseEventsPageSchema>, CaseEventsPage>>,
  Assert<Extends<z.infer<typeof submitInformationRequestSchema>, SubmitInformationRequest>>,
  Assert<Extends<z.infer<typeof reviewQueueItemSchema>, ReviewQueueItem>>,
  Assert<Extends<z.infer<typeof reviewPageSchema>, ReviewPage>>,
  Assert<Extends<z.infer<typeof reviewDecisionRequestSchema>, ReviewDecisionRequest>>,
  Assert<Extends<z.infer<typeof metricsSummarySchema>, MetricsSummary>>,
  Assert<Extends<z.infer<typeof providerMetricsSchema>, ProviderMetrics>>,
  Assert<Extends<z.infer<typeof evalMetricsSchema>, EvalMetrics>>,
];

export type PublicContractAssertions = _PublicContractAssertions;

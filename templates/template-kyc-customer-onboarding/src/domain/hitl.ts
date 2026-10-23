import { z } from 'zod';

import { actorSchema, policyReferenceSchema } from './context.js';
import {
  actorIdSchema,
  caseIdSchema,
  checksumSchema,
  documentIdSchema,
  idempotencyKeySchema,
  informationRequestIdSchema,
  informationResponseIdSchema,
  resumeCommandIdSchema,
  tenantIdSchema,
  threadIdSchema,
  timestampSchema,
  workflowIdSchema,
  workflowRunIdSchema,
  workflowStepIdSchema,
} from './identifiers.js';
import { reasonCodeSchema } from './reasons.js';
import { applicationCorrectionsSchema } from './application.js';

export const requestedInformationItemSchema = z.enum([
  'IDENTITY_DOCUMENT',
  'IDENTITY_DOCUMENT_BACK',
  'PROOF_OF_ADDRESS',
  'FULL_NAME',
  'DATE_OF_BIRTH',
  'DOCUMENT_NUMBER',
  'EXPIRATION_DATE',
  'RESIDENTIAL_ADDRESS',
  'DOCUMENT_READABILITY',
]);

export const informationRequestSchema = z
  .object({
    id: informationRequestIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    workflowId: workflowIdSchema,
    workflowRunId: workflowRunIdSchema,
    workflowStepId: workflowStepIdSchema,
    threadId: threadIdSchema,
    round: z.number().int().positive(),
    maxRounds: z.number().int().positive(),
    requestedItems: z.array(requestedInformationItemSchema).min(1),
    reasonCodes: z.array(reasonCodeSchema).min(1),
    safeMessage: z.string().min(1).max(500),
    actionPath: z.string().min(1).max(500),
    status: z.enum(['PENDING', 'RESPONDED', 'EXPIRED', 'SUPERSEDED']),
    policy: policyReferenceSchema,
    expiresAt: timestampSchema,
    respondedAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    version: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.round > value.maxRounds) {
      context.addIssue({ code: 'custom', path: ['round'], message: 'round exceeds policy limit' });
    }
    if ((value.status === 'RESPONDED') !== (value.respondedAt !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['respondedAt'],
        message: 'responded timestamp must match request status',
      });
    }
  });

export const informationResponseSchema = z
  .object({
    id: informationResponseIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    requestId: informationRequestIdSchema,
    responseOption: z.enum([
      'IDENTITY_DOCUMENT',
      'IDENTITY_DOCUMENT_BACK',
      'PROOF_OF_ADDRESS',
      'CORRECTED_APPLICATION',
      'READABLE_DOCUMENT',
    ]),
    responseQuality: z.enum(['COMPLETE', 'STILL_INCOMPLETE']).default('COMPLETE'),
    applicationCorrections: applicationCorrectionsSchema.nullable().default(null),
    applicationVersion: z.number().int().positive().nullable().default(null),
    documentIds: z.array(documentIdSchema).min(1),
    responseFingerprint: checksumSchema,
    actor: actorSchema,
    submittedAt: timestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const corrected = value.responseOption === 'CORRECTED_APPLICATION';
    if (corrected !== (value.applicationCorrections !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['applicationCorrections'],
        message: 'application corrections must match the response option',
      });
    }
    if (corrected !== (value.applicationVersion !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['applicationVersion'],
        message: 'application version must match the response option',
      });
    }
  });

export const resumeActionTypeSchema = z.enum(['MISSING_INFORMATION', 'COMPLIANCE_REVIEW']);

export const workflowResumeCommandSchema = z
  .object({
    id: resumeCommandIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    workflowId: workflowIdSchema,
    workflowRunId: workflowRunIdSchema,
    workflowStepId: workflowStepIdSchema,
    threadId: threadIdSchema,
    actionType: resumeActionTypeSchema,
    targetId: z.string().min(1).max(128),
    authorizedActorId: actorIdSchema,
    requiredRole: z.string().min(1).max(64),
    requestFingerprint: checksumSchema,
    payloadFingerprint: checksumSchema.nullable(),
    idempotencyKey: idempotencyKeySchema,
    resumePayloadId: z.string().min(1).max(128),
    status: z.enum(['PENDING', 'EXECUTING', 'COMPLETED', 'EXPIRED']),
    expiresAt: timestampSchema,
    executionStartedAt: timestampSchema.nullable(),
    consumedAt: timestampSchema.nullable(),
    resultReference: z.string().min(1).max(256).nullable(),
    completedOutcome: z.json().nullable().default(null),
    resultFingerprint: checksumSchema.nullable().default(null),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    version: z.number().int().positive(),
  })
  .strict();

export type InformationRequest = z.infer<typeof informationRequestSchema>;
export type InformationResponse = z.infer<typeof informationResponseSchema>;
export type WorkflowResumeCommand = z.infer<typeof workflowResumeCommandSchema>;

import { z } from 'zod';

import { applicationIdSchema, caseIdSchema, tenantIdSchema, timestampSchema } from './identifiers.js';
import { policyReferenceSchema } from './context.js';

export const kycCaseStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'EXTRACTING',
  'CHECKING',
  'MISSING_INFORMATION',
  'ASSESSING_RISK',
  'COMPLIANCE_REVIEW',
  'ESCALATED',
  'APPROVED',
  'REJECTED',
  'PROVISIONING',
  'ACTIVE',
  'PROVISIONING_FAILED',
]);

export const kycCaseSchema = z
  .object({
    id: caseIdSchema,
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    jurisdiction: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/u),
    policyProfile: z.enum(['demo-default', 'demo-strict']),
    policy: policyReferenceSchema,
    status: kycCaseStatusSchema,
    workflowRunId: z.string().min(1).max(128).nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    version: z.number().int().positive(),
  })
  .strict();

export const initialKycCaseSchema = kycCaseSchema
  .extend({
    status: z.literal('DRAFT'),
    workflowRunId: z.null(),
    version: z.literal(1),
  })
  .superRefine((value, context) => {
    if (value.createdAt !== value.updatedAt) {
      context.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'an initial case must have matching creation and update timestamps',
      });
    }
  });

export type KycCaseStatus = z.infer<typeof kycCaseStatusSchema>;
export type KycCase = z.infer<typeof kycCaseSchema>;
export type InitialKycCase = z.infer<typeof initialKycCaseSchema>;

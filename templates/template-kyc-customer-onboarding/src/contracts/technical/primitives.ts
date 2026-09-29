import { z } from 'zod';

import { caseIdSchema, providerIdSchema, tenantIdSchema, timestampSchema } from '../../domain/identifiers.js';

export const idNamespaceSchema = z.enum([
  'case',
  'application',
  'document',
  'evidence',
  'review',
  'event',
  'notification',
  'account',
  'delivery',
  'information-request',
  'information-response',
  'risk-assessment',
  'review-decision',
  'resume-command',
  'workflow-run',
  'workflow-step',
]);

export const providerHealthResultSchema = z
  .object({
    providerId: providerIdSchema,
    status: z.enum(['HEALTHY', 'DEGRADED', 'UNAVAILABLE']),
    checkedAt: timestampSchema,
    safeReason: z.string().max(200).nullable(),
  })
  .strict();

export const costRecordSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    usageEventId: z.string().min(1).max(128),
    providerId: providerIdSchema,
    operation: z.string().min(1).max(100),
    inputUnits: z.number().int().nonnegative(),
    outputUnits: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
    priceVersion: z.string().min(1).max(100),
    latencyMs: z.number().int().nonnegative().optional(),
    attemptCount: z.number().int().positive().optional(),
    retryCount: z.number().int().nonnegative().optional(),
    recordedAt: timestampSchema,
  })
  .strict();

export const providerMetricRecordSchema = z
  .object({
    tenantId: tenantIdSchema,
    eventId: z.string().min(1).max(128),
    caseId: caseIdSchema.nullable(),
    providerId: providerIdSchema,
    operation: z.string().min(1).max(100),
    outcome: z.enum(['success', 'timeout', 'retry', 'error']),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    attemptCount: z.number().int().positive(),
    retryCount: z.number().int().nonnegative(),
  })
  .strict();

export const workflowStepMetricRecordSchema = z
  .object({
    tenantId: tenantIdSchema,
    eventId: z.string().min(1).max(128),
    caseId: caseIdSchema.nullable(),
    workflowId: z.string().min(1).max(128),
    runId: z.string().min(1).max(128),
    stepId: z.string().min(1).max(128),
    outcome: z.enum(['success', 'error']),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
  })
  .strict();

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(namespace: z.infer<typeof idNamespaceSchema>): string;
}

export interface ProviderHealthCheck {
  check(providerId: string): Promise<z.infer<typeof providerHealthResultSchema>>;
}

export interface CostRecorder {
  record(input: z.infer<typeof costRecordSchema>): Promise<z.infer<typeof costRecordSchema>>;
}

export interface ProviderMetricsRecorder {
  recordProvider(
    input: z.infer<typeof providerMetricRecordSchema>,
  ): Promise<z.infer<typeof providerMetricRecordSchema>>;
  recordWorkflowStep?(
    input: z.infer<typeof workflowStepMetricRecordSchema>,
  ): Promise<z.infer<typeof workflowStepMetricRecordSchema>>;
}

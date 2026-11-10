import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { resolveProjectRoot } from './runtime';

export const attioFields = {
  assessmentId: { title: 'Assessment ID', type: 'text', slug: 'lq_assessment_id' },
  cycleId: { title: 'Cycle ID', type: 'text', slug: 'lq_cycle_id' },
  classification: { title: 'Classification', type: 'select', slug: 'lq_classification' },
  stage: { title: 'Stage', type: 'status', slug: 'lq_stage' },
  score: { title: 'Score', type: 'number', slug: 'lq_score' },
  summary: { title: 'Summary', type: 'text', slug: 'lq_summary' },
  evidenceLinks: { title: 'Evidence links', type: 'text', slug: 'lq_evidence_links' },
  gaps: { title: 'Missing attributes', type: 'text', slug: 'lq_gaps' },
  reviewReasons: { title: 'Review reason', type: 'text', slug: 'lq_review_reasons' },
  nextAction: { title: 'Suggested next action', type: 'text', slug: 'lq_next_action' },
  reviewId: { title: 'Review ID', type: 'text', slug: 'lq_review_id' },
  reviewRevision: { title: 'Review revision', type: 'number', slug: 'lq_review_revision' },
  reviewStatus: { title: 'Review status', type: 'select', slug: 'lq_review_status' },
  decisionSource: { title: 'Decision source', type: 'select', slug: 'lq_decision_source' },
  reviewJustification: { title: 'Justification', type: 'text', slug: 'lq_review_justification' },
  operationId: { title: 'Operation ID', type: 'text', slug: 'lq_operation_id' },
  outputState: { title: 'Output state', type: 'select', slug: 'lq_output_state' },
  appliedAssessmentId: { title: 'Applied assessment ID', type: 'text', slug: 'lq_applied_assessment_id' },
  contactName: { title: 'Contact name', type: 'text', slug: 'lq_contact_name' },
  contactEmail: { title: 'Contact email', type: 'text', slug: 'lq_contact_email' },
  inquiry: { title: 'Inquiry', type: 'text', slug: 'lq_inquiry' },
  metadata: { title: 'Metadata', type: 'text', slug: 'lq_metadata' },
} as const;
export const compactAttioFieldNames = ['stage', 'summary', 'reviewJustification', 'metadata'] as const;
export const legacyAttioFieldNames = Object.keys(attioFields).filter(name => name !== 'metadata') as Array<
  keyof typeof attioFields
>;
export const attioOptions = {
  stage: ['Triage', 'Needs review', 'Qualified', 'Nurture', 'Disqualified'],
  classification: ['qualified', 'nurture', 'disqualified', 'needs_review'],
  reviewStatus: ['Not required', 'Awaiting review', 'Approved', 'Rejected', 'Changes requested', 'Expired'],
  decisionSource: ['Automatic', 'SDR'],
  outputState: ['Pending', 'Applied', 'Failed', 'Conflict'],
} as const;
export const attioReviewFields = ['classification', 'reviewJustification', 'reviewStatus'] as const;
export const attioOutputNames = legacyAttioFieldNames.filter(
  name => !['contactName', 'contactEmail', 'inquiry'].includes(name),
);
const attribute = z.strictObject({ id: z.uuid(), slug: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/) });
const options = z.record(z.string().min(1), z.uuid());
export const attioMappingSchema = z
  .strictObject({
    layoutVersion: z.literal(2).optional(),
    workspaceId: z.uuid(),
    listId: z.uuid(),
    companyObjectId: z.uuid(),
    fields: z.record(z.string(), attribute),
    options: z.strictObject({
      stage: options,
      classification: options,
      reviewStatus: options,
      decisionSource: options,
      outputState: options,
    }),
    limits: z.strictObject({
      timeoutMs: z.number().int().min(100).max(30_000),
      maxAttempts: z.number().int().min(1).max(10),
      retryDelayMs: z.number().int().min(10).max(60_000),
      maxRetryDelayMs: z.number().int().min(10).max(3_600_000),
    }),
    sales: z
      .strictObject({
        listId: z.uuid(),
        stage: attribute,
        assessmentId: attribute,
        cycleId: attribute,
        wonOptionId: z.uuid(),
        lostOptionId: z.uuid(),
      })
      .optional(),
  })
  .superRefine((config, ctx) => {
    if (config.limits.retryDelayMs > config.limits.maxRetryDelayMs)
      ctx.addIssue({
        code: 'custom',
        path: ['limits', 'maxRetryDelayMs'],
        message: 'Maximum retry delay must cover the minimum retry delay',
      });
    const required = config.layoutVersion === 2 ? compactAttioFieldNames : legacyAttioFieldNames;
    if (Object.keys(config.fields).length !== required.length || required.some(name => !config.fields[name]))
      ctx.addIssue({ code: 'custom', message: 'Fields must match the captured Attio layout' });
    const attrs = Object.values(config.fields);
    if (
      new Set(attrs.map(field => field.id)).size !== attrs.length ||
      new Set(attrs.map(field => field.slug)).size !== attrs.length
    )
      ctx.addIssue({ code: 'custom', message: 'Attio attributes must be distinct' });
    for (const [key, names] of Object.entries(attioOptions)) {
      if (config.layoutVersion === 2 && key !== 'stage') continue;
      const mapping = config.options[key as keyof typeof attioOptions];
      if (names.some(name => !mapping[name]) || new Set(Object.values(mapping)).size !== Object.values(mapping).length)
        ctx.addIssue({ code: 'custom', message: `Missing or duplicated Attio options: ${key}` });
    }
    if (
      config.sales?.listId === config.listId ||
      (config.sales && config.sales.wonOptionId === config.sales.lostOptionId)
    )
      ctx.addIssue({ code: 'custom', message: 'Sales requires a separate list and distinct outcomes' });
  });
export const attioConnectionSchema = attioMappingSchema.safeExtend({ token: z.string().min(1) });
export type AttioConnectionConfig = z.infer<typeof attioConnectionSchema>;
export const attioConfigSchema = attioConnectionSchema.safeExtend({
  webhookSecret: z.string().min(16),
});
export type AttioMapping = z.infer<typeof attioMappingSchema>;
export type AttioConfig = z.infer<typeof attioConfigSchema>;
function attioEnvironment(environment: NodeJS.ProcessEnv) {
  const path = resolve(resolveProjectRoot(environment), 'attio.mapping.json');
  const configured = existsSync(path);
  if (!configured && !environment.ATTIO_API_TOKEN && !environment.ATTIO_WEBHOOK_SECRET) return undefined;
  return {
    ...(configured ? JSON.parse(readFileSync(path, 'utf8')) : {}),
    token: environment.ATTIO_API_TOKEN,
  };
}
export function attioConnectionConfig(environment: NodeJS.ProcessEnv = process.env): AttioConnectionConfig | undefined {
  const config = attioEnvironment(environment);
  return config ? attioConnectionSchema.parse(config) : undefined;
}
export function attioConfig(environment: NodeJS.ProcessEnv = process.env): AttioConfig | undefined {
  const config = attioEnvironment(environment);
  return config ? attioConfigSchema.parse({ ...config, webhookSecret: environment.ATTIO_WEBHOOK_SECRET }) : undefined;
}

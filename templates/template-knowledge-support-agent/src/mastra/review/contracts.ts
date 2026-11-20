import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u);
const identifier = text(200);
export const reviewInputSchema = z
  .object({
    threadId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/u),
    messageId: identifier,
    sourceActorId: identifier,
    audience: z.enum(['private', 'tenant']),
  })
  .strict();
export const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    revision: z.string().regex(/^[a-f0-9]{64}$/u),
    reason: text(1000),
  })
  .strict();
export const evidenceSchema = z.object({ ref: text(1000), version: z.number().int().positive() }).strict();
export const recordSchema = z
  .object({
    topicTags: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u))
      .min(1)
      .max(20),
    observedOn: z.iso.date(),
    state: z.literal('approved'),
    summary: text(1000),
    applicability: text(1000),
  })
  .strict();
export const candidateSchema = z
  .object({
    action: z.enum(['page', 'note', 'update', 'duplicate', 'contradiction', 'insufficient-evidence']),
    target: z
      .object({
        path: z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/u),
        expectedVersion: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    title: text(150),
    content: text(2000),
    record: recordSchema,
    evidence: z.array(evidenceSchema).max(10),
    publicSource: evidenceSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (['note', 'update'].includes(value.action) !== !!value.target)
      context.addIssue({ code: 'custom', message: 'Only notes and updates require an existing versioned target' });
    if (new Set(value.record.topicTags).size !== value.record.topicTags.length)
      context.addIssue({ code: 'custom', message: 'Topic tags must be unique' });
  });
export const proposalSchema = z
  .object({
    id: z.uuid(),
    owner: identifier.max(1000),
    reviewer: z.object({ id: identifier, actorId: identifier, tenantId: identifier, customerId: identifier }).strict(),
    source: reviewInputSchema.extend({ confirmation: text(4000), digest: z.string().length(64) }).strict(),
    candidate: candidateSchema,
    bindings: z
      .array(
        z
          .object({
            kind: z.enum(['evidence', 'public', 'target']),
            ref: text(1000),
            id: identifier,
            version: z.number().int().positive(),
            digest: z.string().length(64),
          })
          .strict(),
      )
      .max(12),
    destination: z.object({ scope: text(1000), path: text(500) }).strict(),
    revision: z.string().length(64),
  })
  .strict();
export const approvalSchema = z
  .object({
    proposal: proposalSchema,
    decision: decisionSchema,
    reviewerId: identifier,
    decidedAt: z.iso.datetime(),
  })
  .strict();
export const publicationSchema = z
  .object({
    proposalId: z.uuid(),
    status: z.enum(['published', 'rejected', 'duplicate', 'contradiction', 'insufficient-evidence']),
    revision: z.string().length(64),
    reference: text(1500).nullable(),
    decision: decisionSchema,
    reviewerId: identifier,
  })
  .strict();
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type Approval = z.infer<typeof approvalSchema>;

/** Validation failures require a fresh review; only infrastructure faults may be retried. */
export class ReviewConflict extends Error {}

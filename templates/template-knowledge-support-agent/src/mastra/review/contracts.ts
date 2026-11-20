import { z } from 'zod';
import { assertKnowledgeNoteTextWithinBound, assertKnowledgePageDescriptionWithinBound } from '@mastra/core/knowledge';

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
    const content = [value.title, value.content, value.record.summary, value.record.applicability].join('\n');
    if (/knowledge-review:|knowledge-seed:|Seed note:|```support-record/iu.test(content))
      context.addIssue({ code: 'custom', message: 'Reserved publication markers are not allowed in proposed content' });
    const evidence = new Set(value.evidence.map(item => item.ref));
    if ([...content.matchAll(/\[\[([^\]]+)\]\]/gu)].some(link => !evidence.has(link[1]!)))
      context.addIssue({ code: 'custom', message: 'Content contains an unvalidated evidence link' });
  });

export function publishedText(proposal: {
  id: string;
  revision: string;
  reviewer: { actorId: string };
  source: ReviewInput;
  candidate: Candidate;
}) {
  const { id, revision, reviewer, source, candidate } = proposal;
  const marker = `<!-- knowledge-review:${id}:${revision} -->`;
  const attribution = `Reviewed by: ${reviewer.actorId}`;
  const provenance =
    source.audience === 'private'
      ? `Source technician: ${source.sourceActorId}\nConfirmed in thread: ${source.threadId}, turn: ${source.messageId}\nEvidence: ${candidate.evidence.map(item => `[[${item.ref}]] (v${item.version})`).join(', ')}`
      : `Public source: [[${candidate.publicSource!.ref}]] (v${candidate.publicSource!.version})`;
  return `${marker}\n${attribution}\n${candidate.content}\n\n\`\`\`support-record\n${JSON.stringify(candidate.record)}\n\`\`\`\n\n${provenance}`;
}

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
  .strict()
  .superRefine((proposal, context) => {
    const { candidate, source } = proposal;
    if (candidate.action !== 'page' && candidate.action !== 'note' && candidate.action !== 'update') return;
    if (source.audience === 'tenant' && (!candidate.publicSource || candidate.record.applicability.length < 15)) {
      context.addIssue({
        code: 'custom',
        message: 'Shared findings require public evidence and shareable applicability',
      });
      return;
    }
    try {
      if (candidate.action === 'note') assertKnowledgeNoteTextWithinBound(publishedText(proposal));
      else assertKnowledgePageDescriptionWithinBound(candidate.record.summary);
    } catch (error) {
      context.addIssue({ code: 'custom', message: (error as Error).message });
    }
  });
export const approvalSchema = z
  .object({
    proposal: proposalSchema,
    decision: decisionSchema,
    reviewerId: identifier,
    decidedAt: z.iso.datetime(),
  })
  .strict()
  .refine(({ proposal, decision }) => proposal.revision === decision.revision, {
    message: 'Decision revision mismatch',
    path: ['decision', 'revision'],
  });

export function sameDecision(recorded: z.infer<typeof decisionSchema>, retry: z.infer<typeof decisionSchema>) {
  return (
    recorded.decision === retry.decision && recorded.reason === retry.reason && recorded.revision === retry.revision
  );
}

export const publicationRetryInputSchema = z
  .object({ approval: approvalSchema, retryDecision: decisionSchema.optional() })
  .refine(({ approval, retryDecision }) => !retryDecision || sameDecision(approval.decision, retryDecision), {
    message: 'Retry must replay the exact recorded decision',
    path: ['retryDecision'],
  });
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

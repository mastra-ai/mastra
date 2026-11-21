import { z } from 'zod';
import { createHash } from 'node:crypto';
import { confirmationReferenceSchema, confirmationReferenceString } from './confirmation.ts';
import { validateSupportRecord } from '../knowledge/seed-manifest.ts';
import { supportRecordEnvelope } from '../knowledge/support-record-envelope.ts';
import { assertKnowledgeNoteTextWithinBound, assertKnowledgePageDescriptionWithinBound } from '@mastra/core/knowledge';
import { supportConfiguration } from '../../examples/support.ts';

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u);
const identifier = text(200);
const pathSchema = z.string().regex(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/u);
const pageReferenceSchema = text(1000).refine(ref => {
  const separator = ref.indexOf('#');
  return separator > 0 && pathSchema.safeParse(ref.slice(separator + 1)).success;
}, 'Invalid scoped page reference');
export const reviewInputSchema = z
  .object({
    threadId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/u),
    messageId: identifier,
    sourceActorId: identifier,
    audience: z.enum(['private', 'tenant']),
  })
  .strict();
const referenceRequest = z
  .object({
    confirmationReference: confirmationReferenceString,
    audience: z.enum(['private', 'tenant']),
  })
  .strict();
// Mastra uses the same input type for both the workflow and its first step.
export const reviewStartRequestSchema = z.union([reviewInputSchema, referenceRequest]);
export type ReviewStartRequest = z.input<typeof reviewStartRequestSchema>;
export const reviewStartInputSchema = z.union([
  reviewInputSchema,
  referenceRequest.extend({ confirmationReference: confirmationReferenceSchema }),
]);
export const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    revision: z.string().regex(/^[a-f0-9]{64}$/u),
    reason: text(1000),
  })
  .strict();
export const evidenceSchema = z.object({ ref: pageReferenceSchema, version: z.number().int().positive() }).strict();
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
  .strict()
  .superRefine((record, context) => {
    try {
      validateSupportRecord(record);
    } catch (error) {
      context.addIssue({ code: 'custom', message: (error as Error).message });
    }
  });
export const candidateSchema = z
  .object({
    action: z.enum(['page', 'note', 'update', 'duplicate', 'contradiction', 'insufficient-evidence']),
    target: z
      .object({
        path: pathSchema,
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
    const content = [value.title, value.content, value.record.summary, value.record.applicability].join('\n');
    if (/knowledge-review:|knowledge-seed:|Seed note:|```support-record/iu.test(content))
      context.addIssue({ code: 'custom', message: 'Reserved publication markers are not allowed in proposed content' });
    const evidence = new Set(value.evidence.map(item => item.ref));
    if ([...content.matchAll(/\[\[([^\]]+)\]\]/gu)].some(link => !evidence.has(link[1]!)))
      context.addIssue({ code: 'custom', message: 'Content contains an unvalidated evidence link' });
  });

export function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function renderPublication(proposal: {
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
  const prefix = `${marker}\n${attribution}\n${candidate.content}\n\n`;
  const value = JSON.stringify(candidate.record);
  const fence = `\`\`\`support-record\n${value}\n\`\`\``;
  return { body: `${prefix}${fence}\n\n${provenance}`, start: prefix.length, end: prefix.length + fence.length, value };
}

export function publishedText(proposal: Parameters<typeof renderPublication>[0]) {
  return renderPublication(proposal).body;
}

const proposalFields = z
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
            ref: pageReferenceSchema,
            id: identifier,
            version: z.number().int().positive(),
            digest: z.string().length(64),
          })
          .strict(),
      )
      .max(12),
    destination: z.object({ scope: text(1000), path: pathSchema.max(500) }).strict(),
    revision: z.string().length(64),
  })
  .strict();

function validateDestination(
  { candidate, destination, source }: Pick<z.infer<typeof proposalFields>, 'candidate' | 'destination' | 'source'>,
  context: z.RefinementCtx,
) {
  if (
    (candidate.action === 'page' || candidate.action === 'note' || candidate.action === 'update') &&
    !destination.path.startsWith(`${supportConfiguration.customerRoots[0]}/`) &&
    !(source.audience === 'tenant' && destination.path.startsWith(`${supportConfiguration.sharedRoot}/`))
  )
    context.addIssue({
      code: 'custom',
      path: ['destination', 'path'],
      message: 'Target must be an allowed finding or case record',
    });
}

export const proposalDraftSchema = proposalFields.omit({ revision: true }).superRefine(validateDestination);
export const proposalSchema = proposalFields.superRefine(validateDestination).superRefine((proposal, context) => {
  const { candidate, source } = proposal;
  if (candidate.action !== 'page' && candidate.action !== 'note' && candidate.action !== 'update') return;
  if (source.audience === 'tenant' && (!candidate.publicSource || candidate.record.applicability.length < 15)) {
    context.addIssue({
      code: 'custom',
      message: 'Shared findings require public evidence and shareable applicability',
    });
    return;
  }
  if (source.audience === 'tenant') {
    const sharedText = [
      candidate.title,
      candidate.content,
      candidate.record.summary,
      candidate.record.applicability,
      ...candidate.record.topicTags,
    ].join('\n');
    if (
      /\[\[|\]\(|(?:customer|resource|thread):|https?:\/\/|\b(?:bearer\s+\S+|sk-[a-z0-9]{12,}|(?:api[_ -]?key|password|secret|token)\s*[:=])|(?:\d[ -]?){13,19}/iu.test(
        sharedText,
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['candidate'],
        message: 'Shared text contains private links, credentials, or payment-like data',
      });
    const privateIdentifiers = [
      proposal.reviewer.customerId,
      source.sourceActorId,
      source.messageId,
      ...candidate.evidence.map(item => item.ref),
    ];
    const normalized = sharedText.toLowerCase();
    const threadId = source.threadId.toLowerCase();
    // UUIDs can also be embedded in formatted or prefixed references.
    const mentionsThread = z.uuid().safeParse(threadId).success
      ? normalized.includes(threadId)
      : new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${threadId}(?![\\p{L}\\p{M}\\p{N}])`, 'iu').test(sharedText);
    if (mentionsThread || privateIdentifiers.some(value => normalized.includes(value.toLowerCase())))
      context.addIssue({
        code: 'custom',
        path: ['candidate'],
        message: 'Shared text contains private identifiers or references',
      });
  }
  try {
    const publication = renderPublication(proposal);
    const parsed = supportRecordEnvelope(publication.body);
    if (parsed?.start !== publication.start || parsed.end !== publication.end || parsed.value !== publication.value)
      throw new Error('The published support record must be a standalone fence');
    if (candidate.action === 'note') assertKnowledgeNoteTextWithinBound(publication.body);
    else assertKnowledgePageDescriptionWithinBound(candidate.record.summary);
  } catch (error) {
    context.addIssue({ code: 'custom', message: (error as Error).message });
  }
});
export const approvalDecisionSchema = z
  .object({ proposal: proposalSchema, decision: decisionSchema, reviewerId: identifier })
  .strict();

export const approvalSchema = approvalDecisionSchema
  .extend({ decidedAt: z.iso.datetime() })
  .refine(({ proposal, decision }) => proposal.revision === decision.revision, {
    message: 'Decision revision mismatch',
    path: ['decision', 'revision'],
  })
  .refine(({ proposal }) => digest({ ...proposal, revision: undefined }) === proposal.revision, {
    message: 'Approved revision mismatch',
    path: ['proposal', 'revision'],
  })
  .refine(({ proposal, reviewerId }) => reviewerId === proposal.reviewer.actorId, {
    message: 'Decision reviewer mismatch',
    path: ['reviewerId'],
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

/** Validation failures require a fresh review; only recognized transient faults may be retried. */
export class ReviewConflict extends Error {}

import { z } from 'zod';
import { createHash } from 'node:crypto';
import { confirmationInputSchema, confirmationReferenceSchema, confirmationReferenceString } from './confirmation.ts';
import { validateSupportRecord } from '../knowledge/seed-manifest.ts';
import { supportRecordEnvelope } from '../knowledge/support-record-envelope.ts';
import {
  assertKnowledgeNoteTextWithinBound,
  assertKnowledgePageDescriptionWithinBound,
  knowledgeScopeAddress,
} from '@mastra/core/knowledge';
import { supportConfiguration } from '../../examples/support.ts';
import { actorIdSchema, profileSchema, resourceId } from '../identity.ts';

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
    threadId: confirmationInputSchema.shape.threadId,
    messageId: identifier,
    sourceActorId: actorIdSchema,
    audience: z.enum(['private', 'tenant']),
  })
  .strict();
const referenceRequest = z
  .object({
    confirmationReference: confirmationReferenceString.refine(
      value => confirmationReferenceSchema.safeParse(value).success,
      'Invalid confirmation reference',
    ),
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
    if ([...content.matchAll(/\[\[([^\]]+)\]\]/gu)].some(link => !evidence.has(link[1]!.trim())))
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
    owner: text(1000),
    reviewer: profileSchema.strict(),
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

type ProposalFields = z.infer<typeof proposalFields>;

export function targetBinding({ destination, bindings }: Pick<ProposalFields, 'destination' | 'bindings'>) {
  const ref = `${destination.scope}#${destination.path}`;
  return bindings.find(binding => binding.kind === 'target' && binding.ref === ref);
}

function validateProposalDraft(
  { candidate, destination, owner, reviewer, source }: Omit<ProposalFields, 'revision'>,
  context: z.RefinementCtx,
) {
  if (profileSchema.safeParse(reviewer).success && resourceId(reviewer) !== owner)
    context.addIssue({ code: 'custom', path: ['owner'], message: 'Proposal ownership mismatch' });
  if (candidate.action !== 'page' && candidate.action !== 'note' && candidate.action !== 'update') return;
  if (
    !destination.path.startsWith(`${supportConfiguration.customerRoots[0]}/`) &&
    !(source.audience === 'tenant' && destination.path.startsWith(`${supportConfiguration.sharedRoot}/`))
  )
    context.addIssue({
      code: 'custom',
      path: ['destination', 'path'],
      message: 'Target must be an allowed finding or case record',
    });
  if (
    source.audience === 'tenant' &&
    candidate.publicSource &&
    reviewer.tenantId &&
    !candidate.publicSource.ref.startsWith(`${knowledgeScopeAddress('docs:$tenantId', reviewer)}#`)
  )
    context.addIssue({
      code: 'custom',
      path: ['candidate', 'publicSource', 'ref'],
      message: 'Public source must be a documentation reference',
    });
}

export const proposalDraftSchema = proposalFields.omit({ revision: true }).superRefine(validateProposalDraft);
export const proposalSchema = proposalFields.superRefine(validateProposalDraft).superRefine((proposal, context) => {
  const { candidate, source } = proposal;
  if (candidate.action !== 'page' && candidate.action !== 'note' && candidate.action !== 'update') return;
  if (candidate.action === 'note' && !targetBinding(proposal))
    context.addIssue({ code: 'custom', path: ['bindings'], message: 'Note target is not bound' });
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
    const privateIdentifiers = [source.messageId, ...candidate.evidence.map(item => item.ref)];
    const normalized = sharedText.toLowerCase();
    const mentionsIdentifier = (id: string) => {
      const lower = id.toLowerCase();
      // UUIDs can also be embedded in formatted or prefixed references.
      if (z.uuid().safeParse(id).success) return normalized.includes(lower);
      const literal = lower.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${literal}(?![\\p{L}\\p{M}\\p{N}])`, 'iu').test(normalized);
    };
    if (
      mentionsIdentifier(source.threadId) ||
      mentionsIdentifier(proposal.reviewer.customerId) ||
      mentionsIdentifier(source.sourceActorId) ||
      privateIdentifiers.some(value => normalized.includes(value.toLowerCase()))
    )
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

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { normalizedEventSchema } from '../contracts';

export const dispositionSchema = z.enum(['qualified', 'nurture', 'disqualified']);
export const qualificationStages = {
  qualified: 'Qualified',
  nurture: 'Nurture',
  disqualified: 'Disqualified',
  needs_review: 'Needs review',
} as const;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const commandTime = {
  occurredAt: z.iso.datetime({ offset: true }),
  receivedAt: z.iso.datetime({ offset: true }),
};
/** Bounded timestamp uncertainty, always measured against the original durable receipt. */
export function commandWithinReceiptWindow(occurredAt: string, receivedAt: string) {
  return Date.parse(occurredAt) <= Date.parse(receivedAt) + 5000;
}
export const reviewReasonSchema = z.strictObject({
  code: z.enum(['identity_unresolved', 'fact_unresolved', 'policy_review', 'manual_review']),
  attribute: z.enum(['identity', 'businessModel', 'employeeCount', 'headquartersCountry', 'buyingIntent', 'policy']),
  explanation: z.string().min(1),
  action: z.string().min(1),
  evidenceIds: z.array(z.string()).max(2021),
});
export const ownedPatchSchema = z
  .strictObject({
    presentationVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    assessmentId: z.uuid(),
    cycleId: z.uuid(),
    classification: z.enum(['qualified', 'nurture', 'disqualified', 'needs_review']),
    stage: z.enum(['Qualified', 'Nurture', 'Disqualified', 'Needs review']),
    score: z.number().int().min(0).max(100),
    summary: z.string().min(1).max(10_000),
    evidenceLinks: z.array(z.string().max(2048)).max(2021),
    gaps: z.array(z.string()).max(10),
    reviewReasons: z.array(reviewReasonSchema).max(10),
    nextAction: z.string().min(1),
    reviewId: z.uuid().nullable(),
    reviewRevision: z.number().int().positive().nullable(),
    reviewStatus: z.enum(['Not required', 'Awaiting review', 'Approved', 'Rejected', 'Changes requested', 'Expired']),
    decisionSource: z.enum(['Automatic', 'SDR']).nullable(),
    overrideClassification: dispositionSchema.nullable(),
    overrideReason: z.string().max(2000).nullable(),
  })
  .superRefine((patch, ctx) => {
    const reviewing = ['Awaiting review', 'Rejected', 'Changes requested', 'Expired'].includes(patch.reviewStatus);
    if (patch.stage !== (reviewing ? 'Needs review' : qualificationStages[patch.classification]))
      ctx.addIssue({ code: 'custom', message: 'Stage must match review status and classification' });
    if (
      (patch.reviewId === null) !== (patch.reviewRevision === null) ||
      (patch.reviewStatus === 'Not required'
        ? patch.reviewId !== null || patch.decisionSource !== 'Automatic'
        : patch.reviewId === null) ||
      (patch.reviewStatus === 'Approved' && patch.decisionSource !== 'SDR') ||
      (!reviewing && patch.classification === 'needs_review') ||
      (reviewing && (patch.decisionSource !== null || patch.reviewReasons.length === 0)) ||
      (patch.overrideClassification === null && patch.overrideReason !== null) ||
      (patch.overrideClassification !== null &&
        (patch.reviewStatus !== 'Approved' || patch.overrideClassification !== patch.classification))
    )
      ctx.addIssue({ code: 'custom', message: 'Review identity, disposition and source must agree' });
  });
export type OwnedPatch = z.infer<typeof ownedPatchSchema>;
export const reviewPacketSchema = z
  .strictObject({
    id: z.uuid(),
    revision: z.number().int().positive(),
    digest,
    assessmentId: z.uuid(),
    cycleId: z.uuid(),
    destination: normalizedEventSchema.shape.destination,
    proposedPatch: ownedPatchSchema,
    reopenedBy: z
      .union([
        z.strictObject({ actorId: z.string().min(1).max(200), ...commandTime }),
        z.strictObject({ memberId: z.uuid(), ...commandTime }),
      ])
      .refine(value => commandWithinReceiptWindow(value.occurredAt, value.receivedAt))
      .optional(),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    packet =>
      packet.proposedPatch.assessmentId === packet.assessmentId &&
      packet.proposedPatch.cycleId === packet.cycleId &&
      packet.proposedPatch.reviewId === packet.id &&
      packet.proposedPatch.reviewRevision === packet.revision &&
      packet.proposedPatch.reviewStatus === 'Awaiting review' &&
      (!packet.reopenedBy || packet.revision >= 2),
    'Packet and proposed patch must share their assessment, cycle and review binding',
  );
export const decisionInputSchema = z
  .strictObject({
    runId: z.uuid(),
    reviewId: z.uuid(),
    revision: z.number().int().positive(),
    digest,
    decision: z.enum(['approved', 'rejected', 'changes_requested']),
    override: z
      .strictObject({
        classification: dispositionSchema,
        reason: z
          .string()
          .min(1)
          .max(2000)
          .refine(value => value.trim().length > 0),
      })
      .optional(),
  })
  .refine(value => !value.override || value.decision === 'approved', 'Only approval accepts an override');
export const stageDisposition = { Qualified: 'qualified', Nurture: 'nurture', Disqualified: 'disqualified' } as const;
export const stageDecisionInputSchema = z.strictObject({
  kind: z.enum(['attio-stage', 'provider-stage']),
  runId: z.uuid(),
  reviewId: z.uuid(),
  revision: z.number().int().positive(),
  digest,
  decision: z.literal('approved'),
  stage: z.enum(['Qualified', 'Nurture', 'Disqualified']),
  justification: z.string().max(2000).nullable(),
});
export type StageDecisionInput = z.infer<typeof stageDecisionInputSchema>;
export const persistedDecisionInputSchema = z.union([stageDecisionInputSchema, decisionInputSchema]);
export const decisionSchema = z.strictObject({
  id: z.uuid(),
  input: persistedDecisionInputSchema,
  reviewer: z.union([
    z.literal('local-operator'),
    z.strictObject({ provider: z.literal('attio'), workspaceId: z.uuid(), memberId: z.uuid() }),
    z.strictObject({ provider: z.string().min(1).max(100), actorId: z.string().min(1).max(200) }),
  ]),
  decidedAt: z.iso.datetime({ offset: true }),
});
const authorizationBinding = {
  assessmentId: z.uuid(),
  cycleId: z.uuid(),
  destination: normalizedEventSchema.shape.destination,
  patchDigest: digest,
};
export const authorizationSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...authorizationBinding,
    kind: z.literal('policy'),
    configurationDigest: digest,
    outcome: dispositionSchema,
  }),
  z.strictObject({
    ...authorizationBinding,
    kind: z.literal('human'),
    reviewId: z.uuid(),
    revision: z.number().int().positive(),
    reviewDigest: digest,
    decisionId: z.uuid(),
  }),
]);
export type Authorization = z.infer<typeof authorizationSchema>;
export type ReviewPacket = z.infer<typeof reviewPacketSchema>;
export type DecisionInput = z.infer<typeof decisionInputSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export function digestValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export const businessStates = [
  'researching',
  'publishing_review',
  'awaiting_review',
  'applying',
  'applied',
  'rejected',
  'changes_requested',
  'expired',
  'conflict',
  'failed',
] as const;
export type BusinessState = (typeof businessStates)[number];
